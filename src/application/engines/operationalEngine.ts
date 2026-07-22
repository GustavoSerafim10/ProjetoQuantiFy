/* ==========================================
   OPERATIONAL ENGINE — QUANTIFY V7
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

  stake: number;

  tier: string;

  [key: string]: unknown;
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
): number {
  return safeNumber(
    bet?.rankingScore ??
    bet?.score ??
    bet?.edgeScore,
    0
  );
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
      bet?.tier ??
      bet?.status ??
      bet?.classification ??
      "APPROVED"
    )
      .trim()
      .toUpperCase();

  return tier ||
    "APPROVED";
}

/* ==========================================
   VALIDAÇÃO DE ENTRADA
========================================== */

function isApprovedBet(
  bet: any
): boolean {
  if (!bet) {
    return false;
  }

  /*
   * Uma entrada só é operacional quando a etapa
   * de decisão já a aprovou explicitamente.
   */
  const decisionValid =
    normalizeBoolean(
      bet.decisionValid
    );

  const actionable =
    normalizeBoolean(
      bet.actionable ??
      bet.approved
    );

  return (
    decisionValid &&
    actionable
  );
}

/* ==========================================
   NORMALIZAÇÃO
========================================== */

function normalizeBet(
  matchData: any,
  bet: any
): OperationalBet | null {
  if (!isApprovedBet(bet)) {
    return null;
  }

  const market =
    String(
      bet?.market ??
      ""
    )
      .trim()
      .toUpperCase();

  if (!market) {
    return null;
  }

  const probability =
    parseFiniteNumber(
      bet?.probability
    );

  const odd =
    parseFiniteNumber(
      bet?.odd
    );

  const ev =
    parseFiniteNumber(
      bet?.ev
    );

  if (
    probability === null ||
    probability < 0 ||
    probability > 1 ||
    odd === null ||
    odd <= 1 ||
    ev === null
  ) {
    return null;
  }

  return {
    ...bet,

    match:
      String(
        matchData?.match ??
        bet?.match ??
        "UNKNOWN_MATCH"
      ),

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
      resolveRankingScore(
        bet
      ),

    decisionValid:
      true,

    actionable:
      true,

    stake:
      resolveStake(
        bet
      ),

    tier:
      resolveTier(
        bet
      )
  };
}

/* ==========================================
   EXTRAÇÃO
========================================== */

function collectApprovedBets(
  matches: any[]
): OperationalBet[] {
  const bets:
    OperationalBet[] = [];

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

      if (normalized) {
        bets.push(
          normalized
        );
      }
    }
  }

  /*
   * Remove duplicações provocadas por um mercado
   * aparecer simultaneamente em best e
   * actionableMarkets.
   */
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

  return [
    ...unique.values()
  ];
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

  const approvedBets =
    collectApprovedBets(
      safeMatches
    );

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
      receivedMatches:
        safeMatches.length,

      approvedCandidates:
        approvedBets.length,

      eligibleCandidates:
        eligibleBets.length,

      selectedPicks:
        picks.length,

      rejectedByOperationalLimits:
        approvedBets.length -
        eligibleBets.length,

      config:
        resolvedConfig
    }
  };
}