import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomDock from "@/components/BottomDock";

export const metadata: Metadata = {
  title: "TripMitra — AI Travel Planner",
  description: "Plan your next holiday seamlessly with our AI-powered travel assistant, interactive map routing, packing lists, and smart budget forecasting.",
  keywords: ["travel planner", "AI trip planner", "itinerary maker", "travel tech", "glassmorphism travel planner", "TripMitra"],
  authors: [{ name: "TripMitra Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-950 bg-white selection:bg-indigo-500/10 selection:text-indigo-900">
        {/* Main Content Viewport Wrapper */}
        <main className="min-h-screen pb-28">
          {children}
        </main>

        {/* Global Bottom Navigation Dock */}
        <BottomDock />
      </body>
    </html>
  );
}
