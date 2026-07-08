import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";
import { CITY_COORDS } from "@/lib/geo";

export async function POST(request: Request) {
  try {
    const { messages, destination, dates, travelers } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1]?.content || "";

    // Generate a context-enriched prompt for Gemini
    const contextPrompt = `You are TripMitra's AI Travel Assistant, a senior expert travel planner. 
We are planning a trip to ${destination || "their destination"} on dates: ${dates || "flexible dates"} with ${travelers || 1} traveler(s).
The user is asking: "${latestMessage}".
Review the conversation history for context: ${JSON.stringify(messages.slice(-5))}.

Provide a helpful, professional, engaging response. Recommend specific attractions, local eats, transit routes, or travel hacks.
Format your output as a clean JSON object with this exact structure:
{
  "reply": "your rich text reply here. You can use bold markup like **landmark** for attractions",
  "suggestions": ["suggested follow-up question 1", "suggested follow-up question 2"]
}
Keep the suggestions short (4-8 words). Do not use markdown blocks, just raw JSON.`;

    const geminiData = await callGemini(contextPrompt);
    if (geminiData && geminiData.reply) {
      return NextResponse.json(geminiData);
    }

    // Intelligent Fallback Analysis if Gemini is rate-limited (429) or fails
    const lowerMessage = latestMessage.toLowerCase();
    let reply = "";
    let suggestions: string[] = [];

    // Check if the user is asking about costs, buses, trains, cabs between cities
    const hasBus = lowerMessage.includes("bus");
    const hasTrain = lowerMessage.includes("train");
    const hasCab = lowerMessage.includes("cab") || lowerMessage.includes("taxi") || lowerMessage.includes("car");
    const hasFlight = lowerMessage.includes("flight") || lowerMessage.includes("plane") || lowerMessage.includes("air");
    const hasCost = lowerMessage.includes("cost") || lowerMessage.includes("how much") || lowerMessage.includes("price") || lowerMessage.includes("fare") || lowerMessage.includes("ruppe") || lowerMessage.includes("rupee") || lowerMessage.includes("ticket");

    if (hasCost && (hasBus || hasTrain || hasCab || hasFlight)) {
      let origin = "Mumbai";
      let dest = destination || "Gwalior";
      
      const routeMatch = lowerMessage.match(/(?:from\s+)?([a-z\s]+)\s+to\s+([a-z\s\?]+)/i);
      if (routeMatch) {
        origin = routeMatch[1].trim();
        dest = routeMatch[2].replace(/\?/g, "").trim();
      }

      // Calculate approximate distance using geo database
      let distanceKm = 800; // default
      const coord1 = CITY_COORDS[origin.toLowerCase()] || CITY_COORDS[origin.toLowerCase().split(" ")[0]] || CITY_COORDS["mumbai"];
      const coord2 = CITY_COORDS[dest.toLowerCase()] || CITY_COORDS[dest.toLowerCase().split(" ")[0]] || CITY_COORDS["gwalior"];

      if (coord1 && coord2) {
        const R = 6371; // Earth radius in km
        const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
        const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distanceKm = Math.round(R * c);
      }

      if (hasBus) {
        const minPrice = Math.round(distanceKm * 0.9 + 100);
        const maxPrice = Math.round(distanceKm * 1.5 + 250);
        reply = `A bus ticket from **${origin}** to **${dest}** typically costs between **₹${minPrice}** and **₹${maxPrice}** depending on the operator (ordinary sleeper vs. private AC Volvo Sleeper coaches). The road trip takes about **${Math.round(distanceKm / 55)} to ${Math.round(distanceKm / 50)} hours**.`;
        suggestions = ["Train ticket options", "Flight prices"];
      } else if (hasTrain) {
        const sleeper = Math.round(distanceKm * 0.4 + 120);
        const thirdAC = Math.round(distanceKm * 1.1 + 300);
        const secondAC = Math.round(distanceKm * 1.6 + 500);
        reply = `Traveling from **${origin}** to **${dest}** by train is highly convenient. Ticket pricing is around:\n- **Sleeper Class (SL):** ₹${sleeper} - ₹${sleeper + 150}\n- **3 AC Class (3A):** ₹${thirdAC} - ₹${thirdAC + 200}\n- **2 AC Class (2A):** ₹${secondAC} - ₹${secondAC + 300}\n\nWe recommend booking on the IRCTC website.`;
        suggestions = ["Bus fare estimates", "Local transit details"];
      } else if (hasCab) {
        const price = Math.round(distanceKm * 13 + 500);
        reply = `A private one-way cab or taxi from **${origin}** to **${dest}** would cost around **₹${price}** to **₹${price + 2500}**, covering tolls, fuel, and driver allowances. It's a drive of approximately **${Math.round(distanceKm / 65)} hours**.`;
        suggestions = ["Flight prices", "Bus fare estimates"];
      } else {
        const flightPrice = Math.round(3200 + distanceKm * 2.2);
        reply = `Direct or connecting flights from **${origin}** to **${dest}** (nearest airport) typically range from **₹${flightPrice}** to **₹${flightPrice + 3000}** if booked in advance. Check the Deals tab for live details!`;
        suggestions = ["Flight ticket details", "Hotel deals"];
      }
    } else if (lowerMessage.includes("flight") || lowerMessage.includes("ticket") || lowerMessage.includes("airline") || lowerMessage.includes("fly")) {
      reply = `To find the best flight options to **${destination || "your destination"}**, check the **Deals page** inside your workspace header! It pulls real-time flight rates and airline itineraries. I recommend booking at least 6-8 weeks in advance for the best deals.`;
      suggestions = ["Transit & subway hacks", "Budget eating tips"];
    } else if (lowerMessage.includes("transit") || lowerMessage.includes("subway") || lowerMessage.includes("transport") || lowerMessage.includes("bus") || lowerMessage.includes("metro") || lowerMessage.includes("cab") || lowerMessage.includes("taxi") || lowerMessage.includes("hack")) {
      reply = `Navigating **${destination || "your destination"}** is most efficient using public transit. I recommend getting a local multi-day transit card on arrival to save money. For short distances, walking is scenic, while official cabs are best booked via local ride-hailing apps.`;
      suggestions = ["Free things to do", "Flight ticket prices"];
    } else if (lowerMessage.includes("free")) {
      reply = `You don't need to spend a fortune in **${destination || "your destination"}**! I recommend checking out free walking tours, strolling through public parks and local street markets, and visiting public galleries which often have free entry days (typically on weekdays or first Sundays of the month).`;
      suggestions = ["Recommend sightseeing", "Budget eating tips"];
    } else if (lowerMessage.includes("pack") || lowerMessage.includes("clothes") || lowerMessage.includes("luggage")) {
      reply = `For your trip to **${destination || "your destination"}**, I recommend packing in layers. Make sure to bring comfortable walking shoes, a reliable power bank, and check if you need a universal travel adapter. Don't forget copies of your IDs and travel vouchers!`;
      suggestions = ["Do I need a visa?", "Weather forecast?"];
    } else if (lowerMessage.includes("weather") || lowerMessage.includes("rain") || lowerMessage.includes("temperature")) {
      reply = `The weather in **${destination || "your destination"}** varies. I suggest carrying a compact travel umbrella and checking the 7-day forecast panel in the sidebar for real-time temperatures. Outdoor sights are best done in the early mornings!`;
      suggestions = ["Suggest indoor sights", "What should I pack?"];
    } else if (lowerMessage.includes("food") || lowerMessage.includes("eat") || lowerMessage.includes("restaurant") || lowerMessage.includes("drink")) {
      reply = `In **${destination || "your destination"}**, don't miss out on local street food and boutique corner bistros. Seek out places crowded with locals rather than tourist traps. I suggest trying the signature regional desserts!`;
      suggestions = ["Top rated restaurants", "Budget eating tips"];
    } else if (lowerMessage.includes("budget") || lowerMessage.includes("cost") || lowerMessage.includes("price") || lowerMessage.includes("expensive")) {
      reply = `To optimize your budget in **${destination || "your destination"}**, utilize public transit (subways, buses) and explore free entry days at local galleries. Check the **Budget Page** for a full expense ledger and automatic spending alerts.`;
      suggestions = ["Free things to do", "Transit & subway hacks"];
    } else if (lowerMessage.includes("sightsee") || lowerMessage.includes("recommend") || lowerMessage.includes("visit") || lowerMessage.includes("see") || lowerMessage.includes("attraction")) {
      reply = `In **${destination || "your destination"}**, I highly recommend visiting the historic city center, walking through local cultural heritage markets, and exploring the iconic viewpoints. You can add these directly to your day-by-day planner stops!`;
      suggestions = ["Top local eateries", "Best photo locations", "Transit & subway hacks"];
    } else if (lowerMessage.includes("visa") || lowerMessage.includes("passport") || lowerMessage.includes("document") || lowerMessage.includes("entry requirements")) {
      reply = `Visa requirements for **${destination || "your destination"}** depend heavily on your traveler nationality. I recommend visiting the official immigration or consulate website of ${destination || "the destination country"} to verify current entry guidelines, visa-on-arrival terms, and passport validity requirements before booking flights.`;
      suggestions = ["Flight ticket prices", "Workspace Settings"];
    } else {
      reply = `Hi! I'm your **TripMitra AI Assistant**. I can help you plan your itinerary for **${destination || "your destination"}**, recommend hotels or flights, suggest packing items, and give local weather advice. What would you like to explore next?`;
      suggestions = ["Recommend sightseeing", "Packing tips", "Transit & subway hacks"];
    }

    return NextResponse.json({ reply, suggestions });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
  }
}
