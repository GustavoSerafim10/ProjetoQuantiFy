import { useState } from "react";

export default function ComparisonPanel({ onLoadData }: any) {

  const [form, setForm] = useState<any>({});

  function handleChange(e: any) {
    const { name, value } = e.target;

    setForm((prev: any) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  }

  function getValue(name: string) {
    return form[name] ?? "";
  }

  const input = "inputElite";

  const Row = ({ label, home, away }: any) => {

    const h = form[home] || 0;
    const a = form[away] || 0;

    const homeBetter = h > a;
    const awayBetter = a > h;

    return (
      <div className="grid grid-cols-3 gap-4 items-center">

        <input
          name={home}
          value={getValue(home)}
          onChange={handleChange}
          className={`${input} ${homeBetter ? "border-green-500" : ""}`}
        />

        <span className="text-xs text-zinc-400 text-center">{label}</span>

        <input
          name={away}
          value={getValue(away)}
          onChange={handleChange}
          className={`${input} ${awayBetter ? "border-green-500" : ""}`}
        />
      </div>
    );
  };

  function handleLoad() {
    onLoadData(form); // 🔥 DIRETO (SEM TRANSFORMAÇÃO)
  }

  return (
    <div className="p-6 bg-black text-white rounded-2xl space-y-6">

      <h2 className="text-lg font-bold">📊 Comparação estilo SofaScore</h2>

      {/* GERAL */}
      <Section title="📊 Geral">
        <Row label="Nota" home="homeRating" away="awayRating" />
        <Row label="Partidas" home="homeMatches" away="awayMatches" />
        <Row label="Gols" home="homeGoals" away="awayGoals" />
        <Row label="Sofridos" home="homeConceded" away="awayConceded" />
        <Row label="Assistências" home="homeAssists" away="awayAssists" />
      </Section>

      {/* ATAQUE */}
      <Section title="⚔️ Ataque">
        <Row label="Gols/jogo" home="homeGoalsPG" away="awayGoalsPG" />
        <Row label="Chutes no gol" home="homeShotsOnTarget" away="awayShotsOnTarget" />
        <Row label="Grandes chances" home="homeBigChances" away="awayBigChances" />
        <Row label="Perdidas" home="homeBigChancesMissed" away="awayBigChancesMissed" />
      </Section>

      {/* PASSE */}
      <Section title="🎯 Passe">
        <Row label="Posse %" home="homePossession" away="awayPossession" />
        <Row label="Passes" home="homePasses" away="awayPasses" />
        <Row label="Bolas longas" home="homeLongBalls" away="awayLongBalls" />
      </Section>

      {/* DEFESA */}
      <Section title="🛡 Defesa">
        <Row label="Clean Sheets" home="homeCleanSheets" away="awayCleanSheets" />
        <Row label="Sofridos/jogo" home="homeConcededPG" away="awayConcededPG" />
        <Row label="Interceptações" home="homeInterceptions" away="awayInterceptions" />
        <Row label="Desarmes" home="homeTackles" away="awayTackles" />
        <Row label="Cortes" home="homeClearances" away="awayClearances" />
        <Row label="Defesas" home="homeSaves" away="awaySaves" />
      </Section>

      {/* OUTROS */}
      <Section title="📦 Outros">
        <Row label="Faltas" home="homeFouls" away="awayFouls" />
        <Row label="Impedimentos" home="homeOffsides" away="awayOffsides" />
        <Row label="Laterais" home="homeThrowIns" away="awayThrowIns" />
        <Row label="Amarelos" home="homeYellow" away="awayYellow" />
        <Row label="Vermelhos" home="homeRed" away="awayRed" />
      </Section>

      <button
        onClick={handleLoad}
        className="w-full py-3 bg-indigo-600 rounded-xl font-bold"
      >
        🚀 Usar no Input
      </button>

    </div>
  );
}

/* SECTION */
function Section({ title, children }: any) {
  return (
    <div className="bg-zinc-900 p-4 rounded-xl space-y-2">
      <h3 className="text-sm text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}