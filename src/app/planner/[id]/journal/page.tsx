"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Sparkles, Star, Heart, Clock, Edit3, Camera, Upload, Trash2, X 
} from "lucide-react";
import { useActiveTrip, TripActivity } from "@/lib/store";
import TripHeader from "@/components/TripHeader";
import ImageWithFallback from "@/components/ImageWithFallback";
import { motion, AnimatePresence } from "framer-motion";

export default function TripJournalPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const { trip, editActivity } = useActiveTrip(tripId);
  const [isInternational, setIsInternational] = useState<boolean | null>(null);

  // Editing state
  const [editingStop, setEditingStop] = useState<{
    id: string;
    dayNumber: number;
    name: string;
    description: string;
    imageUrl: string;
    rating: number;
    notes: string;
  } | null>(null);

  const [ratingHover, setRatingHover] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // Run border check
  useEffect(() => {
    if (!trip?.destination) return;
    const checkBorder = async () => {
      try {
        const res = await fetch("/api/check-border", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: trip.originCity || "Mumbai",
            destination: trip.destination
          })
        });
        if (res.ok) {
          const data = await res.json();
          setIsInternational(data.isInternational);
        }
      } catch (err) {
        console.error("Failed to check border:", err);
      }
    };
    checkBorder();
  }, [trip?.destination, trip?.originCity]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-[#FAF8F5]">
        Finding your scrapbook archives...
      </div>
    );
  }

  // Gather all activities across all days
  const allStops = trip.itinerary.flatMap(day => 
    day.activities.map(act => ({
      ...act,
      dayNumber: day.dayNumber
    }))
  );

  const handleStartEdit = (stop: any) => {
    setEditingStop({
      id: stop.id,
      dayNumber: stop.dayNumber,
      name: stop.name,
      description: stop.description || "",
      imageUrl: stop.imageUrl || "",
      rating: stop.rating || 0,
      notes: stop.notes || ""
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 2MB to keep base64 reasonable for localStorage/DB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Please upload an image smaller than 2MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string" && editingStop) {
        setEditingStop({
          ...editingStop,
          imageUrl: reader.result
        });
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMemory = async () => {
    if (!editingStop) return;

    await editActivity(editingStop.dayNumber, editingStop.id, {
      imageUrl: editingStop.imageUrl,
      rating: editingStop.rating,
      notes: editingStop.notes
    });

    setEditingStop(null);
  };

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 pt-20 pb-6 md:pt-32 md:pb-10 text-gray-800 bg-[#FAF8F5]">
      
      {/* HEADER */}
      <TripHeader trip={trip} isInternational={isInternational} />

      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push(`/planner/${trip.id}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-gray-250/60 hover:bg-gray-50 text-gray-700 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-650" />
          Back to Timeline Editor
        </button>

        <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-700 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Scrapbook Mode Active</span>
        </div>
      </div>

      {allStops.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-dashed border-gray-200 bg-white/70 shadow-sm p-6 max-w-2xl mx-auto">
          <Heart className="w-10 h-10 text-pink-500/30 mx-auto mb-4 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800 mb-1">Your Journal is Empty</h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            You haven't added any stops or activities to this trip yet. Go back to the planner timeline to design your journey!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allStops.map((stop, index) => (
            <div 
              key={stop.id || index}
              className="group bg-white border border-gray-200/60 rounded-card-ds shadow-card-ds p-5 flex flex-col gap-4 text-left transition-all hover:shadow-elevated-ds hover:-translate-y-1 duration-300 relative"
            >
              {/* Edit overlay button */}
              <button
                onClick={() => handleStartEdit(stop)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-teal-650 hover:text-white rounded-xl border border-gray-200/80 shadow-md text-gray-600 transition-all flex items-center gap-1 text-[10px] font-bold opacity-80 group-hover:opacity-100"
                title="Edit Memory Log"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Log Memory</span>
              </button>

              {/* Photo Area */}
              <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-150 shadow-inner bg-gray-50">
                <ImageWithFallback
                  src={stop.imageUrl || ""}
                  alt={stop.name}
                  fill
                  className="object-cover"
                  fallbackText={stop.name}
                />
                <span className="absolute top-3 left-3 text-[10px] font-extrabold text-white bg-indigo-600/90 px-2.5 py-0.75 rounded-full shadow-md">
                  Day {stop.dayNumber}
                </span>
                {stop.time && (
                  <span className="absolute top-3 right-16 text-[10px] font-extrabold text-teal-850 bg-teal-50/95 border border-teal-500/20 px-2.5 py-0.75 rounded-full shadow-md flex items-center gap-1">
                    <Clock className="w-3 h-3 text-teal-650" />
                    {stop.time}
                  </span>
                )}
              </div>

              {/* Title & Desc */}
              <div>
                <h3 className="text-base font-bold text-gray-900 line-clamp-1">{stop.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{stop.description || "No description provided."}</p>
              </div>

              {/* Memory Stars */}
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Memory Rating</span>
                <div className="flex gap-0.5 mt-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star}
                      className={`w-4 h-4 ${star <= (stop.rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-200"}`}
                    />
                  ))}
                  {(stop.rating || 0) === 0 && (
                    <span className="text-[9px] text-gray-400 font-semibold italic ml-1.5 self-center">Not rated yet</span>
                  )}
                </div>
              </div>

              {/* Travel Memo Notes */}
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-3 flex-grow">
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Travel Memo</span>
                <div className="p-3 rounded-xl bg-amber-50/10 border border-amber-100/20 text-xs italic text-gray-700 leading-relaxed min-h-[60px]">
                  {stop.notes || (
                    <button 
                      onClick={() => handleStartEdit(stop)}
                      className="text-teal-600 hover:text-teal-700 hover:underline font-bold text-left block w-full h-full cursor-pointer focus:outline-none"
                    >
                      + Capture thoughts/memoir note...
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MEMORY EDITOR MODAL / SHEET --- */}
      <AnimatePresence>
        {editingStop && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingStop(null)}
              className="absolute inset-0 bg-gray-950/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-md rounded-2xl glass-panel border-gray-200 bg-white p-6 shadow-xl flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold font-display text-gray-900">Log Memory stop</h3>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{editingStop.name}</p>
                </div>
                <button
                  onClick={() => setEditingStop(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Upload Area */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Stop Photo</span>
                
                {editingStop.imageUrl ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
                    <img 
                      src={editingStop.imageUrl} 
                      alt="Stop Photo Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingStop({ ...editingStop, imageUrl: "" })}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-40 rounded-xl border-2 border-dashed border-gray-200 hover:border-teal-500/50 bg-gray-50/50 hover:bg-teal-50/10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                    <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-650">
                      {isUploading ? (
                        <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-gray-700 block">Attach visit photo</span>
                      <span className="text-[9px] text-gray-400 mt-0.5 block">Drag & drop or browse (Max 2MB)</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>

              {/* Interactive Star Rating */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Rate this Memory</span>
                <div className="flex gap-1.5 items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditingStop({ ...editingStop, rating: star })}
                      onMouseEnter={() => setRatingHover(star)}
                      onMouseLeave={() => setRatingHover(0)}
                      className="p-0.5 rounded focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star 
                        className={`w-6 h-6 transition-colors ${
                          star <= (ratingHover || editingStop.rating) 
                            ? "text-amber-500 fill-amber-500" 
                            : "text-gray-200"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-gray-500 ml-2">
                    {
                      {
                        0: "Not rated",
                        1: "Disappointing 😞",
                        2: "Okayish 😐",
                        3: "Good stop 🙂",
                        4: "Amazing! 😍",
                        5: "Unforgettable! 🌟"
                      }[ratingHover || editingStop.rating]
                    }
                  </span>
                </div>
              </div>

              {/* Memoir Text Note */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Travel Memoir Notes</label>
                <textarea
                  value={editingStop.notes}
                  onChange={(e) => setEditingStop({ ...editingStop, notes: e.target.value })}
                  placeholder="Record your thoughts, highlights, funny memories, or notes from visiting this stop..."
                  rows={4}
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs placeholder-gray-450 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2.5 mt-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingStop(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveMemory}
                  className="flex-grow py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                >
                  Save Memoir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
