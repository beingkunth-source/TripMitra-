import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";

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

    // Heuristic Fallback Analysis if Gemini fails or quota is hit
    const lowerMessage = latestMessage.toLowerCase();
    let reply = "";
    let suggestions = [];

    if (lowerMessage.includes("pack") || lowerMessage.includes("clothes") || lowerMessage.includes("luggage")) {
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
      suggestions = ["Free things to do", "Transit options"];
    } else if (lowerMessage.includes("sightsee") || lowerMessage.includes("recommend") || lowerMessage.includes("visit") || lowerMessage.includes("see") || lowerMessage.includes("attraction")) {
      reply = `In **${destination || "your destination"}**, I highly recommend visiting the historic city center, walking through local cultural heritage markets, and exploring the iconic viewpoints. You can add these directly to your day-by-day planner stops!`;
      suggestions = ["Top local eateries", "Best photo locations", "Transit options"];
    } else if (lowerMessage.includes("visa") || lowerMessage.includes("passport") || lowerMessage.includes("document") || lowerMessage.includes("entry requirements")) {
      reply = `Visa requirements for **${destination || "your destination"}** depend heavily on your traveler nationality. I recommend visiting the official immigration or consulate website of ${destination || "the destination country"} to verify current entry guidelines, visa-on-arrival terms, and passport validity requirements before booking flights.`;
      suggestions = ["Flight ticket deals", "Workspace Settings"];
    } else {
      reply = `Hi! I'm your **TripMitra AI Assistant**. I can help you plan your itinerary for **${destination || "your destination"}**, recommend hotels or flights, suggest packing items, and give local weather advice. What would you like to explore next?`;
      suggestions = ["Recommend sightseeing", "Packing tips", "Flight ticket prices"];
    }

    return NextResponse.json({ reply, suggestions });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
  }
}
