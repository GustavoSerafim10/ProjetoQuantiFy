import { useState } from "react";
import InputPanel from "./ui/InputPanel";

import { modelPipeline } from "./application/pipelines/modelPipeline";
import { decisionPipeline } from "./application/pipelines/decisionPipeline";
import { runMonteCarlo } from "./application/engines/monteCarloAdapter";

/* 🔥 NOVO */
import { marketBuilder } from "./application/builders/marketBuilder";

/* 🧹 RESET */
import { resetHistory } from "./domain/tracking/trackingEngine";

import Dashboard from "./ui/Dashboard";

function App() {

  const [result, setResult] = useState<any>(null);

  function handleAnalyze(data: any) {

    console.log("🔥 INPUT:", data);

    /* ===========================
       🧠 MODEL
    ============================ */

    const model = modelPipeline({
      homeStats: data.stats.home,
      awayStats: data.stats.away,
      league: data.match.league
    });

    console.log("📐 MODEL:", model);

    /* ===========================
       🎯 MARKETS
    ============================ */

    const markets = marketBuilder({
      odds: data.odds
    });

    console.log("📦 MARKETS:", markets);

    /* ===========================
       🎲 MONTE CARLO
    ============================ */

    const monteCarlo = runMonteCarlo({
      ...data,
      ...model
    });

    console.log("🧠 MONTE CARLO:", monteCarlo);

    /* ===========================
       🎯 DECISION
    ============================ */

    const decision = decisionPipeline({
      ...model,
      odds: data.odds,
      monteCarlo,
      markets,
      match: `${data.match.home} vs ${data.match.away}`
    });

    console.log("📊 DECISION:", decision);

    /* ===========================
       📊 RESULT FINAL
    ============================ */

    setResult({
      ...model,
      ...decision,
      match: `${data.match.home} vs ${data.match.away}`,
      monteCarlo
    });
  }

  /* ===========================
     🧹 RESET HANDLER
  ============================ */

  function handleReset() {
    const confirm = window.confirm("⚠️ Deseja limpar todo histórico e execuções?");
    if (!confirm) return;

    resetHistory();

    setResult(null);

    window.location.reload();
  }

  return (
    <div style={{ padding: "20px" }}>

      {/* 🔥 BOTÃO RESET */}
      <div style={{ marginBottom: "15px" }}>
        <button
          onClick={handleReset}
          style={{
            background: "#ff4d4f",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          🧹 Resetar Dados
        </button>
      </div>

      <InputPanel onAnalyze={handleAnalyze} />

      {result && (
        <Dashboard data={result} />
      )}

    </div>
  );
}

export default App;