import { useState } from "react";

import {
  buildAnalystBrief,
  type AnalystBriefOdds,
  type AnalystBriefQuantMarket
} from "../domain/aiAnalyst/buildAnalystBrief";

import { registerBet } from "../domain/tracking/trackingEngine";

/* ==========================================
   AI ANALYST PANEL
========================================== */

/*
 * Camada discricionária sobre o motor quantitativo, pedida
 * depois de uma sequência ruim (25% de acerto, -17,2% ROI) e
 * de uma experiência manual (colar stats do Sofascore + odds da
 * Bet365 numa conversa com IA) que saiu muito melhor (5 em 6).
 *
 * O app NÃO navega Sofascore/Bet365 sozinho — nenhuma ferramenta
 * disponível renderiza SPA dinâmica nem lê odds ao vivo da Bet365.
 * Em vez disso, este painel formaliza o processo manual: o usuário
 * cola forma recente + desfalques aqui, gera um prompt estruturado
 * (buildAnalystBrief), copia para uma conversa com IA, e cola a
 * recomendação de volta — que é registrada no mesmo histórico do
 * motor quantitativo, com source "AI", para que CalibrationPanel
 * meça as duas abordagens pela mesma régua (Brier score, ROI) em
 * vez de ficar na anedota.
 */

interface AiAnalystPanelProps {
  match: {
    home: string;
    away: string;
    league?: string;
  } | null;

  odds: AnalystBriefOdds | null;

  quantSummary?: AnalystBriefQuantMarket[];

  onRegistered?: () => void;
}

