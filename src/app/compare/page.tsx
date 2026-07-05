"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, Compass, Sparkles, CloudSun, Plane, Coins, Calendar, MapPin, CheckCircle 
} from "lucide-react";
import { getSavedTrips, Trip } from "@/lib/store";
import ImageWithFallback from "@/components/ImageWithFallback";
import { motion } from "framer-motion";

interface CompareData {
  destination: string;
  budgetLimit: number | null;
  totalExpenses: number | null;
  days: number | null;
  avgTempMax: number | null;
  avgPrecipChance: number | null;
  weatherDesc: string;
  flightPrice: number | null;
  flightDuration: number | null;
}

function CompareDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTripId = searchParams?.get("a") || "";

  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  
  // Slot selection states
  const [slotA, setSlotA] = useState<{ destination: string; tripId?: string } | null>(null);
  const [slotB, setSlotB] = useState<{ destination: string; tripId?: string } | null>(null);
  
  // Custom text input states
  const [customCityA, setCustomCityA] = useState("");
  const [customCityB, setCustomCityB] = useState("");
  
  // Shared params for comparison
  const [originCity, setOriginCity] = useState("Mumbai");
  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 14); // 2 weeks out by default
    return today.toISOString().split("T")[0];
  });

  // Fetched comparison results
  const [dataA, setDataA] = useState<CompareData | null>(null);
  const [dataB, setDataB] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved trips
  useEffect(() => {
    const trips = getSavedTrips();
    setSavedTrips(trips);

    // If 'a' tripId is in search params, pre-fill Slot A
    if (initialTripId) {
      const matched = trips.find(t => t.id === initialTripId);
      if (matched) {
        setSlotA({ destination: matched.destination, tripId: matched.id });
        if (matched.originCity) setOriginCity(matched.originCity);
        if (matched.startDate) setTravelDate(matched.startDate);
      }
    }
  }, [initialTripId]);

  const handleSelectTrip = (slot: "A" | "B", tripId: string) => {
    if (tripId === "custom") {
      if (slot === "A") {
        setSlotA({ destination: customCityA || "Destination A" });
      } else {
        setSlotB({ destination: customCityB || "Destination B" });
      }
      return;
    }

    const trip = savedTrips.find(t => t.id === tripId);
    if (!trip) return;

    const payload = { destination: trip.destination, tripId: trip.id };
    if (slot === "A") {
      setSlotA(payload);
    } else {
      setSlotB(payload);
    }
  };

  const fetchDestinationData = async (destination: string, isSlotA: boolean, matchedTrip?: Trip) => {
    // 1. Fetch Weather
    let avgTempMax = null;
    let avgPrecipChance = null;
    let weatherDesc = "No forecast data";

    try {
      const weatherRes = await fetch(`/api/weather?destination=${encodeURIComponent(destination)}&date=${travelDate}`);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const daily = weatherData.forecast?.daily;
        if (daily) {
          const temps = daily.temperature_2m_max || [];
          const precipProb = daily.precipitation_probability_max || [];
          
          if (temps.length > 0) {
            avgTempMax = Math.round(temps.slice(0, 7).reduce((a: number, b: number) => a + b, 0) / Math.min(7, temps.length));
          }
          if (precipProb.length > 0) {
            avgPrecipChance = Math.round(precipProb.slice(0, 7).reduce((a: number, b: number) => a + b, 0) / Math.min(7, precipProb.length));
          }

          // Simple weather categorizer
          if (avgPrecipChance !== null && avgPrecipChance > 40) {
            weatherDesc = "Showery / Rainy 🌧️";
          } else if (avgTempMax !== null && avgTempMax > 28) {
            weatherDesc = "Warm & Sunny ☀️";
          } else if (avgTempMax !== null && avgTempMax < 15) {
            weatherDesc = "Chilly / Cold ❄️";
          } else {
            weatherDesc = "Pleasant / Mild ⛅";
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch weather for ${destination}:`, err);
    }

    // 2. Fetch Flights
    let flightPrice = null;
    let flightDuration = null;

    try {
      const flightRes = await fetch(`/api/travel/flights?departure_id=${encodeURIComponent(originCity)}&arrival_id=${encodeURIComponent(destination)}&outbound_date=${travelDate}`);
      if (flightRes.ok) {
        const flightData = await flightRes.json();
        const best = flightData.best_flights?.[0];
        if (best) {
          flightPrice = best.price;
          flightDuration = best.total_duration; // in minutes
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch flights for ${destination}:`, err);
    }

    // 3. Compile CompareData
    const result: CompareData = {
      destination,
      budgetLimit: matchedTrip ? matchedTrip.budgetLimit : null,
      totalExpenses: matchedTrip ? matchedTrip.expenses.reduce((sum: number, e: any) => sum + e.amount, 0) : null,
      days: matchedTrip ? matchedTrip.days : null,
      avgTempMax,
      avgPrecipChance,
      weatherDesc,
      flightPrice,
      flightDuration
    };

    if (isSlotA) {
      setDataA(result);
    } else {
      setDataB(result);
    }
  };

  const handleCompare = async () => {
    const destA = slotA?.tripId ? slotA.destination : customCityA;
    const destB = slotB?.tripId ? slotB.destination : customCityB;

    if (!destA || !destB) {
      setError("Please select or input destinations in both slots to compare.");
      return;
    }

    setError(null);
    setLoading(true);
    setDataA(null);
    setDataB(null);

    try {
      const tripA = savedTrips.find(t => t.id === slotA?.tripId);
      const tripB = savedTrips.find(t => t.id === slotB?.tripId);

      await Promise.all([
        fetchDestinationData(destA, true, tripA),
        fetchDestinationData(destB, false, tripB)
      ]);
    } catch (err) {
      setError("An error occurred during comparison checks. Please check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Winner decider logic helpers
  const getWinner = (metric: keyof CompareData, preferLower = true) => {
    if (!dataA || !dataB) return null;
    const valA = dataA[metric];
    const valB = dataB[metric];

    if (valA === null || valB === null) return null;
    if (valA === valB) return "tie";

    if (preferLower) {
      return (valA as number) < (valB as number) ? "A" : "B";
    } else {
      return (valA as number) > (valB as number) ? "A" : "B";
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto px-4 py-8 md:py-16 text-gray-800 bg-[#FAF8F5] min-h-screen">
      
      {/* HEADER BAR */}
      <div className="flex items-center gap-4 mb-8 text-left">
        <button
          onClick={() => router.push("/")}
          className="p-2.5 rounded-xl border border-gray-250 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-colors shadow-xs focus:outline-none"
          title="Back to Home"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Decision Copilot
          </span>
          <h1 className="text-2xl md:text-3.5xl font-black font-display text-gray-900 mt-1">
            Compare Destinations Side-by-Side
          </h1>
        </div>
      </div>

      {/* INPUT FORM MATRIX */}
      <div className="p-6 rounded-3xl border border-gray-200/60 bg-white shadow-soft text-left mb-8 space-y-6">
        
        {/* Slotted Selector Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SLOT A SELECTOR */}
          <div className="space-y-3">
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Slot A Destination</label>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setSlotA({ destination: customCityA || "Destination A" });
                } else {
                  handleSelectTrip("A", val);
                }
              }}
              defaultValue={initialTripId || "custom"}
              className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs cursor-pointer focus:outline-none"
            >
              <option value="custom">✏️ Custom City Input (Type below)</option>
              {savedTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  📂 {t.destination} ({t.days} Days Itinerary)
                </option>
              ))}
            </select>

            {(!slotA?.tripId) && (
              <input
                type="text"
                value={customCityA}
                onChange={(e) => {
                  setCustomCityA(e.target.value);
                  setSlotA({ destination: e.target.value });
                }}
                placeholder="Type City Name (e.g. Tokyo)..."
                className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
              />
            )}
          </div>

          {/* SLOT B SELECTOR */}
          <div className="space-y-3">
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Slot B Destination</label>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setSlotB({ destination: customCityB || "Destination B" });
                } else {
                  handleSelectTrip("B", val);
                }
              }}
              className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs cursor-pointer focus:outline-none"
            >
              <option value="custom">✏️ Custom City Input (Type below)</option>
              {savedTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  📂 {t.destination} ({t.days} Days Itinerary)
                </option>
              ))}
            </select>

            {(!slotB?.tripId) && (
              <input
                type="text"
                value={customCityB}
                onChange={(e) => {
                  setCustomCityB(e.target.value);
                  setSlotB({ destination: e.target.value });
                }}
                placeholder="Type City Name (e.g. Bali)..."
                className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
              />
            )}
          </div>

        </div>

        {/* Origin / Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 items-end">
          <div>
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1">Departure Origin</label>
            <input
              type="text"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="e.g. Mumbai"
              className="w-full glass-input px-3.5 py-2 rounded-xl text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1">Travel Date</label>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full glass-input px-3.5 py-2 rounded-xl text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={loading}
            className="py-2.5 rounded-xl bg-teal-650 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span>{loading ? "Running Analytics..." : "Run Comparison"}</span>
          </button>
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-500 mt-2">{error}</p>
        )}
      </div>

      {/* SIDE-BY-SIDE RESULT VIEW */}
      {loading && (
        <div className="py-20 text-center rounded-3xl border border-dashed border-gray-200 bg-white/70 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Retrieving real-time flight deals & open-meteo forecast grids...</p>
        </div>
      )}

      {(!loading && !dataA && !dataB) && (
        <div className="py-20 text-center rounded-3xl border border-dashed border-gray-200 bg-white/70 shadow-sm flex flex-col items-center justify-center gap-2 max-w-xl mx-auto">
          <Compass className="w-10 h-10 text-gray-300 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800">No destinations compared yet</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select your workspace files or enter custom cities above to run comparisons.</p>
        </div>
      )}

      {(!loading && (dataA || dataB)) && (
        <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-stretch">
          
          {/* COLUMN A SLOT */}
          <div className="md:col-span-5 bg-white border border-gray-250/60 p-6 rounded-3xl shadow-card-ds text-left flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-teal-750 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/15">Slot A Pick</span>
                <span className="text-[9px] text-gray-400 font-bold">{slotA?.tripId ? "📂 Saved Workspace" : "✏️ Custom Input"}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-950 font-display">{dataA?.destination}</h2>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">from {originCity} • on {travelDate}</p>

              {/* Rows */}
              <div className="mt-8 space-y-6">
                
                {/* Weather */}
                <div className={`p-4 rounded-2xl border transition-all ${getWinner("avgTempMax", false) === "A" ? "border-teal-500/30 bg-teal-500/5" : "border-gray-150 bg-gray-50/50"}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <CloudSun className="w-3.5 h-3.5 text-orange-500" />
                    7-Day Weather forecast
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1 flex items-center justify-between">
                    <span>{dataA?.avgTempMax !== null ? `${dataA?.avgTempMax}°C Avg High` : "—"}</span>
                    {getWinner("avgTempMax", false) === "A" && <CheckCircle className="w-4 h-4 text-teal-650" />}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    {dataA?.weatherDesc} • Rain: {dataA?.avgPrecipChance !== null ? `${dataA?.avgPrecipChance}%` : "—"}
                  </p>
                </div>

                {/* Flights */}
                <div className={`p-4 rounded-2xl border transition-all ${getWinner("flightPrice", true) === "A" ? "border-teal-500/30 bg-teal-500/5" : "border-gray-150 bg-gray-50/50"}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-blue-500" />
                    cheapest flight deal
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1 flex items-center justify-between">
                    <span>{dataA?.flightPrice !== null ? `₹${dataA?.flightPrice.toLocaleString("en-IN")}` : "—"}</span>
                    {getWinner("flightPrice", true) === "A" && <CheckCircle className="w-4 h-4 text-teal-650" />}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    Duration: {formatDuration(dataA?.flightDuration ?? null)}
                  </p>
                </div>

                {/* Budget */}
                <div className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    Budget & Spent
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1">
                    {dataA?.budgetLimit !== null ? `₹${dataA?.budgetLimit.toLocaleString("en-IN")}` : "—"}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    Expenses: {dataA?.totalExpenses !== null ? `₹${dataA?.totalExpenses.toLocaleString("en-IN")}` : "—"} • Duration: {dataA?.days !== null ? `${dataA?.days} days` : "—"}
                  </p>
                </div>

              </div>
            </div>
            
            {slotA?.tripId && (
              <button
                onClick={() => router.push(`/planner/${slotA.tripId}`)}
                className="w-full mt-6 py-2 rounded-xl bg-gray-950 text-white font-bold text-xs shadow-md hover:bg-gray-800 transition-colors cursor-pointer text-center"
              >
                Open Workspace File
              </button>
            )}
          </div>

          {/* VS DIVISION GRIDCELL */}
          <div className="md:col-span-1 flex items-center justify-center min-h-[40px] md:min-h-full">
            <span className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200/60 shadow flex items-center justify-center font-black text-xs text-indigo-700 tracking-tighter">
              VS
            </span>
          </div>

          {/* COLUMN B SLOT */}
          <div className="md:col-span-5 bg-white border border-gray-250/60 p-6 rounded-3xl shadow-card-ds text-left flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-teal-750 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/15">Slot B Pick</span>
                <span className="text-[9px] text-gray-400 font-bold">{slotB?.tripId ? "📂 Saved Workspace" : "✏️ Custom Input"}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-950 font-display">{dataB?.destination}</h2>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">from {originCity} • on {travelDate}</p>

              {/* Rows */}
              <div className="mt-8 space-y-6">
                
                {/* Weather */}
                <div className={`p-4 rounded-2xl border transition-all ${getWinner("avgTempMax", false) === "B" ? "border-teal-500/30 bg-teal-500/5" : "border-gray-150 bg-gray-50/50"}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <CloudSun className="w-3.5 h-3.5 text-orange-500" />
                    7-Day Weather forecast
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1 flex items-center justify-between">
                    <span>{dataB?.avgTempMax !== null ? `${dataB?.avgTempMax}°C Avg High` : "—"}</span>
                    {getWinner("avgTempMax", false) === "B" && <CheckCircle className="w-4 h-4 text-teal-650" />}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    {dataB?.weatherDesc} • Rain: {dataB?.avgPrecipChance !== null ? `${dataB?.avgPrecipChance}%` : "—"}
                  </p>
                </div>

                {/* Flights */}
                <div className={`p-4 rounded-2xl border transition-all ${getWinner("flightPrice", true) === "B" ? "border-teal-500/30 bg-teal-500/5" : "border-gray-150 bg-gray-50/50"}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-blue-500" />
                    cheapest flight deal
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1 flex items-center justify-between">
                    <span>{dataB?.flightPrice !== null ? `₹${dataB?.flightPrice.toLocaleString("en-IN")}` : "—"}</span>
                    {getWinner("flightPrice", true) === "B" && <CheckCircle className="w-4 h-4 text-teal-650" />}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    Duration: {formatDuration(dataB?.flightDuration ?? null)}
                  </p>
                </div>

                {/* Budget */}
                <div className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    Budget & Spent
                  </span>
                  <div className="text-base font-extrabold text-gray-900 mt-1">
                    {dataB?.budgetLimit !== null ? `₹${dataB?.budgetLimit.toLocaleString("en-IN")}` : "—"}
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    Expenses: {dataB?.totalExpenses !== null ? `₹${dataB?.totalExpenses.toLocaleString("en-IN")}` : "—"} • Duration: {dataB?.days !== null ? `${dataB?.days} days` : "—"}
                  </p>
                </div>

              </div>
            </div>
            
            {slotB?.tripId && (
              <button
                onClick={() => router.push(`/planner/${slotB.tripId}`)}
                className="w-full mt-6 py-2 rounded-xl bg-gray-950 text-white font-bold text-xs shadow-md hover:bg-gray-800 transition-colors cursor-pointer text-center"
              >
                Open Workspace File
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

export default function ComparePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-550">Loading comparison dashboard...</div>}>
      <CompareDashboard />
    </React.Suspense>
  );
}
