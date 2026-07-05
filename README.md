# 🌍✈️ TripMitra — AI-Powered Holiday Trip Planner

> **Plan smarter. Travel better.** TripMitra is a full-stack, AI-powered travel planning web application that generates complete itineraries, manages budgets, tracks expenses, provides weather intelligence, and much more — all with an elegant glassmorphism UI.

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Itinerary Generator** | Generate n-day themed itineraries with specific activities using Google Gemini AI |
| 🗺️ **Interactive Map** | Leaflet-based day-wise routing with custom numbered markers & polylines |
| 💰 **Smart Budget Management** | Expense ledger, SVG donut chart, over-budget alerts, AI budget intelligence |
| 🌤️ **Weather Intelligence** | 16-day forecast + historical data + AI weather/packing advice |
| 🏨 **Flight & Hotel Deals** | Real-time search via SerpAPI (Google Flights & Hotels) |
| ✅ **Packing Checklist** | AI-generated packing suggestions by category with interactive checkboxes |
| 💬 **AI Chat Assistant** | Context-aware travel chatbot powered by Gemini |
| 📅 **Export & Share** | PDF print, ICS calendar export, shareable trip links |
| 🔐 **Auth & Cloud Sync** | Supabase Auth (magic link / Google OAuth) with localStorage fallback |
| 🎨 **Glassmorphism UI** | Modern, responsive design with Framer Motion animations |
| 🌐 **Currency Converter** | Offline currency converter with hardcoded rates |
| 🕐 **World Clock** | Multi-timezone clock display |

---

## 🧰 Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **Styling** | Tailwind CSS 3.4 + Glassmorphism Design System |
| **UI Animations** | Framer Motion 12 |
| **Icons** | Lucide React |
| **Maps** | Leaflet 1.9 (CartoDB Voyager tiles) |
| **AI / LLM** | Google Gemini 2.5 Flash API |
| **Travel Data** | SerpAPI (Google Flights, Hotels, Maps) |
| **Weather** | Open-Meteo (free, no API key) |
| **Database & Auth** | Supabase (PostgreSQL + RLS) |
| **Caching** | Upstash Redis |
## 📁 Project Structure

```
TripMitra/
├── 📂 src/
│   ├── 📂 app/
│   │   ├── 📂 api/
│   │   │   ├── 📂 ai/                   # AI-specific endpoints
│   │   │   │   ├── 💬 chat/             # AI travel assistant
│   │   │   │   ├── 💰 budget-intelligence/  # AI budget analysis
│   │   │   │   ├── 💰 budget-suggestions/   # AI budget allocation tips
│   │   │   │   ├── 🌤️ weather-advice/   # AI weather/clothing tips
│   │   │   │   ├── ✅ packing-suggestions/  # AI packing list generator
│   │   │   │   └── 📍 suggest-stop/     # AI activity suggestions
│   │   │   ├── 📂 travel/               # Travel comparison services
│   │   │   │   ├── ✈️ flights/          # Google Flights search
│   │   │   │   ├── 🏨 hotels/           # Google Hotels search
│   │   │   │   └── 🚗 transit-options/  # Multi-mode transit search
│   │   │   ├── 🤖 generate-itinerary/   # Optimized AI itinerary generation
│   │   │   ├── 📝 itinerary/            # Fallback + TripAdvisor places
│   │   │   ├── 🗺️ geocode/              # Place → coordinates
│   │   │   ├── 🌤️ weather/              # Forecast & historical data
│   │   │   ├── 🖼️ search-images/        # Destination images
│   │   │   └── 🔍 check-border/          # Cross-border detection
│   │   ├── 📂 budget/[id]/              # Budget ledger page
│   │   ├── 📂 planner/[id]/             # Main trip planner (3-column)
│   │   ├── 📄 page.tsx                  # Homepage
│   │   ├── 📄 layout.tsx                # Root layout + BottomDock nav
│   │   ├── 🎨 globals.css               # Glassmorphism design system
│   │   └── 📂 fonts/                    # Geist font files
│   ├── 📂 components/
│   │   ├── 💬 AIChatAssistant.tsx       # Gemini chat sidebar
│   │   ├── 📱 BottomDock.tsx            # Navigation + auth modal
│   │   ├── 💱 CurrencyConverter.tsx     # Offline currency converter
│   │   ├── 📤 ExportButtons.tsx         # PDF, ICS, Share
│   │   ├── 🖼️ ImageWithFallback.tsx     # Image with skeleton fallback
│   │   ├── 🗺️ Map.tsx                   # Leaflet interactive map
│   │   └── 🕐 WorldClock.tsx            # Multi-timezone clock
│   ├── 📂 types/
│   │   └── 📄 trip.ts                   # Unified types definitions
│   └── 📂 lib/
│       ├── 📍 geo.ts                    # Coords mapping, resolveCoords
│       ├── 🤖 gemini.ts                 # callGemini AI caller
│       ├── ✈️ serpapi.ts                # callSerpApi search caller
│       ├── 🗄️ redis.ts                  # Upstash Redis client
│       ├── 🗃️ store.ts                  # State management + localStorage/Supabase
│       └── 🔌 supabaseClient.ts         # Supabase client init
├── 📂 supabase/
│   └── 📄 schema.sql                    # 11 tables + RLS + triggers
├── 📂 public/
│   └── 📄 manifest.json                 # Web app manifest
├── 📄 .env.example                      # Environment variables template
├── 📄 next.config.mjs                   # Next.js config
├── 📄 tailwind.config.ts               # Tailwind config
├── 📄 tsconfig.json                     # TypeScript config
├── 📄 package.json                      # Dependencies & scripts
└── 📄 postcss.config.mjs               # PostCSS config
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** or **yarn** or **pnpm**
- A **Google Gemini API key** (free tier available at [Google AI Studio](https://aistudio.google.com/))
- A **SerpAPI key** (free 100 searches/month at [serpapi.com](https://serpapi.com/))

### 1️⃣ Clone & Install

```bash
# Clone the repository
git clone https://github.com/beingkunth-source/TripMitra-.git
cd TripMitra-

# Install dependencies
npm install
```

### 2️⃣ Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Then edit `.env` and fill in your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SERP_API_KEY=your_serp_api_key_here
PORT=3000
```

> ⚠️ **Supabase & Upstash Redis** are optional. The app runs in **offline/local mode** using `localStorage` without them. To enable cloud features, add the Supabase and Upstash variables as shown in `.env.example`.

### 3️⃣ Run the Development Server

```bash
# Start Next.js dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4️⃣ Build for Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Other Commands

```bash
# Lint the codebase
npm run lint
```

---

## 🗄️ Supabase Database Setup (Optional)

1. Create a project at [supabase.com](https://supabase.com/)
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql`
3. Copy your project URL and anon key from **Settings → API**
4. Add them to `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

---

## 📄 License

This project is licensed under the **GPL-3.0 License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  
Made with ❤️ by [beingkunth-source](https://github.com/beingkunth-source)

⭐ Star this repo if you find it useful!

</div>
