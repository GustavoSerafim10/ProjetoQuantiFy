import type {
  MarketDecision
} from "./gameAnalyzer";

/* ==========================================
   BEST ONLY SELECTOR — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já avaliados pelo Decision;
 * - considerar somente candidatos aprovados;
 * - respeitar o ranking oficial;
 * - retornar apenas o melhor mercado elegível.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade;
 * - recalcula EV;
 * - recalcula risco;
 * - recalcula confiança;
 * - recalcula ranking;
 * - cria score operacional;
 * - altera classificação;
 * - altera decisão;
 * - calcula stake.
 *
 * Autoridades:
 *
 * Decision  -> define elegibilidade.
 * Ranking   -> define ordem quantitativa.
 * Selector  -> escolhe o primeiro elegível.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface BestOnlySelectionDebug {
  valid:
    boolean;

  version:
    "V7.2_ELITE";

  selectable:
    boolean;

  decisionAuthority:
    string | null;

  decisionValid:
    boolean;

  authoritySource:
    "classification" |
    "decision_legacy" |
    "tier_legacy" |
    "missing";

  rankingValid:
    boolean;

  rankingScore:
    number | null;

  rank:
    number | null;

  selectionReason:
    string;

  warnings:
    string[];
}

export type SelectedMarket =
  MarketDecision & {
    bestOnlySelected:
      true;

    selectionReason:
      "HIGHEST_APPROVED_RANKING";

    debug?: {
      [key: string]:
        unknown;

      bestOnlySelector:
        BestOnlySelectionDebug;
    };
  };

/* ==========================================
   POLÍTICA
========================================== */

/*
 * O selector aceita somente estados explicitamente
 * aprovados pela camada de decisão.
 *
 * Zone, warning, Kelly, odd e score auxiliar não são
 * autoridades de seleção.
 */
const APPROVED_DECISIONS =
  new Set([
    "BET",
    "ELITE",
    "SCALPER"
  ]);

/* ==========================================
   FUNÇÃO PRINCIPAL
========================================== */

export function selectBestMarket(
  markets:
    MarketDecision[]
): SelectedMarket | null {
  if (
    !Array.isArray(
      markets
    ) ||
    markets.length === 0
  ) {
    return null;
  }

  const candidates =
    markets
      .map(
        (
          market,
          originalIndex
        ) =>
          buildCandidate(
            market,
            originalIndex
          )
      )
      .filter(
        candidate =>
          candidate.selectable
      );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  candidates.sort(
    compareCandidates
  );

  const selected =
    candidates[0];

  const originalDebug =
    isRecord(
      (selected.market as any)
        ?.debug
    )
      ? (
          selected.market as any
        ).debug
      : {};

  const warnings =
    normalizeWarnings(
      (selected.market as any)
        ?.warnings
    );

  return {
    ...selected.market,

    bestOnlySelected:
      true,

    selectionReason:
      "HIGHEST_APPROVED_RANKING",

    debug: {
      ...originalDebug,

      bestOnlySelector: {
        valid:
          true,

        version:
          "V7.2_ELITE",

        selectable:
          true,

        decisionAuthority:
          selected
            .decisionAuthority,

        decisionValid:
          selected
            .decisionValid,

        authoritySource:
          selected
            .authoritySource,

        rankingValid:
          selected
            .rankingValid,

        rankingScore:
          roundNumber(
            selected.rankingScore
          ),

        rank:
          selected.rank,

        selectionReason:
          "HIGHEST_APPROVED_RANKING",

        warnings
      }
    }
  } as SelectedMarket;
}

/* ==========================================
   CANDIDATO
========================================== */

interface Candidate {
  market:
    MarketDecision;

  originalIndex:
    number;

  selectable:
    boolean;

  decisionAuthority:
    string | null;

  decisionValid:
    boolean;

  authoritySource:
    "classification" |
    "decision_legacy" |
    "tier_legacy" |
    "missing";

  rankingValid:
    boolean;

  rankingScore:
    number;

  rank:
    number | null;

  ev:
    number;

  probabilityEdge:
    number;

  risk:
    number;

  confidence:
    number;

  probability:
    number;
}

