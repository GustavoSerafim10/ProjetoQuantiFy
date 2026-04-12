interface ConfidenceInput {
  goals: any;
  btts: any;
  result: any;
  lambdaHome: number;
  lambdaAway: number;
}

export function calculateGlobalConfidence(input: ConfidenceInput): number {

  const { goals, btts, result, lambdaHome, lambdaAway } = input;

  /* ===========================
     1️⃣ DOMINÂNCIA (RESULTADO)
  ============================ */

  const maxResult = Math.max(
    result.homeWin,
    result.draw,
    result.awayWin
  );

  const dominance = Math.abs(maxResult - 0.33) * 1.6;

  /* ===========================
     2️⃣ CONSISTÊNCIA (MODELOS)
  ============================ */

  const goalsBias = Math.abs(goals.over25 - 0.5);
  const bttsBias = Math.abs(btts.yes - 0.5);

  const consistency = (goalsBias * 0.6 + bttsBias * 0.4);

  /* ===========================
     3️⃣ INTENSIDADE (λ)
  ============================ */

  const totalLambda = lambdaHome + lambdaAway;

  // 🔥 melhor leitura de caos
  let chaosPenalty = 0;

  if (totalLambda > 3.2) chaosPenalty = 1;
  else if (totalLambda < 2.0) chaosPenalty = 0.6;
  else chaosPenalty = 0.8;

  /* ===========================
     🔥 CONFIDENCE FINAL
  ============================ */

  let confidence =
    (dominance * 0.4) +
    (consistency * 0.4) +
    ((1 - chaosPenalty) * 0.2);

  // clamp
  confidence = Math.max(0, Math.min(1, confidence));

  return Number(confidence.toFixed(4));
}