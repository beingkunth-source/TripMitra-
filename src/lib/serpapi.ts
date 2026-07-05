export async function callSerpApi(params: Record<string, any>): Promise<any> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.warn("No SERP_API_KEY configured.");
    return null;
  }
  try {
    const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
    const url = `https://serpapi.com/search.json?${searchParams.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`SerpAPI error status ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error("SerpAPI fetch error:", err.message);
    return null;
  }
}
