import { describe, expect, it } from "vitest";

import { eliteAnalyzer } from "../orchestrator/eliteAnalyzer";

import { marketModelPipeline } from "./marketModelPipeline";

/*
 * Regressão do achado real em 2026-09-08: o motor Poisson-de-stats
 * (modelPipeline) bloqueava riskPipeline/decisionPipeline inteiros
 * (NO_BET forçado) sempre que lambdaHome/lambdaAway estivessem
 * ausentes. Estes testes garantem que o caminho de consenso de-vig
 * nunca cai nessa armadilha — todo o Decision Intelligence Layer
 * downstream (risco, correlação, confiança, ranking, decisão)
 * precisa continuar válido mesmo sem nenhuma stat de time.
 */

describe("marketModelPipeline", () => {
  it("returns invalid/blocked when there is no usable multi-book odds", () => {
    const result = marketModelPipeline({});

    expect(result.blocked).toBe(true);
  });

  it("produces a full market probability contract from multi-book odds alone", () => {
    const result = marketModelPipeline({
      league: "Champions League",
      marketOdds: {
        home: [1.68],
        draw: [4.05],
        away: [4.45],
        over25: [1.43],
        under25: [2.72]
      }
    });

    expect(result.blocked).toBe(false);
    expect(result.lambdaHome).toBeGreaterThan(0);
    expect(result.lambdaAway).toBeGreaterThan(0);

    /*
     * De-vig da AEK x LASK (fixture real, ver devig.test.ts):
     * ~55,7% de vitória do mandante.
     */
    expect(result.result.home).toBeCloseTo(0.557, 1);
    expect(result.leagueReliability.key).toBe("MARKET_CONSENSUS");
  });

  it("keeps risk/confidence/ranking/decision valid end-to-end through eliteAnalyzer, without any team stats", () => {
    const output = eliteAnalyzer({
      match: { home: "AEK Athens", away: "LASK", league: "Champions League" },
      odds: { home: 1.68, draw: 4.05, away: 4.45, over25: 1.43, under25: 2.72 },
      marketOdds: {
        home: [1.68],
        draw: [4.05],
        away: [4.45],
        over25: [1.43],
        under25: [2.72]
      }
    }) as {
      riskValid?: boolean;
      confidenceValid?: boolean;
      rankingValid?: boolean;
      decisionValid?: boolean;
      markets?: unknown[];
    };

    expect(output.riskValid).toBe(true);
    expect(output.confidenceValid).toBe(true);
    expect(output.rankingValid).toBe(true);
    expect(output.decisionValid).toBe(true);
    expect(Array.isArray(output.markets)).toBe(true);
    expect((output.markets as unknown[]).length).toBeGreaterThan(0);
  });

  it("finds positive EV when the single-book price beats the multi-book consensus", () => {
    const output = eliteAnalyzer({
      match: { home: "Real Madrid", away: "Inter", league: "Champions League" },
      odds: { home: 1.75, draw: 4.45, away: 4.95 },
      marketOdds: {
        home: [1.58, 1.60, 1.55],
        draw: [4.45, 4.45, 4.40],
        away: [5.15, 4.95, 5.10]
      }
    }) as {
      markets?: Array<{ market: string; ev: number; hasValue?: boolean }>;
    };

    const homeMarket = output.markets?.find(m => m.market === "HOME");

    expect(homeMarket?.ev).toBeGreaterThan(0);
  });

  it("legacy stats-based modelPipeline path is untouched when marketOdds is absent", () => {
    const output = eliteAnalyzer({
      match: { home: "Flamengo", away: "Corinthians", league: "Brasileirao" },
      homeStats: {
        matches: 10,
        goalsFor: 18,
        goalsAgainst: 8,
        goalsPerGame: 1.8,
        goalsConcededPerGame: 0.8
      },
      awayStats: {
        matches: 10,
        goalsFor: 12,
        goalsAgainst: 10,
        goalsPerGame: 1.2,
        goalsConcededPerGame: 1.0
      },
      odds: { home: 1.9, draw: 3.4, away: 4.2 }
    }) as {
      model?: { leagueReliability?: { key?: string } };
    };

    expect(output.model?.leagueReliability?.key).not.toBe(
      "MARKET_CONSENSUS"
    );
  });
});
