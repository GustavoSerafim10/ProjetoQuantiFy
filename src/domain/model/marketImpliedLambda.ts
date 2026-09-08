import { goalsModel } from "../marketModels/goalsModel";

/*
 * Em vez de estimar lambdaHome/lambdaAway a partir de stats de
 * temporada digitadas (o caminho antigo, `lambdaBuilder/`), este
 * módulo ajusta os lambdas para REPRODUZIREM as probabilidades de
 * consenso do mercado (já sem margem — ver `domain/odds/devig.ts`).
 *
 * Isso é possível porque `goalsModel(lambdaHome, lambdaAway)` é uma
 * função pura desses dois números (os parâmetros de stats nem são
 * usados — ver goalsModel/index.ts) — então dá pra reaproveitar
 * 100% da mesma matriz Poisson/Dixon-Coles, só trocando de onde vêm
 * os lambdas. Todo o resto do pipeline (risco, correlação, ranking,
 * decisão) continua funcionando sem mudança nenhuma.
 *
 * Busca determinística (grade grossa + refino local) — sem RNG,
 * para manter a mesma exigência de determinismo já estabelecida no
 * projeto (ver runBacktest).
 */

export interface MarketImpliedTargets {
  home?: number;
  draw?: number;
  away?: number;

  over15?: number;
  under15?: number;

  over25?: number;
  under25?: number;

  bttsYes?: number;
  bttsNo?: number;
}

type GoalsModelField =
  | "homeWin"
  | "draw"
  | "awayWin"
  | "over15"
  | "under15"
  | "over25"
  | "under25"
  | "bttsYes"
  | "bttsNo";

const TARGET_TO_FIELD: Record<
  keyof MarketImpliedTargets,
  GoalsModelField
> = {
  home: "homeWin",
  draw: "draw",
  away: "awayWin",

  over15: "over15",
  under15: "under15",

  over25: "over25",
  under25: "under25",

  bttsYes: "bttsYes",
  bttsNo: "bttsNo"
};

/*
 * Mesma faixa de segurança individual já usada pelo lambdaBuilder
 * (constants.ts: MIN_LAMBDA/MAX_LAMBDA), reaproveitada aqui para
 * manter os dois caminhos comparáveis.
 */
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 3.2;

export interface MarketImpliedLambdaResult {
  lambdaHome: number;
  lambdaAway: number;

  /*
   * Erro quadrático médio entre as probabilidades geradas pelos
   * lambdas ajustados e os alvos de-vig — 0 é ajuste perfeito.
   * Alto significa que a forma Poisson/Dixon-Coles não explica bem
   * os preços desse jogo (ex: mercados inconsistentes entre si).
   */
  fitError: number;

  diagnostics: {
    targetsUsed: string[];
    targetCount: number;
  };
}

function computeError(
  lambdaHome: number,
  lambdaAway: number,
  targets: Array<{ field: GoalsModelField; value: number }>
): number {
  const result = goalsModel(lambdaHome, lambdaAway);

  let sumSquaredError = 0;

  for (const target of targets) {
    const predicted = result[target.field];
    const error = predicted - target.value;
    sumSquaredError += error * error;
  }

  return sumSquaredError / targets.length;
}

function searchGrid(
  targets: Array<{ field: GoalsModelField; value: number }>,
  homeCenter: number,
  awayCenter: number,
  homeRange: number,
  awayRange: number,
  steps: number
): { lambdaHome: number; lambdaAway: number; error: number } {
  const homeMin = Math.max(MIN_LAMBDA, homeCenter - homeRange);
  const homeMax = Math.min(MAX_LAMBDA, homeCenter + homeRange);
  const awayMin = Math.max(MIN_LAMBDA, awayCenter - awayRange);
  const awayMax = Math.min(MAX_LAMBDA, awayCenter + awayRange);

  const homeStep = (homeMax - homeMin) / steps;
  const awayStep = (awayMax - awayMin) / steps;

  let best = {
    lambdaHome: homeCenter,
    lambdaAway: awayCenter,
    error: Number.POSITIVE_INFINITY
  };

  for (let i = 0; i <= steps; i++) {
    const lambdaHome = homeMin + i * homeStep;

    for (let j = 0; j <= steps; j++) {
      const lambdaAway = awayMin + j * awayStep;

      const error = computeError(lambdaHome, lambdaAway, targets);

      if (error < best.error) {
        best = { lambdaHome, lambdaAway, error };
      }
    }
  }

  return best;
}

/*
 * Ajusta lambdaHome/lambdaAway para reproduzir os alvos de-vig
 * informados. Funciona com qualquer subconjunto de mercados —
 * o board de odds às vezes só tem 1X2 + O/U, outras vezes 1X2 +
 * BTTS. Sem nenhum alvo válido, retorna os lambdas neutros de
 * fallback do próprio goalsModel (não inventa dados).
 */
export function fitMarketImpliedLambda(
  targets: MarketImpliedTargets
): MarketImpliedLambdaResult {
  const activeTargets = (
    Object.keys(targets) as Array<keyof MarketImpliedTargets>
  )
    .filter(key => {
      const value = targets[key];
      return typeof value === "number" && Number.isFinite(value);
    })
    .map(key => ({
      field: TARGET_TO_FIELD[key],
      value: targets[key] as number
    }));

  if (activeTargets.length === 0) {
    return {
      lambdaHome: 1.32,
      lambdaAway: 1.23,
      fitError: 0,
      diagnostics: {
        targetsUsed: [],
        targetCount: 0
      }
    };
  }

  /*
   * Passo 1: grade grossa cobrindo toda a faixa válida.
   * Passo 2: refino local ao redor do melhor ponto encontrado.
   */
  const coarse = searchGrid(
    activeTargets,
    (MIN_LAMBDA + MAX_LAMBDA) / 2,
    (MIN_LAMBDA + MAX_LAMBDA) / 2,
    (MAX_LAMBDA - MIN_LAMBDA) / 2,
    (MAX_LAMBDA - MIN_LAMBDA) / 2,
    30
  );

  const refined = searchGrid(
    activeTargets,
    coarse.lambdaHome,
    coarse.lambdaAway,
    0.15,
    0.15,
    30
  );

  return {
    lambdaHome: Math.round(refined.lambdaHome * 10000) / 10000,
    lambdaAway: Math.round(refined.lambdaAway * 10000) / 10000,
    fitError: Math.round(refined.error * 1e8) / 1e8,

    diagnostics: {
      targetsUsed: activeTargets.map(target => target.field),
      targetCount: activeTargets.length
    }
  };
}
