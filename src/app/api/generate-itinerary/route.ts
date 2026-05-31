import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";
import { checkRateLimit, getCached, setCached } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limitCheck = await checkRateLimit(ip, 25, 60);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limitCheck.limit.toString(),
            "X-RateLimit-Remaining": limitCheck.remaining.toString(),
          }
        }
      );
    }

    const { destination, originCity, travelers, days, budgetLimit } = await request.json();
    const requestedDays = Math.min(30, Math.max(1, Number(days) || 3));
    const generatedDays = requestedDays > 7 ? 7 : requestedDays;
    const longTripNote = requestedDays > 7 ? `Showing optimal 7-day highlight route for ${destination}.` : '';

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    // 2. Cache Lookup
    const cacheKey = `tripmitra:itinerary:${destination.toLowerCase().trim()}:${originCity?.toLowerCase()?.trim() || "mumbai"}:${generatedDays}:${travelers || 1}:${budgetLimit || 50000}`;
    const cachedItinerary = await getCached<any>(cacheKey);
    if (cachedItinerary) {
      console.log(`[Redis] Cache HIT for key: ${cacheKey}`);
      return NextResponse.json({
        ...cachedItinerary,
        isCached: true,
      });
    }

    const prompt = `Generate a ${generatedDays}-day travel itinerary for ${destination}. The traveler is departing from ${originCity || 'their origin city'}, with ${travelers || 1} traveler(s), and a total budget limit of Rs ${budgetLimit || 'flexible'}. Return ONLY a valid JSON object with this exact structure, no markdown or code fences:
{
  "days": [
    {
      "dayNumber": 1,
      "theme": "Arrival & First Look",
      "activities": [
        { "name": "Specific Place Name", "description": "Short engaging description of what to do here." }
      ]
    }
  ]
}
Each day should have exactly 3 activities with real, specific place names in ${destination}. Make the activities geographically logical — within walking distance or short transit of each other. Day 1 starts with arrival from ${originCity || 'the origin city'}, the final day ends with departure. Be specific, not generic. Generate exactly ${generatedDays} days. Ensure every single day has completely unique, geographically logical activities. Do not repeat activities across days.`;

    const geminiData = await callGemini(prompt);
    if (geminiData?.days?.length) {
      const responsePayload = {
        ...geminiData,
        days: geminiData.days.slice(0, generatedDays),
        requestedDays,
        generatedDays,
        note: longTripNote,
      };
      
      // Store in Redis (cache for 48 hours)
      await setCached(cacheKey, responsePayload, 172800);
      
      return NextResponse.json(responsePayload);
    }

    // Fallback Mock
    const mockItinerary: any = { days: [], requestedDays, generatedDays, note: longTripNote };
    const uniqueTemplates = [
      ['Heritage Arrival Walk', 'Old Town Tea House', 'Riverside Dinner Quarter'],
      ['Museum District', 'Architectural Landmark Tour', 'Chef-Led Market Table'],
      ['Botanical Garden Trail', 'Local Craft Workshop', 'Sunset Viewpoint'],
      ['Historic Fort Complex', 'Street Food Crawl', 'Night Bazaar'],
      ['Coastal Promenade', 'Design Gallery Visit', 'Rooftop Tasting Menu'],
      ['Sacred Temple Loop', 'Traditional Music House', 'Lantern-Lit Dinner'],
      ['Hidden Neighborhood Walk', 'Artisan Studio Visit', 'Departure Cafe']
    ];

    for (let d = 1; d <= generatedDays; d++) {
      const themes = ['Arrival & Explore', 'Signature Experiences', 'Culture & Nature', 'History & Food', 'Design & Dining', 'Sacred Places', 'Slow Close'];
      const names = uniqueTemplates[(d - 1) % uniqueTemplates.length];
      mockItinerary.days.push({
        dayNumber: d,
        theme: themes[(d - 1) % themes.length],
        activities: names.map((name, idx) => ({
          name: `${destination} ${name}`,
          description: `Day ${d} ${idx === 0 ? 'morning' : idx === 1 ? 'afternoon' : 'evening'} experience designed around a unique area of ${destination}.`
        })),
      });
    }

    // Cache the fallback too to prevent repeated failures
    await setCached(cacheKey, mockItinerary, 172800);

    return NextResponse.json(mockItinerary);
  } catch (error: any) {
    console.error("Itinerary generation error:", error);
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 });
  }
}
