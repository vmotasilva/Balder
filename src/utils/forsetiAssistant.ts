import type { BankAccount, CopilotInteractiveOption, CreditCardItem, Goal, MonthlyGridProjectionRow, Movement } from '../types';
import type { ForecastEntry, ForecastPeriod, ForecastWindow } from './forecastWindow';
import { CASH_IN_HAND } from './cashInHand';

/**
 * Conversa guiada da Forseti: sugestões rápidas, registro passo a passo (valor → data/categoria → conta)
 * e respostas às dúvidas com os números do planejamento.
 */

// ── Sugestões rápidas ─────────────────────────────────────────────────────────
export const CHIP_ANEXAR = '📸 Anexar comprovante / cupom fiscal';
export const CHIP_RECEBER = '💰 Vou receber um valor';
export const CHIP_PAGAR = '💸 Registrar um pagamento';
export const CHIP_DUVIDA = '❓ Tenho uma dúvida';
export const MAIN_CHIPS = [CHIP_ANEXAR, CHIP_RECEBER, CHIP_PAGAR, CHIP_DUVIDA];

export const DOUBT_CHIPS = [
  'Qual meu saldo hoje?',
  'Quanto ainda posso gastar este mês?',
  'Quando entra meu próximo recebimento?',
  'O que vence nos próximos dias?',
  'Quanto já gastei este mês?',
  'Por que meu saldo previsto caiu?',
  'Como está minha reserva de emergência?',
  'Como estão minhas metas?',
  'Posso comprar um carro?',
  'Vale a pena quitar meu empréstimo?',
  'Como funciona o Balder?',
];

/** Registro guiado em andamento: a próxima mensagem responde à pergunta do passo atual. */
export interface ForsetiFlow {
  kind: 'RECEBER' | 'PAGAR';
  step: 'VALOR' | 'DATA' | 'CATEGORIA' | 'DESCRICAO';
  title?: string;
  amount?: number;
  date?: string;
  status?: 'PREVISTA' | 'REALIZADA';
  category?: { title: string; category: string };
}

const GENERIC_TITLES = ['conta', 'algo', 'coisa', 'pagamento', 'valor', 'gasto', 'dinheiro', 'recebimento'];

/** Título útil do texto (vazio quando só sobra algo genérico como "uma conta" ou "um valor"). */
export function titleFrom(text: string): string {
  const t = extractTitle(text).replace(/^[^\p{L}\d]+/u, '').trim();
  return t.length >= 2 && !GENERIC_TITLES.includes(stripAccents(t)) ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

const isQuestion = (text: string) =>
  text.includes('?') || /^(quanto|quando|como|o que|qual|quais|por ?que|posso|vale|onde|devo|consigo)\b/i.test(stripAccents(text.trim()));

/** Frase de registro ("paguei 50 no mercado", "vou receber 1.200 dia 10"); perguntas nunca contam. */
export function registrationKind(text: string): 'RECEBER' | 'PAGAR' | null {
  if (isQuestion(text)) return null;
  const t = stripAccents(text);
  if (/\b(receberei|vou receber|recebi|ganhei|vou ganhar|vai entrar|entrou|caiu na conta)\b/.test(t)) return 'RECEBER';
  if (/\b(paguei|gastei|comprei)\b/.test(t)) return 'PAGAR';
  return null;
}

/** "recebi", "ganhei", "entrou": o recebimento já aconteceu. */
export const isPastReceive = (text: string) => /\b(recebi|ganhei|entrou|caiu na conta)\b/.test(stripAccents(text));

export const RECEIVE_DATE_CHIPS =['Hoje', 'Amanhã', 'Dia 5', 'Dia 10', 'Dia 15', 'Dia 20'];

const EXPENSE_CATEGORIES: { chip: string; title: string; category: string; keywords: string[] }[] = [
  { chip: '🛒 Mercado', title: 'Mercado', category: 'Alimentação & Mercado', keywords: ['mercado', 'supermercado', 'atacad', 'padaria', 'acougue', 'açougue'] },
  { chip: '🥬 Feira / hortifrúti', title: 'Feira', category: 'Alimentação & Mercado (Feira Livre & Hortifrúti)', keywords: ['feira', 'hortifruti', 'hortifrúti', 'quitanda', 'sacolao', 'sacolão', 'verdura', 'legume', 'fruta'] },
  { chip: '🍽️ Restaurante / lanche', title: 'Restaurante', category: 'Alimentação fora de casa', keywords: ['restaurante', 'lanche', 'ifood', 'pizza', 'almoço', 'almoco', 'jantar', 'cafe', 'café', 'pastel'] },
  { chip: '🚗 Transporte', title: 'Transporte', category: 'Transporte', keywords: ['uber', 'combustivel', 'combustível', 'gasolina', 'etanol', 'transporte', 'onibus', 'ônibus', 'estacionamento', 'pedagio', 'pedágio', '99'] },
  { chip: '💊 Farmácia / saúde', title: 'Farmácia', category: 'Saúde', keywords: ['farmacia', 'farmácia', 'remedio', 'remédio', 'saude', 'saúde', 'medico', 'médico', 'consulta', 'exame', 'dentista'] },
  { chip: '🏠 Contas da casa', title: 'Conta da casa', category: 'Utilidades / Moradia', keywords: ['energia', 'luz', 'agua', 'água', 'aluguel', 'internet', 'condominio', 'condomínio', 'gas', 'gás', 'telefone', 'celular'] },
  { chip: '🎉 Lazer', title: 'Lazer', category: 'Lazer', keywords: ['cinema', 'show', 'viagem', 'passeio', 'bar', 'lazer', 'streaming', 'netflix'] },
];
export const EXPENSE_CATEGORY_CHIPS = [...EXPENSE_CATEGORIES.map((c) => c.chip), 'Outro'];

// ── Utilidades ────────────────────────────────────────────────────────────────
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const stripAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DATE_PATTERNS = [/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, /\bdia\s+\d{1,2}\b/gi];

/** Tira datas ("dia 5", "10/10") do texto para o número do dia não ser lido como valor. */
const withoutDates = (text: string) => DATE_PATTERNS.reduce((t, re) => t.replace(re, ' '), text);

/** Valor em reais escrito de forma livre: "R$ 1.250,90", "1250.90", "8500", "8,5 mil", "2 mil". */
export function parseAmount(text: string): number | null {
  const clean = withoutDates(text);
  const match = clean.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil\b)?/i);
  if (!match) return null;
  let raw = match[1];
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  let value = parseFloat(raw);
  if (match[2]) value *= 1000;
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/** Texto que sobra depois de tirar valor, data e verbos (vira o título do lançamento). */
export function extractTitle(text: string): string {
  return withoutDates(text)
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:mil\b)?/gi, ' ')
    .replace(/\b(?:eu|vou|receber|receberei|recebi|ganhei|paguei|gastei|comprei|pago|reais|real|hoje|amanh[ãa]|ontem)\b/gi, ' ')
    .replace(/^\s*(?:de|do|da|no|na|em|com|pelo|pela|um|uma)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();
}

