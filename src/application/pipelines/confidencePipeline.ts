import {
  calculateMarketConfidence
} from "../../domain/analysis/confidenceEngine";

import type { PipelineRecord } from "./pipelineRecord";

/* ==========================================
   CONFIDENCE PIPELINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados com probabilidade já calculada;
 * - receber lambdas e confiança global já consolidados;
 * - calcular confiança específica por mercado;
 * - encaminhar sinais estruturais e de qualidade;
 * - preservar probability, odds, EV, risk e ranking;
 * - registrar diagnóstico detalhado.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade;
 * - recalcula EV;
 * - recalcula risco;
 * - usa odds, EV, Kelly ou risk como confiança;
 * - altera odds;
 * - classifica entrada;
 * - escolhe o melhor mercado;
 * - toma decisão final.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface ConfidencePipelineMarketDebug {
  valid: boolean;

  market: string;

  probability: number | null;

  lambdaHome: number | null;
  lambdaAway: number | null;

  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;

  globalConfidence: number | null;

  sampleReliability: number | null;
  leagueTrust: number | null;

  rawSampleReliability?: number | null;
  inputQuality?: number | null;
  sampleReliabilitySource?: string;

  rawLeagueTrust?: number | null;
  leagueTrustSource?: string;
  leagueFallbackUsed?: boolean;

  globalConfidenceSource?: string;

  monteCarloValid?: boolean | null;
  monteCarloConverged?: boolean | null;
  simulationQuality?: unknown;

  monteCarloProbability: number | null;
  poissonProbability: number | null;

  confidence: number;

  warnings: string[];

  error?: string;
}

export interface ConfidencePipelineDebug {
  valid: boolean;

  inputMarkets: number;
  outputMarkets: number;

  validMarkets: number;
  invalidMarkets: number;

  lambdaHome: number | null;
  lambdaAway: number | null;

  globalConfidence: number | null;

  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;

  sampleReliability: number | null;
  leagueTrust: number | null;

  version?: "V7.2_ELITE";
  rawSampleReliability?: number | null;
  inputQuality?: number | null;
  sampleReliabilitySource?: string;

  rawLeagueTrust?: number | null;
  leagueTrustSource?: string;
  leagueFallbackUsed?: boolean;

  globalConfidenceSource?: string;

  monteCarloValid?: boolean | null;
  monteCarloConverged?: boolean | null;
  simulationQuality?: unknown;

  error?: string;

  note:
    "Confidence measures model reliability per market; value, risk and decision remain independent.";
}

/* ==========================================
   PIPELINE
========================================== */

