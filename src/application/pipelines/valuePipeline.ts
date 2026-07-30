import {
  expectedValue
} from "../../domain/value/expectedValue";

/* ==========================================
   VALUE PIPELINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber as probabilidades oficiais;
 * - localizar a odd correspondente;
 * - calcular odd justa;
 * - calcular probabilidade implícita;
 * - calcular expected value;
 * - calcular edge probabilístico;
 * - produzir diagnósticos de valor.
 *
 * Este arquivo não:
 *
 * - aplica odd mínima estratégica;
 * - classifica entradas como ELITE;
 * - modifica risco;
 * - modifica confiança;
 * - seleciona o melhor mercado;
 * - toma decisão de aposta.
 */

/* ==========================================
   MERCADOS
========================================== */

export type ValueMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

/* ==========================================
   CONTRATOS
========================================== */

export type ValueStatus =
  | "POSITIVE"
  | "NEUTRAL"
  | "NEGATIVE";

export interface ValueMarketResult {
  market: ValueMarket;

  probability: number;
  impliedProbability: number;

  odd: number;
  fairOdd: number;

  /*
   * Expected return por unidade apostada:
   *
   * EV = probability × odd - 1
   */
  ev: number;

  /*
   * Diferença entre probabilidade do modelo
   * e probabilidade implícita da odd.
   */
  probabilityEdge: number;

  /*
   * Campo legado.
   *
   * A partir desta versão representa o edge
   * probabilístico, e não uma cópia do EV.
   */
  edge: number;

  hasValue: boolean;
  valueStatus: ValueStatus;

  debug: {
    version: "V7.2_ELITE";

    probabilitySource: string;
    sourceProbability: number;

    oddAlias: string;
    sourceOdd: number;

    fairOddCalculation: number;
    impliedProbabilityCalculation: number;

    expectedValueCalculation: number;
    expectedValueDirectCheck: number;
    expectedValueDifference: number;
    evFormulaVerified: boolean;

    probabilityEdgeCalculation: number;

    warnings: string[];
  };
}

export interface RejectedValueMarket {
  market: string;

  reason:
    | "UNSUPPORTED_MARKET"
    | "INVALID_PROBABILITY"
    | "ODD_NOT_FOUND"
    | "INVALID_ODD"
    | "INVALID_EXPECTED_VALUE"
    | "EXPECTED_VALUE_FUNCTION_MISMATCH";
}

export interface ValuePipelineDebug {
  valid: boolean;

  version: "V7.2_ELITE";

  probabilityValid: boolean;

  receivedMarkets: number;
  generatedMarkets: number;
  rejectedMarkets: number;

  receivedOdds: Record<string, unknown>;

  rejected: RejectedValueMarket[];

  error?: string;
}

/* ==========================================
   ODDS ALIASES
========================================== */

/*
 * Esta compatibilidade pode ser removida no
 * futuro quando todas as entradas utilizarem
 * um contrato canônico único.
 */
const ODDS_ALIASES:
  Record<ValueMarket, string[]> = {
    HOME: [
      "HOME",
      "home",
      "HOME_WIN",
      "homeWin"
    ],

    DRAW: [
      "DRAW",
      "draw"
    ],

    AWAY: [
      "AWAY",
      "away",
      "AWAY_WIN",
      "awayWin"
    ],

    OVER_1_5: [
      "OVER_1_5",
      "over15",
      "OVER15",
      "over1_5"
    ],

    OVER_2_5: [
      "OVER_2_5",
      "over25",
      "OVER25",
      "over2_5"
    ],

    BTTS_YES: [
      "BTTS_YES",
      "bttsYes",
      "BTTSYES"
    ],

    BTTS_NO: [
      "BTTS_NO",
      "bttsNo",
      "BTTSNO"
    ],

    DOUBLE_CHANCE_1X: [
      "DOUBLE_CHANCE_1X",
      "homeOrDraw",
      "1X"
    ],

    DOUBLE_CHANCE_X2: [
      "DOUBLE_CHANCE_X2",
      "awayOrDraw",
      "X2"
    ]
  };

