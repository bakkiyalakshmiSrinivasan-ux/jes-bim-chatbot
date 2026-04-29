"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { DashboardStats } from "@/components/DashboardStats";
import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-black/95 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-[-10%] w-[40%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-[-10%] w-[40%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
              JES BIM Operations
            </h1>
            <p className="text-neutral-400 mt-1">Hello, {user.name} ({user.role})</p>
          </div>
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-neutral-300 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-neutral-900/50 backdrop-blur-md rounded-3xl p-8 border border-white/5 shadow-xl">
              <DashboardStats />
            </div>
          </div>
          
          <div className="lg:col-span-5">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}
