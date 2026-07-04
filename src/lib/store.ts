import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface TripActivity {
  id: string;
  name: string;
  description: string;
  time?: string; // e.g. "Morning", "Afternoon", "Evening"
  lat?: number;
  lng?: number;
  imageUrl?: string;
  rating?: number;
  notes?: string;
}

export interface TripDay {
  dayNumber: number;
  theme: string;
  activities: TripActivity[];
}

export interface TripExpense {
  id: string;
  description: string;
  category: "Flights" | "Hotels" | "Food" | "Activities" | "Shopping & Misc";
  amount: number;
  date?: string;
  currency?: string;
  originalAmount?: number;
  paidBy?: string;
  splitWith?: string[];
  perPersonSplit?: number;
}

export interface PackingItem {
  id: string;
  category: string;
  name: string;
  checked: boolean;
}

export interface Trip {
  id: string;
  destination: string;
  originCity: string;
  startDate: string;
  days: number;
  travelers: number;
  budgetLimit: number;
  itinerary: TripDay[];
  expenses: TripExpense[];
  packingList: PackingItem[];
  travellerNames?: string[];
  createdAt: string;
}

// Global subscribers list to notify state updates across hooks
const listeners = new Set<(changedTripId?: string) => void>();

// Module-level timers map for debouncing Supabase activity updates
const supabaseActivitiesDebounceTimers: Record<string, NodeJS.Timeout> = {};

function emitChange(tripId?: string) {
  listeners.forEach((listener) => listener(tripId));
}

// -----------------------------------------------------------------------------
// LOCAL STORAGE FALLBACK HELPERS
// -----------------------------------------------------------------------------
export function getSavedTrips(): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("tripmitra_trips");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to parse trips:", err);
    return [];
  }
}

export function saveTrips(trips: Trip[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tripmitra_trips", JSON.stringify(trips));
    emitChange();
  } catch (err) {
    console.error("Failed to save trips:", err);
  }
}

// Local CRUD: Add a new trip
export function createLocalTrip(tripData: Omit<Trip, "id" | "expenses" | "packingList" | "createdAt">): Trip {
  const newTrip: Trip = {
    ...tripData,
    id: Math.random().toString(36).substring(2, 9),
    expenses: [],
    packingList: [],
    createdAt: new Date().toISOString(),
  };
  const currentTrips = getSavedTrips();
  saveTrips([newTrip, ...currentTrips]);
  return newTrip;
}

// Local CRUD: Update an entire trip record
export function updateLocalTripRecord(updatedTrip: Trip) {
  const trips = getSavedTrips();
  const idx = trips.findIndex((t) => t.id === updatedTrip.id);
  if (idx !== -1) {
    trips[idx] = updatedTrip;
    saveTrips(trips);
  }
}

// Unified CRUD: Update an entire trip in local storage or Supabase cloud
export async function updateTripRecord(updatedTrip: Trip) {
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      try {
        // 1. Update primary details
        await supabase
          .from("trips")
          .update({
            destination: updatedTrip.destination,
            origin_city: updatedTrip.originCity,
            start_date: updatedTrip.startDate,
            days: updatedTrip.days,
            travelers: updatedTrip.travelers,
            budget_limit: updatedTrip.budgetLimit,
            expenses: updatedTrip.expenses,
            packing_list: updatedTrip.packingList,
            traveller_names: updatedTrip.travellerNames || []
          })
          .eq("id", updatedTrip.id);
        
        // 2. Sync itinerary days and activities
        for (const day of updatedTrip.itinerary) {
          const { data: dayRec, error: dayErr } = await supabase
            .from("trip_days")
            .select("id")
            .eq("trip_id", updatedTrip.id)
            .eq("day_number", day.dayNumber)
            .single();

          if (dayErr && dayErr.code !== "PGRST116") {
            console.error("Supabase error querying trip day in updateTripRecord:", dayErr.message);
          }

          let resolvedDayRec = dayRec;
          if (!resolvedDayRec) {
            const { data: newDay, error: insertErr } = await supabase
              .from("trip_days")
              .insert({ trip_id: updatedTrip.id, day_number: day.dayNumber, theme: day.theme })
              .select("id")
              .single();
            if (insertErr) {
              console.error("Supabase error inserting trip day in updateTripRecord:", insertErr.message);
            }
            resolvedDayRec = newDay;
          } else {
            const { error: updateErr } = await supabase
              .from("trip_days")
              .update({ theme: day.theme })
              .eq("id", resolvedDayRec.id);
            if (updateErr) {
              console.error("Supabase error updating trip day theme in updateTripRecord:", updateErr.message);
            }
          }

          if (resolvedDayRec) {
            // Replace activities
            const { error: deleteErr } = await supabase.from("activities").delete().eq("day_id", resolvedDayRec.id);
            if (deleteErr) {
              console.error("Supabase error deleting activities in updateTripRecord:", deleteErr.message);
            }
            if (day.activities.length > 0) {
              const insertData = day.activities.map((act, index) => ({
                day_id: resolvedDayRec.id,
                name: act.name,
                description: act.description || "",
                time: act.time || "Morning",
                lat: act.lat,
                lng: act.lng,
                position: index
              }));
              await supabase.from("activities").insert(insertData);
            }
          }
        }
        emitChange(updatedTrip.id);
        return;
      } catch (err) {
        console.error("Supabase trip record update failed:", err);
      }
    }
  }
  updateLocalTripRecord(updatedTrip);
}

