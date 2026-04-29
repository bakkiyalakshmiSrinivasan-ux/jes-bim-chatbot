"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login Failed");

      login(data.token, data.user);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1545465223-74b8849ceddf?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-neutral-900/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3 hover:rotate-6 transition-transform">
            <span className="text-3xl">🤖</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">JES AI Ops</h1>
          <p className="text-white/60">Sign in to your BIM Operations Hub</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              className="w-full px-5 py-3.5 rounded-xl bg-black/30 border border-white/5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300"
              placeholder="admin, manager, or viewer"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              className="w-full px-5 py-3.5 rounded-xl bg-black/30 border border-white/5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in fade-in zoom-in duration-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative">
              {isLoading ? (
                <span className="animate-spin block w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
              ) : (
                "Authenticate"
              )}
            </span>
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-white/30 font-medium tracking-wide pb-2 border-b border-white/5 inline-block w-full">
          Demo: admin / password
        </div>
      </div>
    </div>
  );
}
