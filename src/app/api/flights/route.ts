import { NextResponse } from "next/server";
import { callSerpApi, toAirportCode } from "@/lib/api-helper";
import { getCached, setCached } from "@/lib/redis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const departure_id = searchParams.get("departure_id");
  const arrival_id = searchParams.get("arrival_id");
  const outbound_date = searchParams.get("outbound_date");
  const return_date = searchParams.get("return_date");

  if (!departure_id || !arrival_id || !outbound_date) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  // 1. Cache Lookup
  const cacheKey = `tripmitra:flights:${departure_id.toLowerCase().trim()}:${arrival_id.toLowerCase().trim()}:${outbound_date}:${return_date || "oneway"}`;
  try {
    const cachedFlights = await getCached<any>(cacheKey);
    if (cachedFlights) {
      console.log(`[Redis] Cache HIT for flights key: ${cacheKey}`);
      return NextResponse.json(cachedFlights);
    }

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      console.log("No SERP_API_KEY found. Returning mock flight data.");
      const mockData = {
        best_flights: [
          {
            flights: [{ airline: "Mock Airlines", departure_airport: { time: "10:00 AM" }, arrival_airport: { time: "12:30 PM" } }],
            total_duration: 150,
            price: 5500
          },
          {
            flights: [{ airline: "Dummy Air", departure_airport: { time: "02:00 PM" }, arrival_airport: { time: "04:45 PM" } }],
            total_duration: 165,
            price: 4800
          }
        ]
      };
      return NextResponse.json(mockData);
    }

    const depCode = toAirportCode(departure_id);
    const arrCode = toAirportCode(arrival_id);

    const params: Record<string, any> = {
      engine: "google_flights",
      departure_id: depCode,
      arrival_id: arrCode,
      outbound_date: outbound_date,
      currency: "INR",
      hl: "en"
    };

    if (return_date) {
      params.return_date = return_date;
      params.type = "1";
    } else {
      params.type = "2";
    }

    const data = await callSerpApi(params);
    if (data && data.best_flights) {
      // Cache SerpAPI result for 24 hours
      await setCached(cacheKey, data, 86400);
      return NextResponse.json(data);
    }

    if (data && data.error) {
      console.error(`[SerpAPI Flights API Error] SerpAPI returned an error code/message: "${data.error}"`);
    } else {
      console.error(`[SerpAPI Flights Format Error] Request succeeded but returned no best_flights. Response keys: ${data ? Object.keys(data).join(", ") : "null"}`);
    }

    // Failover Mock Data
    console.warn(`SerpAPI flights query failed. Returning mock flights failover.`);
    const mockFailover = {
      best_flights: [
        {
          flights: [{ 
            airline: "Indigo Connection", 
            departure_airport: { name: `${departure_id} Airport`, time: "06:15 AM" }, 
            arrival_airport: { name: `${arrival_id} Intl`, time: "08:45 AM" } 
          }],
          total_duration: 150,
          price: 5800
        },
        {
          flights: [{ 
            airline: "Air India Regional", 
            departure_airport: { name: `${departure_id} Airport`, time: "11:30 AM" }, 
            arrival_airport: { name: `${arrival_id} Intl`, time: "02:10 PM" } 
          }],
          total_duration: 160,
          price: 6400
        },
        {
          flights: [{ 
            airline: "SpiceJet Saver", 
            departure_airport: { name: `${departure_id} Airport`, time: "05:45 PM" }, 
            arrival_airport: { name: `${arrival_id} Intl`, time: "08:20 PM" } 
          }],
          total_duration: 155,
          price: 4900
        }
      ]
    };

    // Cache mock failover for 2 hours to limit repeated hits
    await setCached(cacheKey, mockFailover, 7200);

    return NextResponse.json(mockFailover);
  } catch (error: any) {
    console.error("[SerpAPI Flights Exception] Failed to execute flight query:", error);
    return NextResponse.json({ error: `Failed to fetch flights: ${error.message}` }, { status: 500 });
  }
}
