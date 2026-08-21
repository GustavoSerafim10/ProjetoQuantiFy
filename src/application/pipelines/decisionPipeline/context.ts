import type { DecisionContextMetrics } from "./types";

import {
  firstFiniteNumber,
  firstProbability,
  clamp,
  roundNumber
} from "./helpers";

/* ==========================================
   CONTEXTO OPERACIONAL — DECISION V2
========================================== */

export function buildDecisionContextMetrics(
  data: any
): DecisionContextMetrics {
  const homeProbability =
    firstProbability([
      data?.probabilities?.HOME,
      data?.probs?.HOME,
      data?.result?.home,
      data?.homeProbability
    ]);

  const drawProbability =
    firstProbability([
      data?.probabilities?.DRAW,
      data?.probs?.DRAW,
      data?.result?.draw,
      data?.drawProbability
    ]);

  const awayProbability =
    firstProbability([
      data?.probabilities?.AWAY,
      data?.probs?.AWAY,
      data?.result?.away,
      data?.awayProbability
    ]);

  const lambdaHome =
    firstFiniteNumber([
      data?.lambdaHome,
      data?.model?.lambdaHome,
      data?.monteCarlo?.lambdaHome,
      data?.context?.lambdaHome
    ]);

  const lambdaAway =
    firstFiniteNumber([
      data?.lambdaAway,
      data?.model?.lambdaAway,
      data?.monteCarlo?.lambdaAway,
      data?.context?.lambdaAway
    ]);

  const totalLambdaFromData =
    firstFiniteNumber([
      data?.totalLambda,
      data?.monteCarlo?.totalLambda,
      data?.model?.totalLambda
    ]);

  const totalLambda =
    totalLambdaFromData ??
    (
      lambdaHome !== null &&
      lambdaAway !== null
        ? lambdaHome + lambdaAway
        : null
    );

  const homeSample =
    firstFiniteNumber([
      data?.homeStats?.matchesPlayed,
      data?.homeStats?.matches,
      data?.stats?.home?.matchesPlayed,
      data?.stats?.home?.matches
    ]);

  const awaySample =
    firstFiniteNumber([
      data?.awayStats?.matchesPlayed,
      data?.awayStats?.matches,
      data?.stats?.away?.matchesPlayed,
      data?.stats?.away?.matches
    ]);

  const minimumSampleSize =
    homeSample !== null &&
    awaySample !== null
      ? Math.max(
          0,
          Math.floor(
            Math.min(
              homeSample,
              awaySample
            )
          )
        )
      : null;

  /*
   * 20 partidas representam confiabilidade cheia.
   * Isso não altera a probabilidade; apenas informa
   * a política operacional.
   */
  /*
   * A decisão consome primeiro a qualidade já
   * consolidada pelo Confidence Pipeline V7.2.
   *
   * Somente na ausência dessa fonte usamos
   * compatibilidade e, por último, tamanho amostral.
   */
  const providedSampleReliability =
    firstProbability([
      data?.debug?.confidencePipeline?.sampleReliability,
      data?.effectiveSampleReliability,
      data?.sampleReliability,
      data?.dataQuality?.sampleReliability,
      data?.context?.sampleReliability,
      data?.debug?.dataNormalizer?.sampleReliability,
      data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.inputQuality,
      data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality
    ]);

  const sampleReliability =
    providedSampleReliability ??
    (
      minimumSampleSize !== null
        ? clamp(
            minimumSampleSize / 20,
            0,
            1
          )
        : null
    );

  /*
   * Fallback de liga neutralizado no Confidence
   * Pipeline deve chegar intacto à decisão.
   */
/*
   * Prioridade:
   * 1) valor já resolvido pelo ConfidencePipeline
   *    (não reconsulta a liga);
   * 2) fonte oficial leagueReliability;
   * 3) compatibilidade legada — removida no
   *    Commit 3.
   */
  const leagueTrust =
    firstProbability([
      data?.debug?.confidencePipeline?.leagueTrust,
      data?.leagueReliability?.dataReliability,
      data?.leagueTrust,
      data?.leagueConfig?.trust,
      data?.leagueConfig?.dataReliability,
      data?.dataQuality?.leagueTrust,
      data?.leagueStrength?.dataReliability,
      data?.debug?.leagueConfig?.trust,
      data?.debug?.leagueConfig?.dataReliability
    ]);

  const globalConfidence =
    firstProbability([
      data?.globalConfidence,
      data?.modelConfidence,
      data?.debug?.confidencePipeline?.globalConfidence,
      data?.debug?.globalConfidencePipeline?.confidence
    ]);

  const goalExpectationScore =
    firstProbability([
      data?.goalExpectationScore,
      data?.model?.goalExpectationScore,
      data?.debug?.modelPipeline?.goalExpectationScore
    ]);

  const contextualGoalExpectationScore =
    firstProbability([
      data?.contextualGoalExpectationScore,
      data?.marketContext?.contextualGoalExpectationScore,
      data?.context?.contextualGoalExpectationScore,
      data?.debug?.contextPipeline?.contextualGoalExpectationScore,
      data?.marketContext?.goalExpectationScore
    ]);

  const matchBalanceIndex =
    calculateMatchBalanceIndex({
      homeProbability,
      drawProbability,
      awayProbability
    });

  const dominance =
    calculateDominanceScores({
      homeProbability,
      awayProbability,
      lambdaHome,
      lambdaAway
    });

  const league =
    String(
      data?.league ??
      data?.context?.league ??
      data?.input?.league ??
      ""
    ).trim();

  return {
    homeProbability,
    drawProbability,
    awayProbability,

    lambdaHome,
    lambdaAway,
    totalLambda,

    matchBalanceIndex,

    homeDominanceScore:
      dominance.home,

    awayDominanceScore:
      dominance.away,

    minimumSampleSize,
    sampleReliability,
    leagueTrust,

    globalConfidence,

    goalExpectationScore,
    contextualGoalExpectationScore,

    league
  };
}