export function confidencePipeline(
  data: PipelineRecord
) {
  const inputMarkets =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  const lambdaHome =
    firstPositiveNumber([
      data?.lambdaHome,
      data?.model?.lambdaHome,
      data?.expectedGoals?.lambdaHome,
      data?.debug?.modelPipeline?.lambdaHome
    ]);

  const lambdaAway =
    firstPositiveNumber([
      data?.lambdaAway,
      data?.model?.lambdaAway,
      data?.expectedGoals?.lambdaAway,
      data?.debug?.modelPipeline?.lambdaAway
    ]);

  /*
   * V7.2: fonte canônica primeiro.
   * data.confidence permanece apenas como alias legado.
   */
  const globalConfidenceResolution =
    resolveGlobalConfidence(data);

  const globalConfidence =
    globalConfidenceResolution.value;

  /*
   * O score oficial e o contextual não são mais
   * misturados silenciosamente.
   */
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

      /*
       * Alias legado do contextPipeline.
       */
      data?.marketContext?.goalExpectationScore
    ]);

  const rawSampleReliabilityResolution =
    resolveRawSampleReliability(data);

  const inputQualityResolution =
    resolveInputQuality(data);

  const sampleReliabilityResolution =
    resolveEffectiveSampleReliability(
      rawSampleReliabilityResolution,
      inputQualityResolution
    );

  const sampleReliability =
    sampleReliabilityResolution.value;

 const rawLeagueTrustResolution =
    resolveRawLeagueTrust(data);

  const leagueReliabilitySourceWarning: string | null =
    rawLeagueTrustResolution.source.endsWith(":legacy")
      ? "LEAGUE_RELIABILITY_LEGACY_SOURCE_USED"
      : rawLeagueTrustResolution.value === null
        ? "LEAGUE_RELIABILITY_UNAVAILABLE"
        : null;

  const leagueFallbackUsed =
    detectLeagueFallback(data);

  const leagueTrustResolution =
    resolveEffectiveLeagueTrust(
      rawLeagueTrustResolution,
      leagueFallbackUsed
    );

  const leagueTrust =
    leagueTrustResolution.value;

  const monteCarloMetadata =
    extractMonteCarloMetadata(data);

  if (inputMarkets.length === 0) {
    return createEmptyPipelineResult({
      data,
      globalConfidence,
      lambdaHome,
      lambdaAway,
      goalExpectationScore,
      contextualGoalExpectationScore,
      sampleReliability,
      leagueTrust
    });
  }

  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidPipelineResult({
      data,
      inputMarkets,
      globalConfidence,
      lambdaHome,
      lambdaAway,
      goalExpectationScore,
      contextualGoalExpectationScore,
      sampleReliability,
      leagueTrust,
      error:
        "INVALID_CONFIDENCE_LAMBDAS"
    });
  }

  let validMarkets = 0;
  let invalidMarkets = 0;

  const markets =
    inputMarkets.map(
      (market: PipelineRecord) => {
        const marketName =
          normalizeMarketName(
            market?.market
          );

        const probability =
          firstProbability([
            market?.probability,
            market?.modelProbability,
            market?.calibratedProbability
          ]);

        const marketSampleReliability =
          firstProbability([
            market?.effectiveSampleReliability,
            market?.sampleReliability,
            sampleReliability
          ]);

        const marketLeagueTrust =
          leagueFallbackUsed
            ? 0.50
            : firstProbability([
                market?.leagueTrust,
                market?.dataReliability,
                leagueTrust
              ]);

        const marketGoalExpectationScore =
          firstProbability([
            market?.goalExpectationScore,
            goalExpectationScore
          ]);

        const marketContextualGoalExpectationScore =
          firstProbability([
            market?.contextualGoalExpectationScore,
            contextualGoalExpectationScore
          ]);

        const monteCarloProbability =
          extractMonteCarloProbability(
            data,
            market,
            marketName
          );

        const poissonProbability =
          extractPoissonProbability(
            data,
            market,
            marketName
          );

        if (
          !marketName ||
          probability === null
        ) {
          invalidMarkets++;

          const warnings =
            normalizeWarnings([
              ...normalizeWarnings(
                market?.warnings
              ),

              !marketName
                ? "UNSUPPORTED_CONFIDENCE_MARKET"
                : "",

              probability === null
                ? "INVALID_CONFIDENCE_PROBABILITY"
                : "",

              "INVALID_CONFIDENCE_INPUT"
            ]);

          const debug:
            ConfidencePipelineMarketDebug = {
              valid: false,

              market:
                marketName,

              probability,

              lambdaHome,
              lambdaAway,

              goalExpectationScore:
                marketGoalExpectationScore,

              contextualGoalExpectationScore:
                marketContextualGoalExpectationScore,

              globalConfidence,

              globalConfidenceSource:
                globalConfidenceResolution.source,

              sampleReliability:
                marketSampleReliability,

              rawSampleReliability:
                rawSampleReliabilityResolution.value,

              inputQuality:
                inputQualityResolution.value,

              sampleReliabilitySource:
                sampleReliabilityResolution.source,

              leagueTrust:
                marketLeagueTrust,

              rawLeagueTrust:
                rawLeagueTrustResolution.value,

              leagueTrustSource:
                leagueTrustResolution.source,

              leagueFallbackUsed,

              monteCarloValid:
                monteCarloMetadata.valid,

              monteCarloConverged:
                monteCarloMetadata.converged,

              simulationQuality:
                monteCarloMetadata.simulationQuality,

              monteCarloProbability,
              poissonProbability,

              confidence: 0,

              warnings,

              error:
                "INVALID_CONFIDENCE_INPUT"
            };

          return {
            ...market,

            confidence: 0,
            confidenceValid: false,

            warnings,

            debug: {
              ...(market?.debug ?? {}),

              confidencePipeline:
                debug
            }
          };
        }

        const result =
          calculateMarketConfidence({
            probability,

            lambdaHome,
            lambdaAway,

            market:
              marketName,

            goalExpectationScore:
              marketGoalExpectationScore,

            contextualGoalExpectationScore:
              marketContextualGoalExpectationScore,

            monteCarloProb:
              monteCarloProbability,

            poissonProb:
              poissonProbability,

            globalConfidence,

            sampleReliability:
              marketSampleReliability,

            leagueTrust:
              marketLeagueTrust
          });

        if (result.valid) {
          validMarkets++;
        } else {
          invalidMarkets++;
        }

        const sourceWarnings =
          buildSourceWarnings({
            data,
            goalExpectationScore:
              marketGoalExpectationScore,
            contextualGoalExpectationScore:
              marketContextualGoalExpectationScore,
            monteCarloProbability,
            poissonProbability,
            globalConfidence,
            sampleReliability:
              marketSampleReliability,
            leagueTrust:
              marketLeagueTrust
          });

 const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            ...sourceWarnings,

            ...(
              leagueReliabilitySourceWarning
                ? [leagueReliabilitySourceWarning]
                : []
            ),

            ...result.warnings
          ]);
        const debug:
          ConfidencePipelineMarketDebug = {
            valid:
              result.valid,

            market:
              marketName,

            probability,

            lambdaHome,
            lambdaAway,

            goalExpectationScore:
              marketGoalExpectationScore,

            contextualGoalExpectationScore:
              marketContextualGoalExpectationScore,

            globalConfidence,

            globalConfidenceSource:
              globalConfidenceResolution.source,

            sampleReliability:
              marketSampleReliability,

            rawSampleReliability:
              rawSampleReliabilityResolution.value,

            inputQuality:
              inputQualityResolution.value,

            sampleReliabilitySource:
              sampleReliabilityResolution.source,

            leagueTrust:
              marketLeagueTrust,

            rawLeagueTrust:
              rawLeagueTrustResolution.value,

            leagueTrustSource:
              leagueTrustResolution.source,

            leagueFallbackUsed,

            monteCarloValid:
              monteCarloMetadata.valid,

            monteCarloConverged:
              monteCarloMetadata.converged,

            simulationQuality:
              monteCarloMetadata.simulationQuality,

            monteCarloProbability,
            poissonProbability,

            confidence:
              result.confidence,

            warnings,

            ...(
              result.valid
                ? {}
                : {
                    error:
                      "CONFIDENCE_ENGINE_REJECTED_MARKET"
                  }
            )
          };

        return {
          ...market,

          /*
           * O pipeline modifica somente a confiança
           * e os campos de diagnóstico relacionados.
           */
          confidence:
            result.confidence,

          confidenceValid:
            result.valid,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            confidencePipeline: {
              ...debug,

              engine:
                result
            }
          }
        };
      }
    );

  const pipelineValid =
    validMarkets > 0;

  const debug:
    ConfidencePipelineDebug = {
      valid:
        pipelineValid,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets,
      invalidMarkets,

      lambdaHome,
      lambdaAway,

      globalConfidence,

      goalExpectationScore,
      contextualGoalExpectationScore,

      sampleReliability,
      leagueTrust,

      version:
        "V7.2_ELITE",

      rawSampleReliability:
        rawSampleReliabilityResolution.value,

      inputQuality:
        inputQualityResolution.value,

      sampleReliabilitySource:
        sampleReliabilityResolution.source,

      rawLeagueTrust:
        rawLeagueTrustResolution.value,

      leagueTrustSource:
        leagueTrustResolution.source,

      leagueFallbackUsed,

      globalConfidenceSource:
        globalConfidenceResolution.source,

      monteCarloValid:
        monteCarloMetadata.valid,

      monteCarloConverged:
        monteCarloMetadata.converged,

      simulationQuality:
        monteCarloMetadata.simulationQuality,

      ...(
        pipelineValid
          ? {}
          : {
              error:
                "NO_VALID_CONFIDENCE_MARKETS"
            }
      ),

      note:
        "Confidence measures model reliability per market; value, risk and decision remain independent."
    };

  return {
    ...data,

    confidenceValid:
      pipelineValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      confidencePipeline:
        debug
    }
  };
}

