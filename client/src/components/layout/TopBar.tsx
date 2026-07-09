import { Activity } from "lucide-react";


export function TopBar() {
  return (
    <header className="h-14 bg-white border-b border-border-base px-6 flex items-center justify-between sticky top-0 z-10 shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <Activity size={18} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-bold text-lg tracking-tight leading-none text-text-main">
            RiskGuard <span className="text-primary">AI</span>
          </h1>
          <div className="mt-1 px-1.5 py-0.5 bg-blue-soft rounded-sm text-[8px] font-bold uppercase tracking-widest text-primary border border-[#B3D7F2] inline-block w-fit">
            Operational Command
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 border border-[#FFD08A] bg-warning-soft rounded">
        <span className="w-2 h-2 rounded-full bg-warning" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7B5A00]">
          W0 foundation · interactive runtime offline
        </span>
      </div>
    </header>
  );
}
