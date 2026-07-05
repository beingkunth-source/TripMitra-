import { Trip } from "@/types/trip";

export interface NotifItem {
  time: string;
  title: string;
  body: string;
  tripId: string;
  tag: string;
}

export async function requestAndSchedule(trip: Trip): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "denied") {
    alert("Notification permissions are blocked. Please enable them in your browser settings to receive trip reminders.");
    return;
  }

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return;
  }

  const schedule = buildSchedule(trip);

  // Persist so SW can re-arm on next activation
  localStorage.setItem("tm_notif_schedule", JSON.stringify(schedule));

  // Post to active SW if registered
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({ type: "SCHEDULE_NOTIFICATIONS", schedule });
      } else {
        console.warn("[Reminders] Service Worker is registered but not active yet.");
      }
    } catch (err) {
      console.warn("[Reminders] Failed to post schedule to Service Worker:", err);
    }
  }

  // Also setup standard setTimeout triggers for the active session as fallback
  schedule.forEach((item) => {
    const delay = new Date(item.time).getTime() - Date.now();
    if (delay > 0 && delay < 12 * 60 * 60 * 1000) { // Limit to next 12h for memory safety
      setTimeout(() => {
        new Notification(item.title, {
          body: item.body,
          tag: item.tag,
        });
      }, delay);
    }
  });

  alert("Reminders activated! We'll nudge you 24h before your flight check-in and each morning of your trip.");
}

function buildSchedule(trip: Trip): NotifItem[] {
  const items: NotifItem[] = [];
  if (!trip.startDate) return items;

  const start = new Date(trip.startDate);

  // Flight check-in: 24h before startDate
  const checkIn = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  checkIn.setHours(9, 0, 0, 0);
  if (checkIn.getTime() > Date.now()) {
    items.push({
      time: checkIn.toISOString(),
      title: "Check-in opens ✈️",
      body: `Check in for your flight to ${trip.destination} opens now!`,
      tripId: trip.id,
      tag: `checkin-${trip.id}`,
    });
  }

  // Morning nudge for each day of the trip
  trip.itinerary.forEach((day) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + day.dayNumber - 1);
    dayDate.setHours(8, 0, 0, 0);

    if (dayDate.getTime() > Date.now()) {
      const first = day.activities[0];
      items.push({
        time: dayDate.toISOString(),
        title: `Day ${day.dayNumber} — ${day.theme || trip.destination} 🗺️`,
        body: first ? `First stop: ${first.name}` : `Enjoy your day in ${trip.destination}!`,
        tripId: trip.id,
        tag: `day-${trip.id}-${day.dayNumber}`,
      });
    }
  });

  return items;
}
