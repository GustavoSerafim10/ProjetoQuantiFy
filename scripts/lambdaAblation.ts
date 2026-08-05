/* ==========================================
   LAMBDA ABLATION — FERRAMENTA EXPERIMENTAL
========================================== */

/*
 * ATENÇÃO:
 *
 * Este arquivo é uma ferramenta ISOLADA de diagnóstico.
 *
 * Ele NÃO importa nada de src/domain ou src/application.
 * Ele NÃO altera o pipeline oficial.
 * Ele NÃO deve ser chamado pelo eliteAnalyzer.
 *
 * Reimplementa deliberadamente (em código separado) a
 * mesma matemática do lambdaBuilder.ts e do goalsModel,
 * apenas para permitir comparação entre cenários sem
 * qualquer risco de contaminar a produção.
 *
 * Uso (execução manual):
 *   npx tsx scripts/lambdaAblation.ts
 *   npx tsx scripts/lambdaAblation.ts --export=json
 *   npx tsx scripts/lambdaAblation.ts --export=csv
 *
 * Este arquivo nunca é importado por src/ — por isso é
 * seguro rodar sua lógica incondicionalmente no final do
 * arquivo, sem risco de disparo acidental via `npm run dev`.
 *
 * Preencha os 9 jogos no array GAMES abaixo antes de rodar.
 *
 * ==========================================
 * STATUS DE PARIDADE (revisão solicitada pelo ChatGPT)
 * ==========================================
 *
 * ✅ CONFIRMADO — Cenário A reproduz EXATAMENTE (0.00% de
 *    diferença) o baseLambdaHome/baseLambdaAway real do
 *    lambdaBuilder.ts oficial, testado em 1 jogo (Celtic x
 *    Dundee). Inclui o composite ofensivo completo
 *    (shot quality factor, ramo fallback do xG proxy).
 *
 * ⚠️ PENDENTE — Paridade confirmada em apenas 1 de 3 jogos
 *    exigidos. Faltam 2 jogos com baseLambdaHome/baseLambdaAway
 *    conhecidos para fechar o teste de paridade completo.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA — Este script modela o lambda
 *    PRÉ-CONTEXTO (saída pura do lambdaBuilder.ts). Ele NÃO
 *    modela o ajuste do contextEngine.ts (tempo/pressão,
 *    limitado a ±8%) que roda DEPOIS, dentro do modelPipeline.ts,
 *    e que produz o lambda final realmente usado no Poisson em
 *    produção. contextEngine.ts ainda não foi auditado.
 *    Portanto: compare os resultados do Cenário A contra
 *    "baseLambdaHome"/"baseLambdaAway" no console — NÃO contra
 *    "FINAL LAMBDAS" (que já inclui o ajuste de contexto).
 *
 * ⚠️ LIMITAÇÃO CONHECIDA — Assume que o xG proxy está sempre
 *    inválido (ramo fallback), porque "shots" totais estiveram
 *    ausentes em todos os jogos testados até agora. Se algum
 *    jogo tiver "shots" totais disponíveis, a paridade não é
 *    garantida (exigiria auditar xgProxy.ts).
 *
 * ⚠️ LIMITAÇÃO CONHECIDA — Truncamento da matriz de gols fixado
 *    em 20 (maxGoals). O valor real usado pelo goalsModel.ts
 *    oficial não foi confirmado (matrizes observadas variaram
 *    entre 11 e 13). Numericamente irrelevante para os lambdas
 *    testados, mas não é paridade comprovada.
 *
 * NÃO use este script como evidência definitiva para alterar
 * nenhum parâmetro oficial até que os itens acima estejam
 * fechados.
 */



/* ==========================================
   CONSTANTES DO SISTEMA OFICIAL (V7.2)
   Mantidas idênticas ao lambdaBuilder.ts real.
========================================== */



const OFFICIAL = {
  ATTACK_ELASTICITY: 0.82,
  DEFENSE_ELASTICITY: 0.78,
  DOMINANCE_ELASTICITY: 0.18,
  MIN_ADAPTIVE_SHRINK: 4,
  MAX_ADAPTIVE_SHRINK: 18,
  MIN_LAMBDA: 0.20,
  MAX_LAMBDA: 3.20,
  MAX_TOTAL_LAMBDA: 5.0
} as const;

