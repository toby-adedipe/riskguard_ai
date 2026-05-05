import { createContext, useContext, useState, type ReactNode } from "react";
import type { SimulationPhase } from "../types";

interface SimulationContextValue {
  phase: SimulationPhase;
  setPhase: (phase: SimulationPhase) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SimulationPhase>("baseline");
  return (
    <SimulationContext.Provider value={{ phase, setPhase }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used inside SimulationProvider");
  return ctx;
}
