"use client";

import React from "react";
import { Printer, Calendar, Share2, Check } from "lucide-react";
import { Trip, TripDay, TripActivity } from "@/types/trip";

export default function ExportButtons({ trip }: { trip: Trip }) {
  const [copied, setCopied] = React.useState(false);

  // 1. PDF Printer Exporter
  const handlePrintPDF = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  // 2. ICS Calendar Builder (RFC 5545)
  const handleExportICS = () => {
    if (typeof window === "undefined" || !trip.startDate) return;

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

      trip.itinerary.forEach((day: TripDay) => {
        const dayOffset = day.dayNumber - 1;
        const eventDate = new Date(baseDate);
        eventDate.setDate(baseDate.getDate() + dayOffset);

        const dateStr = eventDate.toISOString().slice(0, 10).replace(/-/g, "");

        day.activities.forEach((act: TripActivity, idx: number) => {
          // Approximate start/end times based on time-of-day category
          let startHour = 10;
          let endHour = 12;

          if (act.time === "Afternoon") {
            startHour = 14;
            endHour = 16;
          } else if (act.time === "Evening") {
            startHour = 19;
            endHour = 21;
          } else {
            // Default offsets if multiple morning items
            startHour = 9 + idx;
            endHour = startHour + 1;
          }

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

      // Create download blob
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
  };

  // 3. Shareable URL copy
  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Print PDF */}
      <button
        onClick={handlePrintPDF}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold glass-btn shadow-sm"
      >
        <Printer className="w-3.5 h-3.5 text-indigo-600" />
        <span>Print / PDF</span>
      </button>

      {/* Export Calendar */}
      <button
        onClick={handleExportICS}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold glass-btn shadow-sm"
      >
        <Calendar className="w-3.5 h-3.5 text-pink-600" />
        <span>Add to Calendar</span>
      </button>

      {/* Share Trip */}
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold glass-btn shadow-sm"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
            <span className="text-emerald-600">Copied!</span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Share Trip</span>
          </>
        )}
      </button>
    </div>
  );
}