// Local CRUD: Delete a trip
export function deleteLocalTrip(tripId: string) {
  const trips = getSavedTrips();
  const filtered = trips.filter((t) => t.id !== tripId);
  saveTrips(filtered);
}

// -----------------------------------------------------------------------------
// SUPABASE SYNC ENGINES
// -----------------------------------------------------------------------------

// Fetch a nested Trip object from Supabase relational tables
export async function fetchFullTripFromSupabase(tripId: string): Promise<Trip | null> {
  if (!isSupabaseConfigured) return null;
  // A guest/local ID (like '162coop') is not a valid UUID format. Return null immediately
  // to avoid triggering Supabase database exceptions for invalid UUID syntax.
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(tripId)) return null;
  try {
    const { data: tripData, error: tripErr } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripErr || !tripData) {
      console.warn("Trip query failed or not found in Supabase:", tripErr?.message);
      return null;
    }

    // Query days and their activities
    const { data: daysData, error: daysErr } = await supabase
      .from("trip_days")
      .select("*, activities(*)")
      .eq("trip_id", tripId)
      .order("day_number");

    if (daysErr) {
      console.error("Trip days query failed in Supabase:", daysErr.message);
    }

    const itinerary: TripDay[] = (daysData || []).map((d: any) => ({
      dayNumber: d.day_number,
      theme: d.theme || `Day ${d.day_number}`,
      activities: (d.activities || [])
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.description || "",
          time: a.time || "Morning",
          lat: a.lat ? parseFloat(a.lat) : undefined,
          lng: a.lng ? parseFloat(a.lng) : undefined
        }))
    }));

    return {
      id: tripData.id,
      destination: tripData.destination,
      originCity: tripData.origin_city || "",
      startDate: tripData.start_date || "",
      days: tripData.days,
      travelers: tripData.travelers || 1,
      budgetLimit: parseFloat(tripData.budget_limit || 50000),
      itinerary,
      expenses: tripData.expenses || [],
      packingList: tripData.packing_list || [],
      travellerNames: tripData.traveller_names || [],
      createdAt: tripData.created_at
    };
  } catch (err) {
    console.error("fetchFullTripFromSupabase error:", err);
    return null;
  }
}

