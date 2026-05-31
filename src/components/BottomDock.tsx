"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, Landmark, Sparkles, LogIn, LogOut, User, Mail, ShieldAlert } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function BottomDock() {
  const pathname = usePathname();
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      name: "Planner",
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
      <div className="fixed z-50 
        bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg
        md:bottom-auto md:top-0 md:left-0 md:translate-x-0 md:w-full md:max-w-none 
        transition-all duration-300">
        
        {/* INNER CONTAINER */}
        <nav className="flex items-center justify-between px-5 py-2.5 rounded-full glass-panel glass-panel-glow border-gray-300/40 bg-[#FAF8F5]/95 shadow-xl backdrop-blur-xl
          md:rounded-none md:border-b md:border-gray-300/70 md:px-8 md:py-3.5 md:shadow-sm md:bg-[#FAF8F5]/95 md:backdrop-blur-md">
          
          {/* LOGO SECTION - Left aligned on desktop, hidden in mobile nav list */}
          <Link href="/" className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm tracking-tight">
            <Sparkles className="w-4 h-4 text-teal-700 animate-pulse" />
            <span className="font-display bg-gradient-to-r from-teal-800 via-indigo-950 to-emerald-800 bg-clip-text text-transparent font-extrabold text-base">
              TripMitra
            </span>
          </Link>

          {/* MIDDLE NAVIGATION ITEMS */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isClickable = !item.disabled;
              
              const content = (
                <motion.button
                  whileHover={isClickable ? { scale: 1.03 } : {}}
                  whileTap={isClickable ? { scale: 0.97 } : {}}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all duration-200 ${
                    item.active
                      ? "text-indigo-950 font-bold"
                      : isClickable
                      ? "text-slate-700 hover:text-slate-950"
                      : "text-gray-300 cursor-not-allowed"
                  }`}
                  disabled={item.disabled}
                  title={item.disabled ? "Select or create a trip to unlock" : ""}
                >
                  {item.active && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-teal-500/10 border border-teal-500/25 rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-3.5 h-3.5 ${item.active ? "text-teal-750" : ""}`} />
                  <span className="hidden sm:inline">{item.name}</span>
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

          {/* RIGHT AUTH SECTION */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-6.5 h-6.5 rounded-full border border-teal-500/20 object-cover"
                  />
                ) : (
                  <div className="w-6.5 h-6.5 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-teal-600" />
                  </div>
                )}
                <span className="hidden lg:inline text-xs font-bold text-slate-800">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shadow-sm hover:shadow transition-all duration-200"
              >
                <LogIn className="w-3 h-3" />
                <span>Join Workspace</span>
              </button>
            )}
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