/* ==========================================
   PIPELINE
========================================== */

export function valuePipeline(
  data: any,
  odds: Record<string, number>
) {
  const probabilityValid =
    data?.probabilityValid !== false;

  const probabilityEntries =
    getProbabilityEntries(
      data?.probs
    );

  const safeOdds =
    isRecord(odds)
      ? odds
      : {};

  /*
   * Caso o probabilityPipeline tenha declarado
   * sua saída como inválida, nenhum valor deve
   * ser calculado.
   */
  if (!probabilityValid) {
    const debug:
      ValuePipelineDebug = {
        valid: false,

        version:
          "V7.2_ELITE",

        probabilityValid:
          false,

        receivedMarkets:
          probabilityEntries.length,

        generatedMarkets: 0,
        rejectedMarkets:
          probabilityEntries.length,

        receivedOdds:
          safeOdds,

        rejected:
          probabilityEntries.map(
            ([market]) => ({
              market,

              reason:
                "INVALID_PROBABILITY"
            })
          ),

        error:
          "INVALID_PROBABILITY_PIPELINE"
      };

    return {
      ...data,

      valueValid:
        false,

      markets: [],

      debug: {
        ...(data?.debug ?? {}),

        valuePipeline:
          debug
      }
    };
  }

  const markets:
    ValueMarketResult[] = [];

  const rejected:
    RejectedValueMarket[] = [];

  for (
    const [
      rawMarket,
      rawProbability
    ] of probabilityEntries
  ) {
    const market =
      parseValueMarket(
        rawMarket
      );

    if (!market) {
      rejected.push({
        market:
          rawMarket,

        reason:
          "UNSUPPORTED_MARKET"
      });

      continue;
    }

    const probability =
      parseProbability(
        rawProbability
      );

    if (probability === null) {
      rejected.push({
        market,

        reason:
          "INVALID_PROBABILITY"
      });

      continue;
    }

    const oddLookup =
      findOdd(
        market,
        safeOdds
      );

    if (!oddLookup.found) {
      rejected.push({
        market,

        reason:
          oddLookup.reason
      });

      continue;
    }

    const odd =
      oddLookup.odd;

    const impliedProbability =
      1 / odd;

    const fairOdd =
      probability > 0
        ? 1 / probability
        : Number.POSITIVE_INFINITY;

    const rawEv =
      expectedValue(
        probability,
        odd
      );

    const ev =
      parseFiniteNumber(
        rawEv
      );

    if (ev === null) {
      rejected.push({
        market,

        reason:
          "INVALID_EXPECTED_VALUE"
      });

      continue;
    }

    /*
     * Verificação independente da fórmula oficial:
     *
     * EV = probability × odd - 1
     */
    const directEv =
      probability *
      odd -
      1;

    const evDifference =
      Math.abs(
        ev -
        directEv
      );

    const evFormulaVerified =
      evDifference <=
      1e-10;

    if (!evFormulaVerified) {
      rejected.push({
        market,

        reason:
          "EXPECTED_VALUE_FUNCTION_MISMATCH"
      });

      continue;
    }

    const probabilityEdge =
      probability -
      impliedProbability;

    const valueStatus =
      classifyValueStatus(
        ev
      );

    const roundedProbability =
      roundNumber(
        probability
      );

    const roundedOdd =
      roundNumber(
        odd
      );

    const roundedFairOdd =
      roundNumber(
        fairOdd
      );

    const roundedImpliedProbability =
      roundNumber(
        impliedProbability
      );

    const roundedEv =
      roundNumber(
        ev
      );

    const roundedProbabilityEdge =
      roundNumber(
        probabilityEdge
      );

    markets.push({
      market,

      probability:
        roundedProbability,

      impliedProbability:
        roundedImpliedProbability,

      odd:
        roundedOdd,

      fairOdd:
        roundedFairOdd,

      ev:
        roundedEv,

      probabilityEdge:
        roundedProbabilityEdge,

      /*
       * Compatibilidade temporária.
       */
      edge:
        roundedProbabilityEdge,

      hasValue:
        ev > 0,

      valueStatus,

      debug: {
        version:
          "V7.2_ELITE",

        probabilitySource:
          `data.probs.${market}`,

        sourceProbability:
          probability,

        oddAlias:
          oddLookup.alias,

        sourceOdd:
          odd,

        fairOddCalculation:
          fairOdd,

        impliedProbabilityCalculation:
          impliedProbability,

        expectedValueCalculation:
          ev,

        expectedValueDirectCheck:
          directEv,

        expectedValueDifference:
          evDifference,

        evFormulaVerified,

        probabilityEdgeCalculation:
          probabilityEdge,

        warnings: []
      }
    });
  }

  const valueValid =
    markets.length > 0;

  const debug:
    ValuePipelineDebug = {
      valid:
        valueValid,

      version:
        "V7.2_ELITE",

      probabilityValid:
        true,

      receivedMarkets:
        probabilityEntries.length,

      generatedMarkets:
        markets.length,

      rejectedMarkets:
        rejected.length,

      receivedOdds:
        safeOdds,

      rejected,

      ...(
        valueValid
          ? {}
          : {
              error:
                "NO_VALID_VALUE_MARKETS"
            }
      )
    };

  return {
    ...data,

    valueValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      valuePipeline: {
        ...debug,

        markets
      }
    }
  };
}

