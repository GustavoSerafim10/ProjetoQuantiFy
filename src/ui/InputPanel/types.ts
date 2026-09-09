import type { MultiBookOddsPayload } from "../../domain/odds/multiBookOdds";

export type { MultiBookOddsPayload };

/* ==========================================
   FORMULÁRIO
========================================== */

export type FormField =
  | "homeTeam"
  | "awayTeam"
  | "league"

  | "homeRating"
  | "awayRating"

  | "homeMatches"
  | "awayMatches"

  | "homeGoals"
  | "awayGoals"

  | "homeConceded"
  | "awayConceded"

  | "homeAssists"
  | "awayAssists"

  | "homeGoalsPG"
  | "awayGoalsPG"

  | "homeShotsOnTarget"
  | "awayShotsOnTarget"

  | "homeShots"
  | "awayShots"

  | "homeCorners"
  | "awayCorners"

  | "homeBigChances"
  | "awayBigChances"

  | "homeBigChancesMissed"
  | "awayBigChancesMissed"

  | "homePossession"
  | "awayPossession"

  | "homePasses"
  | "awayPasses"

  | "homeLongBalls"
  | "awayLongBalls"

  | "homeCleanSheets"
  | "awayCleanSheets"

  | "homeConcededPG"
  | "awayConcededPG"

  | "homeInterceptions"
  | "awayInterceptions"

  | "homeTackles"
  | "awayTackles"

  | "homeClearances"
  | "awayClearances"

  | "homeSaves"
  | "awaySaves"

  | "homeFouls"
  | "awayFouls"

  | "homeOffsides"
  | "awayOffsides"

  | "homeThrowIns"
  | "awayThrowIns"

  | "homeYellow"
  | "awayYellow"

  | "homeRed"
  | "awayRed"

  | "oddHome"
  | "oddDraw"
  | "oddAway"

  | "oddOver15"
  | "oddOver25"

  | "oddUnder15"
  | "oddUnder25"

  | "oddBTTSYes"
  | "oddBTTSNo"

  | "odd1X"
  | "oddX2"

  | "oddDnbHome"
  | "oddDnbAway";

export type FormState =
  Partial<Record<FormField, string>>;

/* ==========================================
   DADOS EXTERNOS
========================================== */

/*
 * Quem produzir dados externos (nenhum componente está conectado
 * hoje — ver histórico do ComparisonPanel, removido em 2026-09-09
 * por estar desconectado da árvore) pode enviar números, strings
 * numéricas ou valores ausentes.
 *
 * Não restringimos tudo a number porque isso
 * esconderia problemas reais vindos da origem.
 */
export type ExternalInputData =
  Partial<
    Record<
      FormField,
      number | string | null | undefined
    >
  >;

/* ==========================================
   CONTRATO ESTATÍSTICO OFICIAL
========================================== */

export interface TeamStatsPayload {
  rating?: number;

  matches?: number;
  matchesPlayed?: number;

  goalsFor?: number;
  goalsAgainst?: number;

  /*
   * Contrato canônico e aliases temporários.
   */
  avgGoals?: number;
  goalsPerGame?: number;
  goalsForPerGame?: number;

  avgGoalsAgainst?: number;
  goalsConcededPerGame?: number;
  goalsAgainstPerGame?: number;

  assists?: number;

  avgShotsOnTarget?: number;
  shotsOnTarget?: number;
  shotsOnTargetPerGame?: number;

  avgShots?: number;
  shots?: number;
  shotsPerGame?: number;

  cornersAvg?: number;

  bigChances?: number;
  bigChancesMissed?: number;

  possession?: number;
  passes?: number;
  longBalls?: number;

  cleanSheets?: number;

  interceptions?: number;
  tackles?: number;
  clearances?: number;
  saves?: number;

  fouls?: number;
  offsides?: number;
  throwIns?: number;

  yellowCards?: number;
  redCards?: number;
}

export interface OddsPayload {
  home?: number;
  draw?: number;
  away?: number;

  over15?: number;
  over25?: number;

  under15?: number;
  under25?: number;

  bttsYes?: number;
  bttsNo?: number;

  homeOrDraw?: number;
  awayOrDraw?: number;

  dnbHome?: number;
  dnbAway?: number;
}

/*
 * Achado real em 2026-09-08: o usuário quer ver estatísticas dos
 * times E odds de mercado juntas, na mesma tela e na mesma análise
 * — não como dois modos separados. Desde 2026-09-09, `stats` também
 * entra de fato na conta quando `marketOdds` está preenchido: o
 * eliteAnalyzer funde o lambda de stats com o lambda de mercado
 * (mercado como base, stats como ajuste limitado — ver
 * fusedModelPipeline.ts/lambdaFusion.ts). `marketOdds` (odds de
 * várias casas) é quem alimenta o de-vig. `odds` é o preço de UMA
 * casa (a que será realmente usada para apostar) para o EV. Sem
 * `marketOdds`, cai para o motor antigo baseado só em `stats`; sem
 * stats de algum time, cai para o consenso de-vig puro (ver
 * eliteAnalyzer.ts).
 */
export interface AnalysisPayload {
  match: {
    home: string;
    away: string;
    league: string;
  };

  stats: {
    home: TeamStatsPayload;
    away: TeamStatsPayload;
  };

  marketOdds: MultiBookOddsPayload;

  odds: OddsPayload;

  inputDiagnostics: {
    source:
      "MANUAL_OR_COMPARISON_PANEL";

    externalDataReceived:
      boolean;

    externalDataPartial:
      boolean;

    externalMissingFields:
      FormField[];

    warnings:
      string[];
  };
}

/* ==========================================
   PROPS
========================================== */

export interface InputPanelProps {
  onAnalyze: (
    data: AnalysisPayload
  ) => void | Promise<void>;

  externalData?:
    ExternalInputData | null;
}

/* ==========================================
   INSPEÇÃO DOS DADOS EXTERNOS
========================================== */

export interface ExternalDataInspection {
  received:
    boolean;

  partial:
    boolean;

  missingFields:
    FormField[];

  warnings:
    string[];
}
