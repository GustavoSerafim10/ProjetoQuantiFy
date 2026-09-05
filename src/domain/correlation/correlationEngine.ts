/* ==========================================
   CORRELATION ENGINE — QUANTIFY V7.2
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados candidatos;
 * - preservar os valores produzidos anteriormente;
 * - registrar diagnóstico estrutural relevante;
 * - medir correlação real entre candidatos do MESMO jogo via
 *   coeficiente phi sobre a matriz de placares conjunta
 *   (mesma matriz Poisson + Dixon-Coles de goalMatrix.ts —
 *   nenhuma probabilidade nova é inventada);
 * - produzir correlationPenalty/correlationNet reais, consumidos
 *   por riskPipeline/correlation.ts (addCorrelationComponent),
 *   que já existia pronto para isso, mas sempre recebia zero.
 *
 * Fase 6 do Decision Intelligence Layer (2026-09-04):
 *
 * Dois mercados do mesmo jogo "coexistirem" na lista não significa
 * que apostar nos dois é diversificação real — se ambos vencem e
 * perdem essencialmente juntos (UNDER_2_5 + BTTS_NO + DNB_HOME
 * tendem a isso num jogo truncado), é a MESMA tese exposta duas
 * vezes. O phi mede isso diretamente a partir da matriz conjunta,
 * sem precisar de uma lista hardcoded de "famílias de mercado":
 * pares estruturalmente redundantes (ex.: HOME e DOUBLE_CHANCE_1X,
 * que sempre vencem juntos) têm phi alto; pares mutuamente
 * exclusivos (HOME e AWAY) têm phi fortemente negativo e não são
 * penalizados — só correlação POSITIVA (redundância) penaliza.
 *
 * Validado por comparação de backtest antes/depois via
 * runBacktest (mesma seed determinística) antes de manter esta
 * mudança — ver nota de validação mais abaixo.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades ou EV dos mercados individuais;
 * - modifica confidence;
 * - remove mercados ou escolhe o melhor;
 * - concede correlationBoost (redução de risco) — nenhum
 *   mecanismo com justificativa estatística foi encontrado para
 *   isso; só penalidade por redundância é aplicada.
 */

import { goalMatrix, type ScoreProbability } from "../math/goalMatrix";

/* ==========================================
   CONTRATOS
========================================== */

export interface CorrelationEngineContext {
  lambdaHome?: number | null;
  lambdaAway?: number | null;
  goalExpectationScore?: number | null;
}

export interface CorrelationStructuralContext {
  valid: boolean;

  lambdaHome: number | null;
  lambdaAway: number | null;

  totalLambda: number | null;
  lambdaDifference: number | null;
  minimumLambda: number | null;

  goalExpectationScore: number | null;
}

export interface CorrelationDiagnostic {
  code: string;

  type:
    | "INFO"
    | "SUPPORT"
    | "RISK";

  description: string;
}

export interface CorrelationEngineMarketDebug {
  valid: boolean;

  mode:
    "CANDIDATE_DIAGNOSTIC";

  structuralContext:
    CorrelationStructuralContext;

  diagnostics:
    CorrelationDiagnostic[];

  /*
   * Maior coeficiente phi positivo encontrado contra qualquer
   * outro candidato com EV positivo no mesmo jogo — e qual
   * mercado é esse. null quando a matriz conjunta não estava
   * disponível ou não havia outro candidato para comparar.
   */
  maxPositivePhi: number | null;
  mostRedundantWith: string | null;

  penalty: number;

  /*
   * Valor que `penalty` teria se a fase 6 (redundância via phi)
   * estivesse aplicada de verdade — ver nota em
   * applyCorrelationAdjustments. Diagnóstico, não consumido por
   * riskPipeline.
   */
  penaltyDiagnostic: number;

  boost: number;
  netAdjustment: number;

  riskModified: boolean;
  confidenceModified: false;

  note: string;
}

/* ==========================================
   FUNÇÃO PRINCIPAL
========================================== */

interface CorrelationCandidateMarket {
  market?: unknown;
  warnings?: unknown;
  debug?: Record<string, unknown>;
  [key: string]: unknown;
}

/*
 * Teto de penalidade por redundância — mesmo valor que
 * riskPipeline/policy.ts já usa como maximumCorrelationAdjustment.
 * Duplicado aqui (não importado) porque riskPipeline não deve ser
 * uma dependência do domain/correlation; o valor precisa
 * permanecer igual nos dois lugares por construção, não por
 * import, já que representam a MESMA política vista de dois
 * pipelines diferentes.
 */
