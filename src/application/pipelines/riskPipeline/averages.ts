import type { ResolvedNumber } from "./types";
import type { PipelineRecord } from "../pipelineRecord";

import {
  firstPositiveNumber,
  firstNonNegativeNumber,
  firstResolvedProbability
} from "./helpers";

/* ==========================================
   EXTRAÇÃO DAS MÉDIAS
========================================== */

export function extractLeagueAverageGoals(
  data: PipelineRecord
): number | null {
  const candidates = [
    data?.leagueAvgGoals,

    data?.leagueAverageGoals,

    data?.leagueConfig
      ?.averageGoals,

    data?.leagueConfig
      ?.avgGoals,

    data?.debug
      ?.modelPipeline
      ?.leagueAvgGoals
  ];

  return firstPositiveNumber(
    candidates
  );
}

export function extractRecentGoalStd(
  data: PipelineRecord
): number | null {
  const candidates = [
    data?.recentGoalStd,

    data?.recentTotalGoalsStd,

    data?.volatility
      ?.recentGoalStd,

    data?.debug
      ?.contextPipeline
      ?.recentGoalStd
  ];

  return firstNonNegativeNumber(
    candidates
  );
}

export function extractSeasonGoalAverage(
  data: PipelineRecord
): number | null {
  const candidates = [
    data?.seasonGoalAvg,

    data?.seasonAverageGoals,

    data?.seasonTotalGoalsAverage,

    data?.debug
      ?.contextPipeline
      ?.seasonGoalAvg
  ];

  return firstPositiveNumber(
    candidates
  );
}

export function extractDataQualityScore(
  data: PipelineRecord
): ResolvedNumber {
  return firstResolvedProbability([
    [data?.dataQualityScore, "data.dataQualityScore"],
    [data?.inputQualityScore, "data.inputQualityScore"],
    [data?.statisticalDataQuality, "data.statisticalDataQuality"],
    [data?.debug?.dataNormalizer?.qualityScore, "debug.dataNormalizer.qualityScore"],
    [data?.debug?.contextPipeline?.dataQualityScore, "debug.contextPipeline.dataQualityScore"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality.inputQuality"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality"]
  ]);
}
