import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";

export async function POST(request: Request) {
  try {
    const { origin, destination } = await request.json();
    if (!origin || !destination) {
      return NextResponse.json({ isInternational: false });
    }

    const prompt = `Determine if traveling from "${origin}" to "${destination}" is an international trip (crossing a national border). Return ONLY a valid JSON object: { "isInternational": true/false }. Do not use markdown.`;
    const geminiData = await callGemini(prompt);
    if (geminiData && typeof geminiData.isInternational === "boolean") {
      return NextResponse.json({ isInternational: geminiData.isInternational });
    }

    // Fallback: simple heuristic checking country overlap
    const indianCities = [
      'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 
      'jaipur', 'goa', 'kochi', 'lucknow', 'chandigarh', 'indore', 'nagpur', 'srinagar', 
      'guwahati', 'bhubaneswar', 'amritsar', 'surat', 'vizag', 'patna', 'ranchi', 'dehradun', 
      'udaipur', 'shimla', 'manali', 'jaisalmer', 'jodhpur', 'varanasi', 'agra', 'bengaluru'
    ];
    const destLower = destination.toLowerCase();
    const originLower = origin.toLowerCase();
    const destIsIndian = indianCities.some(c => destLower.includes(c));
    const originIsIndian = indianCities.some(c => originLower.includes(c));
    const isInternational = destIsIndian !== originIsIndian || (!destIsIndian && !originIsIndian);

    return NextResponse.json({ isInternational });
  } catch (error: any) {
    console.error("Border check error:", error);
    return NextResponse.json({ isInternational: true });
  }
}
