"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, Landmark, Sparkles, LogIn, LogOut, User, Mail, ShieldAlert, Bell, Settings, Globe, ChevronDown, BookOpen, Sun, Moon } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTheme } from "next-themes";

export default function BottomDock() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mount guard — avoid hydration mismatch for theme-dependent rendering
  useEffect(() => { setMounted(true); }, []);

  // Notifications, Settings and Profile States & Refs
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const [currencyPref, setCurrencyPref] = useState("INR");
  const [realTimeSync, setRealTimeSync] = useState(true);
  const [offlineStorage, setOfflineStorage] = useState(true);

  const [notifications, setNotifications] = useState<any[]>([]);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Load settings on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem("currencyPreference");
    if (savedCurrency) setCurrencyPref(savedCurrency);

    const savedSync = localStorage.getItem("realTimeSync");
    if (savedSync !== null) setRealTimeSync(savedSync === "true");

    const savedOffline = localStorage.getItem("offlineStorage");
    if (savedOffline !== null) setOfflineStorage(savedOffline === "true");
  }, []);

  // Save Settings logic
  const handleSaveSettings = async (selectedCurrency: string, syncVal: boolean, offlineVal: boolean) => {
    setCurrencyPref(selectedCurrency);
    setRealTimeSync(syncVal);
    setOfflineStorage(offlineVal);

    localStorage.setItem("currencyPreference", selectedCurrency);
    localStorage.setItem("realTimeSync", String(syncVal));
    localStorage.setItem("offlineStorage", String(offlineVal));

    if (user && isSupabaseConfigured) {
      try {
        await supabase
          .from("profiles")
          .update({
            preferences: {
              currency: selectedCurrency,
              realTimeSync: syncVal,
              offlineStorage: offlineVal,
            }
          })
          .eq("id", user.id);
      } catch (err) {
        console.error("Failed to sync profile settings:", err);
      }
    }

    alert("Settings saved successfully!");
    setShowSettings(false);
  };

  // Load and Subscribe Notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (user && isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (!error && data) {
            setNotifications(data.map((n: any) => ({
              id: n.id,
              text: `${n.title}: ${n.message}`,
              time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: n.read
            })));
            return;
          }
        } catch (err) {
          console.error("Failed to fetch notifications:", err);
        }
      }
      
      // Guest/offline fallback
      const local = localStorage.getItem("guest_notifications");
      if (local) {
        try {
          setNotifications(JSON.parse(local));
        } catch {
          setNotifications([]);
        }
      } else {
        const defaults = [
          { id: "1", text: "✈️ Flight ticket prices for Paris dropped by 10%!", time: "2 hrs ago", read: false },
          { id: "2", text: "💰 Rahul added $120 expense for dinner in Tokyo", time: "5 hrs ago", read: true },
          { id: "3", text: "🗺️ New collaborative roadmap shared by Sarah", time: "1 day ago", read: true },
        ];
        localStorage.setItem("guest_notifications", JSON.stringify(defaults));
        setNotifications(defaults);
      }
    };

    loadNotifications();

    if (user && isSupabaseConfigured) {
      // Subscribe to real-time notification additions
      const channel = supabase
        .channel(`public:notifications:user_id=eq.${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new;
            setNotifications(prev => [
              {
                id: n.id,
                text: `${n.title}: ${n.message}`,
                time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: n.read
              },
              ...prev
            ]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    
    if (user && isSupabaseConfigured) {
      try {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id);
      } catch (err) {
        console.error("Failed to mark notifications read on Supabase:", err);
      }
    } else {
      const updated = notifications.map(item => ({ ...item, read: true }));
      localStorage.setItem("guest_notifications", JSON.stringify(updated));
    }
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (showProfileDropdown && profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileDropdown(false);
      }

      const insideMobileNotification = profileRef.current && profileRef.current.contains(target);
      const insideDesktopNotification = notificationsRef.current && notificationsRef.current.contains(target);
      if (showNotifications && !insideMobileNotification && !insideDesktopNotification) {
        setShowNotifications(false);
      }

      const insideMobileSettings = profileRef.current && profileRef.current.contains(target);
      const insideDesktopSettings = settingsRef.current && settingsRef.current.contains(target);
      if (showSettings && !insideMobileSettings && !insideDesktopSettings) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showNotifications, showSettings, showProfileDropdown]);

  // Reusable panel render functions
  const renderNotificationsPanel = (isMobile: boolean) => (
    <div className={`absolute ${isMobile ? "right-0 bottom-full mb-3" : "right-0 top-full mt-3"} w-80 rounded-2xl border border-gray-200 bg-[#FAF8F5]/95 dark:bg-[#0F2320]/95 dark:border-teal-400/15 backdrop-blur-md p-4 shadow-xl z-[999] text-left`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[10px] font-extrabold text-[#221F1C] dark:text-teal-200 uppercase tracking-wider">Notifications</h4>
        <button 
          type="button"
          onClick={handleMarkAllRead} 
          className="text-[9px] text-teal-750 dark:text-teal-400 hover:text-teal-900 font-bold"
        >
          Mark all read
        </button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`p-2.5 rounded-xl border text-[11px] leading-relaxed transition-all ${
              n.read 
                ? "bg-white/50 border-gray-200/50 text-[#666059] dark:bg-teal-950/20 dark:border-teal-400/10 dark:text-gray-400" 
                : "bg-teal-500/5 border-teal-500/10 text-slate-900 dark:text-gray-100 font-medium"
            }`}
          >
            <p className="text-slate-800 dark:text-teal-100">{n.text}</p>
            <span className="text-[9px] text-gray-400 dark:text-teal-400/50 block mt-1">{n.time}</span>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-[10px] text-gray-400 dark:text-teal-505 italic text-center py-4">No notifications yet.</p>
        )}
      </div>
    </div>
  );

  const renderSettingsPanel = (isMobile: boolean) => (
    <div className={`absolute ${isMobile ? "right-0 bottom-full mb-3" : "right-0 top-full mt-3"} w-80 rounded-2xl border border-gray-200 bg-[#FAF8F5]/95 dark:bg-[#0F2320]/95 dark:border-teal-400/15 backdrop-blur-md p-5 shadow-xl z-[999] text-left`}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[11px] font-extrabold text-[#221F1C] dark:text-teal-200 uppercase tracking-wider">Workspace Settings</h4>
        {isMobile && (
          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-650 text-xs">✕</button>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-700 dark:text-teal-450/70 uppercase tracking-wider mb-1.5">
            Preferred Currency
          </label>
          <select 
            value={currencyPref}
            onChange={(e) => setCurrencyPref(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-teal-500/20 bg-white dark:bg-teal-950 text-xs focus:border-teal-500 outline-none text-slate-800 dark:text-teal-100"
          >
            <option value="INR">INR (₹) - Indian Rupee</option>
            <option value="USD">USD ($) - US Dollar</option>
            <option value="EUR">EUR (€) - Euro</option>
            <option value="GBP">GBP (£) - British Pound</option>
            <option value="JPY">JPY (¥) - Japanese Yen</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-700 dark:text-teal-450/70 uppercase tracking-wider mb-1.5">
            Collaboration Mode
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 dark:bg-teal-950/40 border border-gray-150 dark:border-teal-500/10">
            <div>
              <p className="text-xs font-semibold text-[#221F1C] dark:text-teal-100">Real-time Syncing</p>
              <p className="text-[9px] text-[#666059] dark:text-teal-400/60">Auto-sync changes with collaborators</p>
            </div>
            <input 
              type="checkbox" 
              checked={realTimeSync}
              onChange={(e) => setRealTimeSync(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 dark:border-teal-500/30 rounded focus:ring-teal-500 dark:bg-teal-950" 
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-700 dark:text-teal-450/70 uppercase tracking-wider mb-1.5">
            Offline Storage
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 dark:bg-teal-950/40 border border-gray-150 dark:border-teal-500/10">
            <div>
              <p className="text-xs font-semibold text-[#221F1C] dark:text-teal-100">LocalStorage Fallback</p>
              <p className="text-[9px] text-[#666059] dark:text-teal-400/60">Persist changes locally when offline</p>
            </div>
            <input 
              type="checkbox" 
              checked={offlineStorage}
              onChange={(e) => setOfflineStorage(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 dark:border-teal-500/30 rounded focus:ring-teal-500 dark:bg-teal-950" 
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => handleSaveSettings(currencyPref, realTimeSync, offlineStorage)}
        className="mt-5 w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all duration-200"
      >
        Save Settings
      </button>
    </div>
  );

  // Auto-detect the active trip ID from the URL path
  useEffect(() => {
    const parts = pathname.split("/");
    if ((parts[1] === "planner" || parts[1] === "budget") && parts[2]) {
      setActiveTripId(parts[2]);
      localStorage.setItem("activeTripId", parts[2]);
    } else {
      const stored = localStorage.getItem("activeTripId");
      if (stored) {
        setActiveTripId(stored);
      }
    }
  }, [pathname]);

  // Handle Auth Session State
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setAuthMsg({ type: "error", text: "Supabase connection is not configured in .env." });
      return;
    }
    if (!emailInput.trim()) return;

    setLoading(true);
    setAuthMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setAuthMsg({ type: "success", text: "Magic link sent! Check your inbox." });
      setEmailInput("");
    } catch (err: any) {
      setAuthMsg({ type: "error", text: err.message || "Failed to send link." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      alert("Supabase connection is not configured.");
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      alert("Google Login Error: " + err.message);
    }
  };

  const handleLogout = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  };

  const navItems = [
    {
      name: "Dashboard",
      icon: Home,
      href: "/",
      active: pathname === "/",
    },
    {
      name: "Trip Map",
      icon: Compass,
      href: activeTripId ? `/planner/${activeTripId}` : "#",
      active: pathname.startsWith("/planner"),
      disabled: !activeTripId,
    },
    {
      name: "Budget",
      icon: Landmark,
      href: activeTripId ? `/budget/${activeTripId}` : "#",
      active: pathname.startsWith("/budget"),
      disabled: !activeTripId,
    },
  ];

  return (
    <>
      {/* RESPONSIVE LAYOUT CONTAINER */}
      {/* Mobile: Floating Bottom Glass Panel, Desktop: Top Static Header Navbar */}
      <div className="fixed z-[100] 
        bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg
        md:bottom-auto md:top-0 md:left-0 md:translate-x-0 md:w-full md:max-w-none 
        transition-all duration-300">
        
        {/* INNER CONTAINER */}
        <nav className="flex items-center justify-between px-5 py-2.5 rounded-full glass-panel glass-panel-glow !overflow-visible border-gray-200/50 bg-[#FAF8F5]/80 shadow-xl backdrop-blur-xl
          dark:bg-[#0F2320]/90 dark:border-teal-400/15
          md:rounded-none md:border-b md:border-slate-200/20 md:dark:border-teal-400/10 md:px-10 md:h-[84px] md:shadow-[0_4px_20px_rgba(0,0,0,0.03)] md:bg-white/80 md:dark:bg-[#0F2320]/95 md:backdrop-blur-[16px]">
          
          {/* LOGO SECTION - Left aligned on desktop */}
          <Link href="/" className="flex items-center gap-2.5 hover:-translate-y-0.5 transition-transform duration-200">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.15 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="flex items-center justify-center text-teal-600"
            >
              <Sparkles className="w-7 h-7" />
            </motion.div>
            <span className="hidden sm:inline-block font-display text-teal-950 dark:text-teal-200 font-extrabold text-xl md:text-[22px] tracking-tight">
              TripMitra
            </span>
          </Link>

          {/* MIDDLE NAVIGATION ITEMS */}
          <div className="flex items-center gap-1 md:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isClickable = !item.disabled;
              
              const content = (
                <motion.button
                  whileHover={isClickable ? { scale: 1.02, y: -2 } : {}}
                  whileTap={isClickable ? { scale: 0.98 } : {}}
                  className={`relative group flex items-center gap-2 px-3.5 py-2 rounded-full text-xs md:text-[15px] font-semibold tracking-wide transition-all duration-200 ${
                    item.active
                      ? "text-teal-950 font-bold"
                      : isClickable
                      ? "text-slate-700 hover:text-slate-950 hover:bg-slate-500/5"
                      : "text-slate-400 cursor-not-allowed"
                  }`}
                  disabled={item.disabled}
                  title={item.disabled ? "Select or create a trip to unlock" : ""}
                >
                  {item.active && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-teal-600/12 border border-teal-600/20 rounded-full shadow-[0_4px_12px_rgba(45,140,120,0.15)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${
                    item.active 
                      ? "text-teal-700" 
                      : isClickable 
                      ? "text-slate-500 group-hover:text-slate-900 group-hover:rotate-6" 
                      : "text-slate-300"
                  }`} />
                  <span className="hidden sm:inline relative z-10">{item.name}</span>
                </motion.button>
              );

              if (item.disabled) {
                return <div key={item.name}>{content}</div>;
              }

              return (
                <Link key={item.name} href={item.href}>
                  {content}
                </Link>
              );
            })}
          </div>

          {/* RIGHT AUTH & USER SECTION */}
          <div className="flex items-center gap-3.5 relative">
            
            {/* Merged Utility Pill [ 🔔 ] [ ⚙️ ] (Desktop only) */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100/90 border border-slate-200/50 p-1 rounded-full shadow-sm hover:shadow transition-shadow duration-200 dark:bg-teal-950/45 dark:border-teal-400/15">
              {/* Notifications Bell */}
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotifications(!showNotifications);
                    setShowSettings(false);
                    setShowProfileDropdown(false);
                  }}
                  className={`p-2 rounded-full transition-all duration-200 relative hover:scale-105 active:scale-95 ${
                    showNotifications 
                      ? "bg-white text-teal-700 shadow-sm dark:bg-teal-900 dark:text-teal-100" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-teal-350 dark:hover:text-teal-100 dark:hover:bg-teal-900/40"
                  }`}
                  title="Notifications"
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-teal-950" />
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <div className="hidden md:block">
                      {renderNotificationsPanel(false)}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-teal-355 dark:hover:text-teal-100 dark:hover:bg-teal-900/40 transition-all duration-200 hover:scale-105 active:scale-95"
                title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle dark mode"
              >
                {mounted && resolvedTheme === "dark" ? (
                  <Sun className="w-[18px] h-[18px]" />
                ) : (
                  <Moon className="w-[18px] h-[18px]" />
                )}
              </button>

              {/* Settings Shortcut */}
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                    setShowNotifications(false);
                    setShowProfileDropdown(false);
                  }}
                  className={`p-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                    showSettings 
                      ? "bg-white text-teal-700 shadow-sm dark:bg-teal-900 dark:text-teal-100" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-teal-350 dark:hover:text-teal-100 dark:hover:bg-teal-900/40"
                  }`}
                  title="Workspace Settings"
                >
                  <Settings className="w-[18px] h-[18px] hover:rotate-45 transition-transform duration-300" />
                </button>
                <AnimatePresence>
                  {showSettings && (
                    <div className="hidden md:block">
                      {renderSettingsPanel(false)}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Profile Pill & CTA Area */}
            <div className="flex items-center gap-2.5">
              
              {/* Profile Dropdown Pill */}
              <div className="relative" ref={profileRef}>
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileDropdown(!showProfileDropdown);
                    setShowNotifications(false);
                  }}
                  className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/50 p-1 px-3 rounded-full hover:bg-slate-200/55 transition-all duration-200 cursor-pointer shadow-sm hover:shadow active:scale-[0.98] dark:bg-teal-950/40 dark:border-teal-400/15"
                >
                  {user ? (
                    <img
                      src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                      alt="Profile"
                      className="w-7 h-7 rounded-full border border-teal-500/25 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-teal-900/40 text-slate-600 dark:text-teal-300 flex items-center justify-center text-xs font-black">
                      G
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-teal-200 leading-tight">
                      {user ? (user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]) : "Guest"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-teal-400" />
                  </div>
                </div>
 
                {/* Profile Dropdown Menu */}
                <AnimatePresence>
                  {showProfileDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 bottom-full mb-3 md:bottom-auto md:top-full md:mt-3 w-52 rounded-2xl border border-gray-200 bg-[#FAF8F5]/95 dark:bg-[#0F2320]/95 dark:border-teal-400/15 backdrop-blur-md p-2 shadow-xl z-50 text-left flex flex-col"
                    >
                      <div className="px-3 py-2 border-b border-gray-150 dark:border-teal-450/15 mb-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Account</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-teal-200 truncate">
                          {user ? user.email : "Local Offline Mode"}
                        </p>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => { setShowSettings(true); setShowProfileDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-teal-400/10 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                      </button>

                      {/* Mobile-only menu items */}
                      <div className="md:hidden border-t border-gray-150 dark:border-teal-450/15 my-1 pt-1 space-y-0.5">
                        <button 
                          type="button"
                          onClick={() => {
                            setTheme(resolvedTheme === "dark" ? "light" : "dark");
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-teal-400/10 rounded-lg transition-colors flex items-center gap-2"
                        >
                          {mounted && resolvedTheme === "dark" ? (
                            <>
                              <Sun className="w-3.5 h-3.5" />
                              Light Mode
                            </>
                          ) : (
                            <>
                              <Moon className="w-3.5 h-3.5" />
                              Dark Mode
                            </>
                          )}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setShowNotifications(true);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-teal-400/10 rounded-lg transition-colors flex items-center gap-2 relative"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>Notifications</span>
                          {notifications.some(n => !n.read) && (
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          )}
                        </button>
                      </div>

                      {!user && (
                        <button 
                          type="button"
                          onClick={() => { setShowAuthModal(true); setShowProfileDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-500/5 rounded-lg transition-colors flex items-center gap-2 border-t border-gray-150 dark:border-teal-450/15 mt-1 pt-2"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Sign In / Sync
                        </button>
                      )}

                      {user && (
                        <button 
                          type="button"
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2 border-t border-gray-150 dark:border-teal-450/15 mt-1 pt-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile-only Notifications Dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <div className="md:hidden">
                      {renderNotificationsPanel(true)}
                    </div>
                  )}
                </AnimatePresence>

                {/* Mobile-only Settings Dropdown */}
                <AnimatePresence>
                  {showSettings && (
                    <div className="md:hidden">
                      {renderSettingsPanel(true)}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Join Workspace CTA Button (shown if guest/offline mode) */}
              {(!user || user.email === "offline@tripmitra.com") && (
                <motion.button
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-extrabold text-xs md:text-sm px-4.5 py-2 md:px-5 md:py-2.5 rounded-full shadow-[0_4px_12px_rgba(45,140,120,0.15)] hover:shadow-[0_12px_24px_rgba(45,140,120,0.25)] transition-all duration-200"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Join Workspace</span>
                </motion.button>
              )}
            </div>

          </div>
        </nav>
      </div>

      {/* AUTH POPUP MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-2xl border border-gray-200/50 bg-[#FAF8F5] p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-extrabold font-display text-[#221F1C]">Access Your Trips</h3>
                <button
                  onClick={() => {
                    setShowAuthModal(false);
                    setAuthMsg(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              </div>

              {!isSupabaseConfigured && (
                <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-800 text-[11px] leading-relaxed">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Local Offline Mode Active:</strong> Supabase has not been configured in env. Your trips will be saved locally using localStorage.
                  </div>
                </div>
              )}

              <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#666059] uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. wanderer@globe.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !isSupabaseConfigured}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs py-3 rounded-xl transition-all duration-200"
                >
                  {loading ? "Sending Magic Link..." : "Email Magic Link"}
                </button>
              </form>

              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <span className="relative px-3 bg-[#FAF8F5] text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  or
                </span>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={!isSupabaseConfigured}
                className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#666059] font-semibold text-xs py-2.5 rounded-xl transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {authMsg && (
                <div
                  className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${
                    authMsg.type === "success"
                      ? "bg-green-500/10 border-green-500/20 text-green-800"
                      : "bg-red-500/10 border-red-500/20 text-red-800"
                  }`}
                >
                  {authMsg.text}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
