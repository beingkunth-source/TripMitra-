import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const { destination, days, travelers, budget } = await request.json();
    const totalBudget = Number(budget) || 50000;
    const countDays = Number(days) || 3;
    const countTravelers = Number(travelers) || 1;
    const perPerson = Math.round(totalBudget / countTravelers / countDays);

    const prompt = `You are a travel budget analyst. For a trip to ${destination} for ${countDays} days with ${countTravelers} traveler(s) and a total budget of Rs ${totalBudget}:
1. Suggest 3-4 specific activities, dining, or experiences that fit this budget. Be specific to ${destination}.
2. Calculate the "next luxury tier" — an additional amount that would meaningfully upgrade the trip (e.g., 3-star to 4-star hotel, add a guided tour).
3. Describe what the upgrade unlocks.

Return ONLY valid JSON:
{
  "potential": ["activity/dining suggestion 1", "activity/dining suggestion 2", "activity/dining suggestion 3", "activity/dining suggestion 4"],
  "upsell_gap": <number>,
  "upsell_description": "What Rs <number> more would unlock for this trip."
}
Do not use markdown blocks. Make amounts realistic for ${destination}.`;

    const geminiData = await callGemini(prompt);
    if (geminiData) return NextResponse.json(geminiData);

    // Fallback Mock
    const upsellGap = Math.round(perPerson * 1.5 * countDays);
    return NextResponse.json({
      potential: [
        `Explore the historic architecture of ${destination} with an audio guide.`,
        `Daily traditional breakfasts at a local cafe in ${destination}.`,
        `Enjoy a relaxing afternoon walk in ${destination}'s central parks.`,
        `Dinner at a highly rated local street-style bistro.`
      ],
      upsell_gap: upsellGap,
      upsell_description: `With just Rs ${upsellGap.toLocaleString("en-IN")} more, upgrade to a centrally located boutique 4-star hotel with city views, and add a guided sunset excursion.`
    });
  } catch (error: any) {
    console.error("Budget intelligence error:", error);
    return NextResponse.json({ error: "Failed to fetch budget intelligence data" }, { status: 500 });
  }
}
