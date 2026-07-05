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
