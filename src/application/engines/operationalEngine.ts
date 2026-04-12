export function operationalEngine(matches: any[]) {

  /* ===========================
     🔥 FLATTEN (pegar só entradas)
  ============================ */

  const allBets: any[] = [];

  for (const m of matches) {

    if (m.best) {
      allBets.push({
        match: m.match,
        league: m.league,
        ...m.best
      });
    }

    if (m.secondary) {
      allBets.push({
        match: m.match,
        league: m.league,
        ...m.secondary
      });
    }
  }

  /* ===========================
     🔥 CLASSIFICAÇÃO
  ============================ */

  const classified = allBets.map((b) => {

    let tier = "IGNORE";
    let stake = 0;

    if (b.ev >= 0.15) {
      tier = "ELITE";
      stake = 2;
    } else if (b.ev >= 0.10) {
      tier = "OPERACIONAL";
      stake = 1;
    }

    return {
      ...b,
      tier,
      stake
    };
  });

  /* ===========================
     🔥 FILTRO (REMOVER RUIM)
  ============================ */

  const valid = classified.filter((b) => b.tier !== "IGNORE");

  /* ===========================
     🔥 ORDENAÇÃO FINAL
  ============================ */

  const sorted = valid.sort(
    (a, b) => b.edgeScore - a.edgeScore
  );

  /* ===========================
     🔥 TOP 3 DO DIA
  ============================ */

  const top3 = sorted.slice(0, 3);

  /* ===========================
     🔥 RESUMO
  ============================ */

  const totalStake = top3.reduce((acc, b) => acc + b.stake, 0);

  return {
    picks: top3,
    totalStake,
    totalBets: top3.length
  };
}