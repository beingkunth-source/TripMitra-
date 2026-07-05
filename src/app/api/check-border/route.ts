import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

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

    // Fallback: smart heuristic checking country overlap
    const CITY_TO_COUNTRY: Record<string, string> = {
      mumbai: 'India', bombay: 'India', delhi: 'India', 'new delhi': 'India',
      bangalore: 'India', bengaluru: 'India', chennai: 'India', madras: 'India',
      kolkata: 'India', calcutta: 'India', hyderabad: 'India', ahmedabad: 'India',
      pune: 'India', jaipur: 'India', goa: 'India', kochi: 'India', cochin: 'India',
      lucknow: 'India', guwahati: 'India', indore: 'India', chandigarh: 'India',
      nagpur: 'India', thiruvananthapuram: 'India', trivandrum: 'India',
      bhubaneswar: 'India', agra: 'India', varanasi: 'India', amritsar: 'India',
      surat: 'India', vizag: 'India', visakhapatnam: 'India', srinagar: 'India',
      mangalore: 'India', mangaluru: 'India', patna: 'India', ranchi: 'India',
      dehradun: 'India', hennur: 'India', manali: 'India', rishikesh: 'India',
      udaipur: 'India', pondicherry: 'India', darjeeling: 'India', shimla: 'India',
      mysore: 'India', coimbatore: 'India', madurai: 'India', alleppey: 'India',
      munnar: 'India', ooty: 'India', coorg: 'India', jaisalmer: 'India',
      jodhpur: 'India', pushkar: 'India', ajmer: 'India', khajuraho: 'India',
      gokarna: 'India', hampi: 'India', badami: 'India', shillong: 'India',
      gangtok: 'India', pahalgam: 'India', gulmarg: 'India', leh: 'India',
      spiti: 'India', dharamshala: 'India', haridwar: 'India', 'bodh gaya': 'India',
      mathura: 'India', vrindavan: 'India', ayodhya: 'India', chittorgarh: 'India',
      ranthambore: 'India', kanha: 'India', bandhavgarh: 'India', kaziranga: 'India',
      
      dubai: 'UAE', 'abu dhabi': 'UAE', sharjah: 'UAE',
      doha: 'Qatar',
      london: 'United Kingdom', uk: 'United Kingdom',
      paris: 'France', lyon: 'France', marseille: 'France', nice: 'France',
      'new york': 'USA', 'los angeles': 'USA', 'san francisco': 'USA', chicago: 'USA',
      bangkok: 'Thailand', phuket: 'Thailand',
      singapore: 'Singapore',
      'kuala lumpur': 'Malaysia',
      colombo: 'Sri Lanka',
      kathmandu: 'Nepal',
      maldives: 'Maldives', male: 'Maldives',
      tokyo: 'Japan', kyoto: 'Japan', osaka: 'Japan',
      sydney: 'Australia', melbourne: 'Australia',
      rome: 'Italy', venice: 'Italy', florence: 'Italy', milan: 'Italy',
      bali: 'Indonesia', jakarta: 'Indonesia',
      'hong kong': 'China', shanghai: 'China', beijing: 'China',
      istanbul: 'Turkey', ankara: 'Turkey',
      toronto: 'Canada', vancouver: 'Canada', montreal: 'Canada',
      dubrovnik: 'Croatia', split: 'Croatia',
      prague: 'Czech Republic',
      vienna: 'Austria',
      zurich: 'Switzerland', geneva: 'Switzerland',
      amsterdam: 'Netherlands',
      berlin: 'Germany', munich: 'Germany', frankfurt: 'Germany',
      lisbon: 'Portugal', porto: 'Portugal',
      madrid: 'Spain', barcelona: 'Spain', seville: 'Spain',
      athens: 'Greece', santorini: 'Greece',
      cairo: 'Egypt',
      'cape town': 'South Africa',
      nairobi: 'Kenya',
      seoul: 'South Korea',
      taipei: 'Taiwan',
      manila: 'Philippines',
      'ho chi minh': 'Vietnam', hanoi: 'Vietnam',
      yangon: 'Myanmar',
      dhaka: 'Bangladesh',
      islamabad: 'Pakistan', karachi: 'Pakistan', lahore: 'Pakistan',
      muscat: 'Oman',
      riyadh: 'Saudi Arabia', jeddah: 'Saudi Arabia', dammam: 'Saudi Arabia',
      kuwait: 'Kuwait',
      manama: 'Bahrain'
    };

    const resolveCountry = (place: string): string | null => {
      const normalized = place.trim().toLowerCase();
      if (normalized.includes(',')) {
        const parts = normalized.split(',');
        const countryPart = parts[parts.length - 1].trim();
        if (countryPart) {
          return countryPart.replace(/\b\w/g, c => c.toUpperCase());
        }
      }
      if (CITY_TO_COUNTRY[normalized]) {
        return CITY_TO_COUNTRY[normalized];
      }
      for (const city of Object.keys(CITY_TO_COUNTRY)) {
        if (normalized.includes(city)) {
          return CITY_TO_COUNTRY[city];
        }
      }
      return null;
    };

    const originCountry = resolveCountry(origin);
    const destCountry = resolveCountry(destination);

    let isInternational = false;
    if (originCountry && destCountry) {
      isInternational = originCountry.toLowerCase() !== destCountry.toLowerCase();
    } else {
      const originLower = origin.toLowerCase().trim();
      const destLower = destination.toLowerCase().trim();
      if (originLower !== destLower && !originLower.includes(destLower) && !destLower.includes(originLower)) {
        const indianCities = Object.keys(CITY_TO_COUNTRY).filter(k => CITY_TO_COUNTRY[k] === 'India');
        const originIsIndian = originCountry === 'India' || indianCities.some(c => originLower.includes(c));
        const destIsIndian = destCountry === 'India' || indianCities.some(c => destLower.includes(c));

        if (originIsIndian !== destIsIndian) {
          isInternational = true;
        } else if (!originIsIndian && !destIsIndian) {
          // Both are non-Indian, check if they type different recognizable country keywords (e.g. "Paris" vs "New York")
          // If we resolved one country but not the other, or they are just completely different strings and not indian
          isInternational = true; 
        }
      }
    }

    return NextResponse.json({ isInternational });
  } catch (error: any) {
    console.error("Border check error:", error);
    return NextResponse.json({ isInternational: false });
  }
}
