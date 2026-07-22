import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";

/* ==========================================
   INPUT PANEL — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os dados manuais da partida;
 * - incorporar dados do ComparisonPanel;
 * - manter os campos editáveis;
 * - converter números apenas no envio;
 * - montar o payload oficial da análise;
 * - validar coerência básica dos dados;
 * - registrar a origem dos valores;
 * - não executar cálculos quantitativos.
 *
 * Este arquivo não:
 *
 * - calcula lambdas;
 * - calcula probabilidades;
 * - calcula EV;
 * - calcula risco;
 * - classifica entradas;
 * - toma decisões operacionais.
 */

/* ==========================================
   FORMULÁRIO
========================================== */

type FormField =
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

  | "oddBTTSYes"
  | "oddBTTSNo"

  | "odd1X"
  | "oddX2";

type FormState =
  Partial<Record<FormField, string>>;

/* ==========================================
   DADOS EXTERNOS
========================================== */

/*
 * O ComparisonPanel pode enviar números,
 * strings numéricas ou valores ausentes.
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

  bttsYes?: number;
  bttsNo?: number;

  homeOrDraw?: number;
  awayOrDraw?: number;
}

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

interface InputPanelProps {
  onAnalyze: (
    data: AnalysisPayload
  ) => void | Promise<void>;

  externalData?:
    ExternalInputData | null;
}

interface RowProps {
  label: string;

  home:
    FormField;

  away:
    FormField;

  form:
    FormState;

  handleChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;

  integer?: boolean;
  percentage?: boolean;
}

interface CardProps {
  title: string;
  children: ReactNode;
}

/* ==========================================
   CAMPOS ESTATÍSTICOS CONTROLADOS
========================================== */

/*
 * Estes campos devem ser limpos quando uma nova
 * comparação completa substituir a anterior.
 *
 * Não limpamos:
 *
 * - nomes dos times;
 * - liga;
 * - odds.
 *
 * Eles podem vir de outras fontes ou serem
 * preenchidos manualmente.
 */

const HOME_STAT_FIELDS: FormField[] = [
  "homeRating",
  "homeMatches",
  "homeGoals",
  "homeConceded",
  "homeAssists",
  "homeGoalsPG",
  "homeShotsOnTarget",
  "homeBigChances",
  "homeBigChancesMissed",
  "homePossession",
  "homePasses",
  "homeLongBalls",
  "homeCleanSheets",
  "homeConcededPG",
  "homeInterceptions",
  "homeTackles",
  "homeClearances",
  "homeSaves",
  "homeFouls",
  "homeOffsides",
  "homeThrowIns",
  "homeYellow",
  "homeRed"
];

const AWAY_STAT_FIELDS: FormField[] = [
  "awayRating",
  "awayMatches",
  "awayGoals",
  "awayConceded",
  "awayAssists",
  "awayGoalsPG",
  "awayShotsOnTarget",
  "awayBigChances",
  "awayBigChancesMissed",
  "awayPossession",
  "awayPasses",
  "awayLongBalls",
  "awayCleanSheets",
  "awayConcededPG",
  "awayInterceptions",
  "awayTackles",
  "awayClearances",
  "awaySaves",
  "awayFouls",
  "awayOffsides",
  "awayThrowIns",
  "awayYellow",
  "awayRed"
];

const REQUIRED_EXTERNAL_STAT_FIELDS: FormField[] = [
  "homeMatches",
  "awayMatches",

  "homeGoals",
  "awayGoals",

  "homeConceded",
  "awayConceded",

  "homeGoalsPG",
  "awayGoalsPG",

  "homeConcededPG",
  "awayConcededPG"
];

/* ==========================================
   LINHA COMPARATIVA
========================================== */

