export function parseGeminiResponse(text: string): any {
  if (!text) throw new Error("Empty Gemini response");
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");
  }
  return JSON.parse(cleaned);
}

export async function callGemini(prompt: string): Promise<any | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("No GEMINI_API_KEY configured.");
    return null;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("Gemini API error:", data.error.message);
      return null;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return parseGeminiResponse(text);
  } catch (err: any) {
    console.error("Gemini fetch error:", err.message);
    return null;
  }
}
