import { describe, expect, it } from "vitest";

import { buildDecisionExplanation } from "./explain";
import type { DecisionMarketPolicy } from "./types";

const POLICY: DecisionMarketPolicy = {
  minimumOdd: 1.3,
  watchlist: {
    minimumProbability: 0.5,
    minimumEv: 0.02,
    maximumRisk: 0.65,
    minimumConfidence: 0.5
  },
  bet: {
    minimumProbability: 0.55,
    minimumEv: 0.05,
    maximumRisk: 0.6,
    minimumConfidence: 0.55
  },
  elite: {
    minimumProbability: 0.65,
    minimumEv: 0.1,
    maximumRisk: 0.5,
    minimumConfidence: 0.65
  }
};

/*
 * Fase 1 do Decision Intelligence Layer é telemetria pura: o
 * mesmo `classification` que já existia entra aqui, e o teste
 * confirma que buildDecisionExplanation só organiza/narra —
 * nunca decide nada por conta própria.
 */
describe("buildDecisionExplanation", () => {
  it("aposta aprovada reúne evidências positivas e nenhum motivo negativo além dos blockers reais", () => {
    const explanation = buildDecisionExplanation({
      marketName: "DOUBLE_CHANCE_X2",
      policy: POLICY,

      probability: 0.608,
      ev: 0.1555,
      probabilityEdge: 0.08,
      risk: 0.4,
      confidence: 0.6,

      sampleReliability: 0.9,
      leagueTrust: 0.8,
      globalConfidence: 0.7,
      modelAgreementScore: 0.9,
      effectiveProbability: 0.608,
      uncertaintyPenalty: 0,
      robustnessScore: 1,
      decisionScore: 88,
      extremeValueClassification: "NORMAL_VALUE",
      familyConsensus: null,
      decisionState: "BET",

      guardBlockers: [],
      guardWarnings: [],

      operationalBlockers: [],
      operationalWarnings: [],

      baseClassification: "BET",
      classification: "BET"
    });

    expect(explanation.decision).toBe("BET");
    expect(explanation.downgraded).toBe(false);
    expect(explanation.summary).toBe("BET APROVADA (Score 88/100)");

    expect(
      explanation.positives.some(item => item.startsWith("EV"))
    ).toBe(true);

    expect(
      explanation.positives.some(item => item.startsWith("edge"))
    ).toBe(true);

    expect(explanation.negatives).toHaveLength(0);

    // §12: mesmos sinais, como códigos.
    expect(explanation.decisionDrivers).toContain("POSITIVE_EV");
    expect(explanation.decisionDrivers).toContain("POSITIVE_EDGE");
    expect(explanation.decisionDrivers).toContain(
      "HIGH_MODEL_AGREEMENT"
    );
    expect(explanation.decisionDrivers).toContain(
      "ROBUST_TO_LAMBDA_PERTURBATION"
    );
    expect(explanation.decisionWarnings).toHaveLength(0);
  });

  it("§7/§9: EV suspeito e consenso de família viram códigos em decisionWarnings/decisionDrivers", () => {
    const explanation = buildDecisionExplanation({
      marketName: "UNDER_2_5",
      policy: POLICY,

      probability: 0.6,
      ev: 1.2,
      probabilityEdge: 0.08,
      risk: 0.3,
      confidence: 0.6,

      sampleReliability: 0.9,
      leagueTrust: 0.8,
      globalConfidence: 0.7,
      modelAgreementScore: 0.9,
      effectiveProbability: 0.6,
      uncertaintyPenalty: 0,
      robustnessScore: 1,
      decisionScore: 70,
      extremeValueClassification: "SUSPICIOUS_VALUE",
      familyConsensus: {
        direction: "LOW_SCORING",
        confirmingMarkets: ["BTTS_NO"]
      },
      decisionState: "INVESTIGATE",

      guardBlockers: [],
      guardWarnings: [],

      operationalBlockers: [],
      operationalWarnings: [],

      baseClassification: "BET",
      classification: "BET"
    });

    expect(explanation.decisionWarnings).toContain(
      "SUSPICIOUS_VALUE_FLAG"
    );
    expect(explanation.decisionDrivers).toContain(
      "MARKET_FAMILY_CONSENSUS"
    );
    expect(
      explanation.positives.some(item => item.includes("BTTS_NO"))
    ).toBe(true);
    expect(explanation.summary).toContain("INVESTIGATE");
  });

  it("classificação rebaixada pela política operacional aparece explicitamente em negatives", () => {
    const explanation = buildDecisionExplanation({
      marketName: "OVER_2_5",
      policy: POLICY,

      probability: 0.7,
      ev: 0.12,
      probabilityEdge: 0.06,
      risk: 0.3,
      confidence: 0.62,

      sampleReliability: 0.3,
      leagueTrust: 0.9,
      globalConfidence: 0.8,
      modelAgreementScore: 0.4,
      effectiveProbability: 0.65,
      uncertaintyPenalty: 0.05,
      robustnessScore: 0.5,
      decisionScore: 45,
      extremeValueClassification: "NORMAL_VALUE",
      familyConsensus: null,
      decisionState: "WATCHLIST",

      guardBlockers: [],
      guardWarnings: [],

      operationalBlockers: [],
      operationalWarnings: ["LOW_SAMPLE_RELIABILITY"],

      baseClassification: "ELITE",
      classification: "WATCHLIST"
    });

    expect(explanation.downgraded).toBe(true);
    expect(explanation.negatives).toContain("LOW_SAMPLE_RELIABILITY");
    expect(
      explanation.negatives.some(item =>
        item.includes("ELITE") && item.includes("WATCHLIST")
      )
    ).toBe(true);
    expect(explanation.summary).toBe(
      "WATCHLIST — evidência insuficiente para aposta (Score 45/100)"
    );
  });

  it("NO BET bloqueado por guard mostra o blocker real, sem inventar positivas", () => {
    const explanation = buildDecisionExplanation({
      marketName: "HOME",
      policy: null,

      probability: null,
      ev: null,
      probabilityEdge: null,
      risk: null,
      confidence: null,

      sampleReliability: null,
      leagueTrust: null,
      globalConfidence: null,
      modelAgreementScore: null,
      effectiveProbability: null,
      uncertaintyPenalty: null,
      robustnessScore: null,
      decisionScore: null,
      extremeValueClassification: null,
      familyConsensus: null,
      decisionState: "NO_BET",

      guardBlockers: ["INVALID_PROBABILITY"],
      guardWarnings: [],

      operationalBlockers: [],
      operationalWarnings: [],

      baseClassification: "NO BET",
      classification: "NO BET"
    });

    expect(explanation.summary).toBe("NO BET");
    expect(explanation.negatives).toContain("INVALID_PROBABILITY");
    expect(explanation.positives).toHaveLength(0);
  });
});