function Row({
  label,
  home,
  away,
  form,
  handleChange,
  integer = false,
  percentage = false
}: RowProps) {
  const homeValue =
    parseOptionalNumber(
      form[home]
    );

  const awayValue =
    parseOptionalNumber(
      form[away]
    );

  const bothValuesExist =
    homeValue !== null &&
    awayValue !== null;

  const homeBetter =
    bothValuesExist &&
    homeValue >
      awayValue;

  const awayBetter =
    bothValuesExist &&
    awayValue >
      homeValue;

  const difference =
    bothValuesExist &&
    awayValue !== 0
      ? (
          (
            homeValue -
            awayValue
          ) /
          Math.abs(
            awayValue
          )
        ) * 100
      : 0;

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 px-3 rounded-xl hover:bg-white/5">

      <input
        type="number"
        inputMode={
          integer
            ? "numeric"
            : "decimal"
        }
        step={
          integer
            ? "1"
            : "any"
        }
        min="0"
        max={
          percentage
            ? "100"
            : undefined
        }
        name={home}
        value={
          form[home] ??
          ""
        }
        onChange={
          handleChange
        }
        aria-label={`${label} do mandante`}
        className={
          `inputElite ${
            homeBetter
              ? "border-green-500"
              : ""
          }`
        }
      />

      <div className="text-center">
        <div className="text-xs text-zinc-400">
          {label}
        </div>

        {bothValuesExist &&
          Math.abs(
            difference
          ) > 0.01 && (
            <div
              className={
                `text-[11px] mt-1 font-semibold ${
                  difference > 0
                    ? "text-green-400"
                    : "text-red-400"
                }`
              }
            >
              {difference > 0
                ? "↑"
                : "↓"}{" "}

              {Math.abs(
                difference
              ).toFixed(0)}
              %
            </div>
          )}
      </div>

      <input
        type="number"
        inputMode={
          integer
            ? "numeric"
            : "decimal"
        }
        step={
          integer
            ? "1"
            : "any"
        }
        min="0"
        max={
          percentage
            ? "100"
            : undefined
        }
        name={away}
        value={
          form[away] ??
          ""
        }
        onChange={
          handleChange
        }
        aria-label={`${label} do visitante`}
        className={
          `inputElite ${
            awayBetter
              ? "border-green-500"
              : ""
          }`
        }
      />

    </div>
  );
}

/* ==========================================
   COMPONENTE PRINCIPAL
========================================== */

