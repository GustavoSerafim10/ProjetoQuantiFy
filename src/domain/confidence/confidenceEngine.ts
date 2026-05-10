interface ConfidenceInput {
  goals: any;
  btts: any;
  result: any;
  lambdaHome: number;
  lambdaAway: number;
}

export function calculateGlobalConfidence(input: ConfidenceInput): number {
  const { goals, btts, result, lambdaHome, lambdaAway } = input;

  const safeGoalsOver25 = Number(goals?.over25 ?? 0.5);
  const safeBttsYes = Number(btts?.yes ?? 0.5);
  const safeHomeWin = Number(result?.homeWin ?? 0.33);
  const safeDraw = Number(result?.draw ?? 0.33);
  const safeAwayWin = Number(result?.awayWin ?? 0.33);
  const safeLambdaHome = Number(lambdaHome ?? 1.2);
  const safeLambdaAway = Number(lambdaAway ?? 1.0);

  /* ===========================
     1️⃣ DOMINÂNCIA (RESULTADO)
  ============================ */

  const maxResult = Math.max(
    safeHomeWin,
    safeDraw,
    safeAwayWin
  );

  const dominance = Math.abs(maxResult - 0.33) * 1.5;

  /* ===========================
     2️⃣ CONSISTÊNCIA (MODELOS)
  ============================ */

  const goalsBias = Math.abs(safeGoalsOver25 - 0.5);
  const bttsBias = Math.abs(safeBttsYes - 0.5);

  const consistency =
    (goalsBias * 0.6) +
    (bttsBias * 0.4);

  /* ===========================
     3️⃣ INTENSIDADE / ESTABILIDADE (λ)
  ============================ */

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const lambdaDiff = Math.abs(safeLambdaHome - safeLambdaAway);

  let structureFactor = 0.5;

  // zona saudável de intensidade
  if (totalLambda >= 2.2 && totalLambda <= 3.4) {
    structureFactor = 0.72;
  }
  // jogo mais truncado
  else if (totalLambda < 2.2) {
    structureFactor = 0.58;
  }
  // jogo muito aberto
  else {
    structureFactor = 0.62;
  }

  // leve bônus por assimetria clara
  if (lambdaDiff > 0.8) {
    structureFactor += 0.05;
  }

/* ===========================
   🧠 QUALIDADE ESTRUTURAL
============================ */

const minLambda = Math.min(
  safeLambdaHome,
  safeLambdaAway
);

// jogo ofensivo bilateral saudável
if (
  totalLambda >= 2.8 &&
  minLambda >= 1.0
) {
  structureFactor += 0.05;
}

// jogo ofensivo fake
if (
  totalLambda >= 2.8 &&
  minLambda < 0.70
) {
  structureFactor -= 0.06;
}

// jogo extremamente desequilibrado
if (lambdaDiff > 1.8) {
  structureFactor -= 0.05;
}

  structureFactor = Math.max(0, Math.min(structureFactor, 1));

  

  /* ===========================
     4️⃣ CONFIDENCE FINAL
  ============================ */

  let confidence =
    (dominance * 0.38) +
    (consistency * 0.37) +
    (structureFactor * 0.25);

  /* ===========================
     5️⃣ CLAMP FINAL
  ============================ */

  confidence = Math.max(0, Math.min(1, confidence));

  return Number(confidence.toFixed(4));
}