/* ==========================================
   RESULTADO SEM MERCADOS
========================================== */

function createEmptyPipelineResult({
  data,
  globalConfidence,
  lambdaHome,
  lambdaAway,
  goalExpectationScore,
  contextualGoalExpectationScore,
  sampleReliability,
  leagueTrust
}: {
  data: PipelineRecord;
  globalConfidence: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
  sampleReliability: number | null;
  leagueTrust: number | null;
}) {
  const debug:
    ConfidencePipelineDebug = {
      valid: false,

      inputMarkets: 0,
      outputMarkets: 0,

      validMarkets: 0,
      invalidMarkets: 0,

      lambdaHome,
      lambdaAway,

      globalConfidence,

      goalExpectationScore,
      contextualGoalExpectationScore,

      sampleReliability,
      leagueTrust,

      error:
        "NO_MARKETS_FOR_CONFIDENCE",

      note:
        "Confidence measures model reliability per market; value, risk and decision remain independent."
    };

  return {
    ...data,

    confidenceValid: false,

    markets: [],

    debug: {
      ...(data?.debug ?? {}),

      confidencePipeline:
        debug
    }
  };
}

/* ==========================================
   RESULTADO GLOBAL INVÁLIDO
========================================== */

function createInvalidPipelineResult({
  data,
  inputMarkets,
  globalConfidence,
  lambdaHome,
  lambdaAway,
  goalExpectationScore,
  contextualGoalExpectationScore,
  sampleReliability,
  leagueTrust,
  error
}: {
  data: PipelineRecord;
  inputMarkets: PipelineRecord[];
  globalConfidence: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
  sampleReliability: number | null;
  leagueTrust: number | null;
  error: string;
}) {
  const markets =
    inputMarkets.map(
      (market: PipelineRecord) => {
        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            error
          ]);

        return {
          ...market,

          confidence: 0,
          confidenceValid: false,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            confidencePipeline: {
              valid: false,

              market:
                normalizeMarketName(
                  market?.market
                ),

              probability:
                firstProbability([
                  market?.probability,
                  market?.modelProbability,
                  market?.calibratedProbability
                ]),

              lambdaHome,
              lambdaAway,

              goalExpectationScore,
              contextualGoalExpectationScore,

              globalConfidence,

              sampleReliability,
              leagueTrust,

              monteCarloProbability:
                null,

              poissonProbability:
                null,

              confidence: 0,

              error,

              warnings
            } satisfies ConfidencePipelineMarketDebug
          }
        };
      }
    );

  const debug:
    ConfidencePipelineDebug = {
      valid: false,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets: 0,
      invalidMarkets:
        markets.length,

      lambdaHome,
      lambdaAway,

      globalConfidence,

      goalExpectationScore,
      contextualGoalExpectationScore,

      sampleReliability,
      leagueTrust,

      error,

      note:
        "Confidence measures model reliability per market; value, risk and decision remain independent."
    };

  return {
    ...data,

    confidenceValid: false,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      confidencePipeline:
        debug
    }
  };
}

