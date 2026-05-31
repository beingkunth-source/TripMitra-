import { NextResponse } from "next/server";
import { callGemini, callSerpApi } from "@/lib/api-helper";

export async function POST(request: Request) {
  try {
    const { source, destination, dates, interests } = await request.json();

    let daysItinerary = [];
    let places = [];

    // 1. Fetch Gemini Itinerary
    try {
      const prompt = `Create a detailed, multi-day holiday itinerary for a trip from ${source} to ${destination} on these dates: ${dates}. Interests: ${interests || 'general'}. If the dates span is unclear or too short, please generate a full 3-day itinerary. Return ONLY a valid JSON array of objects, where each object has a 'day' (e.g. "Day 1") and 'activities'. 'activities' must be an array of objects with 'time' (e.g. "Morning", "Afternoon", "Evening") and 'description'. Important: In each description, wrap the names of specific landmarks, monuments, or tourist attractions inside double asterisks like **Gateway of India** so they stand out. Do not use markdown blocks, just raw JSON.`;
      const geminiResult = await callGemini(prompt);
      if (Array.isArray(geminiResult) && geminiResult.length > 0) {
        daysItinerary = geminiResult;
      }
    } catch (err) {
      console.error("Gemini itinerary generation error:", err);
    }

    // Itinerary Fallback
    if (daysItinerary.length === 0) {
      daysItinerary = [
        {
          day: "Day 1",
          activities: [
            { time: "Morning", description: `Arrival in ${destination} and check-in to your selected **hotel**.` },
            { time: "Afternoon", description: `Explore the vibrant **city center** and grab lunch at a local cafe.` },
            { time: "Evening", description: `Enjoy a scenic sunset walk around **scenic viewpoints** followed by a welcome dinner.` }
          ]
        },
        {
          day: "Day 2",
          activities: [
            { time: "Morning", description: `Take a guided tour of the famous **historical landmarks** and heritage museums.` },
            { time: "Afternoon", description: `Indulge in a local food crawl around the historical **old market bazaar**.` },
            { time: "Evening", description: `Enjoy cultural musical performances and sunset views from a **rooftop lounge**.` }
          ]
        },
        {
          day: "Day 3",
          activities: [
            { time: "Morning", description: `Breakfast at a local bakery, followed by visit to the **nature gardens**.` },
            { time: "Afternoon", description: `Last-minute souvenir shopping at the local **artisan boutiques**.` },
            { time: "Evening", description: `Check-out and head back home.` }
          ]
        }
      ];
    }

    // 2. Fetch TripAdvisor Places
    try {
      const data = await callSerpApi({
        engine: "tripadvisor",
        q: destination,
        ssrc: "a"
      });

      if (data && data.places) {
        places = data.places.slice(0, 6).map((p: any) => ({
          title: p.title,
          description: p.description || p.highlighted_review?.text || "Highly recommended place to visit.",
          rating: p.rating || "N/A",
          thumbnail: p.thumbnail || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
          type: p.place_type || "ATTRACTION"
        }));
      }
    } catch (err) {
      console.error("TripAdvisor SerpAPI fetch error:", err);
    }

    // TripAdvisor Fallback
    if (places.length === 0) {
      places = [
        { title: `${destination} Landmark Spot`, description: "Highly recommended cultural and scenic location.", rating: 4.8, thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", type: "ATTRACTION" },
        { title: `${destination} Local Market`, description: "Famous place for local shopping, street eats, and souvenirs.", rating: 4.5, thumbnail: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80", type: "ATTRACTION" },
        { title: `${destination} Botanical Sanctuary`, description: "A quiet, green, scenic escape inside the city center.", rating: 4.6, thumbnail: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80", type: "ATTRACTION" }
      ];
    }

    return NextResponse.json({ itinerary: { days: daysItinerary, places } });
  } catch (error: any) {
    console.error("Error generating itinerary:", error);
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 });
  }
}