const MAX_CORRELATION_PENALTY = 0.15;

/*
 * Só correlação positiva (redundância real) penaliza. Um phi
 * abaixo deste piso é ruído estatístico do modelo, não sinal de
 * exposição repetida — evita gerar penalidade a partir de
 * arredondamento.
 */
const MINIMUM_PHI_FOR_PENALTY = 0.30;

export function applyCorrelationAdjustments(
  markets: CorrelationCandidateMarket[],
  context: CorrelationEngineContext
) {
  if (!Array.isArray(markets)) {
    return [];
  }

  const structuralContext =
    buildStructuralContext(
      context
    );

  const jointMatrix =
    structuralContext.valid
      ? goalMatrix(
          structuralContext.lambdaHome as number,
          structuralContext.lambdaAway as number
        )
      : null;

  /*
   * Probabilidade de cada candidato derivada DA MESMA matriz
   * usada para a probabilidade conjunta — garante que P(A), P(B)
   * e P(A∩B) sejam internamente consistentes na fórmula do phi,
   * em vez de misturar a probabilidade oficial do mercado (que
   * pode vir de calibração/ensemble) com a matriz bruta.
   */
  const matrixProbabilityByIndex =
    jointMatrix
      ? markets.map(candidate =>
          computeMatrixProbability(
            jointMatrix,
            normalizeMarketName(candidate?.market)
          )
        )
      : markets.map(() => null);

  const evByIndex =
    markets.map(candidate =>
      parseFiniteNumber(candidate?.ev)
    );

  return markets.map(
    (
      market: CorrelationCandidateMarket,
      index: number
    ) => {
      const marketName =
        normalizeMarketName(
          market?.market
        );

      const existingWarnings =
        normalizeWarnings(
          market?.warnings
        );

      const diagnostics =
        evaluateStructuralDiagnostics(
          marketName,
          structuralContext
        );

      const redundancy =
        jointMatrix &&
        marketName &&
        matrixProbabilityByIndex[index] !== null
          ? findMostRedundantMarket({
              jointMatrix,
              markets,
              matrixProbabilityByIndex,
              evByIndex,
              currentIndex: index,
              currentMarket: marketName,
              currentProbability:
                matrixProbabilityByIndex[index] as number
            })
          : null;

      /*
       * DIAGNÓSTICO, NÃO APLICADA (testado e revertido em
       * 2026-09-04): mesmo depois de corrigir a aproximação do
       * DNB (ver comentário em marketWinsAtScore), o backtest
       * determinístico mostrou ROI agregado pior que o baseline
       * nas duas amostras testadas (2500 e 5000 partidas) — mesmo
       * veredito da fase 4 (edge dinâmico). correlationPenalty
       * REAL (a que riskPipeline/correlation.ts efetivamente
       * consome via market.correlationNet) permanece 0, como
       * sempre foi. O valor que SERIA aplicado fica visível em
       * `correlationPenaltyDiagnostic`/`maxPositivePhi`/
       * `mostRedundantWith` para auditoria, exatamente como
       * uncertaintyClassification na fase 4.
       */
      const correlationPenaltyDiagnostic =
        redundancy
          ? clamp01(
              redundancy.phi *
              MAX_CORRELATION_PENALTY
            )
          : 0;

      const correlationPenalty =
        0;

      /*
       * Nenhum mecanismo com justificativa estatística foi
       * encontrado para reduzir risco por correlação — só
       * penalidade por redundância seria aplicada (ver docstring).
       */
      const correlationBoost =
        0;

      const correlationNet =
        0;

      const debug:
        CorrelationEngineMarketDebug = {
          valid:
            Boolean(
              marketName
            ) &&
            structuralContext.valid,

          mode:
            "CANDIDATE_DIAGNOSTIC",

          structuralContext,

          diagnostics,

          maxPositivePhi:
            redundancy
              ? roundNumber(redundancy.phi)
              : null,

          mostRedundantWith:
            redundancy?.market ??
            null,

          penalty:
            correlationPenalty,

          penaltyDiagnostic:
            roundNumber(correlationPenaltyDiagnostic),

          boost:
            correlationBoost,

          netAdjustment:
            correlationNet,

          riskModified:
            false,

          confidenceModified:
            false,

          note:
            "correlationPenalty/correlationNet stay 0 (tested and reverted 2026-09-04 — worse aggregate ROI on backtest). See correlationPenaltyDiagnostic/maxPositivePhi for the value that would have been applied."
        };

      return {
  ...market,

  correlationPenalty,
  correlationBoost,
  correlationNet,

  /*
   * Diagnóstico visível (não consumido por riskPipeline) — ver
   * comentário acima.
   */
  correlationPenaltyDiagnostic:
    roundNumber(correlationPenaltyDiagnostic),

  // Apenas informa que o engine foi executado
  correlationEvaluated: true,

  // Só será true quando realmente existir ajuste
  correlationAdjusted:
    correlationNet !== 0,

  correlationMode:
    "CANDIDATE_DIAGNOSTIC",

  // Ainda não existe análise de carteira
  correlationPortfolioApplied:
    false,

  // Mantém apenas os warnings que já existiam
  warnings:
    existingWarnings,

  debug: {
    ...(market?.debug ?? {}),

    correlationEngine: {
      ...debug,

      marketIndex:
        index,

      market:
        marketName
    }
  }
};
    }
  );
}

