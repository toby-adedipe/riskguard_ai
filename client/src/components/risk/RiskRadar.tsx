import { useQuery } from "@tanstack/react-query";
import { LGA, fetchRiskMap } from "../../lib/api";
import { ALL_LGA_META, LGAS_BY_CITY, LGAMeta } from "../../lib/lgas";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  List,
  Map,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import NigeriaMap from "@react-map/nigeria";

interface RiskRadarProps {
  selectedLgaId: string;
  onSelectLGA: (id: string) => void;
}

const CITIES = Object.keys(LGAS_BY_CITY);

function riskColor(risk: number) {
  if (risk > 70)
    return {
      bg: "bg-danger-soft",
      border: "border-[#F5C6C7]",
      dot: "bg-danger",
    };
  if (risk > 40)
    return {
      bg: "bg-warning-soft",
      border: "border-[#FFD08A]",
      dot: "bg-warning",
    };
  return { bg: "bg-white", border: "border-border-base", dot: "bg-success" };
}

function riskLabel(risk: number) {
  if (risk > 70)
    return (
      <span className="px-1.5 py-0.5 bg-danger text-white rounded-sm text-[9px] font-bold tracking-wide">
        CRIT
      </span>
    );
  if (risk > 40)
    return (
      <span className="px-1.5 py-0.5 bg-warning-soft text-warning border border-[#FFD08A] rounded-sm text-[9px] font-bold">
        WARN
      </span>
    );
  return (
    <span className="px-1.5 py-0.5 bg-success-soft text-success border border-[#A3D9A3] rounded-sm text-[9px] font-bold">
      OK
    </span>
  );
}

