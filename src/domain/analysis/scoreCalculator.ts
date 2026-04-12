export function calculateScore(m: any) {

  const evScore = m.expectedValue * 100; // peso principal

  const kellyScore = m.kelly * 50;

  let zoneScore = 0;

  if (m.zone === "GREEN") zoneScore = 15;
  if (m.zone === "YELLOW") zoneScore = 5;

  // penaliza odds ruins (muito altas ou muito baixas)
  let oddsPenalty = 0;

  if (m.bookmakerOdd < 1.4) oddsPenalty -= 10;
  if (m.bookmakerOdd > 4.5) oddsPenalty -= 5;

  const score = evScore + kellyScore + zoneScore + oddsPenalty;

  return score;
}