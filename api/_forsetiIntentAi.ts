// Chamada à IA que entende a frase e devolve só a INTENÇÃO (uma da lista fechada), mais registro, memória ou gasto quando a frase traz.
// Compartilhada por api/forseti-intent.ts e pela avaliação em evals/forseti-intent: os dois exercitam o mesmo prompt e o mesmo parse.
// Não recebe nem devolve dados financeiros. O prefixo "_" mantém este arquivo fora das rotas da Vercel (como _access.ts).
import { type MemoryDraft, parseMemory } from '../src/utils/forsetiMemory.js';
import { FORSETI_INTENTS, SPEND_PERIODS, type ForsetiRegistration, type ForsetiSpendQuery, isForsetiIntent, isSpendPeriod, parseRegistration, parseSpendQuery } from '../src/utils/forsetiIntents.js';

/** Modelo padrão. Para trocar (ou voltar) sem novo deploy, defina FORSETI_INTENT_MODEL na Vercel, por exemplo claude-haiku-5-5. */
export const MODEL = 'claude-haiku-4-5-20251001';
export const modelInUse = () => process.env.FORSETI_INTENT_MODEL?.trim() || MODEL;

export interface IntentAnswer {
  intent: string;
  period?: string;
  registration?: ForsetiRegistration;
  memory?: MemoryDraft;
  spend?: ForsetiSpendQuery;
}

export interface IntentUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

const SYSTEM = `Você classifica mensagens de um app de finanças pessoais em português do Brasil.
Escolha a intenção que melhor representa o que a pessoa quer VER ou SABER. Intenções:
- SALDO_HOJE: saldo atual / quanto tem agora
- PROXIMO_RECEB: quando entra o próximo dinheiro/salário
- SOBRA: quanto ainda pode gastar / o que vai sobrar
- VENCE: contas a vencer, atrasadas, próximos vencimentos
- GASTEI: quanto já gastou no mês
- CAIU: por que o saldo previsto está baixo/caiu
- RESERVA: reserva de emergência
- METAS: metas financeiras
- COMPRA: se dá para comprar/financiar algo
- QUITAR: quitar ou antecipar empréstimo/parcelas
- COMO_FUNCIONA: o que a assistente faz / ajuda
- GLOSSARIO: significado de um termo (natureza, mapeamento, competência...)
- ULTIMAS: últimas compras/gastos/saídas feitas
- GASTOS_PERIODO: gastos de um período (informe period: HOJE, SEMANA, QUINZENA ou MES)
- GASTOS_DETALHE: gastos com um assunto específico (natureza, loja, pessoa, produto) e/ou de um período específico (mês pelo nome,
  mês passado, semana passada, últimos N dias, ano). Preencha "spend": subject = só o assunto, sem datas (vazio se for o total);
  from e to = AAAA-MM-DD do período, quando a frase disser (use "hoje" do contexto); sem período, omita from e to.
- PREVISTO_REAL: o que estava previsto e não foi registrado/pago, ou foi pago a menos que o previsto
- SEM_NATUREZA: o que há dentro de "Outros" / gastos sem natureza
- DESCONHECIDO: qualquer outra coisa ou conversa fora do tema.
REGISTRO: quando a pessoa CONTA um gasto, pagamento, transferência/Pix ou recebimento com valor (não pergunta), responda intent DESCONHECIDO e
preencha "registration":
- kind: PAGAR (saiu dinheiro: gasto, compra, conta paga, Pix/transferência para alguém) ou RECEBER (entrou dinheiro; "me pagou", "me mandou" também).
- amount: valor em reais como número ("cem reais" → 100, "1,5 mil" → 1500, "R$ 30" → 30).
- title: o que foi ou para quem, curto e sem valor nem forma de pagamento ("Mercado", "Pix para minha sogra", "Freela"). Vazio se não disser.
- future: true se ainda vai acontecer (agendado, "vou pagar", "vou receber"); false se já aconteceu.
- date: AAAA-MM-DD só se a frase disser o dia (use "hoje" do contexto para "amanhã", "dia 12"…).
Pergunta ("quanto gastei…?") nunca é registro. Sem valor na frase, não é registro.
MEMÓRIA: quando a pessoa CONTA algo duradouro sobre si ou sobre como lida com dinheiro (preferência, restrição, prioridade ou contexto
familiar), sem pedir nada e sem registrar um gasto, responda intent DESCONHECIDO e preencha "memory":
- kind: PREFERENCIA, RESTRICAO, CONTEXTO ou PRIORIDADE.
- title: curto (até 60 caracteres). body: uma frase, nas palavras da pessoa (até 200 caracteres).
NUNCA coloque em memory valores em reais, números de documento, conta ou cartão, e-mails ou links: se a frase tiver algum, omita memory.
Um gasto ou recebimento pontual é registration, nunca memory. Pergunta nunca é memory.
Se vier "contexto" (assunto da resposta anterior), frases curtas ou incompletas, SEM assunto próprio, continuam esse assunto
(ex.: contexto GASTOS_PERIODO e a frase "me mostre os dessa semana" → GASTOS_PERIODO com period SEMANA).
Se a frase trouxer um assunto novo (salário, metas, fatura, empréstimo, registrar algo…), IGNORE o contexto e classifique só a frase.
Na dúvida entre continuar e mudar de assunto, responda DESCONHECIDO: é melhor perguntar do que adivinhar.
Nunca responda à pessoa; apenas classifique.`;

