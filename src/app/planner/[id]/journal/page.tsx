"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Star, Heart, MapPin, Calendar, Clock } from "lucide-react";
import { useActiveTrip, TripActivity } from "@/lib/store";
import TripHeader from "@/components/TripHeader";
import ImageWithFallback from "@/components/ImageWithFallback";

export default function TripJournalPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const { trip } = useActiveTrip(tripId);
  const [isInternational, setIsInternational] = useState<boolean | null>(null);

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
              className="bg-white border border-gray-200/60 rounded-card-ds shadow-card-ds p-5 flex flex-col gap-4 text-left transition-all hover:shadow-elevated-ds hover:-translate-y-1 duration-300"
            >
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
                  <span className="absolute top-3 right-3 text-[10px] font-extrabold text-teal-850 bg-teal-50/95 border border-teal-500/20 px-2.5 py-0.75 rounded-full shadow-md flex items-center gap-1">
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
                      className={`w-4 h-4 ${star <= (stop.rating || 0) ? "text-amber-500 fill-amber-500 animate-pulse" : "text-gray-200"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Travel Memo Notes */}
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-3 flex-grow">
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Travel Memo</span>
                <div className="p-3 rounded-xl bg-amber-50/20 border border-amber-100/40 text-xs italic text-gray-700 leading-relaxed min-h-[60px]">
                  {stop.notes || "No notes written down yet for this stop. Write one in Journal/Scrapbook Mode on the main timeline!"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