/* ==========================================
   REDUNDÂNCIA (COEFICIENTE PHI)
========================================== */

type CorrelationMarketCondition =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "UNDER_1_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

/*
 * DNB_HOME/DNB_AWAY (Empate Anula) ficam FORA desta checagem de
 * propósito. Uma primeira versão aproximava a resolução favorável
 * do DNB pela mesma condição de HOME/AWAY (homeGoals > awayGoals),
 * o que faz phi(HOME, DNB_HOME) valer sempre exatamente 1 — não é
 * uma medição, é um artefato da aproximação, e testado via
 * runBacktest isso penalizava DNB_HOME/AWAY no teto (0.15) toda
 * vez que coexistiam com HOME/AWAY como candidatos, removendo uma
 * contribuição de ROI real (DNB_HOME/AWAY eram positivos antes
 * desta fase). Ficam de fora até existir uma condição que trate
 * o empurrão (push) do empate corretamente, em vez de fingir que
 * DNB e o resultado seco são a mesma aposta.
 */
function marketWinsAtScore(
  market: CorrelationMarketCondition,
  homeGoals: number,
  awayGoals: number
): boolean {
  switch (market) {
    case "HOME":
      return homeGoals > awayGoals;

    case "DRAW":
      return homeGoals === awayGoals;

    case "AWAY":
      return homeGoals < awayGoals;

    case "OVER_1_5":
      return homeGoals + awayGoals >= 2;

    case "OVER_2_5":
      return homeGoals + awayGoals >= 3;

    case "UNDER_1_5":
      return homeGoals + awayGoals <= 1;

    case "UNDER_2_5":
      return homeGoals + awayGoals <= 2;

    case "BTTS_YES":
      return homeGoals > 0 && awayGoals > 0;

    case "BTTS_NO":
      return !(homeGoals > 0 && awayGoals > 0);

    case "DOUBLE_CHANCE_1X":
      return homeGoals >= awayGoals;

    case "DOUBLE_CHANCE_X2":
      return homeGoals <= awayGoals;
  }
}

function isCorrelationMarketCondition(
  value: string
): value is CorrelationMarketCondition {
  return (
    value === "HOME" ||
    value === "DRAW" ||
    value === "AWAY" ||
    value === "OVER_1_5" ||
    value === "OVER_2_5" ||
    value === "UNDER_1_5" ||
    value === "UNDER_2_5" ||
    value === "BTTS_YES" ||
    value === "BTTS_NO" ||
    value === "DOUBLE_CHANCE_1X" ||
    value === "DOUBLE_CHANCE_X2"
  );
}

function computeMatrixProbability(
  matrix: ScoreProbability[],
  market: string
): number | null {
  if (!isCorrelationMarketCondition(market)) {
    return null;
  }

  let probability = 0;

  for (const cell of matrix) {
    if (marketWinsAtScore(market, cell.homeGoals, cell.awayGoals)) {
      probability += cell.probability;
    }
  }

  return probability;
}

function computeJointMatrixProbability(
  matrix: ScoreProbability[],
  marketA: CorrelationMarketCondition,
  marketB: CorrelationMarketCondition
): number {
  let probability = 0;

  for (const cell of matrix) {
    if (
      marketWinsAtScore(marketA, cell.homeGoals, cell.awayGoals) &&
      marketWinsAtScore(marketB, cell.homeGoals, cell.awayGoals)
    ) {
      probability += cell.probability;
    }
  }

  return probability;
}

