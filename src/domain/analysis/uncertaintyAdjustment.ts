/* ==========================================
   UNCERTAINTY ADJUSTMENT — DECISION INTELLIGENCE FASE 3
========================================== */

/*
 * Responsabilidade:
 *
 * - combinar os sinais de incerteza que já existem
 *   espalhados pelo pipeline (sampleReliability, leagueTrust,
 *   globalConfidence, modelAgreementScore) num único desconto
 *   sobre a probabilidade;
 * - produzir effectiveProbability = rawProbability - penalty,
 *   preservando rawProbability intacta para auditoria.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade, EV, risco ou confidence;
 * - decide classificação;
 * - é consumido pelo decisionPipeline ainda — nesta fase é só
 *   telemetria (ver evaluateMarket.ts), exatamente como
 *   modelAgreementScore foi na fase 2. Usar effectiveProbability
 *   para de fato restringir classificação é a fase seguinte
 *   (edge dinâmico) e exige validação por backtest mercado a
 *   mercado antes de entrar em produção, porque aí sim muda
 *   contagem de apostas.
 *
 * Por que penalidade sobre probabilidade, e não sobre EV
 * diretamente: EV já é odd × probabilidade - 1, então descontar
 * a probabilidade de origem já propaga proporcionalmente para
 * EV/edge sem precisar duplicar a fórmula em dois lugares.
 */

export interface UncertaintyAdjustmentInput {
  probability: number;

  sampleReliability?: number | null;
  leagueTrust?: number | null;
  globalConfidence?: number | null;
  modelAgreementScore?: number | null;
}

export interface UncertaintyComponent {
  source: string;
  weight: number;
  deficit: number;
  contribution: number;
}

export interface UncertaintyAdjustmentResult {
  valid: boolean;

  rawProbability: number;
  effectiveProbability: number;

  uncertaintyPenalty: number;

  components: UncertaintyComponent[];

  /*
   * Quantos dos quatro sinais estavam disponíveis. Poucos sinais
   * disponíveis não é penalizado aqui de novo — dataQualityRisk
   * em riskScore.ts já cobre "dados ausentes" como risco
   * separado. Aqui só combinamos o que existe.
   */
  signalsAvailable: number;

  warnings: string[];
}

const POLICY = {
  /*
   * Mesmo teto absoluto (8pp) já usado em
   * probabilityCalibration.ts (MAX_ADJUSTMENT) para o mesmo tipo
   * de decisão: mesmo com sinais estatisticamente ruins, uma
   * amostra pequena de evidência não deve deslocar a
   * probabilidade de forma desproporcional.
   */
  maxPenalty: 0.08,

  weights: {
    sampleReliability: 0.40,
    leagueTrust: 0.20,
    globalConfidence: 0.25,
    modelAgreementScore: 0.15
  }
} as const;

export function calculateUncertaintyAdjustment(
  input: UncertaintyAdjustmentInput
): UncertaintyAdjustmentResult {
  const warnings: string[] = [];

  const rawProbability = parseProbability(input?.probability);

  if (rawProbability === null) {
    return createInvalidResult(warnings.concat("INVALID_UNCERTAINTY_PROBABILITY"));
  }

  const signals: Array<{
    source: string;
    weight: number;
    value: number | null;
  }> = [
    {
      source: "SAMPLE_RELIABILITY",
      weight: POLICY.weights.sampleReliability,
      value: parseProbability(input?.sampleReliability)
    },
    {
      source: "LEAGUE_TRUST",
      weight: POLICY.weights.leagueTrust,
      value: parseProbability(input?.leagueTrust)
    },
    {
      source: "GLOBAL_CONFIDENCE",
      weight: POLICY.weights.globalConfidence,
      value: parseProbability(input?.globalConfidence)
    },
    {
      source: "MODEL_AGREEMENT",
      weight: POLICY.weights.modelAgreementScore,
      value: parseProbability(input?.modelAgreementScore)
    }
  ];

  const availableSignals = signals.filter(
    signal => signal.value !== null
  );

  if (availableSignals.length === 0) {
    warnings.push("NO_UNCERTAINTY_SIGNALS_AVAILABLE");

    return {
      valid: true,
      rawProbability,
      effectiveProbability: rawProbability,
      uncertaintyPenalty: 0,
      components: [],
      signalsAvailable: 0,
      warnings
    };
  }

  /*
   * Renormaliza os pesos pelos sinais realmente disponíveis, para
   * que a ausência de um sinal não reduza artificialmente a
   * penalidade total (o que incentivaria, ao contrário do
   * pretendido, jogos com menos dados a parecerem menos
   * incertos).
   */
  const totalAvailableWeight = availableSignals.reduce(
    (sum, signal) => sum + signal.weight,
    0
  );

  const components: UncertaintyComponent[] = availableSignals.map(
    signal => {
      const deficit = 1 - (signal.value as number);
      const normalizedWeight = signal.weight / totalAvailableWeight;

      return {
        source: signal.source,
        weight: roundNumber(normalizedWeight),
        deficit: roundNumber(deficit),
        contribution: roundNumber(deficit * normalizedWeight)
      };
    }
  );

  const rawPenalty = components.reduce(
    (sum, component) => sum + component.contribution,
    0
  );

  const uncertaintyPenalty = clamp(
    rawPenalty * POLICY.maxPenalty,
    0,
    POLICY.maxPenalty
  );

  const effectiveProbability = clamp(
    rawProbability - uncertaintyPenalty,
    0,
    1
  );

  if (availableSignals.length < signals.length) {
    warnings.push("UNCERTAINTY_PARTIAL_SIGNALS");
  }

  return {
    valid: true,
    rawProbability,
    effectiveProbability: roundNumber(effectiveProbability),
    uncertaintyPenalty: roundNumber(uncertaintyPenalty),
    components,
    signalsAvailable: availableSignals.length,
    warnings
  };
}

function createInvalidResult(
  warnings: string[]
): UncertaintyAdjustmentResult {
  return {
    valid: false,
    rawProbability: 0,
    effectiveProbability: 0,
    uncertaintyPenalty: 0,
    components: [],
    signalsAvailable: 0,
    warnings: [...new Set(warnings.filter(Boolean))]
  };
}

function parseProbability(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return null;
  }

  return parsed;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}

function roundNumber(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
