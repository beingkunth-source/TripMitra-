import { NextResponse } from "next/server";
import { callGemini } from "@/lib/api-helper";

export async function POST(request: Request) {
  try {
    const { destination, dayNumber, dayTheme, existingActivities = [], allTripActivities = [] } = await request.json();

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    const prompt = `You are a senior travel itinerary planner. Suggest 3 to 5 unique travel attraction stops or cafes for day ${dayNumber || 1} of a trip to ${destination} (theme: '${dayTheme || "Sightseeing"}').
The existing stops for this day are: ${JSON.stringify(existingActivities)}.
The stops on other days are: ${JSON.stringify(allTripActivities)}.
Avoid any of these duplicates and provide distinct, fresh landmarks.
Return ONLY a valid JSON object with this exact structure:
{
  "suggestions": [
    { "name": "Specific Place Name", "description": "Short engaging 1-sentence description.", "time": "Morning" }
  ]
}
For the "time" field, choose exactly one of: "Morning", "Afternoon", or "Evening". Do not use markdown blocks, just raw JSON.`;

    const geminiData = await callGemini(prompt);
    if (geminiData && geminiData.suggestions && Array.isArray(geminiData.suggestions)) {
      return NextResponse.json(geminiData);
    }

    // Heuristic Local Fallback if Gemini fails or quota is exhausted
    console.warn(`[suggest-stop] Gemini call failed or quota exceeded. Returning mock suggestions fallback for ${destination}.`);
    
    // Curated local templates for popular cities
    const popularData: Record<string, { name: string; description: string; time: string }[]> = {
      goa: [
        { name: "Basilica of Bom Jesus", description: "A UNESCO World Heritage site holding the mortal remains of St. Francis Xavier.", time: "Morning" },
        { name: "Anjuna Flea Market", description: "Bustling beachside market featuring local crafts, spices, and bohemian garments.", time: "Afternoon" },
        { name: "Dona Paula Viewpoint", description: "Stunning rocky tourist headland offering panoramic ocean views and sunset spots.", time: "Evening" },
        { name: "Mangueshi Temple", description: "Beautiful 450-year-old temple dedicated to Lord Manguesh in Priol.", time: "Morning" },
        { name: "Fontainhas Latin Quarter", description: "Enchanting streets of Panaji lined with brightly colored Portuguese houses and cafes.", time: "Afternoon" }
      ],
      paris: [
        { name: "Louvre Museum", description: "The world's largest art museum, home to the Mona Lisa and Venus de Milo.", time: "Morning" },
        { name: "Jardin du Luxembourg", description: "Lush gardens featuring beautiful statues, water fountains, and tranquil walking trails.", time: "Afternoon" },
        { name: "Eiffel Tower Summit", description: "Iconic wrought-iron lattice tower on the Champ de Mars with breathtaking city views.", time: "Evening" },
        { name: "Sacré-Cœur Basilica", description: "Stunning Roman Catholic church set high atop the artistic Montmartre hill.", time: "Morning" },
        { name: "Seine River Cruise", description: "Relaxing boat journey sailing past Notre-Dame, historic bridges, and Louvre lights.", time: "Evening" }
      ],
      tokyo: [
        { name: "Senso-ji Temple", description: "Tokyo's oldest and most iconic Buddhist temple in the heart of historic Asakusa.", time: "Morning" },
        { name: "Shibuya Crossing & Hachiko", description: "The world's busiest pedestrian intersection surrounded by vibrant shopping skyscrapers.", time: "Afternoon" },
        { name: "Tokyo Tower View deck", description: "Eiffel-inspired red and white observation tower offering sweeping night skylines.", time: "Evening" },
        { name: "Meiji Jingu Shrine", description: "Serene shrine surrounded by a dense forest park in busy Shibuya district.", time: "Morning" },
        { name: "Shinjuku Gyoen National Garden", description: "Beautiful spacious garden mixing Japanese, French, and English landscape styles.", time: "Afternoon" }
      ],
      kyoto: [
        { name: "Fushimi Inari Shrine", description: "Famous mountain trail lined with thousands of vibrant orange torii gates.", time: "Morning" },
        { name: "Kinkaku-ji (Golden Pavilion)", description: "Zen Buddhist temple with the top two floors completely covered in gold leaf.", time: "Afternoon" },
        { name: "Gion District Walk", description: "Historic neighborhood filled with traditional wooden merchant machiya houses.", time: "Evening" },
        { name: "Arashiyama Bamboo Grove", description: "Lush pathways flanked by towering bamboo stalks rustling in the wind.", time: "Morning" },
        { name: "Kiyomizu-dera Temple", description: "Historic wooden temple perched on Mount Otowa with panoramic terrace views.", time: "Afternoon" }
      ]
    };

    const destKey = destination.toLowerCase().trim();
    let candidates = popularData[destKey] || [];

    if (candidates.length === 0) {
      candidates = [
        { name: `${destination} Historical Center`, description: `Explore the vibrant local history and architecture of central ${destination}.`, time: "Morning" },
        { name: `${destination} Botanical Gardens`, description: `Unwind amidst lush greenery and colorful exotic flower collections in ${destination}.`, time: "Afternoon" },
        { name: `${destination} Panoramic Viewpoint`, description: `Scale the highest peak of ${destination} for a stunning sunset panorama.`, time: "Evening" },
        { name: `${destination} Cultural Museum`, description: `Discover the fine arts, folklore, and heritage crafts of ${destination}.`, time: "Morning" },
        { name: `${destination} Market Square`, description: `Browse local farm products, souvenirs, and try delicious street food bites.`, time: "Afternoon" }
      ];
    }

    const normalizedAllTrip = allTripActivities.map((a: string) => a.toLowerCase().trim());
    const suggestions = candidates.filter((item) => {
      const normName = item.name.toLowerCase().trim();
      return !normalizedAllTrip.some((ex: string) => normName.includes(ex) || ex.includes(normName));
    }).slice(0, 3);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("suggest-stop API error:", error);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
