"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Printer, Calendar, Share2, Globe, BookOpen, Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Trip, TripDay, TripActivity } from "@/types/trip";

export default function ExportButtons({ trip }: { trip: Trip }) {
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
    if (typeof window === "undefined") return;
    window.print();
    setMenuOpen(false);
  };

  const handleExportICS = () => {
    if (typeof window === "undefined" || !trip.startDate) return;
    try {
      const baseDate = new Date(trip.startDate);
      if (isNaN(baseDate.getTime())) throw new Error("Invalid start date");

      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TripMitra//NONSGML Travel Itinerary//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      trip.itinerary.forEach((day: TripDay) => {
        const dayOffset = day.dayNumber - 1;
        const eventDate = new Date(baseDate);
        eventDate.setDate(baseDate.getDate() + dayOffset);
        const dateStr = eventDate.toISOString().slice(0, 10).replace(/-/g, "");

        day.activities.forEach((act: TripActivity, idx: number) => {
          let startHour = 10;
          let endHour = 12;
          if (act.time === "Afternoon") { startHour = 14; endHour = 16; }
          else if (act.time === "Evening") { startHour = 19; endHour = 21; }
          else { startHour = 9 + idx; endHour = startHour + 1; }

          const pad = (num: number) => String(num).padStart(2, "0");
          const dtStart = `${dateStr}T${pad(startHour)}0000Z`;
          const dtEnd = `${dateStr}T${pad(endHour)}0000Z`;
          const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
          const uid = `trip-${trip.id}-day-${day.dayNumber}-act-${act.id}@tripmitra.com`;

          icsContent.push("BEGIN:VEVENT");
          icsContent.push(`UID:${uid}`);
          icsContent.push(`DTSTAMP:${dtStamp}`);
          icsContent.push(`DTSTART:${dtStart}`);
          icsContent.push(`DTEND:${dtEnd}`);
          icsContent.push(`SUMMARY:${act.name.replace(/[,;]/g, "\\$&")}`);
          icsContent.push(`DESCRIPTION:${act.description.replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n")}`);
          icsContent.push(`LOCATION:${trip.destination.replace(/[,;]/g, "\\$&")}`);
          icsContent.push("END:VEVENT");
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
      console.error("Failed to generate ICS calendar file", err);
      alert("Could not export calendar: Please check the start date format.");
    }
    setMenuOpen(false);
  };

  const handleShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const menuItems = [
    { label: "Share Trip", icon: Share2, action: handleShare, colour: "text-teal-600" },
    { label: "Print / PDF", icon: Printer, action: handlePrintPDF, colour: "text-indigo-600" },
    { label: "Add to Calendar", icon: Calendar, action: handleExportICS, colour: "text-pink-600" },
    { label: "Timeline", icon: BookOpen, action: () => setMenuOpen(false), colour: "text-amber-600" },
    { label: "Reminders", icon: Bell, action: () => setMenuOpen(false), colour: "text-emerald-600" },
    { label: "Share", icon: Globe, action: handleShare, colour: "text-slate-600" },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-2.5 rounded-xl glass-btn shadow-sm"
        title="More options"
      >
        <MoreVertical className="w-4 h-4 text-gray-700" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute right-0 top-12 w-48 rounded-2xl glass-panel border border-gray-200/60 bg-white shadow-xl overflow-hidden z-50"
          >
            {menuItems.map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                {item.label === "Share Trip" && copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <item.icon className={`w-3.5 h-3.5 ${item.colour}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