export default function InputPanel({
  onAnalyze,
  externalData
}: InputPanelProps) {
  const [
    form,
    setForm
  ] = useState<FormState>({});

  const [
    validationError,
    setValidationError
  ] = useState<
    string | null
  >(null);

  const [
    inputWarnings,
    setInputWarnings
  ] = useState<string[]>([]);

  const [
    isSubmitting,
    setIsSubmitting
  ] = useState(false);

  /*
   * Armazena uma assinatura dos dados externos
   * anteriores para evitar reaplicar o mesmo
   * objeto sem necessidade.
   */
  const previousExternalSignature =
    useRef<string | null>(
      null
    );

  /*
   * Informa se a última carga externa foi
   * parcial.
   */
  const externalDataStatus =
    useMemo(
      () =>
        inspectExternalData(
          externalData
        ),
      [
        externalData
      ]
    );

  /* ==========================================
     DADOS EXTERNOS
  ========================================== */

  useEffect(
    () => {
      if (!externalData) {
        return;
      }

      const externalSignature =
        createExternalSignature(
          externalData
        );

      if (
        previousExternalSignature.current ===
        externalSignature
      ) {
        return;
      }

      previousExternalSignature.current =
        externalSignature;

      console.group(
        "📥 INPUT PANEL — EXTERNAL DATA"
      );

      console.log(
        "RAW EXTERNAL DATA:",
        externalData
      );

      console.log(
        "EXTERNAL DATA STATUS:",
        externalDataStatus
      );

      const convertedData =
        convertExternalDataToForm(
          externalData
        );

      console.log(
        "CONVERTED EXTERNAL DATA:",
        convertedData
      );

      setInputWarnings(
        externalDataStatus.warnings
      );

      setValidationError(
        null
      );

      setForm(
        previous => {
          /*
           * Limpa os campos estatísticos antigos
           * antes de aplicar uma nova comparação.
           *
           * Isso evita:
           *
           * partida anterior + dados parciais
           * da partida atual.
           */
          const cleanedPrevious =
            clearPreviousStatisticalFields(
              previous
            );

          const next: FormState = {
            ...cleanedPrevious,
            ...convertedData
          };

          console.log(
            "PREVIOUS FORM:",
            previous
          );

          console.log(
            "CLEANED PREVIOUS FORM:",
            cleanedPrevious
          );

          console.log(
            "FINAL FORM AFTER EXTERNAL DATA:",
            next
          );

          console.groupEnd();

          return next;
        }
      );
    },
    [
      externalData,
      externalDataStatus
    ]
  );

  /* ==========================================
     ALTERAÇÃO DOS CAMPOS
  ========================================== */

  function handleChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const {
      name,
      value
    } = event.target;

    if (
      !isFormField(
        name
      )
    ) {
      console.warn(
        "UNKNOWN_FORM_FIELD:",
        name
      );

      return;
    }

    setValidationError(
      null
    );

    setForm(
      previous => ({
        ...previous,

        [name]:
          value
      })
    );
  }

  /* ==========================================
     SUBMIT
  ========================================== */

  async function handleSubmit() {
    const homeTeam =
      String(
        form.homeTeam ??
        ""
      ).trim();

    const awayTeam =
      String(
        form.awayTeam ??
        ""
      ).trim();

    const league =
      String(
        form.league ??
        ""
      ).trim();

    if (
      !homeTeam ||
      !awayTeam
    ) {
      setValidationError(
        "Informe os nomes do time mandante e do visitante."
      );

      return;
    }

    const homeStats =
      buildTeamStats(
        form,
        "home"
      );

    const awayStats =
      buildTeamStats(
        form,
        "away"
      );

    const requiredFieldErrors =
      validateRequiredTeamFields({
        homeStats,
        awayStats,
        homeTeam,
        awayTeam
      });

    if (
      requiredFieldErrors.length > 0
    ) {
      setValidationError(
        requiredFieldErrors.join(
          " "
        )
      );

      return;
    }

    const consistencyErrors = [
      ...validateTeamConsistency(
        homeStats,
        homeTeam
      ),

      ...validateTeamConsistency(
        awayStats,
        awayTeam
      )
    ];

    if (
      consistencyErrors.length > 0
    ) {
      setValidationError(
        consistencyErrors.join(
          " "
        )
      );

      return;
    }

    const odds =
      buildOddsPayload(
        form
      );

    if (
      Object.keys(
        odds
      ).length === 0
    ) {
      setValidationError(
        "Informe pelo menos uma odd válida para realizar a análise."
      );

      return;
    }

    const diagnosticWarnings =
      normalizeWarnings([
        ...inputWarnings,

        ...createPayloadWarnings({
          homeStats,
          awayStats,
          externalDataStatus
        })
      ]);

    const data:
      AnalysisPayload = {
        match: {
          home:
            homeTeam,

          away:
            awayTeam,

          league
        },

        stats: {
          home:
            homeStats,

          away:
            awayStats
        },

        odds,

        inputDiagnostics: {
          source:
            "MANUAL_OR_COMPARISON_PANEL",

          externalDataReceived:
            Boolean(
              externalData
            ),

          externalDataPartial:
            externalDataStatus
              .partial,

          externalMissingFields:
            externalDataStatus
              .missingFields,

          warnings:
            diagnosticWarnings
        }
      };

    console.group(
      "🔥 INPUT PANEL — FINAL PAYLOAD"
    );

    console.log(
      "FORM STATE AT SUBMIT:",
      form
    );

    console.log(
      "HOME STATS PAYLOAD:",
      homeStats
    );

    console.log(
      "AWAY STATS PAYLOAD:",
      awayStats
    );

    console.log(
      "ODDS PAYLOAD:",
      odds
    );

    console.log(
      "ANALYSIS PAYLOAD:",
      data
    );

    console.groupEnd();

    setIsSubmitting(
      true
    );

    try {
      await Promise.resolve(
        onAnalyze(
          data
        )
      );
    } catch (error) {
      console.error(
        "Falha ao encaminhar a análise:",
        error
      );

      setValidationError(
        error instanceof Error
          ? error.message
          : "Não foi possível executar a análise."
      );
    } finally {
      setIsSubmitting(
        false
      );
    }
  }

  return (
    <div className="min-h-screen p-6 bg-[#0B0F1A] text-white">

      <div className="max-w-3xl mx-auto space-y-8">

        {/* HEADER */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            name="homeTeam"
            value={
              form.homeTeam ??
              ""
            }
            onChange={
              handleChange
            }
            placeholder="🏠 Casa"
            className="inputElite"
          />

          <input
            name="league"
            value={
              form.league ??
              ""
            }
            onChange={
              handleChange
            }
            placeholder="🏆 Liga"
            className="inputElite"
          />

          <input
            name="awayTeam"
            value={
              form.awayTeam ??
              ""
            }
            onChange={
              handleChange
            }
            placeholder="🚀 Fora"
            className="inputElite"
          />
        </div>

        {/* WARNINGS DOS DADOS EXTERNOS */}

        {inputWarnings.length > 0 && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            <div className="font-bold mb-2">
              ⚠️ Diagnóstico dos dados recebidos
            </div>

            <ul className="space-y-1">
              {inputWarnings.map(
                warning => (
                  <li key={warning}>
                    • {formatWarning(
                      warning
                    )}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {/* GERAL */}

        <Card title="📊 Geral">
          <Row
            label="Nota"
            home="homeRating"
            away="awayRating"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Partidas"
            home="homeMatches"
            away="awayMatches"
            form={form}
            handleChange={handleChange}
            integer
          />

          <Row
            label="Gols"
            home="homeGoals"
            away="awayGoals"
            form={form}
            handleChange={handleChange}
            integer
          />

          <Row
            label="Sofridos"
            home="homeConceded"
            away="awayConceded"
            form={form}
            handleChange={handleChange}
            integer
          />

          <Row
            label="Assistências"
            home="homeAssists"
            away="awayAssists"
            form={form}
            handleChange={handleChange}
          />
        </Card>

        {/* ATAQUE */}

        <Card title="⚔️ Ataque">
          <Row
            label="Gols/jogo"
            home="homeGoalsPG"
            away="awayGoalsPG"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Chutes no gol"
            home="homeShotsOnTarget"
            away="awayShotsOnTarget"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Grandes chances"
            home="homeBigChances"
            away="awayBigChances"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Perdidas"
            home="homeBigChancesMissed"
            away="awayBigChancesMissed"
            form={form}
            handleChange={handleChange}
          />
        </Card>

        {/* PASSE */}

        <Card title="🎯 Passe">
          <Row
            label="Posse %"
            home="homePossession"
            away="awayPossession"
            form={form}
            handleChange={handleChange}
            percentage
          />

          <Row
            label="Passes"
            home="homePasses"
            away="awayPasses"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Bolas longas"
            home="homeLongBalls"
            away="awayLongBalls"
            form={form}
            handleChange={handleChange}
          />
        </Card>

        {/* DEFESA */}

        <Card title="🛡 Defesa">
          <Row
            label="Clean Sheets"
            home="homeCleanSheets"
            away="awayCleanSheets"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Gols sofridos/jogo"
            home="homeConcededPG"
            away="awayConcededPG"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Interceptações"
            home="homeInterceptions"
            away="awayInterceptions"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Desarmes"
            home="homeTackles"
            away="awayTackles"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Cortes"
            home="homeClearances"
            away="awayClearances"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Defesas"
            home="homeSaves"
            away="awaySaves"
            form={form}
            handleChange={handleChange}
          />
        </Card>

        {/* OUTROS */}

        <Card title="📦 Outros">
          <Row
            label="Faltas"
            home="homeFouls"
            away="awayFouls"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Impedimentos"
            home="homeOffsides"
            away="awayOffsides"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Laterais"
            home="homeThrowIns"
            away="awayThrowIns"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Amarelos"
            home="homeYellow"
            away="awayYellow"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Vermelhos"
            home="homeRed"
            away="awayRed"
            form={form}
            handleChange={handleChange}
          />
        </Card>

        {/* ODDS */}

        <Card title="💰 Odds">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OddInput
              name="oddHome"
              placeholder="Casa"
              form={form}
              onChange={handleChange}
            />

            <OddInput
              name="oddDraw"
              placeholder="Empate"
              form={form}
              onChange={handleChange}
            />

            <OddInput
              name="oddAway"
              placeholder="Fora"
              form={form}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <OddInput
              name="oddOver15"
              placeholder="Over 1.5"
              form={form}
              onChange={handleChange}
            />

            <OddInput
              name="oddOver25"
              placeholder="Over 2.5"
              form={form}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <OddInput
              name="oddBTTSYes"
              placeholder="BTTS Sim"
              form={form}
              onChange={handleChange}
            />

            <OddInput
              name="oddBTTSNo"
              placeholder="BTTS Não"
              form={form}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <OddInput
              name="odd1X"
              placeholder="1X (Casa/Empate)"
              form={form}
              onChange={handleChange}
            />

            <OddInput
              name="oddX2"
              placeholder="X2 (Fora/Empate)"
              form={form}
              onChange={handleChange}
            />
          </div>

        </Card>

        {/* ERRO */}

        {validationError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            ⚠️ {validationError}
          </div>
        )}

        {/* SUBMIT */}

        <button
          type="button"
          onClick={
            handleSubmit
          }
          disabled={
            isSubmitting
          }
          className={
            `w-full py-4 rounded-xl font-bold text-white
             bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
             transition shadow-lg ${
               isSubmitting
                 ? "opacity-60 cursor-wait"
                 : "hover:scale-[1.02]"
             }`
          }
        >
          {isSubmitting
            ? "⏳ ANALISANDO..."
            : "🚀 ANALISAR JOGO"}
        </button>

      </div>
    </div>
  );
}

/* ==========================================
   ODD INPUT
========================================== */

function OddInput({
  name,
  placeholder,
  form,
  onChange
}: {
  name: FormField;
  placeholder: string;
  form: FormState;

  onChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="1.01"
      name={name}
      value={
        form[name] ??
        ""
      }
      placeholder={
        placeholder
      }
      onChange={
        onChange
      }
      className="inputElite"
    />
  );
}

/* ==========================================
   CARD
========================================== */

function Card({
  title,
  children
}: CardProps) {
  return (
    <section className="bg-gradient-to-br from-[#121826] to-[#0f172a] p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur">
      <h2 className="text-sm text-zinc-400 mb-4 text-center font-semibold tracking-wide relative">
        <span className="px-3 bg-[#121826] relative z-10">
          {title}
        </span>

        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-700 -z-0" />
      </h2>

      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

/* ==========================================
   TEAM STATS PAYLOAD
========================================== */

function buildTeamStats(
  form: FormState,
  side:
    | "home"
    | "away"
): TeamStatsPayload {
  const prefix =
    side === "home"
      ? "home"
      : "away";

  const matches =
    readNumber(
      form,
      `${prefix}Matches`
    );

  const goalsFor =
    readNumber(
      form,
      `${prefix}Goals`
    );

  const goalsAgainst =
    readNumber(
      form,
      `${prefix}Conceded`
    );

  const goalsPerGame =
    readNumber(
      form,
      `${prefix}GoalsPG`
    );

  const goalsConcededPerGame =
    readNumber(
      form,
      `${prefix}ConcededPG`
    );

  const shotsOnTargetPerGame =
    readNumber(
      form,
      `${prefix}ShotsOnTarget`
    );

  return removeInvalidTeamStats({
    rating:
      readNumber(
        form,
        `${prefix}Rating`
      ),

    matches,

    matchesPlayed:
      matches,

    goalsFor,

    goalsAgainst,

    /*
     * Contrato canônico e aliases.
     */
    avgGoals:
      goalsPerGame,

    goalsPerGame,

    goalsForPerGame:
      goalsPerGame,

    avgGoalsAgainst:
      goalsConcededPerGame,

    goalsConcededPerGame,

    goalsAgainstPerGame:
      goalsConcededPerGame,

    assists:
      readNumber(
        form,
        `${prefix}Assists`
      ),

    /*
     * Chutes no alvo:
     *
     * O InputPanel envia todos os aliases
     * temporariamente para impedir perda de
     * dados em módulos antigos.
     */
    avgShotsOnTarget:
      shotsOnTargetPerGame,

    shotsOnTarget:
      shotsOnTargetPerGame,

    shotsOnTargetPerGame,

    bigChances:
      readNumber(
        form,
        `${prefix}BigChances`
      ),

    bigChancesMissed:
      readNumber(
        form,
        `${prefix}BigChancesMissed`
      ),

    possession:
      readNumber(
        form,
        `${prefix}Possession`
      ),

    passes:
      readNumber(
        form,
        `${prefix}Passes`
      ),

    longBalls:
      readNumber(
        form,
        `${prefix}LongBalls`
      ),

    cleanSheets:
      readNumber(
        form,
        `${prefix}CleanSheets`
      ),

    interceptions:
      readNumber(
        form,
        `${prefix}Interceptions`
      ),

    tackles:
      readNumber(
        form,
        `${prefix}Tackles`
      ),

    clearances:
      readNumber(
        form,
        `${prefix}Clearances`
      ),

    saves:
      readNumber(
        form,
        `${prefix}Saves`
      ),

    fouls:
      readNumber(
        form,
        `${prefix}Fouls`
      ),

    offsides:
      readNumber(
        form,
        `${prefix}Offsides`
      ),

    throwIns:
      readNumber(
        form,
        `${prefix}ThrowIns`
      ),

    yellowCards:
      readNumber(
        form,
        `${prefix}Yellow`
      ),

    redCards:
      readNumber(
        form,
        `${prefix}Red`
      )
  });
}

/* ==========================================
   VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS
========================================== */

function validateRequiredTeamFields({
  homeStats,
  awayStats,
  homeTeam,
  awayTeam
}: {
  homeStats:
    TeamStatsPayload;

  awayStats:
    TeamStatsPayload;

  homeTeam:
    string;

  awayTeam:
    string;
}): string[] {
  const errors:
    string[] = [];

  validateRequiredStatsForTeam(
    homeStats,
    homeTeam,
    errors
  );

  validateRequiredStatsForTeam(
    awayStats,
    awayTeam,
    errors
  );

  return errors;
}

function validateRequiredStatsForTeam(
  stats: TeamStatsPayload,
  teamName: string,
  errors: string[]
) {
  if (
    !isPositiveNumber(
      stats.matches
    )
  ) {
    errors.push(
      `${teamName}: informe a quantidade de partidas.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsFor
    )
  ) {
    errors.push(
      `${teamName}: informe os gols marcados.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsAgainst
    )
  ) {
    errors.push(
      `${teamName}: informe os gols sofridos.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsPerGame
    )
  ) {
    errors.push(
      `${teamName}: informe os gols por jogo.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsConcededPerGame
    )
  ) {
    errors.push(
      `${teamName}: informe os gols sofridos por jogo.`
    );
  }
}

/* ==========================================
   VALIDAÇÃO DE COERÊNCIA
========================================== */

function validateTeamConsistency(
  stats:
    TeamStatsPayload,

  teamName:
    string
): string[] {
  const errors:
    string[] = [];

  const matches =
    stats.matches;

  const goalsFor =
    stats.goalsFor;

  const goalsAgainst =
    stats.goalsAgainst;

  const goalsPerGame =
    stats.goalsPerGame;

  const goalsConcededPerGame =
    stats.goalsConcededPerGame;

  if (
    isPositiveNumber(
      matches
    ) &&
    isNonNegativeNumber(
      goalsFor
    ) &&
    isNonNegativeNumber(
      goalsPerGame
    )
  ) {
    const calculatedGoalsPerGame =
      goalsFor /
      matches;

    const difference =
      Math.abs(
        calculatedGoalsPerGame -
        goalsPerGame
      );

    /*
     * Tolerância de 0,20 permite arredondamentos
     * comuns como:
     *
     * 28 / 18 = 1,555...
     * SofaScore = 1,6
     */
    if (
      difference >
      0.2
    ) {
      errors.push(
        `${teamName}: gols por jogo inconsistentes. ` +
        `${goalsFor} gols em ${matches} jogos equivalem a ` +
        `${calculatedGoalsPerGame.toFixed(2)}, mas foi informado ` +
        `${goalsPerGame.toFixed(2)}.`
      );
    }
  }

  if (
    isPositiveNumber(
      matches
    ) &&
    isNonNegativeNumber(
      goalsAgainst
    ) &&
    isNonNegativeNumber(
      goalsConcededPerGame
    )
  ) {
    const calculatedConcededPerGame =
      goalsAgainst /
      matches;

    const difference =
      Math.abs(
        calculatedConcededPerGame -
        goalsConcededPerGame
      );

    if (
      difference >
      0.2
    ) {
      errors.push(
        `${teamName}: gols sofridos por jogo inconsistentes. ` +
        `${goalsAgainst} gols sofridos em ${matches} jogos equivalem a ` +
        `${calculatedConcededPerGame.toFixed(2)}, mas foi informado ` +
        `${goalsConcededPerGame.toFixed(2)}.`
      );
    }
  }

  return errors;
}

/* ==========================================
   WARNINGS DO PAYLOAD
========================================== */

function createPayloadWarnings({
  homeStats,
  awayStats,
  externalDataStatus
}: {
  homeStats:
    TeamStatsPayload;

  awayStats:
    TeamStatsPayload;

  externalDataStatus:
    ExternalDataInspection;
}): string[] {
  const warnings:
    string[] = [];

  if (
    externalDataStatus.partial
  ) {
    warnings.push(
      "EXTERNAL_DATA_PARTIAL"
    );
  }

  if (
    homeStats.shotsOnTargetPerGame ===
    undefined
  ) {
    warnings.push(
      "MISSING_HOME_SHOTS_ON_TARGET"
    );
  }

  if (
    awayStats.shotsOnTargetPerGame ===
    undefined
  ) {
    warnings.push(
      "MISSING_AWAY_SHOTS_ON_TARGET"
    );
  }

  if (
    homeStats.bigChances ===
    undefined
  ) {
    warnings.push(
      "MISSING_HOME_BIG_CHANCES"
    );
  }

  if (
    awayStats.bigChances ===
    undefined
  ) {
    warnings.push(
      "MISSING_AWAY_BIG_CHANCES"
    );
  }

  return warnings;
}

/* ==========================================
   ODDS PAYLOAD
========================================== */

function buildOddsPayload(
  form:
    FormState
): OddsPayload {
  return removeInvalidOdds({
    home:
      readNumber(
        form,
        "oddHome"
      ),

    draw:
      readNumber(
        form,
        "oddDraw"
      ),

    away:
      readNumber(
        form,
        "oddAway"
      ),

    over15:
      readNumber(
        form,
        "oddOver15"
      ),

    over25:
      readNumber(
        form,
        "oddOver25"
      ),

    bttsYes:
      readNumber(
        form,
        "oddBTTSYes"
      ),

    bttsNo:
      readNumber(
        form,
        "oddBTTSNo"
      ),

    homeOrDraw:
      readNumber(
        form,
        "odd1X"
      ),

    awayOrDraw:
      readNumber(
        form,
        "oddX2"
      )
  });
}

/* ==========================================
   INSPEÇÃO DOS DADOS EXTERNOS
========================================== */

interface ExternalDataInspection {
  received:
    boolean;

  partial:
    boolean;

  missingFields:
    FormField[];

  warnings:
    string[];
}

function inspectExternalData(
  externalData:
    ExternalInputData | null | undefined
): ExternalDataInspection {
  if (!externalData) {
    return {
      received:
        false,

      partial:
        false,

      missingFields:
        [],

      warnings:
        []
    };
  }

  const missingFields =
    REQUIRED_EXTERNAL_STAT_FIELDS
      .filter(
        field =>
          parseOptionalNumber(
            externalData[field]
          ) === null
      );

  const warnings:
    string[] = [];

  if (
    missingFields.length > 0
  ) {
    warnings.push(
      "EXTERNAL_DATA_PARTIAL"
    );

    for (
      const field of missingFields
    ) {
      warnings.push(
        `MISSING_EXTERNAL_FIELD_${field.toUpperCase()}`
      );
    }
  }

  return {
    received:
      true,

    partial:
      missingFields.length > 0,

    missingFields,

    warnings:
      normalizeWarnings(
        warnings
      )
  };
}

/* ==========================================
   CONVERSÃO DOS DADOS EXTERNOS
========================================== */

function convertExternalDataToForm(
  externalData:
    ExternalInputData
): FormState {
  const converted:
    FormState = {};

  for (
    const [
      rawKey,
      rawValue
    ] of Object.entries(
      externalData
    )
  ) {
    if (
      !isFormField(
        rawKey
      )
    ) {
      console.warn(
        "IGNORED_UNKNOWN_EXTERNAL_FIELD:",
        rawKey,
        rawValue
      );

      continue;
    }

    if (
      rawKey === "homeTeam" ||
      rawKey === "awayTeam" ||
      rawKey === "league"
    ) {
      const textValue =
        String(
          rawValue ??
          ""
        ).trim();

      if (textValue) {
        converted[rawKey] =
          textValue;
      }

      continue;
    }

    const parsed =
      parseOptionalNumber(
        rawValue
      );

    if (
      parsed !== null
    ) {
      converted[rawKey] =
        String(
          parsed
        );
    }
  }

  return converted;
}

/* ==========================================
   LIMPEZA DO ESTADO ANTERIOR
========================================== */

function clearPreviousStatisticalFields(
  previous:
    FormState
): FormState {
  const next:
    FormState = {
      ...previous
    };

  const fieldsToClear = [
    ...HOME_STAT_FIELDS,
    ...AWAY_STAT_FIELDS
  ];

  for (
    const field of fieldsToClear
  ) {
    delete next[field];
  }

  return next;
}

/* ==========================================
   ASSINATURA DOS DADOS EXTERNOS
========================================== */

function createExternalSignature(
  externalData:
    ExternalInputData
): string {
  const sortedEntries =
    Object.entries(
      externalData
    )
      .sort(
        (
          [keyA],
          [keyB]
        ) =>
          keyA.localeCompare(
            keyB
          )
      );

  return JSON.stringify(
    sortedEntries
  );
}

/* ==========================================
   PARSERS
========================================== */

function readNumber(
  form:
    FormState,

  key:
    FormField
): number | null {
  return parseOptionalNumber(
    form[key]
  );
}

function parseOptionalNumber(
  value:
    unknown
): number | null {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const normalized =
    String(
      value
    )
      .replace(
        ",",
        "."
      )
      .trim();

  if (
    normalized === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      normalized
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/* ==========================================
   LIMPEZA DOS OBJETOS
========================================== */

function removeInvalidTeamStats(
  input:
    Record<
      keyof TeamStatsPayload,
      number | null
    >
): TeamStatsPayload {
  const output:
    TeamStatsPayload = {};

  for (
    const [
      rawKey,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value === null ||
      !Number.isFinite(
        value
      ) ||
      value < 0
    ) {
      continue;
    }

    const key =
      rawKey as
        keyof TeamStatsPayload;

    output[key] =
      value;
  }

  return output;
}

function removeInvalidOdds(
  input:
    Record<
      keyof OddsPayload,
      number | null
    >
): OddsPayload {
  const output:
    OddsPayload = {};

  for (
    const [
      rawKey,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value === null ||
      !Number.isFinite(
        value
      ) ||
      value <= 1
    ) {
      continue;
    }

    const key =
      rawKey as
        keyof OddsPayload;

    output[key] =
      value;
  }

  return output;
}

/* ==========================================
   VALIDAÇÃO NUMÉRICA
========================================== */

function isPositiveNumber(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    ) &&
    value > 0
  );
}

function isNonNegativeNumber(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    ) &&
    value >= 0
  );
}

/* ==========================================
   FIELD GUARD
========================================== */

const FORM_FIELDS =
  new Set<FormField>([
    "homeTeam",
    "awayTeam",
    "league",

    "homeRating",
    "awayRating",

    "homeMatches",
    "awayMatches",

    "homeGoals",
    "awayGoals",

    "homeConceded",
    "awayConceded",

    "homeAssists",
    "awayAssists",

    "homeGoalsPG",
    "awayGoalsPG",

    "homeShotsOnTarget",
    "awayShotsOnTarget",

    "homeBigChances",
    "awayBigChances",

    "homeBigChancesMissed",
    "awayBigChancesMissed",

    "homePossession",
    "awayPossession",

    "homePasses",
    "awayPasses",

    "homeLongBalls",
    "awayLongBalls",

    "homeCleanSheets",
    "awayCleanSheets",

    "homeConcededPG",
    "awayConcededPG",

    "homeInterceptions",
    "awayInterceptions",

    "homeTackles",
    "awayTackles",

    "homeClearances",
    "awayClearances",

    "homeSaves",
    "awaySaves",

    "homeFouls",
    "awayFouls",

    "homeOffsides",
    "awayOffsides",

    "homeThrowIns",
    "awayThrowIns",

    "homeYellow",
    "awayYellow",

    "homeRed",
    "awayRed",

    "oddHome",
    "oddDraw",
    "oddAway",

    "oddOver15",
    "oddOver25",

    "oddBTTSYes",
    "oddBTTSNo",

    "odd1X",
    "oddX2"
  ]);

function isFormField(
  value:
    string
): value is FormField {
  return FORM_FIELDS.has(
    value as FormField
  );
}

/* ==========================================
   WARNINGS
========================================== */

function normalizeWarnings(
  warnings:
    string[]
): string[] {
  return [
    ...new Set(
      warnings
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

function formatWarning(
  warning:
    string
): string {
  return warning
    .replace(
      /_/g,
      " "
    )
    .toLowerCase()
    .replace(
      /^./,
      character =>
        character.toUpperCase()
    );
}