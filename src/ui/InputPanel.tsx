import {
  useEffect,
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
 * - manter campos editáveis;
 * - converter números apenas no envio;
 * - montar o payload oficial da análise;
 * - não executar cálculos quantitativos.
 */

/* ==========================================
   CONTRATOS
========================================== */

type FormState =
  Record<string, string>;

type ExternalInputData =
  Record<string, number>;

type NumericStats =
  Record<string, number>;

export interface AnalysisPayload {
  match: {
    home: string;
    away: string;
    league: string;
  };

  stats: {
    home: NumericStats;
    away: NumericStats;
  };

  odds: Record<string, number>;
}

interface InputPanelProps {
  onAnalyze: (
    data: AnalysisPayload
  ) => void | Promise<void>;

  externalData?:
    ExternalInputData | null;
}

interface RowProps {
  label: string;

  home: string;
  away: string;

  form: FormState;

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
    isSubmitting,
    setIsSubmitting
  ] = useState(false);

  /* ==========================================
     DADOS EXTERNOS
  ========================================== */

  useEffect(
    () => {
      if (!externalData) {
        return;
      }

      const convertedData:
        FormState = {};

      for (
        const [
          key,
          value
        ] of Object.entries(
          externalData
        )
      ) {
        convertedData[key] =
          Number.isFinite(
            Number(value)
          )
            ? String(value)
            : "";
      }

      setForm(
        previous => ({
          ...previous,
          ...convertedData
        })
      );
    },
    [
      externalData
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
            buildTeamStats(
              form,
              "home"
            ),

          away:
            buildTeamStats(
              form,
              "away"
            )
        },

        odds
      };

    console.log(
      "🔥 DATA FINAL:",
      data
    );

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
          />

          <Row
            label="Sofridos"
            home="homeConceded"
            away="awayConceded"
            form={form}
            handleChange={handleChange}
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
  name: string;
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
): NumericStats {
  const prefix =
    side === "home"
      ? "home"
      : "away";

  /*
   * Mantemos os aliases já utilizados pelo
   * projeto e incluímos os campos completos
   * preenchidos na interface.
   */
  return removeInvalidNumbers({
    rating:
      readNumber(
        form,
        `${prefix}Rating`
      ),

    matches:
      readNumber(
        form,
        `${prefix}Matches`
      ),

    goalsFor:
      readNumber(
        form,
        `${prefix}Goals`
      ),

    goalsAgainst:
      readNumber(
        form,
        `${prefix}Conceded`
      ),

    goalsPerGame:
      readNumber(
        form,
        `${prefix}GoalsPG`
      ),

    goalsConcededPerGame:
      readNumber(
        form,
        `${prefix}ConcededPG`
      ),

    assists:
      readNumber(
        form,
        `${prefix}Assists`
      ),

    shotsOnTarget:
      readNumber(
        form,
        `${prefix}ShotsOnTarget`
      ),

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
   ODDS PAYLOAD
========================================== */

function buildOddsPayload(
  form: FormState
): Record<string, number> {
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
   HELPERS
========================================== */

function readNumber(
  form: FormState,
  key: string
): number | null {
  return parseOptionalNumber(
    form[key]
  );
}

function parseOptionalNumber(
  value: unknown
): number | null {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed =
    Number(
      String(value)
        .replace(
          ",",
          "."
        )
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function removeInvalidNumbers(
  input:
    Record<
      string,
      number | null
    >
): NumericStats {
  const output:
    NumericStats = {};

  for (
    const [
      key,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value !== null &&
      Number.isFinite(
        value
      ) &&
      value >= 0
    ) {
      output[key] =
        value;
    }
  }

  return output;
}

function removeInvalidOdds(
  input:
    Record<
      string,
      number | null
    >
): Record<string, number> {
  const output:
    Record<string, number> = {};

  for (
    const [
      key,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value !== null &&
      Number.isFinite(
        value
      ) &&
      value > 1
    ) {
      output[key] =
        value;
    }
  }

  return output;
}