"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Printer, Calendar, Share2, Globe, BookOpen, Bell, Check } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Trip, TripDay, TripActivity } from "@/types/trip";

interface ExportButtonsProps {
  trip: Trip;
  onTimelineClick: () => void;
  onRemindersClick: () => void;
}

export default function ExportButtons({ trip, onTimelineClick, onRemindersClick }: ExportButtonsProps) {
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
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

  const handleShareEdit = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Edit Plan: ${trip.destination}`, url });
      } catch (err) {
        copyToClipboard(url, setCopiedEdit);
      }
    } else {
      copyToClipboard(url, setCopiedEdit);
    }
  };

  const handleSharePublic = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/share/${trip.id}`;
    copyToClipboard(url, setCopiedPublic);
  };

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  const menuItems = [
    { label: "Share Edit Link", icon: Share2, action: handleShareEdit, colour: "text-teal-650", tooltip: "Share edit link with write access", isCopied: copiedEdit },
    { label: "Public Preview Link", icon: Globe, action: handleSharePublic, colour: "text-slate-600", tooltip: "Copy read-only link for sharing", isCopied: copiedPublic },
    { label: "Print / PDF", icon: Printer, action: handlePrintPDF, colour: "text-indigo-600", tooltip: "Print or export as PDF" },
    { label: "Add to Calendar", icon: Calendar, action: handleExportICS, colour: "text-pink-600", tooltip: "Export as calendar .ics file" },
    { label: "Timeline", icon: BookOpen, action: () => { onTimelineClick(); setMenuOpen(false); }, colour: "text-amber-600", tooltip: "Show scrollable visual timeline" },
    { label: "Reminders", icon: Bell, action: () => { onRemindersClick(); setMenuOpen(false); }, colour: "text-emerald-600", tooltip: "Manage activity reminders" },
  ];

  const dropdownVariants: Variants = {
    closed: {
      opacity: 0,
      scale: 0.95,
      y: -10,
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1
      }
    },
    open: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 380,
        damping: 30,
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, x: -8 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="group relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2.5 rounded-xl glass-btn shadow-sm flex items-center justify-center transition-all hover:bg-slate-50"
          aria-label="More options"
        >
          <motion.div
            animate={{ rotate: menuOpen ? 15 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <MoreVertical className="w-4 h-4 text-gray-700" />
          </motion.div>
        </button>
        <span className="absolute right-0 bottom-full mb-2 hidden group-hover:inline-block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap z-50 pointer-events-none">
          More Options
        </span>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="absolute right-0 top-12 w-52 rounded-2xl glass-panel border border-gray-250/30 bg-white/95 shadow-xl overflow-hidden z-50"
          >
            {menuItems.map((item, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <button
                  onClick={item.action}
                  className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left group/item relative"
                >
                  <div className="flex items-center gap-2.5">
                    {item.isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <item.icon className={`w-3.5 h-3.5 ${item.colour}`} />
                    )}
                    <span className={item.isCopied ? "text-emerald-600" : ""}>
                      {item.isCopied ? "Copied!" : item.label}
                    </span>
                  </div>

                  {item.tooltip && (
                    <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/item:inline-block bg-gray-900 text-white text-[9px] px-2 py-1 rounded shadow-md whitespace-nowrap z-50 pointer-events-none">
                      {item.tooltip}
                    </span>
                  )}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