/** Data a partir de "hoje", "amanhã", "ontem", "dia 5", "5" (só no passo da data) ou "10/10(/2026)". */
export function parseDate(text: string, allowBareDay = false, today: Date = new Date()): string | null {
  const t = stripAccents(text);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (/\bhoje\b/.test(t)) return isoOf(base);
  if (/\bamanha\b/.test(t)) return isoOf(new Date(base.getTime() + 86400000));
  if (/\bontem\b/.test(t)) return isoOf(new Date(base.getTime() - 86400000));

  const full = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]) - 1;
    let year = full[3] ? Number(full[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) return null;
    return isoOf(d);
  }

  const dayMatch = t.match(/\bdia\s+(\d{1,2})\b/) || (allowBareDay ? t.match(/^\s*(\d{1,2})\s*$/) : null);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    if (day < 1 || day > 31) return null;
    // Próxima vez que esse dia chega (este mês ou o seguinte), ajustado ao fim do mês
    const pick = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    let d = pick(base.getFullYear(), base.getMonth());
    if (d < base) d = pick(base.getFullYear(), base.getMonth() + 1);
    return isoOf(d);
  }
  return null;
}

export function inferExpenseCategory(text: string): { title: string; category: string } | null {
  const t = stripAccents(text);
  const found = EXPENSE_CATEGORIES.find((c) => c.keywords.some((k) => t.includes(stripAccents(k))));
  return found ? { title: found.title, category: found.category } : null;
}

/** Categoria escolhida por uma sugestão (ex.: "🛒 Mercado"). */
export function categoryFromChip(text: string): { title: string; category: string } | null {
  const found = EXPENSE_CATEGORIES.find((c) => c.chip === text.trim());
  return found ? { title: found.title, category: found.category } : null;
}

/** Vencimento da fatura em que uma compra de hoje cai (fecha no closingDay, vence no dueDay). */
export function nextCardDueDate(closingDay: number, dueDay: number, today: Date = new Date()): string {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const clamp = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let closing = clamp(base.getFullYear(), base.getMonth(), closingDay);
  if (base > closing) closing = clamp(base.getFullYear(), base.getMonth() + 1, closingDay);
  let due = clamp(closing.getFullYear(), closing.getMonth(), dueDay);
  if (due <= closing) due = clamp(closing.getFullYear(), closing.getMonth() + 1, dueDay);
  return isoOf(due);
}

