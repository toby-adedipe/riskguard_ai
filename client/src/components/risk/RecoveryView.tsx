import { useQuery } from "@tanstack/react-query";
import { api, LGA } from "../../lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function RecoveryView() {
  const { data: lgas } = useQuery<LGA[]>({
    queryKey: ["riskMap"],
    queryFn: () => api.get("/risk/map").then((res) => res.data),
    refetchInterval: 5000,
  });

  const ikeja = lgas?.find(l => l.id === "ikeja");
  
  // Mock history for chart (last 5 intervals)
  // In a real app we'd fetch actual timeseries
  const data = [
    { time: "T-20", risk: 12 },
    { time: "T-15", risk: 12 },
    { time: "T-10", risk: 87 },
    { time: "T-5", risk: ikeja?.risk || 87 },
    { time: "NOW", risk: ikeja?.risk || 87 },
  ];

  return (
    <div className="panel-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recovery Vector (Ikeja)</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] text-slate-400">Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-200" />
            <span className="text-[10px] text-slate-400">Projected</span>
          </div>
        </div>
      </div>

      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="time" 
              hide
            />
            <YAxis 
              domain={[0, 100]} 
              hide
            />
            <Tooltip 
              contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '10px' }}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Area 
              type="monotone" 
              dataKey="risk" 
              stroke="#2563EB" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorRisk)" 
            />
            <ReferenceLine y={87} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'INCIDENT', position: 'insideTopLeft', fill: '#DC2626', fontSize: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Current MTTR</p>
          <p className="text-sm font-bold font-mono">12m 45s</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase">SLA Breach Prob.</p>
          <p className="text-sm font-bold font-mono text-amber-600">32%</p>
        </div>
      </div>
    </div>
  );
}
