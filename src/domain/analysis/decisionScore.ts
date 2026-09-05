/* ==========================================
   DECISION SCORE — DECISION INTELLIGENCE FASE 7
========================================== */

/*
 * Responsabilidade:
 *
 * - combinar, num único número 0–100, os sinais que as fases
 *   1–6 já produziram (rankingScore, modelAgreementScore,
 *   robustnessScore, sampleReliability, leagueTrust,
 *   correlationPenaltyDiagnostic) para uma narrativa "Decision
 *   Score: 78/100" legível (seção 21 do roteiro).
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade, EV, risco, confidence ou ranking —
 *   só combina o que essas fases já calcularam;
 * - decide classificação. Depois de DUAS tentativas (fase 4:
 *   edge dinâmico: fase 6: correlação real) de usar um sinal
 *   "mais inteligente" para restringir classificação terem
 *   piorado o ROI agregado no backtest determinístico, este
 *   score nasce como telemetria/explicabilidade pura — não como
 *   mais um gate. Usá-lo para decisão exigiria a mesma validação
 *   (e provavelmente o mesmo ceticismo) que reverteu as duas
 *   fases anteriores.
 *
 * Pesos e a escolha de multiplicar (não somar) as penalidades:
 *
 * rankingScore já é ele mesmo uma combinação de valueQuality
 * (EV+edge), safety (1-risk), confidence e probability
 * (rankingPipeline.ts) — reaproveitado aqui como o componente
 * "qualidade de mercado", em vez de duplicar aquela normalização.
 * modelAgreementScore e robustnessScore são os sinais REALMENTE
 * novos que rankingScore não tem. sampleReliability/leagueTrust/
 * correlationPenaltyDiagnostic entram como multiplicadores — um
 * único fator catastrófico (ex.: liga com histórico péssimo)
 * consegue derrubar um score bom, em vez de ficar diluído numa
 * média (seção 4 do roteiro: "score forte + baixa qualidade de
 * dados ≠ entrada forte").
 */

export interface DecisionScoreInput {
  rankingScore: number | null;

  modelAgreementScore?: number | null;
  robustnessScore?: number | null;

  sampleReliability?: number | null;
  leagueTrust?: number | null;

  correlationPenaltyDiagnostic?: number | null;
}

export interface DecisionScoreComponent {
  source: string;
  value: number;
  weight: number;
}

export interface DecisionScoreResult {
  valid: boolean;

  /* 0-100, arredondado. */
  score: number | null;

  baseScore: number | null;
  penaltyFactor: number | null;

  components: DecisionScoreComponent[];

  warnings: string[];
}

/*
 * Sinal ausente não vira nem bônus nem penalidade — 0.5 é o
 * ponto neutro (nem reforça nem derruba o score base).
 */
const NEUTRAL_SIGNAL = 0.5;

const WEIGHTS = {
  rankingScore: 0.55,
  modelAgreementScore: 0.20,
  robustnessScore: 0.25
} as const;

export function calculateDecisionScore(
  input: DecisionScoreInput
): DecisionScoreResult {
  const warnings: string[] = [];

  const rankingScore =
    parseProbability(input?.rankingScore);

  if (rankingScore === null) {
    return {
      valid: false,
      score: null,
      baseScore: null,
      penaltyFactor: null,
      components: [],
      warnings: ["MISSING_RANKING_SCORE_FOR_DECISION_SCORE"]
    };
  }

  const modelAgreementScore =
    resolveOptionalSignal(
      input?.modelAgreementScore,
      warnings,
      "MODEL_AGREEMENT_UNAVAILABLE_FOR_DECISION_SCORE"
    );

  const robustnessScore =
    resolveOptionalSignal(
      input?.robustnessScore,
      warnings,
      "ROBUSTNESS_UNAVAILABLE_FOR_DECISION_SCORE"
    );

  const components: DecisionScoreComponent[] = [
    {
      source: "RANKING_SCORE",
      value: rankingScore,
      weight: WEIGHTS.rankingScore
    },
    {
      source: "MODEL_AGREEMENT",
      value: modelAgreementScore,
      weight: WEIGHTS.modelAgreementScore
    },
    {
      source: "ROBUSTNESS",
      value: robustnessScore,
      weight: WEIGHTS.robustnessScore
    }
  ];

  const baseScore = clamp01(
    components.reduce(
      (total, component) =>
        total + component.value * component.weight,
      0
    )
  );

  const sampleReliabilityFactor =
    parseProbability(input?.sampleReliability) ?? 1;

  const leagueTrustFactor =
    parseProbability(input?.leagueTrust) ?? 1;

  const correlationFactor =
    clamp01(
      1 -
      (parseProbability(input?.correlationPenaltyDiagnostic) ?? 0)
    );

  const penaltyFactor = clamp01(
    sampleReliabilityFactor *
    leagueTrustFactor *
    correlationFactor
  );

  const score = Math.round(
    clamp01(baseScore * penaltyFactor) * 100
  );

  return {
    valid: true,
    score,
    baseScore: roundNumber(baseScore),
    penaltyFactor: roundNumber(penaltyFactor),
    components: components.map(component => ({
      ...component,
      value: roundNumber(component.value)
    })),
    warnings: [...new Set(warnings)]
  };
}

function resolveOptionalSignal(
  value: unknown,
  warnings: string[],
  warningCode: string
): number {
  const parsed = parseProbability(value);

  if (parsed === null) {
    warnings.push(warningCode);
    return NEUTRAL_SIGNAL;
  }

  return parsed;
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function roundNumber(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