// ── Contas para escolher ──────────────────────────────────────────────────────
export function receiveAccountOptions(accounts: BankAccount[]): CopilotInteractiveOption[] {
  const list: CopilotInteractiveOption[] = accounts.map((a) => ({
    id: `opt_rec_${a.id}`,
    label: a.name,
    icon: a.icon || '🏦',
    badge: a.type === 'INVESTIMENTO' ? 'Investimentos' : a.type === 'POUPANCA' ? 'Reserva / poupança' : 'Conta',
    description: a.bankName || undefined,
    payload: { bank: a.name, type: 'RECEBER' },
  }));
  // Sem contas cadastradas: uma opção genérica para não travar o registro
  if (list.length === 0) {
    list.push({ id: 'opt_rec_geral', label: 'Conta bancária', icon: '🏦', badge: 'Conta', payload: { bank: 'Geral', type: 'RECEBER' } });
  }
  list.push({
    id: 'opt_rec_cash',
    label: CASH_IN_HAND,
    icon: '💵',
    badge: 'Dinheiro físico',
    description: 'Recebido em espécie',
    payload: { bank: CASH_IN_HAND, type: 'RECEBER' },
  });
  return list;
}

export function paymentOptions(accounts: BankAccount[], cards: CreditCardItem[], category: string): CopilotInteractiveOption[] {
  const list: CopilotInteractiveOption[] = [
    ...accounts
      .filter((a) => a.type === 'CORRENTE' || a.type === 'CARTEIRA' || a.type === 'OUTRO')
      .map((a) => ({
        id: `opt_pay_${a.id}`,
        label: `${a.name} (conta / Pix)`,
        icon: a.icon || '🏦',
        badge: 'Débito na hora',
        description: 'Sai agora do saldo da conta',
        payload: { bank: a.name, type: 'PAGAR' as const, category },
      })),
    ...cards.map((c) => {
      const dueDate = nextCardDueDate(c.closingDay, c.dueDay);
      return {
        id: `opt_pay_card_${c.id}`,
        label: c.name,
        icon: '💳',
        badge: 'Cartão de crédito',
        description: `Entra na fatura que vence em ${ddmm(dueDate)}`,
        payload: { bank: c.name, type: 'CARTAO' as const, category, dueDate },
      };
    }),
  ];
  if (!list.some((o) => o.payload.type === 'PAGAR')) {
    list.unshift({
      id: 'opt_pay_geral',
      label: 'Conta bancária (débito / Pix)',
      icon: '🏦',
      badge: 'Débito na hora',
      description: 'Sai agora do saldo da conta',
      payload: { bank: 'Geral', type: 'PAGAR', category },
    });
  }
  list.push({
    id: 'opt_pay_cash',
    label: CASH_IN_HAND,
    icon: '💵',
    badge: 'Dinheiro físico',
    description: 'Não mexe nas contas bancárias',
    payload: { bank: CASH_IN_HAND, type: 'PAGAR', category },
  });
  return list;
}

// ── Dúvidas ───────────────────────────────────────────────────────────────────
export type DoubtId =
  | 'MENU'
  | 'SALDO_HOJE'
  | 'PROXIMO_RECEB'
  | 'SOBRA'
  | 'VENCE'
  | 'GASTEI'
  | 'CAIU'
  | 'RESERVA'
  | 'METAS'
  | 'COMPRA'
  | 'QUITAR'
  | 'COMO_FUNCIONA'
  | 'GLOSSARIO'
  | 'ONDE_VER';

/** Reconhece uma dúvida no texto (antes de tentar ler como gasto/recebimento: "quanto já gastei" não é um gasto). */
export function detectDoubt(text: string): DoubtId | null {
  const t = stripAccents(text);
  if (t.includes('tenho uma duvida') || t === 'duvida' || t === 'duvidas' || t.includes('outra duvida')) return 'MENU';
  if (/saldo (de )?hoje|quanto tenho|meu saldo( atual)?\??$|saldo atual|saldo em conta/.test(t)) return 'SALDO_HOJE';
  if (/quando (entra|recebo|cai|vou receber)|proximo recebimento|proxima entrada|quando o salario/.test(t)) return 'PROXIMO_RECEB';
  if (/quanto (ainda )?(posso|consigo) gastar|sobrou|sobra |quanto (me )?sobra|livre para gastar/.test(t)) return 'SOBRA';
  if (/vence|vencimento|a pagar essa semana|contas? (atrasad|em atraso)|proximos dias/.test(t)) return 'VENCE';
  if (/quanto (ja )?gastei|ja gastei|meus gastos|gastos d[eo] mes|gastei (esse|este|no) mes/.test(t)) return 'GASTEI';
  if (/(por ?que|porque).*(caiu|diminuiu|baixou|negativo|saldo)/.test(t)) return 'CAIU';
  if (t.includes('reserva')) return 'RESERVA';
  if (/\bmetas?\b/.test(t)) return 'METAS';
  if (/quita|quitar|amortiz|antecipar parcela/.test(t)) return 'QUITAR';
  if (/posso comprar|da pra comprar|consigo comprar|vale a pena comprar|\bcarro\b|financiar/.test(t)) return 'COMPRA';
  if (/como funciona|o que (voce|vc) faz|me ajuda|^ajuda|como usar/.test(t)) return 'COMO_FUNCIONA';
  if (/o que (e|sao|significa)\b/.test(t)) return 'GLOSSARIO';
  if (/^ver |onde (vejo|fica|encontro)/.test(t)) return 'ONDE_VER';
  return null;
}

