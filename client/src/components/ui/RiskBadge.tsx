import type { RiskStatus } from "../../types";

const CLASSES: Record<RiskStatus, string> = {
  critical: "bg-[#FDE7E9] text-[#D13438] border-[#D13438]/25",
  high: "bg-[#FFF4CE] text-[#FF8C00] border-[#FF8C00]/25",
  medium: "bg-[#FFF4CE]/60 text-[#C19C00] border-[#C19C00]/25",
  low: "bg-[#C7E0F4]/40 text-[#0078D4] border-[#0078D4]/20",
  safe: "bg-[#DFF6DD] text-[#107C10] border-[#107C10]/25",
};

const DOTS: Record<RiskStatus, string> = {
  critical: "bg-[#D13438]",
  high: "bg-[#FF8C00]",
  medium: "bg-[#C19C00]",
  low: "bg-[#0078D4]",
  safe: "bg-[#107C10]",
};

export default function RiskBadge({ status }: { status: RiskStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${CLASSES[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${DOTS[status]}`} />
      {status}
    </span>
  );
}
