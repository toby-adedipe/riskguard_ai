import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 4000);

  app.use(express.json());

  // --- Simulation State ---
  let simulationState = {
    status: "idle", // "idle" | "active" | "mitigating" | "recovered"
    lastIncidentId: null as string | null,
    startTime: Date.now(),
  };

  const LGAS = [
    { id: "ikeja", name: "Ikeja", risk: 12, timeToBreach: "N/A" },
    { id: "lekki", name: "Lekki", risk: 8, timeToBreach: "N/A" },
    { id: "surulere", name: "Surulere", risk: 15, timeToBreach: "N/A" },
    { id: "agege", name: "Agege", risk: 5, timeToBreach: "N/A" },
    { id: "alimosho", name: "Alimosho", risk: 20, timeToBreach: "N/A" },
    { id: "apapa", name: "Apapa", risk: 18, timeToBreach: "N/A" },
    { id: "eti_osa", name: "Eti-Osa", risk: 10, timeToBreach: "N/A" },
    { id: "ikorodu", name: "Ikorodu", risk: 7, timeToBreach: "N/A" },
    { id: "mushin", name: "Mushin", risk: 14, timeToBreach: "N/A" },
    { id: "oshodi", name: "Oshodi", risk: 16, timeToBreach: "N/A" },
  ];

  // --- API Endpoints ---

  // Simulation Controls
  app.post("/api/simulation/start", (req, res) => {
    simulationState = { status: "idle", lastIncidentId: null, startTime: Date.now() };
    res.json({ status: "ok", message: "Simulation initialized" });
  });

  app.post("/api/simulation/trigger/ikeja", (req, res) => {
    simulationState.status = "active";
    simulationState.lastIncidentId = "INC-IK-001";
    res.json({ status: "ok", message: "Incident triggered in Ikeja" });
  });

  app.post("/api/simulation/mitigate", (req, res) => {
    simulationState.status = "mitigating";
    setTimeout(() => {
      simulationState.status = "recovered";
    }, 5000); // Transition to recovered after 5 seconds
    res.json({ status: "ok", message: "Mitigation applied" });
  });

  app.post("/api/simulation/reset", (req, res) => {
    simulationState = { status: "idle", lastIncidentId: null, startTime: Date.now() };
    res.json({ status: "ok", message: "System reset" });
  });

  // Risk Radar
  app.get("/api/risk/map", (req, res) => {
    const updatedLGAs = LGAS.map((lga) => {
      if (lga.id === "ikeja" && simulationState.status === "active") {
        return { ...lga, risk: 87, timeToBreach: "42m" };
      }
      if (lga.id === "ikeja" && simulationState.status === "mitigating") {
        return { ...lga, risk: 45, timeToBreach: "125m" };
      }
      if (lga.id === "ikeja" && simulationState.status === "recovered") {
        return { ...lga, risk: 42, timeToBreach: "N/A" };
      }
      return lga;
    });
    res.json(updatedLGAs);
  });

  // Incident Panel
  app.get("/api/incidents/:id", (req, res) => {
    if (simulationState.status === "idle") {
      return res.status(404).json({ error: "No active incident" });
    }
    res.json({
      id: req.params.id,
      cause: "Backbone Fiber Link Cut (Main-One Subsea Secondary)",
      riskScore: simulationState.status === "active" ? 87 : (simulationState.status === "mitigating" ? 45 : 24),
      timeToBreach: simulationState.status === "active" ? "42m" : (simulationState.status === "mitigating" ? "125m" : "N/A"),
      affectedSubscribers: 124500,
      enterpriseLines: 840,
      revenueAtRisk: "$12,400/hr",
      nccExposure: "Critical (Tier 1 Violation)",
      phase: simulationState.status === "recovered" ? "recovery" : "active",
      timeline: [
        { time: "22:04", event: "Anomalous latency detected on Ikeja Node-4" },
        { time: "22:06", event: "Packet loss exceeded 15% threshold" },
        { time: "22:08", event: "Incident triggered: NCC Alert Level Orange" },
      ]
    });
  });

  // Copilot Panel
  app.post("/api/copilot/query", (req, res) => {
    const { role, query } = req.body;
    res.json({
      facts: "Ikeja Node-4 is currently experiencing 85% packet loss. Primary fiber link is unresponsive. Enterprise traffic is down for 840 accounts.",
      inferences: "The issue likely stems from a physical fiber cut 2km from the Ikeja central exchange. Redundancy failing due to power surge on secondary route switch.",
      recommendations: "1. Divert traffic via Lagos-Island microwave link. 2. Dispatch technical crew to Zone 5. 3. Notify enterprise clients with SLA credit buffer.",
      tools_called: ["node_diagnostics", "power_log_analysis", "sla_impact_model"],
      validation_status: "Verified by Core Systems"
    });
  });

  // Mitigation Panel
  app.post("/api/actions/simulate", (req, res) => {
    res.json([
      {
        id: "action-1",
        name: "Microwave Failover (Zone 5)",
        riskReduction: 45,
        confidence: 0.92,
        timeToEffect: "4m",
        description: "Redirect critical traffic through temporary microwave links."
      },
      {
        id: "action-2",
        name: "Partial Node Restoration",
        riskReduction: 25,
        confidence: 0.65,
        timeToEffect: "15m",
        description: "Attempt software reboot of the edge switches."
      },
      {
        id: "baseline",
        name: "Do-Nothing Baseline",
        riskReduction: 0,
        confidence: 1.0,
        timeToEffect: "0m",
        description: "Maintain current state. Risk is projected to hit 100 in 42 minutes."
      }
    ]);
  });

  app.post("/api/actions/approve", (req, res) => {
    simulationState.status = "mitigating";
    setTimeout(() => {
      simulationState.status = "recovered";
    }, 10000);
    res.json({ status: "ok", message: "Action approved and deploying" });
  });

  // Compliance Pack
  app.get("/api/compliance/pack/:id", (req, res) => {
    res.json({
      timeline: "2026-05-02T22:04:00Z - 22:15:00Z",
      affectedServices: ["Data", "VoIP", "Enterprise MPLS"],
      kpis: "Uptime: 14% | Latency: 450ms | Packet Loss: 85%",
      impactedSubscribers: 124500,
      rootCause: "Physical fiber cut accompanied by logic failure on secondary failover controller.",
      correctiveActions: "Rerouted via Microwave Link; Replaced faulty edge switch at Site-IK-4.",
      evidenceLogs: "Log-ID: 772-AX | Sensor: Optical_Loss_High | Action: Failover_Triggered"
    });
  });

  // --- Vite & Production Server Setup ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
