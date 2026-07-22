import {
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
 * - destacar visualmente o maior valor;
 * - converter os valores para número no envio;
 * - encaminhar o payload ao InputPanel.
 *
 * Este componente não:
 *
 * - calcula probabilidades;
 * - calcula lambdas;
 * - normaliza estatísticas;
 * - toma decisões;
 * - aplica regras de mercado.
 */

/* ==========================================
   CONTRATOS
========================================== */

type ComparisonForm = Record<
  string,
  string
>;

type ComparisonPayload = Record<
  string,
  number
>;

interface ComparisonPanelProps {
  onLoadData: (
    data: ComparisonPayload
  ) => void;
}

interface ComparisonRowProps {
  label: string;

  home:
    string;

  away:
    string;

  form:
    ComparisonForm;

  onChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

/* ==========================================
   CONSTANTES
========================================== */

const INPUT_CLASS =
  "inputElite";

/* ==========================================
   COMPONENTE PRINCIPAL
========================================== */

export default function ComparisonPanel({
  onLoadData
}: ComparisonPanelProps) {
  /*
   * Mantemos strings no estado para permitir:
   *
   * - campo vazio;
   * - digitação decimal;
   * - apagar o valor sem virar zero;
   *
   * A conversão para número acontece apenas
   * no momento do envio.
   */
  const [
    form,
    setForm
  ] = useState<ComparisonForm>({});

  function handleChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const {
      name,
      value
    } = event.target;

    setForm(
      previous => ({
        ...previous,

        [name]:
          sanitizeNumericInput(
            value
          )
      })
    );
  }

  function handleLoad() {
    const payload =
      convertFormToPayload(
        form
      );

    onLoadData(
      payload
    );
  }

  return (
    <div className="p-6 bg-black text-white rounded-2xl space-y-6">

      <h2 className="text-lg font-bold">
        📊 Comparação estilo SofaScore
      </h2>

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
        />

        <ComparisonRow
          label="Gols"
          home="homeGoals"
          away="awayGoals"
          form={form}
          onChange={handleChange}
        />

        <ComparisonRow
          label="Sofridos"
          home="homeConceded"
          away="awayConceded"
          form={form}
          onChange={handleChange}
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

      <button
        type="button"
        onClick={handleLoad}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold"
      >
        🚀 Usar no Input
      </button>

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
  onChange
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
        inputMode="decimal"
        step="any"
        min="0"
        name={home}
        value={
          form[home] ??
          ""
        }
        onChange={onChange}
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
        inputMode="decimal"
        step="any"
        min="0"
        name={away}
        value={
          form[away] ??
          ""
        }
        onChange={onChange}
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
   CONVERSÃO DO FORMULÁRIO
========================================== */

function convertFormToPayload(
  form:
    ComparisonForm
): ComparisonPayload {
  const payload:
    ComparisonPayload = {};

  for (
    const [
      key,
      rawValue
    ] of Object.entries(
      form
    )
  ) {
    const parsed =
      parseOptionalNumber(
        rawValue
      );

    /*
     * Mantemos compatibilidade com o contrato
     * anterior: campos vazios são enviados como 0.
     *
     * A diferença é que isso acontece apenas no
     * envio, e não enquanto o usuário digita.
     */
    payload[key] =
      parsed ??
      0;
  }

  return payload;
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

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
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/*
 * Aceita apenas:
 *
 * - números;
 * - sinal decimal;
 * - ponto ou vírgula;
 *
 * A vírgula é convertida em ponto para facilitar
 * o preenchimento em português.
 */
function sanitizeNumericInput(
  value: string
): string {
  const normalized =
    value.replace(
      ",",
      "."
    );

  if (
    normalized === ""
  ) {
    return "";
  }

  /*
   * Permite valores numéricos intermediários,
   * como "1." durante a digitação.
   */
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