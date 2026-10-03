// Função do servidor (Vercel): entende a frase da pessoa e devolve só a INTENÇÃO (uma da lista fechada).
// Não recebe nem devolve dados financeiros: a resposta com números é montada no aplicativo.
// Precisa da variável ANTHROPIC_API_KEY na Vercel; sem ela responde 501 e a Forseti segue só com as regras.
import { FORSETI_INTENTS, SPEND_PERIODS, isForsetiIntent, isSpendPeriod } from '../src/utils/forsetiIntents.js';

const MODEL = 'claude-haiku-4-5-20251001';

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
- PREVISTO_REAL: o que estava previsto e não foi registrado/pago, ou foi pago a menos que o previsto
- SEM_NATUREZA: o que há dentro de "Outros" / gastos sem natureza
- DESCONHECIDO: qualquer outra coisa, ou registrar/lançar algo, ou conversa fora do tema.
Nunca responda à pessoa; apenas classifique.`;

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'sem chave' }, { status: 501 });

  let text = '';
  try {
    text = String((await request.json()).text || '').slice(0, 300).trim();
  } catch {
    return Response.json({ error: 'corpo inválido' }, { status: 400 });
  }
  if (!text) return Response.json({ intent: 'DESCONHECIDO' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 100,
      system: SYSTEM,
      tools: [
        {
          name: 'classificar',
          description: 'Registra a intenção da mensagem',
          input_schema: {
            type: 'object',
            properties: {
              intent: { type: 'string', enum: [...FORSETI_INTENTS, 'DESCONHECIDO'] },
              period: { type: 'string', enum: [...SPEND_PERIODS] },
            },
            required: ['intent'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classificar' },
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) return Response.json({ error: 'falha na IA' }, { status: 502 });

  const data = (await res.json()) as { content?: { type: string; input?: { intent?: string; period?: string } }[] };
  const input = data.content?.find((c) => c.type === 'tool_use')?.input;
  const intent = isForsetiIntent(input?.intent) ? input!.intent : 'DESCONHECIDO';
  const period = isSpendPeriod(input?.period) ? input!.period : undefined;
  return Response.json({ intent, period }, { headers: { 'Cache-Control': 'no-store' } });
}