/* ==========================================
   CONTRATO DE ENTRADA POR JOGO
========================================== */

type FavoriteSide = "home" | "away" | "none";

type GameCategory =
  | "extreme_favorite"
  | "moderate_favorite"
  | "balanced";

interface GameInput {
  /*
   * Identificação apenas para leitura humana.
   */
  label: string;

  /*
   * Necessários para reproduzir o composite ofensivo
   * (GOALS_WEIGHT/XG_PROXY_WEIGHT/SHOT_QUALITY_WEIGHT).
   * Copiar de HOME/AWAY INPUT RESOLUTION -> shotsOnTarget/bigChances.
   */
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeBigChances: number | null;
  awayBigChances: number | null;

  /*
   * Copiar de "LEAGUE BASES" no console.
   */
  leagueBaseHome: number;
  leagueBaseAway: number;
  leagueTeamBase: number;
  leagueAdjustment: number;

  /*
   * Copiar de "HOME INPUT RESOLUTION" / "AWAY INPUT RESOLUTION".
   */
  homeMatches: number;
  awayMatches: number;
  inputQuality: number;

  /*
   * Taxas observadas (goalsPerGame / goalsConcededPerGame).
   */
  homeGoalsRate: number;
  homeConcededRate: number;
  awayGoalsRate: number;
  awayConcededRate: number;

  /*
   * rho do Dixon-Coles usado no jogo (aparece em
   * "dixonColes: {matrix, rho, ...}" no console).
   * Se não tiver, usar -0.08 (valor padrão observado).
   */
  rho: number;

  /*
   * Odds reais oferecidas pela casa.
   */
  odds: {
    home: number;
    draw: number;
    away: number;
  };
}

/* ==========================================
   UTILITÁRIOS
========================================== */

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(value, max));
}