/* ==========================================
   MONTE CARLO
========================================== */

function extractMonteCarloProbability(
  data: PipelineRecord,
  marketData: PipelineRecord,
  market: string
): number | null {
  /*
   * Fontes específicas do mercado têm prioridade.
   */
  const direct =
    firstProbability([
      marketData?.monteCarloProb,
      marketData?.monteCarloProbability,
      marketData?.simulationProbability,
      marketData?.debug
        ?.simulationPipeline
        ?.probability
    ]);

  if (direct !== null) {
    return direct;
  }

  const aliases =
    getProbabilityAliases(market);

  const candidates = [
    data?.monteCarlo?.probabilities,
    data?.simulation?.probabilities,
    data?.monteCarloResult?.probabilities,
    data?.simulationResult?.probabilities,
    data?.debug
      ?.simulationPipeline
      ?.probabilities,
    data?.debug
      ?.simulationPipeline
      ?.monteCarlo
      ?.probabilities
  ];

  return extractProbabilityFromCandidates(
    candidates,
    aliases
  );
}

/* ==========================================
   POISSON / MODELO ANALÍTICO
========================================== */

function extractPoissonProbability(
  data: PipelineRecord,
  marketData: PipelineRecord,
  market: string
): number | null {
  /*
   * Não usamos market.probability como fallback.
   *
   * Fazer isso criaria um falso acordo entre o modelo
   * oficial e o próprio valor usado como referência.
   */
  const direct =
    firstProbability([
      marketData?.poissonProb,
      marketData?.poissonProbability,
      marketData?.analyticalProbability,
      marketData?.debug
        ?.modelPipeline
        ?.poissonProbability
    ]);

  if (direct !== null) {
    return direct;
  }

  const comparisonKey =
    getSimulationComparisonKey(market);

  if (comparisonKey) {
    const comparisonProbability =
      firstProbability([
        data?.monteCarlo
          ?.modelComparison
          ?.[comparisonKey]
          ?.model,
        data?.debug
          ?.simulationPipeline
          ?.modelComparison
          ?.[comparisonKey]
          ?.model
      ]);

    if (comparisonProbability !== null) {
      return comparisonProbability;
    }
  }

  const aliases =
    getProbabilityAliases(market);

  const candidates = [
    data?.poissonProbabilities,
    data?.analyticalProbabilities,
    data?.poisson?.probabilities,
    data?.model?.poissonProbabilities,
    data?.model?.analyticalProbabilities,
    data?.debug
      ?.modelPipeline
      ?.poissonProbabilities,
    data?.debug
      ?.modelPipeline
      ?.analyticalProbabilities
  ];

  return extractProbabilityFromCandidates(
    candidates,
    aliases
  );
}

