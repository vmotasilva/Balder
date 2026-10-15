import type { ForecastEntry, ForecastPeriod, ForecastWindow } from './forecastWindow';
import { type ForsetiMemory, focusFromMemories } from './forsetiMemory';
import { brl, ddmm, isoDay, stripAccents } from './forsetiMoney';

/**
 * Briefing do dia da Forseti ("Bom dia"): um resumo curto do que pede atenção hoje, montado só com os números
 * do planejamento. Não usa IA: é regra pura, então funciona offline, para visitante e sem custo.
 */

/** O que o briefing precisa do planejamento (`ForsetiData` já cumpre este formato). */
export interface DigestInput {
  availableBalance: number;
  forecasts: Record<ForecastPeriod, ForecastWindow>;
  /** O que a pessoa pediu para a Forseti lembrar: dá a linha de foco do dia. */
  memories?: ForsetiMemory[];
}

export type DigestTone = 'alert' | 'info' | 'ok';

export interface DigestItem {
  tone: DigestTone;
  text: string;
}

export interface Digest {
  greeting: string;
  items: DigestItem[];
  /** Briefing completo em texto (saudação + tópicos), no formato das respostas da Forseti. */
  text: string;
}

/** Quantos lançamentos de cada tipo aparecem por extenso antes do "…e mais N". */
const MAX_LISTED = 4;
/** Janela dos próximos vencimentos (dias além de hoje). */
const SOON_DAYS = 3;
/** Janela dos próximos recebimentos (dias além de hoje). */
const INCOME_DAYS = 7;

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const greetingFor = (hour: number) => (hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite');

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sum = (entries: ForecastEntry[]) => entries.reduce((a, e) => a + e.amount, 0);

/** "• 16/10 · Aluguel: R$ 1.500,00" com no máximo `MAX_LISTED` linhas. */
function listEntries(entries: ForecastEntry[], withDate: boolean): string {
  const shown = entries.slice(0, MAX_LISTED).map((e) => `${withDate ? `${ddmm(e.date)} · ` : ''}${e.title} (${brl(e.amount)})`);
  const rest = entries.length - shown.length;
  return `${shown.join('; ')}${rest > 0 ? `; e mais ${rest}` : ''}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Monta o briefing de hoje. `name` entra na saudação quando a pessoa já é conhecida. */
export function buildDigest(input: DigestInput, today: Date = new Date(), name?: string): Digest {
  const todayIso = isoDay(today);
  const soonEnd = isoDay(addDays(today, SOON_DAYS));
  const incomeEnd = isoDay(addDays(today, INCOME_DAYS));
  const entries = input.forecasts.DIAS_30.entries;
  const month = input.forecasts.MES;

  const out = entries.filter((e) => e.kind === 'SAIDA');
  const inc = entries.filter((e) => e.kind === 'ENTRADA');
  const overdueOut = out.filter((e) => e.overdue);
  const overdueIn = inc.filter((e) => e.overdue);
  const dueToday = out.filter((e) => !e.overdue && e.date === todayIso);
  const dueSoon = out.filter((e) => !e.overdue && e.date > todayIso && e.date <= soonEnd);
  const incomeToday = inc.filter((e) => !e.overdue && e.date === todayIso);
  const incomeSoon = inc.filter((e) => !e.overdue && e.date > todayIso && e.date <= incomeEnd);

  const items: DigestItem[] = [];

  if (overdueOut.length > 0) {
    items.push({
      tone: 'alert',
      text: `⚠️ **${overdueOut.length} ${plural(overdueOut.length, 'conta em atraso', 'contas em atraso')}** (${brl(sum(overdueOut))}): ${listEntries(overdueOut, true)}.`,
    });
  }
  if (dueToday.length > 0) {
    items.push({ tone: 'alert', text: `📅 **Vence hoje** (${brl(sum(dueToday))}): ${listEntries(dueToday, false)}.` });
  }
  if (dueSoon.length > 0) {
    items.push({ tone: 'info', text: `🔜 **Nos próximos ${SOON_DAYS} dias** (${brl(sum(dueSoon))}): ${listEntries(dueSoon, true)}.` });
  }
  if (overdueIn.length > 0) {
    items.push({
      tone: 'info',
      text: `⏳ **Era para ter entrado** (${brl(sum(overdueIn))}): ${listEntries(overdueIn, true)}. Se já caiu, confirme para o saldo ficar certo.`,
    });
  }
  if (incomeToday.length > 0) {
    items.push({ tone: 'ok', text: `💰 **Entra hoje** (${brl(sum(incomeToday))}): ${listEntries(incomeToday, false)}.` });
  }
  if (incomeSoon.length > 0) {
    items.push({ tone: 'ok', text: `📥 **Próximos recebimentos** (${brl(sum(incomeSoon))}): ${listEntries(incomeSoon, true)}.` });
  }

  items.push({ tone: 'info', text: `💼 **Saldo hoje:** ${brl(input.availableBalance)}.` });

  // Sobra do mês: só vale como aviso quando fica negativa; positiva é informação
  const free = month.projectedBalance;
  if (free < 0) {
    items.push({
      tone: 'alert',
      text: `🚨 Com o que está previsto, **faltam ${brl(Math.abs(free))}** até o fim do mês (${ddmm(month.toDate)}). Vale rever o que ainda vai pagar.`,
    });
  } else {
    items.push({ tone: 'ok', text: `✅ Se tudo o que está previsto acontecer, **sobram ${brl(free)}** até o fim do mês (${ddmm(month.toDate)}).` });
  }

  const focus = focusFromMemories(input.memories, today);
  if (focus) items.push({ tone: 'info', text: `🎯 ${focus}.` });

  const quiet = overdueOut.length + dueToday.length + dueSoon.length + overdueIn.length === 0;
  if (quiet) items.unshift({ tone: 'ok', text: '😌 Dia tranquilo: nada em atraso nem vencendo nos próximos dias.' });

  const first = name?.trim().split(/\s+/)[0];
  const greeting = `${greetingFor(today.getHours())}${first ? `, ${first}` : ''}!`;
  const date = `${WEEKDAYS[today.getDay()]}, ${ddmm(todayIso)}`;
  const text = [`☀️ **${greeting}** Hoje é ${date}. Seu resumo:`, ...items.map((i) => `• ${i.text}`)].join('\n');
  return { greeting, items, text };
}

/**
 * Versão curta do briefing para a Central de notificações: uma linha com o que não aparece em outro aviso
 * (contas e saldo negativo já têm os seus): saldo, recebimentos, sobra do mês e o foco do dia.
 */
export function compactDigest(input: DigestInput, today: Date = new Date(), name?: string): { title: string; description: string } {
  const todayIso = isoDay(today);
  const month = input.forecasts.MES;
  const incoming = input.forecasts.DIAS_30.entries.filter((e) => e.kind === 'ENTRADA' && !e.overdue && e.date >= todayIso);
  const incomeToday = incoming.filter((e) => e.date === todayIso);
  const nextIncome = incoming.find((e) => e.date > todayIso);

  const parts = [`Saldo ${brl(input.availableBalance)}.`];
  if (incomeToday.length > 0) parts.push(`Entra hoje ${brl(sum(incomeToday))}.`);
  else if (nextIncome) parts.push(`Próximo recebimento: ${ddmm(nextIncome.date)} (${brl(nextIncome.amount)}).`);
  // Com o saldo de 30 dias negativo o aviso próprio já fala do risco: dizer "sobram" aqui contradiria
  if (input.forecasts.DIAS_30.projectedBalance >= 0) {
    const free = month.projectedBalance;
    parts.push(free < 0 ? `Faltam ${brl(Math.abs(free))} até ${ddmm(month.toDate)}.` : `Sobram ${brl(free)} até ${ddmm(month.toDate)}.`);
  }
  const focus = focusFromMemories(input.memories, today);
  if (focus) parts.push(`${focus}.`);

  const first = name?.trim().split(/\s+/)[0];
  return { title: `${greetingFor(today.getHours())}${first ? `, ${first}` : ''}: seu resumo do dia`, description: parts.join(' ') };
}

/**
 * A frase pede o briefing? Só o cumprimento sozinho ("bom dia") ou um pedido de resumo do dia:
 * "bom dia, paguei 50 no mercado" é um registro e segue o fluxo normal.
 */
export function isDigestRequest(text: string): boolean {
  const t = stripAccents(text)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^((oi|ola|e ai|opa) )?(bom dia|boa tarde|boa noite)( (forseti|assistente))?$/.test(t)) return true;
  return /^(resumo|briefing|panorama)$/.test(t) ||
    /^(me )?(da|faz|mostra|mostre|quero) (o |um |meu )?(resumo|briefing|panorama)( (do|de) (meu )?(dia|hoje))?$/.test(t) ||
    /^(resumo|briefing|panorama) (do|de) (meu )?(dia|hoje)$/.test(t) ||
    /^(como (esta|ta) (o )?(meu )?dia|meu dia|o que (tem|tenho) (pra|para) hoje)$/.test(t);
}
