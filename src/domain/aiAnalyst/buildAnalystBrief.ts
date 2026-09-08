/*
 * Gera o texto que o usuário cola numa conversa com uma IA
 * (esta mesma, ou Claude web) para obter uma leitura discricionária
 * da partida — o método que ele descreveu: comparar os últimos
 * jogos de cada time em casa/fora, checar desfalques, comparar as
 * equipes e só então ler o quadro de odds da casa de apostas.
 *
 * Este módulo NÃO chama nenhuma IA e NÃO decide nada sozinho — só
 * monta o prompt e depois formata a resposta colada de volta pelo
 * usuário como um Bet (ver ui/AiAnalystPanel.tsx). Não existe
 * integração de API de LLM no app: a "inteligência" é o próprio
 * usuário colando a análise numa conversa e trazendo o resultado
 * de volta.
 */

export interface AnalystBriefOdds {
  home?: number;
  draw?: number;
  away?: number;

  over15?: number;
  over25?: number;

  under15?: number;
  under25?: number;

  bttsYes?: number;
  bttsNo?: number;

  homeOrDraw?: number;
  awayOrDraw?: number;

  dnbHome?: number;
  dnbAway?: number;
}

export interface AnalystBriefQuantMarket {
  market: string;
  probability?: number;
  odd?: number;
  ev?: number;
  classification?: string;
}

export interface AnalystBriefInput {
  match: {
    home: string;
    away: string;
    league?: string;
  };

  odds: AnalystBriefOdds;

  recentForm: {
    home: string;
    away: string;
  };

  injuries: {
    home: string;
    away: string;
  };

  quantSummary?: AnalystBriefQuantMarket[];
}

const ODDS_LABELS: Record<
  keyof AnalystBriefOdds,
  string
> = {
  home: "Casa (1)",
  draw: "Empate (X)",
  away: "Fora (2)",

  over15: "Over 1.5",
  over25: "Over 2.5",

  under15: "Under 1.5",
  under25: "Under 2.5",

  bttsYes: "Ambas marcam - Sim",
  bttsNo: "Ambas marcam - Não",

  homeOrDraw: "Dupla chance 1X",
  awayOrDraw: "Dupla chance X2",

  dnbHome: "Empate anula - Casa",
  dnbAway: "Empate anula - Fora"
};

function formatOddsBoard(
  odds: AnalystBriefOdds
): string {
  const lines = (
    Object.keys(
      ODDS_LABELS
    ) as Array<keyof AnalystBriefOdds>
  )
    .filter(key => typeof odds[key] === "number" && Number.isFinite(odds[key]))
    .map(key => `- ${ODDS_LABELS[key]}: ${odds[key]!.toFixed(2)}`);

  return lines.length > 0
    ? lines.join("\n")
    : "(nenhuma odd informada)";
}

function formatQuantSummary(
  quantSummary?: AnalystBriefQuantMarket[]
): string {
  if (!quantSummary || quantSummary.length === 0) {
    return "(motor quantitativo ainda não rodou para esta partida, ou não retornou mercados)";
  }

  return quantSummary
    .map(entry => {
      const probability =
        typeof entry.probability === "number"
          ? `${(entry.probability * 100).toFixed(1)}%`
          : "?";

      const odd =
        typeof entry.odd === "number"
          ? entry.odd.toFixed(2)
          : "?";

      const ev =
        typeof entry.ev === "number"
          ? entry.ev.toFixed(3)
          : "?";

      return `- ${entry.market}: prob. modelo ${probability} | odd ${odd} | EV ${ev}${
        entry.classification ? ` | ${entry.classification}` : ""
      }`;
    })
    .join("\n");
}

export function buildAnalystBrief(
  input: AnalystBriefInput
): string {
  const {
    match,
    odds,
    recentForm,
    injuries,
    quantSummary
  } = input;

  return `Você é um apostador profissional de futebol. Sua tarefa é analisar UMA partida específica e recomendar a entrada mais viável (ou dizer explicitamente que não há entrada com valor, se for o caso).

PARTIDA: ${match.home} x ${match.away}${match.league ? ` (${match.league})` : ""}

== ÚLTIMOS JOGOS — ${match.home} (mandante) ==
${recentForm.home || "(não informado)"}

== ÚLTIMOS JOGOS — ${match.away} (visitante) ==
${recentForm.away || "(não informado)"}

== DESFALQUES / LESÕES / SUSPENSÕES ==
${match.home}: ${injuries.home || "(nenhum informado)"}
${match.away}: ${injuries.away || "(nenhum informado)"}

== QUADRO DE ODDS (casa de apostas) ==
${formatOddsBoard(odds)}

== REFERÊNCIA: SAÍDA DO MOTOR QUANTITATIVO DO APP (contexto, não é veredito) ==
${formatQuantSummary(quantSummary)}

O QUE FAZER:
1. Compare as duas equipes: forma recente com peso maior para jogos em casa (mandante) e fora (visitante) separadamente — não misture os dois.
2. Avalie o impacto real dos desfalques listados (titular vs reserva, posição-chave como zagueiro/goleiro/artilheiro pesa mais).
3. Cruze essa leitura com o quadro de odds: onde a odds do mercado parece estar errada em relação ao que você observou nos times?
4. Considere a saída do motor quantitativo como um segundo ponto de vista, não como resposta pronta — discorde dela explicitamente se a leitura qualitativa (desfalques, contexto, forma recente) apontar outra direção.
5. "Sem entrada" é uma resposta válida e preferível a forçar uma aposta sem valor real.

RESPONDA NESTE FORMATO:
- Mercado recomendado: (ou "sem entrada")
- Odd observada:
- Probabilidade estimada por você (%):
- Stake sugerido (% da banca, conservador, ex: 1-3%):
- Justificativa (curta, direto ao ponto, citando o que pesou mais na decisão):
- Principal risco que invalidaria essa entrada:`;
}
