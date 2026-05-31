"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Trash2, Plus, Sparkles, AlertCircle, TrendingUp
} from "lucide-react";
import { useActiveTrip, TripExpense } from "@/lib/store";
import CurrencyConverter from "@/components/CurrencyConverter";
import WorldClock from "@/components/WorldClock";

const CATEGORY_COLORS: Record<string, string> = {
  Flights: "#4C7ABF", // Soft Slate Blue
  Hotels: "#3A9687",  // Soft Teal
  Food: "#4C8C5A",    // Moss Green
  Activities: "#D49D42", // Warm Gold
  "Shopping & Misc": "#666059", // Soft Taupe
};

export default function BudgetPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const {
    trip,
    addExpense,
    deleteExpense,
    setBudgetLimit,
  } = useActiveTrip(tripId);

  // Form States
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<TripExpense["category"]>("Food");
  const [amount, setAmount] = useState("");
  const [inputLimit, setInputLimit] = useState("");

  // AI Insights State
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Sync Input Limit with trip state quietly once loaded
  useEffect(() => {
    if (trip) {
      setInputLimit(trip.budgetLimit.toString());
    }
  }, [trip?.budgetLimit]);

  // Fetch AI Budget Insights
  useEffect(() => {
    if (!trip) return;

    const fetchBudgetInsights = async () => {
      setLoadingAi(true);
      try {
        const res = await fetch("/api/budget-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: trip.destination,
            days: trip.days,
            travelers: trip.travelers,
            budget: trip.budgetLimit,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiSuggestions(data);
        }
      } catch (err) {
        console.error("Failed to load budget insights:", err);
      } finally {
        setLoadingAi(false);
      }
    };

    fetchBudgetInsights();
  }, [trip?.destination, trip?.budgetLimit, trip?.days, trip?.travelers]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Finding your ledger records...
      </div>
    );
  }

  // Aggregate stats
  const totalSpent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = trip.budgetLimit - totalSpent;
  const isOverBudget = remaining < 0;

  // Aggregate category spending
  const categorySpends: Record<string, number> = {
    Flights: 0,
    Hotels: 0,
    Food: 0,
    Activities: 0,
    "Shopping & Misc": 0,
  };
  trip.expenses.forEach((e) => {
    if (categorySpends[e.category] !== undefined) {
      categorySpends[e.category] += e.amount;
    } else {
      categorySpends["Shopping & Misc"] += e.amount;
    }
  });

  // Calculate SVG Donut Chart parameters
  let totalCatSpend = Object.values(categorySpends).reduce((sum, v) => sum + v, 0);
  if (totalCatSpend === 0) totalCatSpend = 1;

  let cumulativePercent = 0;
  const donutSegments = Object.keys(categorySpends).map((key) => {
    const value = categorySpends[key];
    const percentage = value / totalCatSpend;
    const startPercent = cumulativePercent;
    cumulativePercent += percentage;

    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = `${-startPercent * circumference}`;

    return {
      category: key,
      value,
      percentage: Math.round(percentage * 100),
      color: CATEGORY_COLORS[key],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;

    addExpense(desc.trim(), cat, parseFloat(amount));
    setDesc("");
    setAmount("");
  };

  const handleUpdateLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputLimit);
    if (!isNaN(val) && val >= 0) {
      setBudgetLimit(val);
      alert(`Budget limit updated to Rs ${val.toLocaleString()}`);
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 py-6 md:py-10 text-gray-800">
      
      {/* HEADER BAR */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push(`/planner/${trip.id}`)}
          className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-850 transition-colors"
          title="Back to Planner"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-left">
          <span className="text-[10px] font-bold text-pink-600 bg-pink-500/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Ledger Workspace
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold font-display text-gray-900 mt-1">
            Budget intelligence: <span className="text-indigo-600">{trip.destination}</span>
          </h1>
        </div>
      </div>

      {/* STATS OVERVIEW GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        
        {/* Total Budget Limit card */}
        <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white text-left flex flex-col justify-between min-h-[110px] shadow-sm">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Budget Limit</span>
            <h2 className="text-2xl font-extrabold text-gray-800 mt-1 font-display">
              ₹{trip.budgetLimit.toLocaleString("en-IN")}
            </h2>
          </div>
          <form onSubmit={handleUpdateLimitSubmit} className="flex gap-2 mt-3">
            <input
              type="number"
              value={inputLimit}
              onChange={(e) => setInputLimit(e.target.value)}
              className="flex-1 glass-input px-2.5 py-1 rounded-lg text-xs focus:outline-none"
              placeholder="Update budget..."
            />
            <button
              type="submit"
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold text-white transition-colors animate-pulse"
            >
              Update
            </button>
          </form>
        </div>

        {/* Current Spent card */}
        <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white text-left min-h-[110px] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Expenses</span>
            <h2 className="text-2xl font-extrabold text-gray-800 mt-1 font-display">
              ₹{totalSpent.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="text-[10px] text-gray-500 mt-3 font-semibold">
            {trip.expenses.length} Transactions recorded
          </div>
        </div>

        {/* Remaining Balance card */}
        <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white text-left min-h-[110px] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining Balance</span>
            <h2 className={`text-2xl font-extrabold mt-1 font-display ${isOverBudget ? "text-pink-600" : "text-emerald-600"}`}>
              ₹{remaining.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px]">
            {isOverBudget ? (
              <span className="inline-flex items-center gap-1 text-pink-600 bg-pink-500/10 px-2 py-0.5 rounded font-bold uppercase">
                <AlertCircle className="w-3 h-3" /> Over budget!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded font-bold uppercase">
                <TrendingUp className="w-3 h-3" /> Within budget
              </span>
            )}
          </div>
        </div>

      </div>

      {/* TWO COLUMN CONTENT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: LEDGER TRANSACTIONS & DONUT */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* LEDGER TRANSACTION LIST */}
          <div className="rounded-2xl glass-panel border-gray-200 bg-white overflow-hidden shadow-sm text-left">
            <div className="px-5 py-4 border-b border-gray-250 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-bold font-display uppercase tracking-wider text-gray-700">Expense Ledger</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-5 py-3 text-gray-500 font-bold uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-gray-500 font-bold uppercase tracking-wider">Category</th>
                    <th className="px-5 py-3 text-gray-500 font-bold uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {trip.expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-150 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800">{expense.description}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-extrabold"
                          style={{ backgroundColor: `${CATEGORY_COLORS[expense.category]}15`, color: CATEGORY_COLORS[expense.category] }}
                        >
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold font-mono text-gray-800">
                        ₹{expense.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-pink-600 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trip.expenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-400 italic">
                        No expenses logged. Add expenses below or allocate deals to budget.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DYNAMIC SVG DONUT CHART */}
          <div className="p-6 rounded-2xl glass-panel border-gray-200 bg-white text-left shadow-sm">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700 mb-4">
              Category Breakdown
            </h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-8 justify-around">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="35" className="fill-transparent stroke-gray-100 stroke-[10]" />
                  {donutSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="35"
                      className="fill-transparent stroke-[10] transition-all duration-500 ease-out"
                      stroke={seg.color}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold font-display">Spent</span>
                  <span className="text-sm font-extrabold text-gray-800 mt-0.5">
                    ₹{totalSpent > 100000 ? `${(totalSpent / 1000).toFixed(0)}k` : totalSpent.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 w-full max-w-[200px]">
                {donutSegments.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-gray-500 font-medium">{seg.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-gray-800">{seg.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ADD EXPENSE FORM, CURRENCY, CLOCK & AI */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ADD EXPENSE SIDEBAR FORM */}
          <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white text-left shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-850 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              Add Expense Item
            </h3>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Description</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Taxi to Airport, Dinner..."
                  required
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Category</label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value as TripExpense["category"])}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none"
                >
                  <option value="Flights" className="bg-white text-gray-900">✈️ Flights</option>
                  <option value="Hotels" className="bg-white text-gray-900">🏨 Hotels</option>
                  <option value="Food" className="bg-white text-gray-900">🍔 Food</option>
                  <option value="Activities" className="bg-white text-gray-900">🎟️ Activities</option>
                  <option value="Shopping & Misc" className="bg-white text-gray-900">🛍️ Shopping & Misc</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Cost (Rs)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  required
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition-colors"
              >
                Log Transaction
              </button>
            </form>
          </div>

          {/* AI BUDGET GUIDELINES */}
          <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white text-left shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI Savings Intelligence
            </h3>

            {loadingAi ? (
              <div className="text-center py-4 text-xs text-gray-400 animate-pulse">Running budget analytics...</div>
            ) : aiSuggestions ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/10 text-[10px] text-gray-600 leading-relaxed">
                  💰 <strong>Next Luxury Tier:</strong> {aiSuggestions.upsell_description}
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Affordable recommendations:</span>
                  {aiSuggestions.potential?.slice(0, 3).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-gray-500">
                      <span className="text-pink-600 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-[10px] text-gray-400 italic">No recommendations loaded offline.</div>
            )}
          </div>

          <CurrencyConverter />
          <WorldClock />

        </div>

      </div>

    </div>
  );
}