/* ==========================================
   LOCALIZAÇÃO DA ODD
========================================== */

function findOdd(
  market: ValueMarket,
  odds: Record<string, number>
):
  | {
      found: true;
      odd: number;
      alias: string;
    }
  | {
      found: false;
      reason:
        | "ODD_NOT_FOUND"
        | "INVALID_ODD";
    } {
  const aliases =
    ODDS_ALIASES[market];

  let invalidOddFound =
    false;

  for (const alias of aliases) {
    if (
      !Object.prototype.hasOwnProperty.call(
        odds,
        alias
      )
    ) {
      continue;
    }

    const odd =
      parseOdd(
        odds[alias]
      );

    if (odd !== null) {
      return {
        found: true,
        odd,
        alias
      };
    }

    invalidOddFound =
      true;
  }

  return {
    found: false,

    reason:
      invalidOddFound
        ? "INVALID_ODD"
        : "ODD_NOT_FOUND"
  };
}

/* ==========================================
   CLASSIFICAÇÃO DESCRITIVA
========================================== */

/*
 * Esta classificação apenas descreve o sinal
 * matemático do EV.
 *
 * Não representa decisão operacional.
 */
function classifyValueStatus(
  ev: number
): ValueStatus {
  const epsilon =
    1e-9;

  if (ev > epsilon) {
    return "POSITIVE";
  }

  if (ev < -epsilon) {
    return "NEGATIVE";
  }

  return "NEUTRAL";
}

/* ==========================================
   MERCADOS SUPORTADOS
========================================== */

function parseValueMarket(
  value: unknown
): ValueMarket | null {
  const market =
    String(value ?? "")
      .trim()
      .toUpperCase();

  switch (market) {
    case "HOME":
    case "DRAW":
    case "AWAY":
    case "OVER_1_5":
    case "OVER_2_5":
    case "BTTS_YES":
    case "BTTS_NO":
    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
      return market;

    default:
      return null;
  }
}

/* ==========================================
   VALIDAÇÃO
========================================== */

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

function parseOdd(
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
    parsed <= 1
  ) {
    return null;
  }

  return parsed;
}
function parseFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getProbabilityEntries(
  value: unknown
): Array<[string, unknown]> {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(
    value
  );
}

function isRecord(
  value: unknown
): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/* ==========================================
   ARREDONDAMENTO
========================================== */

function roundNumber(
  value: number,
  decimals = 6
): number {
  /*
   * Infinity é preservado para representar
   * corretamente fairOdd quando P = 0.
   */
  if (
    value === Number.POSITIVE_INFINITY ||
    value === Number.NEGATIVE_INFINITY
  ) {
    return value;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}