export interface ForsetiReply {
  text: string;
  badge: string;
  chips: string[];
}

export interface ForsetiData {
  availableBalance: number;
  forecasts: Record<ForecastPeriod, ForecastWindow>;
  monthProjected?: MonthlyGridProjectionRow;
  monthRealized?: MonthlyGridProjectionRow;
  goals: Goal[];
  movements: Movement[];
  emergencyReserveAmount: number;
  emergencyReserveMonths: number;
  monthlyFreeCashflow: number;
}

const rowExpense = (r?: MonthlyGridProjectionRow) =>
  r ? r.creditCardTotal + r.fixedCostMapped + r.variableCost + r.loanPayment : 0;
const months1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const entryLine = (e: ForecastEntry) => `• ${ddmm(e.date)} · ${e.title}: **${brl(e.amount)}**`;
const MORE = [CHIP_DUVIDA, CHIP_PAGAR];

const GLOSSARY: { keys: string[]; text: string }[] = [
  {
    keys: ['natureza'],
    text: '🏷️ **Naturezas** são os grandes grupos dos seus gastos (Moradia, Alimentação, Saúde…). Dentro de cada uma ficam os **mapeamentos** (ex.: "Contas fixas da casa") e, neles, os **itens** com valor e dia (ex.: "Energia – R$ 180 – dia 10"). É assim que o Balder prevê o que você vai gastar em cada mês.',
  },
  {
    keys: ['mapeamento'],
    text: '🗂️ **Mapeamento** é um conjunto de gastos parecidos dentro de uma natureza, com repetição (todo mês, toda semana, meses específicos). Cada item do mapeamento vira uma previsão na Projeção até você confirmar o pagamento.',
  },
  {
    keys: ['competencia'],
    text: '📅 **Competência** é o mês a que um valor pertence, mesmo que o dinheiro entre ou saia em outro dia (ex.: o salário de setembro pago em 5 de outubro é da competência setembro). A aba **Atual** do Painel mostra a competência em aberto; ao fechar um mês, o Balder passa para o seguinte.',
  },
  {
    keys: ['projecao'],
    text: '📈 A **Projeção** mostra mês a mês o que entra, o que sai e o saldo acumulado: *Real* é o que já aconteceu e *Previsto* é o que ainda vai acontecer. Toque em Entrada ou Saída de um mês para ver o que compõe cada valor.',
  },
  {
    keys: ['ponto de partida', 'marco'],
    text: '🚩 O **ponto de partida** é a data e o saldo de onde o Balder começa a contar. Tudo antes dele já está no saldo inicial; tudo depois entra nas contas e projeções.',
  },
  {
    keys: ['fatura'],
    text: '💳 A **fatura** reúne as compras de um cartão. No Balder você importa ou lança a fatura e distribui os itens nas naturezas; enquanto não é paga, ela conta como saída prevista na data de vencimento.',
  },
];

