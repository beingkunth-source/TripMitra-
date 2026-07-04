import { NextResponse } from "next/server";
import { callSerpApi } from "@/lib/api-helper";
import { getCached, setCached } from "@/lib/redis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const check_in_date = searchParams.get("check_in_date");
  const check_out_date = searchParams.get("check_out_date");

  if (!q || !check_in_date || !check_out_date) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  // 1. Cache Lookup
  const cacheKey = `tripmitra:hotels:${q.toLowerCase().trim()}:${check_in_date}:${check_out_date}`;
  try {
    const cachedHotels = await getCached<any>(cacheKey);
    if (cachedHotels) {
      console.log(`[Redis] Cache HIT for hotels key: ${cacheKey}`);
      return NextResponse.json(cachedHotels);
    }

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      console.log("No SERP_API_KEY found. Returning mock hotel data.");
      const mockData = {
        properties: [
          {
            name: "The Grand Retreat Resort",
            overall_rating: 4.8,
            rate_per_night: { lowest: "₹4,500" },
            images: [{ thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" }]
          },
          {
            name: "Boutique Cozy Heights",
            overall_rating: 4.2,
            rate_per_night: { lowest: "₹2,800" },
            images: [{ thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" }]
          },
          {
            name: "Eco Park View Lodge",
            overall_rating: 4.5,
            rate_per_night: { lowest: "₹3,200" },
            images: [{ thumbnail: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" }]
          }
        ]
      };
      return NextResponse.json(mockData);
    }

    const data = await callSerpApi({
      engine: "google_hotels",
      q,
      check_in_date,
      check_out_date,
      currency: "INR",
      hl: "en"
    });

    if (data && data.properties) {
      // Cache SerpAPI result for 24 hours
      await setCached(cacheKey, data, 86400);
      return NextResponse.json(data);
    }

    if (data && data.error) {
      console.error(`[SerpAPI Hotels API Error] SerpAPI returned an error code/message: "${data.error}"`);
    } else {
      console.error(`[SerpAPI Hotels Format Error] Request succeeded but returned no properties. Response keys: ${data ? Object.keys(data).join(", ") : "null"}`);
    }

    // Failover Mock Data
    console.warn(`SerpAPI hotels query failed. Returning mock hotels failover.`);
    const mockFailover = {
      properties: [
        {
          name: `${q} Heritage Palace & Spa`,
          overall_rating: 4.8,
          rate_per_night: { lowest: "₹5,400" },
          images: [{ thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" }]
        },
        {
          name: `${q} Grand Premium Resort`,
          overall_rating: 4.6,
          rate_per_night: { lowest: "₹4,200" },
          images: [{ thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" }]
        },
        {
          name: `${q} Boutique Overlook Inn`,
          overall_rating: 4.4,
          rate_per_night: { lowest: "₹3,100" },
          images: [{ thumbnail: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" }]
        }
      ]
    };

    // Cache mock failover for 2 hours
    await setCached(cacheKey, mockFailover, 7200);

    return NextResponse.json(mockFailover);
  } catch (error: any) {
    console.error("[SerpAPI Hotels Exception] Failed to execute hotel query:", error);
    return NextResponse.json({ error: `Failed to fetch hotels: ${error.message}` }, { status: 500 });
  }
}