/* ==========================================
   DIAGNÓSTICO DE FONTES
========================================== */

function buildSourceWarnings({
  data,
  goalExpectationScore,
  contextualGoalExpectationScore,
  monteCarloProbability,
  poissonProbability,
  globalConfidence,
  sampleReliability,
  leagueTrust
}: {
  data: PipelineRecord;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
  monteCarloProbability: number | null;
  poissonProbability: number | null;
  globalConfidence: number | null;
  sampleReliability: number | null;
  leagueTrust: number | null;
}): string[] {
  const warnings: string[] = [];

  if (
    goalExpectationScore === null &&
    contextualGoalExpectationScore !== null
  ) {
    warnings.push(
      "CONFIDENCE_OFFICIAL_GOAL_SCORE_UNAVAILABLE"
    );
  }

  if (
    monteCarloProbability === null ||
    poissonProbability === null
  ) {
    warnings.push(
      "CONFIDENCE_MODEL_AGREEMENT_PARTIAL"
    );
  }

  if (globalConfidence === null) {
    warnings.push(
      "CONFIDENCE_GLOBAL_MODERATOR_UNAVAILABLE"
    );
  }

  if (sampleReliability === null) {
    warnings.push(
      "CONFIDENCE_SAMPLE_RELIABILITY_UNAVAILABLE"
    );
  }

  if (leagueTrust === null) {
    warnings.push(
      "CONFIDENCE_LEAGUE_TRUST_UNAVAILABLE"
    );
  }

  if (data?.monteCarlo?.valid === false) {
    warnings.push(
      "CONFIDENCE_MONTE_CARLO_INVALID"
    );
  }

  if (
    data?.monteCarlo?.converged === false ||
    data?.monteCarlo?.convergence?.converged === false
  ) {
    warnings.push(
      "CONFIDENCE_MONTE_CARLO_NOT_CONVERGED"
    );
  }

  if (detectLeagueFallback(data)) {
    warnings.push(
      "CONFIDENCE_LEAGUE_FALLBACK_NEUTRALIZED"
    );
  }

  if (resolveInputQuality(data).value === null) {
    warnings.push(
      "CONFIDENCE_INPUT_QUALITY_UNAVAILABLE"
    );
  }

  /*
   * Detecta uso potencial do alias legado data.confidence.
   */
  if (
    data?.globalConfidence === null ||
    data?.globalConfidence === undefined
  ) {
    if (
      data?.modelConfidence === null ||
      data?.modelConfidence === undefined
    ) {
      if (
        parseProbability(
          data?.confidence
        ) !== null
      ) {
        warnings.push(
          "CONFIDENCE_GLOBAL_LEGACY_ALIAS_USED"
        );
      }
    }
  }

  return normalizeWarnings(warnings);
}


/* ==========================================
   V7.2 — RESOLUÇÃO DE FONTES
========================================== */

interface ResolvedSignal {
  value: number | null;
  source: string;
}

interface MonteCarloMetadata {
  valid: boolean | null;
  converged: boolean | null;
  simulationQuality: unknown;
}

function resolveGlobalConfidence(data: PipelineRecord): ResolvedSignal {
  const canonical = firstResolvedProbability([
    [data?.globalConfidence, "data.globalConfidence"],
    [data?.modelConfidence, "data.modelConfidence"],
    [data?.debug?.globalConfidencePipeline?.confidence, "debug.globalConfidencePipeline.confidence"],
    [data?.debug?.confidencePipelineGlobal?.confidence, "debug.confidencePipelineGlobal.confidence"]
  ]);

  if (canonical.value !== null) {
    return canonical;
  }

  const legacy = parseProbability(data?.confidence);

  return legacy === null
    ? { value: null, source: "missing" }
    : { value: legacy, source: "data.confidence:legacy" };
}

