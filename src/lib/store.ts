import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface TripActivity {
  id: string;
  name: string;
  description: string;
  time?: string; // e.g. "Morning", "Afternoon", "Evening"
  lat?: number;
  lng?: number;
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
  createdAt: string;
}

// Global subscribers list to notify state updates across hooks
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
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
            packing_list: updatedTrip.packingList
          })
          .eq("id", updatedTrip.id);
        
        // 2. Sync itinerary days and activities
        for (const day of updatedTrip.itinerary) {
          let { data: dayRec } = await supabase
            .from("trip_days")
            .select("id")
            .eq("trip_id", updatedTrip.id)
            .eq("day_number", day.dayNumber)
            .single();

          if (!dayRec) {
            const { data: newDay } = await supabase
              .from("trip_days")
              .insert({ trip_id: updatedTrip.id, day_number: day.dayNumber, theme: day.theme })
              .select("id")
              .single();
            dayRec = newDay;
          } else {
            await supabase
              .from("trip_days")
              .update({ theme: day.theme })
              .eq("id", dayRec.id);
          }

          if (dayRec) {
            // Replace activities
            await supabase.from("activities").delete().eq("day_id", dayRec.id);
            if (day.activities.length > 0) {
              const insertData = day.activities.map((act, index) => ({
                day_id: dayRec.id,
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
        emitChange();
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
        packing_list: []
      })
      .select()
      .single();

    if (tripErr || !tripRecord) throw tripErr || new Error("Failed to insert trip");

    // Insert Days
    const daysData = Array.from({ length: tripData.days }, (_, i) => ({
      trip_id: tripRecord.id,
      day_number: i + 1,
      theme: i === 0 ? "Arrival & Explore" : `Day ${i + 1}`
    }));

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

    emitChange();
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
        setTrip(fullTrip);
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
    syncState();
    listeners.add(syncState);
    return () => {
      listeners.delete(syncState);
    };
  }, [tripId, user]);

  // Unified CRUD Operations: Supports immediate UI feedback
  const updateActivities = async (dayNumber: number, activities: TripActivity[]) => {
    if (!trip) return;
    
    // Optimistic UI update
    const updatedItinerary = trip.itinerary.map((d) =>
      d.dayNumber === dayNumber ? { ...d, activities } : d
    );
    const updatedTrip = { ...trip, itinerary: updatedItinerary };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      try {
        // Query the day record first
        let { data: dayRec } = await supabase
          .from("trip_days")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("day_number", dayNumber)
          .single();

        if (!dayRec) {
          const { data: newDay } = await supabase
            .from("trip_days")
            .insert({ trip_id: trip.id, day_number: dayNumber })
            .select("id")
            .single();
          dayRec = newDay;
        }

        if (dayRec) {
          // Delete old activities
          await supabase.from("activities").delete().eq("day_id", dayRec.id);
          
          // Re-insert sorted new activities
          if (activities.length > 0) {
            const insertData = activities.map((act, index) => ({
              day_id: dayRec.id,
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
        emitChange();
      } catch (err) {
        console.error("Supabase activities update failed:", err);
      }
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
    lng?: number
  ) => {
    if (!trip) return;
    const day = trip.itinerary.find((d) => d.dayNumber === dayNumber);
    const newActivity: TripActivity = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      description,
      time,
      lat,
      lng
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

  // Expenses CRUD operations
  const addExpense = async (description: string, category: TripExpense["category"], amount: number, date?: string) => {
    if (!trip) return;
    const newExpense: TripExpense = {
      id: Math.random().toString(36).substring(2, 9),
      description,
      category,
      amount,
      date: date || new Date().toISOString().split("T")[0],
    };
    const updatedExpenses = [...trip.expenses, newExpense];
    const updatedTrip = { ...trip, expenses: updatedExpenses };
    setTrip(updatedTrip);

    if (user && isSupabaseConfigured) {
      await supabase
        .from("trips")
        .update({ expenses: updatedExpenses })
        .eq("id", trip.id);
      emitChange();
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
      emitChange();
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
      emitChange();
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
      emitChange();
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
      emitChange();
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
      emitChange();
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
      emitChange();
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
    syncState
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