/*
 * Coeficiente phi — correlação de Pearson para duas variáveis
 * binárias, calculado a partir da tabela de contingência 2x2
 * (P(A), P(B), P(A∩B)). Positivo = os dois eventos co-ocorrem
 * mais do que a independência preveria (redundância real);
 * negativo = são mais mutuamente exclusivos do que o acaso
 * (ex.: HOME e AWAY). Só o lado positivo é penalizado aqui.
 */
function computePhiCoefficient(
  probabilityA: number,
  probabilityB: number,
  jointProbability: number
): number | null {
  const varianceA =
    probabilityA * (1 - probabilityA);

  const varianceB =
    probabilityB * (1 - probabilityB);

  const denominator =
    Math.sqrt(varianceA * varianceB);

  if (
    !Number.isFinite(denominator) ||
    denominator <= 1e-9
  ) {
    return null;
  }

  const phi =
    (jointProbability - probabilityA * probabilityB) /
    denominator;

  return Number.isFinite(phi) ? phi : null;
}

function findMostRedundantMarket({
  jointMatrix,
  markets,
  matrixProbabilityByIndex,
  evByIndex,
  currentIndex,
  currentMarket,
  currentProbability
}: {
  jointMatrix: ScoreProbability[];
  markets: CorrelationCandidateMarket[];
  matrixProbabilityByIndex: Array<number | null>;
  evByIndex: Array<number | null>;
  currentIndex: number;
  currentMarket: string;
  currentProbability: number;
}): { market: string; phi: number } | null {
  if (!isCorrelationMarketCondition(currentMarket)) {
    return null;
  }

  let best: { market: string; phi: number } | null = null;

  for (
    let otherIndex = 0;
    otherIndex < markets.length;
    otherIndex++
  ) {
    if (otherIndex === currentIndex) {
      continue;
    }

    const otherEv = evByIndex[otherIndex];

    /*
     * Só concorrentes com EV positivo representam uma tese
     * "também atraente" — redundância com um mercado que
     * ninguém apostaria de qualquer forma não é o problema que
     * a seção 19 do roteiro descreve.
     */
    if (otherEv === null || otherEv <= 0) {
      continue;
    }

    const otherProbability =
      matrixProbabilityByIndex[otherIndex];

    if (otherProbability === null) {
      continue;
    }

    const otherMarket =
      normalizeMarketName(
        markets[otherIndex]?.market
      );

    if (
      !otherMarket ||
      !isCorrelationMarketCondition(otherMarket) ||
      otherMarket === currentMarket
    ) {
      continue;
    }

    const jointProbability =
      computeJointMatrixProbability(
        jointMatrix,
        currentMarket,
        otherMarket
      );

    const phi =
      computePhiCoefficient(
        currentProbability,
        otherProbability,
        jointProbability
      );

    if (
      phi !== null &&
      phi >= MINIMUM_PHI_FOR_PENALTY &&
      (best === null || phi > best.phi)
    ) {
      best = { market: otherMarket, phi };
    }
  }

  return best;
}

/* ==========================================
   CONTEXTO ESTRUTURAL
========================================== */

function buildStructuralContext(
  context: CorrelationEngineContext
): CorrelationStructuralContext {
  const lambdaHome =
    parsePositiveNumber(
      context?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      context?.lambdaAway
    );

  const goalExpectationScore =
    parseProbability(
      context?.goalExpectationScore
    );

  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return {
      valid:
        false,

      lambdaHome,
      lambdaAway,

      totalLambda:
        null,

      lambdaDifference:
        null,

      minimumLambda:
        null,

      goalExpectationScore
    };
  }

  return {
    valid:
      true,

    lambdaHome,
    lambdaAway,

    totalLambda:
      roundNumber(
        lambdaHome +
        lambdaAway
      ),

    lambdaDifference:
      roundNumber(
        Math.abs(
          lambdaHome -
          lambdaAway
        )
      ),

    minimumLambda:
      roundNumber(
        Math.min(
          lambdaHome,
          lambdaAway
        )
      ),

    goalExpectationScore
  };
}

/* ==========================================
   DIAGNÓSTICOS ESTRUTURAIS
========================================== */

/*
 * Estes diagnósticos não alteram o risco.
 *
 * O riskPipeline já possui responsabilidade
 * sobre os ajustes quantitativos.
 *
 * Aqui registramos somente informações que podem
 * ser úteis posteriormente para auditoria,
 * combinação de picks e exposição.
 */
