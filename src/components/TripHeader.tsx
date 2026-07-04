"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MapPin, Calendar, Users, Globe, BookOpen, AlertCircle, ShieldAlert } from "lucide-react";
import { Trip } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import ExportButtons from "./ExportButtons";

interface TripHeaderProps {
  trip: Trip;
  isInternational: boolean | null;
}

interface CollaboratorProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Collaborator {
  role: string;
  profile: CollaboratorProfile;
}

export default function TripHeader({ trip, isInternational }: TripHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isJournalPage = pathname?.endsWith("/journal");

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);

  // Fetch collaborators from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !trip.id) {
      // Offline fallback: simulated local collaborators
      setCollaborators([
        { role: "editor", profile: { id: "1", email: "kunth@example.com", full_name: "Kunth", avatar_url: null } },
        { role: "editor", profile: { id: "2", email: "rahul@example.com", full_name: "Rahul", avatar_url: null } },
        { role: "editor", profile: { id: "3", email: "priya@example.com", full_name: "Priya", avatar_url: null } },
      ]);
      return;
    }

    const getCollaborators = async () => {
      setLoadingCollabs(true);
      try {
        const { data, error } = await supabase
          .from("trip_collaborators")
          .select(`
            role,
            user_id
          `)
          .eq("trip_id", trip.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const userIds = data.map((tc: any) => tc.user_id);
          
          // Join manually to fetch corresponding profile records
          const { data: profilesData, error: profileErr } = await supabase
            .from("profiles")
            .select("id, email, full_name, avatar_url")
            .in("id", userIds);

          if (profileErr) throw profileErr;

          const joinedCollabs = data.map((tc: any) => {
            const profile = (profilesData || []).find((p: any) => p.id === tc.user_id) || {
              id: tc.user_id,
              email: "collaborator@example.com",
              full_name: "Collaborator",
              avatar_url: null,
            };
            return {
              role: tc.role,
              profile,
            };
          });

          setCollaborators(joinedCollabs);
        } else {
          // If no rows in table yet, show empty (with fallback/notice)
          setCollaborators([]);
        }
      } catch (err) {
        console.error("Error fetching trip collaborators:", err);
      } finally {
        setLoadingCollabs(false);
      }
    };

    getCollaborators();
  }, [trip.id]);

  const handleSharePlan = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/share/${trip.id}`;
    navigator.clipboard.writeText(url);
    alert(`Shareable read-only preview link copied to clipboard:\n${url}`);
  };

  const handleJournalToggle = () => {
    if (isJournalPage) {
      router.push(`/planner/${trip.id}`);
    } else {
      router.push(`/planner/${trip.id}/journal`);
    }
  };

  const getInitials = (fullName: string | null, email: string) => {
    if (fullName && fullName.trim()) {
      return fullName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
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
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-600" /> {trip.travelers} Traveler(s)
            </span>
          </div>
        </div>

        {/* Right Side Control Center */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-4 self-stretch lg:self-auto">
          
          {/* Online Collaborators Section */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl border border-gray-200 bg-gray-50/50 shadow-sm min-w-[240px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                Collaborators
                {isSupabaseConfigured && (
                  <span className="group relative cursor-pointer text-amber-500 hover:text-amber-600" title="Notice: trip_collaborators database has no invite UI. Add rows manually in Supabase.">
                    <ShieldAlert className="w-3 h-3 inline" />
                  </span>
                )}
              </span>
              <span className="text-[9px] text-gray-450 font-bold bg-white px-2 py-0.5 rounded-full shadow-xs border border-gray-150">
                {collaborators.length} Joined
              </span>
            </div>

            {collaborators.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {collaborators.map((collab, idx) => (
                  <div 
                    key={collab.profile.id || idx} 
                    className="flex items-center gap-1.5 bg-white border border-gray-200/60 pl-1.5 pr-2.5 py-1 rounded-full shadow-xs text-xs font-bold text-gray-700"
                  >
                    {collab.profile.avatar_url ? (
                      <img 
                        src={collab.profile.avatar_url} 
                        alt={collab.profile.full_name || "User"} 
                        className="w-5 h-5 rounded-full object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-700 flex items-center justify-center text-[9px] font-black border border-indigo-200/50">
                        {getInitials(collab.profile.full_name, collab.profile.email)}
                      </div>
                    )}
                    <span className="truncate max-w-[80px]">
                      {collab.profile.full_name || collab.profile.email.split("@")[0]}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-gray-450 italic mt-1 font-medium">
                No editors yet. Add rows in `trip_collaborators` to display!
              </div>
            )}
          </div>

          {/* Action Button Grid */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSharePlan}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 font-extrabold text-xs px-4 py-2.5 rounded-full shadow-sm transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                <span>Share Plan</span>
              </button>

              <button
                type="button"
                onClick={handleJournalToggle}
                className={`flex-1 flex items-center justify-center gap-1.5 border font-extrabold text-xs px-4 py-2.5 rounded-full shadow-sm transition-all ${
                  isJournalPage
                    ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isJournalPage ? "Timeline Mode" : "Journal Mode"}</span>
              </button>
            </div>

            <ExportButtons trip={trip} />
          </div>

        </div>
      </div>
    </div>
  );
}
