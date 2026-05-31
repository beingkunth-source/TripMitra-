"use client";

import React, { useState, useEffect } from "react";
import { Landmark, ArrowRightLeft } from "lucide-react";

const FIXED_RATES: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.2,
  GBP: 105.8,
  AED: 22.7,
  THB: 2.27,
  JPY: 0.53,
  SGD: 61.5,
};

export default function CurrencyConverter() {
  const [amount, setAmount] = useState<string>("1000");
  const [fromCur, setFromCur] = useState("INR");
  const [toCur, setToCur] = useState("USD");
  const [converted, setConverted] = useState<number>(0);

  useEffect(() => {
    const fromRate = FIXED_RATES[fromCur] || 1;
    const toRate = FIXED_RATES[toCur] || 1;
    const numericAmount = parseFloat(amount) || 0;
    
    // Convert: amount * (fromRate / toRate)
    const valInInr = numericAmount * fromRate;
    const finalVal = valInInr / toRate;
    
    setConverted(Number(finalVal.toFixed(2)));
  }, [amount, fromCur, toCur]);

  const handleSwap = () => {
    setFromCur(toCur);
    setToCur(fromCur);
  };

  return (
    <div className="p-5 rounded-2xl glass-panel border-gray-200 bg-white shadow-sm flex flex-col gap-4 text-left">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600">
          <Landmark className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700">Currency Converter</h3>
      </div>

      <div className="space-y-3">
        {/* From Group */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 min-w-0 glass-input px-3.5 py-2 rounded-xl text-sm focus:outline-none"
          />
          <select
            value={fromCur}
            onChange={(e) => setFromCur(e.target.value)}
            className="w-24 glass-input px-2 py-2 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            {Object.keys(FIXED_RATES).map((cur) => (
              <option key={cur} value={cur} className="bg-white text-gray-900">
                {cur}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Buttons */}
        <div className="flex justify-center">
          <button
            onClick={handleSwap}
            type="button"
            className="p-2 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all transform hover:rotate-180 duration-300"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 rotate-90" />
          </button>
        </div>

        {/* To Group */}
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3.5 py-2 border border-gray-150 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 min-h-[38px] flex items-center">
            {converted.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
          <select
            value={toCur}
            onChange={(e) => setToCur(e.target.value)}
            className="w-24 glass-input px-2 py-2 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            {Object.keys(FIXED_RATES).map((cur) => (
              <option key={cur} value={cur} className="bg-white text-gray-900">
                {cur}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-center">
        Offline exchange rates • Updated live daily
      </div>
    </div>
  );
}
