import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";
import { checkRateLimit, getCached, setCached } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limitCheck = await checkRateLimit(ip, 25, 60);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limitCheck.limit.toString(),
            "X-RateLimit-Remaining": limitCheck.remaining.toString(),
          }
        }
      );
    }

    const { destination, originCity, travelers, days, budgetLimit } = await request.json();
    const requestedDays = Math.min(30, Math.max(1, Number(days) || 3));
    const generatedDays = requestedDays > 7 ? 7 : requestedDays;
    const longTripNote = requestedDays > 7 ? `Showing optimal 7-day highlight route for ${destination}.` : '';

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    // 2. Cache Lookup
    const cacheKey = `tripmitra:itinerary:${destination.toLowerCase().trim()}:${originCity?.toLowerCase()?.trim() || "mumbai"}:${generatedDays}:${travelers || 1}:${budgetLimit || 50000}`;
    const cachedItinerary = await getCached<any>(cacheKey);
    if (cachedItinerary) {
      return NextResponse.json({
        ...cachedItinerary,
        isCached: true,
      });
    }

    const prompt = `Generate a ${generatedDays}-day travel itinerary for ${destination}. The traveler is departing from ${originCity || 'their origin city'}, with ${travelers || 1} traveler(s), and a total budget limit of Rs ${budgetLimit || 'flexible'}. Return ONLY a valid JSON object with this exact structure, no markdown or code fences:
{
  "days": [
    {
      "dayNumber": 1,
      "theme": "Arrival & First Look",
      "activities": [
        { "name": "Specific Place Name", "description": "Short engaging description of what to do here." }
      ]
    }
  ]
}
Each day should have exactly 3 activities with real, specific place names in ${destination}. Make the activities geographically logical — within walking distance or short transit of each other. Day 1 starts with arrival from ${originCity || 'the origin city'}, the final day ends with departure. Be specific, not generic. Generate exactly ${generatedDays} days. Ensure every single day has completely unique, geographically logical activities. Do not repeat activities across days.`;

    const geminiData = await callGemini(prompt);
    if (geminiData?.days?.length) {
      // Guarantee every activity has a distinct 'time' field
      const postProcessedDays = geminiData.days.slice(0, generatedDays).map((day: any) => ({
        ...day,
        theme: day.theme || `Day ${day.dayNumber}`,
        activities: (day.activities || []).map((act: any, idx: number) => ({
          ...act,
          time: act.time || (idx === 0 ? "Morning" : idx === 1 ? "Afternoon" : "Evening")
        }))
      }));

      const responsePayload = {
        ...geminiData,
        days: postProcessedDays,
        requestedDays,
        generatedDays,
        note: longTripNote,
      };
      
      // Store in Redis (cache for 48 hours)
      await setCached(cacheKey, responsePayload, 172800);
      
      return NextResponse.json(responsePayload);
    }

    // Fallback Mock
    const mockItinerary: any = { days: [], requestedDays, generatedDays, note: longTripNote };
    
    // Rich Local Database for Popular Destinations
    const POPULAR_FALLBACKS: Record<string, { theme: string; activities: { name: string; description: string; time: string }[] }[]> = {
      jaipur: [
        {
          theme: "Historical Wonders & Forts",
          activities: [
            { name: "Amer Fort", description: "Explore the breathtaking 16th-century hilltop palace, famous for its artistic Hindu-style elements and the shimmering Sheesh Mahal (Mirror Palace).", time: "Morning" },
            { name: "Hawa Mahal", description: "Photograph the iconic honeycombed pink sandstone palace of winds, built with 953 small casements so royal ladies could observe everyday street life.", time: "Afternoon" },
            { name: "City Palace", description: "Walk through the royal residency courtyard, sprawling gardens, and state museum displaying royal garments and artifacts.", time: "Evening" }
          ]
        },
        {
          theme: "Observatories & Local Culture",
          activities: [
            { name: "Jantar Mantar", description: "Visit the UNESCO World Heritage site hosting the world's largest stone sundial and intricate astronomical instruments.", time: "Morning" },
            { name: "Albert Hall Museum", description: "Admire the rich collections of industrial arts, pottery, sculptures, and an Egyptian mummy in Jaipur's oldest state museum.", time: "Afternoon" },
            { name: "Chokhi Dhani Dinner", description: "Immerse in Rajasthani culture with a traditional thali feast, folk dances, puppet shows, and village camel rides.", time: "Evening" }
          ]
        },
        {
          theme: "Royal Tombs & Sunsets",
          activities: [
            { name: "Jal Mahal", description: "Marvel at the spectacular floating water palace situated in the center of the peaceful Man Sagar Lake.", time: "Morning" },
            { name: "Nahargarh Fort", description: "Stand on the edge of the Aravalli hills for a panoramic golden hour sunset and bird's-eye view of the Pink City.", time: "Afternoon" },
            { name: "Bapu Bazaar", description: "Shop for traditional Rajasthani mojris, textiles, bandhani fabrics, and handcrafted brass items in the vibrant market.", time: "Evening" }
          ]
        }
      ],
      tokyo: [
        {
          theme: "Ancient Temples & Neon Crossings",
          activities: [
            { name: "Senso-ji Temple", description: "Explore Tokyo's oldest and most iconic Buddhist temple in Asakusa, walking through the massive Kaminarimon Gate.", time: "Morning" },
            { name: "Shibuya Crossing", description: "Experience the world's busiest pedestrian crossing, surrounded by massive neon screens and towering skyscrapers.", time: "Afternoon" },
            { name: "Meiji Jingu Shrine", description: "Walk through the serene forested paths of this grand Shinto shrine dedicated to Emperor Meiji and Empress Shoken.", time: "Evening" }
          ]
        },
        {
          theme: "Tech Hubs & Skyline Views",
          activities: [
            { name: "Tokyo Skytree", description: "Ascend Japan's tallest structure for breathtaking 360-degree views of the sprawling Tokyo metropolis.", time: "Morning" },
            { name: "Akihabara Electric Town", description: "Immerse yourself in Japan's anime, gaming, and electronics culture, exploring multi-level specialty shops.", time: "Afternoon" },
            { name: "Tsukiji Outer Market", description: "Taste fresh Japanese street food delicacies like tamagoyaki, fresh uni, and grilled wagyu skewers.", time: "Evening" }
          ]
        },
        {
          theme: "Digital Art & Modern Parks",
          activities: [
            { name: "teamLab Planets TOKYO", description: "Step barefoot into a world-famous immersive digital art museum of giant floating orchids and light water crystal rooms.", time: "Morning" },
            { name: "Odaiba Marine Park", description: "Enjoy sunset views of the Rainbow Bridge and the scale-replica Statue of Liberty along the Tokyo Bay waterfront.", time: "Afternoon" },
            { name: "Shinjuku Gyoen National Garden", description: "Relax in one of Tokyo's largest parks, featuring traditional Japanese, English landscape, and French formal gardens.", time: "Evening" }
          ]
        }
      ],
      goa: [
        {
          theme: "Old Goa Heritage & Beaches",
          activities: [
            { name: "Basilica of Bom Jesus", description: "Visit the UNESCO World Heritage church housing the sacred relics of St. Francis Xavier, an architectural masterpiece of Baroque design.", time: "Morning" },
            { name: "Calangute Beach", description: "Stroll along the golden sand shoreline, enjoying popular beach shacks and energetic water sports.", time: "Afternoon" },
            { name: "Fort Aguada", description: "Explore the historic 17th-century Portuguese fortress and its towering lighthouse overlooking the Arabian Sea.", time: "Evening" }
          ]
        },
        {
          theme: "Latin Quarters & Spice Walks",
          activities: [
            { name: "Fontainhas Latin Quarter", description: "Walk through Panaji's historic Portuguese neighborhood, filled with bright yellow and blue houses with terracotta roofs.", time: "Morning" },
            { name: "Sahakari Spice Farm", description: "Go on a guided walk of exotic spice plants, enjoying a traditional Goan buffet served on banana leaves.", time: "Afternoon" },
            { name: "Baga Beach Sunset", description: "Relax on the beach beds, watching the scenic sunset followed by vibrant beachside music and dining.", time: "Evening" }
          ]
        },
        {
          theme: "Waterfalls & Night Markets",
          activities: [
            { name: "Dudhsagar Waterfalls", description: "Marvel at the spectacular four-tiered waterfall rushing down the steep Western Ghats mountains.", time: "Morning" },
            { name: "Anjuna Flea Market", description: "Hunt for bohemian clothes, souvenirs, spices, and handmade crafts in Goa's most legendary weekly market.", time: "Afternoon" },
            { name: "Dona Paula Viewpoint", description: "Take in the panoramic views of the Mormugao harbor and the Zuari and Mandovi rivers merging into the sea.", time: "Evening" }
          ]
        }
      ],
      manali: [
        {
          theme: "Temples & Valleys",
          activities: [
            { name: "Hadimba Temple", description: "Visit the historic wooden pagoda-style temple nestled amidst dense cedar forests, dedicated to Goddess Hadimba.", time: "Morning" },
            { name: "Solang Valley", description: "Indulge in adventure activities like paragliding, zorbing, and quad biking in the scenic Solang Valley.", time: "Afternoon" },
            { name: "Jogini Waterfalls", description: "Trek through orchards and pine forests to reach the scenic cascading Jogini falls.", time: "Evening" }
          ]
        },
        {
          theme: "Old Manali & Hot Springs",
          activities: [
            { name: "Vashisht Hot Springs", description: "Bathe in the natural sulfur hot water springs, believed to have healing medicinal properties.", time: "Morning" },
            { name: "Old Manali Cafes", description: "Stroll through the old village streets, exploring unique bakeries, art cafes, and wooden houses.", time: "Afternoon" },
            { name: "Mall Road Shopping", description: "Browse traditional Kullu shawls, wooden handicrafts, and local spices on Manali's bustling main street.", time: "Evening" }
          ]
        },
        {
          theme: "High Altitude Wonders",
          activities: [
            { name: "Rohtang Pass", description: "Witness spectacular glacier viewpoints and snow fields at an altitude of 13,058 feet (subject to permit).", time: "Morning" },
            { name: "Nehru Kund", description: "Stop by the natural cold water spring flowing from the Brighu lake, named after India's first Prime Minister.", time: "Afternoon" },
            { name: "Manu Temple", description: "Walk up to the historic pagoda-style temple dedicated to Sage Manu in Old Manali.", time: "Evening" }
          ]
        }
      ],
      delhi: [
        {
          theme: "Mughal Heritage & War Memorials",
          activities: [
            { name: "Red Fort", description: "Explore the massive red sandstone fortress complex built by Mughal Emperor Shah Jahan.", time: "Morning" },
            { name: "Chandni Chowk Market", description: "Take a rickshaw ride through the narrow lanes of Delhi's oldest market, trying paranthas and jalebis.", time: "Afternoon" },
            { name: "India Gate", description: "Pay respects at the national war memorial, enjoying evening walks around the lawns and fountains.", time: "Evening" }
          ]
        },
        {
          theme: "Garden Tombs & Temples",
          activities: [
            { name: "Humayun's Tomb", description: "Walk through the stunning garden tomb that inspired the Taj Mahal, built with red sandstone and white marble.", time: "Morning" },
            { name: "Lotus Temple", description: "Meditate in the beautiful lotus-shaped Bahá'í House of Worship, open to all religions.", time: "Afternoon" },
            { name: "Lodhi Gardens", description: "Stroll through the historical green park containing tombs of the Lodhi and Sayyid dynasties.", time: "Evening" }
          ]
        },
        {
          theme: "Ancient Minarets & Shopping",
          activities: [
            { name: "Qutub Minar", description: "Admire the 73-meter tall historic brick minaret, built in 1193, surrounded by ancient ruins.", time: "Morning" },
            { name: "Connaught Place", description: "Shop and dine in the classic Georgian-style circular columns architecture district.", time: "Afternoon" },
            { name: "Akshardham Temple", description: "Marvel at the spectacular carved stone temple complex, water show, and exhibits.", time: "Evening" }
          ]
        }
      ],
      mumbai: [
        {
          theme: "Colonial Gateways & Promenades",
          activities: [
            { name: "Gateway of India", description: "Admire the basalt arch monument overlooking the Arabian Sea, built to commemorate the visit of King George V.", time: "Morning" },
            { name: "Colaba Causeway", description: "Shop for handicrafts, jewelry, and clothes, followed by lunch at the iconic Leopold Cafe.", time: "Afternoon" },
            { name: "Marine Drive Queen's Necklace", description: "Stroll along the C-shaped seaside promenade, watching the sunset and the sparkling city lights.", time: "Evening" }
          ]
        },
        {
          theme: "Island Temples & Gothic Stations",
          activities: [
            { name: "Elephanta Caves", description: "Take a ferry to the island to explore the 5th-century rock-cut Shiva temple cave carvings.", time: "Morning" },
            { name: "Chhatrapati Shivaji Terminus (CSMT)", description: "Photograph the UNESCO heritage Victorian Gothic railway station blending Indian palace themes.", time: "Afternoon" },
            { name: "Haji Ali Dargah", description: "Walk along the narrow causeway into the sea to visit the floating mosque and tomb.", time: "Evening" }
          ]
        },
        {
          theme: "Bridges & Beaches",
          activities: [
            { name: "Bandra-Worli Sea Link", description: "Take a cab ride over the architectural cable-stayed bridge spanning the sea.", time: "Morning" },
            { name: "Crawford Market", description: "Explore the bustling historic indoor wholesale fruit, vegetable, and pet market.", time: "Afternoon" },
            { name: "Juhu Beach Chowpatty", description: "Try the iconic Mumbai street foods like Pav Bhaji, Bhel Puri, and Vada Pav along the beach.", time: "Evening" }
          ]
        }
      ],
      gwalior: [
        {
          theme: "Hilltop Fortresses & Carvings",
          activities: [
            { name: "Gwalior Fort", description: "Explore the towering 8th-century fortress situated on a steep sandstone hill, termed the 'Gibraltar of India'.", time: "Morning" },
            { name: "Man Singh Palace", description: "Admire the brilliant blue tiled carvings, royal court chambers, and historic underground dungeons.", time: "Afternoon" },
            { name: "Sas Bahu Temples", description: "Marvel at the intricately carved 11th-century twin temples dedicated to Lord Vishnu.", time: "Evening" }
          ]
        },
        {
          theme: "Palace Museums & Music Tombs",
          activities: [
            { name: "Jai Vilas Palace", description: "Visit the grand Italianate palace featuring the world's largest chandeliers and a silver model train dining table.", time: "Morning" },
            { name: "Tomb of Tansen", description: "Visit the memorial of the legendary musician Tansen, paying respects at the sacred tamarind tree.", time: "Afternoon" },
            { name: "Teli Ka Mandir", description: "Witness the tallest structure in the fort, blending Dravidian temple styling with north Indian carvings.", time: "Evening" }
          ]
        },
        {
          theme: "Jain Monoliths & Temples",
          activities: [
            { name: "Gopachal Parvat Rock Statues", description: "Admire the colossal rock-cut Jain Tirthankara monuments carved along the fort walls.", time: "Morning" },
            { name: "Sun Temple Gwalior", description: "Visit the beautiful red sandstone temple modeled after the Konark Sun Temple, surrounded by gardens.", time: "Afternoon" },
            { name: "Maharaj Bada Square", description: "Explore the central market square displaying palace structures of Roman, Gothic, and Mughal styles.", time: "Evening" }
          ]
        }
      ],
      europe: [
        {
          theme: "Monuments & Art",
          activities: [
            { name: "Louvre Museum (Paris)", description: "Admire the glass pyramid entrance and iconic artworks like the Mona Lisa and Venus de Milo.", time: "Morning" },
            { name: "Eiffel Tower climb", description: "Take the elevators to the top deck of the iron lady for panoramic views across Paris.", time: "Afternoon" },
            { name: "Seine River Cruise", description: "Float past the Notre-Dame Cathedral and historical bridges under the evening lights.", time: "Evening" }
          ]
        },
        {
          theme: "Canals & Historic Squares",
          activities: [
            { name: "Colosseum Tour (Rome)", description: "Step inside the historic Roman amphitheater where gladiators competed for glory.", time: "Morning" },
            { name: "Gondola Ride (Venice)", description: "Navigate the picturesque canals of Venice past gothic architectural palazzos.", time: "Afternoon" },
            { name: "Prague Old Town Square", description: "Watch the ancient Astronomical Clock strike the hour, enjoying trdelnik pastries.", time: "Evening" }
          ]
        },
        {
          theme: "Modern Masterpieces",
          activities: [
            { name: "Sagrada Familia (Barcelona)", description: "Marvel at the soaring towers and colorful stained-glass forest interior of Gaudi's masterpiece.", time: "Morning" },
            { name: "Amsterdam Canal cruise", description: "Explore the historic belt of canals and houseboats in the Dutch capital.", time: "Afternoon" },
            { name: "Acropolis of Athens", description: "Hike up the rocky outcrop to explore the ancient Parthenon temple ruins overlooking Greece.", time: "Evening" }
          ]
        }
      ]
    };

    const targetCityLower = destination.toLowerCase().trim();
    const isPopular = POPULAR_FALLBACKS[targetCityLower];

    for (let d = 1; d <= generatedDays; d++) {
      if (isPopular) {
        // Retrieve popular day plan, loop if requested days exceeds database size
        const fallbackDay = POPULAR_FALLBACKS[targetCityLower][(d - 1) % POPULAR_FALLBACKS[targetCityLower].length];
        mockItinerary.days.push({
          dayNumber: d,
          theme: fallbackDay.theme,
          activities: fallbackDay.activities
        });
      } else {
        // Generate realistic city-specific activities dynamically
        const genericThemes = [
          "Historical Landmarks & Heritage",
          "Local Markets & Cultural Sites",
          "Scenic Viewpoints & Nature Walks",
          "Art, Design & Architecture",
          "Gastronomy & Culinary Walk",
          "Sacred Temples & Quiet Spaces",
          "Hidden Neighborhoods & Leisure"
        ];
        
        const templates = [
          [
            { name: `${destination} Palace & Royal Museum`, description: `Step inside the historic palace gates of ${destination} to explore royal galleries, artifacts, and beautifully preserved architecture.` },
            { name: `${destination} Old Town Market`, description: `Weave through the lively local lanes, historic street vendors, and traditional craft shops in the heart of ${destination}.` },
            { name: `${destination} Heritage Gate`, description: `Visit the central monument landmark and gateway, learning about the historic foundation and colonial-era events of ${destination}.` }
          ],
          [
            { name: `${destination} Central Museum of Art`, description: `Admire centuries of regional painting collections, ancient pottery, and archaeological finds from the local ${destination} region.` },
            { name: `${destination} Botanical Gardens`, description: `Escape the bustle for a quiet morning walk through exotic local flora, greenhouses, and calm ponds in ${destination}.` },
            { name: `${destination} Panoramic Viewpoint`, description: `Climb to the highest hill or observation deck to enjoy a breathtaking 360-degree sunset view across the skyline of ${destination}.` }
          ],
          [
            { name: `${destination} Historic Fort Ruins`, description: `Walk along the ancient stone battlements and towers that protected ${destination} for centuries, offering scenic valley views.` },
            { name: `${destination} Street Food Lane`, description: `Savor the authentic local culinary specialties, traditional desserts, and famous street treats of ${destination}.` },
            { name: `${destination} Sacred Temple Complex`, description: `Experience the peaceful spiritual rituals, quiet carvings, and calming incense at ${destination}'s most revered religious shrine.` }
          ]
        ];

        const idx = (d - 1) % templates.length;
        mockItinerary.days.push({
          dayNumber: d,
          theme: genericThemes[(d - 1) % genericThemes.length],
          activities: templates[idx].map((act, i) => ({
            ...act,
            time: i === 0 ? "Morning" : i === 1 ? "Afternoon" : "Evening"
          }))
        });
      }
    }

    // Cache the fallback too to prevent repeated failures
    await setCached(cacheKey, mockItinerary, 172800);

    return NextResponse.json(mockItinerary);
  } catch (error: any) {
    console.error("Itinerary generation error:", error);
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 });
  }
}
