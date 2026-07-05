import { NextResponse } from "next/server";
import { resolveCoords, haversineKm, fetchWithTimeout } from "@/lib/geo";
import { callSerpApi } from "@/lib/serpapi";

/** Open-Meteo geocoding with an explicit free-text query string. */
async function openMeteoSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetchWithTimeout(url, 5000);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return { lat: data.results[0].latitude, lng: data.results[0].longitude };
    }
  } catch (err) {
    console.warn(`[geocode] open-meteo failed for "${query}":`, err);
  }
  return null;
}

/**
 * Tiny deterministic jitter so that multiple fallback-resolved activities in
 * the same destination don't all render on top of each other. The offset is
 * derived from the place name so it is stable across re-renders.
 */
function nameJitter(place: string): { dlat: number; dlng: number } {
  let hash = 0;
  for (let i = 0; i < place.length; i++) {
    hash = (hash * 31 + place.charCodeAt(i)) & 0xffffffff;
  }
  // ±0.008° ≈ ±900 m — small enough to stay in the city, big enough to separate pins
  const dlat = ((hash & 0xff) / 255 - 0.5) * 0.016;
  const dlng = (((hash >> 8) & 0xff) / 255 - 0.5) * 0.016;
  return { dlat, dlng };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const place = searchParams.get("place");
  const location = searchParams.get("location");

  if (!place) {
    return NextResponse.json({ error: 'Missing "place" query parameter' }, { status: 400 });
  }



  try {
    // 1a. Local CITY_COORDS dictionary lookup (exact place name)
    const coordsLocal = await resolveCoords(place);
    if (coordsLocal) {

      return NextResponse.json(coordsLocal);
    }

    // 1b. Open-Meteo with just the place name
    const coordsPlaceOnly = await openMeteoSearch(place);
    if (coordsPlaceOnly) {
      // If we have a location context, sanity-check the distance
      if (location) {
        const destCoords = await resolveCoords(location);
        if (destCoords) {
          const dist = haversineKm(destCoords.lat, destCoords.lng, coordsPlaceOnly.lat, coordsPlaceOnly.lng);
          if (dist <= 300) {

            return NextResponse.json(coordsPlaceOnly);
          } else {
            console.warn(`[geocode] Open-Meteo place-only rejected (${Math.round(dist)} km away). Trying contextual query.`);
          }
        } else {
          // no known dest coords — trust it anyway

          return NextResponse.json(coordsPlaceOnly);
        }
      } else {

        return NextResponse.json(coordsPlaceOnly);
      }
    }

    // 1c. Open-Meteo with "place, location" context string
    if (location) {
      const contextQuery = `${place}, ${location}`;
      const coordsCtx = await openMeteoSearch(contextQuery);
      if (coordsCtx) {
        const destCoords = await resolveCoords(location);
        if (destCoords) {
          const dist = haversineKm(destCoords.lat, destCoords.lng, coordsCtx.lat, coordsCtx.lng);
          if (dist <= 300) {

            return NextResponse.json(coordsCtx);
          } else {
            console.warn(`[geocode] Open-Meteo contextual also out of range (${Math.round(dist)} km). Continuing.`);
          }
        } else {

          return NextResponse.json(coordsCtx);
        }
      }
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


        // Distance validation: reject points > 300km from known destination center
        if (location) {
          const destCoords = await resolveCoords(location);
          if (destCoords) {
            const dist = haversineKm(destCoords.lat, destCoords.lng, coords.lat, coords.lng);
            if (dist > 300) {
              console.warn(`[geocode] SerpAPI rejected: "${place}" is ${Math.round(dist)} km from ${location}. Falling back to location center.`);
              // apply jitter so stacking doesn't occur
              const { dlat, dlng } = nameJitter(place);
              return NextResponse.json({ lat: destCoords.lat + dlat, lng: destCoords.lng + dlng });
            }
          }
        }
        return NextResponse.json(coords);
      }
    }

    // 3. If all resolution methods fail, return 404
    console.error(`[geocode] ✗ Completely failed to resolve coordinates for "${place}".`);
    return NextResponse.json({ error: `Could not resolve coordinates for "${place}"` }, { status: 404 });
  } catch (error: any) {
    console.error("[geocode] Unexpected geocoding error:", error);
    return NextResponse.json({ error: "An unexpected geocoding error occurred" }, { status: 404 });
  }
}
