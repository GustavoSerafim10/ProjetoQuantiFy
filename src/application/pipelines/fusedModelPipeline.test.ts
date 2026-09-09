import { describe, expect, it } from "vitest";

import { eliteAnalyzer } from "../orchestrator/eliteAnalyzer";

import { fusedModelPipeline, shouldUseFusedModel } from "./fusedModelPipeline";

/*
 * Achado real em 2026-09-09: o usuário quer estatísticas de time E
 * odds de mercado influenciando o MESMO número, não um "ou isso ou
 * aquilo" (ver eliteAnalyzer.ts e lambdaFusion.ts). Estes testes
 * garantem que:
 *
 * - a fusão só entra em ação quando há odds de múltiplas casas E
 *   estatísticas dos dois times;
 * - o mercado continua sendo a base (o número nunca se afasta mais
 *   de 15% do lambda só-de-mercado);
 * - os caminhos antigos (só stats, só odds) continuam intocados.
 */

const richMarketOdds = {
  home: [1.68, 1.65, 1.70],
  draw: [4.05, 4.0, 4.1],
  away: [4.45, 4.5, 4.4],
  over25: [1.43, 1.45, 1.42],
  under25: [2.72, 2.7, 2.75]
};

const strongHomeStats = {
  matches: 20,
  goalsFor: 44,
  goalsAgainst: 12,
  goalsPerGame: 2.2,
  goalsConcededPerGame: 0.6
};

const weakAwayStats = {
  matches: 20,
  goalsFor: 14,
  goalsAgainst: 30,
  goalsPerGame: 0.7,
  goalsConcededPerGame: 1.5
};

describe("shouldUseFusedModel", () => {
  it("requires both usable multi-book odds and stats for both teams", () => {
    expect(
      shouldUseFusedModel({
        marketOdds: richMarketOdds,
        homeStats: strongHomeStats,
        awayStats: weakAwayStats
      })
    ).toBe(true);

    expect(
      shouldUseFusedModel({
        marketOdds: richMarketOdds,
        homeStats: undefined,
        awayStats: weakAwayStats
      })
    ).toBe(false);

    expect(
      shouldUseFusedModel({
        marketOdds: undefined,
        homeStats: strongHomeStats,
        awayStats: weakAwayStats
      })
    ).toBe(false);
  });
});

describe("fusedModelPipeline", () => {
  it("stays within 15% of the pure market lambda even when stats strongly disagree", () => {
    const marketOnly = fusedModelPipeline({
      league: "Champions League",
      marketOdds: richMarketOdds,
      // neutral/incomplete stats so this call is really about the
      // bound, not about how much stats pull
      homeStats: { matches: 5, goalsFor: 5, goalsAgainst: 5, goalsPerGame: 1, goalsConcededPerGame: 1 },
      awayStats: { matches: 5, goalsFor: 5, goalsAgainst: 5, goalsPerGame: 1, goalsConcededPerGame: 1 }
    });

    const fused = fusedModelPipeline({
      league: "Champions League",
      marketOdds: richMarketOdds,
      homeStats: strongHomeStats,
      awayStats: weakAwayStats
    });

    expect(fused.blocked).toBe(false);

    const marketLambdaHome = marketOnly.debug.fusedModelPipeline.marketLambda.home;
    const marketLambdaAway = marketOnly.debug.fusedModelPipeline.marketLambda.away;

    expect(fused.lambdaHome).toBeLessThanOrEqual(marketLambdaHome * 1.15 + 1e-6);
    expect(fused.lambdaAway).toBeGreaterThanOrEqual(marketLambdaAway * 0.85 - 1e-6);

    // Strong home stats should still nudge the number upward for
    // the home side relative to the pure market lambda.
    expect(fused.lambdaHome).toBeGreaterThan(marketLambdaHome);
  });

  it("returns an empty/blocked response when odds are missing", () => {
    const result = fusedModelPipeline({
      league: "Champions League",
      homeStats: strongHomeStats,
      awayStats: weakAwayStats
    });

    expect(result.blocked).toBe(true);
  });

  it("returns an empty/blocked response when team stats are missing", () => {
    const result = fusedModelPipeline({
      league: "Champions League",
      marketOdds: richMarketOdds
    });

    expect(result.blocked).toBe(true);
  });
});

describe("eliteAnalyzer — fused path wiring", () => {
  it("uses the fused model (STATS_MARKET_FUSION) when both odds and full stats are present", () => {
    const output = eliteAnalyzer({
      match: { home: "Real Madrid", away: "Getafe", league: "La Liga" },
      odds: { home: 1.68, draw: 4.05, away: 4.45, over25: 1.43, under25: 2.72 },
      marketOdds: richMarketOdds,
      homeStats: strongHomeStats,
      awayStats: weakAwayStats
    }) as {
      model?: { leagueReliability?: { key?: string } };
      riskValid?: boolean;
      confidenceValid?: boolean;
      rankingValid?: boolean;
      decisionValid?: boolean;
      markets?: unknown[];
    };

    expect(output.model?.leagueReliability?.key).toBe("STATS_MARKET_FUSION");
    expect(output.riskValid).toBe(true);
    expect(output.confidenceValid).toBe(true);
    expect(output.rankingValid).toBe(true);
    expect(output.decisionValid).toBe(true);
    expect(Array.isArray(output.markets)).toBe(true);
    expect((output.markets as unknown[]).length).toBeGreaterThan(0);
  });

  it("still uses pure market consensus when stats are absent", () => {
    const output = eliteAnalyzer({
      match: { home: "AEK Athens", away: "LASK", league: "Champions League" },
      odds: { home: 1.68, draw: 4.05, away: 4.45, over25: 1.43, under25: 2.72 },
      marketOdds: richMarketOdds
    }) as {
      model?: { leagueReliability?: { key?: string } };
    };

    expect(output.model?.leagueReliability?.key).toBe("MARKET_CONSENSUS");
  });

  it("still uses the legacy stats-only Poisson model when odds are absent", () => {
    const output = eliteAnalyzer({
      match: { home: "Flamengo", away: "Corinthians", league: "Brasileirao" },
      homeStats: strongHomeStats,
      awayStats: weakAwayStats,
      odds: { home: 1.9, draw: 3.4, away: 4.2 }
    }) as {
      model?: { leagueReliability?: { key?: string } };
    };

    expect(output.model?.leagueReliability?.key).not.toBe("MARKET_CONSENSUS");
    expect(output.model?.leagueReliability?.key).not.toBe("STATS_MARKET_FUSION");
  });
});
