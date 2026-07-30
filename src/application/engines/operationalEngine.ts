/* ==========================================
   OPERATIONAL ENGINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber partidas já processadas;
 * - coletar somente mercados aprovados;
 * - ordenar pelo ranking oficial;
 * - limitar quantidade de entradas;
 * - evitar múltiplas entradas do mesmo jogo;
 * - produzir resumo operacional.
 *
 * Este arquivo não:
 *
 * - recalcula EV;
 * - recalcula probabilidade;
 * - recalcula risco;
 * - recalcula confiança;
 * - transforma EV positivo em autorização;
 * - substitui o decisionPipeline;
 * - define stake com base apenas em EV.
 */

/* ==========================================
   TIPOS
========================================== */

interface OperationalBet {
  match: string;

  league: string;

  market: string;

  probability: number;

  odd: number;

  ev: number;

  risk: number;

  confidence: number;

  rankingScore: number;

  decisionValid: boolean;

  actionable: boolean;

  classification: string;

  authoritySource:
    | "classification"
    | "decision_legacy"
    | "tier_legacy"
    | "missing";

  rankingSource:
    | "rankingScore"
    | "score_legacy"
    | "edgeScore_legacy"
    | "missing";

  stake: number;

  tier: string;

  [key: string]: unknown;
}

interface OperationalRejection {
  match: string;
  market: string | null;

  reason:
    | "MISSING_BET"
    | "INVALID_DECISION"
    | "NOT_ACTIONABLE"
    | "INVALID_MARKET"
    | "INVALID_PROBABILITY"
    | "INVALID_ODD"
    | "INVALID_EV"
    | "INVALID_RANKING"
    | "OPERATIONAL_LIMIT"
    | "EXPOSURE_LIMIT";

  classification: string | null;
  decisionValid: boolean | null;
  actionable: boolean | null;
}

interface DecisionAuthorityResolution {
  value: string | null;

  source:
    | "classification"
    | "decision_legacy"
    | "tier_legacy"
    | "missing";
}

interface RankingResolution {
  value: number | null;

  source:
    | "rankingScore"
    | "score_legacy"
    | "edgeScore_legacy"
    | "missing";
}

interface OperationalEngineConfig {
  maxPicks?: number;

  maxPicksPerMatch?: number;

  minimumRankingScore?: number;

  minimumConfidence?: number;

  maximumRisk?: number;
}

/* ==========================================
   POLÍTICA
========================================== */

const APPROVED_CLASSIFICATIONS =
  new Set([
    "BET",
    "ELITE",
    "SCALPER"
  ]);

const DEFAULT_MAX_PICKS =
  3;

const DEFAULT_MAX_PICKS_PER_MATCH =
  1;

const DEFAULT_MINIMUM_RANKING_SCORE =
  0;

const DEFAULT_MINIMUM_CONFIDENCE =
  0;

const DEFAULT_MAXIMUM_RISK =
  1;

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

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  return (
    parseFiniteNumber(value) ??
    fallback
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function normalizeBoolean(
  value: unknown
): boolean {
  return value === true;
}

function resolveRankingScore(
  bet: any
): RankingResolution {
  const official =
    parseFiniteNumber(
      bet?.rankingScore
    );

  if (official !== null) {
    return {
      value:
        official,

      source:
        "rankingScore"
    };
  }

  const legacyScore =
    parseFiniteNumber(
      bet?.score
    );

  if (legacyScore !== null) {
    return {
      value:
        legacyScore,

      source:
        "score_legacy"
    };
  }

  const legacyEdgeScore =
    parseFiniteNumber(
      bet?.edgeScore
    );

  if (legacyEdgeScore !== null) {
    return {
      value:
        legacyEdgeScore,

      source:
        "edgeScore_legacy"
    };
  }

  return {
    value:
      null,

    source:
      "missing"
  };
}

function resolveRisk(
  bet: any
): number {
  return clamp(
    safeNumber(
      bet?.risk ??
      bet?.riskScore,
      1
    ),
    0,
    1
  );
}

function resolveConfidence(
  bet: any
): number {
  return clamp(
    safeNumber(
      bet?.confidence,
      0
    ),
    0,
    1
  );
}

function resolveStake(
  bet: any
): number {
  /*
   * O stake deve ter sido definido anteriormente
   * por uma política específica de bankroll.
   *
   * O operationalEngine apenas preserva o valor.
   */
  return Math.max(
    safeNumber(
      bet?.stake,
      0
    ),
    0
  );
}

function resolveTier(
  bet: any
): string {
  const tier =
    String(
      bet?.classification ??
      bet?.tier ??
      bet?.status ??
      "APPROVED"
    )
      .trim()
      .toUpperCase();

  return tier ||
    "APPROVED";
}

function normalizeDecision(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "NO BET":
    case "NOBET":
      return "NO BET";

    case "WATCHLIST":
      return "WATCHLIST";

    case "BET":
      return "BET";

    case "ELITE":
      return "ELITE";

    case "SCALPER":
      return "SCALPER";

    default:
      return normalized;
  }
}

