import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import SimulationBar from "./SimulationBar";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F3F2F1]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SimulationBar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
