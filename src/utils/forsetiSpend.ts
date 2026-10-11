import type { ExpenseNature, Movement } from '../types';
import { brl, ddmm, isIncomeMovement, isoDay, outflowDate, outflowValue, stripAccents } from './forsetiMoney';
import { resolveMovementNatureId } from './movementNature';
import { trackingPeriodRange } from './periodSpending';

/**
 * Perguntas de gastos com detalhe: "quanto gastei com mercado em setembro?", "gastos de farmácia no mês passado",
 * "e com uber?". A frase traz um assunto (natureza, loja, pessoa) e/ou um período; a resposta é calculada aqui
 * com os lançamentos já pagos. A IA só ajuda a ler a frase (assunto e datas): os números são sempre calculados no app.
 */

export interface SpendRange {
  from: string; // AAAA-MM-DD (inclusive)
  to: string;
  /** Como a resposta chama o período: "de setembro", "do mês passado", "dos últimos 30 dias"… */
  label: string;
}

export interface SpendQuery {
  /** O assunto, sem datas e sem acentos, para procurar ("mercado", "uber"); vazio = todos os gastos. */
  subject: string;
  /** O mesmo assunto como a pessoa escreveu (com acentos), para mostrar na resposta. */
  shown?: string;
  /** Sem período, vale o mês atual. */
  range?: SpendRange;
}

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NO_NATURE = 'Sem natureza';

const day = (y: number, m: number, d: number) => isoDay(new Date(y, m, d));
const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const shiftDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
};

/** Mês inteiro (0 = janeiro) como período, com o nome no rótulo ("de setembro", "de setembro de 2025"). */
export function monthRange(year: number, month: number, today: Date = new Date()): SpendRange {
  return {
    from: day(year, month, 1),
    to: day(year, month, lastDayOf(year, month)),
    label: `de ${MONTH_LABELS[month]}${year !== today.getFullYear() ? ` de ${year}` : ''}`,
  };
}

/** Rótulo de um período vindo da IA (datas livres): mês inteiro vira "de setembro"; o resto, "de 01/09 a 15/09". */
export function describeRange(from: string, to: string, today: Date = new Date()): SpendRange {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  if (fd === 1 && fy === ty && fm === tm && to === day(ty, tm - 1, lastDayOf(ty, tm - 1))) return monthRange(fy, fm - 1, today);
  if (from === to) return { from, to, label: `em ${ddmm(from)}` };
  return { from, to, label: `de ${ddmm(from)} a ${ddmm(to)}` };
}

/** Rótulos dos períodos que as respostas por período (semana, quinzena, mês) já cobrem sem detalhe. */
const CURRENT_LABELS = ['hoje', 'desta semana', 'desta quinzena', 'deste mês'];

/**
 * Período citado na frase: hoje, ontem, esta semana, semana passada, quinzena, este mês, mês passado,
 * um mês pelo nome ("em setembro", "setembro de 2025"), "últimos 30 dias", este ano, ano passado.
 */
export function parseSpendRange(text: string, today: Date = new Date()): SpendRange | null {
  const t = stripAccents(text);
  const todayIso = isoDay(today);
  if (/\bhoje\b/.test(t)) return { from: todayIso, to: todayIso, label: 'hoje' };
  if (/\bontem\b/.test(t)) {
    const y = shiftDays(todayIso, -1);
    return { from: y, to: y, label: 'ontem' };
  }
  const lastDays = t.match(/\bultimos?\s+(\d{1,3})\s+dias\b/);
  if (lastDays && Number(lastDays[1]) >= 1) return { from: shiftDays(todayIso, -(Number(lastDays[1]) - 1)), to: todayIso, label: `dos últimos ${Number(lastDays[1])} dias` };
  if (/\bsemana\s+(passada|anterior)\b|\bultima semana\b/.test(t)) {
    const w = trackingPeriodRange('SEMANA', today);
    return { from: shiftDays(w.from, -7), to: shiftDays(w.to, -7), label: 'da semana passada' };
  }
  if (/\bmes\s+(passado|anterior)\b|\bultimo mes\b/.test(t)) return previousMonth(today);
  if (/\bano\s+(passado|anterior)\b/.test(t)) {
    const y = today.getFullYear() - 1;
    return { from: day(y, 0, 1), to: day(y, 11, 31), label: 'do ano passado' };
  }
  if (/\b(este|neste|nesse|esse|no)\s+ano\b|\bdeste ano\b/.test(t)) {
    const y = today.getFullYear();
    return { from: day(y, 0, 1), to: day(y, 11, 31), label: 'deste ano' };
  }
  const named = t.match(new RegExp(`\\b(${MONTHS.join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`));
  if (named) {
    const month = MONTHS.indexOf(named[1]);
    // Sem ano: o mês mais recente que já começou (em outubro, "setembro" é este ano e "novembro" é o do ano passado)
    const year = named[2] ? Number(named[2]) : month <= today.getMonth() ? today.getFullYear() : today.getFullYear() - 1;
    return monthRange(year, month, today);
  }
  if (/\bquinzena\b/.test(t)) return { ...trackingPeriodRange('QUINZENA', today), label: 'desta quinzena' };
  if (/\bsemana\b/.test(t)) return { ...trackingPeriodRange('SEMANA', today), label: 'desta semana' };
  if (/\b(mes|mensal)\b/.test(t)) return { ...trackingPeriodRange('MES', today), label: 'deste mês' };
  return null;
}