function resolveRawSampleReliability(data: PipelineRecord): ResolvedSignal {
  return firstResolvedProbability([
    [data?.sampleReliability, "data.sampleReliability"],
    [data?.dataQuality?.sampleReliability, "data.dataQuality.sampleReliability"],
    [data?.context?.sampleReliability, "data.context.sampleReliability"],
    [data?.debug?.dataNormalizer?.sampleReliability, "debug.dataNormalizer.sampleReliability"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.sampleReliability, "debug.modelPipeline.lambdaBuilder.sampleReliability"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.sampleReliability, "debug.modelPipeline.lambdaBuilder.inputQuality.sampleReliability"],
    [data?.model?.lambdaBuilder?.sampleReliability, "data.model.lambdaBuilder.sampleReliability"]
  ]);
}

function resolveInputQuality(data: PipelineRecord): ResolvedSignal {
  return firstResolvedProbability([
    [data?.inputQuality, "data.inputQuality"],
    [data?.dataQuality?.inputQuality, "data.dataQuality.inputQuality"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality.inputQuality"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality"],
    [data?.model?.lambdaBuilder?.inputQuality, "data.model.lambdaBuilder.inputQuality"]
  ]);
}

function resolveEffectiveSampleReliability(
  rawSample: ResolvedSignal,
  inputQuality: ResolvedSignal
): ResolvedSignal {
  if (rawSample.value !== null && inputQuality.value !== null) {
    return {
      value: clampProbability(rawSample.value * inputQuality.value),
      source: `effective(${rawSample.source}*${inputQuality.source})`
    };
  }

  if (inputQuality.value !== null) {
    return {
      value: inputQuality.value,
      source: `inputQualityOnly(${inputQuality.source})`
    };
  }

  if (rawSample.value !== null) {
    return {
      value: rawSample.value,
      source: `rawSampleOnly(${rawSample.source})`
    };
  }

  return { value: null, source: "missing" };
}

function resolveRawLeagueTrust(data: PipelineRecord): ResolvedSignal {
  /*
   * Fonte oficial única.
   */
  const official = firstResolvedProbability([
    [data?.leagueReliability?.dataReliability, "data.leagueReliability.dataReliability"]
  ]);

  if (official.value !== null) {
    return official;
  }

  /*
   * Compatibilidade legada temporária — removida
   * no Commit 3, após validação.
   */
  return firstResolvedProbability([
    [data?.leagueTrust, "data.leagueTrust:legacy"],
    [data?.leagueConfig?.trust, "data.leagueConfig.trust:legacy"],
    [data?.leagueConfig?.dataReliability, "data.leagueConfig.dataReliability:legacy"],
    [data?.dataQuality?.leagueTrust, "data.dataQuality.leagueTrust:legacy"],
    [data?.leagueStrength?.dataReliability, "data.leagueStrength.dataReliability:legacy"],
    [data?.leagueResolved?.config?.dataReliability, "data.leagueResolved.config.dataReliability:legacy"],
    [data?.debug?.leagueConfig?.dataReliability, "debug.leagueConfig.dataReliability:legacy"],
    [data?.debug?.modelPipeline?.league?.config?.dataReliability, "debug.modelPipeline.league.config.dataReliability:legacy"]
  ]);
}

function detectLeagueFallback(data: PipelineRecord): boolean {
  /*
   * Fonte oficial única.
   */
  if (typeof data?.leagueReliability?.usedDefault === "boolean") {
    return data.leagueReliability.usedDefault;
  }

  /*
   * Compatibilidade legada temporária — removida
   * no Commit 3.
   */
  const flags = [
    data?.leagueFallbackUsed,
    data?.leagueResolved?.usedDefault,
    data?.leagueConfig?.usedDefault,
    data?.debug?.leagueConfig?.usedDefault,
    data?.debug?.modelPipeline?.league?.usedDefault
  ];

  if (flags.some(value => value === true)) {
    return true;
  }

  const warnings = [
    ...normalizeWarnings(data?.warnings),
    ...normalizeWarnings(data?.leagueResolved?.warnings),
    ...normalizeWarnings(data?.debug?.modelPipeline?.league?.warnings)
  ];

  return warnings.includes("UNKNOWN_LEAGUE_USING_DEFAULT");
}