function resolveDecisionAuthority(
  bet: any
): DecisionAuthorityResolution {
  const classification =
    normalizeDecision(
      bet?.classification
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
      bet?.decision
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
      bet?.tier
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

/* ==========================================
   VALIDAÇÃO DE ENTRADA
========================================== */

function isApprovedBet(
  bet: any
): {
  approved: boolean;
  authority: DecisionAuthorityResolution;
  decisionValid: boolean;
  actionable: boolean;
} {
  if (!bet) {
    return {
      approved:
        false,

      authority: {
        value:
          null,

        source:
          "missing"
      },

      decisionValid:
        false,

      actionable:
        false
    };
  }

  const authority =
    resolveDecisionAuthority(
      bet
    );

  const decisionValid =
    normalizeBoolean(
      bet.decisionValid
    );

  const actionable =
    normalizeBoolean(
      bet.actionable ??
      bet.approved
    );

  const classificationApproved =
    authority.value !== null &&
    APPROVED_CLASSIFICATIONS.has(
      authority.value
    );

  return {
    approved:
      decisionValid &&
      actionable &&
      classificationApproved,

    authority,

    decisionValid,

    actionable
  };
}

/* ==========================================
   NORMALIZAÇÃO
========================================== */

function normalizeBet(
  matchData: any,
  bet: any
): {
  bet: OperationalBet | null;
  rejection: OperationalRejection | null;
} {
  const match =
    String(
      matchData?.match ??
      bet?.match ??
      "UNKNOWN_MATCH"
    );

  const approval =
    isApprovedBet(
      bet
    );

  const market =
    String(
      bet?.market ??
      ""
    )
      .trim()
      .toUpperCase();

  const baseRejection = (
    reason:
      OperationalRejection["reason"]
  ): OperationalRejection => ({
    match,

    market:
      market || null,

    reason,

    classification:
      approval.authority.value,

    decisionValid:
      bet
        ? approval.decisionValid
        : null,

    actionable:
      bet
        ? approval.actionable
        : null
  });

  if (!bet) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "MISSING_BET"
        )
    };
  }

  if (
    !approval.decisionValid ||
    approval.authority.value ===
      null ||
    !APPROVED_CLASSIFICATIONS.has(
      approval.authority.value
    )
  ) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_DECISION"
        )
    };
  }

  if (!approval.actionable) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "NOT_ACTIONABLE"
        )
    };
  }

  if (!market) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_MARKET"
        )
    };
  }

  const probability =
    parseFiniteNumber(
      bet?.probability
    );

  if (
    probability === null ||
    probability < 0 ||
    probability > 1
  ) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_PROBABILITY"
        )
    };
  }

  const odd =
    parseFiniteNumber(
      bet?.odd
    );

  if (
    odd === null ||
    odd <= 1
  ) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_ODD"
        )
    };
  }

  const ev =
    parseFiniteNumber(
      bet?.ev
    );

  if (ev === null) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_EV"
        )
    };
  }

  const ranking =
    resolveRankingScore(
      bet
    );

  if (
    ranking.value === null
  ) {
    return {
      bet:
        null,

      rejection:
        baseRejection(
          "INVALID_RANKING"
        )
    };
  }

  return {
    bet: {
      ...bet,

      match,

      league:
        String(
          matchData?.league ??
          bet?.league ??
          "UNKNOWN_LEAGUE"
        ),

      market,

      probability,

      odd,

      ev,

      risk:
        resolveRisk(
          bet
        ),

      confidence:
        resolveConfidence(
          bet
        ),

      rankingScore:
        ranking.value,

      decisionValid:
        true,

      actionable:
        true,

      classification:
        approval.authority
          .value as string,

      authoritySource:
        approval.authority
          .source,

      rankingSource:
        ranking.source,

      stake:
        resolveStake(
          bet
        ),

      tier:
        resolveTier(
          bet
        )
    },

    rejection:
      null
  };
}

/* ==========================================
   EXTRAÇÃO
========================================== */

function collectApprovedBets(
  matches: any[]
): {
  bets: OperationalBet[];
  rejections: OperationalRejection[];
} {
  const bets:
    OperationalBet[] = [];

  const rejections:
    OperationalRejection[] = [];

  for (
    const matchData of
    matches
  ) {
    const candidates = [
      matchData?.best,

      ...(Array.isArray(
        matchData?.actionableMarkets
      )
        ? matchData.actionableMarkets
        : [])
    ];

    for (
      const candidate of
      candidates
    ) {
      const normalized =
        normalizeBet(
          matchData,
          candidate
        );

      if (normalized.bet) {
        bets.push(
          normalized.bet
        );
      } else if (
        normalized.rejection
      ) {
        rejections.push(
          normalized.rejection
        );
      }
    }
  }

  const unique =
    new Map<
      string,
      OperationalBet
    >();

  for (const bet of bets) {
    const key =
      [
        bet.match,
        bet.market
      ].join("::");

    const current =
      unique.get(key);

    if (
      !current ||
      bet.rankingScore >
        current.rankingScore
    ) {
      unique.set(
        key,
        bet
      );
    }
  }

  return {
    bets: [
      ...unique.values()
    ],

    rejections
  };
}