function safePower(base: number, exponent: number): number {
  if (!Number.isFinite(base) || base <= 0) return 1;
  const result = Math.pow(base, exponent);
  return Number.isFinite(result) ? result : 1;
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function dixonColesTau(
  h: number,
  a: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  if (h === 0 && a === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (h === 0 && a === 1) return 1 + lambdaHome * rho;
  if (h === 1 && a === 0) return 1 + lambdaAway * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

/* ==========================================
   SHRINKAGE (idêntico ao lambdaBuilder.ts)
========================================== */

function adaptiveShrinkFactor(
  matches: number,
  quality: number,
  shrinkMultiplier: number
): number {
  const safeMatches = clamp(matches, 0, 100);
  const safeQuality = clamp(quality, 0, 1);

  const sampleComponent =
    safeMatches <= 5
      ? 1
      : safeMatches >= 30
        ? 0
        : 1 - (safeMatches - 5) / 25;

  const qualityComponent = 1 - safeQuality;

  const blendedSeverity = clamp(
    sampleComponent * 0.70 + qualityComponent * 0.30,
    0,
    1
  );

  const base =
    OFFICIAL.MIN_ADAPTIVE_SHRINK +
    (OFFICIAL.MAX_ADAPTIVE_SHRINK - OFFICIAL.MIN_ADAPTIVE_SHRINK) *
      blendedSeverity;

  return base * shrinkMultiplier;
}

function shrinkStat(
  raw: number,
  leagueAverage: number,
  matches: number,
  quality: number,
  shrinkMultiplier: number
): number {
  const safeMatches = clamp(matches, 0, 100);
  const shrink = adaptiveShrinkFactor(matches, quality, shrinkMultiplier);
  const denominator = safeMatches + shrink;
  const weight = denominator > 0 ? safeMatches / denominator : 0;
  return raw * weight + leagueAverage * (1 - weight);
}

/* ==========================================
   COMPOSIÇÃO OFENSIVA (idêntico ao lambdaBuilder.ts)
========================================== */

/*
 * IMPORTANTE — LIMITAÇÃO CONHECIDA:
 *
 * Esta função reproduz o RAMO FALLBACK do composite
 * ofensivo (usado quando o xG proxy é inválido, o que
 * acontece sempre que "shots" totais estão ausentes —
 * confirmado ser o caso em todos os jogos testados até
 * agora, via warnings HOME/AWAY_SHOTS_ZERO_TREATED_AS_MISSING).
 *
 * Se algum dia "shots" totais passarem a estar disponíveis
 * no seu painel de entrada, o xG proxy passa a ser válido
 * e o cálculo oficial usa outra fórmula (via xgProxy.ts,
 * que ainda não foi auditado). Neste caso este script
 * deixaria de ter paridade garantida.
 *
 * Testado e validado byte a byte contra o console real
 * para Celtic x Dundee (diferença = 0.00%).
 */

const SHOT_QUALITY_MAX_ADJUSTMENT = 0.14;

function calculateShotQualityFactor(
  goalsRate: number,
  shotsOnTarget: number | null,
  bigChances: number | null
): number {
  const conversionRate =
    shotsOnTarget !== null && shotsOnTarget > 0
      ? goalsRate / shotsOnTarget
      : null;

  const sotQuality =
    shotsOnTarget !== null ? clamp(shotsOnTarget / 5, 0, 1.6) : null;

  const bigChanceQuality =
    bigChances !== null ? clamp(bigChances / 2, 0, 1.6) : null;

  const conversionQuality =
    conversionRate !== null ? clamp(conversionRate / 0.12, 0, 1.6) : null;

  const components = [sotQuality, bigChanceQuality, conversionQuality].filter(
    (v): v is number => v !== null
  );

  if (components.length === 0) return 1;

  const avgQuality =
    components.reduce((s, v) => s + v, 0) / components.length;

  const compressed = 1 + (avgQuality - 1) * SHOT_QUALITY_MAX_ADJUSTMENT;

  return clamp(
    compressed,
    1 - SHOT_QUALITY_MAX_ADJUSTMENT,
    1 + SHOT_QUALITY_MAX_ADJUSTMENT
  );
}

function attackComposite(
  goalsRate: number,
  shotsOnTarget: number | null,
  bigChances: number | null
): number {
  const GOALS_WEIGHT = 0.58;
  const XG_PROXY_WEIGHT = 0.22;
  const SHOT_QUALITY_WEIGHT = 0.20;

  const shotQualityFactor = calculateShotQualityFactor(
    goalsRate,
    shotsOnTarget,
    bigChances
  );

  const shotQualityProxy = goalsRate * shotQualityFactor;

  /*
   * recentFormFactor e varianceFactor assumidos = 1
   * (neutro) porque os dados recentGoalsPerGame/goalVariance
   * não aparecem disponíveis nos jogos testados até agora.
   */
  return goalsRate * (GOALS_WEIGHT + XG_PROXY_WEIGHT) + shotQualityProxy * SHOT_QUALITY_WEIGHT;
}

/* ==========================================
   DOMINANCE FACTOR (idêntico)
========================================== */

function dominanceFactor(
  ownAttack: number,
  opponentAttack: number,
  opponentDefFragility: number,
  ownDefFragility: number,
  enabled: boolean
): number {
  if (!enabled) return 1;

  const offensiveRatio = ownAttack / Math.max(opponentAttack, 0.01);
  const matchupRatio = opponentDefFragility / Math.max(ownDefFragility, 0.01);
  const combined = Math.sqrt(Math.max(offensiveRatio * matchupRatio, 0.01));

  return clamp(
    safePower(combined, OFFICIAL.DOMINANCE_ELASTICITY),
    0.88,
    1.12
  );
}

/* ==========================================
   BUILD LAMBDA — PARAMETRIZADO PARA ABLAÇÃO
========================================== */

interface ScenarioParams {
  name: string;
  attackElasticity: number;
  defenseElasticity: number;
  shrinkMultiplier: number;
  dominanceEnabled: boolean;
}

interface LambdaResult {
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  homeAdaptiveShrinkFactor: number;
  awayAdaptiveShrinkFactor: number;
  homeAttackStrength: number;
  awayAttackStrength: number;
  homeDefensiveFragility: number;
  awayDefensiveFragility: number;
  homeDominanceFactor: number;
  awayDominanceFactor: number;
}

function buildLambdaForScenario(
  game: GameInput,
  scenario: ScenarioParams
): LambdaResult {
  const homeAttackRef = game.leagueTeamBase;
  const awayAttackRef = game.leagueTeamBase;
  const homeDefRef = game.leagueTeamBase;
  const awayDefRef = game.leagueTeamBase;

  const homeAttackCompositeValue = attackComposite(
    game.homeGoalsRate,
    game.homeShotsOnTarget,
    game.homeBigChances
  );

  const awayAttackCompositeValue = attackComposite(
    game.awayGoalsRate,
    game.awayShotsOnTarget,
    game.awayBigChances
  );

  const homeAttackRaw = shrinkStat(
    homeAttackCompositeValue,
    homeAttackRef,
    game.homeMatches,
    game.inputQuality,
    scenario.shrinkMultiplier
  );

  const awayAttackRaw = shrinkStat(
    awayAttackCompositeValue,
    awayAttackRef,
    game.awayMatches,
    game.inputQuality,
    scenario.shrinkMultiplier
  );

  const homeDefenseRaw = shrinkStat(
    game.homeConcededRate,
    homeDefRef,
    game.homeMatches,
    game.inputQuality,
    scenario.shrinkMultiplier
  );

  const awayDefenseRaw = shrinkStat(
    game.awayConcededRate,
    awayDefRef,
    game.awayMatches,
    game.inputQuality,
    scenario.shrinkMultiplier
  );

  const homeAttackStrength = safePower(
    homeAttackRaw / homeAttackRef,
    scenario.attackElasticity
  );

  const awayAttackStrength = safePower(
    awayAttackRaw / awayAttackRef,
    scenario.attackElasticity
  );

  const homeDefensiveFragility = safePower(
    homeDefenseRaw / homeDefRef,
    scenario.defenseElasticity
  );

  const awayDefensiveFragility = safePower(
    awayDefenseRaw / awayDefRef,
    scenario.defenseElasticity
  );

  const homeDominance = dominanceFactor(
    homeAttackStrength,
    awayAttackStrength,
    awayDefensiveFragility,
    homeDefensiveFragility,
    scenario.dominanceEnabled
  );

  const awayDominance = dominanceFactor(
    awayAttackStrength,
    homeAttackStrength,
    homeDefensiveFragility,
    awayDefensiveFragility,
    scenario.dominanceEnabled
  );

  let lambdaHome =
    game.leagueBaseHome *
    homeAttackStrength *
    awayDefensiveFragility *
    homeDominance;

  let lambdaAway =
    game.leagueBaseAway *
    awayAttackStrength *
    homeDefensiveFragility *
    awayDominance;

  lambdaHome *= game.leagueAdjustment;
  lambdaAway *= game.leagueAdjustment;

  lambdaHome = clamp(lambdaHome, OFFICIAL.MIN_LAMBDA, OFFICIAL.MAX_LAMBDA);
  lambdaAway = clamp(lambdaAway, OFFICIAL.MIN_LAMBDA, OFFICIAL.MAX_LAMBDA);

  const total = lambdaHome + lambdaAway;

  if (total > OFFICIAL.MAX_TOTAL_LAMBDA) {
    const factor = OFFICIAL.MAX_TOTAL_LAMBDA / total;
    lambdaHome *= factor;
    lambdaAway *= factor;
  }

  return {
    lambdaHome,
    lambdaAway,
    totalLambda: lambdaHome + lambdaAway,

    homeAdaptiveShrinkFactor: adaptiveShrinkFactor(
      game.homeMatches,
      game.inputQuality,
      scenario.shrinkMultiplier
    ),

    awayAdaptiveShrinkFactor: adaptiveShrinkFactor(
      game.awayMatches,
      game.inputQuality,
      scenario.shrinkMultiplier
    ),

    homeAttackStrength,
    awayAttackStrength,
    homeDefensiveFragility,
    awayDefensiveFragility,
    homeDominanceFactor: homeDominance,
    awayDominanceFactor: awayDominance
  };
}

/* ==========================================
   MERCADOS — POISSON + DIXON-COLES
========================================== */

interface MarketProbabilities {
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  bttsYes: number;
}

function calculateMarkets(
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
  maxGoals = 20 // AVISO: truncamento real do goalsModel.ts não confirmado
                // (matrizes observadas no console variaram entre 11-13).
                // Numericamente irrelevante para estes lambdas, mas
                // pendente de confirmação com o arquivo oficial.
): MarketProbabilities {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver15 = 0;
  let pOver25 = 0;
  let pBttsYes = 0;
  let total = 0;

  for (let h = 0; h < maxGoals; h++) {
    for (let a = 0; a < maxGoals; a++) {
      const base = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      const tau = dixonColesTau(h, a, lambdaHome, lambdaAway, rho);
      const p = base * tau;

      total += p;

      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;

      if (h + a >= 2) pOver15 += p;
      if (h + a >= 3) pOver25 += p;
      if (h >= 1 && a >= 1) pBttsYes += p;
    }
  }

  return {
    home: pHome / total,
    draw: pDraw / total,
    away: pAway / total,
    over15: pOver15 / total,
    over25: pOver25 / total,
    bttsYes: pBttsYes / total
  };
}

/* ==========================================
   MERCADO JUSTO (SEM OVERROUND)
========================================== */

function fairMarketProbabilities(odds: {
  home: number;
  draw: number;
  away: number;
}) {
  const impliedHome = 1 / odds.home;
  const impliedDraw = 1 / odds.draw;
  const impliedAway = 1 / odds.away;

  const overround = impliedHome + impliedDraw + impliedAway;

  return {
    overround,
    impliedRaw: {
      home: impliedHome,
      draw: impliedDraw,
      away: impliedAway
    },
    fair: {
      home: impliedHome / overround,
      draw: impliedDraw / overround,
      away: impliedAway / overround
    }
  };
}

function classifyGame(fairHomeProb: number, fairAwayProb: number): {
  category: GameCategory;
  favoriteSide: FavoriteSide;
} {
  const maxProb = Math.max(fairHomeProb, fairAwayProb);
  const favoriteSide: FavoriteSide =
    fairHomeProb === fairAwayProb
      ? "none"
      : fairHomeProb > fairAwayProb
        ? "home"
        : "away";

  const category: GameCategory =
    maxProb >= 0.75
      ? "extreme_favorite"
      : maxProb >= 0.60
        ? "moderate_favorite"
        : "balanced";

  return { category, favoriteSide };
}

/* ==========================================
   CENÁRIOS DE ABLAÇÃO (conforme aprovado)
========================================== */

const SCENARIOS: ScenarioParams[] = [
  {
    name: "A - Baseline atual",
    attackElasticity: OFFICIAL.ATTACK_ELASTICITY,
    defenseElasticity: OFFICIAL.DEFENSE_ELASTICITY,
    shrinkMultiplier: 1.0,
    dominanceEnabled: true
  },
  {
    name: "B - Elasticidades = 1",
    attackElasticity: 1.0,
    defenseElasticity: 1.0,
    shrinkMultiplier: 1.0,
    dominanceEnabled: true
  },
  {
    name: "C - Shrinkage 50% mais leve",
    attackElasticity: OFFICIAL.ATTACK_ELASTICITY,
    defenseElasticity: OFFICIAL.DEFENSE_ELASTICITY,
    shrinkMultiplier: 0.5,
    dominanceEnabled: true
  },
  {
    name: "D - Elasticidades=1 + shrinkage leve [PRINCIPAL]",
    attackElasticity: 1.0,
    defenseElasticity: 1.0,
    shrinkMultiplier: 0.5,
    dominanceEnabled: true
  },
  {
    name: "E - Apenas dominance neutralizado [DIAGNÓSTICO]",
    attackElasticity: OFFICIAL.ATTACK_ELASTICITY,
    defenseElasticity: OFFICIAL.DEFENSE_ELASTICITY,
    shrinkMultiplier: 1.0,
    dominanceEnabled: false
  }
];

/* ==========================================
   OS 9 JOGOS — PREENCHER ANTES DE RODAR
========================================== */

/*
 * 1 exemplo já preenchido e verificado (Celtic x Dundee,
 * confirmado batendo com o console real do sistema).
 *
 * Os outros 8 são placeholders — preencher copiando os
 * valores exatos de "LEAGUE BASES", "HOME/AWAY INPUT
 * RESOLUTION" e o painel de odds do console real.
 *
 * Categoria e lado favorito são calculados automaticamente
 * a partir da odd justa — não escolha manualmente, para
 * evitar viés de seleção.
 */

const GAMES: GameInput[] = [
  {
    label: "Celtic x Dundee (Escócia) - PARIDADE CONFIRMADA (0.00% diff)",
    leagueBaseHome: 1.32,
    leagueBaseAway: 1.23,
    leagueTeamBase: 1.275,
    leagueAdjustment: 1,
    homeMatches: 38,
    awayMatches: 38,
    inputQuality: 0.78,
    homeGoalsRate: 1.9,
    homeConcededRate: 1.1,
    awayGoalsRate: 1.1,
    awayConcededRate: 1.6,
    homeShotsOnTarget: 5.6,
    awayShotsOnTarget: 3.3,
    homeBigChances: 3.6,
    awayBigChances: 1.5,
    rho: -0.08,
    odds: { home: 1.11, draw: 9, away: 12 }
  },

  // TODO — jogo 2 (favorito extremo, visitante favorito)
  // {
  //   label: "",
  //   leagueBaseHome: 0, leagueBaseAway: 0, leagueTeamBase: 0, leagueAdjustment: 1,
  //   homeMatches: 0, awayMatches: 0, inputQuality: 0,
  //   homeGoalsRate: 0, homeConcededRate: 0, awayGoalsRate: 0, awayConcededRate: 0,
  //   rho: -0.08,
  //   odds: { home: 0, draw: 0, away: 0 }
  // },

  // TODO — jogo 3 (favorito extremo, liga de muitos gols)
  // TODO — jogo 4 (favorito moderado, mandante favorito)
  // TODO — jogo 5 (favorito moderado, visitante favorito)
  // TODO — jogo 6 (favorito moderado, liga de poucos gols)
  // TODO — jogo 7 (equilibrado, odds próximas)
  // TODO — jogo 8 (equilibrado, liga de muitos gols)
  // TODO — jogo 9 (equilibrado, liga de poucos gols)
];

/* ==========================================
   EXECUÇÃO
========================================== */

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* ==========================================
   EXPORTAÇÃO DE RESULTADOS
========================================== */

import * as fs from "fs";
import * as path from "path";

interface AblationRow {
  game: string;
  category: GameCategory;
  favoriteSide: FavoriteSide;
  scenario: string;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  HOME: number;
  DRAW: number;
  AWAY: number;
  OVER_1_5: number;
  OVER_2_5: number;
  BTTS_YES: number;

  oddHome: number;
  oddDraw: number;
  oddAway: number;

  impliedRawFavorite: number;
  fairMarketFavorite: number;

  gapVsFairMarket_pp: number;
  deltaVsBaseline_pp: number;
  modelAgreesWithMarketFavorite: boolean | null;

  homeAdaptiveShrinkFactor: number;
  awayAdaptiveShrinkFactor: number;
  homeAttackStrength: number;
  awayAttackStrength: number;
  homeDefensiveFragility: number;
  awayDefensiveFragility: number;
  homeDominanceFactor: number;
  awayDominanceFactor: number;
}

function toCsv(rows: AblationRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]) as Array<keyof AblationRow>;

  const escapeCell = (value: unknown): string => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(","))
  ];

  return lines.join("\n");
}