function resolveEffectiveLeagueTrust(
  raw: ResolvedSignal,
  fallbackUsed: boolean
): ResolvedSignal {
  return fallbackUsed
    ? { value: 0.50, source: "fallbackNeutralTrust" }
    : raw;
}

function extractMonteCarloMetadata(data: PipelineRecord): MonteCarloMetadata {
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
    simulationQuality: firstDefined([
      data?.monteCarlo?.simulationQuality,
      data?.simulation?.simulationQuality,
      data?.debug?.simulationPipeline?.simulationQuality
    ])
  };
}

function getSimulationComparisonKey(market: string): string | null {
  switch (market) {
    case "HOME": return "HOME_WIN";
    case "DRAW": return "DRAW";
    case "AWAY": return "AWAY_WIN";
    case "OVER_1_5": return "OVER_1_5";
    case "OVER_2_5": return "OVER_2_5";
    case "BTTS_YES": return "BTTS_YES";
    case "BTTS_NO": return "BTTS_NO";
    case "DOUBLE_CHANCE_1X": return "DOUBLE_CHANCE_1X";
    case "DOUBLE_CHANCE_X2": return "DOUBLE_CHANCE_X2";
    default: return null;
  }
}

function firstResolvedProbability(
  candidates: Array<[unknown, string]>
): ResolvedSignal {
  for (const [value, source] of candidates) {
    const parsed = parseProbability(value);

    if (parsed !== null) {
      return { value: parsed, source };
    }
  }

  return { value: null, source: "missing" };
}

function firstBoolean(values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function firstDefined(values: unknown[]): unknown {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

/* ==========================================
   ALIASES
========================================== */

function getProbabilityAliases(
  market: string
): string[] {
  switch (market) {
    case "HOME":
      return [
        "HOME",
        "HOME_WIN",
        "home",
        "homeWin",
        "homeWinProb"
      ];

    case "DRAW":
      return [
        "DRAW",
        "draw",
        "drawProb"
      ];

    case "AWAY":
      return [
        "AWAY",
        "AWAY_WIN",
        "away",
        "awayWin",
        "awayWinProb"
      ];

    case "OVER_1_5":
      return [
        "OVER_1_5",
        "over15",
        "over1_5",
        "over1.5"
      ];

    case "OVER_2_5":
      return [
        "OVER_2_5",
        "over25",
        "over2_5",
        "over2.5"
      ];

    case "BTTS_YES":
      return [
        "BTTS_YES",
        "bttsYes",
        "yes"
      ];

    case "BTTS_NO":
      return [
        "BTTS_NO",
        "bttsNo",
        "no"
      ];

    case "DOUBLE_CHANCE_1X":
      return [
        "DOUBLE_CHANCE_1X",
        "1X",
        "doubleChance1X",
        "homeOrDraw"
      ];

    case "DOUBLE_CHANCE_X2":
      return [
        "DOUBLE_CHANCE_X2",
        "X2",
        "doubleChanceX2",
        "awayOrDraw"
      ];

    default:
      return [];
  }
}

/* ==========================================
   NORMALIZAÇÃO DE MERCADO
========================================== */

function normalizeMarketName(
  value: unknown
): string {
  const market =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\./g, "_")
      .replace(/\s+/g, "_");

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    default:
      return "";
  }
}

/* ==========================================
   EXTRAÇÃO GENÉRICA
========================================== */

function extractProbabilityFromCandidates(
  candidates: unknown[],
  aliases: string[]
): number | null {
  for (const candidate of candidates) {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }

    const record =
      candidate as Record<string, unknown>;

    for (const alias of aliases) {
      const probability =
        parseProbability(
          record[alias]
        );

      if (probability !== null) {
        return probability;
      }
    }
  }

  return null;
}

/* ==========================================
   HELPERS
========================================== */

function firstProbability(
  values: unknown[]
): number | null {
  for (const value of values) {
    const parsed =
      parseProbability(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function firstPositiveNumber(
  values: unknown[]
): number | null {
  for (const value of values) {
    const parsed =
      parsePositiveNumber(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseProbability(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parsePositiveNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(warning =>
          String(
            warning ?? ""
          ).trim()
        )
        .filter(Boolean)
    )
  ];
}