export function answerDoubt(id: DoubtId, text: string, d: ForsetiData): ForsetiReply {
  const month = d.forecasts.MES;
  switch (id) {
    case 'MENU':
      return {
        text: 'Claro! Sobre o que é a sua dúvida? Escolha uma das opções abaixo ou escreva do seu jeito.',
        badge: 'DÚVIDAS',
        chips: DOUBT_CHIPS,
      };

    case 'SALDO_HOJE':
      return {
        text: `Seu saldo hoje é **${brl(d.availableBalance)}** (o ponto de partida mais tudo o que já entrou e saiu depois dele).\n\nSe estiver diferente do banco, provavelmente falta confirmar algum pagamento ou recebimento — me conte e eu ajusto.`,
        badge: 'SALDO DE HOJE',
        chips: ['Quanto ainda posso gastar este mês?', 'O que vence nos próximos dias?', CHIP_DUVIDA],
      };

    case 'PROXIMO_RECEB': {
      const incoming = d.forecasts.DIAS_30.entries.filter((e) => e.kind === 'ENTRADA');
      const late = incoming.filter((e) => e.overdue);
      const next = incoming.filter((e) => !e.overdue).slice(0, 5);
      if (incoming.length === 0) {
        return {
          text: 'Não há recebimentos previstos para os próximos 30 dias. Se algum valor vai entrar, me conte que eu agendo.',
          badge: 'RECEBIMENTOS',
          chips: [CHIP_RECEBER, CHIP_DUVIDA],
        };
      }
      const parts: string[] = [];
      if (next.length > 0) parts.push(`📥 **Próximos recebimentos:**\n${next.map(entryLine).join('\n')}`);
      if (late.length > 0) {
        parts.push(
          `⏳ **Já deveriam ter entrado** (${brl(late.reduce((a, e) => a + e.amount, 0))}):\n${late.slice(0, 5).map(entryLine).join('\n')}\n\nSe já caíram na conta, confirme para o saldo ficar certo.`
        );
      }
      return { text: parts.join('\n\n'), badge: 'RECEBIMENTOS', chips: [CHIP_RECEBER, 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA] };
    }

    case 'SOBRA': {
      const daysLeft = Math.max(1, month.days);
      const free = month.projectedBalance;
      const lines = [
        `Até o fim do mês (${ddmm(month.toDate)}):`,
        `• Saldo hoje: **${brl(month.startingBalance)}**`,
        `• + A receber: **${brl(month.income)}**`,
        `• − A pagar: **${brl(month.expenses)}**`,
        `• = Sobra prevista: **${brl(free)}**`,
      ];
      const verdict =
        free <= 0
          ? `⚠️ Com o que está previsto, **não sobra dinheiro** este mês (faltam ${brl(Math.abs(free))}). Vale adiar gastos que não são essenciais ou rever o que ainda vai pagar.`
          : `Se tudo o que está previsto acontecer, você pode gastar até **${brl(free)}** sem ficar no negativo — algo como **${brl(free / daysLeft)} por dia** nos ${daysLeft} dias que faltam.`;
      return { text: `${lines.join('\n')}\n\n${verdict}`, badge: 'QUANTO POSSO GASTAR', chips: ['O que vence nos próximos dias?', 'Quanto já gastei este mês?', CHIP_DUVIDA] };
    }

    case 'VENCE': {
      const in7 = isoOf(new Date(Date.now() + 7 * 86400000));
      const window = d.forecasts.DIAS_30.entries.filter((e) => e.kind === 'SAIDA');
      const overdue = window.filter((e) => e.overdue);
      const soon = window.filter((e) => !e.overdue && e.date <= in7);
      if (overdue.length === 0 && soon.length === 0) {
        return { text: '✅ Nada vence nos próximos 7 dias e não há contas em atraso.', badge: 'VENCIMENTOS', chips: ['Quanto ainda posso gastar este mês?', CHIP_DUVIDA] };
      }
      const parts: string[] = [];
      if (overdue.length > 0) {
        parts.push(`⚠️ **Em atraso** (${brl(overdue.reduce((a, e) => a + e.amount, 0))}):\n${overdue.slice(0, 6).map(entryLine).join('\n')}`);
      }
      if (soon.length > 0) {
        parts.push(`📅 **Próximos 7 dias** (${brl(soon.reduce((a, e) => a + e.amount, 0))}):\n${soon.slice(0, 8).map(entryLine).join('\n')}`);
      }
      const rest = overdue.length + soon.length - Math.min(overdue.length, 6) - Math.min(soon.length, 8);
      return {
        text: `${parts.join('\n\n')}${rest > 0 ? `\n\n…e mais ${rest} item(ns). A lista completa está no Início, em "Para fazer agora".` : ''}\n\nSe algum já foi pago, é só me contar (ex.: "paguei a energia") para o saldo ficar certo.`,
        badge: 'VENCIMENTOS',
        chips: [CHIP_PAGAR, 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA],
      };
    }

    case 'GASTEI': {
      const r = d.monthRealized;
      const spent = rowExpense(r);
      const planned = rowExpense(d.monthProjected);
      if (!r || spent <= 0) {
        return {
          text: `Ainda não há gastos confirmados neste mês.${planned > 0 ? ` O previsto para o mês todo é **${brl(planned)}**.` : ''}\n\nConforme você confirma pagamentos ou me conta o que gastou, eu somo aqui.`,
          badge: 'GASTOS DO MÊS',
          chips: [CHIP_PAGAR, CHIP_DUVIDA],
        };
      }
      const lines = [
        r.fixedCostMapped > 0 ? `• Naturezas (contas e rotinas): **${brl(r.fixedCostMapped)}**` : '',
        r.variableCost > 0 ? `• Gastos avulsos: **${brl(r.variableCost)}**` : '',
        r.creditCardTotal > 0 ? `• Faturas de cartão: **${brl(r.creditCardTotal)}**` : '',
        r.loanPayment > 0 ? `• Parcelas de empréstimo: **${brl(r.loanPayment)}**` : '',
      ].filter(Boolean);
      return {
        text: `Neste mês você já pagou **${brl(spent)}**:\n${lines.join('\n')}${planned > 0 ? `\n\nIsso é **${pct(spent, planned)}%** dos ${brl(planned)} previstos para o mês; ainda faltam **${brl(Math.max(0, planned - spent))}**.` : ''}`,
        badge: 'GASTOS DO MÊS',
        chips: ['Quanto ainda posso gastar este mês?', 'O que vence nos próximos dias?', CHIP_DUVIDA],
      };
    }

    case 'CAIU': {
      const outs = month.entries.filter((e) => e.kind === 'SAIDA');
      const overdue = outs.filter((e) => e.overdue);
      const top = [...outs].filter((e) => !e.overdue).sort((a, b) => b.amount - a.amount).slice(0, 3);
      const parts = [
        `Do saldo de hoje (**${brl(month.startingBalance)}**) até ${ddmm(month.toDate)}, entram **${brl(month.income)}** e saem **${brl(month.expenses)}**, então o saldo previsto fica em **${brl(month.projectedBalance)}**.`,
      ];
      if (overdue.length > 0) {
        parts.push(`⚠️ **${overdue.length} conta(s) em atraso** somam ${brl(overdue.reduce((a, e) => a + e.amount, 0))} e continuam descontadas até você confirmar o pagamento.`);
      }
      if (top.length > 0) {
        parts.push(`As maiores saídas previstas:\n${top.map(entryLine).join('\n')}`);
      }
      parts.push('Se algo já foi pago ou recebido e não está confirmado, me conte: o saldo previsto é recalculado na hora.');
      return { text: parts.join('\n\n'), badge: 'SALDO PREVISTO', chips: ['O que vence nos próximos dias?', CHIP_PAGAR, CHIP_DUVIDA] };
    }

    case 'RESERVA': {
      const monthlyCost = d.forecasts.DIAS_30.expenses;
      const ideal = monthlyCost * 6;
      if (d.emergencyReserveAmount <= 0) {
        return {
          text: `Você ainda não tem uma reserva de emergência cadastrada (contas do tipo poupança/reserva).\n\nO ideal é guardar de **6 a 12 meses** do seu custo mensal${monthlyCost > 0 ? ` — hoje, cerca de **${brl(ideal)}** (6 × ${brl(monthlyCost)})` : ''}. Uma boa forma de começar é criar uma **Meta** de reserva com um valor por mês.`,
          badge: 'RESERVA DE EMERGÊNCIA',
          chips: ['Como estão minhas metas?', CHIP_DUVIDA],
        };
      }
      const ok = d.emergencyReserveMonths >= 6;
      return {
        text: `Sua reserva é de **${brl(d.emergencyReserveAmount)}**, o que cobre **${months1(d.emergencyReserveMonths)} meses** do seu custo mensal${monthlyCost > 0 ? ` (${brl(monthlyCost)})` : ''}.\n\n${ok ? '✅ Está dentro do recomendado (6 meses ou mais).' : `⚠️ O recomendado são pelo menos 6 meses${monthlyCost > 0 ? `: faltam **${brl(Math.max(0, ideal - d.emergencyReserveAmount))}**` : ''}.`}`,
        badge: 'RESERVA DE EMERGÊNCIA',
        chips: ['Como estão minhas metas?', 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA],
      };
    }

    case 'METAS': {
      if (d.goals.length === 0) {
        return {
          text: 'Você ainda não tem metas. Crie uma em **Metas** (ex.: reserva de emergência, viagem, entrada de um imóvel) com o valor e quanto quer guardar por mês — eu acompanho o ritmo para você.',
          badge: 'METAS',
          chips: ['Como está minha reserva de emergência?', CHIP_DUVIDA],
        };
      }
      const lines = d.goals.map((g) => {
        const left = Math.max(0, g.targetAmount - g.currentAmount);
        const months = g.monthlyContribution > 0 ? Math.ceil(left / g.monthlyContribution) : null;
        return `• ${g.icon || '🎯'} **${g.title}**: ${pct(g.currentAmount, g.targetAmount)}% (${brl(g.currentAmount)} de ${brl(g.targetAmount)})${left <= 0 ? ' — concluída! 🎉' : months ? ` · faltam ${brl(left)}, cerca de ${months} ${months === 1 ? 'mês' : 'meses'} guardando ${brl(g.monthlyContribution)}/mês` : ` · faltam ${brl(left)}`}`;
      });
      const totalMonthly = d.goals.reduce((a, g) => a + g.monthlyContribution, 0);
      return {
        text: `${lines.join('\n')}${totalMonthly > 0 ? `\n\nNo total você separa **${brl(totalMonthly)}/mês** para as metas${d.monthlyFreeCashflow > 0 ? `, ${pct(totalMonthly, d.monthlyFreeCashflow)}% da sua sobra prevista de ${brl(d.monthlyFreeCashflow)}` : ''}.` : ''}`,
        badge: 'METAS',
        chips: ['Como está minha reserva de emergência?', CHIP_DUVIDA],
      };
    }

    case 'COMPRA': {
      const free = d.monthlyFreeCashflow;
      const what = /\bcarro\b/i.test(text) ? 'um carro' : 'essa compra';
      if (free <= 0) {
        return {
          text: `Hoje eu não recomendo assumir ${what} parcelado: nos próximos 30 dias, o que sai é maior que o que entra (resultado de ${brl(free)}).\n\nO primeiro passo é abrir espaço no orçamento — posso te mostrar o que vence e quanto já gastou.`,
          badge: 'DECISÃO DE COMPRA',
          chips: ['O que vence nos próximos dias?', 'Quanto já gastei este mês?', CHIP_DUVIDA],
        };
      }
      const safeInstallment = free * 0.3;
      const reserveOk = d.emergencyReserveMonths >= 6;
      return {
        text: `Para ${what}, olho três coisas:\n\n• **Sobra mensal prevista:** ${brl(free)}\n• **Parcela confortável:** até **${brl(safeInstallment)}** (30% da sobra), para não travar suas metas\n• **Reserva de emergência:** ${months1(d.emergencyReserveMonths)} meses ${reserveOk ? '✅' : '⚠️ (o ideal é 6+ antes de assumir parcelas longas)'}\n\n${reserveOk ? 'Se a parcela couber nesse limite, a compra é viável.' : 'Antes de comprar, vale reforçar a reserva — ou dar uma entrada maior para a parcela ficar menor.'} Para testar valores exatos, use **Ações Rápidas › Simular decisão** no Painel.`,
        badge: 'DECISÃO DE COMPRA',
        chips: ['Como está minha reserva de emergência?', 'Vale a pena quitar meu empréstimo?', CHIP_DUVIDA],
      };
    }

    case 'QUITAR': {
      const open = d.movements.filter((m) => m.type === 'EMPRESTIMO' && m.category !== 'Recebimento' && m.status === 'PREVISTA');
      if (open.length === 0) {
        return {
          text: 'Não encontrei parcelas de empréstimo em aberto. 👏 Se tiver um empréstimo que ainda não cadastrou, adicione em **Empréstimos** para eu acompanhar.',
          badge: 'EMPRÉSTIMOS',
          chips: [CHIP_DUVIDA],
        };
      }
      const total = open.reduce((a, m) => a + m.amount, 0);
      const last = open.reduce((max, m) => (m.dueDate > max ? m.dueDate : max), open[0].dueDate);
      const reserveOk = d.emergencyReserveMonths >= 6;
      return {
        text: `Você tem **${open.length} parcela(s)** em aberto, somando **${brl(total)}**, até ${last.split('-').reverse().join('/')}.\n\nAo antecipar parcelas, o banco é obrigado a tirar os **juros das parcelas futuras** (Código de Defesa do Consumidor, art. 52, § 2º) — por isso quitar costuma valer a pena quando:\n• os juros do empréstimo são maiores que o rendimento do seu dinheiro guardado;\n• você **não** precisa usar a reserva de emergência para isso${reserveOk ? ' (a sua está em dia ✅)' : ' (a sua está abaixo de 6 meses ⚠️)'}.\n\nEm **Empréstimos › Antecipar parcelas** você vê exatamente quanto economiza.`,
        badge: 'EMPRÉSTIMOS',
        chips: ['Como está minha reserva de emergência?', 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA],
      };
    }

    case 'COMO_FUNCIONA':
      return {
        text: 'O Balder organiza o seu dinheiro em 3 ideias: **o que você tem hoje**, **o que vai entrar e sair** e **para onde quer chegar**.\n\n• **Início:** saldo de hoje, o que fazer agora e gastos do período\n• **Painel:** a competência **Atual**, a **Projeção** mês a mês, as **Naturezas** e as **Metas**\n• **Movimentações:** tudo o que entrou e saiu, com filtros\n• **Faturas:** importe a fatura do cartão e distribua nas naturezas\n• **Naturezas:** seus gastos previstos (contas fixas, rotinas de mercado…)\n• **Empréstimos:** parcelas, simulações e antecipação\n• **Compartilhar:** planeje junto com outra pessoa\n\nE eu, a Forseti, registro o que você me contar, leio fotos de comprovantes e respondo dúvidas com os seus números.',
        badge: 'COMO FUNCIONA',
        chips: ['O que são naturezas?', 'O que é competência?', 'O que é a projeção?', CHIP_DUVIDA],
      };

    case 'GLOSSARIO': {
      const t = stripAccents(text);
      const found = GLOSSARY.find((g) => g.keys.some((k) => t.includes(k)));
      if (found) return { text: found.text, badge: 'COMO FUNCIONA', chips: ['Como funciona o Balder?', CHIP_DUVIDA] };
      return answerDoubt('COMO_FUNCIONA', text, d);
    }

    case 'ONDE_VER': {
      const t = stripAccents(text);
      const where = t.includes('fatura')
        ? '**Faturas**'
        : t.includes('moviment') || t.includes('lancamento')
        ? '**Movimentações**'
        : t.includes('natureza') || t.includes('gastos fixos')
        ? '**Naturezas** (ou a aba Naturezas do Painel)'
        : t.includes('meta')
        ? '**Metas**'
        : t.includes('emprestimo')
        ? '**Empréstimos**'
        : '**Painel**';
      return {
        text: `Você encontra isso em ${where}: no celular, pelo botão de menu no canto inferior; no computador, pela barra lateral.`,
        badge: 'NAVEGAÇÃO',
        chips: MORE,
      };
    }
  }
}

