import { Routes, Route, Navigate } from "react-router-dom";
import { SimulationProvider } from "./context/SimulationContext";
import Shell from "./components/layout/Shell";
import Dashboard from "./pages/Dashboard";
import IncidentsList from "./pages/IncidentsList";
import IncidentDetail from "./pages/IncidentDetail";
import CompliancePack from "./pages/CompliancePack";
import AuditTrail from "./pages/AuditTrail";

export default function App() {
  return (
    <SimulationProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incidents" element={<IncidentsList />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/compliance/:incidentId" element={<CompliancePack />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </SimulationProvider>
  );
}
