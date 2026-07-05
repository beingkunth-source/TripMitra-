import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const { destination, dates, interests } = await request.json();

    const prompt = `You are a packing expert. For a trip to ${destination} on ${dates} with interests: ${interests || 'general'}, provide a comprehensive packing list.
    
Return ONLY a valid JSON object with this exact structure:
{
  "packing_suggestions": {
    "destination": "${destination}",
    "weather_note": "brief weather-based packing advice for this destination and time",
    "categories": [
      { "category": "Clothing", "items": ["item 1", "item 2", "item 3", "item 4"] },
      { "category": "Toiletries", "items": ["item 1", "item 2", "item 3", "item 4"] },
      { "category": "Electronics", "items": ["item 1", "item 2", "item 3", "item 4"] },
      { "category": "Documents", "items": ["item 1", "item 2", "item 3", "item 4"] },
      { "category": "Miscellaneous", "items": ["item 1", "item 2", "item 3", "item 4"] }
    ]
  }
}
Do not use markdown blocks, just raw JSON. Make items specific to ${destination} and the activities: ${interests || 'general'}.`;

    const geminiData = await callGemini(prompt);
    if (geminiData) return NextResponse.json(geminiData);

    // Fallback Mock
    return NextResponse.json({
      packing_suggestions: {
        destination: destination,
        weather_note: "Check local weather before packing, carry layers as temperatures can vary.",
        categories: [
          { category: "Clothing", items: ["Lightweight layers", "Comfortable walking shoes", "Evening jacket/cardigan", "Rainwear/umbrella"] },
          { category: "Toiletries", items: ["Sunscreen SPF 30+", "Insect repellent", "Personal hygiene kit", "Travel first-aid pack"] },
          { category: "Electronics", items: ["Phone & charger", "Power bank (10000mAh)", "Camera / backup card", "Universal travel adapter"] },
          { category: "Documents", items: ["Passport / Government ID", "Hotel & flight vouchers", "Travel insurance printout", "Emergency contacts list"] },
          { category: "Miscellaneous", items: ["Reusable water bottle", "Daypack / sling bag", "Travel pillow", "Sunglasses & hat"] }
        ]
      }
    });
  } catch (error: any) {
    console.error("Packing suggestions error:", error);
    return NextResponse.json({ error: "Failed to generate packing list" }, { status: 500 });
  }
}
