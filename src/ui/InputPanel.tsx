import { useState, useEffect } from "react";

/* ===========================
   🔥 ROW (FORA DO COMPONENTE)
=========================== */

function Row({ label, home, away, form, handleChange }: any) {

  function getValue(name: string) {
    return form[name] || "";
  }

  function parse(v: any) {
    return parseFloat(v) || 0;
  }

  const h = parse(form[home]);
  const a = parse(form[away]);

  const homeBetter = h > a;
  const awayBetter = a > h;

  const diff = a !== 0 ? ((h - a) / a) * 100 : 0;

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 px-3 rounded-xl hover:bg-white/5">

      <input
        name={home}
        value={getValue(home)}
        onChange={handleChange}
        className={`inputElite ${homeBetter ? "border-green-500" : ""}`}
      />

      <div className="text-center">
        <div className="text-xs text-zinc-400">{label}</div>

        {diff !== 0 && (
          <div className={`text-[11px] mt-1 font-semibold ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
            {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(0)}%
          </div>
        )}
      </div>

      <input
        name={away}
        value={getValue(away)}
        onChange={handleChange}
        className={`inputElite ${awayBetter ? "border-green-500" : ""}`}
      />

    </div>
  );
}

/* ===========================
   🔥 INPUT PANEL
=========================== */

export default function InputPanel({ onAnalyze, externalData }: any) {

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (externalData) {
      setForm((prev: any) => ({
        ...prev,
        ...externalData
      }));
    }
  }, [externalData]);

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((prev: any) => ({
      ...prev,
      [name]: value
    }));
  }

  function getValue(name: string) {
    return form[name] || "";
  }

  function parse(v: any) {
    return parseFloat(v) || 0;
  }

  /* ===========================
     🚀 SUBMIT (AGORA CORRETO)
  ============================ */

  function handleSubmit() {

    const data = {
      match: {
        home: form.homeTeam,
        away: form.awayTeam,
        league: form.league
      },

      stats: {
        home: {
          goalsFor: parse(form.homeGoals),
          goalsAgainst: parse(form.homeConceded),
          shotsOnTarget: parse(form.homeShotsOnTarget),
          bigChances: parse(form.homeBigChances),
          possession: parse(form.homePossession)
        },
        away: {
          goalsFor: parse(form.awayGoals),
          goalsAgainst: parse(form.awayConceded),
          shotsOnTarget: parse(form.awayShotsOnTarget),
          bigChances: parse(form.awayBigChances),
          possession: parse(form.awayPossession)
        }
      },

      odds: {
        home: parse(form.oddHome),
        draw: parse(form.oddDraw),
        away: parse(form.oddAway),

        over15: parse(form.oddOver15),
        over25: parse(form.oddOver25),

        bttsYes: parse(form.oddBTTSYes),
        bttsNo: parse(form.oddBTTSNo),

        homeOrDraw: parse(form.odd1X),
        awayOrDraw: parse(form.oddX2)
      }
    };

    console.log("🔥 DATA FINAL:", data);

    onAnalyze(data);
  }

  return (
    <div className="min-h-screen p-6 bg-[#0B0F1A] text-white">

      <div className="max-w-3xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="grid grid-cols-3 gap-4">
          <input name="homeTeam" value={getValue("homeTeam")} onChange={handleChange} placeholder="🏠 Casa" className="inputElite" />
          <input name="league" value={getValue("league")} onChange={handleChange} placeholder="🏆 Liga" className="inputElite" />
          <input name="awayTeam" value={getValue("awayTeam")} onChange={handleChange} placeholder="🚀 Fora" className="inputElite" />
        </div>

        <Card title="📊 Geral">
          <Row label="Nota" home="homeRating" away="awayRating" form={form} handleChange={handleChange} />
          <Row label="Partidas" home="homeMatches" away="awayMatches" form={form} handleChange={handleChange} />
          <Row label="Gols" home="homeGoals" away="awayGoals" form={form} handleChange={handleChange} />
          <Row label="Sofridos" home="homeConceded" away="awayConceded" form={form} handleChange={handleChange} />
          <Row label="Assistências" home="homeAssists" away="awayAssists" form={form} handleChange={handleChange} />
        </Card>

        <Card title="⚔️ Ataque">
          <Row label="Gols/jogo" home="homeGoalsPG" away="awayGoalsPG" form={form} handleChange={handleChange} />
          <Row label="Chutes no gol" home="homeShotsOnTarget" away="awayShotsOnTarget" form={form} handleChange={handleChange} />
          <Row label="Grandes chances" home="homeBigChances" away="awayBigChances" form={form} handleChange={handleChange} />
          <Row label="Perdidas" home="homeBigChancesMissed" away="awayBigChancesMissed" form={form} handleChange={handleChange} />
        </Card>

        <Card title="🎯 Passe">
          <Row label="Posse %" home="homePossession" away="awayPossession" form={form} handleChange={handleChange} />
          <Row label="Passes" home="homePasses" away="awayPasses" form={form} handleChange={handleChange} />
          <Row label="Bolas longas" home="homeLongBalls" away="awayLongBalls" form={form} handleChange={handleChange} />
        </Card>

        <Card title="🛡 Defesa">
          <Row label="Clean Sheets" home="homeCleanSheets" away="awayCleanSheets" form={form} handleChange={handleChange} />
          <Row label="Gols sofridos/jogo" home="homeConcededPG" away="awayConcededPG" form={form} handleChange={handleChange} />
          <Row label="Interceptações" home="homeInterceptions" away="awayInterceptions" form={form} handleChange={handleChange} />
          <Row label="Desarmes" home="homeTackles" away="awayTackles" form={form} handleChange={handleChange} />
          <Row label="Cortes" home="homeClearances" away="awayClearances" form={form} handleChange={handleChange} />
          <Row label="Defesas" home="homeSaves" away="awaySaves" form={form} handleChange={handleChange} />
        </Card>

        <Card title="📦 Outros">
          <Row label="Faltas" home="homeFouls" away="awayFouls" form={form} handleChange={handleChange} />
          <Row label="Impedimentos" home="homeOffsides" away="awayOffsides" form={form} handleChange={handleChange} />
          <Row label="Laterais" home="homeThrowIns" away="awayThrowIns" form={form} handleChange={handleChange} />
          <Row label="Amarelos" home="homeYellow" away="awayYellow" form={form} handleChange={handleChange} />
          <Row label="Vermelhos" home="homeRed" away="awayRed" form={form} handleChange={handleChange} />
        </Card>

        {/* 💰 ODDS */}
        <Card title="💰 Odds">

          <div className="grid grid-cols-3 gap-3">
            <input name="oddHome" placeholder="Casa" onChange={handleChange} className="inputElite" />
            <input name="oddDraw" placeholder="Empate" onChange={handleChange} className="inputElite" />
            <input name="oddAway" placeholder="Fora" onChange={handleChange} className="inputElite" />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <input name="oddOver15" placeholder="Over 1.5" onChange={handleChange} className="inputElite" />
            <input name="oddOver25" placeholder="Over 2.5" onChange={handleChange} className="inputElite" />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <input name="oddBTTSYes" placeholder="BTTS Sim" onChange={handleChange} className="inputElite" />
            <input name="oddBTTSNo" placeholder="BTTS Não" onChange={handleChange} className="inputElite" />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <input name="odd1X" placeholder="1X (Casa/Empate)" onChange={handleChange} className="inputElite" />
            <input name="oddX2" placeholder="X2 (Fora/Empate)" onChange={handleChange} className="inputElite" />
          </div>

        </Card>

        <button
          onClick={handleSubmit}
          className="w-full py-4 rounded-xl font-bold text-white
          bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
          hover:scale-[1.02] transition shadow-lg"
        >
          🚀 ANALISAR JOGO
        </button>

      </div>
    </div>
  );
}

/* ===========================
   CARD
=========================== */

function Card({ title, children }: any) {
  return (
    <div className="bg-gradient-to-br from-[#121826] to-[#0f172a] p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur">
      <h2 className="text-sm text-zinc-400 mb-4 text-center font-semibold tracking-wide relative">
        <span className="px-3 bg-[#121826] relative z-10">{title}</span>
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-700 -z-0"></div>
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}