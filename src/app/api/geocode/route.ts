import { NextResponse } from "next/server";
import { resolveCoords, callSerpApi, haversineKm } from "@/lib/api-helper";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const place = searchParams.get("place");
  const location = searchParams.get("location");

  if (!place) {
    return NextResponse.json({ error: 'Missing "place" query parameter' }, { status: 400 });
  }

  try {
    // 1. Try local dictionary / Open-Meteo Geocoding API
    const coordsLocal = await resolveCoords(place);
    if (coordsLocal) {
      return NextResponse.json(coordsLocal);
    }

    // 2. Try SerpAPI Google Maps engine if available
    const apiKey = process.env.SERP_API_KEY;
    if (apiKey) {
      const data = await callSerpApi({
        engine: "google_maps",
        q: `${place}, ${location || ""}`.replace(/,\s*$/, ""),
        hl: "en"
      });

      const placeData = data?.place_results || data?.local_results?.[0];
      if (placeData?.gps_coordinates?.latitude && placeData?.gps_coordinates?.longitude) {
        const coords = { lat: placeData.gps_coordinates.latitude, lng: placeData.gps_coordinates.longitude };

        // Distance validation: reject points > 200km from known destination center
        if (location) {
          const destCoords = await resolveCoords(location);
          if (destCoords) {
            const dist = haversineKm(destCoords.lat, destCoords.lng, coords.lat, coords.lng);
            if (dist > 200) {
              console.warn(`Geocode rejected: "${place}" returned ${coords.lat},${coords.lng} (${Math.round(dist)}km from ${location}). Falling back to location center.`);
              return NextResponse.json(destCoords);
            }
          }
        }
        return NextResponse.json(coords);
      }
    }

    // 3. Fallback to location center coordinate
    if (location) {
      const destCoords = await resolveCoords(location);
      if (destCoords) {
        return NextResponse.json(destCoords);
      }
    }

    // 4. Default mock coordinate
    console.log(`Geocoding completely failed for "${place}". Returning default Reykjavik.`);
    return NextResponse.json({ lat: 64.1466, lng: -21.9426 });
  } catch (error: any) {
    console.error("Geocode error:", error);
    if (location) {
      const destCoords = await resolveCoords(location);
      if (destCoords) return NextResponse.json(destCoords);
    }
    return NextResponse.json({ lat: 64.1466, lng: -21.9426 });
  }
}