function exportResults(
  rows: AblationRow[],
  format: "csv" | "json" | "none",
  outDir: string
): void {
  if (format === "none") return;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "json") {
    const filePath = path.join(outDir, `lambda-ablation-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf-8");
    console.log(`\nResultados exportados para: ${filePath}`);
  }

  if (format === "csv") {
    const filePath = path.join(outDir, `lambda-ablation-${timestamp}.csv`);
    fs.writeFileSync(filePath, toCsv(rows), "utf-8");
    console.log(`\nResultados exportados para: ${filePath}`);
  }
}

/* ==========================================
   EXECUÇÃO — FUNÇÃO PRINCIPAL
========================================== */

export interface RunLambdaAblationOptions {
  /*
   * "none" (padrão) apenas imprime no console.
   * "csv" / "json" também gravam um arquivo em outDir.
   */
  export?: "csv" | "json" | "none";

  /*
   * Pasta de saída dos arquivos exportados.
   */
  outDir?: string;
}

export function runLambdaAblation(
  options: RunLambdaAblationOptions = {}
): AblationRow[] {
  const { export: exportFormat = "none", outDir = "./lambda-ablation-output" } =
    options;

  const allRows: AblationRow[] = [];

  for (const game of GAMES) {
    const market = fairMarketProbabilities(game.odds);
    const { category, favoriteSide } = classifyGame(
      market.fair.home,
      market.fair.away
    );

    console.log(`\n=== ${game.label} ===`);
    console.log(
      `Categoria: ${category} | Favorito: ${favoriteSide} | ` +
      `Overround: ${round(market.overround, 4)} | ` +
      `Mercado justo -> HOME ${round(market.fair.home * 100, 1)}% ` +
      `DRAW ${round(market.fair.draw * 100, 1)}% ` +
      `AWAY ${round(market.fair.away * 100, 1)}%`
    );

    let baselineFavoriteProb: number | null = null;

    for (const scenario of SCENARIOS) {
      const lambda = buildLambdaForScenario(game, scenario);
      const markets = calculateMarkets(
        lambda.lambdaHome,
        lambda.lambdaAway,
        game.rho
      );

      const favoriteModelProb =
        favoriteSide === "home"
          ? markets.home
          : favoriteSide === "away"
            ? markets.away
            : Math.max(markets.home, markets.away);

      const favoriteFairMarketProb =
        favoriteSide === "home"
          ? market.fair.home
          : favoriteSide === "away"
            ? market.fair.away
            : Math.max(market.fair.home, market.fair.away);

      const gapVsFairMarket = favoriteFairMarketProb - favoriteModelProb;

      const modelFavorsHome = markets.home > markets.away;
      const modelAgreesWithMarketFavorite =
        favoriteSide === "none"
          ? null
          : favoriteSide === "home"
            ? modelFavorsHome
            : !modelFavorsHome;

      if (scenario.name.startsWith("A")) {
        baselineFavoriteProb = favoriteModelProb;
      }

      const deltaVsBaseline =
        baselineFavoriteProb !== null
          ? favoriteModelProb - baselineFavoriteProb
          : 0;

      const row: AblationRow = {
        game: game.label,
        category,
        favoriteSide,
        scenario: scenario.name,

        lambdaHome: round(lambda.lambdaHome),
        lambdaAway: round(lambda.lambdaAway),
        totalLambda: round(lambda.totalLambda),

        HOME: round(markets.home * 100, 1),
        DRAW: round(markets.draw * 100, 1),
        AWAY: round(markets.away * 100, 1),
        OVER_1_5: round(markets.over15 * 100, 1),
        OVER_2_5: round(markets.over25 * 100, 1),
        BTTS_YES: round(markets.bttsYes * 100, 1),

        oddHome: game.odds.home,
        oddDraw: game.odds.draw,
        oddAway: game.odds.away,

        impliedRawFavorite: round(
          (favoriteSide === "home"
            ? market.impliedRaw.home
            : market.impliedRaw.away) * 100,
          1
        ),

        fairMarketFavorite: round(favoriteFairMarketProb * 100, 1),

        gapVsFairMarket_pp: round(gapVsFairMarket * 100, 1),
        deltaVsBaseline_pp: round(deltaVsBaseline * 100, 1),
        modelAgreesWithMarketFavorite,

        homeAdaptiveShrinkFactor: round(lambda.homeAdaptiveShrinkFactor, 2),
        awayAdaptiveShrinkFactor: round(lambda.awayAdaptiveShrinkFactor, 2),
        homeAttackStrength: round(lambda.homeAttackStrength),
        awayAttackStrength: round(lambda.awayAttackStrength),
        homeDefensiveFragility: round(lambda.homeDefensiveFragility),
        awayDefensiveFragility: round(lambda.awayDefensiveFragility),
        homeDominanceFactor: round(lambda.homeDominanceFactor),
        awayDominanceFactor: round(lambda.awayDominanceFactor)
      };

      allRows.push(row);

      console.log(
        `  ${scenario.name.padEnd(48)} ` +
        `λH=${row.lambdaHome} λA=${row.lambdaAway} | ` +
        `Favorito modelo=${row.HOME >= row.AWAY ? row.HOME : row.AWAY}% | ` +
        `gap vs justa=${row.gapVsFairMarket_pp}pp | ` +
        `Δ vs baseline=${row.deltaVsBaseline_pp}pp`
      );
    }
  }

  /* ========================================
     RESUMO AGREGADO POR CATEGORIA
  ======================================== */

  console.log("\n\n=== RESUMO AGREGADO (cenário D vs baseline A) ===");

  const categories: GameCategory[] = [
    "extreme_favorite",
    "moderate_favorite",
    "balanced"
  ];

  for (const category of categories) {
    const rowsD = allRows.filter(
      r => r.category === category && r.scenario.startsWith("D")
    );

    if (rowsD.length === 0) continue;

    const avgDelta =
      rowsD.reduce((sum, r) => sum + r.deltaVsBaseline_pp, 0) / rowsD.length;

    /*
     * Bias, MAE, RMSE — calculados sobre o gap (mercado
     * justo - modelo) do lado favorito, por categoria.
     * Bias positivo = modelo sistematicamente abaixo do
     * mercado (subestimando o favorito).
     */
    function biasMaeRmse(rows: AblationRow[]) {
      const gaps = rows.map(r => r.gapVsFairMarket_pp);
      const bias = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const mae = gaps.reduce((s, g) => s + Math.abs(g), 0) / gaps.length;
      const rmse = Math.sqrt(
        gaps.reduce((s, g) => s + g * g, 0) / gaps.length
      );
      return { bias, mae, rmse };
    }

    const rowsA = allRows.filter(
      r => r.category === category && r.scenario.startsWith("A")
    );

    const statsA = biasMaeRmse(rowsA);
    const statsD = biasMaeRmse(rowsD);

    const agreementRateD =
      rowsD.filter(r => r.modelAgreesWithMarketFavorite === true).length /
      rowsD.length;

    console.log(
      `${category.padEnd(20)} | jogos=${rowsD.length} | ` +
      `Δ médio cenário D=${round(avgDelta, 2)}pp`
    );
    console.log(
      `  Baseline (A): bias=${round(statsA.bias,2)}pp MAE=${round(statsA.mae,2)}pp RMSE=${round(statsA.rmse,2)}pp`
    );
    console.log(
      `  Cenário D:    bias=${round(statsD.bias,2)}pp MAE=${round(statsD.mae,2)}pp RMSE=${round(statsD.rmse,2)}pp`
    );
    console.log(
      `  Concordância modelo/mercado sobre favorito (D): ${round(agreementRateD*100,1)}%`
    );
  }

  console.log(
    "\nAVISO: com apenas 1 jogo preenchido, este resumo NÃO é " +
    "estatisticamente válido. Preencha os 9 jogos antes de tirar " +
    "qualquer conclusão."
  );

  exportResults(allRows, exportFormat, outDir);

  return allRows;
}

/* ==========================================
   PONTO DE ENTRADA MANUAL
========================================== */

/*
 * Este arquivo só executa quando chamado diretamente
 * por linha de comando (npx tsx scripts/lambdaAblation.ts).
 *
 * Ele é seguro contra execução acidental porque nenhum
 * arquivo dentro de src/ (nem eliteAnalyzer.ts, nem
 * nenhum pipeline oficial) importa nada deste arquivo —
 * ele nunca é puxado durante `npm run dev` ou build.
 *
 * A chamada abaixo é intencionalmente incondicional:
 * detectar "é execução direta?" de forma confiável exige
 * lógica diferente dependendo de o runner ser CommonJS
 * (ts-node) ou ESM (tsx, que roda .ts como ESM puro por
 * padrão, onde `require` nem existe). Tentar cobrir os
 * dois casos com require.main/import.meta causava falha
 * silenciosa sob tsx. Como o isolamento real já vem de
 * este arquivo nunca ser importado por src/, a checagem
 * extra era redundante e frágil — foi removida.
 *
 * Execução manual:
 *
 *   npx tsx scripts/lambdaAblation.ts
 *   npx tsx scripts/lambdaAblation.ts --export=json
 *   npx tsx scripts/lambdaAblation.ts --export=csv
 */

const args = process.argv.slice(2);
const exportArg = args.find(a => a.startsWith("--export="));
const exportFormat =
  (exportArg?.split("=")[1] as "csv" | "json" | undefined) ?? "none";

runLambdaAblation({ export: exportFormat });