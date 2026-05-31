"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Users, MapPin, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  CloudSun, Briefcase, DollarSign, Navigation, Hotel, PlusCircle, ArrowUpDown
} from "lucide-react";
import { useActiveTrip, TripActivity, updateTripRecord } from "@/lib/store";
import ExportButtons from "@/components/ExportButtons";
import AIChatAssistant from "@/components/AIChatAssistant";
import ImageWithFallback from "@/components/ImageWithFallback";

// Dynamic Import for Leaflet Map to avoid SSR 'window is not defined' compilation errors
const Map = dynamic(() => import("@/components/Map"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-gray-50 animate-pulse flex items-center justify-center text-gray-400 rounded-2xl border border-gray-200">
      Loading Interactive Map Router...
    </div>
  )
});

export default function PlannerPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const {
    trip,
    addActivity,
    editActivity,
    deleteActivity,
    togglePackingItem,
    addPackingItem,
    deletePackingItem,
    setPackingSuggestions,
    addExpense,
  } = useActiveTrip(tripId);

  // Active UI States
  const [activeDay, setActiveDay] = useState(1);
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [activeSidebarTab, setActiveSidebarTab] = useState<"places" | "weather" | "deals" | "assistant">("places");

  // Stops Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [targetDay, setTargetDay] = useState(1);
  
  // Stop Form Values
  const [stopName, setStopName] = useState("");
  const [stopDesc, setStopDesc] = useState("");
  const [stopTime, setStopTime] = useState("Morning");
  const [selectedActivity, setSelectedActivity] = useState<TripActivity | null>(null);

  // Weather States
  const [weatherForecast, setWeatherForecast] = useState<any>(null);
  const [weatherAdvice, setWeatherAdvice] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Booking Deals States
  const [flightDeals, setFlightDeals] = useState<any[]>([]);
  const [hotelDeals, setHotelDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dealSorting, setDealSorting] = useState<"price" | "rating">("price");

  // Packing List input
  const [newPackingText, setNewPackingText] = useState("");

  // Fetch Weather Forecast and TripAdvisor Deals on Destination change
  useEffect(() => {
    if (!trip?.destination) return;

    const fetchWeatherData = async () => {
      setLoadingWeather(true);
      try {
        const res = await fetch(`/api/weather?destination=${encodeURIComponent(trip.destination)}&date=${trip.startDate}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setWeatherForecast(data);

        // Fetch AI Weather advice matching forecast
        if (data.forecast) {
          const adviceRes = await fetch("/api/weather-advice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              destination: trip.destination,
              dates: trip.startDate,
              weather_summary: data.forecast.daily
            })
          });
          if (adviceRes.ok) {
            const adviceData = await adviceRes.json();
            setWeatherAdvice(adviceData.weather_advice);
          }
        }
      } catch (err) {
        console.error("Failed to load weather:", err);
      } finally {
        setLoadingWeather(false);
      }
    };

    const fetchDealsData = async () => {
      setLoadingDeals(true);
      try {
        // Fetch flights deals
        const flightRes = await fetch(
          `/api/flights?departure_id=${encodeURIComponent(trip.originCity)}&arrival_id=${encodeURIComponent(
            trip.destination
          )}&outbound_date=${trip.startDate}`
        );
        if (flightRes.ok) {
          const flightData = await flightRes.json();
          setFlightDeals(flightData.best_flights || []);
        }

        // Fetch hotels deals
        const checkOut = new Date(trip.startDate);
        checkOut.setDate(checkOut.getDate() + trip.days);
        const hotelRes = await fetch(
          `/api/hotels?q=${encodeURIComponent(trip.destination)}&check_in_date=${
            trip.startDate
          }&check_out_date=${checkOut.toISOString().split("T")[0]}`
        );
        if (hotelRes.ok) {
          const hotelData = await hotelRes.json();
          setHotelDeals(hotelData.properties || []);
        }
      } catch (err) {
        console.error("Failed to load deals:", err);
      } finally {
        setLoadingDeals(false);
      }
    };

    fetchWeatherData();
    fetchDealsData();
  }, [trip?.destination, trip?.startDate, trip?.days, trip?.originCity]);

  // Load packing suggestions via AI if list is empty
  useEffect(() => {
    if (!trip || trip.packingList.length > 0) return;

    const fetchPackingSuggestions = async () => {
      try {
        const res = await fetch("/api/packing-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: trip.destination,
            dates: trip.startDate,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.packing_suggestions?.categories) {
            setPackingSuggestions(data.packing_suggestions.categories);
          }
        }
      } catch (err) {
        console.error("Failed to load packing suggestions:", err);
      }
    };

    fetchPackingSuggestions();
  }, [trip?.destination, trip?.packingList.length]);

  // Auto-geocode initial generated activities if coordinates are missing
  useEffect(() => {
    if (!trip) return;

    // Check if there are any activities missing coordinates
    const hasMissing = trip.itinerary.some(day => 
      day.activities.some(act => typeof act.lat !== "number" || typeof act.lng !== "number")
    );

    if (!hasMissing) return;

    const geocodeItinerary = async () => {
      let updated = false;
      const updatedItinerary = await Promise.all(
        trip.itinerary.map(async (day) => {
          const updatedActivities = await Promise.all(
            day.activities.map(async (act) => {
              if (typeof act.lat === "number" && typeof act.lng === "number") {
                return act;
              }
              try {
                const res = await fetch(
                  `/api/geocode?place=${encodeURIComponent(act.name)}&location=${encodeURIComponent(
                    trip.destination
                  )}`
                );
                if (res.ok) {
                  const coords = await res.json();
                  updated = true;
                  return { ...act, lat: coords.lat, lng: coords.lng };
                }
              } catch (err) {
                console.error("Geocoding failed for:", act.name, err);
              }
              return act;
            })
          );
          return { ...day, activities: updatedActivities };
        })
      );

      if (updated) {
        updateTripRecord({ ...trip, itinerary: updatedItinerary });
      }
    };

    geocodeItinerary();
  }, [trip]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Finding your itinerary records...
      </div>
    );
  }

  // Handle Collapsible Day view
  const toggleDayExpansion = (dayNum: number) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayNum]: !prev[dayNum]
    }));
  };

  // Open modals
  const openAddModal = (dayNum: number) => {
    setTargetDay(dayNum);
    setStopName("");
    setStopDesc("");
    setStopTime("Morning");
    setShowAddModal(true);
  };

  const openEditModal = (dayNum: number, activity: TripActivity) => {
    setTargetDay(dayNum);
    setSelectedActivity(activity);
    setStopName(activity.name);
    setStopDesc(activity.description);
    setStopTime(activity.time || "Morning");
    setShowEditModal(true);
  };

  // Geocode & Save Stops
  const handleSaveAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopName.trim()) return;

    setShowAddModal(false);
    
    try {
      const geoRes = await fetch(`/api/geocode?place=${encodeURIComponent(stopName)}&location=${encodeURIComponent(trip.destination)}`);
      if (geoRes.ok) {
        const coords = await geoRes.json();
        addActivity(targetDay, stopName, stopDesc, stopTime, coords.lat, coords.lng);
      } else {
        addActivity(targetDay, stopName, stopDesc, stopTime);
      }
    } catch {
      addActivity(targetDay, stopName, stopDesc, stopTime);
    }
  };

  const handleSaveEditStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopName.trim() || !selectedActivity) return;

    setShowEditModal(false);

    try {
      const geoRes = await fetch(`/api/geocode?place=${encodeURIComponent(stopName)}&location=${encodeURIComponent(trip.destination)}`);
      if (geoRes.ok) {
        const coords = await geoRes.json();
        editActivity(targetDay, selectedActivity.id, {
          name: stopName,
          description: stopDesc,
          time: stopTime,
          lat: coords.lat,
          lng: coords.lng,
        });
      } else {
        editActivity(targetDay, selectedActivity.id, {
          name: stopName,
          description: stopDesc,
          time: stopTime,
        });
      }
    } catch {
      editActivity(targetDay, selectedActivity.id, {
        name: stopName,
        description: stopDesc,
        time: stopTime,
      });
    }
  };

  const handleAddHotelExpense = (hotel: any) => {
    const rawRate = hotel.rate_per_night?.lowest || "3000";
    const numericPrice = parseInt(rawRate.replace(/[^0-9]/g, "")) || 3000;
    
    addExpense(
      `Hotel Reservation: ${hotel.name}`,
      "Hotels",
      numericPrice * trip.days
    );
    alert(`Added ${hotel.name} expense allocation of Rs ${(numericPrice * trip.days).toLocaleString()} to Budget Ledger.`);
  };

  const handleAddFlightExpense = (flight: any) => {
    const numericPrice = flight.price || 5000;
    addExpense(
      `Flight: ${flight.flights?.[0]?.airline || "Transit Airline"}`,
      "Flights",
      numericPrice * trip.travelers
    );
    alert(`Added flight allocation of Rs ${(numericPrice * trip.travelers).toLocaleString()} to Budget Ledger.`);
  };

  const activeDayActivities = trip.itinerary.find((d) => d.dayNumber === activeDay)?.activities || [];

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 py-6 md:py-10 text-gray-800">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-200 pb-6">
        <div>
          <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-bold bg-indigo-500/5 px-2.5 py-0.5 rounded-full mb-2">
            Trip Active • {trip.days} Days Itinerary
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold font-display text-gray-900">{trip.destination}</h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-pink-500" /> Origin: {trip.originCity}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> Start: {trip.startDate}</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-teal-600" /> {trip.travelers} Pax</span>
          </div>
        </div>

        <ExportButtons trip={trip} />
      </div>

      {/* THREE COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[70vh]">
        
        {/* COLUMN 1: DAY TIMELINE FEED */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-display uppercase tracking-wider text-gray-500">Day Timeline</h2>
            <span className="text-[10px] text-gray-400">Click day tab to focus map</span>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {trip.itinerary.map((day) => {
              const isExpanded = expandedDays[day.dayNumber];
              const isActive = activeDay === day.dayNumber;

              return (
                <div
                  key={day.dayNumber}
                  className={`rounded-2xl border transition-all duration-300 ${
                    isActive 
                      ? "border-indigo-500/30 bg-indigo-50/50" 
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {/* Day Header */}
                  <div
                    onClick={() => {
                      setActiveDay(day.dayNumber);
                      toggleDayExpansion(day.dayNumber);
                    }}
                    className="flex items-center justify-between p-4 cursor-pointer"
                  >
                    <div>
                      <h3 className="text-sm font-bold font-display text-gray-800">
                        Day {day.dayNumber}
                      </h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">{day.theme || "Sightseeing"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddModal(day.dayNumber);
                        }}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-indigo-600"
                        title="Add Activity Stop"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {/* Day Activities Collapsible content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2">
                      {day.activities.length === 0 ? (
                        <div className="text-center py-4 text-[11px] text-gray-400 italic">
                          No activities planned. Click + to add stops.
                        </div>
                      ) : (
                        day.activities.map((act, index) => (
                          <div
                            key={act.id}
                            className="group flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-gray-800 truncate">{act.name}</h4>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEditModal(day.dayNumber, act)}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-800"
                                    title="Edit Stop"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteActivity(day.dayNumber, act.id)}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-pink-600"
                                    title="Delete Stop"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-1 leading-normal">{act.description}</p>
                              {act.time && (
                                <span className="inline-block px-1.5 py-0.5 mt-2 text-[9px] font-bold bg-indigo-500/5 text-pink-600 rounded">
                                  {act.time}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: LEAFLET INTERACTIVE ROUTING MAP */}
        <div className="lg:col-span-4 h-[400px] lg:h-auto min-h-[400px] lg:max-h-[70vh]">
          <Map 
            activities={activeDayActivities} 
            destination={trip.destination} 
            centerCoords={
              activeDayActivities[0]?.lat && activeDayActivities[0]?.lng
                ? { lat: activeDayActivities[0].lat, lng: activeDayActivities[0].lng }
                : null
            }
          />
        </div>

        {/* COLUMN 3: SIDEBAR UTILITIES TABS */}
        <div className="lg:col-span-4 flex flex-col gap-4 max-h-[70vh]">
          {/* Sidebar Tab Header */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-50 border border-gray-250 text-xs font-bold w-full">
            <button
              onClick={() => setActiveSidebarTab("places")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeSidebarTab === "places" ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-800"
              }`}
            >
              Stops
            </button>
            <button
              onClick={() => setActiveSidebarTab("weather")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeSidebarTab === "weather" ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-800"
              }`}
            >
              Weather
            </button>
            <button
              onClick={() => setActiveSidebarTab("deals")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeSidebarTab === "deals" ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-800"
              }`}
            >
              Deals
            </button>
            <button
              onClick={() => setActiveSidebarTab("assistant")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeSidebarTab === "assistant" ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-800"
              }`}
            >
              AI Assistant
            </button>
          </div>

          {/* TAB 1: PLACES */}
          {activeSidebarTab === "places" && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm text-left">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                  Routing Stops Coordinates
                </h3>
                <div className="space-y-2 text-[10px]">
                  {activeDayActivities.map((act, idx) => (
                    <div key={act.id} className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-100">
                      <span className="font-semibold text-gray-700 truncate w-1/2">{idx + 1}. {act.name}</span>
                      <span className="font-mono text-gray-500">
                        {act.lat && act.lng 
                          ? `${act.lat.toFixed(4)}, ${act.lng.toFixed(4)}` 
                          : "Resolving GPS..."}
                      </span>
                    </div>
                  ))}
                  {activeDayActivities.length === 0 && (
                    <div className="text-center py-2 text-gray-400 italic">No stops plotted for Day {activeDay}.</div>
                  )}
                </div>
              </div>

              <div
                onClick={() => router.push(`/budget/${trip.id}`)}
                className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors cursor-pointer text-left shadow-sm"
              >
                <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-indigo-600" /> Smart Budget Ledger
                </h4>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                  View expense allocations, budget alerts, and unlock the SVG category breakdown donuts.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: WEATHER */}
          {activeSidebarTab === "weather" && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm text-left">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4 text-pink-500" />
                  7-Day Forecast Grid
                </h3>

                {loadingWeather ? (
                  <div className="text-center py-4 text-xs text-gray-400 animate-pulse">Fetching forecasts...</div>
                ) : weatherForecast?.forecast?.daily ? (
                  <div className="grid grid-cols-4 gap-2">
                    {weatherForecast.forecast.daily.time.slice(0, 4).map((timeStr: string, idx: number) => {
                      const maxTemp = weatherForecast.forecast.daily.temperature_2m_max[idx];
                      const minTemp = weatherForecast.forecast.daily.temperature_2m_min[idx];
                      const prob = weatherForecast.forecast.daily.precipitation_probability_max[idx];
                      
                      return (
                        <div key={idx} className="p-2 rounded bg-gray-50 text-center border border-gray-200">
                          <span className="text-[8px] text-gray-400 block uppercase font-bold">
                            {new Date(timeStr).toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span className="text-xs font-bold text-gray-800 block mt-1">{Math.round(maxTemp)}°</span>
                          <span className="text-[9px] text-gray-500 block">{Math.round(minTemp)}°</span>
                          {prob > 20 && (
                            <span className="text-[8px] text-indigo-600 block mt-0.5">🌧 {prob}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[10px] text-gray-400">Weather data unavailable offline.</div>
                )}

                {weatherAdvice && (
                  <div className="mt-4 p-3 rounded-lg bg-pink-500/5 border border-pink-500/10 text-[10px] text-gray-600 leading-relaxed">
                    💡 <strong>AI Weather Advice:</strong> {weatherAdvice.best_visiting_hours} Wear {weatherAdvice.clothing_recommendations.toLowerCase()}
                  </div>
                )}
              </div>

              {/* Interactive Packing Checklist */}
              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm text-left">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-teal-600" />
                  Interactive Packing Checklist
                </h3>
                
                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {trip.packingList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => togglePackingItem(item.id)}
                      className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 border border-gray-150 cursor-pointer text-[10px]"
                    >
                      <div className="flex items-center gap-2 w-4/5">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          readOnly
                          className="w-3.5 h-3.5 rounded accent-indigo-600 flex-shrink-0 cursor-pointer"
                        />
                        <span className={`truncate ${item.checked ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {item.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePackingItem(item.id);
                        }}
                        className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-pink-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newPackingText.trim()) return;
                    addPackingItem("Personal", newPackingText.trim());
                    setNewPackingText("");
                  }}
                  className="flex gap-1.5 mt-3"
                >
                  <input
                    type="text"
                    value={newPackingText}
                    onChange={(e) => setNewPackingText(e.target.value)}
                    placeholder="Add item..."
                    className="flex-1 glass-input px-3 py-1.5 rounded-lg text-[10px] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 rounded-lg bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center hover:bg-teal-500 transition-colors"
                  >
                    Add
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* TAB 3: DEALS */}
          {activeSidebarTab === "deals" && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
              
              {/* Hotel booking cards */}
              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Hotel className="w-4 h-4 text-indigo-600" />
                    Boutique Hotel Deals
                  </h3>
                  <button
                    onClick={() => setDealSorting(dealSorting === "price" ? "rating" : "price")}
                    className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-indigo-600 font-bold"
                  >
                    <ArrowUpDown className="w-3 h-3" /> Sort: {dealSorting}
                  </button>
                </div>

                {loadingDeals ? (
                  <div className="text-center py-4 text-xs text-gray-400 animate-pulse">Checking local rates...</div>
                ) : (
                  <div className="space-y-3">
                    {[...hotelDeals]
                      .sort((a, b) => {
                        if (dealSorting === "price") {
                          const ap = parseInt(a.rate_per_night?.lowest?.replace(/[^0-9]/g, "")) || 0;
                          const bp = parseInt(b.rate_per_night?.lowest?.replace(/[^0-9]/g, "")) || 0;
                          return ap - bp;
                        } else {
                          return (b.overall_rating || 0) - (a.overall_rating || 0);
                        }
                      })
                      .slice(0, 3)
                      .map((hotel, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-gray-150 bg-gray-50 flex items-center gap-3">
                          <ImageWithFallback
                            src={hotel.images?.[0]?.thumbnail || ""}
                            alt={hotel.name}
                            width={48}
                            height={48}
                            fallbackText={hotel.name}
                            containerClassName="w-12 h-12 rounded-lg border border-gray-200"
                            className="w-full h-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[11px] font-bold text-gray-800 truncate">{hotel.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-gray-500">⭐ {hotel.overall_rating || "4.5"}</span>
                              <span className="text-[10px] font-extrabold text-pink-600">{hotel.rate_per_night?.lowest || "₹3,500"}</span>
                            </div>
                            <button
                              onClick={() => handleAddHotelExpense(hotel)}
                              className="mt-1.5 text-[8px] font-extrabold text-indigo-600 hover:text-indigo-500 flex items-center gap-0.5"
                            >
                              <PlusCircle className="w-2.5 h-2.5" /> Allocate Stay to budget
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Transit Flight booking cards */}
              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-pink-500" />
                  Flight Connections
                </h3>

                {loadingDeals ? (
                  <div className="text-center py-4 text-xs text-gray-400 animate-pulse">Querying flights...</div>
                ) : (
                  <div className="space-y-3">
                    {flightDeals.slice(0, 3).map((flight, idx) => {
                      const details = flight.flights?.[0] || {};
                      
                      return (
                        <div key={idx} className="p-3 rounded-xl border border-gray-150 bg-gray-50 flex items-center justify-between">
                          <div>
                            <h4 className="text-[11px] font-bold text-gray-800">{details.airline || "Saver Airline"}</h4>
                            <p className="text-[9px] text-gray-500 mt-0.5">
                              {details.departure_airport?.time || "10:00"} → {details.arrival_airport?.time || "12:30"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold text-indigo-600 block">₹{flight.price?.toLocaleString() || "5,500"}</span>
                            <button
                              onClick={() => handleAddFlightExpense(flight)}
                              className="text-[8px] font-extrabold text-pink-500 hover:text-pink-400 flex items-center gap-0.5 mt-1 justify-end ml-auto"
                            >
                              <PlusCircle className="w-2.5 h-2.5" /> Book Flight
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {flightDeals.length === 0 && (
                      <div className="text-center py-2 text-[10px] text-gray-400">No flights listed. Adjust departure parameters in settings.</div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: AI COMPANION */}
          {activeSidebarTab === "assistant" && (
            <div className="flex-1 flex flex-col min-h-0">
              <AIChatAssistant 
                destination={trip.destination} 
                startDate={trip.startDate} 
                travelers={trip.travelers} 
              />
            </div>
          )}

        </div>

      </div>

      {/* --- ADD STOP MODAL --- */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-gray-950/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-2xl glass-panel border-gray-200 bg-white p-6 shadow-xl flex flex-col gap-4 text-left"
            >
              <div>
                <h3 className="text-base font-bold font-display text-gray-900">Add Stop for Day {targetDay}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Enter a landmark or cafe name. Coordinates will auto-resolve.</p>
              </div>

              <form onSubmit={handleSaveAddStop} className="space-y-3.5">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Place Name</label>
                  <input
                    type="text"
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                    placeholder="Gateway of India, Starbucks..."
                    required
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Schedule Block</label>
                  <select
                    value={stopTime}
                    onChange={(e) => setStopTime(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none"
                  >
                    <option value="Morning" className="bg-white text-gray-900">Morning (9am - 12pm)</option>
                    <option value="Afternoon" className="bg-white text-gray-900">Afternoon (2pm - 5pm)</option>
                    <option value="Evening" className="bg-white text-gray-900">Evening (7pm - 10pm)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Description</label>
                  <textarea
                    value={stopDesc}
                    onChange={(e) => setStopDesc(e.target.value)}
                    placeholder="Activities to do..."
                    rows={3}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                  />
                </div>
                
                <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 text-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  >
                    Add Stop
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EDIT STOP MODAL --- */}
      <AnimatePresence>
        {showEditModal && selectedActivity && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-gray-950/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-2xl glass-panel border-gray-200 bg-white p-6 shadow-xl flex flex-col gap-4 text-left"
            >
              <div>
                <h3 className="text-base font-bold font-display text-gray-900">Edit Stop</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Edit stop detail. Adjusting title trigger coordinates update.</p>
              </div>

              <form onSubmit={handleSaveEditStop} className="space-y-3.5">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Place Name</label>
                  <input
                    type="text"
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                    required
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Schedule Block</label>
                  <select
                    value={stopTime}
                    onChange={(e) => setStopTime(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none"
                  >
                    <option value="Morning" className="bg-white text-gray-900">Morning (9am - 12pm)</option>
                    <option value="Afternoon" className="bg-white text-gray-900">Afternoon (2pm - 5pm)</option>
                    <option value="Evening" className="bg-white text-gray-900">Evening (7pm - 10pm)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Description</label>
                  <textarea
                    value={stopDesc}
                    onChange={(e) => setStopDesc(e.target.value)}
                    rows={3}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                
                <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 text-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
