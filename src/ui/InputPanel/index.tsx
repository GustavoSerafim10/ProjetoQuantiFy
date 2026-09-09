import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";

import type { FormState, InputPanelProps, AnalysisPayload } from "./types";
import {
  inspectExternalData,
  createExternalSignature,
  convertExternalDataToForm,
  clearPreviousStatisticalFields
} from "./externalData";
import { isFormField } from "./fieldGuard";
import { buildTeamStats } from "./payloadBuilders";
import { validateRequiredTeamFields, validateTeamConsistency } from "./validation";
import { normalizeWarnings, createPayloadWarnings, formatWarning } from "./warnings";
import { Row } from "./Row";
import { Card } from "./Card";
import MarketOddsPanel, {
  buildMarketOddsPayload,
  hasAnyMarketOdds,
  type MarketOddsForm
} from "./MarketOddsPanel";

export type {
  ExternalInputData,
  TeamStatsPayload,
  OddsPayload,
  AnalysisPayload,
  MultiBookOddsPayload
} from "./types";

/* ==========================================
   INPUT PANEL — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os dados manuais da partida;
 * - incorporar dados externos (via prop `externalData`, quando houver
 *   um produtor conectado);
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

  /*
   * Achado real em 2026-09-08: o usuário quer ver estatísticas dos
   * times e odds de mercado juntas, na mesma tela — não como dois
   * modos separados, um botão só ("ANALISAR JOGO"). Desde
   * 2026-09-09 (ver fusedModelPipeline.ts/lambdaFusion.ts) as duas
   * coisas também pesam juntas no cálculo: com odds E stats dos
   * dois times, o eliteAnalyzer funde os dois lambdas (mercado como
   * base, stats como ajuste limitado). Sem odds, cai pro motor
   * antigo baseado só nas stats; sem stats de algum time, cai pro
   * consenso de-vig puro.
   */
  const [
    marketOddsForm,
    setMarketOddsForm
  ] = useState<MarketOddsForm>({});

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

    const hasMarketOdds =
      hasAnyMarketOdds(
        marketOddsForm
      );

    /*
     * Achado real em 2026-09-09: antes desta correção, o formulário
     * unificado exigia SEMPRE estatísticas completas E pelo menos uma
     * odd — mesmo que o usuário só quisesse usar o consenso de-vig
     * (marketModelPipeline/fusedModelPipeline em eliteAnalyzer.ts já
     * suportam análise só com odds). Isso tornava o caminho "só
     * odds" documentado nos comentários (types.ts/App.tsx)
     * inacessível pela UI. Agora as estatísticas só são obrigatórias
     * quando NÃO há nenhuma odd de mercado utilizável — com odds
     * presentes, estatísticas incompletas apenas pesam menos na
     * fusão (ver lambdaFusion.ts), em vez de bloquear o envio.
     */
    if (!hasMarketOdds) {
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

    const { marketOdds, odds } =
      buildMarketOddsPayload(
        marketOddsForm
      );

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

        marketOdds,

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
            label="Finalizações totais"
            home="homeShots"
            away="awayShots"
            form={form}
            handleChange={handleChange}
          />

          <Row
            label="Escanteios"
            home="homeCorners"
            away="awayCorners"
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

        {/* ODDS DE MERCADO (2-3 casas, alimenta o de-vig) */}

        <div>
          <h2 className="text-sm text-emerald-400 mb-3 font-semibold tracking-wide text-center">
            💰 Odds de mercado
          </h2>

          <MarketOddsPanel
            form={marketOddsForm}
            onChange={next => {
              setValidationError(null);
              setMarketOddsForm(next);
            }}
          />
        </div>

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
