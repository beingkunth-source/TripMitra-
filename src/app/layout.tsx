import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomDock from "@/components/BottomDock";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "TripMitra — AI Travel Planner",
  description:
    "Plan your next holiday seamlessly with our AI-powered travel assistant, interactive map routing, packing lists, and smart budget forecasting.",
  keywords: [
    "travel planner",
    "AI trip planner",
    "itinerary maker",
    "travel tech",
    "glassmorphism travel planner",
    "TripMitra",
  ],
  authors: [{ name: "TripMitra Team" }],
  manifest: "/manifest.json",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        A3a: ThemeProvider drives `class="dark"` on <html>.
        attribute="class" + defaultTheme="system" means it
        respects the OS preference on first load.
      */}
      <body className="antialiased text-gray-950 bg-[var(--bg-primary)] selection:bg-teal-500/10 selection:text-teal-900 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <main className="min-h-screen pb-28 md:pt-[84px]">{children}</main>

          {/* Global Bottom Navigation Dock */}
          <BottomDock />
        </ThemeProvider>
      </body>
    </html>
  );
}
