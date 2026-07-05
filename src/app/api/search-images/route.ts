import { NextResponse } from "next/server";
import { callSerpApi } from "@/lib/serpapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  try {
    const data = await callSerpApi({
      engine: "google_images",
      q: `${q} travel destination landmark cityscape`,
      ijn: "0"
    });

    if (data && data.images_results) {
      const images = data.images_results.slice(0, 12).map((img: any) => ({
        title: img.title,
        thumbnail: img.thumbnail,
        original: img.original,
      }));
      return NextResponse.json({ images });
    }

    return NextResponse.json({ images: [] });
  } catch (error: any) {
    console.error("Error searching images:", error);
    return NextResponse.json({ error: "Failed to search images", images: [] }, { status: 500 });
  }
}
