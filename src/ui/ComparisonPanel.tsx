import {
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";

/* ==========================================
   COMPARISON PANEL — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber estatísticas comparativas;
 * - permitir preenchimento manual;
 * - destacar visualmente diferenças;
 * - validar consistência dos dados;
 * - converter números somente no envio;
 * - encaminhar apenas valores realmente
 *   preenchidos ao InputPanel;
 * - impedir contaminação por estado antigo.
 *
 * Este componente não:
 *
 * - calcula probabilidades;
 * - calcula lambdas;
 * - calcula EV;
 * - normaliza estatísticas do modelo;
 * - aplica regras de mercado;
 * - toma decisões operacionais.
 */

/* ==========================================
   CONTRATO DOS CAMPOS
========================================== */

export type ComparisonField =
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
  | "awayRed";

type ComparisonForm =
  Partial<
    Record<
      ComparisonField,
      string
    >
  >;

export type ComparisonPayload =
  Partial<
    Record<
      ComparisonField,
      number
    >
  >;

/* ==========================================
   PROPS
========================================== */

interface ComparisonPanelProps {
  onLoadData: (
    data: ComparisonPayload
  ) => void;
}

interface ComparisonRowProps {
  label: string;

  home:
    ComparisonField;

  away:
    ComparisonField;

  form:
    ComparisonForm;

  onChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;

  integer?: boolean;
  percentage?: boolean;
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

/* ==========================================
   DIAGNÓSTICO
========================================== */

interface ComparisonDiagnostics {
  complete: boolean;
  partial: boolean;

  missingRequiredFields:
    ComparisonField[];

  warnings:
    string[];

  errors:
    string[];
}

/* ==========================================
   CONSTANTES
========================================== */

const INPUT_CLASS =
  "inputElite";

const REQUIRED_FIELDS:
  ComparisonField[] = [
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

const ALL_FIELDS:
  ComparisonField[] = [
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
    "awayRed"
  ];

/* ==========================================
   COMPONENTE PRINCIPAL
========================================== */

export default function ComparisonPanel({
  onLoadData
}: ComparisonPanelProps) {
  /*
   * Strings são preservadas durante a digitação
   * para permitir:
   *
   * - campo vazio;
   * - casas decimais;
   * - apagar valor;
   * - digitar "1.";
   * - utilizar vírgula decimal.
   */
  const [
    form,
    setForm
  ] = useState<ComparisonForm>(
    {}
  );

  const [
    validationError,
    setValidationError
  ] = useState<
    string | null
  >(null);

  const [
    successMessage,
    setSuccessMessage
  ] = useState<
    string | null
  >(null);

  const diagnostics =
    useMemo(
      () =>
        inspectComparisonForm(
          form
        ),
      [
        form
      ]
    );

  /* ========================================
     ALTERAÇÃO DOS CAMPOS
  ======================================== */

  function handleChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const {
      name,
      value
    } = event.target;

    if (
      !isComparisonField(
        name
      )
    ) {
      console.warn(
        "UNKNOWN_COMPARISON_FIELD:",
        name
      );

      return;
    }

    setValidationError(
      null
    );

    setSuccessMessage(
      null
    );

    const sanitizedValue =
      sanitizeNumericInput(
        value
      );

    setForm(
      previous => ({
        ...previous,

        [name]:
          sanitizedValue
      })
    );
  }

  /* ========================================
     ENVIO
  ======================================== */

  function handleLoad() {
    setValidationError(
      null
    );

    setSuccessMessage(
      null
    );

    const currentDiagnostics =
      inspectComparisonForm(
        form
      );

    console.group(
      "📊 COMPARISON PANEL — LOAD DATA"
    );

    console.log(
      "FORM STATE:",
      form
    );

    console.log(
      "DIAGNOSTICS:",
      currentDiagnostics
    );

    if (
      currentDiagnostics
        .errors
        .length > 0
    ) {
      console.error(
        "COMPARISON VALIDATION ERRORS:",
        currentDiagnostics.errors
      );

      console.groupEnd();

      setValidationError(
        currentDiagnostics
          .errors
          .join(" ")
      );

      return;
    }

    if (
      currentDiagnostics
        .missingRequiredFields
        .length > 0
    ) {
      console.warn(
        "MISSING REQUIRED FIELDS:",
        currentDiagnostics
          .missingRequiredFields
      );

      console.groupEnd();

      setValidationError(
        "Preencha os campos essenciais de partidas, gols, gols sofridos e respectivas médias dos dois times."
      );

      return;
    }

    const payload =
      convertFormToPayload(
        form
      );

    /*
     * Proteção final:
     *
     * Não envia payload vazio e não envia
     * campos ausentes como zero.
     */
    if (
      Object.keys(
        payload
      ).length === 0
    ) {
      console.warn(
        "EMPTY_COMPARISON_PAYLOAD"
      );

      console.groupEnd();

      setValidationError(
        "Nenhuma estatística válida foi informada."
      );

      return;
    }

    console.log(
      "FINAL COMPARISON PAYLOAD:",
      payload
    );

    console.log(
      "AWAY GOALS TRACE:",
      {
        raw:
          form.awayGoals,

        parsed:
          parseOptionalNumber(
            form.awayGoals
          ),

        payload:
          payload.awayGoals
      }
    );

    console.log(
      "HOME GOALS TRACE:",
      {
        raw:
          form.homeGoals,

        parsed:
          parseOptionalNumber(
            form.homeGoals
          ),

        payload:
          payload.homeGoals
      }
    );

    console.groupEnd();

    onLoadData(
      payload
    );

    setSuccessMessage(
      "Dados enviados para o painel de análise."
    );
  }

  /* ========================================
     LIMPEZA
  ======================================== */

  function handleClear() {
    console.group(
      "🧹 COMPARISON PANEL — CLEAR"
    );

    console.log(
      "FORM BEFORE CLEAR:",
      form
    );

    console.log(
      "ALL COMPARISON FIELDS CLEARED:",
      ALL_FIELDS
    );

    console.groupEnd();

    setForm(
      {}
    );

    setValidationError(
      null
    );

    setSuccessMessage(
      null
    );
  }

  return (
    <div className="p-6 bg-black text-white rounded-2xl space-y-6">

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">
          📊 Comparação estilo SofaScore
        </h2>

        <p className="text-xs text-zinc-500">
          Preencha os dados dos dois times antes de enviar para a análise.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-[11px] uppercase tracking-wide text-zinc-500 px-1">
        <span className="text-left">
          Mandante
        </span>

        <span className="text-center">
          Estatística
        </span>

        <span className="text-right">
          Visitante
        </span>
      </div>

      {/* GERAL */}

      <Section title="📊 Geral">
        <ComparisonRow
          label="Nota"
          home="homeRating"
          away="awayRating"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Partidas"
          home="homeMatches"
          away="awayMatches"
          form={form}
          onChange={handleChange}
          integer
        />

        <ComparisonRow
          label="Gols"
          home="homeGoals"
          away="awayGoals"
          form={form}
          onChange={handleChange}
          integer
        />

        <ComparisonRow
          label="Sofridos"
          home="homeConceded"
          away="awayConceded"
          form={form}
          onChange={handleChange}
          integer
        />

        <ComparisonRow
          label="Assistências"
          home="homeAssists"
          away="awayAssists"
          form={form}
          onChange={handleChange}
        />
      </Section>

      {/* ATAQUE */}

      <Section title="⚔️ Ataque">
        <ComparisonRow
          label="Gols/jogo"
          home="homeGoalsPG"
          away="awayGoalsPG"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Chutes no gol"
          home="homeShotsOnTarget"
          away="awayShotsOnTarget"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Grandes chances"
          home="homeBigChances"
          away="awayBigChances"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Perdidas"
          home="homeBigChancesMissed"
          away="awayBigChancesMissed"
          form={form}
          onChange={handleChange}
        />
      </Section>

      {/* PASSE */}

      <Section title="🎯 Passe">
        <ComparisonRow
          label="Posse %"
          home="homePossession"
          away="awayPossession"
          form={form}
          onChange={handleChange}
          percentage
        />

        <ComparisonRow
          label="Passes"
          home="homePasses"
          away="awayPasses"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Bolas longas"
          home="homeLongBalls"
          away="awayLongBalls"
          form={form}
          onChange={handleChange}
        />
      </Section>

      {/* DEFESA */}

      <Section title="🛡 Defesa">
        <ComparisonRow
          label="Clean Sheets"
          home="homeCleanSheets"
          away="awayCleanSheets"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Sofridos/jogo"
          home="homeConcededPG"
          away="awayConcededPG"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Interceptações"
          home="homeInterceptions"
          away="awayInterceptions"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Desarmes"
          home="homeTackles"
          away="awayTackles"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Cortes"
          home="homeClearances"
          away="awayClearances"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Defesas"
          home="homeSaves"
          away="awaySaves"
          form={form}
          onChange={handleChange}
        />
      </Section>

      {/* OUTROS */}

      <Section title="📦 Outros">
        <ComparisonRow
          label="Faltas"
          home="homeFouls"
          away="awayFouls"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Impedimentos"
          home="homeOffsides"
          away="awayOffsides"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Laterais"
          home="homeThrowIns"
          away="awayThrowIns"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Amarelos"
          home="homeYellow"
          away="awayYellow"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Vermelhos"
          home="homeRed"
          away="awayRed"
          form={form}
          onChange={handleChange}
        />
      </Section>

      {/* DIAGNÓSTICO */}

      {diagnostics.partial &&
        diagnostics.warnings.length > 0 && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            <div className="font-bold mb-2">
              ⚠️ Dados incompletos
            </div>

            <ul className="space-y-1">
              {diagnostics.warnings.map(
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

      {validationError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          ⚠️ {validationError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          ✅ {successMessage}
        </div>
      )}

      {/* AÇÕES */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={
            handleClear
          }
          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl font-bold"
        >
          🧹 Limpar comparação
        </button>

        <button
          type="button"
          onClick={
            handleLoad
          }
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold"
        >
          🚀 Usar no Input
        </button>
      </div>

    </div>
  );
}

/* ==========================================
   LINHA COMPARATIVA
========================================== */

function ComparisonRow({
  label,
  home,
  away,
  form,
  onChange,
  integer = false,
  percentage = false
}: ComparisonRowProps) {
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

  return (
    <div className="grid grid-cols-3 gap-4 items-center">

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
          onChange
        }
        aria-label={`${label} do mandante`}
        className={
          `${INPUT_CLASS} ${
            homeBetter
              ? "border-green-500"
              : ""
          }`
        }
      />

      <span className="text-xs text-zinc-400 text-center">
        {label}
      </span>

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
          onChange
        }
        aria-label={`${label} do visitante`}
        className={
          `${INPUT_CLASS} ${
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
   SECTION
========================================== */

function Section({
  title,
  children
}: SectionProps) {
  return (
    <section className="bg-zinc-900 p-4 rounded-xl space-y-2">
      <h3 className="text-sm text-zinc-400">
        {title}
      </h3>

      {children}
    </section>
  );
}

/* ==========================================
   INSPEÇÃO DO FORMULÁRIO
========================================== */

function inspectComparisonForm(
  form:
    ComparisonForm
): ComparisonDiagnostics {
  const missingRequiredFields =
    REQUIRED_FIELDS.filter(
      field =>
        parseOptionalNumber(
          form[field]
        ) === null
    );

  const warnings:
    string[] = [];

  const errors:
    string[] = [];

  if (
    missingRequiredFields.length > 0
  ) {
    warnings.push(
      "COMPARISON_DATA_PARTIAL"
    );

    for (
      const field of missingRequiredFields
    ) {
      warnings.push(
        `MISSING_${field.toUpperCase()}`
      );
    }
  }

  errors.push(
    ...validateTeamConsistency({
      side:
        "home",

      matches:
        parseOptionalNumber(
          form.homeMatches
        ),

      goalsFor:
        parseOptionalNumber(
          form.homeGoals
        ),

      goalsPerGame:
        parseOptionalNumber(
          form.homeGoalsPG
        ),

      goalsAgainst:
        parseOptionalNumber(
          form.homeConceded
        ),

      goalsConcededPerGame:
        parseOptionalNumber(
          form.homeConcededPG
        )
    })
  );

  errors.push(
    ...validateTeamConsistency({
      side:
        "away",

      matches:
        parseOptionalNumber(
          form.awayMatches
        ),

      goalsFor:
        parseOptionalNumber(
          form.awayGoals
        ),

      goalsPerGame:
        parseOptionalNumber(
          form.awayGoalsPG
        ),

      goalsAgainst:
        parseOptionalNumber(
          form.awayConceded
        ),

      goalsConcededPerGame:
        parseOptionalNumber(
          form.awayConcededPG
        )
    })
  );

  return {
    complete:
      missingRequiredFields.length === 0 &&
      errors.length === 0,

    partial:
      missingRequiredFields.length > 0,

    missingRequiredFields,

    warnings:
      normalizeWarnings(
        warnings
      ),

    errors:
      normalizeWarnings(
        errors
      )
  };
}

/* ==========================================
   VALIDAÇÃO DE COERÊNCIA
========================================== */

function validateTeamConsistency({
  side,
  matches,
  goalsFor,
  goalsPerGame,
  goalsAgainst,
  goalsConcededPerGame
}: {
  side:
    "home" | "away";

  matches:
    number | null;

  goalsFor:
    number | null;

  goalsPerGame:
    number | null;

  goalsAgainst:
    number | null;

  goalsConcededPerGame:
    number | null;
}): string[] {
  const errors:
    string[] = [];

  const teamLabel =
    side === "home"
      ? "Mandante"
      : "Visitante";

  if (
    matches !== null &&
    matches <= 0
  ) {
    errors.push(
      `${teamLabel}: a quantidade de partidas deve ser maior que zero.`
    );

    return errors;
  }

  if (
    matches !== null &&
    goalsFor !== null &&
    goalsPerGame !== null
  ) {
    const calculated =
      goalsFor /
      matches;

    const difference =
      Math.abs(
        calculated -
        goalsPerGame
      );

    /*
     * Aceita diferenças normais de arredondamento.
     *
     * Exemplo:
     *
     * 28 / 18 = 1,555...
     * valor exibido = 1,6
     */
    if (
      difference > 0.2
    ) {
      errors.push(
        `${teamLabel}: gols por jogo inconsistentes. ` +
        `${goalsFor} gols em ${matches} partidas equivalem a ` +
        `${calculated.toFixed(2)}, mas foi informado ` +
        `${goalsPerGame.toFixed(2)}.`
      );
    }
  }

  if (
    matches !== null &&
    goalsAgainst !== null &&
    goalsConcededPerGame !== null
  ) {
    const calculated =
      goalsAgainst /
      matches;

    const difference =
      Math.abs(
        calculated -
        goalsConcededPerGame
      );

    if (
      difference > 0.2
    ) {
      errors.push(
        `${teamLabel}: gols sofridos por jogo inconsistentes. ` +
        `${goalsAgainst} gols sofridos em ${matches} partidas equivalem a ` +
        `${calculated.toFixed(2)}, mas foi informado ` +
        `${goalsConcededPerGame.toFixed(2)}.`
      );
    }
  }

  return errors;
}

/* ==========================================
   CONVERSÃO DO FORMULÁRIO
========================================== */

function convertFormToPayload(
  form:
    ComparisonForm
): ComparisonPayload {
  const payload:
    ComparisonPayload = {};

  for (
    const field of ALL_FIELDS
  ) {
    const rawValue =
      form[field];

    const parsed =
      parseOptionalNumber(
        rawValue
      );

    /*
     * Campo vazio ou inválido não é enviado.
     *
     * Não fazemos:
     *
     * parsed ?? 0
     *
     * porque ausência de dado não significa
     * valor estatístico igual a zero.
     */
    if (
      parsed === null
    ) {
      continue;
    }

    payload[field] =
      parsed;
  }

  return payload;
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

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

/*
 * Aceita:
 *
 * - números;
 * - ponto;
 * - vírgula;
 * - estados intermediários como "1.".
 */
function sanitizeNumericInput(
  value:
    string
): string {
  const normalized =
    value
      .replace(
        ",",
        "."
      )
      .trim();

  if (
    normalized === ""
  ) {
    return "";
  }

  if (
    /^\d*\.?\d*$/.test(
      normalized
    )
  ) {
    return normalized;
  }

  return normalized
    .replace(
      /[^0-9.]/g,
      ""
    )
    .replace(
      /(\..*)\./g,
      "$1"
    );
}

/* ==========================================
   FIELD GUARD
========================================== */

const COMPARISON_FIELD_SET =
  new Set<ComparisonField>(
    ALL_FIELDS
  );

function isComparisonField(
  value:
    string
): value is ComparisonField {
  return COMPARISON_FIELD_SET.has(
    value as ComparisonField
  );
}

/* ==========================================
   WARNINGS
========================================== */

function normalizeWarnings(
  values:
    string[]
): string[] {
  return [
    ...new Set(
      values
        .map(
          value =>
            String(
              value ??
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