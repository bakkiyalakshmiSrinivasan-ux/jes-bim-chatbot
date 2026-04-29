"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function ChatInterface() {
  const [messages, setMessages] = useState<{role: "user" | "ai", content: string}[]>([
    { role: "ai", content: "Hello! I am your JES BIM Operations Assistant. Ask me anything about tracking, billing models, or KPIs." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMsgs = [...messages, { role: "user" as const, content: input }];
    setMessages(newMsgs);
    setInput("");
    setIsLoading(true);

    try {
      // Mock Data to simulate SSOT context being fed to the AI
      const ssotContext = {
        modelsContext: "LumpSum: fixed scope. Resourcing: hourly tracked.",
        activeProjects: 2,
        managerId: user?.name
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMsgs, documentData: ssotContext })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: "ai", content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", content: "Connection error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-neutral-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">JES AI Assistant</h3>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> Online
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "ai" ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-white"}`}>
              {msg.role === "ai" ? <Bot size={16} /> : <UserIcon size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-800/80 text-neutral-100 border border-white/5"}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
               <Bot size={16} />
            </div>
            <div className="max-w-[80%] rounded-2xl p-4 bg-neutral-800/80 border border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-black/20 border-t border-white/5 relative">
        <input 
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me to generate a report, check utilization..."
          className="w-full bg-neutral-800/50 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
