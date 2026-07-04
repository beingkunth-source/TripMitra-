"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Mic, MicOff, History, Trash2, Calendar, Users, 
  Globe, Star, Compass, ArrowRight, Sparkles, Navigation, 
  CloudSun, Landmark, Heart, Smile, Brain, Plane, Hotel, Coins 
} from "lucide-react";
import { 
  getSavedTrips, createLocalTrip, deleteLocalTrip, 
  createSupabaseTrip, getSearchHistory, saveSearchQuery, Trip 
} from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import ImageWithFallback from "@/components/ImageWithFallback";

const getFlagEmoji = (dest: string) => {
  const d = dest.toLowerCase();
  if (d.includes("japan") || d.includes("kyoto") || d.includes("tokyo")) return "🇯🇵";
  if (d.includes("india") || d.includes("goa") || d.includes("manali") || d.includes("varanasi") || d.includes("delhi") || d.includes("mumbai")) return "🇮🇳";
  if (d.includes("france") || d.includes("paris")) return "🇫🇷";
  if (d.includes("italy") || d.includes("rome")) return "🇮🇹";
  if (d.includes("indonesia") || d.includes("bali")) return "🇮🇩";
  if (d.includes("croatia") || d.includes("dubrovnik")) return "🇭🇷";
  if (d.includes("maldives")) return "🇲🇻";
  if (d.includes("thailand") || d.includes("phuket")) return "🇹🇭";
  return "🌍";
};

