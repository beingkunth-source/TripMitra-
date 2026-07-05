"use client";

import { useEffect } from "react";

export default function SWRegistrar() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker on window load
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Service worker successfully registered
          })
          .catch((err) => {
            console.warn("[SW] Registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
