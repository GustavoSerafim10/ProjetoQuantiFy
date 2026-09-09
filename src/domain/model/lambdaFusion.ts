/*
 * Achado real em 2026-09-09: o usuário quer estatísticas de time E
 * odds de mercado influenciando o MESMO número, não um "ou isso ou
 * aquilo" (ver eliteAnalyzer.ts). Só que os dados que ele mesmo
 * validou mostram o consenso de-vig acertando 5 de 6 entradas reais,
 * contra 25% do Poisson-de-stats — então isto não é uma média 50/50.
 *
 * O mercado é a base; as estatísticas só têm permissão de puxar o
 * lambda dentro de uma faixa limitada em torno do valor de mercado
 * (mesmo espírito do clamp que já existe em contextAdjustment.ts).
 * Quanto pior a qualidade dos dados estatísticos (mais campos
 * ausentes), menor o espaço que elas ganham para puxar o número.
 */

/*
 * Máximo desvio permitido em relação ao lambda de mercado puro.
 * Fora dessa faixa as estatísticas nunca decidem o resultado
 * sozinhas — apenas confirmam ou reduzem levemente a confiança do
 * mercado.
 */
const MIN_STATS_PULL_FACTOR = 0.85;
const MAX_STATS_PULL_FACTOR = 1.15;

/*
 * Peso-base do mercado por quantidade de casas concordando entre si
 * — mais casas, mais confiável o consenso, menos espaço para as
 * estatísticas puxarem o número. Mesma escala de confiabilidade já
 * usada em marketModelPipeline.ts (leagueReliability.dataReliability).
 */
function baseMarketWeightForBookmakerCount(bookmakerCount: number): number {
  if (bookmakerCount >= 3) {
    return 0.88;
  }

  if (bookmakerCount === 2) {
    return 0.8;
  }

  return 0.7;
}

/*
 * missingDataPenalty já vem de modelPipeline (0 a 0.20 — ver
 * modelPipeline/index.ts). Invertido para 1 (dados completos) a 0
 * (pior caso), usado para encolher o peso das estatísticas quando
 * elas próprias são pouco confiáveis.
 */
const MAX_MISSING_DATA_PENALTY = 0.2;

function statsQualityFactor(missingDataPenalty: number): number {
  const clamped = Math.min(
    Math.max(missingDataPenalty, 0),
    MAX_MISSING_DATA_PENALTY
  );

  return 1 - clamped / MAX_MISSING_DATA_PENALTY;
}

/*
 * Ajuste leve por qualidade do ajuste (fitError) do
 * fitMarketImpliedLambda: quando o formato Poisson/Dixon-Coles não
 * explica bem os preços do mercado, o consenso não fica mais errado
 * automaticamente, mas o abre um pouco mais de espaço para as
 * estatísticas equilibrarem — bounded para nunca virar decisivo.
 */
const FIT_ERROR_THRESHOLD = 0.01;
const MAX_FIT_ERROR_WEIGHT_SHIFT = 0.05;

function fitErrorWeightShift(fitError: number): number {
  if (!Number.isFinite(fitError) || fitError <= FIT_ERROR_THRESHOLD) {
    return 0;
  }

  const normalized = Math.min(fitError / (FIT_ERROR_THRESHOLD * 10), 1);

  return normalized * MAX_FIT_ERROR_WEIGHT_SHIFT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface FuseLambdasInput {
  statsLambdaHome: number;
  statsLambdaAway: number;

  marketLambdaHome: number;
  marketLambdaAway: number;

  bookmakerCount: number;
  fitError: number;

  /*
   * 0 (dados de time completos) a 0.20 (pior caso) — mesma escala de
   * modelPipeline/index.ts.
   */
  missingDataPenalty: number;
}

export interface FuseLambdasResult {
  lambdaHome: number;
  lambdaAway: number;

  marketWeight: number;
  statsWeight: number;

  baseMarketWeight: number;
  statsQualityFactor: number;

  minStatsPullFactor: number;
  maxStatsPullFactor: number;
}

export function fuseLambdas(
  input: FuseLambdasInput
): FuseLambdasResult {
  const baseMarketWeight = clamp(
    baseMarketWeightForBookmakerCount(input.bookmakerCount) -
      fitErrorWeightShift(input.fitError),
    0,
    1
  );

  const quality = statsQualityFactor(input.missingDataPenalty);

  /*
   * Quando os dados estatísticos são de péssima qualidade
   * (quality = 0), statsWeight cai a zero e o resultado é
   * idêntico ao caminho só-de-mercado — nunca pior que hoje.
   */
  const statsWeight = (1 - baseMarketWeight) * quality;
  const marketWeight = 1 - statsWeight;

  const rawLambdaHome =
    marketWeight * input.marketLambdaHome +
    statsWeight * input.statsLambdaHome;

  const rawLambdaAway =
    marketWeight * input.marketLambdaAway +
    statsWeight * input.statsLambdaAway;

  const lambdaHome = clamp(
    rawLambdaHome,
    input.marketLambdaHome * MIN_STATS_PULL_FACTOR,
    input.marketLambdaHome * MAX_STATS_PULL_FACTOR
  );

  const lambdaAway = clamp(
    rawLambdaAway,
    input.marketLambdaAway * MIN_STATS_PULL_FACTOR,
    input.marketLambdaAway * MAX_STATS_PULL_FACTOR
  );

  return {
    lambdaHome,
    lambdaAway,

    marketWeight,
    statsWeight,

    baseMarketWeight,
    statsQualityFactor: quality,

    minStatsPullFactor: MIN_STATS_PULL_FACTOR,
    maxStatsPullFactor: MAX_STATS_PULL_FACTOR
  };
}
