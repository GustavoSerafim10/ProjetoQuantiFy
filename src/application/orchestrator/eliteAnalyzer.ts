import { contextPipeline } from "../pipelines/contextPipeline";
import { modelPipeline } from "../pipelines/modelPipeline";
import { simulationPipeline } from "../pipelines/simulationPipeline";
import { probabilityPipeline } from "../pipelines/probabilityPipeline";
import { valuePipeline } from "../pipelines/valuePipeline";
import { riskPipeline } from "../pipelines/riskPipeline";
import { edgePipeline } from "../pipelines/edgePipeline";
import { rankingPipeline } from "../pipelines/rankingPipeline";
import { decisionPipeline } from "../pipelines/decisionPipeline";
import { correlationPipeline } from "../pipelines/correlationPipeline";

export function eliteAnalyzer(input: any) {
  console.log("🔥 ELITE ANALYZER EXECUTOU");

  const context = contextPipeline(input);
  const model = modelPipeline(context);
  const simulation = simulationPipeline(model);
  const probabilities = probabilityPipeline(simulation);
  const valued = valuePipeline(probabilities, input.odds);
  const risked = riskPipeline(valued);
  const edged = edgePipeline(risked);
  const ranked = rankingPipeline(edged);
  const correlated = correlationPipeline(ranked);
  const decision = decisionPipeline(correlated);

  return {
    best: decision.best,
    secondary: decision.secondary,
    elite: decision.elite,
    scalper: decision.scalper,
    watchlist: decision.watchlist,
    combo: decision.combo,
    markets: decision.markets,
    discarded: decision.discarded,
    noBet: decision.noBet,
    reason: decision.reason,
    warnings: decision.warnings,
    debug: decision.debug,
    topScores: simulation.topScores,

    /*
      Mantido como null para não quebrar a UI em casa.
      No trabalho você volta a usar generateQuantifyAIAnalysis.
    */
    aiAnalysis: null,
  };
}