export default function AiAnalystPanel({
  match,
  odds,
  quantSummary,
  onRegistered
}: AiAnalystPanelProps) {
  const [recentFormHome, setRecentFormHome] = useState("");
  const [recentFormAway, setRecentFormAway] = useState("");

  const [injuriesHome, setInjuriesHome] = useState("");
  const [injuriesAway, setInjuriesAway] = useState("");

  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const [aiMarket, setAiMarket] = useState("");
  const [aiOdd, setAiOdd] = useState("");
  const [aiProbability, setAiProbability] = useState("");
  const [aiStake, setAiStake] = useState("");
  const [aiJustification, setAiJustification] = useState("");

  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);

  if (!match) {
    return null;
  }

  function handleGeneratePrompt() {
    const prompt = buildAnalystBrief({
      match: {
        home: match!.home,
        away: match!.away,
        league: match!.league
      },
      odds: odds ?? {},
      recentForm: {
        home: recentFormHome,
        away: recentFormAway
      },
      injuries: {
        home: injuriesHome,
        away: injuriesAway
      },
      quantSummary
    });

    setGeneratedPrompt(prompt);
    setCopyFeedback("");
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopyFeedback("✅ Copiado.");
    } catch {
      setCopyFeedback("⚠️ Não foi possível copiar automaticamente — selecione o texto manualmente.");
    }
  }

  function handleRegisterAiPick() {
    setRegisterError(null);
    setRegisterFeedback(null);

    const market = aiMarket.trim();
    const odd = Number(aiOdd.replace(",", "."));
    const probabilityPercent = Number(aiProbability.replace(",", "."));
    const stakePercent = Number(aiStake.replace(",", "."));

    if (!market) {
      setRegisterError("Informe o mercado recomendado pela IA.");
      return;
    }

    if (!Number.isFinite(odd) || odd <= 1) {
      setRegisterError("Odd inválida — informe a odd observada (ex: 1.85).");
      return;
    }

    if (
      !Number.isFinite(probabilityPercent) ||
      probabilityPercent <= 0 ||
      probabilityPercent >= 100
    ) {
      setRegisterError("Probabilidade estimada inválida — informe um valor entre 0 e 100.");
      return;
    }

    const probability = probabilityPercent / 100;

    const stake =
      Number.isFinite(stakePercent) && stakePercent > 0
        ? stakePercent / 100
        : 0.01;

    const ev = probability * odd - 1;

    registerBet({
      id: `ai-${Date.now()}`,

      match: `${match!.home} x ${match!.away}`,
      market,

      odd,
      probability,

      ev,
      kelly: 0,

      stake,

      createdAt: Date.now(),

      type: "BET",
      source: "AI",

      analysisSnapshot: aiJustification.trim()
        ? {
            input: {
              justification: aiJustification.trim(),
              recentForm: { home: recentFormHome, away: recentFormAway },
              injuries: { home: injuriesHome, away: injuriesAway }
            }
          }
        : undefined
    });

    setRegisterFeedback("✅ Entrada da IA registrada no histórico.");
    onRegistered?.();
  }

  return (
    <div className="mx-6 mb-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-5">
      <div>
        <h2 className="font-bold text-purple-300">
          🧠 Analista IA (discricionário)
        </h2>

        <p className="text-xs text-zinc-400 mt-1">
          Cole a forma recente (Sofascore) e os desfalques de cada time,
          gere o prompt, cole-o numa conversa com IA e traga a
          recomendação de volta. Isso não substitui o motor
          quantitativo — fica registrado à parte para comparar os dois.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            Últimos jogos em casa — {match.home}
          </label>
          <textarea
            value={recentFormHome}
            onChange={e => setRecentFormHome(e.target.value)}
            placeholder="Ex: V 2x0, V 1x0, E 1x1, D 0x1, V 3x1 (últimos 5 em casa)"
            className="inputElite w-full h-24 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            Últimos jogos fora — {match.away}
          </label>
          <textarea
            value={recentFormAway}
            onChange={e => setRecentFormAway(e.target.value)}
            placeholder="Ex: D 0x2, V 1x0, D 1x2, E 0x0, V 2x1 (últimos 5 fora)"
            className="inputElite w-full h-24 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            Desfalques — {match.home}
          </label>
          <textarea
            value={injuriesHome}
            onChange={e => setInjuriesHome(e.target.value)}
            placeholder="Ex: zagueiro titular suspenso, artilheiro em dúvida"
            className="inputElite w-full h-16 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            Desfalques — {match.away}
          </label>
          <textarea
            value={injuriesAway}
            onChange={e => setInjuriesAway(e.target.value)}
            placeholder="Ex: goleiro titular lesionado"
            className="inputElite w-full h-16 resize-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGeneratePrompt}
        className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 text-sm font-semibold hover:bg-purple-500/30 transition"
      >
        ✍️ Gerar prompt de análise
      </button>

      {generatedPrompt && (
        <div className="space-y-2">
          <textarea
            readOnly
            value={generatedPrompt}
            className="inputElite w-full h-64 resize-y text-xs font-mono"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 text-white text-xs font-semibold hover:bg-zinc-600 transition"
            >
              📋 Copiar prompt
            </button>

            {copyFeedback && (
              <span className="text-xs text-zinc-400">{copyFeedback}</span>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-purple-500/20 pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-200">
          Colar recomendação da IA
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={aiMarket}
            onChange={e => setAiMarket(e.target.value)}
            placeholder="Mercado recomendado (ex: Casa, Over 2.5, DNB Fora...)"
            className="inputElite"
          />

          <input
            value={aiOdd}
            onChange={e => setAiOdd(e.target.value)}
            placeholder="Odd observada (ex: 1.85)"
            className="inputElite"
          />

          <input
            value={aiProbability}
            onChange={e => setAiProbability(e.target.value)}
            placeholder="Probabilidade estimada pela IA % (ex: 58)"
            className="inputElite"
          />

          <input
            value={aiStake}
            onChange={e => setAiStake(e.target.value)}
            placeholder="Stake sugerido % da banca (ex: 2)"
            className="inputElite"
          />
        </div>

        <textarea
          value={aiJustification}
          onChange={e => setAiJustification(e.target.value)}
          placeholder="Justificativa da IA (opcional, fica salva no histórico para auditoria futura)"
          className="inputElite w-full h-20 resize-none"
        />

        {registerError && (
          <div className="text-xs text-red-400">⚠️ {registerError}</div>
        )}

        {registerFeedback && (
          <div className="text-xs text-green-400">{registerFeedback}</div>
        )}

        <button
          type="button"
          onClick={handleRegisterAiPick}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:scale-[1.01] transition"
        >
          💾 Registrar entrada da IA
        </button>
      </div>
    </div>
  );
}
