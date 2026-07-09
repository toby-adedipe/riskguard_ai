import { Bot, Construction } from "lucide-react";


interface CopilotPanelProps {
  incidentId: string | null;
}


export function CopilotPanel({ incidentId }: CopilotPanelProps) {
  return (
    <div className="panel-card flex flex-col bg-white min-h-[300px]">
      <div className="px-4 py-3 border-b border-[#EDEBE9] flex items-center justify-between bg-[#FAF9F8]">
        <h3 className="text-xs font-bold text-[#605E5C] flex items-center gap-2 uppercase tracking-widest">
          <Bot size={14} className="text-primary" />
          Copilot Investigation
        </h3>
        <span className="text-[10px] text-warning font-mono uppercase">
          W0 spike only
        </span>
      </div>

      <div className="flex-1 p-5 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full bg-warning-soft border border-[#FFD08A] flex items-center justify-center mb-3">
          <Construction size={18} className="text-warning" />
        </div>
        <p className="text-sm font-semibold text-text-main">
          Interactive agent runtime intentionally offline
        </p>
        <p className="text-xs text-[#605E5C] max-w-md mt-2 leading-relaxed">
          W0 currently verifies prompt composition, strict provider output,
          extraction, grounded-fact validation, and transcript persistence. It
          does not yet run a model-to-tool loop or wake from incidents.
        </p>
        {incidentId && (
          <p className="mt-3 text-[10px] font-mono text-[#A19F9D]">
            Incident context reserved: {incidentId}
          </p>
        )}
      </div>

      <div className="p-3 bg-[#FAF9F8] border-t border-[#EDEBE9] flex gap-2">
        <input
          type="text"
          placeholder="Available after the W1/W2 runtime is connected"
          disabled
          className="flex-1 text-xs border border-border-base rounded-sm px-2 bg-white text-[#A19F9D] disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled
          className="px-3 py-1 bg-primary text-white rounded-sm text-xs font-bold disabled:opacity-40"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