function evaluateStructuralDiagnostics(
  market:
    string,

  context:
    CorrelationStructuralContext
): CorrelationDiagnostic[] {
  const diagnostics:
    CorrelationDiagnostic[] = [];

  if (!market) {
    diagnostics.push({
      code:
        "CORRELATION_UNKNOWN_MARKET",

      type:
        "INFO",

      description:
        "The market could not be normalized for correlation diagnostics."
    });

    return diagnostics;
  }

  if (!context.valid) {
    diagnostics.push({
      code:
        "CORRELATION_CONTEXT_UNAVAILABLE",

      type:
        "INFO",

      description:
        "Valid lambdas were unavailable for structural correlation diagnostics."
    });

    return diagnostics;
  }

  const totalLambda =
    context.totalLambda as number;

  const lambdaDifference =
    context.lambdaDifference as number;

  const minimumLambda =
    context.minimumLambda as number;

  /*
   * Estes sinais são apenas descrições da
   * estrutura da partida.
   *
   * Eles não somam penalidades porque essas
   * condições já são consideradas pelo risco.
   */

  if (
    (
      market ===
        "BTTS_YES" ||
      market ===
        "OVER_2_5"
    ) &&
    minimumLambda >= 1 &&
    totalLambda >= 2.75
  ) {
    diagnostics.push({
      code:
        "GOAL_MARKETS_SHARE_STRONG_STRUCTURE",

      type:
        "SUPPORT",

      description:
        "Both teams have sufficient scoring expectation and the total lambda supports goal-related markets."
    });
  }

  if (
    market ===
      "BTTS_YES" &&
    minimumLambda < 0.80
  ) {
    diagnostics.push({
      code:
        "BTTS_YES_DEPENDS_ON_LOW_LAMBDA_TEAM",

      type:
        "RISK",

      description:
        "BTTS Yes depends on a team whose scoring expectation is structurally low."
    });
  }

  if (
    market ===
      "OVER_2_5" &&
    lambdaDifference > 1.65 &&
    minimumLambda < 0.85
  ) {
    diagnostics.push({
      code:
        "OVER_2_5_CONCENTRATED_SCORING_STRUCTURE",

      type:
        "INFO",

      description:
        "The expected goals are heavily concentrated in one team, which may favor one-sided high-score outcomes."
    });
  }

  if (
    market ===
      "BTTS_NO" &&
    totalLambda >= 3.20 &&
    minimumLambda >= 0.90
  ) {
    diagnostics.push({
      code:
        "BTTS_NO_OPPOSES_DISTRIBUTED_GOAL_STRUCTURE",

      type:
        "RISK",

      description:
        "The total and minimum lambdas indicate meaningful scoring expectation for both teams."
    });
  }

  if (
    (
      market ===
        "HOME" ||
      market ===
        "AWAY"
    ) &&
    lambdaDifference < 0.30
  ) {
    diagnostics.push({
      code:
        "RESULT_MARKET_IN_BALANCED_STRUCTURE",

      type:
        "RISK",

      description:
        "The teams have similar scoring expectations, making directional result exposure structurally less distinct."
    });
  }

  if (
    market ===
      "OVER_1_5" &&
    totalLambda < 2
  ) {
    diagnostics.push({
      code:
        "OVER_1_5_LOW_TOTAL_LAMBDA_STRUCTURE",

      type:
        "RISK",

      description:
        "The total expected goals are relatively low for an Over 1.5 position."
    });
  }

  if (
    market ===
      "UNDER_1_5" &&
    totalLambda > 2.75
  ) {
    diagnostics.push({
      code:
        "UNDER_1_5_HIGH_TOTAL_LAMBDA_STRUCTURE",

      type:
        "RISK",

      description:
        "The total expected goals are relatively high for an Under 1.5 position."
    });
  }

  return diagnostics;
}

/* ==========================================
   MERCADOS
========================================== */

function normalizeMarketName(
  value: unknown
): string {
  const market =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

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
    case "OVER 1.5":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
    case "OVER 2.5":
      return "OVER_2_5";

    case "UNDER_1_5":
    case "UNDER15":
    case "UNDER 1.5":
      return "UNDER_1_5";

    case "UNDER_2_5":
    case "UNDER25":
    case "UNDER 2.5":
      return "UNDER_2_5";

    case "BTTS_YES":
    case "BTTS YES":
      return "BTTS_YES";

    case "BTTS_NO":
    case "BTTS NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    case "DNB_HOME":
    case "DNB1":
      return "DNB_HOME";

    case "DNB_AWAY":
    case "DNB2":
      return "DNB_AWAY";

    default:
      return market;
  }
}

/* ==========================================
   HELPERS
========================================== */

function parseFiniteNumber(
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

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const warnings =
    value
      .map(
        warning =>
          String(
            warning ??
            ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
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
function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}