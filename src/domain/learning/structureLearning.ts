import { getHistory } from "./learningStore";

export function getStructureInsights() {

  const history = getHistory();

  if (history.length < 30) {
    return {
      overBias: 1,
      bttsBias: 1,
      winBias: 1
    };
  }

  let overWins = 0;
  let overTotal = 0;

  let bttsWins = 0;
  let bttsTotal = 0;

  let winWins = 0;
  let winTotal = 0;

  for (const h of history) {

    if (h.market?.includes("Over")) {
      overTotal++;
      if (h.result === "win") overWins++;
    }

    if (h.market?.includes("BTTS")) {
      bttsTotal++;
      if (h.result === "win") bttsWins++;
    }

    if (
      h.market === "Home Win" ||
      h.market === "Away Win"
    ) {
      winTotal++;
      if (h.result === "win") winWins++;
    }
  }

  const overRate = overTotal ? overWins / overTotal : 0.5;
  const bttsRate = bttsTotal ? bttsWins / bttsTotal : 0.5;
  const winRate = winTotal ? winWins / winTotal : 0.5;

  return {
    overBias: overRate,
    bttsBias: bttsRate,
    winBias: winRate
  };
}