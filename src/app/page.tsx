"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Mic, MicOff, History, Trash2, Calendar, Users, 
  Globe, Star, Compass, ArrowRight, Sparkles, Navigation, 
  CloudSun, Landmark, Heart, Smile 
} from "lucide-react";
import { 
  getSavedTrips, createLocalTrip, deleteLocalTrip, 
  createSupabaseTrip, getSearchHistory, saveSearchQuery, Trip 
} from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import ImageWithFallback from "@/components/ImageWithFallback";

export default function HomePage() {
  const router = useRouter();
  
  // Form State
  const [destination, setDestination] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [dates, setDates] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [budgetLimit, setBudgetLimit] = useState(50000);

  // UI States
  const [history, setHistory] = useState<string[]>([]);
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeInterestTab, setActiveInterestTab] = useState("Beach");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Load Saved data and Auth Session
  useEffect(() => {
    setHistory(getSearchHistory());
    setSavedTrips(getSavedTrips());

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Update trips list when user logs in or out
  useEffect(() => {
    const reloadTrips = async () => {
      if (isSupabaseConfigured && user) {
        const { data, error } = await supabase
          .from("trips")
          .select("id, destination, origin_city, start_date, days, travelers, budget_limit, created_at")
          .order("created_at", { ascending: false });

        if (!error && data) {
          const mappedTrips = data.map((t: any) => ({
            id: t.id,
            destination: t.destination,
            originCity: t.origin_city || "",
            startDate: t.start_date || "",
            days: t.days,
            travelers: t.travelers || 1,
            budgetLimit: parseFloat(t.budget_limit || 50000),
            itinerary: [],
            expenses: [],
            packingList: [],
            createdAt: t.created_at
          }));
          setSavedTrips(mappedTrips);
        }
      } else {
        setSavedTrips(getSavedTrips());
      }
    };
    reloadTrips();
  }, [user]);

  // Voice Search Handler
  const handleVoiceSearch = () => {
    if (typeof window === "undefined") return;
    
    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const cleanTranscript = transcript.replace(/[.?!]/g, "");
      setDestination(cleanTranscript);
    };

    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  // Submit Handler (Supports Dual localStorage/Supabase storage)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setGenerating(true);
    saveSearchQuery(destination);
    setHistory(getSearchHistory());

    const tripParams = {
      destination,
      originCity: originCity || "Mumbai",
      startDate: dates || new Date().toISOString().split("T")[0],
      days: dates ? 4 : 3,
      travelers,
      budgetLimit,
    };

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: tripParams.destination,
          originCity: tripParams.originCity,
          travelers: tripParams.travelers,
          days: tripParams.days,
          budgetLimit: tripParams.budgetLimit,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");
      const data = await response.json();
      
      let newTrip;
      if (isSupabaseConfigured && user) {
        newTrip = await createSupabaseTrip({
          destination: tripParams.destination,
          originCity: tripParams.originCity,
          startDate: tripParams.startDate,
          days: data.generatedDays || 3,
          travelers: tripParams.travelers,
          budgetLimit: tripParams.budgetLimit,
          itinerary: data.days || [],
        }, user.id);
      } else {
        newTrip = createLocalTrip({
          destination: tripParams.destination,
          originCity: tripParams.originCity,
          startDate: tripParams.startDate,
          days: data.generatedDays || 3,
          travelers: tripParams.travelers,
          budgetLimit: tripParams.budgetLimit,
          itinerary: data.days || [],
        });
      }

      if (newTrip) router.push(`/planner/${newTrip.id}`);
    } catch (err) {
      console.error("Itinerary generation error, fallback triggering:", err);
      // Local Mock Fallback
      let newTrip;
      const fallbackItinerary = [
        {
          dayNumber: 1,
          theme: "Arrival & City Explorer",
          activities: [
            { id: "1", name: `${destination} City Gateway`, description: "Scenic landmark visit and orientation walk.", time: "Morning" }
          ]
        }
      ];

      if (isSupabaseConfigured && user) {
        newTrip = await createSupabaseTrip({
          destination: tripParams.destination,
          originCity: tripParams.originCity,
          startDate: tripParams.startDate,
          days: 3,
          travelers: tripParams.travelers,
          budgetLimit: tripParams.budgetLimit,
          itinerary: fallbackItinerary,
        }, user.id);
      } else {
        newTrip = createLocalTrip({
          destination: tripParams.destination,
          originCity: tripParams.originCity,
          startDate: tripParams.startDate,
          days: 3,
          travelers: tripParams.travelers,
          budgetLimit: tripParams.budgetLimit,
          itinerary: fallbackItinerary,
        });
      }
      if (newTrip) router.push(`/planner/${newTrip.id}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSupabaseConfigured && user) {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) {
        alert("Could not delete cloud trip: " + error.message);
        return;
      }
    } else {
      deleteLocalTrip(id);
    }
    // Refresh lists
    if (isSupabaseConfigured && user) {
      const { data } = await supabase
        .from("trips")
        .select("id, destination, origin_city, start_date, days, travelers, budget_limit, created_at")
        .order("created_at", { ascending: false });
      if (data) {
        setSavedTrips(data.map((t: any) => ({
          id: t.id,
          destination: t.destination,
          originCity: t.origin_city || "",
          startDate: t.start_date || "",
          days: t.days,
          travelers: t.travelers || 1,
          budgetLimit: parseFloat(t.budget_limit || 50000),
          itinerary: [],
          expenses: [],
          packingList: [],
          createdAt: t.created_at
        })));
      }
    } else {
      setSavedTrips(getSavedTrips());
    }
  };

  const handleInterestSelect = (dest: string) => {
    setDestination(dest);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Carousel & Inspiration data
  const carouselDestinations = [
    { city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=600&q=80", tag: "Tech & Temple" },
    { city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80", tag: "Art & Romance" },
    { city: "Rome", country: "Italy", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80", tag: "Ancient Heritage" },
    { city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80", tag: "Tropical Escape" },
    { city: "Dubrovnik", country: "Croatia", image: "https://images.unsplash.com/photo-1555992336-03a23c7b20eb?auto=format&fit=crop&w=600&q=80", tag: "Coastal Fort" },
  ];

  const categoriesData: Record<string, { city: string; desc: string; image: string; tag: string }[]> = {
    Beach: [
      { city: "Goa", desc: "Sunny coastal beaches and Portuguese architecture.", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80", tag: "Relaxing" },
      { city: "Maldives", desc: "Overwater bungalows and turquoise marine lagoons.", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=400&q=80", tag: "Luxury" },
      { city: "Phuket", desc: "Lively night markets and pristine sandy beaches.", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=400&q=80", tag: "Adventure" },
    ],
    Adventure: [
      { city: "Manali", desc: "Snowy peak treks, paragliding, and valley trails.", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80", tag: "Trekking" },
      { city: "Leh Ladakh", desc: "Breathtaking high passes and high altitude lakes.", image: "https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&w=400&q=80", tag: "Scenic" },
      { city: "Spiti Valley", desc: "Rugged desert mountains and Buddhist monasteries.", image: "https://images.unsplash.com/photo-1589712791456-f2fe6a40c6c0?auto=format&fit=crop&w=400&q=80", tag: "Remote" },
    ],
    Culture: [
      { city: "Jaipur", desc: "The Royal Pink City palaces and vibrant forts.", image: "https://images.unsplash.com/photo-1477584305359-0d760f35558d?auto=format&fit=crop&w=400&q=80", tag: "Royal" },
      { city: "Kyoto", desc: "Wooden temples, gardens, and traditional tea houses.", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80", tag: "Heritage" },
      { city: "Varanasi", desc: "Vibrant spiritual ghat ceremonies and old alleys.", image: "https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=400&q=80", tag: "Spiritual" },
    ],
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 pt-20 md:pt-28 pb-20 text-[#221F1C]">
      
      {/* 1. HERO SECTION (HEIGHT OPTIMIZED TO 70VH) */}
      <section className="relative min-h-[50vh] md:min-h-[60vh] flex flex-col items-center justify-center text-center py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-teal-700 text-[10px] font-extrabold tracking-widest uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            AI-Powered Cloud Workspace
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold font-display leading-[1.05] tracking-tight bg-gradient-to-r from-[#221F1C] via-[#4C7ABF] to-[#3A9687] bg-clip-text text-transparent mb-3.5">
            Plan Your Next Escape. Collaboratively.
          </h1>
          <p className="text-[#666059] text-xs md:text-sm leading-relaxed mb-6 max-w-md mx-auto">
            Design dynamic route maps, query flight options, organize category budgets, and curate itineraries using our shared travel co-pilot.
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-xl mx-auto relative z-10"
        >
          <form onSubmit={handleSearchSubmit} className="glass-panel border-gray-300/70 bg-[#FAF8F5]/95 p-3.5 rounded-2xl md:rounded-3xl shadow-soft flex flex-col gap-2.5">
            <div className="flex items-center gap-2 relative w-full min-w-0">
              <Search className="w-4.5 h-4.5 text-slate-500 ml-1.5 flex-shrink-0" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Where would you like to travel?"
                className="flex-1 min-w-0 bg-transparent py-2 text-xs text-[#221F1C] placeholder-slate-500 focus:outline-none"
                required
              />
              
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`p-2 rounded-xl transition-colors duration-250 flex-shrink-0 ${
                  isRecording 
                    ? "bg-red-500/10 text-red-600 border border-red-500/20" 
                    : "hover:bg-gray-100 text-slate-500 hover:text-slate-700"
                }`}
                title="Search by Voice"
              >
                {isRecording ? <Mic className="w-3.5 h-3.5 animate-ping" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>

              <button
                type="submit"
                disabled={generating}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5"
              >
                {generating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Plan</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-gray-300/60 pt-2.5">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] font-bold text-teal-800 hover:text-teal-950 transition-colors uppercase tracking-wider"
              >
                {showAdvanced ? "▼ Simple Search" : "▲ Customize Dates & Budget"}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-2.5 grid grid-cols-2 md:grid-cols-4 gap-2.5 text-left"
                  >
                    <div>
                      <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Departure</label>
                      <input
                        type="text"
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        placeholder="Mumbai"
                        className="w-full glass-input px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={dates}
                        onChange={(e) => setDates(e.target.value)}
                        className="w-full glass-input px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Travelers</label>
                      <input
                        type="number"
                        min={1}
                        value={travelers}
                        onChange={(e) => setTravelers(Number(e.target.value))}
                        className="w-full glass-input px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Budget (Rs)</label>
                      <input
                        type="number"
                        value={budgetLimit}
                        onChange={(e) => setBudgetLimit(Number(e.target.value))}
                        className="w-full glass-input px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>

          {/* Autocomplete Search History */}
          {history.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-3.5">
              <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                <History className="w-3 h-3" /> Recent:
              </span>
              {history.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDestination(h)}
                  className="px-2 py-0.5 rounded-full border border-gray-200/60 bg-[#F4F1E9] text-[10px] text-[#666059] hover:text-[#221F1C] transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* 2. FEATURED DESTINATIONS CAROUSEL (NEW) */}
      <section className="mb-16">
        <div className="mb-6 text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#666059] block mb-1">Curation Favorites</span>
          <h2 className="text-xl md:text-2xl font-extrabold font-display text-[#221F1C] flex items-center gap-2">
            <Compass className="w-5 h-5 text-teal-600" />
            Featured Gateways
          </h2>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-4 scroll-smooth no-scrollbar snap-x snap-mandatory">
          {carouselDestinations.map((dest, idx) => (
            <div
              key={idx}
              onClick={() => handleInterestSelect(dest.city)}
              className="flex-shrink-0 w-60 snap-start group rounded-2xl border border-gray-200/50 bg-white/80 p-3 shadow-soft hover:shadow-md transition-all duration-300 cursor-pointer text-left"
            >
              <div className="h-36 w-full relative overflow-hidden rounded-xl mb-3">
                <ImageWithFallback
                  src={dest.image}
                  alt={dest.city}
                  fill
                  sizes="240px"
                  fallbackText={dest.city}
                  className="object-cover transition-transform duration-500 group-hover:scale-103"
                />
                <span className="absolute top-2 left-2 text-[9px] font-bold text-teal-700 border border-teal-500/20 bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
                  {dest.tag}
                </span>
              </div>
              <h3 className="text-sm font-bold font-display text-gray-800">{dest.city}</h3>
              <p className="text-[10px] text-gray-400 font-medium">{dest.country}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. SAVED / SYNCED CLOUD ITINERARIES LIST */}
      {savedTrips.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-extrabold font-display text-[#221F1C] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#4C7ABF]" />
              {user ? "Cloud Workspace Trips" : "Local Saved Itineraries"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {savedTrips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/planner/${trip.id}`)}
                className="group p-5 rounded-2xl glass-panel border-gray-200/40 bg-white/80 hover:bg-[#FAF8F5]/50 hover:border-teal-500/20 transition-all duration-300 shadow-soft cursor-pointer flex flex-col justify-between min-h-[140px] text-left"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold tracking-widest uppercase text-teal-700 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/15">
                      {trip.days} Days
                    </span>
                    <button
                      onClick={(e) => handleDeleteSaved(trip.id, e)}
                      className="p-1.5 rounded-full hover:bg-red-500/10 text-gray-450 hover:text-red-500 transition-colors"
                      title="Delete Trip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-[#221F1C] mt-2.5 font-display">{trip.destination}</h3>
                  <p className="text-[10px] text-[#666059] mt-0.5 font-medium">Origin: {trip.originCity}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#666059] border-t border-gray-200/50 pt-2.5 mt-4">
                  <span className="flex items-center gap-1 font-semibold"><Calendar className="w-3 h-3 text-[#4C7ABF]" /> {trip.startDate}</span>
                  <span className="flex items-center gap-1 font-semibold"><Users className="w-3 h-3 text-[#3A9687]" /> {trip.travelers} Pax</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. AI WORKSPACE SHOWCASE (NEW) */}
      <section className="mb-16 p-6 md:p-8 rounded-3xl border border-gray-200/40 bg-[#FAF8F5] shadow-soft">
        <div className="max-w-xl text-left mb-8">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#3A9687] block mb-1">Workspace Highlights</span>
          <h2 className="text-xl md:text-2xl font-extrabold font-display text-[#221F1C]">
            Single Workspace, Zero Clutter.
          </h2>
          <p className="text-xs text-[#666059] mt-1.5 leading-relaxed">
            Stop scanning dozens of browser tabs. Plan, cache, and schedule your trip activities, flights, hotels, and packing lists all in one responsive interface.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="p-5 rounded-2xl border border-gray-200/30 bg-white/70 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-3">
              <Navigation className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1">1. Map Routing</h3>
            <p className="text-[11px] text-[#666059] leading-relaxed">
              Auto-resolved GPS coordinates display your day stops on an interactive routing line.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-gray-200/30 bg-white/70 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-[#4C7ABF]/10 border border-[#4C7ABF]/20 flex items-center justify-center mb-3">
              <Landmark className="w-4 h-4 text-[#4C7ABF]" />
            </div>
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1">2. Deal Curation</h3>
            <p className="text-[11px] text-[#666059] leading-relaxed">
              Scan matching flights and hotels integrated straight into your itinerary planner sidebar.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-gray-200/30 bg-white/70 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <CloudSun className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1">3. Weather Advice</h3>
            <p className="text-[11px] text-[#666059] leading-relaxed">
              Monitor dynamic forecast metrics and auto-generate category-specific packing advice.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-gray-200/30 bg-white/70 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1">4. AI Co-Pilot</h3>
            <p className="text-[11px] text-[#666059] leading-relaxed">
              Refine locations, ask budget allocation tips, or re-organize days by talking to your co-pilot.
            </p>
          </div>
        </div>
      </section>

      {/* 5. TRENDING / POPULAR DESTINATIONS CATEGORIES */}
      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold font-display text-[#221F1C] flex items-center gap-2">
              <Compass className="w-5 h-5 text-teal-600" />
              Travel Inspiration
            </h2>
            <p className="text-xs text-[#666059] mt-0.5">Explore curated destinations grouped by journey styles</p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAF8F5] border border-gray-200/50">
            {Object.keys(categoriesData).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveInterestTab(cat)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeInterestTab === cat 
                    ? "bg-white border border-gray-200/40 text-teal-700 shadow-sm" 
                    : "text-gray-400 hover:text-gray-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {categoriesData[activeInterestTab].map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleInterestSelect(item.city)}
              className="group rounded-2xl border border-gray-200/40 bg-white/70 shadow-soft hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between text-left"
            >
              <div className="h-44 w-full relative overflow-hidden rounded-t-2xl">
                <ImageWithFallback
                  src={item.image}
                  alt={item.city}
                  fill
                  sizes="(max-width: 768px) 100vw, 350px"
                  fallbackText={item.city}
                  className="object-cover transition-transform duration-500 group-hover:scale-102"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 text-[9px] font-bold text-teal-700 border border-teal-500/20 bg-white/90 px-2 py-0.5 rounded-full">
                  {item.tag}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold font-display text-gray-850">{item.city}</h3>
                <p className="text-xs text-[#666059] mt-1.5 leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 hover:text-teal-800 mt-4 transition-colors">
                  <span>Curate journey</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
