import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";

export async function POST(request: Request) {
  try {
    const { destination, dates, interests, budget } = await request.json();

    const prompt = `You are a budget optimization expert. For a trip to ${destination} on ${dates} with interests: ${interests || 'general'} and total budget: ₹${budget || 'N/A'}, provide smart budget suggestions.
    
Return ONLY a valid JSON object with this exact structure:
{
  "budget_suggestions": {
    "total_budget": "${budget || 'N/A'}",
    "breakdown": [
      { "category": "Flights", "percentage": 30, "amount": <calculated_amount>, "tips": "tip for saving on flights" },
      { "category": "Hotels", "percentage": 30, "amount": <calculated_amount>, "tips": "tip for saving on hotels" },
      { "category": "Food", "percentage": 15, "amount": <calculated_amount>, "tips": "tip for saving on food" },
      { "category": "Activities", "percentage": 15, "amount": <calculated_amount>, "tips": "tip for saving on activities" },
      { "category": "Shopping & Misc", "percentage": 10, "amount": <calculated_amount>, "tips": "tip for miscellaneous savings" }
    ],
    "savings_tips": ["tip 1", "tip 2", "tip 3"]
  }
}

Calculate realistic amounts based on the total budget. Do not use markdown blocks, just raw JSON. Make the content specific to ${destination}.`;

    const geminiData = await callGemini(prompt);
    if (geminiData) return NextResponse.json(geminiData);

    // Fallback Mock
    const totalBudget = Number(budget) || 50000;
    return NextResponse.json({
      budget_suggestions: {
        total_budget: totalBudget.toString(),
        breakdown: [
          { category: "Flights", percentage: 35, amount: Math.round(totalBudget * 0.35), tips: "Track prices with Google Flights and book mid-week." },
          { category: "Hotels", percentage: 30, amount: Math.round(totalBudget * 0.30), tips: "Look for hosteling options or boutique home stays." },
          { category: "Food", percentage: 15, amount: Math.round(totalBudget * 0.15), tips: "Indulge in local lunch menus or street stalls; dinners are priciest." },
          { category: "Activities", percentage: 12, amount: Math.round(totalBudget * 0.12), tips: "Check for free museum entry days and city sightseeing passes." },
          { category: "Shopping & Misc", percentage: 8, amount: Math.round(totalBudget * 0.08), tips: "Set a strict souvenir list and avoid airport duty-free." }
        ],
        savings_tips: [
          "Travel during shoulder season for 30%+ savings on hotel lodging.",
          "Utilize local subway and metro lines rather than ride-sharing apps.",
          "Download offline maps to save on international cellular data charges."
        ]
      }
    });
  } catch (error: any) {
    console.error("Budget suggestions error:", error);
    return NextResponse.json({ error: "Failed to generate budget suggestions" }, { status: 500 });
  }
}
