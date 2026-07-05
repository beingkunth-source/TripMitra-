"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Printer, Calendar, Share2, Globe, BookOpen, Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Trip } from "@/lib/store";

interface ExportButtonsProps {
  trip: Trip;
  onTimelineClick?: () => void;
  onRemindersClick?: () => void;
}

export default function ExportButtons({ trip, onTimelineClick, onRemindersClick }: ExportButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrintPDF = () => {
    window.print();
    setMenuOpen(false);
  };

  const handleExportICS = () => {
    if (!trip.startDate) return;
    try {
      const baseDate = new Date(trip.startDate);
      if (isNaN(baseDate.getTime())) throw new Error("Invalid start date");

      let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TripMitra//NONSGML Travel Itinerary//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      trip.itinerary.forEach((day) => {
        const eventDate = new Date(baseDate);
        eventDate.setDate(baseDate.getDate() + (day.dayNumber - 1));
        const dateStr = eventDate.toISOString().slice(0, 10).replace(/-/g, "");

        day.activities.forEach((act, idx) => {
          let startHour = 9 + idx;
          if (act.time === "Afternoon") startHour = 14;
          else if (act.time === "Evening") startHour = 19;
          const endHour = startHour + 2;
          const pad = (n: number) => String(n).padStart(2, "0");
          const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

          icsContent.push(
            "BEGIN:VEVENT",
            `UID:trip-${trip.id}-day-${day.dayNumber}-act-${act.id}@tripmitra.com`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART:${dateStr}T${pad(startHour)}0000Z`,
            `DTEND:${dateStr}T${pad(endHour)}0000Z`,
            `SUMMARY:${act.name.replace(/[,;]/g, "\\$&")}`,
            `DESCRIPTION:${act.description.replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n")}`,
            `LOCATION:${trip.destination.replace(/[,;]/g, "\\$&")}`,
            "END:VEVENT"
          );
        });
      });

      icsContent.push("END:VCALENDAR");
      const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `itinerary_${trip.destination.toLowerCase().replace(/\s+/g, "_")}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("ICS export failed", err);
      alert("Could not export calendar, check the start date.");
    }
    setMenuOpen(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const menuItems = [
    { label: "Share Trip",       icon: Share2,   action: handleShare,                                         colour: "text-teal-600"   },
    { label: "Print / PDF",      icon: Printer,  action: handlePrintPDF,                                      colour: "text-indigo-600" },
    { label: "Add to Calendar",  icon: Calendar, action: handleExportICS,                                     colour: "text-pink-600"   },
    { label: "Timeline",         icon: BookOpen, action: () => { onTimelineClick?.();  setMenuOpen(false); }, colour: "text-amber-600"  },
    { label: "Reminders",        icon: Bell,     action: () => { onRemindersClick?.(); setMenuOpen(false); }, colour: "text-emerald-600"},
  ];

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      {/* Trigger button — strict square so the icon always centres */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-full glass-btn shadow-sm shrink-0"
        title="More options"
      >
        <motion.div
          animate={{ rotate: menuOpen ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="flex items-center justify-center"
        >
          <MoreVertical className="w-4 h-4 text-gray-700" />
        </motion.div>
      </button>

      {/* Dropdown — anchored to top-full so it tracks the button regardless of parent row height */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full mt-2 w-48 rounded-2xl glass-panel border border-gray-200 bg-white shadow-xl overflow-hidden z-50"
          >
            {menuItems.map((item, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={item.action}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                {item.label === "Share Trip" && copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${item.colour}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