function calculateMatchBalanceIndex({
  homeProbability,
  drawProbability,
  awayProbability
}: {
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;
}): number | null {
  if (
    homeProbability === null ||
    drawProbability === null ||
    awayProbability === null
  ) {
    return null;
  }

  const probabilities = [
    homeProbability,
    drawProbability,
    awayProbability
  ];

  const maximum =
    Math.max(
      ...probabilities
    );

  const minimum =
    Math.min(
      ...probabilities
    );

  const spread =
    maximum - minimum;

  /*
   * Próximo de 1:
   * jogo muito equilibrado.
   *
   * Próximo de 0:
   * existe dominância clara.
   */
  return roundNumber(
    clamp(
      1 - spread / 0.50,
      0,
      1
    )
  );
}

function calculateDominanceScores({
  homeProbability,
  awayProbability,
  lambdaHome,
  lambdaAway
}: {
  homeProbability: number | null;
  awayProbability: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
}): {
  home: number | null;
  away: number | null;
} {
  if (
    homeProbability === null ||
    awayProbability === null
  ) {
    return {
      home: null,
      away: null
    };
  }

  const probabilityDifference =
    homeProbability -
    awayProbability;

  const probabilityComponent =
    clamp(
      0.50 +
      probabilityDifference * 1.50,
      0,
      1
    );

  const lambdaComponent =
    lambdaHome !== null &&
    lambdaAway !== null
      ? clamp(
          0.50 +
          (
            lambdaHome -
            lambdaAway
          ) * 0.30,
          0,
          1
        )
      : 0.50;

  const homeDominance =
    clamp(
      probabilityComponent * 0.70 +
      lambdaComponent * 0.30,
      0,
      1
    );

  return {
    home:
      roundNumber(
        homeDominance
      ),

    away:
      roundNumber(
        1 - homeDominance
      )
  };
}