const TOOLS = [
    {
      name: 'classificar',
      description: 'Registra a intenção da mensagem',
      input_schema: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: [...FORSETI_INTENTS, 'DESCONHECIDO'] },
          period: { type: 'string', enum: [...SPEND_PERIODS] },
          spend: {
            type: 'object',
            properties: { subject: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } },
            required: ['subject'],
          },
          memory: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['PREFERENCIA', 'RESTRICAO', 'CONTEXTO', 'PRIORIDADE'] },
              title: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['kind', 'body'],
          },
          registration: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['PAGAR', 'RECEBER'] },
              amount: { type: 'number' },
              title: { type: 'string' },
              future: { type: 'boolean' },
              date: { type: 'string' },
            },
            required: ['kind', 'amount'],
          },
        },
        required: ['intent'],
      },
    },
];

export type ClassifyResult =
  | { ok: true; answer: IntentAnswer; model: string; usage?: IntentUsage; stopReason?: string }
  | { ok: false; status: number };

/** Pergunta à IA qual é a intenção da frase. `day` (AAAA-MM-DD) é o "hoje" que ela usa para entender "amanhã" e "dia 12". */
export async function classify(args: { key: string; text: string; context: string; day: string; model?: string }): Promise<ClassifyResult> {
  const { key, text, context, day, model = modelInUse() } = args;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      // Folga para o tokenizador da Haiku 5.5 (~30% mais tokens): uma resposta cortada vira "DESCONHECIDO" sem aviso
      max_tokens: 400,
      // O prefixo (ferramentas + prompt) é o mesmo em toda chamada: o cache corta o custo e a latência dele. Abaixo do mínimo do
      // modelo (4.096 tokens na Haiku 4.5, 512 na 5.5) a API ignora o marcador, sem erro.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      tool_choice: { type: 'tool', name: 'classificar' },
      messages: [{ role: 'user', content: `hoje: ${day}\n${context ? `contexto: ${context}\n` : ''}frase: ${text}` }],
    }),
  });
  if (!res.ok) return { ok: false, status: res.status };

  const data = (await res.json()) as {
    model?: string;
    stop_reason?: string;
    usage?: IntentUsage;
    content?: { type: string; input?: { intent?: string; period?: string; registration?: unknown; memory?: unknown; spend?: unknown } }[];
  };
  const input = data.content?.find((c) => c.type === 'tool_use')?.input;
  const intent = isForsetiIntent(input?.intent) ? input!.intent : 'DESCONHECIDO';
  const period = isSpendPeriod(input?.period) ? input!.period : undefined;
  // Registro só vale com "DESCONHECIDO": uma frase não é consulta e registro ao mesmo tempo
  const registration = intent === 'DESCONHECIDO' ? parseRegistration(input?.registration) : undefined;
  // Memória também só vale com "DESCONHECIDO" e sem registro; passa pelo mesmo filtro de dado sensível do aplicativo
  const memory = intent === 'DESCONHECIDO' && !registration ? parseMemory(input?.memory) : undefined;
  const spend = intent === 'GASTOS_DETALHE' ? parseSpendQuery(input?.spend) : undefined;
  const answer: IntentAnswer = { intent, period, ...(registration ? { registration } : {}), ...(memory ? { memory } : {}), ...(spend ? { spend } : {}) };
  return { ok: true, answer, model: data.model ?? model, usage: data.usage, stopReason: data.stop_reason };
}
