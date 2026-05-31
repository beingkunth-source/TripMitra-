"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapActivity {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  time?: string;
}

interface MapProps {
  activities: MapActivity[];
  destination: string;
  centerCoords?: { lat: number; lng: number } | null;
}

export default function Map({ activities, destination, centerCoords }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    // Default center coords (e.g. India center or geocoded coords)
    const initialLat = centerCoords?.lat || 20.5937;
    const initialLng = centerCoords?.lng || 78.9629;
    const zoomLevel = centerCoords ? 12 : 5;

    // Initialize Leaflet Map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initialLat, initialLng], zoomLevel);

      // CartoDB Voyager Tile layer - Keyless and extremely elegant dark/light hybrid
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(mapRef.current);

      // Add zoom control to top-right
      L.control.zoom({ position: "topright" }).addTo(mapRef.current);
      
      // Add custom scale control
      L.control.scale({ position: "bottomright" }).addTo(mapRef.current);
    } else {
      // If map exists, pan to center coordinates if updated
      if (centerCoords) {
        mapRef.current.setView([centerCoords.lat, centerCoords.lng], zoomLevel);
      }
    }

    const mapInstance = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Filter activities that have valid coordinates
    const validActivities = activities.filter(
      (act) => typeof act.lat === "number" && typeof act.lng === "number"
    );

    if (validActivities.length > 0) {
      const latlngs: L.LatLngExpression[] = [];

      validActivities.forEach((act, index) => {
        const lat = act.lat!;
        const lng = act.lng!;
        latlngs.push([lat, lng]);

        // Create Custom Marker Icon with matching numbering
        const numberIcon = L.divIcon({
          html: `<div class="custom-leaflet-marker w-7 h-7 flex items-center justify-center rounded-full border-2 border-white shadow-lg text-white font-extrabold text-xs bg-gradient-to-tr from-teal-600 to-blue-500 transition-all duration-300 transform hover:scale-115">${index + 1}</div>`,
          className: "custom-div-icon",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        // Add Marker to Map
        const marker = L.marker([lat, lng], { icon: numberIcon })
          .addTo(mapInstance)
          .bindPopup(
            `<div class="p-2 text-gray-900 font-sans">
              <strong class="block text-sm font-semibold">${index + 1}. ${act.name}</strong>
              ${act.time ? `<span class="inline-block px-1.5 py-0.5 mt-1 text-[10px] font-bold tracking-wide uppercase bg-teal-100 text-teal-850 rounded">${act.time}</span>` : ""}
             </div>`,
             { closeButton: false }
          );

        markersRef.current.push(marker);
      });

      // Draw Polyline connecting stops
      if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, {
          color: "rgba(58, 150, 135, 0.85)", // Muted Teal
          weight: 4,
          dashArray: "6, 8",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(mapInstance);

        polylineRef.current = polyline;
      }

      // Adjust map bounds to fit all markers
      const bounds = L.latLngBounds(latlngs);
      mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      // No-op cleanup of map on sub-renders to prevent container resetting
    };
  }, [activities, centerCoords]);

  // Global Map Cleanup on Component Unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px] md:min-h-full rounded-2xl overflow-hidden border border-gray-200 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0 bg-[#F4F1E9]" />
      
      {/* Decorative Overlay for visual premium finish */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="px-4 py-2 rounded-xl glass-panel border-gray-200 bg-white/90 shadow-lg text-xs font-semibold text-gray-700">
          📍 Map Router: <span className="text-teal-700 font-bold">{destination}</span>
        </div>
      </div>
    </div>
  );
}
