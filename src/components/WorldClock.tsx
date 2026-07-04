"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface ClockItem {
  city: string;
  timeZone: string;
}

const CLOCK_ZONES: ClockItem[] = [
  { city: "Local Time", timeZone: "Asia/Kolkata" },
  { city: "London", timeZone: "Europe/London" },
  { city: "New York", timeZone: "America/New_York" },
  { city: "Tokyo", timeZone: "Asia/Tokyo" },
  { city: "Dubai", timeZone: "Asia/Dubai" },
];

export default function WorldClock() {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    function updateClocks() {
      const now = new Date();
      const updated: Record<string, string> = {};
      CLOCK_ZONES.forEach((zone) => {
        try {
          updated[zone.city] = new Intl.DateTimeFormat("en-US", {
            timeZone: zone.timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(now);
        } catch {
          updated[zone.city] = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
      });
      setTimes(updated);
    }

    updateClocks();
    // Minute-level updates — seconds are unnecessary precision for a travel app
    // and caused a re-render storm every second.
    const interval = setInterval(updateClocks, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white shadow-sm flex flex-col gap-4 text-left">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
          <Clock className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700">World Clock</h3>
      </div>

      <div className="space-y-2">
        {CLOCK_ZONES.map((zone) => (
          <div
            key={zone.city}
            className={`flex justify-between items-center px-3 py-2 rounded-xl border border-gray-150 transition-colors duration-200 ${
              zone.city === "Local Time" ? "bg-indigo-500/5 border-indigo-500/20" : "bg-gray-50"
            }`}
          >
            <span className={`text-xs font-medium ${zone.city === "Local Time" ? "text-indigo-700 font-semibold" : "text-gray-500"}`}>
              {zone.city}
            </span>
            <span className="text-xs font-bold font-mono tracking-tight text-gray-750 tabular-nums text-gray-700">
              {times[zone.city] || "--:--:--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
