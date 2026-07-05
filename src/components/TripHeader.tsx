"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  MapPin, Calendar, Users, Globe, BookOpen, AlertCircle, ShieldAlert,
  Plus, Link2, UserPlus, Copy, Check, Bell, BellOff, X 
} from "lucide-react";
import { Trip, updateTripRecord } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import ExportButtons from "./ExportButtons";
import { motion, AnimatePresence } from "framer-motion";

interface TripHeaderProps {
  trip: Trip;
  isInternational: boolean | null;
}

export default function TripHeader({ trip, isInternational }: TripHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isJournalPage = pathname?.endsWith("/journal");

  // Manage custom co-traveler names
  const [showTravellersModal, setShowTravellersModal] = useState(false);
  const [namesInput, setNamesInput] = useState<string[]>([]);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTab, setInviteTab] = useState<"link" | "name">("link");
  const [newCollabName, setNewCollabName] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>("default");

  const getTravellerNames = (t: Trip) => {
    if (t.travellerNames && t.travellerNames.length > 0) {
      return t.travellerNames;
    }
    const names = ["You"];
    for (let i = 2; i <= t.travelers; i++) {
      names.push(`Traveler ${i}`);
    }
    return names;
  };

  useEffect(() => {
    setNamesInput(getTravellerNames(trip));
  }, [trip.travellerNames, trip.travelers]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleSharePlan = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/share/${trip.id}`;
    navigator.clipboard.writeText(url);
    alert(`Shareable read-only preview link copied to clipboard:\n${url}`);
  };

  const handleCopyInviteLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/share/${trip.id}?invite=1`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddCollabByName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabName.trim()) return;

    const updatedNames = [...namesInput, newCollabName.trim()];
    setNamesInput(updatedNames);
    
    await updateTripRecord({
      ...trip,
      travelers: updatedNames.length,
      travellerNames: updatedNames
    });

    setNewCollabName("");
    alert(`${newCollabName.trim()} added to the collaborator list!`);
  };

  const handleJournalToggle = () => {
    if (isJournalPage) {
      router.push(`/planner/${trip.id}`);
    } else {
      router.push(`/planner/${trip.id}/journal`);
    }
  };

  return (
    <div className="flex flex-col gap-4 mb-8 border-b border-gray-200/60 pb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left Side Metadata Panel */}
        <div className="flex-1 p-5 rounded-2xl glass-panel border border-gray-250/30 bg-white/70 shadow-sm text-left">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-indigo-700 font-extrabold bg-indigo-500/10 px-2.5 py-0.75 rounded-full">
              Trip Active • {trip.days} Days Itinerary
            </span>
            {isInternational !== null && (
              isInternational ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-700 font-extrabold bg-rose-500/10 px-2.5 py-0.75 rounded-full border border-rose-500/20">
                  ✈️ International • Visa Required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 font-extrabold bg-emerald-500/10 px-2.5 py-0.75 rounded-full border border-emerald-500/20">
                  🚗 Domestic Trip
                </span>
              )
            )}
          </div>
          <h1 className="text-2xl md:text-3.5xl font-black font-display text-gray-900 tracking-tight leading-none mb-2">
            {trip.destination}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500 mt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-pink-500" /> Origin: {trip.originCity || "Mumbai"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Start: {trip.startDate || "TBD"}
            </span>
            <button
              type="button"
              onClick={() => setShowTravellersModal(true)}
              className="flex items-center gap-1.5 hover:bg-gray-150/80 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors cursor-pointer text-left focus:outline-none"
              title="Edit Traveler Names"
            >
              <Users className="w-4 h-4 text-teal-600" />
              <span>{trip.travelers} Traveler(s)</span>
              <span className="text-[9px] text-indigo-600 dark:text-teal-400 font-bold hover:underline ml-1">(Edit)</span>
            </button>
          </div>
        </div>

        {/* Right Side Control Center */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-4 self-stretch lg:self-auto">
          
          {/* Collaborator Avatars Row */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl border border-gray-200 bg-gray-50/50 shadow-sm min-w-[240px] text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-gray-450 uppercase tracking-widest">
                Collaborators
              </span>
              <span className="text-[9px] text-gray-450 font-bold bg-white px-2 py-0.5 rounded-full shadow-xs border border-gray-150">
                {namesInput.length} Active
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {namesInput.map((name, idx) => {
                const colorClass = [
                  "bg-teal-500/10 border-teal-500/25 text-teal-700",
                  "bg-indigo-500/10 border-indigo-500/25 text-indigo-700",
                  "bg-pink-500/10 border-pink-500/25 text-pink-700",
                  "bg-amber-500/10 border-amber-500/25 text-amber-700",
                  "bg-purple-500/10 border-purple-500/25 text-purple-700",
                  "bg-emerald-500/10 border-emerald-500/25 text-emerald-700"
                ][idx % 6];

                return (
                  <div 
                    key={idx} 
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black shadow-sm ${colorClass}`}
                    title={name}
                  >
                    {name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="w-8 h-8 rounded-full border border-dashed border-gray-300 hover:border-teal-500 bg-white hover:bg-teal-50/20 text-gray-450 hover:text-teal-650 flex items-center justify-center transition-colors cursor-pointer focus:outline-none"
                title="Invite Collaborator"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Action Button Grid */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleSharePlan}
                className="flex items-center justify-center gap-1 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 font-extrabold text-[11px] px-3.5 py-2.5 rounded-full shadow-sm transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={handleJournalToggle}
                className={`flex items-center justify-center gap-1 border font-extrabold text-[11px] px-3.5 py-2.5 rounded-full shadow-sm transition-all ${
                  isJournalPage
                    ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isJournalPage ? "Journal" : "Timeline"}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const { requestAndSchedule } = await import("@/lib/notificationScheduler");
                  await requestAndSchedule(trip);
                  if (typeof window !== "undefined" && "Notification" in window) {
                    setNotifPermission(Notification.permission);
                  }
                }}
                className="flex items-center justify-center gap-1 bg-white border border-gray-200 hover:bg-gray-50 text-indigo-700 font-extrabold text-[11px] px-3.5 py-2.5 rounded-full shadow-sm transition-colors"
              >
                {notifPermission === "granted" ? (
                  <Bell className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-gray-400" />
                )}
                <span>Reminders</span>
              </button>
            </div>

            <ExportButtons trip={trip} />
          </div>

        </div>
      </div>

      {/* --- MANAGE TRAVELERS MODAL --- */}
      <AnimatePresence>
        {showTravellersModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTravellersModal(false)}
              className="absolute inset-0 bg-gray-950/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-2xl glass-panel border-gray-200 bg-white p-6 shadow-xl flex flex-col gap-4 text-left"
            >
              <div>
                <h3 className="text-base font-bold font-display text-gray-900">Edit Traveler Names</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 font-semibold">Input names of all travelers. These names will be used for logging splits on the budget page.</p>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {Array.from({ length: trip.travelers }).map((_, i) => (
                  <div key={i}>
                    <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Traveler {i + 1} Name</label>
                    <input
                      type="text"
                      value={namesInput[i] || ""}
                      onChange={(e) => {
                        const next = [...namesInput];
                        next[i] = e.target.value;
                        setNamesInput(next);
                      }}
                      placeholder={i === 0 ? "You" : `Traveler ${i + 1}`}
                      className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowTravellersModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const finalNames = Array.from({ length: trip.travelers }).map((_, i) => {
                      return namesInput[i]?.trim() || (i === 0 ? "You" : `Traveler ${i + 1}`);
                    });
                    await updateTripRecord({
                      ...trip,
                      travellerNames: finalNames
                    });
                    setShowTravellersModal(false);
                  }}
                  className="flex-grow py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                >
                  Save Names
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- INVITE COLLABORATOR MODAL --- */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-gray-950/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm rounded-2xl glass-panel border-gray-200 bg-white p-6 shadow-xl flex flex-col gap-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold font-display text-gray-900">Invite Collaborators</h3>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Bring co-travelers into your active workspace</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-0.5 rounded-xl bg-gray-100 border border-gray-200 text-xs font-bold w-full">
                <button
                  type="button"
                  onClick={() => setInviteTab("link")}
                  className={`flex-1 py-2 rounded-lg text-center transition-all uppercase tracking-wider text-[9px] ${
                    inviteTab === "link" ? "bg-white text-teal-700 shadow-sm" : "text-gray-400"
                  }`}
                >
                  Shareable Link
                </button>
                <button
                  type="button"
                  onClick={() => setInviteTab("name")}
                  className={`flex-1 py-2 rounded-lg text-center transition-all uppercase tracking-wider text-[9px] ${
                    inviteTab === "name" ? "bg-white text-teal-700 shadow-sm" : "text-gray-400"
                  }`}
                >
                  Add by Name
                </button>
              </div>

              {inviteTab === "link" ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                    Copy the invitation link below and share it with your friends. When they join, they will be registered as trip collaborators.
                  </p>
                  
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/share/${trip.id}?invite=1` : ""}
                      className="flex-grow glass-input px-3 py-2.5 rounded-xl text-xs select-all bg-gray-50/50 cursor-default focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="p-2.5 rounded-xl bg-teal-650 hover:bg-teal-700 text-white shadow transition-colors"
                      title="Copy invite link"
                    >
                      {copiedLink ? <Check className="w-4.5 h-4.5" /> : <Copy className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  {copiedLink && (
                    <span className="text-[9px] font-bold text-emerald-600 block mt-1">Copied to clipboard!</span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddCollabByName} className="space-y-3 pt-2">
                  <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                    Quickly add a co-traveler's name to compute splits in the ledger and display them as a participant on this plan.
                  </p>

                  <div>
                    <label className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Co-Traveler Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCollabName}
                        onChange={(e) => setNewCollabName(e.target.value)}
                        placeholder="e.g. Rahul, Priya..."
                        required
                        className="flex-grow glass-input px-3.5 py-2.5 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-teal-650 hover:bg-teal-700 text-white font-bold text-xs shadow transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