const previousMonth = (today: Date): SpendRange => {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return { ...monthRange(d.getFullYear(), d.getMonth(), today), label: 'do mês passado' };
};

// Palavras que não são o assunto: perguntas, verbos de gasto, ligações, e o vocabulário de período
const STOP = new Set([
  'quanto', 'quantos', 'quantas', 'qual', 'quais', 'que', 'foi', 'fui', 'eu', 'me', 'meu', 'meus', 'minha', 'minhas', 'nosso', 'nossos',
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'pra', 'por',
  'e', 'ou', 'ja', 'ainda', 'agora', 'total', 'valor', 'valores', 'tudo', 'todo', 'toda', 'todos', 'todas', 'so', 'apenas', 'ate', 'ver', 'mostre',
  'mostra', 'mostrar', 'quero', 'saber', 'tive', 'tenho', 'fiz', 'teve', 'houve', 'foram', 'sao', 'esta', 'este', 'esse', 'essa', 'neste', 'nesta',
  'nesse', 'nessa', 'desta', 'deste', 'desse', 'dessa', 'ha', 'isso', 'isto', 'tanto', 'tanta', 'muito', 'muita', 'pouco', 'demais',
  'bastante', 'mais', 'menos', 'porque', 'pq', 'posso', 'consigo', 'devo', 'pode', 'podemos', 'vou', 'vai',
  'gasto', 'gastos', 'gastei', 'gastou', 'gastamos', 'gastar', 'despesa', 'despesas', 'saida', 'saidas', 'paguei', 'pagamos', 'pago', 'pagos',
  'pagou', 'comprei', 'compra', 'compras', 'natureza', 'naturezas', 'categoria', 'categorias', 'origem', 'origens',
  'hoje', 'ontem', 'semana', 'semanas', 'quinzena', 'mes', 'meses', 'mensal', 'ano', 'anos', 'dia', 'dias', 'passado', 'passada', 'anterior',
  'ultimo', 'ultima', 'ultimos', 'ultimas', 'periodo', ...MONTHS,
]);

/** O assunto da frase, de duas formas: sem acentos (para procurar) e como foi escrito (para mostrar). */
export function spendSubjectWords(text: string): { subject: string; shown: string } {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((raw) => ({ raw, plain: stripAccents(raw) }))
    .filter((w) => w.plain.length >= 2 && !STOP.has(w.plain) && !/^\d+$/.test(w.plain));
  return { subject: words.map((w) => w.plain).join(' '), shown: words.map((w) => w.raw.toLowerCase()).join(' ') };
}

/** O que sobra da frase sem perguntas, verbos de gasto, datas e ligações: o assunto ("mercado", "uber", "fora de casa"). */
export function spendSubject(text: string): string {
  return spendSubjectWords(text).subject;
}

/** A pergunta que a IA entendeu (assunto e datas livres) no formato que a resposta usa. O assunto passa pelo mesmo filtro das regras. */
export function spendQueryFrom(raw: { subject: string; from?: string; to?: string }, today: Date = new Date()): SpendQuery {
  const { subject, shown } = spendSubjectWords(raw.subject);
  return { subject, ...(subject ? { shown } : {}), ...(raw.from && raw.to ? { range: describeRange(raw.from, raw.to, today) } : {}) };
}