export const FALLBACK_REPLY: ForsetiReply = {
  text: 'Não entendi bem 🤔. Você pode me contar um gasto ou recebimento do seu jeito (ex.: *"paguei 50 na farmácia"* ou *"vou receber 1.200 dia 10"*), mandar a foto de um comprovante ou escolher uma das opções:',
  badge: 'FORSETI',
  chips: MAIN_CHIPS,
};

/**
 * Palavras soltas que podem querer dizer coisas diferentes: a Forseti pergunta qual das opções
 * (cada opção é uma sugestão que já leva ao caminho certo).
 */
const AMBIGUOUS: { keys: RegExp; question: string; options: { chip: string; meaning: string }[] }[] = [
  {
    keys: /emprestimo|financiamento|parcela/,
    question: 'Você está falando de **empréstimo**. É sobre:',
    options: [
      { chip: 'Vale a pena quitar meu empréstimo?', meaning: 'quitar ou antecipar parcelas' },
      { chip: 'Simular novo empréstimo', meaning: 'pegar um empréstimo novo' },
    ],
  },
  {
    keys: /cartao|fatura|credito/,
    question: 'Sobre **cartão**, você quer:',
    options: [
      { chip: CHIP_PAGAR, meaning: 'registrar uma compra feita no cartão' },
      { chip: 'O que vence nos próximos dias?', meaning: 'ver quando vence a fatura' },
      { chip: 'O que é fatura?', meaning: 'entender como a fatura funciona no Balder' },
    ],
  },
  {
    keys: /salario|pagamento do mes|holerite/,
    question: 'Sobre **salário**, você quer:',
    options: [
      { chip: 'Quando entra meu próximo recebimento?', meaning: 'saber quando ele entra' },
      { chip: CHIP_RECEBER, meaning: 'registrar um valor a receber' },
    ],
  },
  {
    keys: /\bsaldo\b/,
    question: 'Qual **saldo** você quer ver?',
    options: [
      { chip: 'Qual meu saldo hoje?', meaning: 'o que você tem agora' },
      { chip: 'Quanto ainda posso gastar este mês?', meaning: 'o que vai sobrar no fim do mês' },
      { chip: 'Por que meu saldo previsto caiu?', meaning: 'entender o que está puxando o saldo para baixo' },
    ],
  },
  {
    keys: /\bcontas?\b|boleto/,
    question: 'Quando você fala em **conta**, é:',
    options: [
      { chip: 'O que vence nos próximos dias?', meaning: 'contas a pagar e vencimentos' },
      { chip: 'Paguei uma conta', meaning: 'registrar uma conta que já pagou' },
      { chip: 'Qual meu saldo hoje?', meaning: 'o saldo da sua conta' },
    ],
  },
  {
    keys: /\bgastos?\b|despesas?|mercado|compras?\b/,
    question: 'Sobre **gastos**, você quer:',
    options: [
      { chip: CHIP_PAGAR, meaning: 'registrar um gasto' },
      { chip: 'Quanto já gastei este mês?', meaning: 'ver quanto já gastou' },
      { chip: 'Quanto ainda posso gastar este mês?', meaning: 'ver quanto ainda pode gastar' },
    ],
  },
  {
    keys: /receber|recebimento|entrada|renda/,
    question: 'Sobre **recebimentos**, você quer:',
    options: [
      { chip: CHIP_RECEBER, meaning: 'registrar um valor a receber' },
      { chip: 'Quando entra meu próximo recebimento?', meaning: 'ver o que está para entrar' },
    ],
  },
];

export function detectAmbiguity(text: string): ForsetiReply | null {
  const t = stripAccents(text);
  const found = AMBIGUOUS.find((a) => a.keys.test(t));
  if (!found) return null;
  const letters = ['A', 'B', 'C', 'D'];
  const list = found.options.map((o, i) => `**${letters[i]})** ${o.meaning}`).join('\n');
  return {
    text: `${found.question}\n\n${list}\n\nToque na opção ou escreva de outro jeito.`,
    badge: 'SÓ PARA CONFIRMAR',
    chips: found.options.map((o) => o.chip),
  };
}