/* ==========================================
   FILTROS OPERACIONAIS
========================================== */

function passesOperationalLimits(
  bet: OperationalBet,
  config: Required<
    OperationalEngineConfig
  >
): boolean {
  return (
    bet.rankingScore >=
      config.minimumRankingScore &&
    bet.confidence >=
      config.minimumConfidence &&
    bet.risk <=
      config.maximumRisk
  );
}

/* ==========================================
   CONTROLE DE EXPOSIÇÃO
========================================== */

function selectWithExposureLimits(
  sortedBets: OperationalBet[],
  maxPicks: number,
  maxPicksPerMatch: number
): OperationalBet[] {
  const selected:
    OperationalBet[] = [];

  const matchExposure =
    new Map<string, number>();

  for (const bet of sortedBets) {
    if (
      selected.length >=
      maxPicks
    ) {
      break;
    }

    const currentMatchExposure =
      matchExposure.get(
        bet.match
      ) ?? 0;

    if (
      currentMatchExposure >=
      maxPicksPerMatch
    ) {
      continue;
    }

    selected.push(
      bet
    );

    matchExposure.set(
      bet.match,
      currentMatchExposure + 1
    );
  }

  return selected;
}

/* ==========================================
   ENGINE
========================================== */

export function operationalEngine(
  matches: any[],
  config:
    OperationalEngineConfig = {}
) {
  const safeMatches =
    Array.isArray(matches)
      ? matches
      : [];

  const resolvedConfig:
    Required<
      OperationalEngineConfig
    > = {
    maxPicks:
      Math.max(
        Math.floor(
          safeNumber(
            config.maxPicks,
            DEFAULT_MAX_PICKS
          )
        ),
        0
      ),

    maxPicksPerMatch:
      Math.max(
        Math.floor(
          safeNumber(
            config.maxPicksPerMatch,
            DEFAULT_MAX_PICKS_PER_MATCH
          )
        ),
        1
      ),

    minimumRankingScore:
      clamp(
        safeNumber(
          config.minimumRankingScore,
          DEFAULT_MINIMUM_RANKING_SCORE
        ),
        0,
        1
      ),

    minimumConfidence:
      clamp(
        safeNumber(
          config.minimumConfidence,
          DEFAULT_MINIMUM_CONFIDENCE
        ),
        0,
        1
      ),

    maximumRisk:
      clamp(
        safeNumber(
          config.maximumRisk,
          DEFAULT_MAXIMUM_RISK
        ),
        0,
        1
      )
  };

  const collection =
    collectApprovedBets(
      safeMatches
    );

  const approvedBets =
    collection.bets;

  const eligibleBets =
    approvedBets.filter(
      bet =>
        passesOperationalLimits(
          bet,
          resolvedConfig
        )
    );

  /*
   * Ordenação oficial:
   *
   * 1. rankingScore;
   * 2. confiança;
   * 3. menor risco;
   * 4. EV somente como desempate.
   */
  const sortedBets =
    [...eligibleBets].sort(
      (
        first,
        second
      ) => {
        const rankingDifference =
          second.rankingScore -
          first.rankingScore;

        if (
          Math.abs(
            rankingDifference
          ) > 1e-9
        ) {
          return rankingDifference;
        }

        const confidenceDifference =
          second.confidence -
          first.confidence;

        if (
          Math.abs(
            confidenceDifference
          ) > 1e-9
        ) {
          return confidenceDifference;
        }

        const riskDifference =
          first.risk -
          second.risk;

        if (
          Math.abs(
            riskDifference
          ) > 1e-9
        ) {
          return riskDifference;
        }

        return (
          second.ev -
          first.ev
        );
      }
    );

  const picks =
    selectWithExposureLimits(
      sortedBets,
      resolvedConfig.maxPicks,
      resolvedConfig
        .maxPicksPerMatch
    );

  const selectedKeys =
    new Set(
      picks.map(
        bet =>
          `${bet.match}::${bet.market}`
      )
    );

  const exposureRejected =
    sortedBets.filter(
      bet =>
        !selectedKeys.has(
          `${bet.match}::${bet.market}`
        )
    );

  const totalStake =
    picks.reduce(
      (
        accumulated,
        bet
      ) =>
        accumulated +
        bet.stake,
      0
    );

  return {
    picks,

    totalStake,

    totalBets:
      picks.length,

    operationalValid:
      picks.length > 0,

    diagnostics: {
      version:
        "V7.2_ELITE",

      receivedMatches:
        safeMatches.length,

      approvedCandidates:
        approvedBets.length,

      eligibleCandidates:
        eligibleBets.length,

      selectedPicks:
        picks.length,

      rejectedBeforeApproval:
        collection.rejections.length,

      rejectedByOperationalLimits:
        approvedBets.length -
        eligibleBets.length,

      rejectedByExposureLimits:
        exposureRejected.length,

      rejections:
        collection.rejections,

      exposureRejected:
        exposureRejected.map(
          bet => ({
            match:
              bet.match,

            market:
              bet.market,

            reason:
              "EXPOSURE_LIMIT"
          })
        ),

      config:
        resolvedConfig
    }
  };
}