const SPEND_NOUN = /\b(gastos?|despesas?|saidas?|compras?)\b/;
const SPEND_WORD = /\b(gast\w*|despesas?|saidas?|paguei|pagamos|pagou|comprei|compras?)\b/;

/**
 * A frase é uma pergunta de gastos com detalhe? Sim quando traz um assunto ou um período que as respostas
 * simples (hoje, semana, quinzena, mês atual) não cobrem. Sem nenhum dos dois, segue para essas respostas.
 */
export function detectSpendDetail(text: string, today: Date = new Date()): SpendQuery | null {
  const t = stripAccents(text);
  if (!SPEND_WORD.test(t)) return null;
  // "paguei 50 na farmácia" é um registro, não uma pergunta: sem substantivo de gasto, só vale como pergunta
  if (!SPEND_NOUN.test(t) && !/\?|\bquant\w*\b|\bquais?\b|\bqual\b|\bmostr\w+|\bver\b/.test(t)) return null;
  const { subject, shown } = spendSubjectWords(text);
  const range = parseSpendRange(text, today);
  if (!subject && (!range || CURRENT_LABELS.includes(range.label))) return null;
  return { subject, ...(subject ? { shown } : {}), ...(range ? { range } : {}) };
}

// ── Cálculo ───────────────────────────────────────────────────────────────────
interface SpendPart {
  date: string;
  title: string;
  amount: number;
  natureId?: string;
  natureName: string;
  /** Texto onde o assunto é procurado (título, categoria, natureza). */
  haystack: string;
}

