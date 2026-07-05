// TripMitra Service Worker for Offline Notifications

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
  console.log("[SW] Active & claimed control.");
  // Re-arm alarms from cached schedules if active session is recovered
  rearmFromCache();
});

// Cache map of active timers to prevent duplicates
const activeTimers = new Map();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SCHEDULE_NOTIFICATIONS") {
    console.log("[SW] Received schedule update, arming timers...", event.data.schedule);
    armFromPayload(event.data.schedule);
  }
});

function armFromPayload(schedule) {
  // Clear any existing active timeouts first
  for (const timeoutId of activeTimers.values()) {
    clearTimeout(timeoutId);
  }
  activeTimers.clear();

  schedule.forEach((item) => {
    const delay = new Date(item.time).getTime() - Date.now();
    
    // Only schedule if it's in the future and less than 30 days away (memory limit)
    if (delay > 0 && delay < 30 * 24 * 60 * 60 * 1000) {
      const timerId = setTimeout(() => {
        self.registration.showNotification(item.title, {
          body: item.body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: { tripId: item.tripId, url: `/planner/${item.tripId}` },
          tag: item.tag,
          requireInteraction: true
        });
        activeTimers.delete(item.tag);
      }, delay);
      
      activeTimers.set(item.tag, timerId);
    }
  });
}

function rearmFromCache() {
  // Since we cannot read localStorage from a service worker, 
  // the client will re-post the schedule when the page is active.
  console.log("[SW] Ready to receive schedules from client page.");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
