"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Trash2, Plus, Sparkles, AlertCircle, TrendingUp, Landmark, DollarSign, Users
} from "lucide-react";
import { useActiveTrip, TripExpense } from "@/lib/store";

// ─── Category colour palette ────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Flights:          "#0F766E", // Teal 500
  Hotels:           "#5DCAA5", // Teal 200
  Food:             "#F97362", // Coral 500
  Activities:       "#F5C4B3", // Coral 100
  "Shopping & Misc":"#6B7280", // Gray 500
};

// ─── Currency symbol lookup ──────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
};

const CURRENCY_CONVERSION: Record<string, number> = {
  INR: 1.0, USD: 83.5, EUR: 90.0, GBP: 106.0, JPY: 0.53,
};

// ─── Greedy Settlement algorithm ─────────────────────────────────────────────
function getSettlements(expenses: TripExpense[], members: string[]) {
  const balances: Record<string, number> = {};
  members.forEach((m) => {
    balances[m] = 0;
  });

  expenses.forEach((expense) => {
    const amt    = expense.amount;
    const payer  = expense.paidBy || members[0] || "You";
    const split  = expense.splitWith?.length ? expense.splitWith : members;

    if (balances[payer] === undefined) {
      balances[payer] = 0;
    }
    balances[payer] += amt;

    const share = amt / (split.length || 1);
    split.forEach((m) => {
      if (balances[m] === undefined) {
        balances[m] = 0;
      }
      balances[m] -= share;
    });
  });

  const balanceList = Object.entries(balances).map(([name, bal]) => ({ name, bal }));
  const debtors = balanceList.filter((x) => x.bal < -0.01).sort((a, b) => a.bal - b.bal);
  const creditors = balanceList.filter((x) => x.bal > 0.01).sort((a, b) => b.bal - a.bal);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amountToSettle = Math.min(-debtor.bal, creditor.bal);
    
    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(amountToSettle),
    });

    debtor.bal += amountToSettle;
    creditor.bal -= amountToSettle;
    if (Math.abs(debtor.bal) < 0.01) dIdx++;
    if (Math.abs(creditor.bal) < 0.01) cIdx++;
  }

  return { balances, settlements };
}

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

  // Resolve traveler names helper
  const getTravellerNames = (t: typeof trip) => {
    if (!t) return [];
    if (t.travellerNames && t.travellerNames.length > 0) {
      return t.travellerNames;
    }
    const names = ["You"];
    for (let i = 2; i <= t.travelers; i++) {
      names.push(`Traveler ${i}`);
    }
    return names;
  };

  const members = getTravellerNames(trip);

  // Form States
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<TripExpense["category"]>("Food");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paidBy, setPaidBy] = useState("You");
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [inputLimit, setInputLimit] = useState("");

  // Sync paidBy and splitWith once trip is loaded
  useEffect(() => {
    if (trip) {
      const names = getTravellerNames(trip);
      setPaidBy(names[0] || "You");
      setSplitWith(names);
    }
  }, [trip?.id, trip?.travelers, trip?.travellerNames]);

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
    const resolvedCategory = categorySpends[e.category] !== undefined ? e.category : "Shopping & Misc";
    categorySpends[resolvedCategory] += e.amount;
  });

  const hasSpend = trip.expenses.length > 0;
  const totalCatSpend = Object.values(categorySpends).reduce((sum, v) => sum + v, 0) || 1;

  let cumulativePercent = 0;
  const R = 35;
  const circumference = 2 * Math.PI * R;

  const donutSegments = Object.keys(categorySpends).map((key) => {
    const value = categorySpends[key];
    const percentage = value / totalCatSpend;
    const startPercent = cumulativePercent;
    cumulativePercent += percentage;

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

  // Calculate Daily Spends (flat spend tracker)
  const startMs = new Date(trip.startDate).getTime();
  const dailySpends = Array(trip.days).fill(0);
  trip.expenses.forEach((e) => {
    if (e.date) {
      const expenseMs = new Date(e.date).getTime();
      const dayIndex = Math.max(0, Math.min(trip.days - 1, Math.floor((expenseMs - startMs) / (1000 * 60 * 60 * 24))));
      dailySpends[dayIndex] += e.amount;
    } else {
      dailySpends[0] += e.amount;
    }
  });

  const maxDailySpend = Math.max(...dailySpends) || 1;
  const hasAnyDailySpend = dailySpends.some(s => s > 0);

  // Settlement computations
  const { balances, settlements } = getSettlements(trip.expenses, members);
  const hasSharedExpenses = trip.expenses.some(e => e.paidBy && e.splitWith && e.splitWith.length > 0);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    if (splitWith.length === 0) {
      alert("Please select at least one person to split the expense with.");
      return;
    }

    const origAmount = parseFloat(amount);
    const convertedAmount = origAmount * (CURRENCY_CONVERSION[currency] || 1.0);
    const todayStr = new Date().toISOString().split("T")[0];

    addExpense(desc.trim(), cat, convertedAmount, todayStr, currency, origAmount, paidBy, splitWith);
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

  const toggleSplitMember = (name: string) => {
    if (splitWith.includes(name)) {
      setSplitWith(prev => prev.filter(x => x !== name));
    } else {
      setSplitWith(prev => [...prev, name]);
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 py-6 md:py-10 text-gray-800 dark:text-teal-200">
      
      {/* HEADER BAR */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push(`/planner/${trip.id}`)}
          className="p-2 rounded-xl border border-gray-200 dark:border-teal-400/15 bg-white dark:bg-teal-950/40 hover:bg-gray-50 dark:hover:bg-teal-900/40 text-gray-400 hover:text-gray-850 dark:hover:text-teal-100 transition-colors"
          title="Back to Planner"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-left">
          <span className="text-[10px] font-bold text-coral-500 bg-coral-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Ledger Workspace
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold font-display text-gray-900 dark:text-white mt-1">
            Budget intelligence: <span className="text-teal-600 dark:text-teal-400">{trip.destination}</span>
          </h1>
        </div>
      </div>

      {/* STATS OVERVIEW GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        
        {/* Total Budget Limit card */}
        <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left flex flex-col justify-between min-h-[110px] shadow-sm">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-teal-400/70">Total Budget Limit</span>
            <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white mt-1 font-display">
              ₹{trip.budgetLimit.toLocaleString("en-IN")}
            </h2>
          </div>
          <form onSubmit={handleUpdateLimitSubmit} className="flex gap-2 mt-3">
            <input
              type="number"
              value={inputLimit}
              onChange={(e) => setInputLimit(e.target.value)}
              className="flex-1 glass-input px-2.5 py-1 rounded-lg text-xs focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
              placeholder="Update budget..."
            />
            <button
              type="submit"
              className="px-3 py-1 bg-teal-600 hover:bg-teal-500 rounded-lg text-[10px] font-bold text-white transition-colors"
            >
              Update
            </button>
          </form>
        </div>

        {/* Current Spent card */}
        <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left min-h-[110px] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-teal-400/70">Total Expenses</span>
            <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white mt-1 font-display">
              ₹{totalSpent.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-teal-300 mt-3 font-semibold">
            {trip.expenses.length} Transactions recorded
          </div>
        </div>

        {/* Remaining Balance card */}
        <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left min-h-[110px] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-teal-400/70">Remaining Balance</span>
            <h2 className={`text-2xl font-extrabold mt-1 font-display ${isOverBudget ? "text-coral-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              ₹{remaining.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px]">
            {isOverBudget ? (
              <span className="inline-flex items-center gap-1 text-coral-500 bg-coral-500/10 px-2 py-0.5 rounded font-bold uppercase">
                <AlertCircle className="w-3 h-3" /> Over budget!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold uppercase">
                <TrendingUp className="w-3 h-3" /> Within budget
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Progress Bar showing budget consumed */}
      <div className="w-full bg-gray-150 dark:bg-teal-950/40 rounded-full h-3 mb-8 overflow-hidden border border-gray-200/50 dark:border-teal-400/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget 
              ? "bg-gradient-to-r from-coral-500 to-rose-600 shadow-[0_0_12px_rgba(249,115,98,0.4)]" 
              : "bg-gradient-to-r from-teal-500 to-emerald-500 shadow-[0_0_12px_rgba(20,184,166,0.3)]"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, (totalSpent / trip.budgetLimit) * 100))}%` }}
        />
      </div>

      {/* TWO COLUMN CONTENT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: LEDGER TRANSACTIONS & DONUT */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* DAILY SPEND BAR CHART */}
          <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left shadow-sm">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700 dark:text-teal-200 mb-4 flex items-center justify-between">
              <span>Daily Spend Tracker</span>
              {hasAnyDailySpend && (
                <span className="text-[10px] text-gray-400 dark:text-teal-400/70 normal-case">
                  peak ₹{maxDailySpend.toLocaleString()}
                </span>
              )}
            </h3>

            {hasAnyDailySpend ? (
              <div className="h-40 flex items-end gap-3 pt-4 pb-2 px-2 border-b border-gray-100 dark:border-teal-500/20">
                {dailySpends.map((spend, idx) => {
                  const heightPct = Math.max(4, Math.round((spend / maxDailySpend) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                      <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[9px] font-bold px-2.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        ₹{spend.toLocaleString()}
                      </div>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-teal-600 to-coral-500 group-hover:opacity-85 transition-all duration-300 shadow-sm"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[9px] text-gray-400 dark:text-teal-400/60 font-bold mt-2 uppercase">D{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-gray-300 dark:border-teal-550/20 bg-gray-50/50 dark:bg-[#0d1f1c]/30 text-center h-40">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-teal-500/20 flex items-center justify-center mb-2">
                  <Landmark className="w-5 h-5 text-gray-400 dark:text-teal-400/70" />
                </div>
                <p className="text-xs font-bold text-gray-600 dark:text-teal-300">No spend yet</p>
                <p className="text-[10px] text-gray-400 dark:text-teal-500 mt-0.5">Your daily expense progression will render here</p>
              </div>
            )}
          </div>

          {/* LEDGER TRANSACTION LIST */}
          <div className="rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 overflow-hidden shadow-sm text-left">
            <div className="px-5 py-4 border-b border-gray-150 dark:border-teal-500/20 flex items-center justify-between bg-gray-50/50 dark:bg-teal-950/40">
              <h3 className="text-sm font-bold font-display uppercase tracking-wider text-gray-700 dark:text-teal-200">Expense Ledger</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-teal-500/20 bg-gray-50 dark:bg-teal-950/20">
                    <th className="px-5 py-3 text-gray-500 dark:text-teal-400/70 font-bold uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-gray-500 dark:text-teal-400/70 font-bold uppercase tracking-wider">Category</th>
                    <th className="px-5 py-3 text-gray-500 dark:text-teal-400/70 font-bold uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {trip.expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-150 dark:border-teal-500/20 hover:bg-gray-50/50 dark:hover:bg-teal-900/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-teal-100">
                        <div>{expense.description}</div>
                        <div className="text-[9.5px] text-gray-400 dark:text-teal-400/70 font-semibold mt-0.5">
                          Paid by <span className="text-slate-650 dark:text-teal-300">{expense.paidBy || "You"}</span>, split <span className="text-slate-650 dark:text-teal-300">{expense.splitWith?.length || trip.travelers} ways</span>
                          {expense.perPersonSplit !== undefined && (
                            <span className="text-[9px] text-teal-650 dark:text-teal-400 font-bold ml-2 bg-teal-500/5 dark:bg-teal-950/20 px-1.5 py-0.5 rounded border border-teal-500/10 dark:border-teal-400/15">
                              Each: {expense.currency && expense.currency !== "INR" ? `${CURRENCY_SYMBOLS[expense.currency] || ""}${Math.round((expense.originalAmount || expense.amount) / (expense.splitWith?.length || 1)).toLocaleString()}` : `₹${Math.round(expense.perPersonSplit).toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-extrabold"
                          style={{ backgroundColor: `${CATEGORY_COLORS[expense.category] || "#6B7280"}20`, color: CATEGORY_COLORS[expense.category] || "#6B7280" }}
                        >
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold font-mono text-gray-800 dark:text-white">
                        {expense.currency && expense.currency !== "INR" ? (
                          <div className="flex flex-col">
                            <span>
                              {CURRENCY_SYMBOLS[expense.currency] || ""}{expense.originalAmount?.toLocaleString()}
                            </span>
                            <span className="text-[9.5px] text-gray-400 dark:text-teal-400 font-semibold">(₹{expense.amount.toLocaleString()})</span>
                          </div>
                        ) : (
                          <span>₹{expense.amount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-teal-900/50 rounded text-gray-400 hover:text-coral-500 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trip.expenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-400 dark:text-teal-500 italic">
                        No expenses logged. Add expenses below or allocate deals to budget.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DYNAMIC SVG DONUT CHART */}
          <div className="p-6 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left shadow-sm">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700 dark:text-teal-200 mb-4">
              Category Breakdown
            </h3>
            
            {hasSpend ? (
              <div className="flex flex-col sm:flex-row items-center gap-8 justify-around">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="35" className="fill-transparent stroke-gray-100 dark:stroke-teal-950/60 stroke-[10]" />
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
                    <span className="text-[10px] text-gray-400 dark:text-teal-400 uppercase tracking-widest font-bold font-display">Spent</span>
                    <span className="text-sm font-extrabold text-gray-800 dark:text-white mt-0.5">
                      ₹{totalSpent > 100000 ? `${(totalSpent / 1000).toFixed(0)}k` : totalSpent.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 w-full max-w-[200px]">
                  {donutSegments.map((seg, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-gray-500 dark:text-teal-300 font-medium">{seg.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-gray-805 dark:text-white" style={{ color: seg.color }}>{seg.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-gray-300 dark:border-teal-550/20 bg-gray-50/50 dark:bg-[#0d1f1c]/30 text-center w-full">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-teal-500/20 flex items-center justify-center mb-3">
                  <Landmark className="w-5 h-5 text-gray-400 dark:text-teal-400/70" />
                </div>
                <p className="text-xs font-bold text-gray-600 dark:text-teal-300">No spend yet</p>
                <p className="text-[10px] text-gray-400 dark:text-teal-500 mt-1">Expenses you log will show in this breakdown</p>
              </div>
            )}
          </div>

          {/* SETTLE UP LEDGER */}
          <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left shadow-sm">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700 dark:text-teal-200 mb-4">
              Settle Up Ledger
            </h3>

            {!hasSharedExpenses ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-gray-200 dark:border-teal-550/20 bg-gray-50/50 dark:bg-[#0d1f1c]/30 text-center">
                <div className="w-10 h-10 rounded-full border border-dashed border-gray-300 dark:border-teal-500/20 flex items-center justify-center mb-2.5">
                  <Users className="w-4.5 h-4.5 text-gray-400 dark:text-teal-400/70" />
                </div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-teal-300">No shared expenses logged yet</p>
                <p className="text-[9.5px] text-gray-400 dark:text-teal-500 mt-0.5">Use "Paid By" and "Split With" in the form to start peer calculations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Individual balances list */}
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(balances).map(([name, bal]) => {
                    const isCreditor = bal > 0.01;
                    const isSettled = Math.abs(bal) <= 0.01;
                    return (
                      <div key={name} className="p-3 rounded-xl bg-gray-50 dark:bg-teal-950/30 border border-gray-200/50 dark:border-teal-400/10">
                        <div className="text-[10px] text-gray-400 dark:text-teal-400/50 font-bold uppercase">{name}</div>
                        <div className={`text-sm font-extrabold mt-1 ${
                          isSettled ? "text-gray-500" : isCreditor ? "text-emerald-600 dark:text-emerald-400" : "text-coral-500"
                        }`}>
                          {isSettled ? "Settled" : `${isCreditor ? "+" : ""}₹${Math.round(bal).toLocaleString()}`}
                        </div>
                        <div className="text-[8.5px] text-gray-400 mt-0.5 font-medium">
                          {isSettled ? "No balance" : isCreditor ? "gets back" : "owes share"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Transfer calculations */}
                <div className="border-t border-gray-100 dark:border-teal-500/20 pt-3">
                  <span className="text-[9px] text-gray-400 dark:text-teal-400/50 font-bold uppercase tracking-wider block mb-2">Suggested payments to settle:</span>
                  <div className="space-y-1.5">
                    {settlements.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-teal-500/5 border border-teal-500/10">
                        <span className="text-gray-600 dark:text-teal-200">
                          <strong>{s.from}</strong> owes <strong>{s.to}</strong>
                        </span>
                        <span className="font-extrabold text-teal-700 dark:text-teal-400">
                          ₹{s.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {settlements.length === 0 && (
                      <p className="text-[10px] text-gray-400 dark:text-teal-500 italic">No transfers needed. All balances are matching!</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: ADD EXPENSE FORM, CURRENCY, CLOCK & AI */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ADD EXPENSE SIDEBAR FORM */}
          <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-850 dark:text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Add Expense Item
            </h3>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1">Description</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Taxi to Airport, Dinner..."
                  required
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1">Category</label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value as TripExpense["category"])}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
                >
                  <option value="Flights" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">✈️ Flights</option>
                  <option value="Hotels" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">🏨 Hotels</option>
                  <option value="Food" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">🍔 Food</option>
                  <option value="Activities" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">🎟️ Activities</option>
                  <option value="Shopping & Misc" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">🛍️ Shopping & Misc</option>
                </select>
              </div>

              {/* Converted Cost Form Row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full glass-input px-2.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
                  >
                    <option value="INR" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">INR (₹)</option>
                    <option value="USD" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">USD ($)</option>
                    <option value="EUR" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">EUR (€)</option>
                    <option value="GBP" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">GBP (£)</option>
                    <option value="JPY" className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">JPY (¥)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1">Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-teal-500/70">
                      {CURRENCY_SYMBOLS[currency] || ""}
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full glass-input pl-6 pr-2.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Paid By dropdown */}
              <div>
                <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1">Paid By</label>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs cursor-pointer focus:outline-none dark:bg-teal-950/60 dark:border-teal-500/20"
                >
                  {members.map((name) => (
                    <option key={name} value={name} className="bg-white dark:bg-teal-950 text-gray-900 dark:text-teal-100">
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Split With checkboxes */}
              <div>
                <label className="text-[10px] text-gray-400 dark:text-teal-400/70 font-bold uppercase tracking-wider block mb-1.5">Split With</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
                  {members.map((name) => (
                    <label key={name} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={splitWith.includes(name)}
                        onChange={() => toggleSplitMember(name)}
                        className="rounded border-gray-300 dark:border-teal-500/25 text-teal-600 focus:ring-teal-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-semibold text-gray-650 dark:text-teal-350">{name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-xs text-white transition-colors"
              >
                Log Transaction
              </button>
            </form>
          </div>

          {/* AI BUDGET GUIDELINES */}
          <div className="p-5 rounded-2xl glass-panel border border-gray-200 dark:border-teal-400/15 bg-white/80 dark:bg-[#132B2A]/70 text-left shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-800 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              AI Savings Intelligence
            </h3>

            {loadingAi ? (
              <div className="text-center py-4 text-xs text-gray-400 animate-pulse">Running budget analytics...</div>
            ) : aiSuggestions ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/10 dark:border-teal-400/15 text-[10px] text-gray-600 dark:text-teal-300 leading-relaxed">
                  💰 <strong>Recommendation:</strong> {aiSuggestions.upsell_description}
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 dark:text-teal-400/50 font-bold uppercase tracking-wider block mb-1.5">Affordable recommendations:</span>
                  {aiSuggestions.potential?.slice(0, 3).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-gray-550 dark:text-teal-350">
                      <span className="text-coral-500 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-[10px] text-gray-400 italic">No recommendations loaded offline.</div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}