const norm = (s: string) => stripAccents(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
/** A palavra está no texto (também no singular: "refeições" acha "refeição"). */
const has = (hay: string, word: string) => hay.includes(word) || (word.length > 3 && word.endsWith('s') && hay.includes(word.slice(0, -1)));

/**
 * Saídas já pagas no período, uma linha por lançamento. Fatura de cartão com itens analisados vira uma linha
 * por natureza (o que sobra sem análise fica "Sem natureza"): assim "gastei com mercado" inclui o mercado do cartão.
 */
function paidParts(movements: Movement[], natures: ExpenseNature[], from: string, to: string): SpendPart[] {
  const nameOf = (id?: string) => natures.find((n) => n.id === id)?.name || '';
  const parts: SpendPart[] = [];
  const push = (m: Movement, date: string, title: string, amount: number, natureId: string | undefined, natureName: string, extra = '') =>
    parts.push({ date, title, amount, natureId, natureName, haystack: norm(`${title} ${m.title} ${m.category || ''} ${natureName} ${extra}`) });

  movements.forEach((m) => {
    if (isIncomeMovement(m) || m.status !== 'REALIZADA') return;
    const amount = outflowValue(m);
    const date = outflowDate(m);
    if (!(amount > 0.004) || date < from || date > to) return;

    if (m.type === 'CARTAO') {
      const items = (m.invoiceBreakdown || []).filter((b) => b.isAnalyzed && b.natureId && b.natureId.toLowerCase() !== 'outros' && b.amount > 0.004);
      const analyzed = items.reduce((acc, b) => acc + b.amount, 0);
      items.forEach((b) => push(m, date, `${b.description} (${m.title})`, b.amount, b.natureId, nameOf(b.natureId) || b.natureName));
      const rest = Math.round((amount - analyzed) * 100) / 100;
      if (rest > 0.004) push(m, date, items.length > 0 ? `${m.title} (restante da fatura)` : m.title, rest, undefined, items.length > 0 ? NO_NATURE : 'Faturas de cartão');
      return;
    }
    const natureId = resolveMovementNatureId(m, natures);
    const natureName = natureId ? nameOf(natureId) : m.type === 'EMPRESTIMO' ? 'Empréstimos' : NO_NATURE;
    push(m, date, m.title, amount, natureId, natureName);
  });
  return parts;
}

interface Resolved {
  parts: SpendPart[];
  /** Nome para o título da resposta ("Alimentação & Mercado", "uber"). */
  label: string;
  /** O assunto é o nome de uma natureza cadastrada (mesmo sem gasto, ela existe). */
  isNature: boolean;
}

/** Procura o assunto primeiro entre as naturezas (todas as palavras no nome), depois no texto dos lançamentos. */
function filterBySubject(parts: SpendPart[], subject: string, natures: ExpenseNature[], shown = subject): Resolved {
  const words = subject.split(' ').filter(Boolean);
  if (words.length === 0) return { parts, label: '', isNature: false };
  const matched = natures.filter((n) => words.every((w) => has(norm(n.name), w)));
  if (matched.length > 0) {
    const ids = new Set(matched.map((n) => n.id));
    return { parts: parts.filter((p) => p.natureId && ids.has(p.natureId)), label: matched.slice(0, 2).map((n) => n.name).join(' + '), isNature: true };
  }
  return { parts: parts.filter((p) => words.every((w) => has(p.haystack, w))), label: shown, isNature: false };
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface SpendAnswer {
  text: string;
  chips: string[];
  /** O que foi respondido (assunto e período), para "e no mês passado?" continuar daqui. */
  query: SpendQuery & { range: SpendRange };
}

/** Responde "quanto gastei com X em Y": total pago, e as saídas (com assunto) ou a divisão por natureza (sem assunto). */
export function answerSpendDetail(query: SpendQuery, movements: Movement[], natures: ExpenseNature[], today: Date = new Date()): SpendAnswer {
  const range = query.range || { ...trackingPeriodRange('MES', today), label: 'deste mês' };
  const inRange = paidParts(movements, natures, range.from, range.to);
  const { parts, label, isNature } = filterBySubject(inRange, query.subject, natures, query.shown || query.subject);
  const dates = range.from === range.to ? ddmm(range.from) : `${ddmm(range.from)} a ${ddmm(range.to)}`;
  const heading = `**Gastos${label ? ` com ${isNature ? label : cap(label)}` : ''} ${range.label}** (${dates})`;
  const total = parts.reduce((acc, p) => acc + p.amount, 0);
  const answered = { subject: query.subject, range };
  const prevChip = range.label === 'do mês passado' ? 'E neste mês?' : 'E no mês passado?';
  // O atalho leva o período junto ("Gastos por natureza de setembro"), quando a frase serve de volta para as regras
  const withRange = `Gastos por natureza ${range.label}`;
  const natureChip = range.label !== 'deste mês' && parseSpendRange(withRange, today)?.label === range.label ? withRange : 'Gastos por natureza';
  const pending = range.to >= isoDay(today) ? '\n\n_Conta só o que já foi pago; o que ainda vai vencer não entra._' : '';

  if (parts.length === 0) {
    // Distingue "não há gasto assim neste período" de "não achei esse assunto em lugar nenhum"
    const everything = filterBySubject(paidParts(movements, natures, '0000-01-01', '9999-12-31'), query.subject, natures, query.shown || query.subject).parts;
    const elsewhere = everything.reduce((acc, p) => acc + p.amount, 0);
    const text =
      query.subject && everything.length === 0 && !isNature
        ? `${heading}\n\nNão achei **${query.shown || query.subject}** nas suas naturezas nem nos lançamentos já pagos. Tente o nome de uma natureza ou do que você pagou.`
        : `${heading}\n\nNão há saídas pagas${label ? ' assim' : ''} neste período.${everything.length > 0 ? ` Em outros períodos há **${brl(elsewhere)}** em ${count(everything.length, 'lançamento', 'lançamentos')}.` : ''}`;
    return { text: `${text}${pending}`, chips: [natureChip, prevChip], query: answered };
  }

  const lines: string[] = [`• Total pago: **${brl(total)}** (${count(parts.length, 'saída', 'saídas')})`];
  if (query.subject) {
    const shown = [...parts].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount).slice(0, 8);
    lines.push('', ...shown.map((p) => `• ${ddmm(p.date)} · ${p.title} — **${brl(p.amount)}**`));
    if (parts.length > shown.length) lines.push(`…e mais ${parts.length - shown.length}.`);
  } else {
    const byNature = new Map<string, { sum: number; n: number }>();
    parts.forEach((p) => {
      const g = byNature.get(p.natureName) || { sum: 0, n: 0 };
      g.sum += p.amount;
      g.n += 1;
      byNature.set(p.natureName, g);
    });
    const ranked = [...byNature.entries()].sort((a, b) => b[1].sum - a[1].sum);
    lines.push('', '**Por natureza:**', ...ranked.slice(0, 8).map(([name, g]) => `• **${name}:** ${brl(g.sum)} (${Math.round((g.sum / total) * 100)}%)`));
    if (ranked.length > 8) lines.push(`…e mais ${ranked.length - 8}.`);
  }
  return { text: `${heading}\n\n${lines.join('\n')}${pending}`, chips: [prevChip, natureChip, 'Últimas compras'], query: answered };
}
