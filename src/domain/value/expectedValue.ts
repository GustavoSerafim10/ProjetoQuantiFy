/* ==========================================
   EXPECTED VALUE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - calcular o retorno esperado por unidade;
 * - classificar apenas o sinal matemático do EV;
 * - não aplicar regras operacionais;
 * - não decidir entrada.
 */

/* ==========================================
   TIPOS
========================================== */

export type ExpectedValueStatus =
  | "STRONG_VALUE"
  | "VALUE"
  | "MARGINAL_VALUE"
  | "BREAKEVEN"
  | "NO_VALUE";

/* ==========================================
   VALIDAÇÃO
========================================== */

function isValidNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

/* ==========================================
   EXPECTED VALUE
========================================== */

/*
 * EV por unidade apostada:
 *
 * EV = p × odd - 1
 *
 * Exemplos:
 *
 * p = 0.60
 * odd = 2.00
 *
 * EV = 0.20
 * retorno esperado = 20%
 *
 * voidProbability (opcional, default 0):
 *
 * Para mercados com anulação (ex.: Empate Anula), uma
 * fração das partidas não gera ganho nem perda — o
 * stake é devolvido. Isso desconta o EV proporcionalmente,
 * já que essa fração não contribui capital ao retorno
 * esperado:
 *
 * EV = (1 - voidProbability) × (p × odd - 1)
 *
 * Com voidProbability = 0 (padrão), a fórmula volta a
 * ser exatamente a original — nenhum mercado existente
 * muda de comportamento.
 */
export function expectedValue(
  probability: number,
  odd: number,
  voidProbability: number = 0
): number {
  if (
    !isValidNumber(probability) ||
    !isValidNumber(odd) ||
    !isValidNumber(voidProbability)
  ) {
    return Number.NaN;
  }

  if (
    probability < 0 ||
    probability > 1 ||
    odd <= 1 ||
    voidProbability < 0 ||
    voidProbability >= 1
  ) {
    return Number.NaN;
  }

  return (
    (1 - voidProbability) *
    (
      probability *
      odd -
      1
    )
  );
}

/* ==========================================
   CLASSIFICAÇÃO DESCRITIVA
========================================== */

/*
 * Esta classificação descreve somente a
 * intensidade matemática do EV.
 *
 * Não representa autorização para apostar.
 */
export function classifyBet(
  ev: number
): ExpectedValueStatus {
  if (!Number.isFinite(ev)) {
    return "NO_VALUE";
  }

  const epsilon =
    1e-9;

  if (ev >= 0.12) {
    return "STRONG_VALUE";
  }

  if (ev >= 0.05) {
    return "VALUE";
  }

  if (ev > epsilon) {
    return "MARGINAL_VALUE";
  }

  if (
    Math.abs(ev) <=
    epsilon
  ) {
    return "BREAKEVEN";
  }

  return "NO_VALUE";
}