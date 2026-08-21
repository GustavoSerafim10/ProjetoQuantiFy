import type {
  ResolvedNumber,
  MonteCarloMetadata
} from "./types";

import {
  normalizeWarnings,
  parseNonNegativeNumber,
  firstResolvedNonNegative,
  firstNonNegativeNumber,
  firstBoolean,
  firstDefined
} from "./helpers";

/* ==========================================
   EXTRAÇÃO DE INCERTEZA V7.2
========================================== */

export function extractGlobalSamplingError(
  data: any
): ResolvedNumber {
  return firstResolvedNonNegative([
    [data?.maxSamplingError, "data.maxSamplingError"],
    [data?.simulation?.maxSamplingError, "data.simulation.maxSamplingError"],
    [data?.monteCarlo?.maxSamplingError, "data.monteCarlo.maxSamplingError"],
    [data?.debug?.simulationPipeline?.maxSamplingError, "debug.simulationPipeline.maxSamplingError"],
    [data?.monteCarlo?.maxStandardError, "data.monteCarlo.maxStandardError"]
  ]);
}

export function extractGlobalModelSimulationDivergence(
  data: any
): ResolvedNumber {
  return firstResolvedNonNegative([
    [data?.modelSimulationDivergence?.maximum, "data.modelSimulationDivergence.maximum"],
    [data?.modelSimulationDivergence?.average, "data.modelSimulationDivergence.average"],
    [data?.modelDivergence?.maximum, "data.modelDivergence.maximum"],
    [data?.modelDivergence?.average, "data.modelDivergence.average"],
    [data?.simulationDivergence?.maximum, "data.simulationDivergence.maximum"],
    [data?.simulationDivergence?.average, "data.simulationDivergence.average"],
    [data?.debug?.simulationPipeline?.divergence?.maximum, "debug.simulationPipeline.divergence.maximum"],
    [data?.debug?.simulationPipeline?.divergence?.average, "debug.simulationPipeline.divergence.average"]
  ]);
}

export function extractMarketSamplingError({
  data,
  market,
  marketName,
  fallback
}: {
  data: any;
  market: any;
  marketName: string;
  fallback: ResolvedNumber;
}): ResolvedNumber {
  const direct = firstResolvedNonNegative([
    [market?.samplingError, "market.samplingError"],
    [market?.monteCarloSamplingError, "market.monteCarloSamplingError"],
    [market?.debug?.simulationPipeline?.samplingError, "market.debug.simulationPipeline.samplingError"]
  ]);

  if (direct.value !== null) {
    return direct;
  }

  const aliases = getSimulationAliases(marketName);
  const containers: Array<[any, string]> = [
    [data?.monteCarlo?.samplingError, "data.monteCarlo.samplingError"],
    [data?.simulation?.samplingError, "data.simulation.samplingError"],
    [data?.debug?.simulationPipeline?.samplingError, "debug.simulationPipeline.samplingError"],
    [data?.debug?.simulationPipeline?.monteCarlo?.samplingError, "debug.simulationPipeline.monteCarlo.samplingError"]
  ];

  for (const [container, source] of containers) {
    for (const alias of aliases) {
      const value = parseNonNegativeNumber(container?.[alias]);

      if (value !== null) {
        return {
          value,
          source: `${source}.${alias}`
        };
      }
    }
  }

  return {
    value: fallback.value,
    source: fallback.value !== null
      ? `fallback:${fallback.source}`
      : "missing"
  };
}

export function extractMarketModelSimulationDivergence({
  data,
  market,
  marketName,
  fallback
}: {
  data: any;
  market: any;
  marketName: string;
  fallback: ResolvedNumber;
}): ResolvedNumber {
  const direct = firstResolvedNonNegative([
    [market?.modelSimulationDivergence, "market.modelSimulationDivergence"],
    [market?.simulationDivergence, "market.simulationDivergence"],
    [market?.debug?.simulationPipeline?.difference, "market.debug.simulationPipeline.difference"],
    [market?.debug?.simulationPipeline?.diff, "market.debug.simulationPipeline.diff"]
  ]);

  if (direct.value !== null) {
    return direct;
  }

  const aliases = getSimulationAliases(marketName);
  const containers: Array<[any, string]> = [
    [data?.monteCarlo?.modelComparison, "data.monteCarlo.modelComparison"],
    [data?.debug?.simulationPipeline?.modelComparison, "debug.simulationPipeline.modelComparison"]
  ];

  for (const [container, source] of containers) {
    if (!container || typeof container !== "object") {
      continue;
    }

    for (const alias of aliases) {
      const entry = container[alias];
      const value = firstNonNegativeNumber([
        entry?.diff,
        entry?.difference,
        entry?.absoluteDifference,
        entry?.rawDifference
      ]);

      if (value !== null) {
        return {
          value,
          source: `${source}.${alias}`
        };
      }
    }
  }

  return {
    value: fallback.value,
    source: fallback.value !== null
      ? `fallback:${fallback.source}`
      : "missing"
  };
}

export function extractMonteCarloMetadata(
  data: any
): MonteCarloMetadata {
  return {
    valid: firstBoolean([
      data?.monteCarlo?.valid,
      data?.simulation?.valid,
      data?.debug?.simulationPipeline?.valid
    ]),

    converged: firstBoolean([
      data?.monteCarlo?.converged,
      data?.monteCarlo?.convergence?.converged,
      data?.simulation?.converged,
      data?.debug?.simulationPipeline?.converged
    ]),

    simulationQuality: normalizeSimulationQuality(
      firstDefined([
        data?.monteCarlo?.simulationQuality,
        data?.simulation?.simulationQuality,
        data?.debug?.simulationPipeline?.simulationQuality
      ])
    ),

    warnings: normalizeWarnings([
      ...normalizeWarnings(data?.monteCarlo?.warnings),
      ...normalizeWarnings(data?.simulation?.warnings),
      ...normalizeWarnings(data?.debug?.simulationPipeline?.warnings)
    ])
  };
}

export function getSimulationAliases(
  market: string
): string[] {
  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return ["HOME_WIN", "HOME", "homeWin", "home"];

    case "DRAW":
      return ["DRAW", "draw"];

    case "AWAY":
    case "AWAY_WIN":
      return ["AWAY_WIN", "AWAY", "awayWin", "away"];

    case "OVER_1_5":
    case "OVER15":
      return ["OVER_1_5", "over15"];

    case "OVER_2_5":
    case "OVER25":
      return ["OVER_2_5", "over25"];

    case "BTTS_YES":
      return ["BTTS_YES", "bttsYes"];

    case "BTTS_NO":
      return ["BTTS_NO", "bttsNo"];

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return ["DOUBLE_CHANCE_1X", "doubleChance1X", "oneX"];

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return ["DOUBLE_CHANCE_X2", "doubleChanceX2", "xTwo"];

    default:
      return [];
  }
}

export function normalizeSimulationQuality(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    return normalized || null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return normalizeSimulationQuality(
      (value as any)?.classification ??
      (value as any)?.level ??
      (value as any)?.quality
    );
  }

  return null;
}