export function RiskRadar({ selectedLgaId, onSelectLGA }: RiskRadarProps) {
  const {
    data: lgas,
    isLoading,
    error,
  } = useQuery<LGA[]>({
    queryKey: ["riskMap"],
    queryFn: fetchRiskMap,
    refetchInterval: 5000,
  });

  const riskById: Record<string, number> = {};
  lgas?.forEach((l) => {
    riskById[l.id] = l.risk;
  });

  const [view, setView] = useState<"list" | "map">("map");
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Lagos: true,
  });
  const toggle = (city: string) =>
    setExpanded((prev) => ({ ...prev, [city]: !prev[city] }));

  const stateRisk: Record<string, number> = {};
  const stateLgas: Record<string, LGAMeta[]> = {};
  ALL_LGA_META.forEach((lga) => {
    if (!stateLgas[lga.state]) stateLgas[lga.state] = [];
    stateLgas[lga.state].push(lga);
    const risk = riskById[lga.id] ?? 0;
    stateRisk[lga.state] = Math.max(stateRisk[lga.state] ?? 0, risk);
  });

  const riskToMapColor = (risk: number) => {
    if (risk >= 80) return "#D13438"; // Critical
    if (risk >= 60) return "#FF8C00"; // High
    if (risk >= 40) return "#C19C00"; // Medium
    if (risk >= 20) return "#7DB8DE"; // Low
    return "#B8DDB8"; // Safe
  };

  const cityColors = Object.fromEntries(
    Object.entries(stateRisk).map(([state, risk]) => [
      state,
      riskToMapColor(risk),
    ]),
  );

  const handleStateClick = (state: string) => {
    setSelectedState(state);
  };

  const selectedStateLgas = selectedState
    ? (stateLgas[selectedState] ?? [])
    : [];
  const selectedStateRisk = selectedState ? (stateRisk[selectedState] ?? 0) : 0;

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-danger h-[300px]">
        <AlertTriangle size={28} className="mb-2" />
        <p className="font-medium text-sm">Sync Failure</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-3 py-1.5 bg-background rounded-md text-[#605E5C] text-xs hover:bg-[#EDEBE9] border border-border-base"
        >
          Reconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#EDEBE9] flex items-center justify-between bg-white sticky top-0 z-10">
        <h2 className="text-[10px] font-bold text-text-main flex items-center gap-2">
          Risk Radar
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#F3F2F1] border border-[#EDEBE9] rounded-md p-0.5">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded ${
                view === "list"
                  ? "bg-white shadow-sm text-primary"
                  : "text-[#605E5C]"
              }`}
            >
              <List size={11} />
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded ${
                view === "map"
                  ? "bg-white shadow-sm text-primary"
                  : "text-[#605E5C]"
              }`}
            >
              <Map size={11} />
              Map
            </button>
          </div>
          <span className="text-[9px] font-mono text-[#605E5C] uppercase tracking-wide">
            {isLoading ? "Syncing..." : `${ALL_LGA_META.length} LGAs`}
          </span>
        </div>
      </div>

      {view === "list" ? (
        <div className="overflow-y-auto">
          {CITIES.map((city) => {
            const cityLgas = LGAS_BY_CITY[city];
            const isOpen = !!expanded[city];
            const cityMaxRisk = Math.max(
              ...cityLgas.map((l: LGAMeta) => riskById[l.id] ?? 0),
            );
            const hasCityAlert = cityMaxRisk > 40;

            return (
              <div key={city} className="border-b border-[#EDEBE9]">
                <button
                  onClick={() => toggle(city)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#FAF9F8] transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {hasCityAlert && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-none ${cityMaxRisk > 70 ? "bg-danger" : "bg-warning"} animate-pulse`}
                      />
                    )}
                    <span
                      className={`text-[11px] font-bold ${hasCityAlert ? (cityMaxRisk > 70 ? "text-danger" : "text-warning") : "text-text-main"}`}
                    >
                      {city}
                    </span>
                    <span className="text-[9px] text-[#A19F9D] font-mono">
                      {cityLgas.length} LGAs
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={13} className="text-[#A19F9D]" />
                  ) : (
                    <ChevronRight size={13} className="text-[#A19F9D]" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2 pb-2 flex flex-col gap-1">
                        {cityLgas.map((lga: LGAMeta) => {
                          const risk = riskById[lga.id] ?? 0;
                          const { bg, border, dot } = riskColor(risk);
                          const isSelected = lga.id === selectedLgaId;

                          return (
                            <button
                              key={lga.id}
                              onClick={() => onSelectLGA(lga.id)}
                              className={`flex items-center justify-between px-3 py-2 rounded-md border text-left transition-all ${bg} ${border} ${
                                isSelected
                                  ? "ring-2 ring-primary ring-offset-1"
                                  : "hover:border-primary"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`}
                                />
                                <span
                                  className={`text-xs font-medium truncate ${isSelected ? "text-primary font-bold" : "text-text-main"}`}
                                >
                                  {lga.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-none ml-2">
                                {risk > 0 && (
                                  <span
                                    className={`text-[10px] font-mono font-bold ${risk > 70 ? "text-danger" : risk > 40 ? "text-warning" : "text-[#605E5C]"}`}
                                  >
                                    {risk}
                                  </span>
                                )}
                                {riskLabel(risk)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 bg-white border border-[#D2D0CE] rounded-lg p-4 min-h-0 flex flex-col m-3">
          <div className="flex items-center justify-between mb-2 flex-none">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
                {selectedState
                  ? `${selectedState} Network Risk`
                  : "Nigeria Network Risk Map"}
              </p>
              <span className="text-[10px] text-[#A19F9D]">
                {selectedState
                  ? `${selectedStateLgas.length} LGAs in view`
                  : `${Object.keys(stateRisk).length} states monitored`}
              </span>
            </div>
            {selectedState && (
              <button
                onClick={() => setSelectedState(null)}
                className="text-[10px] font-semibold text-primary px-2 py-1 rounded-md border border-[#B3D7F2] hover:bg-blue-soft transition-colors"
              >
                Back to Nigeria
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-2 flex-none">
            {[
              { label: "Safe", color: "#B8DDB8" },
              { label: "Low", color: "#7DB8DE" },
              { label: "Medium", color: "#C19C00" },
              { label: "High", color: "#FF8C00" },
              { label: "Critical", color: "#D13438" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-none"
                  style={{ background: item.color }}
                />
                <span className="text-[10px] text-[#605E5C]">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            <NigeriaMap
              type="select-single"
              cityColors={cityColors}
              mapColor="#EEF0F0"
              strokeColor="#ffffff"
              strokeWidth={0.6}
              hoverColor="#243A5E"
              hints
              hintBackgroundColor="#243A5E"
              hintTextColor="#ffffff"
              hintBorderRadius={4}
              onSelect={handleStateClick}
              size={420}
            />
          </div>

          {selectedState && (
            <div className="mt-3 border-t border-[#EDEBE9] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#605E5C]">
                  LGAs in {selectedState}
                </span>
                <span
                  className={`text-[10px] font-mono ${selectedStateRisk > 70 ? "text-danger" : selectedStateRisk > 40 ? "text-warning" : "text-[#605E5C]"}`}
                >
                  Peak risk {Math.round(selectedStateRisk)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {selectedStateLgas.map((lga) => {
                  const risk = riskById[lga.id] ?? 0;
                  const { bg, border, dot } = riskColor(risk);
                  return (
                    <button
                      key={lga.id}
                      onClick={() => onSelectLGA(lga.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border text-left transition-all ${bg} ${border} hover:border-primary`}
                    >
                      <span className="text-[10px] font-medium text-text-main truncate">
                        {lga.name}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-none ${dot}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
