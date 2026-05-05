import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  FileText,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { to: "/audit", icon: ClipboardList, label: "Audit Trail" },
];

export default function Sidebar() {
  return (
    <aside className="w-[220px] flex-none flex flex-col bg-[#243A5E] text-white h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0078D4] flex items-center justify-center flex-none">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">RiskGuard AI</p>
          <p className="text-[10px] text-white/50 leading-tight">Network Intelligence</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#0078D4] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#0078D4]/40 flex items-center justify-center text-[11px] font-bold uppercase flex-none">
            FO
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">Favour Olaleru</p>
            <p className="text-[10px] text-white/50 truncate">NOC Operator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
