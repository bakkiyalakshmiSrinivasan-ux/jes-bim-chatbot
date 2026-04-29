"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Activity, Users, DollarSign, Download } from "lucide-react";

export function DashboardStats() {
  const [data, setData] = useState<{ metrics: { totalProjects: number; totalClaimValue: number } } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/notion")
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(console.error);
  }, []);

  const downloadReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        body: JSON.stringify({ type: "Global KPI" }),
      });
      const resData = await res.json();
      if (resData.url) {
        const link = document.createElement("a");
        link.href = resData.url;
        link.download = "JES_BIM_Report.pdf";
        link.click();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (!data) return <div className="h-32 flex items-center justify-center animate-pulse bg-white/5 rounded-2xl w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">Live Telemetry</h2>
        <button 
          onClick={downloadReport} 
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-xl transition border border-blue-500/30 text-sm font-semibold"
        >
          {isGenerating ? <div className="w-4 h-4 border-2 border-t-blue-300 rounded-full animate-spin"/> : <Download size={16} />}
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FolderKanban />} label="Projects count" value={data.metrics.totalProjects} />
        <StatCard icon={<Activity />} label="Global Progress" value={"~30%"} />
        <StatCard icon={<Users />} label="Man-months" value={"42 Months"} />
        <StatCard icon={<DollarSign />} label="Claim value" value={`$${(data.metrics.totalClaimValue).toLocaleString()}`} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="p-5 rounded-2xl bg-neutral-800/40 border border-white/10 flex flex-col gap-3 group hover:bg-neutral-800/60 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-xs text-neutral-400 font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