export default function HomePage() {
  const router = useRouter();
  
  // Form State
  const [destination, setDestination] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [dates, setDates] = useState("");
  const [endDate, setEndDate] = useState("");
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

  // Rotating placeholder suggestions
  const placeholderSuggestions = [
    "Kyoto under ₹90K",
    "Goa with friends this weekend",
    "Bali honeymoon for 6 days",
    "Europe backpacking trip"
  ];
  const [currentPlaceholderIdx, setCurrentPlaceholderIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholderIdx((prev) => (prev + 1) % placeholderSuggestions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

    // Geocoding check (log warning if unresolved but do not block search)
    try {
      const geoUrl = `/api/geocode?place=${encodeURIComponent(destination.trim())}`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) {
        console.warn(`Could not resolve coordinates for "${destination}". Continuing to generate itinerary.`);
      }
    } catch (err) {
      console.warn("Geocoding validation check failed, continuing anyway:", err);
    }

    const calculatedDays = (() => {
      if (dates && endDate) {
        const start = new Date(dates);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        return Math.max(1, Math.min(30, diffDays));
      }
      return 3;
    })();

    const tripParams = {
      destination,
      originCity: originCity || "Mumbai",
      startDate: dates || new Date().toISOString().split("T")[0],
      days: calculatedDays,
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
    { city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80", tag: "Tech & Temple" },
    { city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80", tag: "Art & Romance" },
    { city: "Rome", country: "Italy", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80", tag: "Ancient Heritage" },
    { city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80", tag: "Tropical Escape" },
    { city: "Dubrovnik", country: "Croatia", image: "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=600&q=80", tag: "Coastal Fort" },
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
    <div className="relative w-full max-w-[1400px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-20 text-[#221F1C]">
      
      {/* Background Mesh Gradient Blobs */}
      <div className="absolute top-10 left-1/4 w-80 h-80 bg-teal-200/10 rounded-full filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-coral-500/10 rounded-full filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-72 h-72 bg-emerald-200/5 rounded-full filter blur-3xl pointer-events-none -z-10" />
      
      {/* Subtle World Map Watermark Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#221f1c_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03] pointer-events-none -z-10" />

      {/* Animated SVG Travel Routes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10 hidden lg:block" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 150 C 250 50, 450 250, 750 100" fill="none" stroke="rgba(58, 150, 135, 0.08)" strokeWidth="2" className="animate-route-dash" />
        <path d="M150 450 C 400 300, 550 550, 900 400" fill="none" stroke="rgba(76, 122, 191, 0.05)" strokeWidth="2" className="animate-route-dash" />
      </svg>

      {/* 1. HERO SECTION (2-COLUMN GRID) */}
      <section className="relative min-h-[60vh] py-8 md:py-14 flex flex-col lg:grid lg:grid-cols-12 gap-10 lg:gap-20 items-center text-left">
        
        {/* Left Column: Headline, Description, Search, Indicators */}
        <div className="lg:col-span-7 flex flex-col items-start w-full pr-0 lg:pr-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-teal-700 text-[10px] font-extrabold tracking-widest uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              AI-Powered Travel Planning for Groups
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-5xl font-extrabold font-display leading-[1.1] tracking-tight text-slate-900 mb-4"
          >
            Plan Trips Together. <br />
            <span className="bg-gradient-to-r from-teal-600 via-teal-400 to-emerald-600 bg-clip-text text-transparent">
              Flights, Hotels & Budgets
            </span> <br />
            in One Place.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-slate-600 text-sm md:text-base lg:text-lg leading-relaxed mb-6 font-medium max-w-xl"
          >
            Your AI Travel Copilot for Stress-Free Trips. Design dynamic route maps, compare flight options, organize budgets, and curate itineraries with friends in real-time.
          </motion.p>

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="w-full max-w-xl relative z-10 mb-4"
          >
            <form onSubmit={handleSearchSubmit} className="glass-panel border-gray-300/70 bg-[#FAF8F5]/95 p-3.5 rounded-2xl md:rounded-3xl shadow-soft flex flex-col gap-2.5">
              <div className="flex items-center gap-2 relative w-full min-w-0">
                <Search className="w-4.5 h-4.5 text-slate-500 ml-1.5 flex-shrink-0" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={`Where to? Try "${placeholderSuggestions[currentPlaceholderIdx]}"`}
                  className="flex-1 min-w-0 bg-transparent py-2 text-sm md:text-[15px] font-medium text-[#221F1C] placeholder:text-[#64748b] placeholder:font-medium focus:outline-none"
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
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs md:text-sm px-4.5 py-2.5 md:px-5 md:py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5 group"
                >
                  {generating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Planning Free</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-gray-300/60 pt-2.5">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[10px] font-bold text-teal-800 hover:text-teal-950 transition-colors uppercase tracking-wider"
                  >
                    {showAdvanced ? "▼ Simple Search" : "▲ Customize Dates & Budget"}
                  </button>
                  <p className="hidden sm:block text-[9px] text-[#64748b] font-bold uppercase tracking-wider">
                    Examples: &ldquo;Kyoto under ₹90k&rdquo;
                  </p>
                </div>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-2.5 grid grid-cols-2 md:grid-cols-5 gap-2.5 text-left"
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
                        <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          min={dates}
                          onChange={(e) => setEndDate(e.target.value)}
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
          </motion.div>

          {/* Trust Indicators */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-bold text-slate-500 mb-6 pl-1 justify-start"
          >
            <span className="flex items-center gap-1 text-slate-650">✓ 10,000+ trips planned</span>
            <span className="flex items-center gap-1 text-slate-650">✓ Real-time flight data</span>
            <span className="flex items-center gap-1 text-slate-650">✓ AI itinerary workspace</span>
            <span className="flex items-center gap-1 text-slate-650">✓ Collaborative planning</span>
          </motion.div>

          {/* Recent Destination Chips */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap gap-1.5 items-center"
          >
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-1 mr-1">
              <History className="w-3.5 h-3.5" /> Try:
            </span>
            {[
              { label: "🏖️ Goa", query: "Goa" },
              { label: "🌸 Kyoto", query: "Kyoto" },
              { label: "🏔️ Manali", query: "Manali" },
              { label: "🕌 Varanasi", query: "Varanasi" }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDestination(chip.query)}
                className="px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:border-teal-500/30 hover:bg-teal-500/5 text-[11px] text-slate-700 font-semibold transition-all duration-200 flex items-center gap-1 shadow-sm"
              >
                {chip.label}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Right Column: Interactive Trip Preview / Dashboard Mockup */}
        <div className="lg:col-span-5 w-full flex justify-center lg:justify-end relative mt-8 lg:mt-0 pr-0 lg:pr-4">
          {/* Floating pins behind the mockup */}
          <div className="absolute top-4 left-6 text-2xl animate-float-pin opacity-70" style={{ animationDelay: "0s" }}>📍</div>
          <div className="absolute bottom-10 right-4 text-2xl animate-float-pin opacity-70" style={{ animationDelay: "1.5s" }}>📍</div>
          <div className="absolute top-1/2 -right-8 text-2xl animate-float-pin opacity-60" style={{ animationDelay: "3s" }}>📍</div>

          {/* Main Mockup Card (Enlarged by ~20% to max-w-[480px]) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-[480px] rounded-3xl border border-gray-200/60 bg-[#FAF8F5]/85 backdrop-blur-md p-6 shadow-xl relative overflow-hidden flex flex-col gap-4.5 text-left"
          >
            {/* Mockup Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200/50">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🇯🇵</span>
                  <h4 className="text-base font-black text-slate-900 font-display">Tokyo Adventure</h4>
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Spring Break • 7 Days</p>
              </div>
              
              {/* Collaborators Stack */}
              <div className="flex items-center relative pr-2">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center border border-white shadow-sm">A</div>
                <div className="w-8 h-8 rounded-full bg-coral-500 text-white font-black text-xs flex items-center justify-center border border-white -ml-2.5 shadow-sm">B</div>
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center border border-white -ml-2.5 shadow-sm">C</div>
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center border border-white -ml-2.5 shadow-sm">+1</div>
                <span className="absolute bottom-0 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white animate-pulse" />
              </div>
            </div>

            {/* Layered Cards */}
            <div className="flex flex-col gap-3.5 relative z-10">
              {/* 1. Map Route Segment */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/90 p-3.5 rounded-2xl border border-gray-200/60 shadow-sm flex flex-col gap-2 relative overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-teal-750 bg-teal-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Itinerary Route</span>
                  <span className="text-[10px] font-bold text-slate-400">Day 1 Segment</span>
                </div>
                <div className="h-20 w-full rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center p-2 relative overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 40 C 130 10, 240 70, 380 40" fill="none" stroke="rgba(20, 110, 120, 0.2)" strokeWidth="4" strokeLinecap="round" />
                    <path d="M20 40 C 130 10, 240 70, 380 40" fill="none" stroke="#0f766e" strokeWidth="2" strokeDasharray="6 4" className="animate-route-dash" strokeLinecap="round" />
                  </svg>
                  <div className="absolute left-6 top-6 flex flex-col items-center">
                    <span className="w-2.5 h-2.5 bg-teal-600 rounded-full ring-4 ring-teal-500/20" />
                    <span className="text-[9px] font-bold text-slate-700 mt-1">Shibuya</span>
                  </div>
                  <div className="absolute right-6 top-6 flex flex-col items-center">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full ring-4 ring-emerald-500/20" />
                    <span className="text-[9px] font-bold text-slate-700 mt-1">Asakusa</span>
                  </div>
                </div>
              </motion.div>

              {/* 2. Flight Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-white/90 p-3.5 rounded-2xl border border-gray-200/60 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600">
                    <Plane className="w-[18px] h-[18px] transform rotate-45" />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Delhi ⇄ Tokyo</h5>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">ANA NH-828 • Direct</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">₹42,500</p>
                  <p className="text-[9px] text-teal-755 bg-teal-500/10 px-1.5 py-0.5 rounded-full font-bold mt-1 uppercase tracking-wider">✓ Selected</p>
                </div>
              </motion.div>

              {/* 3. Hotel Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white/90 p-3.5 rounded-2xl border border-gray-200/60 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <Hotel className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Park Hyatt Tokyo</h5>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">★ 4.8 (850 reviews)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">₹18,200/n</p>
                  <p className="text-[9px] text-teal-750 font-bold mt-1 uppercase tracking-wider">Saved to Deck</p>
                </div>
              </motion.div>

              {/* 4. Budget Tracking Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 }}
                className="bg-white/90 p-3.5 rounded-2xl border border-gray-200/60 shadow-sm flex justify-between items-center gap-3"
              >
                <div>
                  <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Expense Tracker</h5>
                  <p className="text-[11px] text-slate-505 font-bold mt-0.5">Spent: ₹72,000 / ₹1,20,000</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center relative shadow-inner" style={{ background: "conic-gradient(#0f766e 60%, #e2e8f0 60% 100%)" }}>
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-black text-[#221F1C]">60%</div>
                </div>
              </motion.div>
            </div>
            
            {/* Background Grid Pattern watermark */}
            <div className="absolute inset-0 bg-[radial-gradient(#0f766e_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHT CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 text-left">
        {[
          {
            title: "AI Itinerary",
            emoji: "🧠",
            desc: "Create day-by-day itineraries tailored to your travel style, pace, and budget in seconds.",
            icon: Brain,
            color: "teal"
          },
          {
            title: "Flight Search",
            emoji: "✈️",
            desc: "Compare real-time flight deals and multi-segment routing options directly inside your workspace.",
            icon: Plane,
            color: "coral"
          },
          {
            title: "Accommodations",
            emoji: "🏨",
            desc: "Discover matching hotels with live pricing and reviews curated for your group size.",
            icon: Hotel,
            color: "emerald"
          },
          {
            title: "Group Budgeting",
            emoji: "💰",
            desc: "Categorize expenses, split shared costs, and monitor real-time group spending targets.",
            icon: Coins,
            color: "amber"
          }
        ].map((feat, idx) => {
          const Icon = feat.icon;
          const bgColors = {
            teal:    "bg-teal-50 border-teal-200/50 text-teal-600",
            coral:   "bg-coral-50 border-coral-200/50 text-coral-600",
            emerald: "bg-emerald-50 border-emerald-200/50 text-emerald-600",
            amber:   "bg-amber-50 border-amber-200/50 text-amber-600"
          }[feat.color as "teal" | "coral" | "emerald" | "amber"];

          return (
            <motion.div
              key={idx}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-7 min-h-[245px] rounded-2xl border border-slate-200 bg-white/90 shadow-md hover:shadow-xl hover:border-teal-500/25 transition-all duration-300 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className={`w-12 h-12 rounded-2xl ${bgColors} border flex items-center justify-center mb-5 shadow-sm`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base md:text-lg font-extrabold text-slate-900 font-display tracking-tight mb-2 flex items-center gap-1.5">
                  <span>{feat.emoji}</span>
                  <span>{feat.title}</span>
                </h3>
                <p className="text-xs md:text-[13px] text-slate-600 leading-relaxed font-medium">
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
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

      {/* POPULAR GETAWAYS GRID WITH REAL IMAGES */}
      <section className="mb-16">
        <div className="mb-6 text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-850 block mb-1">Trending Explores</span>
          <h2 className="text-xl md:text-2xl font-extrabold font-display text-[#221F1C] flex items-center gap-2">
            <Compass className="w-5 h-5 text-teal-600" />
            Popular Getaways
          </h2>
          <p className="text-xs text-[#666059] mt-0.5">Directly select from our users' favorite hotspots to start your plan</p>
        </div>
        
        {/* Bento Grid Masonry-like Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 auto-rows-[165px]">
          {[
            { city: "Kyoto", emoji: "🌸", desc: "Wooden temples & zen gardens", country: "Japan", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80", span: "md:col-span-2 md:row-span-2 h-full" },
            { city: "Goa", emoji: "🏖️", desc: "Sundecks & coastal beach life", country: "India", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80", span: "md:col-span-1 md:row-span-1 h-full" },
            { city: "Manali", emoji: "🏔️", desc: "Snowy peak treks & trails", country: "India", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80", span: "md:col-span-1 md:row-span-1 h-full" },
            { city: "Varanasi", emoji: "🪔", desc: "Spiritual river ghat ceremonies", country: "India", image: "https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=600&q=80", span: "md:col-span-1 md:row-span-1 h-full" },
          ].map((dest, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => handleInterestSelect(dest.city)}
              className={`group overflow-hidden rounded-card-ds border border-slate-200 bg-white shadow-card-ds hover:shadow-elevated-ds transition-all duration-300 cursor-pointer flex flex-col text-left ${dest.span}`}
            >
              <div className="relative w-full flex-grow overflow-hidden min-h-[110px]">
                <ImageWithFallback
                  src={dest.image}
                  alt={dest.city}
                  fill
                  sizes="400px"
                  fallbackText={dest.city}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute top-2.5 left-2.5 text-xs bg-white/95 px-2.5 py-0.5 rounded-full shadow-sm font-extrabold text-slate-800 flex items-center gap-1">
                  <span>{dest.emoji}</span>
                  <span>{dest.city}</span>
                </span>
              </div>
              <div className="p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-teal-850">{dest.country}</h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-semibold mt-0.5 truncate">{dest.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 mt-2 group-hover:text-teal-900 transition-colors">
                  <span>Plan trip</span>
                  <ArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* AI Bento CTA Grid Item */}
          <motion.div
            whileHover={{ y: -6, scale: 1.01 }}
            onClick={() => { setDestination(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="group overflow-hidden rounded-card-ds border border-teal-200/50 bg-gradient-to-br from-teal-950 to-teal-800 p-5 shadow-card-ds hover:shadow-elevated-ds transition-all duration-300 cursor-pointer flex flex-col justify-between text-left md:col-span-1 md:row-span-1 h-full"
          >
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">AI Planner</span>
              <h3 className="text-sm font-bold font-display text-white mt-2.5 leading-snug">Suggest another hotspot?</h3>
              <p className="text-[10px] text-slate-300 mt-1 leading-normal font-medium">Type any destination in the copilot search box.</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-extrabold text-teal-400 mt-2">
              <span>Try prompts free</span>
              <Sparkles className="w-3 h-3 text-teal-400 animate-pulse" />
            </div>
          </motion.div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {savedTrips.map((trip) => {
              const attractionsCount = (trip.itinerary && trip.itinerary.length > 0) 
                ? trip.itinerary.reduce((sum, d) => sum + (d.activities?.length || 0), 0) 
                : 3;
              
              return (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/planner/${trip.id}`)}
                  className="group p-5 rounded-card-ds border border-slate-200/60 bg-white shadow-card-ds hover:shadow-elevated-ds hover:border-teal-500/20 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[175px] text-left"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/15">
                        {trip.days} Days
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-extrabold text-teal-750 bg-teal-500/10 border border-teal-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Status: Planning
                        </span>
                        <button
                          onClick={(e) => handleDeleteSaved(trip.id, e)}
                          className="p-1.5 rounded-full hover:bg-red-500/10 text-gray-450 hover:text-red-500 transition-colors"
                          title="Delete Trip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mt-3 font-display flex items-center gap-1.5">
                      <span>{trip.destination}</span>
                      <span>{getFlagEmoji(trip.destination)}</span>
                    </h3>
                    
                    <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                      Origin: {trip.originCity} • {trip.travelers} Pax
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-slate-650 border-t border-gray-150 pt-3 mt-4">
                    <span className="flex items-center gap-1 font-bold text-teal-850">
                      💰 Budget: ₹{trip.budgetLimit.toLocaleString("en-IN")}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-teal-700">
                      📍 {attractionsCount} Attractions
                    </span>
                  </div>
                </div>
              );
            })}
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
            <motion.div
              key={idx}
              whileHover={{ y: -8, scale: 1.01 }}
              onClick={() => handleInterestSelect(item.city)}
              className="group rounded-card-ds border border-slate-200 bg-white/90 shadow-card-ds hover:shadow-elevated-ds hover:border-teal-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between text-left"
            >
              <div className="h-44 w-full relative overflow-hidden rounded-t-card-ds">
                <ImageWithFallback
                  src={item.image}
                  alt={item.city}
                  fill
                  sizes="(max-width: 768px) 100vw, 350px"
                  fallbackText={item.city}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 text-[10px] font-bold text-teal-700 border border-teal-500/20 bg-white/90 px-2.5 py-0.5 rounded-full">
                  {item.tag}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold font-display text-gray-850">{item.city}</h3>
                <p className="text-xs text-[#666059] mt-1.5 leading-relaxed font-medium">{item.desc}</p>
                
                {/* Visual Slide-up Overlay Plan Button */}
                <div className="mt-5 overflow-hidden relative h-9 border-t border-gray-100 pt-2">
                  <div className="w-full h-full flex items-center justify-between text-xs font-extrabold text-teal-750 transition-transform duration-300 group-hover:-translate-y-full">
                    <span className="flex items-center gap-1.5">Curate journey <ArrowRight className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white bg-gradient-to-r from-teal-600 to-emerald-600 rounded-lg transition-transform duration-300 translate-y-full group-hover:translate-y-0 shadow-sm">
                    <span className="flex items-center gap-1.5">Plan This Trip <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" /></span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