// Create a trip in Supabase
export async function createSupabaseTrip(
  tripData: Omit<Trip, "id" | "expenses" | "packingList" | "createdAt">,
  userId: string
): Promise<Trip | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: tripRecord, error: tripErr } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        destination: tripData.destination,
        origin_city: tripData.originCity,
        start_date: tripData.startDate,
        days: tripData.days,
        travelers: tripData.travelers,
        budget_limit: tripData.budgetLimit,
        expenses: [],
        packing_list: [],
        traveller_names: tripData.travellerNames || []
      })
      .select()
      .single();

    if (tripErr || !tripRecord) throw tripErr || new Error("Failed to insert trip");

    // Insert Days
    const daysData = Array.from({ length: tripData.days }, (_, i) => {
      const matchedItineraryDay = tripData.itinerary?.find(d => d.dayNumber === i + 1);
      return {
        trip_id: tripRecord.id,
        day_number: i + 1,
        theme: matchedItineraryDay?.theme || (i === 0 ? "Arrival & Explore" : `Day ${i + 1}`)
      };
    });

    const { data: insertedDays, error: daysErr } = await supabase
      .from("trip_days")
      .insert(daysData)
      .select();

    if (daysErr || !insertedDays) throw daysErr || new Error("Failed to insert trip days");

    // Seed itinerary activities if present
    if (tripData.itinerary && tripData.itinerary.length > 0) {
      const activitiesData: any[] = [];
      tripData.itinerary.forEach((day) => {
        const matchedDay = insertedDays.find((d: any) => d.day_number === day.dayNumber);
        if (matchedDay) {
          day.activities.forEach((act, index) => {
            activitiesData.push({
              day_id: matchedDay.id,
              name: act.name,
              description: act.description || "",
              time: act.time || "Morning",
              lat: act.lat,
              lng: act.lng,
              position: index
            });
          });
        }
      });

      if (activitiesData.length > 0) {
        await supabase.from("activities").insert(activitiesData);
      }
    }

    emitChange(tripRecord.id);
    return fetchFullTripFromSupabase(tripRecord.id);
  } catch (err) {
    console.error("createSupabaseTrip error:", err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// REACTIVE CUSTOM HOOK: useActiveTrip
// -----------------------------------------------------------------------------
export function useActiveTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Auth State
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Core Lists
  const syncState = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured && user) {
      // Fetch user trips
      const { data, error } = await supabase
        .from("trips")
        .select("id, destination, origin_city, start_date, days, travelers, budget_limit, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mappedTrips = data.map((t: any) => ({
          id: t.id,
          destination: t.destination,
          originCity: t.origin_city || "",
          startDate: t.start_date || "",
          days: t.days,
          travelers: t.travelers || 1,
          budgetLimit: parseFloat(t.budget_limit || 50000),
          itinerary: [],
          expenses: [],
          packingList: [],
          createdAt: t.created_at
        }));
        setTrips(mappedTrips);
      }

      if (tripId) {
        const fullTrip = await fetchFullTripFromSupabase(tripId);
        if (fullTrip) {
          setTrip(fullTrip);
        } else {
          // If not found in Supabase (or guest ID), fall back to local storage
          const allLocalTrips = getSavedTrips();
          const found = allLocalTrips.find((t) => t.id === tripId);
          setTrip(found || null);
        }
      } else {
        setTrip(null);
      }
    } else {
      // Local fallback
      const allLocalTrips = getSavedTrips();
      setTrips(allLocalTrips);
      if (tripId) {
        const found = allLocalTrips.find((t) => t.id === tripId);
        setTrip(found || null);
      } else {
        setTrip(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const handleUpdate = (changedTripId?: string) => {
      if (!changedTripId || !tripId || changedTripId === tripId) {
        syncState();
      }
    };

    syncState();
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, [tripId, user]);

  // Unified CRUD Operations: Supports immediate UI feedback
  const updateActivities = async (dayNumber: number, activities: TripActivity[]) => {
    if (!trip) return;
    
    // 1. Optimistic UI update (synchronous)
    const updatedItinerary = trip.itinerary.map((d) =>
      d.dayNumber === dayNumber ? { ...d, activities } : d
    );
    const updatedTrip = { ...trip, itinerary: updatedItinerary };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      // 2. Debounce Supabase writes to prevent race conditions during rapid reordering
      const timerKey = `${trip.id}_${dayNumber}`;
      if (supabaseActivitiesDebounceTimers[timerKey]) {
        clearTimeout(supabaseActivitiesDebounceTimers[timerKey]);
      }

      supabaseActivitiesDebounceTimers[timerKey] = setTimeout(async () => {
        try {
          // Query the day record first
          const { data: dayRec, error: dayErr } = await supabase
            .from("trip_days")
            .select("id")
            .eq("trip_id", trip.id)
            .eq("day_number", dayNumber)
            .single();

          if (dayErr && dayErr.code !== "PGRST116") {
            console.error("Supabase error querying trip day in updateActivities:", dayErr.message);
          }

          let resolvedDayRec = dayRec;
          if (!resolvedDayRec) {
            const { data: newDay, error: insertErr } = await supabase
              .from("trip_days")
              .insert({ trip_id: trip.id, day_number: dayNumber })
              .select("id")
              .single();
            if (insertErr) {
              console.error("Supabase error inserting trip day in updateActivities:", insertErr.message);
            }
            resolvedDayRec = newDay;
          }

          if (resolvedDayRec) {
            // Delete old activities
            const { error: deleteErr } = await supabase.from("activities").delete().eq("day_id", resolvedDayRec.id);
            if (deleteErr) {
              console.error("Supabase error deleting activities in updateActivities:", deleteErr.message);
            }
            
            // Re-insert sorted new activities
            if (activities.length > 0) {
              const insertData = activities.map((act, index) => ({
                day_id: resolvedDayRec.id,
                name: act.name,
                description: act.description || "",
                time: act.time || "Morning",
                lat: act.lat,
                lng: act.lng,
                position: index
              }));
              const { error: insertActErr } = await supabase.from("activities").insert(insertData);
              if (insertActErr) {
                console.error("Supabase error inserting activities in updateActivities:", insertActErr.message);
              }
            }
          }
          emitChange(trip.id);
        } catch (err) {
          console.error("Supabase activities update failed:", err);
        } finally {
          delete supabaseActivitiesDebounceTimers[timerKey];
        }
      }, 500);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const addActivity = async (
    dayNumber: number,
    name: string,
    description: string,
    time = "Morning",
    lat?: number,
    lng?: number,
    imageUrl?: string
  ) => {
    if (!trip) return;
    const day = trip.itinerary.find((d) => d.dayNumber === dayNumber);
    const newActivity: TripActivity = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      description,
      time,
      lat,
      lng,
      imageUrl
    };
    const currentActivities = day ? day.activities : [];
    await updateActivities(dayNumber, [...currentActivities, newActivity]);
  };

  const editActivity = async (dayNumber: number, activityId: string, updatedFields: Partial<TripActivity>) => {
    if (!trip) return;
    const day = trip.itinerary.find((d) => d.dayNumber === dayNumber);
    if (!day) return;
    const updatedActivities = day.activities.map((a) =>
      a.id === activityId ? { ...a, ...updatedFields } : a
    );
    await updateActivities(dayNumber, updatedActivities);
  };

  const deleteActivity = async (dayNumber: number, activityId: string) => {
    if (!trip) return;
    const day = trip.itinerary.find((d) => d.dayNumber === dayNumber);
    if (!day) return;
    const filtered = day.activities.filter((a) => a.id !== activityId);
    await updateActivities(dayNumber, filtered);
  };

  const addDay = async (theme = "") => {
    if (!trip) return;
    const nextDayNum = trip.itinerary.length + 1;
    const defaultTheme = theme || `Day ${nextDayNum}`;
    const newDay: TripDay = {
      dayNumber: nextDayNum,
      theme: defaultTheme,
      activities: []
    };

    const updatedItinerary = [...trip.itinerary, newDay];
    const updatedTrip = {
      ...trip,
      days: nextDayNum,
      itinerary: updatedItinerary
    };

    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      try {
        const { error: dayErr } = await supabase
          .from("trip_days")
          .insert({
            trip_id: trip.id,
            day_number: nextDayNum,
            theme: defaultTheme
          });

        if (dayErr) throw dayErr;

        const { error: tripErr } = await supabase
          .from("trips")
          .update({ days: nextDayNum })
          .eq("id", trip.id);

        if (tripErr) throw tripErr;

        emitChange(trip.id);
      } catch (err) {
        console.error("Failed to add day in Supabase:", err);
      }
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const deleteDay = async (dayNumber: number) => {
    if (!trip) return;

    const filteredItinerary = trip.itinerary
      .filter((d) => d.dayNumber !== dayNumber)
      .map((d) => {
        if (d.dayNumber > dayNumber) {
          return { ...d, dayNumber: d.dayNumber - 1 };
        }
        return d;
      });

    const nextDaysCount = Math.max(0, trip.days - 1);
    const updatedTrip = {
      ...trip,
      days: nextDaysCount,
      itinerary: filteredItinerary
    };

    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      try {
        const { error: delErr } = await supabase
          .from("trip_days")
          .delete()
          .eq("trip_id", trip.id)
          .eq("day_number", dayNumber);

        if (delErr) throw delErr;

        const { data: dbDays } = await supabase
          .from("trip_days")
          .select("id, day_number")
          .eq("trip_id", trip.id)
          .gt("day_number", dayNumber);

        if (dbDays) {
          const sortedDays = [...dbDays].sort((a, b) => a.day_number - b.day_number);
          for (const d of sortedDays) {
            await supabase
              .from("trip_days")
              .update({ day_number: d.day_number - 1 })
              .eq("id", d.id);
          }
        }

        await supabase
          .from("trips")
          .update({ days: nextDaysCount })
          .eq("id", trip.id);

        emitChange(trip.id);
      } catch (err) {
        console.error("Failed to delete day in Supabase:", err);
      }
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  // Expenses CRUD operations
  const addExpense = async (
    description: string,
    category: TripExpense["category"],
    amount: number,
    date?: string,
    currency = "INR",
    originalAmount?: number,
    paidBy?: string,
    splitWith?: string[]
  ) => {
    if (!trip) return;

    // Resolve traveler names helper
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

    const members = getTravellerNames(trip);
    const finalPaidBy = paidBy || members[0] || "You";
    const finalSplitWith = splitWith && splitWith.length > 0 ? splitWith : members;
    const share = amount / (finalSplitWith.length || 1);

    const newExpense: TripExpense = {
      id: Math.random().toString(36).substring(2, 9),
      description,
      category,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      currency,
      originalAmount: originalAmount !== undefined ? originalAmount : amount,
      paidBy: finalPaidBy,
      splitWith: finalSplitWith,
      perPersonSplit: share
    };
    const updatedExpenses = [...trip.expenses, newExpense];
    const updatedTrip = { ...trip, expenses: updatedExpenses };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ expenses: updatedExpenses })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!trip) return;
    const filtered = trip.expenses.filter((e) => e.id !== expenseId);
    const updatedTrip = { ...trip, expenses: filtered };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ expenses: filtered })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const setBudgetLimit = async (limit: number) => {
    if (!trip) return;
    const updatedTrip = { ...trip, budgetLimit: limit };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ budget_limit: limit })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  // Packing List CRUD operations
  const togglePackingItem = async (itemId: string) => {
    if (!trip) return;
    const updatedList = trip.packingList.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    const updatedTrip = { ...trip, packingList: updatedList };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ packing_list: updatedList })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const addPackingItem = async (category: string, name: string) => {
    if (!trip) return;
    const newItem: PackingItem = {
      id: Math.random().toString(36).substring(2, 9),
      category,
      name,
      checked: false,
    };
    const updatedList = [...trip.packingList, newItem];
    const updatedTrip = { ...trip, packingList: updatedList };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ packing_list: updatedList })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const deletePackingItem = async (itemId: string) => {
    if (!trip) return;
    const filtered = trip.packingList.filter((item) => item.id !== itemId);
    const updatedTrip = { ...trip, packingList: filtered };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ packing_list: filtered })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  const setPackingSuggestions = async (categories: { category: string; items: string[] }[]) => {
    if (!trip) return;
    const generatedList: PackingItem[] = [];
    categories.forEach((cat) => {
      cat.items.forEach((itemText) => {
        generatedList.push({
          id: Math.random().toString(36).substring(2, 9),
          category: cat.category,
          name: itemText,
          checked: false,
        });
      });
    });
    const updatedTrip = { ...trip, packingList: generatedList };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ packing_list: generatedList })
        .eq("id", trip.id);
      emitChange(trip.id);
    } else {
      updateLocalTripRecord(updatedTrip);
    }
  };

  return {
    trip,
    trips,
    isLoading,
    addActivity,
    editActivity,
    deleteActivity,
    updateActivities,
    addExpense,
    deleteExpense,
    setBudgetLimit,
    togglePackingItem,
    addPackingItem,
    deletePackingItem,
    setPackingSuggestions,
    syncState,
    addDay,
    deleteDay
  };
}

// -----------------------------------------------------------------------------
// HISTORICAL TRIP SEARCH UTILITIES
// -----------------------------------------------------------------------------
export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("tripmitra_search_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearchQuery(query: string) {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    const updated = [query.trim(), ...filtered].slice(0, 5); // Keep last 5 searches
    localStorage.setItem("tripmitra_search_history", JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save search history:", err);
  }
}