function buildCandidate(
  market:
    MarketDecision,

  originalIndex:
    number
): Candidate {
  const authority =
    getDecisionAuthority(
      market
    );

  const decisionAuthority =
    authority.value;

  const approved =
    decisionAuthority !== null &&
    APPROVED_DECISIONS.has(
      decisionAuthority
    );

  const decisionValid =
    (market as any)
      ?.decisionValid === true;

  /*
   * Ranking explicitamente inválido bloqueia.
   * Campo ausente permanece compatível, desde que
   * exista rankingScore válido.
   */
  const rankingValid =
    (market as any)
      ?.rankingValid !== false;

  const rankingScore =
    parseProbability(
      (market as any)
        ?.rankingScore
    );

  const selectable =
    approved &&
    decisionValid &&
    rankingValid &&
    rankingScore !== null;

  return {
    market,

    originalIndex,

    selectable,

    decisionAuthority,

    decisionValid,

    authoritySource:
      authority.source,

    rankingValid,

    rankingScore:
      rankingScore ??
      Number.NEGATIVE_INFINITY,

    rank:
      parsePositiveInteger(
        (market as any)
          ?.rank
      ),

    ev:
      parseFiniteNumber(
        (market as any)
          ?.ev
      ) ??
      Number.NEGATIVE_INFINITY,

    probabilityEdge:
      firstFiniteNumber([
        (market as any)
          ?.probabilityEdge,

        /*
         * Alias legado temporário.
         */
        (market as any)
          ?.edge
      ]) ??
      Number.NEGATIVE_INFINITY,

    risk:
      firstProbability([
        (market as any)
          ?.riskScore,

        (market as any)
          ?.risk
      ]) ??
      1,

    confidence:
      parseProbability(
        (market as any)
          ?.confidence
      ) ??
      0,

    probability:
      parseProbability(
        (market as any)
          ?.probability
      ) ??
      0
  };
}

/* ==========================================
   AUTORIDADE DE DECISÃO
========================================== */

function getDecisionAuthority(
  market:
    MarketDecision
): {
  value:
    string | null;

  source:
    "classification" |
    "decision_legacy" |
    "tier_legacy" |
    "missing";
} {
  /*
   * V7.2:
   *
   * classification é a autoridade oficial produzida
   * pelo DecisionPipeline.
   *
   * decision e tier existem apenas como fallback
   * legado para rotas antigas.
   */
  const classification =
    normalizeDecision(
      (market as any)
        ?.classification
    );

  if (classification) {
    return {
      value:
        classification,

      source:
        "classification"
    };
  }

  const decision =
    normalizeDecision(
      (market as any)
        ?.decision
    );

  if (decision) {
    return {
      value:
        decision,

      source:
        "decision_legacy"
    };
  }

  const tier =
    normalizeDecision(
      (market as any)
        ?.tier
    );

  if (tier) {
    return {
      value:
        tier,

      source:
        "tier_legacy"
    };
  }

  return {
    value:
      null,

    source:
      "missing"
  };
}

function normalizeDecision(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

/* ==========================================
   ORDENAÇÃO
========================================== */

/*
 * O rankingScore é a autoridade principal.
 *
 * Os demais campos servem somente como desempate
 * determinístico e não criam um segundo ranking.
 */
function compareCandidates(
  first:
    Candidate,

  second:
    Candidate
): number {
  /*
   * O rank oficial é a primeira autoridade.
   *
   * O rankingScore só atua em seguida, mantendo a
   * mesma ordem utilizada pelo DecisionPipeline.
   */
  if (
    first.rank !== null &&
    second.rank !== null &&
    first.rank !==
      second.rank
  ) {
    return (
      first.rank -
      second.rank
    );
  }

  const rankingDifference =
    second.rankingScore -
    first.rankingScore;

  if (
    Math.abs(
      rankingDifference
    ) >
    1e-12
  ) {
    return rankingDifference;
  }

  const evDifference =
    second.ev -
    first.ev;

  if (
    Math.abs(
      evDifference
    ) >
    1e-12
  ) {
    return evDifference;
  }

  const edgeDifference =
    second
      .probabilityEdge -
    first
      .probabilityEdge;

  if (
    Math.abs(
      edgeDifference
    ) >
    1e-12
  ) {
    return edgeDifference;
  }

  const riskDifference =
    first.risk -
    second.risk;

  if (
    Math.abs(
      riskDifference
    ) >
    1e-12
  ) {
    return riskDifference;
  }

  const confidenceDifference =
    second.confidence -
    first.confidence;

  if (
    Math.abs(
      confidenceDifference
    ) >
    1e-12
  ) {
    return confidenceDifference;
  }

  const probabilityDifference =
    second.probability -
    first.probability;

  if (
    Math.abs(
      probabilityDifference
    ) >
    1e-12
  ) {
    return probabilityDifference;
  }

  return (
    first.originalIndex -
    second.originalIndex
  );
}

/* ==========================================
   HELPERS
========================================== */

function firstFiniteNumber(
  values:
    unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseFiniteNumber(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function firstProbability(
  values:
    unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseProbability(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function parseProbability(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function parsePositiveInteger(
  value:
    unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    !Number.isInteger(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeWarnings(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          warning =>
            String(
              warning ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  ];
}

function isRecord(
  value:
    unknown
): value is
  Record<string, unknown> {
  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}

function roundNumber(
  value:
    number,

  decimals =
    6
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}
