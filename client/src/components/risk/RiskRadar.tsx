import { useQuery } from "@tanstack/react-query";
import { LGA, fetchRiskMap } from "../../lib/api";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RiskRadarProps {
  onSelectLGA: (id: string) => void;
}

export function RiskRadar({ onSelectLGA }: RiskRadarProps) {
  const { data: lgas, isLoading, error } = useQuery<LGA[]>({
    queryKey: ["riskMap"],
    queryFn: () => fetchRiskMap(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="panel-card p-6 h-[400px] flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 gap-4 flex-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-card p-6 h-[400px] flex flex-col items-center justify-center text-red-500">
        <AlertTriangle size={32} className="mb-2" />
        <p className="font-medium text-sm">Hardware Sync Failure</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-100 rounded-md text-slate-700 text-xs hover:bg-slate-200"
        >
          Re-initialize Link
        </button>
      </div>
    );
  }

  return (
    <div className="panel-card flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <ActivityPulse />
          Risk Radar
        </h2>
        <span className="text-[10px] font-mono text-slate-400">GLOBAL MONITORING ACTIVE</span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {lgas?.map((lga) => (
            <motion.button
              layout
              key={lga.id}
              onClick={() => onSelectLGA(lga.id)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`p-3 rounded-lg border text-left transition-all relative group ${
                lga.risk > 70
                  ? "bg-danger-soft border-red-200 shadow-sm"
                  : lga.risk > 40
                  ? "bg-warning-soft border-amber-200"
                  : "bg-white border-slate-200 hover:border-primary"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm text-slate-800">{lga.name}</span>
                {lga.risk > 70 ? (
                  <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold">CRITICAL</span>
                ) : lga.risk > 40 ? (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-tighter">Warning</span>
                ) : (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-tighter">Stable</span>
                )}
              </div>

              <div className="flex justify-between items-end mt-2">
                <div>
                  <span className={`text-xs font-medium ${
                    lga.risk > 70 ? "text-red-700" : lga.risk > 40 ? "text-amber-700" : "text-slate-500"
                  }`}>
                    Score: {lga.risk}/100
                  </span>
                </div>
                {lga.timeToBreach !== "N/A" && (
                  <span className={`text-[10px] font-mono font-bold ${
                    lga.risk > 70 ? "text-red-600" : "text-amber-600"
                  }`}>
                    {lga.timeToBreach} to breach
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ActivityPulse() {
  return (
    <div className="flex items-center gap-0.5 h-3">
      <motion.div
        animate={{ height: [2, 10, 4, 8, 2] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="w-0.5 bg-primary"
      />
      <motion.div
        animate={{ height: [6, 2, 12, 4, 6] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.2 }}
        className="w-0.5 bg-primary"
      />
      <motion.div
        animate={{ height: [4, 8, 2, 10, 4] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.4 }}
        className="w-0.5 bg-primary"
      />
    </div>
  );
}
