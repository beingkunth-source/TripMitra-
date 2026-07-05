"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatAssistantProps {
  destination: string;
  startDate?: string;
  travelers?: number;
}

export default function AIChatAssistant({ destination, startDate, travelers }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I'm your **TripMitra AI companion**. I can curate custom landmarks, forecast weather suggestions, analyze budget guidelines, or provide transit hacks in **${destination}**. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Local dishes to try",
    "Hidden sights nearby",
    "Transit & subway hacks",
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          destination,
          dates: startDate || "",
          travelers: travelers || 1,
        }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I ran into a network hiccup while thinking. Let's try that again in a bit!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: `Chat history reset. How else can I assist you with your trip to **${destination}**?`,
      },
    ]);
    setSuggestions(["Weather advisory?", "Unique activities?", "Saving tips"]);
  };

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-coral-500 font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-[500px] rounded-2xl glass-panel border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-150 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-700">AI Assistant</h3>
            <p className="text-[10px] text-gray-400">Active • Gemini Powered</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="Reset Chat"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed border ${
 msg.role === "user"
 ? "bg-teal-600 border-teal-700 text-white rounded-tr-none"
 : "bg-gray-100 border-gray-200 text-gray-800 rounded-tl-none "
 }`}
              >
                {formatText(msg.content)}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-gray-150 bg-gray-50/20">
        {suggestions.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSend(sug)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-gray-200 bg-white text-gray-600 hover:text-teal-600 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all duration-200 "
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-3 border-t border-gray-150 bg-gray-50/50 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${destination}...`}
          className="flex-1 min-w-0 glass-input px-3.5 py-2 rounded-xl text-xs placeholder-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 transition-colors flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
