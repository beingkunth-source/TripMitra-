import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";

export async function POST(request: Request) {
  try {
    const { destination, dates, weather_summary } = await request.json();

    const prompt = `You are a weather-savvy travel advisor. For a trip to ${destination} on ${dates}, here is the weather forecast summary: ${JSON.stringify(weather_summary)}.
    
Provide practical AI weather advice. Return ONLY a valid JSON object with this exact structure:
{ "weather_advice": { "best_visiting_hours": "advice", "clothing_recommendations": "what to wear", "activity_alternatives": "indoor/outdoor alternatives" } }
Be specific to ${destination} and the forecast data. Do not use markdown blocks, just raw JSON.`;

    const geminiData = await callGemini(prompt);
    if (geminiData) return NextResponse.json(geminiData);

    // Fallback Mock
    return NextResponse.json({
      weather_advice: {
        best_visiting_hours: "Early morning (6-9 AM) and late afternoon (4-6 PM) are typically the most comfortable times to explore.",
        clothing_recommendations: "Light, breathable clothing with a light jacket for evenings. Comfortable walking shoes recommended.",
        activity_alternatives: "Consider indoor activities like museums and shopping during peak heat hours. Outdoor activities best scheduled for mornings."
      }
    });
  } catch (error: any) {
    console.error("Error generating weather advice:", error);
    return NextResponse.json({ error: "Failed to generate weather advice" }, { status: 500 });
  }
}
