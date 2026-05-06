import { useQuery } from "@tanstack/react-query";
import { LGA, fetchRiskMap } from "../../lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function RecoveryView() {
  const { data: lgas } = useQuery<LGA[]>({
    queryKey: ["riskMap"],
    queryFn: () => fetchRiskMap(),
    refetchInterval: 5000,
  });

  const ikeja = lgas?.find(l => l.id === "ikeja");

  const data = [
    { time: "T-20", risk: 12 },
    { time: "T-15", risk: 12 },
    { time: "T-10", risk: 87 },
    { time: "T-5", risk: ikeja?.risk || 87 },
    { time: "NOW", risk: ikeja?.risk || 87 },
  ];

  return (
    <div className="panel-card p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold text-[#605E5C] uppercase tracking-widest">Recovery Vector (Ikeja)</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] text-[#605E5C] font-medium">Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#F5C6C7]" />
            <span className="text-[9px] text-[#605E5C] font-medium">Projected</span>
          </div>
        </div>
      </div>

      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0078D4" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="#0078D4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEBE9" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{ background: '#FFF', border: '1px solid #D2D0CE', borderRadius: '4px', fontSize: '10px' }}
              labelStyle={{ fontWeight: 'bold', color: '#323130' }}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#0078D4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRisk)"
            />
            <ReferenceLine y={87} stroke="#D13438" strokeDasharray="3 3" label={{ value: 'INCIDENT', position: 'insideTopLeft', fill: '#D13438', fontSize: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#EDEBE9] pt-3">
        <div>
          <p className="text-[9px] text-[#605E5C] uppercase tracking-wider font-semibold">Current MTTR</p>
          <p className="text-sm font-bold font-mono text-text-main">12m 45s</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-[#605E5C] uppercase tracking-wider font-semibold">SLA Breach Prob.</p>
          <p className="text-sm font-bold font-mono text-warning">32%</p>
        </div>
      </div>
    </div>
  );
}
