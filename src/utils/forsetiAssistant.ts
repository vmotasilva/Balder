import { firstInvoiceDueDate } from './cardPurchase';
import { defaultClosingDay } from './setupCatalog';
import type { BankAccount, CopilotInteractiveOption, PaymentWizardState, ExpenseNature, ForsetiPendingAction, CopilotPendingConfirmation, CreditCardItem, ForsetiActivity, Goal, InvoiceNatureItemBreakdown, MonthlyGridProjectionRow, Movement } from '../types';
import type { ForecastEntry, ForecastPeriod, ForecastWindow } from './forecastWindow';
import { CASH_IN_HAND } from './cashInHand';
import type { PaymentInstitution } from './paymentInstitutions';
import { trackingPeriodRange } from './periodSpending';
import { resolveMovementNatureId } from './movementNature';
import type { ForsetiRegistration, SpendPeriod } from './forsetiIntents';
import { brl, ddmm, isIncomeMovement, isoDay, outflowDate, outflowValue, stripAccents } from './forsetiMoney';
import { buildDigest, isDigestRequest } from './forsetiDigest';
import { type ForsetiMemory, memoriesText, memoryNote } from './forsetiMemory';
import { CHIP_FEEDBACK, type FeedbackKind } from './forsetiFeedback';
import { type SpendQuery, type SpendRange, answerSpendDetail, detectSpendDetail, parseSpendRange, spendSubjectWords } from './forsetiSpend';

// brl e ddmm continuam saindo daqui para quem já importa deste módulo
export { brl, ddmm };

/**
 * Conversa guiada da Forseti: sugestões rápidas, registro passo a passo (valor → data/categoria → conta)
 * e respostas às dúvidas com os números do planejamento.
 */

// ── Sugestões rápidas ─────────────────────────────────────────────────────────
export const CHIP_ANEXAR = '📸 Anexar comprovante / cupom fiscal';
export const CHIP_RECEBER = '💰 Vou receber um valor';
export const CHIP_PAGAR = '💸 Registrar um pagamento';
/** Já diz que foi no cartão: a Forseti não pergunta de novo se foi cartão ou dinheiro. */
export const CHIP_PAGAR_CARTAO = '💳 Registrar uma compra no cartão';
export const CHIP_DUVIDA = '❓ Tenho uma dúvida';
export { CHIP_FEEDBACK };
export const MAIN_CHIPS = [CHIP_ANEXAR, CHIP_RECEBER, CHIP_PAGAR, CHIP_DUVIDA, CHIP_FEEDBACK];

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
  step: 'BANCO' | 'BANCO_OUTRO' | 'VALOR' | 'DATA' | 'CATEGORIA' | 'DESCRICAO' | 'CARTAO_NOME' | 'CARTAO_VENCIMENTO' | 'CARTAO_FECHAMENTO' | 'FEEDBACK_TIPO' | 'FEEDBACK_TEXTO';
  /** Tipo escolhido no feedback em andamento (kind 'RECEBER'/'PAGAR' não é usado nesse fluxo). */
  feedbackKind?: FeedbackKind;
  title?: string;
  amount?: number;
  date?: string;
  status?: 'PREVISTA' | 'REALIZADA';
  /** Pagamento agendado ("agendei um pagamento para amanhã"): vira previsto na data, não pago hoje. */
  scheduled?: boolean;
  category?: { title: string; category: string };
  /** Compra parcelada ("em 6x", "dividido em 6 vezes"). */
  installments?: number;
  /** Frase original: guarda a forma de pagamento citada ("no cartão Inter") para o último passo. */
  hint?: string;
  /** Cartão sendo cadastrado na conversa (citado e não encontrado) e a compra que vai para ele. */
  newCard?: { name: string; dueDay?: number };
  purchase?: CopilotPendingConfirmation['pendingData'];
}

const GENERIC_TITLES = ['conta', 'algo', 'coisa', 'pagamento', 'valor', 'gasto', 'dinheiro', 'recebimento'];

/** Título útil do texto (vazio quando só sobra algo genérico como "uma conta" ou "um valor"). */
export function titleFrom(text: string): string {
  const transfer = transferTitle(text);
  if (transfer) return transfer;
  const t = extractTitle(text).replace(/^[^\p{L}\d]+/u, '').trim();
  if (t.length < 2 || GENERIC_TITLES.includes(stripAccents(t))) return '';
  return t.length === 2 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Transferência ou Pix para alguém: o título guarda o destinatário ("Pix para minha sogra").
 * Sem isso, "via pix para minha sogra" sairia do título junto com a forma de pagamento.
 */
function transferTitle(text: string): string | null {
  const t = stripAccents(text);
  if (!/\b(transfer\w*|pix|ted|doc|mand(?:ei|ar|ou)|envi(?:ei|ar|ou))\b/.test(t)) return null;
  const m = withoutDates(text).match(/\b(?:para|pra|pro)\s+(.+?)[.!?\s]*$/i);
  if (!m) return null;
  const who = m[1].replace(/\s+(?:hoje|amanh[ãa]|ontem)(?![\p{L}\d]).*$/iu, '').trim();
  // "para amanhã", "para 15" não são destinatários
  if (who.length < 2 || /^(?:amanh|hoje|ontem|\d|dia\b)/i.test(stripAccents(who))) return null;
  return `${/\bpix\b/.test(t) ? 'Pix' : 'Transferência'} para ${who}`;
}

export const isQuestion = (text: string) =>
  text.includes('?') || /^(quanto|quando|como|o que|qual|quais|quem|por ?que|posso|vale|onde|devo|consigo)\b/i.test(stripAccents(text.trim()));

/** Frase de registro ("paguei 50 no mercado", "vou receber 1.200 dia 10"); perguntas nunca contam. */
export function registrationKind(text: string): 'RECEBER' | 'PAGAR' | null {
  if (isQuestion(text) || isPlannedVsReal(text)) return null;
  const t = stripAccents(text);
  const hasAmount = parseAmount(text) !== null;
  if (/\b(receberei|vou receber|recebi|recebeu|recebemos|vai entrar|entrou|caiu na conta)\b/.test(t)) return 'RECEBER';
  // "ganhei" só é dinheiro com valor ou palavra de renda: "ganhou o jogo" é outro assunto
  if (/\b(ganhei|ganhou|vou ganhar)\b/.test(t) && (hasAmount || INCOME_WORDS.test(t) || MONEY_WORDS.test(t))) return 'RECEBER';
  // Alguém fez para mim ("me pagou 100", "me transferiu 50", "me deu 30"): é entrada, e só vale com valor
  if (hasAmount && /\bme\s+(pagou|pagaram|transferiu|transferiram|mandou|mandaram|enviou|enviaram|depositou|depositaram|deu|deram)\b/.test(t)) return 'RECEBER';
  // Qualquer pessoa: "paguei", "pagou", "gastamos"…
  if (/\b(pag(?:uei|ou|amos)|gast(?:ei|ou|amos)|compr(?:ei|ou|amos)|desembols(?:ei|ou))\b/.test(t)) return 'PAGAR';
  // Jeito coloquial ("deu R$ 30 de gasolina", "saiu 50 no mercado"): só vale com valor
  if (hasAmount && /\b(deu|saiu|custou)\b/.test(t)) return 'PAGAR';
  // Transferência e Pix para alguém ("transferi 100 para a minha mãe", "transferir R$ 100 via pix para minha sogra")
  if (/\b(transferi|transferiu|transferimos|fiz (?:um |uma )?(?:pix|transferencia|ted|doc))\b/.test(t)) return 'PAGAR';
  if (hasAmount && (/\b(transferir|transfira|transfere|mandei|enviei|mandar|enviar)\b/.test(t) || (/\b(pix|ted|doc|transferencia)\b/.test(t) && /\b(para|pra|pro)\b/.test(t)))) return 'PAGAR';
  if (isScheduledPayment(text)) return 'PAGAR';
  return null;
}

/** Palavras de dinheiro que bastam para "ganhei" ser um recebimento mesmo sem valor na frase. */
const MONEY_WORDS = /\b(dinheiro|reais|real|grana|pix|premio|loteria|mesada|gorjeta)\b/;
const INCOME_WORDS = /\b(salario|freela|freelance|renda|rendimentos?|bonus|comissao|reembolso|restituicao|decimo terceiro|13o|venda|recebid[ao]|recebimento)\b/;

/**
 * Valor + o que foi, sem verbo ("30 mercado", "mercado 30", "5000 salário"): o jeito mais curto de registrar.
 * Só vale quando o assunto é reconhecível (uma categoria de gasto ou uma palavra de renda): "parcela 12" ou "cartão 3000"
 * podem ser outra coisa e seguem para as perguntas de ambiguidade. Quem registra é o fluxo guiado, que confirma tudo.
 * Fica de fora do `registrationKind` de propósito: dentro de um registro em andamento, "85,90 na farmácia" é a resposta
 * à pergunta do valor, não um registro novo.
 */
export function shorthandRegistration(text: string): 'PAGAR' | 'RECEBER' | null {
  if (isQuestion(text)) return null;
  const t = stripAccents(text).trim();
  // Forma de pagamento junto ("59,36 refeição cartão de crédito nubank"): cabe mais palavras, e o gasto fica claro
  const payWords = /\b(cartao|credito|debito|pix|dinheiro)\b/.test(t);
  if (t.split(/\s+/).length > (payWords ? 9 : 5)) return null;
  // Parcelamento ("3x mercado") e mais de um valor ("mercado 30 farmácia 20") pedem a conversa completa
  if (/\d\s*(x|vezes)\b/.test(t)) return null;
  if ((withoutDates(t).match(/\d+(?:[.,]\d+)*/g) || []).length !== 1 || parseAmount(text) === null) return null;
  if (INCOME_WORDS.test(t)) return 'RECEBER';
  if (inferExpenseCategory(text)) return 'PAGAR';
  // Valor + forma de pagamento + o que foi ("59,36 refeição cartão de crédito nubank"): só "cartão 3000" segue como dúvida
  if (payWords) {
    const rest = t
      .replace(/\d+(?:[.,]\d+)*/g, ' ')
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !GENERIC_NAME_WORDS.has(w) && !BANK_MENTIONS.some((b) => b.re.test(w)) && !['pix', 'dinheiro', 'reais', 'real', 'paguei', 'gastei'].includes(w));
    if (rest.length > 0) return 'PAGAR';
  }
  return null;
}

/**
 * Pagamento por vir: "agendei um pagamento para amanhã de 178,31", "programei o boleto", "vou pagar 200 dia 10".
 * "vou pagar" e "pagarei" só valem com um valor na frase (sem ele podem ser outro assunto).
 */
export function isScheduledPayment(text: string): boolean {
  if (isQuestion(text)) return false;
  const t = stripAccents(text);
  if (/\b(agendei|agendarei|agendar|agendado|programei)\b/.test(t)) return true;
  return /\b(vou pagar|pagarei)\b/.test(t) && parseAmount(text) !== null;
}

/**
 * Aviso do resumo de um agendamento: deixa claro que ainda não aconteceu, só fica previsto na data.
 * (Sem isso o resumo de um pagamento agendado parece o de um pagamento feito.)
 */
export function scheduleNote(income: boolean, dueDate: string): string {
  const date = `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}/${dueDate.slice(0, 4)}`;
  return income
    ? `📅 Recebimento agendado: o dinheiro ainda não entrou. Fica previsto em ${date} e já conta no saldo previsto.`
    : `📅 Pagamento agendado: ainda não saiu da conta. Fica previsto em ${date} e já conta no saldo previsto.`;
}

/** "recebi", "ganhei", "entrou": o recebimento já aconteceu. */
export const isPastReceive = (text: string) => /\b(recebi|ganhei|entrou|caiu na conta)\b/.test(stripAccents(text));

export const RECEIVE_DATE_CHIPS =['Hoje', 'Amanhã', 'Dia 5', 'Dia 10', 'Dia 15', 'Dia 20'];

const EXPENSE_CATEGORIES: { chip: string; title: string; category: string; keywords: string[] }[] = [
  { chip: '🛒 Mercado', title: 'Mercado', category: 'Alimentação & Mercado', keywords: ['mercado', 'supermercado', 'atacad', 'padaria', 'acougue', 'açougue'] },
  { chip: '🥬 Feira / hortifrúti', title: 'Feira', category: 'Alimentação & Mercado (Feira Livre & Hortifrúti)', keywords: ['feira', 'hortifruti', 'hortifrúti', 'quitanda', 'sacolao', 'sacolão', 'verdura', 'legume', 'fruta'] },
  { chip: '🍽️ Restaurante / lanche', title: 'Restaurante', category: 'Alimentação fora de casa', keywords: ['restaurante', 'lanche', 'ifood', 'pizza', 'almoço', 'almoco', 'jantar', 'cafe', 'café', 'pastel', 'refei', 'bebida', 'marmita', 'comida', 'delivery', 'lanchonete', 'hamburguer', 'sushi', 'sorvete', 'acai', 'churrasco', 'rappi', 'cafeteria'] },
  { chip: '🚗 Transporte', title: 'Transporte', category: 'Transporte', keywords: ['uber', 'combustivel', 'combustível', 'gasolina', 'etanol', 'transporte', 'onibus', 'ônibus', 'estacionamento', 'pedagio', 'pedágio', 'taxi', 'ipva', 'passagem', 'bilhete', 'mecanico', 'oficina', 'lavagem'] },
  { chip: '💊 Farmácia / saúde', title: 'Farmácia', category: 'Saúde', keywords: ['farmacia', 'farmácia', 'remedio', 'remédio', 'saude', 'saúde', 'medico', 'médico', 'consulta', 'exame', 'dentista', 'academia', 'psicolog', 'terapia', 'fisioterap', 'hospital', 'laboratorio', 'oculos', 'otica'] },
  { chip: '🏠 Contas da casa', title: 'Conta da casa', category: 'Utilidades / Moradia', keywords: ['energia', 'luz', 'agua', 'água', 'aluguel', 'internet', 'condominio', 'condomínio', 'gas', 'gás', 'telefone', 'celular', 'iptu', 'diarista', 'faxina'] },
  { chip: '🎉 Lazer', title: 'Lazer', category: 'Lazer', keywords: ['cinema', 'show', 'viagem', 'passeio', 'bar', 'lazer', 'streaming', 'netflix', 'assinatura', 'spotify', 'disney', 'youtube', 'deezer', 'ingresso', 'teatro', 'festa', 'balada', 'hotel', 'pousada', 'parque', 'jogos', 'playstation', 'xbox', 'steam'] },
];
export const EXPENSE_CATEGORY_CHIPS = [...EXPENSE_CATEGORIES.map((c) => c.chip), 'Outro'];

// ── Utilidades ────────────────────────────────────────────────────────────────
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    .replace(/\b(?:eu|vou|receber|receberei|recebi|recebeu|ganhei|ganhou|paguei|pagou|pagamos|gastei|gastou|gastamos|comprei|comprou|compramos|deu|saiu|custou|pago|pagar|pagarei|agendei|agendarei|agendar|agendado|programei|reais|real|hoje|ontem)\b/gi, ' ')
    // \b não funciona depois de "ã"
    .replace(/\bamanh[ãa](?![\p{L}\d])/giu, ' ')
    .replace(/\b(?:no|pelo|por|com)\s+valor(?:\s+de)?\b/gi, ' ')
    .replace(/(?:^|\s)[àa]\s+vista\b/gi, ' ')
    // A forma de pagamento citada não faz parte do título ("TV no cartão Inter" → "TV")
    .replace(PAYMENT_TAIL, ' ')
    .replace(BANK_TAIL, ' ')
    .replace(PAYMENT_WORDS_AT_END, ' ')
    .replace(/^\s*(?:de|do|da|no|na|em|com|pelo|pela|um|uma|o|a|os|as|para|pra)\s+/i, '')
    .replace(/\s+/g, ' ')
    // "de" duplicado que sobra depois de tirar o valor ("pagamento de 200 de luz" → "pagamento de de luz")
    .replace(/\b(de|do|da|dos|das)\s+\1\b/gi, '$1')
    // "pagamento de luz" / "boleto da escola": o que importa é o que vem depois (sem nada depois, a palavra fica)
    .replace(/^\s*(?:(?:um|uma|o|a)\s+)?(?:pagamento|pagto|boleto|conta)\s+d[eoa]s?\s+(?=\S)/i, '')
    .replace(/[.!?,\s]+$/, '')
    .replace(/(?:\s+(?:de|do|da|no|na|em|por|com|e|para|pra))+$/i, '')
    .trim();
}

const PAYMENT_TAIL =
  /\s(?:no|na|com|pelo|pela|via|usando|em)\s+(?:(?:o|a|meu|minha)\s+)?(?:cart[aã]o|cr[eé]dito|d[eé]bito|pix|dinheiro|esp[eé]cie|boleto)(?:\s|$).*$/i;
// Forma de pagamento escrita no fim, sem preposição ("refeição cartão de crédito nubank" → "refeição"); só sai se sobra um título
const PAYMENT_WORDS_AT_END =
  /(?<=\S)\s+(?:cart[aã]o|cr[eé]dito|d[eé]bito|pix|dinheiro)(?:\s+(?:de|cart[aã]o|cr[eé]dito|d[eé]bito|nu ?bank|inter|ita[uú]|santander|bradesco|banco do brasil|caixa|c6|xp|btg|picpay|mercado ?pago|next|neon|sicoob|sicredi))*\s*$/i;
const BANK_TAIL =
  /\s(?:no|na|pelo|pela|via)\s+(?:banco\s+|conta\s+(?:do\s+|da\s+)?)?(?:nu ?bank|inter|ita[uú]|santander|bradesco|banco do brasil|caixa|c6|xp|btg|picpay|mercado ?pago|next|neon|sicoob|sicredi)\b.*$/i;

// ── Parcelas ──────────────────────────────────────────────────────────────────
const INSTALLMENT_RE =
  /(?:(?:dividid[oa]|parcelad[oa])\s+)?(?:em\s+)?\b(\d{1,2})\s*(?:x|vezes|parcelas|presta[cç][oõ]es)(?![\p{L}\d])(?:\s+(?:iguais\s+)?(?:de\s+)(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?))?(?:\s+sem\s+juros)?/iu;

/**
 * Parcelamento escrito na frase ("em 6x", "dividido em 6 vezes", "6x de 295,87"). Devolve o texto sem
 * esse trecho, para o número de parcelas não ser lido como valor nem ficar no título.
 */
export function parseInstallments(text: string): { count: number; perInstallment: number | null; rest: string } | null {
  const match = text.match(INSTALLMENT_RE);
  if (!match) return null;
  const count = Number(match[1]);
  if (count < 1 || count > 48) return null;
  return {
    count,
    perInstallment: match[2] ? parseAmount(match[2]) : null,
    rest: text.replace(match[0], ' '),
  };
}

/** Valores e vencimentos de uma compra parcelada: todo mês no mesmo dia, a última absorve os centavos. */
export function installmentSchedule(total: number, count: number, firstDue: string, day?: number): { amount: number; dueDate: string }[] {
  const per = Math.round((total / count) * 100) / 100;
  const [y, m, d] = firstDue.split('-').map(Number);
  const dayOfMonth = day || d;
  return Array.from({ length: count }, (_, i) => {
    const lastDay = new Date(y, m - 1 + i + 1, 0).getDate();
    const date = new Date(y, m - 1 + i, Math.min(dayOfMonth, lastDay));
    return {
      amount: i === count - 1 ? Math.round((total - per * (count - 1)) * 100) / 100 : per,
      dueDate: isoOf(date),
    };
  });
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

/**
 * A palavra-chave está no texto? Palavras curtas (luz, gás, bar) só valem inteiras: "gas" não é "gastei" e "bar" não é
 * "barbeiro". As maiores valem também como início ou meio de palavra ("supermercado", "farmacêutico").
 */
const hasKeyword = (t: string, keyword: string) => {
  const k = stripAccents(keyword);
  return k.length <= 3 ? new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`).test(t) : t.includes(k);
};

export function inferExpenseCategory(text: string): { title: string; category: string } | null {
  const t = stripAccents(text);
  const found = EXPENSE_CATEGORIES.find((c) => c.keywords.some((k) => hasKeyword(t, k)));
  return found ? { title: found.title, category: found.category } : null;
}

/** Categoria escolhida por uma sugestão (ex.: "🛒 Mercado"). */
export function categoryFromChip(text: string): { title: string; category: string } | null {
  const found = EXPENSE_CATEGORIES.find((c) => c.chip === text.trim());
  return found ? { title: found.title, category: found.category } : null;
}

/** Vencimento da fatura em que uma compra feita em `today` cai (mesma regra do lançamento manual). */
export function nextCardDueDate(closingDay: number, dueDay: number, today: Date = new Date()): string {
  return firstInvoiceDueDate(isoOf(today), closingDay, dueDay);
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

/** Compra parcelada: quantas vezes e o total (para mostrar o valor de cada parcela nas opções). */
export interface InstallmentPlan {
  count: number;
  total: number;
}

const planLabel = (plan: InstallmentPlan) => `${plan.count}x de ${brl(Math.round((plan.total / plan.count) * 100) / 100)}`;

export function paymentOptions(
  accounts: BankAccount[],
  cards: CreditCardItem[],
  category: string,
  plan?: InstallmentPlan
): CopilotInteractiveOption[] {
  const split = plan && plan.count >= 2 ? plan : undefined;
  const list: CopilotInteractiveOption[] = [
    ...accounts
      .filter((a) => a.type === 'CORRENTE' || a.type === 'CARTEIRA' || a.type === 'OUTRO')
      .map((a) => ({
        id: `opt_pay_${a.id}`,
        label: `${a.name} (conta / Pix)`,
        icon: a.icon || '🏦',
        badge: 'Débito na hora',
        description: split ? `${planLabel(split)} · a 1ª sai hoje da conta, as outras todo mês` : 'Sai agora do saldo da conta',
        payload: { bank: a.name, type: 'PAGAR' as const, category },
      })),
    ...cards.map((c) => {
      const dueDate = nextCardDueDate(c.closingDay, c.dueDay);
      return {
        id: `opt_pay_card_${c.id}`,
        label: c.bank || c.name,
        icon: '💳',
        badge: 'Cartão de crédito',
        description: split
          ? `${planLabel(split)} · a 1ª entra na fatura que vence em ${ddmm(dueDate)}`
          : `Entra na fatura que vence em ${ddmm(dueDate)}`,
        payload: { bank: c.bank || c.name, type: 'CARTAO' as const, category, dueDate, dueDay: c.dueDay },
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
    description: split ? `${planLabel(split)} · não mexe nas contas bancárias` : 'Não mexe nas contas bancárias',
    payload: { bank: CASH_IN_HAND, type: 'PAGAR', category },
  });
  return list;
}

export const OPTION_OTHER_PAYMENT = 'SHOW_ALL_PAYMENT';

const BANK_MENTIONS: { label: string; re: RegExp }[] = [
  { label: 'Nubank', re: /\bnu ?bank\b|\broxinho\b/ },
  { label: 'Inter', re: /\binter\b/ },
  { label: 'Itaú', re: /\bitau\b/ },
  { label: 'Santander', re: /\bsantander\b/ },
  { label: 'Bradesco', re: /\bbradesco\b/ },
  { label: 'Banco do Brasil', re: /\bbanco do brasil\b|\bbb\b/ },
  { label: 'Caixa', re: /\bcaixa\b/ },
  { label: 'C6', re: /\bc6\b/ },
  { label: 'XP', re: /\bxp\b/ },
  { label: 'BTG', re: /\bbtg\b/ },
  { label: 'PicPay', re: /\bpicpay\b/ },
  { label: 'Mercado Pago', re: /\bmercado ?pago\b/ },
  { label: 'Next', re: /\bnext\b/ },
  { label: 'Neon', re: /\bneon\b/ },
  { label: 'Sicoob', re: /\bsicoob\b/ },
  { label: 'Sicredi', re: /\bsicredi\b/ },
];
/** Palavras que não identificam uma conta ou cartão específico. */
const GENERIC_NAME_WORDS = new Set(['cartao', 'credito', 'debito', 'conta', 'corrente', 'banco', 'pix', 'meu', 'minha', 'de', 'do', 'da', 'black', 'gold', 'platinum']);
const nameWords = (name: string) =>
  stripAccents(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC_NAME_WORDS.has(w));

/** Palavras que podem vir logo depois de "cartão" sem ser o nome dele. */
const CARD_NAME_SKIP = new Set(['de', 'do', 'da', 'credito']);
const CARD_NAME_STOP = new Set([
  'no', 'na', 'em', 'e', 'com', 'o', 'a', 'um', 'uma', 'meu', 'minha', 'valor', 'pra', 'para', 'por', 'pelo', 'pela',
  'parcelado', 'parcelada', 'dividido', 'dividida', 'sem', 'juros', 'que', 'vezes', 'x', 'hoje', 'ontem', 'mesmo', 'debito',
]);
const capitalize = (w: string) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

/**
 * Cartão citado na frase: um banco conhecido ("cartão de crédito Inter") ou o nome logo depois de
 * "cartão" ("cartão da Renner", "cartão Principal"). Nulo quando só se disse "no cartão".
 */
export function mentionedCard(text: string): { label: string; re: RegExp } | null {
  const t = stripAccents(text);
  const after = t.match(/\b(?:cartao|credito)\b(.*)$/);
  if (after) {
    const words = after[1].split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (CARD_NAME_SKIP.has(w)) continue;
      if (CARD_NAME_STOP.has(w) || /^\d/.test(w)) break;
      // Banco conhecido começando aqui ("mercado pago", "banco do brasil")
      const known = BANK_MENTIONS.find((b) => words.slice(i).join(' ').search(b.re) === 0);
      if (known) return known;
      if (w.length >= 2) return { label: capitalize(w), re: new RegExp(`\\b${w}\\b`) };
      break;
    }
  }
  const bank = BANK_MENTIONS.find((b) => b.re.test(t));
  return bank && /\b(cartao|credito)\b/.test(t) ? bank : null;
}

export const OPTION_REGISTER_CARD = 'REGISTER_CARD';
export const NEW_CARD_DUE_CHIPS = ['Dia 5', 'Dia 10', 'Dia 15', 'Dia 20', 'Dia 25'];

export interface PaymentPick {
  question: string;
  /** Frase sobre a forma de pagamento reconhecida (vazia quando nada foi citado). */
  note: string;
  options: CopilotInteractiveOption[];
}

/**
 * Forma de pagamento citada na frase ("no cartão de crédito Inter", "no Pix do Nubank", "em dinheiro").
 * Cartão citado: confere se está cadastrado. Se está, mostra só ele para confirmar; se não, avisa e
 * oferece cadastrar na hora (ou escolher outro). Sempre há "Outra forma de pagamento".
 */
export function pickPaymentOptions(
  text: string,
  accounts: BankAccount[],
  cards: CreditCardItem[],
  category: string,
  plan?: InstallmentPlan
): PaymentPick {
  const all = paymentOptions(accounts, cards, category, plan);
  const t = stripAccents(text);
  const bank = BANK_MENTIONS.find((b) => b.re.test(t));
  const mentions = (name: string) => {
    const norm = stripAccents(name);
    return (!!bank && bank.re.test(norm)) || nameWords(name).some((w) => new RegExp(`\\b${w}\\b`).test(t));
  };

  const cardOpts = all.filter((o) => o.payload.type === 'CARTAO');
  const cashOpt = all.find((o) => o.payload.bank === CASH_IN_HAND);
  const accountOpts = all.filter((o) => o.payload.type === 'PAGAR' && o !== cashOpt);
  const cardOf = (o: CopilotInteractiveOption) => cards.find((x) => `opt_pay_card_${x.id}` === o.id);
  const cardText = (o: CopilotInteractiveOption) => {
    const c = cardOf(o);
    return c ? `${c.name} ${c.bank}` : o.label;
  };
  const accountText = (o: CopilotInteractiveOption) => {
    const a = accounts.find((x) => `opt_pay_${x.id}` === o.id);
    return a ? `${a.name} ${a.bankName || ''}` : o.label;
  };
  const other: CopilotInteractiveOption = {
    id: 'opt_pay_other',
    label: 'Outra forma de pagamento',
    icon: '↔️',
    description: 'Ver todas as contas e cartões',
    payload: { action: OPTION_OTHER_PAYMENT },
  };
  const register = (name?: string): CopilotInteractiveOption => ({
    id: 'opt_card_new',
    label: name ? `Cadastrar o cartão ${name}` : 'Cadastrar um cartão',
    icon: '➕',
    badge: 'Novo cartão',
    description: 'Pergunto o vencimento e o fechamento e já lanço a compra nele',
    payload: { action: OPTION_REGISTER_CARD, cardName: name || '' },
  });

  const saysCash = /\b(dinheiro|especie|em maos|cash)\b/.test(t);
  const saysDebit = /\b(pix|debito|transferencia|ted)\b/.test(t);
  const saysCard = !saysDebit && /\b(cartao|credito)\b/.test(t);
  const parcelado = !!plan && plan.count >= 2;

  if (saysCard) {
    const named = mentionedCard(text);
    if (named) {
      const matched = cardOpts.filter((o) => named.re.test(stripAccents(cardText(o))));
      if (matched.length === 1) {
        const c = cardOf(matched[0]);
        return {
          question: 'Confirma a forma de pagamento?',
          note: `Encontrei o seu cartão **${matched[0].label}** cadastrado${c ? ` (fecha dia ${c.closingDay}, vence dia ${c.dueDay})` : ''}.`,
          options: [...matched, other],
        };
      }
      if (matched.length > 1) {
        return { question: 'Em qual deles foi?', note: `Você tem ${matched.length} cartões **${named.label}** cadastrados.`, options: [...matched, other] };
      }
      return {
        question: cardOpts.length > 0 ? `Quer cadastrar o ${named.label} agora ou foi em outro cartão?` : `Quer cadastrar o ${named.label} agora?`,
        note: `O cartão **${named.label}** ainda não está cadastrado.`,
        options: [register(named.label), ...cardOpts, other],
      };
    }
    if (cardOpts.length === 0) {
      return { question: 'Quer cadastrar o cartão agora?', note: 'Você ainda não tem cartão de crédito cadastrado.', options: [register(), other] };
    }
    if (cardOpts.length === 1) {
      return { question: 'Confirma a forma de pagamento?', note: `No seu cartão **${cardOpts[0].label}**.`, options: [...cardOpts, register(), other] };
    }
    return { question: 'Em qual cartão foi?', note: '', options: [...cardOpts, register(), other] };
  }

  let shortlist: CopilotInteractiveOption[] = [];
  if (saysCash && cashOpt) {
    shortlist = [cashOpt];
  } else if (saysDebit) {
    const matched = accountOpts.filter((o) => mentions(accountText(o)));
    shortlist = matched.length > 0 ? matched : accountOpts;
  } else if (bank || cardOpts.some((o) => mentions(cardText(o))) || accountOpts.some((o) => mentions(accountText(o)))) {
    // Só o banco foi citado ("no Inter"): parcelado costuma ser cartão
    const matchedCards = cardOpts.filter((o) => mentions(cardText(o)));
    const matchedAccounts = accountOpts.filter((o) => mentions(accountText(o)));
    shortlist = parcelado && matchedCards.length > 0 ? matchedCards : [...matchedCards, ...matchedAccounts];
  } else if (parcelado && cardOpts.length > 0) {
    // Parcelado sem dizer como: os cartões vêm primeiro
    return { question: 'Em qual cartão foi?', note: '', options: [...cardOpts, ...all.filter((o) => !cardOpts.includes(o))] };
  }

  const note = shortlist.length === 1 ? `${shortlist[0].payload.type === 'CARTAO' ? 'No cartão' : 'Com'} **${shortlist[0].label}**.` : '';
  if (shortlist.length === 0 || shortlist.length === all.length) {
    return { question: 'Como você pagou?', note, options: all };
  }
  return {
    question: shortlist.length === 1 ? 'Confirma a forma de pagamento?' : 'Como você pagou?',
    note,
    options: [...shortlist, other],
  };
}

/**
 * Ponto de partida do registro em etapas, a partir do que a pessoa já disse (a frase, o banco escolhido):
 * dinheiro, banco, crédito ou débito. Só pergunta o que ficou em aberto, sem repetir o que já se sabe.
 * Devolve null quando nada foi dito (o registro começa em "banco ou dinheiro?").
 */
export function presetPaymentWizard(hint: string, institutions: PaymentInstitution[], installments = 1): PaymentWizardState | null {
  const t = stripAccents(hint);
  if (/\b(dinheiro|especie|em maos|cash)\b/.test(t)) return { step: 'SUMMARY', where: 'CASH', installments: 1 };
  const saysDebit = /\b(pix|debito|transferencia|ted)\b/.test(t);
  const saysCard = !saysDebit && /\b(cartao|credito)\b/.test(t);
  const bankRe = BANK_MENTIONS.find((b) => b.re.test(t));
  const mentioned = institutions.filter(
    (i) => (!!bankRe && bankRe.re.test(stripAccents(i.name))) || nameWords(i.name).some((w) => new RegExp(`\\b${w}\\b`).test(t))
  );
  const inst = mentioned.length === 1 ? mentioned[0] : undefined;
  if (!inst) return saysCard ? { step: 'BANK', where: 'BANK', method: 'CREDITO', installments } : null;
  if (saysCard && !inst.noCredit) {
    // A fatura é do banco: sem fechamento e vencimento conhecidos, pergunta só isso
    return { step: inst.terms ? 'SUMMARY' : 'INVOICE', where: 'BANK', institution: inst.name, method: 'CREDITO', installments };
  }
  if (saysDebit || inst.noCredit) return { step: 'SUMMARY', where: 'BANK', institution: inst.name, method: 'DEBITO', installments: 1 };
  return { step: 'METHOD', where: 'BANK', institution: inst.name, installments };
}

// ── Dúvidas ───────────────────────────────────────────────────────────────────
export type DoubtId =
  | 'MENU'
  | 'BOM_DIA'
  | 'MEMORIAS'
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
  | 'ONDE_VER'
  | 'ULTIMAS'
  | 'GASTOS_PERIODO'
  | 'PREVISTO_REAL'
  | 'SEM_NATUREZA'
  | 'GASTOS_DETALHE';

/** Período citado numa pergunta de gastos ("hoje", "esta semana", "na quinzena", "este mês"). */
export function spendPeriodFrom(text: string): SpendPeriod | null {
  const t = stripAccents(text);
  if (/\bhoje\b/.test(t)) return 'HOJE';
  if (/semana/.test(t)) return 'SEMANA';
  if (/quinzena/.test(t)) return 'QUINZENA';
  if (/\b(mes|mensal)\b/.test(t)) return 'MES';
  return null;
}

/** Pergunta sobre previsto x realizado: "previsto que não foi registrado", "previsto e pagamos menos". */
export function isPlannedVsReal(text: string): boolean {
  const t = stripAccents(text);
  if (!/previst|\bprevi\b|planejad|orcad/.test(t)) return false;
  return /(nao|n)\s+(foi|fo[ir]am|ser[aã]o)?\s*(gast|pag|registr|realiz|lanc|confirm)|sem (registro|lancar|pagar|confirmar)|(pag|gast)(amos|uei|ou|aram)\s+(a )?menos|a menos|menos (do )?que|abaixo do previst|economi|sobrou do previst/.test(t);
}

/** "O que é esse gasto da natureza Outros": quer ver o que há em "Outros", não a definição de natureza. */
export function isOthersQuestion(text: string): boolean {
  const t = stripAccents(text);
  return (
    (/\boutros\b/.test(t) && /(natureza|categoria|gasto|valor|item|itens|lancamento)/.test(t)) ||
    /\bo que (tem|ha|esta|ta) (la )?(dentro )?(d[eo]|em|no)s? outros\b/.test(t) ||
    /sem (natureza|categoria)/.test(t)
  );
}

/**
 * Uma regra de dúvida. `patterns` casa com o texto sem acentos; `test` cobre o que uma regex sozinha não diz
 * (combinações e funções). A regra vale se qualquer um dos dois casar.
 */
interface DoubtRule {
  id: DoubtId;
  patterns?: RegExp[];
  test?: (t: string, raw: string) => boolean;
}

/**
 * Regras de dúvida, da mais específica para a mais geral: a PRIMEIRA que casar vence, então a ordem é a prioridade.
 * Para uma frase nova: acrescente o caso em forsetiEvalCases.ts e depois a regra (ou uma palavra-chave) aqui,
 * antes de qualquer regra mais geral que a engoliria (ex.: "reserva" casa com qualquer frase que a contenha).
 */
const DOUBT_RULES: DoubtRule[] = [
  { id: 'BOM_DIA', test: (_t, raw) => isDigestRequest(raw) },
  { id: 'MEMORIAS', patterns: [/o que (voce )?(sabe|lembra|guardou|anotou) (sobre|de) mim|minhas memorias|o que (voce )?lembra de mim|memoria da forseti/] },
  { id: 'MENU', test: (t) => t.includes('tenho uma duvida') || t === 'duvida' || t === 'duvidas' || t.includes('outra duvida') },
  { id: 'SALDO_HOJE', patterns: [/saldo (de )?hoje|quanto tenho|quanto eu tenho\??$|^saldo\??$|meu saldo( atual)?\??$|saldo atual|saldo em conta/] },
  { id: 'PROXIMO_RECEB', patterns: [/quando (entra|recebo|cai|vou receber)|proximo recebimento|proxima entrada|quando o salario/] },
  { id: 'SOBRA', patterns: [/quanto (ainda )?(posso|consigo) gastar|sobrou|sobra |quanto (me )?sobra|livre para gastar/] },
  { id: 'VENCE', patterns: [/vence|vencimento|a pagar essa semana|contas? (atrasad|em atraso)|proximos dias/] },
  { id: 'PREVISTO_REAL', test: (t) => isPlannedVsReal(t) },
  { id: 'SEM_NATUREZA', test: (t) => isOthersQuestion(t) },
  { id: 'ULTIMAS', patterns: [/ultim[oa]s? (compras?|gastos?|saidas?|despesas?|pagamentos?|lancamentos?|movimentac)|(compras?|gastos?) recentes?|o que (eu )?(comprei|gastei|paguei) (recentemente|ultimamente)/] },
  // Gastos com assunto ou período específico ("com mercado em setembro", "no mês passado"): a resposta com detalhe
  { id: 'GASTOS_DETALHE', test: (_t, raw) => !!detectSpendDetail(raw) },
  // "Gastos por natureza / categoria" (com ou sem período): quebra dos gastos por natureza
  { id: 'GASTOS_PERIODO', test: (t) => /(gastos?|despesas?|saidas?|gastei)/.test(t) && /(por|de cada|em cada|em quais) (natureza|categoria|origem)/.test(t) },
  // "Este mês" segue para a resposta do mês (GASTEI), que traz a projeção completa
  {
    id: 'GASTOS_PERIODO',
    test: (t) => {
      const period = spendPeriodFrom(t);
      return !!period && period !== 'MES' && /gastos?|despesas?|saidas?|gastei|paguei|quanto sai/.test(t);
    },
  },
  { id: 'GASTEI', patterns: [/quanto (ja )?gastei|ja gastei|meus gastos|gastos (d[eo]|d?este|d?esse|no) mes|gastei (esse|este|no) mes/] },
  { id: 'CAIU', patterns: [/(por ?que|porque).*(caiu|diminuiu|baixou|negativo|saldo)/] },
  { id: 'RESERVA', patterns: [/reserva/] },
  { id: 'METAS', patterns: [/\bmetas?\b/] },
  { id: 'QUITAR', patterns: [/quita|quitar|amortiz|antecipar parcela/] },
  { id: 'COMPRA', patterns: [/posso comprar|da pra comprar|consigo comprar|vale a pena comprar|\bcarro\b|financiar/] },
  { id: 'COMO_FUNCIONA', patterns: [/como funciona|o que (voce|vc) faz|me ajuda|^ajuda|como usar/] },
  { id: 'GLOSSARIO', patterns: [/o que (e|sao|significa)\b/] },
  { id: 'ONDE_VER', patterns: [/^ver |onde (vejo|fica|encontro)/] },
];

/** Reconhece uma dúvida no texto (antes de tentar ler como gasto/recebimento: "quanto já gastei" não é um gasto). */
export function detectDoubt(text: string): DoubtId | null {
  const t = stripAccents(text);
  const rule = DOUBT_RULES.find((r) => r.patterns?.some((re) => re.test(t)) || r.test?.(t, text));
  return rule?.id ?? null;
}

export interface ForsetiReply {
  text: string;
  badge: string;
  chips: string[];
  /** Opções que a pessoa escolhe com um toque; `send` é a frase enviada à Forseti ao escolher. */
  choices?: { label: string; send: string }[];
  /** Ação proposta junto da resposta (botões Confirmar / Cancelar). */
  pendingAction?: ForsetiPendingAction;
  /** Assunto e período respondidos numa pergunta de gastos com detalhe ("e no mês passado?" continua daqui). */
  spendQuery?: SpendQuery & { range: SpendRange };
}

export interface ForsetiData {
  /** Nome de quem conversa (só para a saudação do briefing). */
  userName?: string;
  /** O que a pessoa pediu para a Forseti lembrar (entra no briefing e nas respostas de compra e quitação). */
  memories?: ForsetiMemory[];
  /** Naturezas do planejamento (para mostrar gastos por natureza). */
  natures?: ExpenseNature[];
  /** Natureza sugerida (por palavras-chave e nomes) para cada lançamento sem natureza, por id do lançamento. */
  natureSuggestions?: Record<string, { natureId: string; natureName: string }>;
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
const NO_NATURE = 'Sem natureza';
// "Sem natureza" segue a mesma regra do resto do app (vínculo direto, mapeamento/item ou categoria com o nome da natureza)
const natureIdOf = (m: Movement, natures?: ExpenseNature[]): string | undefined =>
  natures ? resolveMovementNatureId(m, natures) : m.natureId && m.natureId.toLowerCase() !== 'outros' ? m.natureId : undefined;

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

export function answerDoubt(id: DoubtId, text: string, d: ForsetiData, opts?: { period?: SpendPeriod; spend?: SpendQuery; today?: Date }): ForsetiReply {
  const month = d.forecasts.MES;
  switch (id) {
    case 'MENU':
      return {
        text: 'Claro! Sobre o que é a sua dúvida? Escolha uma das opções abaixo ou escreva do seu jeito.',
        badge: 'DÚVIDAS',
        chips: DOUBT_CHIPS,
      };

    case 'BOM_DIA':
      return {
        text: buildDigest(d, opts?.today, d.userName).text,
        badge: 'BOM DIA',
        chips: ['O que vence nos próximos dias?', 'Quanto ainda posso gastar este mês?', CHIP_PAGAR],
      };

    case 'MEMORIAS':
      return {
        text: memoriesText(d.memories),
        badge: 'MEMÓRIA',
        chips: ['Como funciona o Balder?', CHIP_DUVIDA],
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
        text: `${parts.join('\n\n')}${rest > 0 ? `\n\n…e mais ${rest} item(ns). A lista completa está no Início, em "Em aberto".` : ''}\n\nSe algum já foi pago, é só me contar (ex.: "paguei a energia") para o saldo ficar certo.`,
        badge: 'VENCIMENTOS',
        chips: [CHIP_PAGAR, 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA],
      };
    }

    case 'ULTIMAS': {
      const paid = d.movements
        .filter((m) => m.status === 'REALIZADA' && !isIncomeMovement(m))
        .sort((a, b) => outflowDate(b).localeCompare(outflowDate(a)))
        .slice(0, 8);
      if (paid.length === 0) {
        return {
          text: 'Ainda não há saídas confirmadas para mostrar. Quando você registrar ou confirmar um pagamento, ele aparece aqui.',
          badge: 'ÚLTIMAS SAÍDAS',
          chips: [CHIP_PAGAR, CHIP_ANEXAR, CHIP_DUVIDA],
        };
      }
      const lines = paid.map((m) => `• ${ddmm(outflowDate(m))} · ${m.title} — **${brl(outflowValue(m))}**${m.category ? ` _(${m.category})_` : ''}`);
      const total = paid.reduce((acc, m) => acc + outflowValue(m), 0);
      return {
        text: `${paid.length === 1 ? 'Sua **última saída** já paga' : `Suas **últimas ${paid.length} saídas** já pagas`}:\n\n${lines.join('\n')}${paid.length > 1 ? `\n\nJuntas, somam **${brl(total)}**.` : ''}`,
        badge: 'ÚLTIMAS SAÍDAS',
        chips: ['Quanto já gastei este mês?', 'Gastos desta semana', CHIP_PAGAR],
      };
    }

    case 'GASTOS_DETALHE': {
      const today = opts?.today ?? new Date();
      const query = opts?.spend ?? detectSpendDetail(text, today) ?? { subject: spendSubjectWords(text).subject, range: parseSpendRange(text, today) || undefined };
      const answer = answerSpendDetail(query, d.movements, d.natures || [], today);
      return { text: answer.text, badge: 'GASTOS COM DETALHE', chips: answer.chips, spendQuery: answer.query };
    }

    case 'GASTOS_PERIODO': {
      const period = opts?.period || spendPeriodFrom(text) || 'MES';
      const today = new Date();
      const todayIso = isoDay(today);
      const range = period === 'HOJE' ? { from: todayIso, to: todayIso } : trackingPeriodRange(period, today);
      const label = { HOJE: 'hoje', SEMANA: 'desta semana', QUINZENA: 'desta quinzena', MES: 'deste mês' }[period];
      const nameOf = (id?: string) => d.natures?.find((n) => n.id === id)?.name || '';
      const inRange = (date: string) => date >= range.from && date <= range.to;
      const paid = d.movements.filter((m) => !isIncomeMovement(m) && m.status === 'REALIZADA' && outflowValue(m) > 0.004 && inRange(outflowDate(m)));
      // A pagar no período: o que a projeção ainda espera (contas, faturas e itens das naturezas, inclusive vencidos)
      const window = d.forecasts[period === 'HOJE' ? 'SEMANA' : period];
      const pending = (window?.entries || []).filter((e) => e.kind === 'SAIDA' && (period !== 'HOJE' || e.date <= todayIso));
      const paidTotal = paid.reduce((acc, m) => acc + outflowValue(m), 0);
      const plannedTotal = pending.reduce((acc, e) => acc + e.amount, 0);
      const heading = `**Gastos ${label}** (${period === 'HOJE' ? ddmm(range.from) : `${ddmm(range.from)} a ${ddmm(range.to)}`})`;
      if (paid.length === 0 && pending.length === 0) {
        return {
          text: `${heading}\n\nNão há saídas pagas nem previstas neste período.`,
          badge: 'GASTOS DO PERÍODO',
          chips: [CHIP_PAGAR, 'Quanto já gastei este mês?', CHIP_DUVIDA],
        };
      }
      // Origens do gasto: naturezas (planejamento), contratos (empréstimos) e faturas de cartão
      type Origin = 'NATUREZA' | 'CONTRATO' | 'FATURA';
      const ORIGINS: { id: Origin; label: string }[] = [
        { id: 'NATUREZA', label: 'Naturezas' },
        { id: 'CONTRATO', label: 'Contratos (empréstimos)' },
        { id: 'FATURA', label: 'Faturas de cartão' },
      ];
      // real = o que já foi pago; previsto = o esperado no período (o que estava previsto nos pagos + o que ainda falta pagar)
      type Row = { real: number; plan: number; count: number; detail?: string };
      const groups = new Map<Origin, Map<string, Row>>();
      const add = (origin: Origin, name: string, v: { real: number; plan: number }, detail?: string) => {
        const g = groups.get(origin) || new Map<string, Row>();
        const r = g.get(name) || { real: 0, plan: 0, count: 0 };
        r.real += v.real;
        r.plan += v.plan;
        r.count += 1;
        if (detail) r.detail = detail;
        g.set(name, r);
        groups.set(origin, g);
      };
      const contractName = (title: string) => title.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || title;
      // Fatura: o total vai para a fatura; o que já foi analisado por natureza vira só um detalhe
      const invoiceDetail = (m: Movement) => {
        const items = (m.invoiceBreakdown || []).filter((b) => b.isAnalyzed && b.natureId && b.natureId.toLowerCase() !== 'outros');
        if (items.length === 0) return undefined;
        const byName = new Map<string, number>();
        items.forEach((b) => byName.set(nameOf(b.natureId) || b.natureName, (byName.get(nameOf(b.natureId) || b.natureName) || 0) + b.amount));
        const top = [...byName.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
        return top.map(([n, v]) => `${n} ${brl(v)}`).join(' · ');
      };
      const place = (m: Movement, v: { real: number; plan: number }) => {
        if (m.type === 'EMPRESTIMO') return add('CONTRATO', contractName(m.title), v);
        if (m.type === 'CARTAO') return add('FATURA', m.title, v, invoiceDetail(m));
        add('NATUREZA', nameOf(natureIdOf(m, d.natures)) || NO_NATURE, v);
      };
      const byId = new Map(d.movements.map((m) => [m.id, m]));
      paid.forEach((m) => place(m, { real: outflowValue(m), plan: m.amount }));
      pending.forEach((e) => {
        const v = { real: 0, plan: e.amount };
        if (e.source === 'NATUREZA') return add('NATUREZA', nameOf(e.natureId) || NO_NATURE, v);
        const mov = byId.get(e.id);
        if (mov) return place(mov, v);
        if (e.source === 'PARCELA') return add('CONTRATO', contractName(e.title), v);
        if (e.source === 'FATURA') return add('FATURA', e.title, v);
        add('NATUREZA', NO_NATURE, v);
      });
      // Real / Previsto: real verde dentro do previsto, vermelho quando passou
      const realVsPlan = (real: number, plan: number) => `{${real <= plan + 0.005 ? 'ok' : 'bad'}|${brl(real)}} / ${brl(plan)}`;
      const itemsLabel = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;
      const sections = ORIGINS.flatMap(({ id, label }) => {
        const g = groups.get(id);
        if (!g) return [];
        const entries = [...g.entries()].sort((x, y) => y[1].plan + y[1].real - (x[1].plan + x[1].real));
        const sum = entries.reduce((acc, [, v]) => ({ real: acc.real + v.real, plan: acc.plan + v.plan, count: acc.count + v.count }), { real: 0, plan: 0, count: 0 });
        const shown = entries.slice(0, 6);
        const lines = shown.map(
          ([name, v]) => `• **${name}:** ${itemsLabel(v.count)}\n   ${realVsPlan(v.real, v.plan)}${v.detail ? `\n   ↳ já detalhado por natureza: ${v.detail}` : ''}`
        );
        if (entries.length > shown.length) lines.push(`…e mais ${entries.length - shown.length}.`);
        return [`**${label}:** ${itemsLabel(sum.count)}\n${realVsPlan(sum.real, sum.plan)}\n${lines.join('\n')}`];
      });
      const parts = [
        heading,
        `• Já pago: **${brl(paidTotal)}** (${paid.length} ${paid.length === 1 ? 'saída' : 'saídas'})`,
        `• Ainda a pagar: **${brl(plannedTotal)}** (${pending.length} ${pending.length === 1 ? 'item' : 'itens'})`,
        `\n**Por origem do gasto** *(real / previsto: verde dentro do previsto, vermelho acima)*:\n\n${sections.join('\n\n')}`,
      ];
      const hasOthers = groups.get('NATUREZA')?.has(NO_NATURE);
      return {
        text: parts.join('\n'),
        badge: 'GASTOS DO PERÍODO',
        chips: [...(hasOthers ? ['Gastos sem natureza'] : []), 'Últimas compras', 'O que vence nos próximos dias?'],
      };
    }

    case 'SEM_NATUREZA': {
      const period = opts?.period || spendPeriodFrom(text) || 'MES';
      const today = new Date();
      const range = period === 'HOJE' ? { from: isoDay(today), to: isoDay(today) } : trackingPeriodRange(period, today);
      const label = { HOJE: 'hoje', SEMANA: 'desta semana', QUINZENA: 'desta quinzena', MES: 'deste mês' }[period];
      // Só despesas avulsas: parcelas de empréstimo e faturas têm tratamento próprio (não são "sem natureza")
      const list = d.movements
        .filter((m) => m.type === 'PAGAR' && m.status !== 'CANCELADA' && outflowValue(m) > 0.004 && !natureIdOf(m, d.natures) && outflowDate(m) >= range.from && outflowDate(m) <= range.to)
        .sort((a, b) => outflowDate(b).localeCompare(outflowDate(a)) || outflowValue(b) - outflowValue(a));
      const heading = `**Gastos sem natureza ${label}** (${period === 'HOJE' ? ddmm(range.from) : `${ddmm(range.from)} a ${ddmm(range.to)}`})`;
      if (list.length === 0) {
        return {
          text: `${heading}\n\nNenhuma despesa está sem natureza neste período. 👏`,
          badge: 'SEM NATUREZA',
          chips: ['Gastos por origem', 'Últimas compras', CHIP_DUVIDA],
        };
      }
      const total = list.reduce((acc, m) => acc + outflowValue(m), 0);
      const shown = list.slice(0, 10);
      const suggestion = (m: Movement) => d.natureSuggestions?.[m.id];
      const lines = shown.map((m) => {
        const sug = suggestion(m);
        return `• ${ddmm(outflowDate(m))} · ${m.title} — **${brl(outflowValue(m))}**${m.status === 'REALIZADA' ? '' : ' _(previsto)_'}${sug ? `\n   ↳ sugestão: **${sug.natureName}**` : ''}`;
      });
      const assignments = list
        .filter((m) => suggestion(m))
        .slice(0, 20)
        .map((m) => ({ movementId: m.id, title: m.title, natureId: suggestion(m)!.natureId, natureName: suggestion(m)!.natureName }));
      const noSuggestion = list.length - list.filter((m) => suggestion(m)).length;
      const parts = [
        `${heading}\n${list.length} ${list.length === 1 ? 'despesa' : 'despesas'}, **${brl(total)}**:`,
        lines.join('\n'),
      ];
      if (list.length > shown.length) parts.push(`…e mais ${list.length - shown.length}.`);
      if (assignments.length > 0) {
        parts.push(`Encontrei a natureza provável de **${assignments.length}** ${assignments.length === 1 ? 'despesa' : 'despesas'} pelo nome e pelas palavras-chave. Quer associar agora?`);
      }
      if (noSuggestion > 0) {
        parts.push(`${noSuggestion} sem sugestão: abra o lançamento em *Lançamentos* e escolha a natureza (ou cadastre palavras-chave na natureza para eu reconhecer da próxima vez).`);
      }
      return {
        text: parts.join('\n\n'),
        badge: 'SEM NATUREZA',
        chips: ['Gastos por origem', 'Últimas compras'],
        ...(assignments.length > 0
          ? {
              pendingAction: {
                kind: 'ASSIGN_NATURES' as const,
                request: text,
                title: `Associar ${assignments.length} ${assignments.length === 1 ? 'despesa' : 'despesas'} às naturezas sugeridas?`,
                details: [],
                assignments,
              },
            }
          : {}),
      };
    }

    case 'PREVISTO_REAL': {
      const monthStart = `${isoDay(new Date()).slice(0, 7)}-01`;
      const less = d.movements
        .filter(
          (m) =>
            !isIncomeMovement(m) &&
            m.status === 'REALIZADA' &&
            outflowDate(m) >= monthStart &&
            m.actualAmount !== undefined &&
            m.actualAmount < m.amount - 0.005
        )
        .sort((a, b) => b.amount - b.actualAmount! - (a.amount - a.actualAmount!));
      const overdue = (d.forecasts.MES?.entries || []).filter((e) => e.kind === 'SAIDA' && e.overdue).sort((a, b) => b.amount - a.amount);
      if (less.length === 0 && overdue.length === 0) {
        return {
          text: 'Tudo o que estava previsto até agora foi registrado, e nenhum pagamento saiu abaixo do previsto neste mês. ✅',
          badge: 'PREVISTO x REAL',
          chips: ['Quanto já gastei este mês?', 'O que vence nos próximos dias?', CHIP_DUVIDA],
        };
      }
      const parts: string[] = [];
      if (overdue.length > 0) {
        const total = overdue.reduce((acc, e) => acc + e.amount, 0);
        const shown = overdue.slice(0, 8);
        parts.push(
          `**Previstos que venceram e ainda não foram registrados** — ${overdue.length} ${overdue.length === 1 ? 'item' : 'itens'}, **${brl(total)}**:\n${shown.map(entryLine).join('\n')}${overdue.length > shown.length ? `\n…e mais ${overdue.length - shown.length}.` : ''}\nSe já pagou algum, me conte (ex.: *"paguei a energia"*) para o saldo ficar certo.`
        );
      }
      if (less.length > 0) {
        const saved = less.reduce((acc, m) => acc + (m.amount - m.actualAmount!), 0);
        const shown = less.slice(0, 8);
        parts.push(
          `**Pagos por menos que o previsto** — economia de **${brl(saved)}**:\n${shown
            .map((m) => `• ${ddmm(outflowDate(m))} · ${m.title}: previsto ${brl(m.amount)} → pago **${brl(m.actualAmount!)}**`)
            .join('\n')}${less.length > shown.length ? `\n…e mais ${less.length - shown.length}.` : ''}`
        );
      }
      return {
        text: parts.join('\n\n'),
        badge: 'PREVISTO x REAL',
        chips: ['O que vence nos próximos dias?', 'Quanto já gastei este mês?', CHIP_PAGAR],
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
          text: `Hoje eu não recomendo assumir ${what} parcelado: nos próximos 30 dias, o que sai é maior que o que entra (resultado de ${brl(free)}).\n\nO primeiro passo é abrir espaço no orçamento — posso te mostrar o que vence e quanto já gastou.${memoryNote(d.memories, 'COMPRA')}`,
          badge: 'DECISÃO DE COMPRA',
          chips: ['O que vence nos próximos dias?', 'Quanto já gastei este mês?', CHIP_DUVIDA],
        };
      }
      const safeInstallment = free * 0.3;
      const reserveOk = d.emergencyReserveMonths >= 6;
      return {
        text: `Para ${what}, olho três coisas:\n\n• **Sobra mensal prevista:** ${brl(free)}\n• **Parcela confortável:** até **${brl(safeInstallment)}** (30% da sobra), para não travar suas metas\n• **Reserva de emergência:** ${months1(d.emergencyReserveMonths)} meses ${reserveOk ? '✅' : '⚠️ (o ideal é 6+ antes de assumir parcelas longas)'}\n\n${reserveOk ? 'Se a parcela couber nesse limite, a compra é viável.' : 'Antes de comprar, vale reforçar a reserva — ou dar uma entrada maior para a parcela ficar menor.'} Para testar valores exatos, use **Ações Rápidas › Simular decisão** no Painel.${memoryNote(d.memories, 'COMPRA')}`,
        badge: 'DECISÃO DE COMPRA',
        chips: ['Como está minha reserva de emergência?', 'Vale a pena quitar meu empréstimo?', CHIP_DUVIDA],
      };
    }

    case 'QUITAR': {
      const open = d.movements.filter((m) => m.type === 'EMPRESTIMO' && m.category !== 'Recebimento' && m.status === 'PREVISTA');
      if (open.length === 0) {
        return {
          text: 'Não encontrei parcelas de empréstimo em aberto. 👏 Se tiver um empréstimo que ainda não cadastrou, adicione em **Contratos › Empréstimos** para eu acompanhar.',
          badge: 'EMPRÉSTIMOS',
          chips: [CHIP_DUVIDA],
        };
      }
      const total = open.reduce((a, m) => a + m.amount, 0);
      const last = open.reduce((max, m) => (m.dueDate > max ? m.dueDate : max), open[0].dueDate);
      const reserveOk = d.emergencyReserveMonths >= 6;
      return {
        text: `Você tem **${open.length} parcela(s)** em aberto, somando **${brl(total)}**, até ${last.split('-').reverse().join('/')}.\n\nAo antecipar parcelas, o banco é obrigado a tirar os **juros das parcelas futuras** (Código de Defesa do Consumidor, art. 52, § 2º) — por isso quitar costuma valer a pena quando:\n• os juros do empréstimo são maiores que o rendimento do seu dinheiro guardado;\n• você **não** precisa usar a reserva de emergência para isso${reserveOk ? ' (a sua está em dia ✅)' : ' (a sua está abaixo de 6 meses ⚠️)'}.\n\nEm **Contratos › Empréstimos › Antecipar parcelas** você vê exatamente quanto economiza.${memoryNote(d.memories, 'QUITAR')}`,
        badge: 'EMPRÉSTIMOS',
        chips: ['Como está minha reserva de emergência?', 'Quanto ainda posso gastar este mês?', CHIP_DUVIDA],
      };
    }

    case 'COMO_FUNCIONA':
      return {
        text: 'O Balder organiza o seu dinheiro em 3 ideias: **o que você tem hoje**, **o que vai entrar e sair** e **para onde quer chegar**.\n\n• **Início:** saldo de hoje, o que fazer agora e gastos do período\n• **Painel:** a competência **Atual**, a **Projeção** mês a mês, as **Naturezas** e as **Metas**\n• **Movimentações:** tudo o que entrou e saiu, com filtros\n• **Faturas:** importe a fatura do cartão e distribua nas naturezas\n• **Naturezas:** seus gastos previstos (contas fixas, rotinas de mercado…)\n• **Contratos:** empréstimos (parcelas, simulações e antecipação) e simulação de financiamentos\n• **Compartilhar:** planeje junto com outra pessoa\n\nE eu, a Forseti, registro o que você me contar, leio fotos de comprovantes e respondo dúvidas com os seus números.\n\n💬 **Quer ajudar o Balder a evoluir?** Me conte uma sugestão, um problema ou um elogio: eu encaminho direto para os gestores. É só dizer *"quero dar um feedback"*.',
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
        : t.includes('financiamento')
        ? '**Contratos › Financiamentos**'
        : t.includes('emprestimo')
        ? '**Contratos › Empréstimos**'
        : '**Painel**';
      return {
        text: `Você encontra isso em ${where}: no celular, pelo botão de menu no canto inferior; no computador, pela barra lateral.`,
        badge: 'NAVEGAÇÃO',
        chips: MORE,
      };
    }
  }
}

/** Acabaram os pedidos à IA desta hora: a Forseti diz isso e segue só com as regras. */
export const AI_LIMIT_TEXT =
  '⏳ Já usei todos os pedidos de IA desta hora, então só consigo entender frases pelas regras do app. Tente de outro jeito (ex.: *"quanto sobrou este mês?"*) ou volte daqui a pouco.';
export const withAiLimitNote = (r: ForsetiReply): ForsetiReply => ({ ...r, text: `${AI_LIMIT_TEXT}\n\n${r.text}` });

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
    // Financiamento é outra coisa: um bem (carro, imóvel) com entrada, SAC/Price e saldo devedor
    keys: /financiamento|financiar|financiad/,
    question: 'Você está falando de **financiamento** (de um bem, como carro ou imóvel). É sobre:',
    options: [
      { chip: 'Posso comprar um carro?', meaning: 'ver se a parcela de um bem financiado cabe no orçamento' },
      { chip: 'Abrir financiamentos', meaning: 'simular financiamento (SAC e Price) em Contratos' },
    ],
  },
  {
    keys: /emprestimo|consignado|parcela/,
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
      { chip: CHIP_PAGAR_CARTAO, meaning: 'registrar uma compra feita no cartão' },
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

/**
 * Frase com valor que nenhuma regra nem a IA entendeu ("30 bebidas da refeição"): em vez de "não entendi",
 * pergunta se é gasto ou recebimento. Cada opção reenvia a frase já limpa (valor e título), no formato que as regras entendem.
 */
export function detectLooseAmount(text: string): ForsetiReply | null {
  if (isQuestion(text)) return null;
  const amount = parseAmount(text);
  if (amount === null) return null;
  // Sem "R$"/"reais", o número pode ser outra coisa ("parcela 12"): deixa as perguntas de ambiguidade responderem
  if (!/r\$|\breais?\b/i.test(text) && detectAmbiguity(text)) return null;
  const title = titleFrom(text);
  const what = `**${brl(amount)}**${title ? ` (${title})` : ''}`;
  const rest = `${brl(amount)}${title ? ` ${title}` : ''}`;
  return {
    text: `Entendi o valor ${what}. Isso é um gasto ou um recebimento?\n\nToque na opção ou escreva de outro jeito.`,
    badge: 'SÓ PARA CONFIRMAR',
    chips: [],
    choices: [
      { label: 'A) um gasto (saiu dinheiro)', send: `Paguei ${rest}` },
      { label: 'B) um recebimento (entrou dinheiro)', send: `Recebi ${rest}` },
    ],
  };
}

/**
 * Frase limpa a partir do registro que a IA entendeu ("Paguei R$ 100,00 Pix para minha sogra"), no formato
 * que as regras já entendem: assim a IA só interpreta e o registro segue o mesmo fluxo guiado, com confirmação.
 */
export function registrationPhrase(r: ForsetiRegistration): string {
  const verb = r.kind === 'PAGAR' ? (r.future ? 'Agendei' : 'Paguei') : r.future ? 'Vou receber' : 'Recebi';
  const amount = brl(r.amount).replace(/\u00a0/g, ' ');
  // Pagamento feito conta hoje; só o que vai acontecer (ou o recebimento) leva a data da frase
  const date = r.date && (r.future || r.kind === 'RECEBER') ? `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}/${r.date.slice(0, 4)}` : '';
  return [verb, amount, r.title, date].filter(Boolean).join(' ');
}

export function detectAmbiguity(text: string): ForsetiReply | null {
  const t = stripAccents(text);
  const found = AMBIGUOUS.find((a) => a.keys.test(t));
  if (!found) return null;
  const letters = ['A', 'B', 'C', 'D'];
  return {
    text: `${found.question}\n\nToque na opção ou escreva de outro jeito.`,
    badge: 'SÓ PARA CONFIRMAR',
    chips: [],
    choices: found.options.map((o, i) => ({ label: `${letters[i]}) ${o.meaning}`, send: o.chip })),
  };
}

// ── Histórico de solicitações ─────────────────────────────────────────────────
/** Lançamentos que uma solicitação criou e ainda existem (título, vencimento, tipo e conta iguais). */
export function createdMovementsOf(activity: ForsetiActivity, movements: Movement[]): Movement[] {
  // Compra no cartão não é lançamento solto (é item de fatura): fica de fora, para não casar com outro lançamento
  const created = (activity.movements || []).filter((c) => !c.invoiceItemId);
  return movements.filter((m) => created.some((c) => c.title === m.title && c.dueDate === m.dueDate && c.type === m.type && c.bank === m.bank));
}

/** Itens de fatura que uma compra no cartão criou e ainda estão na fatura (com quanto cada um subiu o total dela). */
export function invoiceItemsOf(activity: ForsetiActivity, movements: Movement[]): { invoice: Movement; item: InvoiceNatureItemBreakdown; grow: number }[] {
  const out: { invoice: Movement; item: InvoiceNatureItemBreakdown; grow: number }[] = [];
  (activity.movements || []).forEach((c) => {
    if (!c.invoiceItemId) return;
    const invoice = movements.find((m) => m.type === 'CARTAO' && (m.invoiceBreakdown || []).some((i) => i.id === c.invoiceItemId));
    const item = invoice?.invoiceBreakdown?.find((i) => i.id === c.invoiceItemId);
    if (invoice && item) out.push({ invoice, item, grow: c.invoiceGrow ?? 0 });
  });
  return out;
}

/** Dá para desfazer pelo histórico: pagamentos, recebimentos e cartões cadastrados. */
export const canUndoActivity = (a: ForsetiActivity) =>
  !a.undoneAt && (a.kind === 'PAGAMENTO' || a.kind === 'RECEBIMENTO' || a.kind === 'CARTAO') && ((a.movements?.length || 0) > 0 || !!a.cardName);

/** Primeira linha de uma resposta, sem marcação (resumo curto para o histórico). */
export const plainSummary = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/\{(?:ok|bad)\|([^}]*)\}/g, '$1').replace(/[*_#>]/g, '').trim())
    .filter(Boolean)[0] || '';


// ── Ações com confirmação (abrir telas, criar natureza e mapeamento) ─────────
export type ForsetiActionRequest =
  | { kind: 'NAVIGATE'; tab: string; label: string }
  | { kind: 'CREATE_NATURE'; name: string }
  | { kind: 'CREATE_MAPPING'; name: string; natureId: string; natureName: string }
  | { kind: 'SET_BANK_INVOICE'; bank: string; closingDay: number; dueDay: number; estimatedClosing: boolean; shiftOpen: boolean; openInvoices: number }
  | { kind: 'NEED_INFO'; reply: ForsetiReply };

/** Banco e as datas da fatura dele (para a Forseti responder e ajustar). */
export interface BankInvoiceInfo {
  name: string;
  closingDay?: number;
  dueDay?: number;
  openInvoices: number;
}

const termsText = (b: BankInvoiceInfo) =>
  b.closingDay && b.dueDay
    ? `a fatura do **${b.name}** fecha dia **${b.closingDay}** e vence dia **${b.dueDay}**`
    : `ainda não tenho o fechamento e o vencimento da fatura do **${b.name}**`;

/**
 * Fechamento e vencimento da fatura de um banco: consulta ("quando fecha a fatura do Nubank?") e ajuste
 * ("fechamento do Inter dia 15 e vencimento dia 10"). O ajuste só vale depois do "Confirmar".
 */
function detectBankInvoiceRequest(text: string, banks: BankInvoiceInfo[]): ForsetiActionRequest | null {
  if (banks.length === 0) return null;
  const t = stripAccents(text);
  if (!/\b(fecha\w*|fecham\w*|venc\w*)\b/.test(t)) return null;
  const bank = [...banks].sort((a, b) => b.name.length - a.name.length).find((b) => t.includes(stripAccents(b.name)));
  const mentionsInvoice = /\bfaturas?\b|\bcartao\b|\bcartoes\b/.test(t);
  if (!bank && !mentionsInvoice) return null;
  const chips = ['Abrir faturas'];

  if (isQuestion(text)) {
    if (bank) {
      return {
        kind: 'NEED_INFO',
        reply: {
          text: `Pelo que tenho, ${termsText(bank)}.${bank.closingDay && bank.dueDay ? '' : `\n\nPara informar, escreva, por exemplo: *fechamento do ${bank.name} dia 15 e vencimento dia 10*.`}`,
          badge: 'FATURA DO BANCO',
          chips,
        },
      };
    }
    return {
      kind: 'NEED_INFO',
      reply: {
        text: `Datas das faturas:\n\n${banks.map((b) => `• ${termsText(b).replace(/^a fatura/, 'A fatura').replace(/^ainda/, 'Ainda')}`).join('\n')}`,
        badge: 'FATURA DO BANCO',
        chips,
      },
    };
  }

  if (!bank) {
    return {
      kind: 'NEED_INFO',
      reply: { text: 'De qual banco? Ex.: *fechamento do Nubank dia 15 e vencimento dia 10*.', badge: 'FATURA DO BANCO', chips: [] },
    };
  }
  const rest = t.replace(stripAccents(bank.name), ' ');
  const found = (re: RegExp) => {
    const m = rest.match(re);
    return m ? parseInt(m[1], 10) : undefined;
  };
  const closing = found(/\bfech\w*\D{0,40}?(\d{1,2})\b/);
  const due = found(/\bvenc\w*\D{0,40}?(\d{1,2})\b/);
  const invalid = [closing, due].some((d) => d !== undefined && (d < 1 || d > 31));
  if ((closing === undefined && due === undefined) || invalid) {
    return {
      kind: 'NEED_INFO',
      reply: {
        text: `Em que dia a fatura do **${bank.name}** fecha e vence? Ex.: *fechamento do ${bank.name} dia 15 e vencimento dia 10*.`,
        badge: 'FATURA DO BANCO',
        chips: [],
      },
    };
  }
  const dueDay = due ?? bank.dueDay;
  if (!dueDay) {
    return {
      kind: 'NEED_INFO',
      reply: {
        text: `Fechamento do **${bank.name}** dia **${closing}**. E em que dia a fatura vence? Ex.: *vencimento do ${bank.name} dia 10*.`,
        badge: 'FATURA DO BANCO',
        chips: [],
      },
    };
  }
  const closingDay = closing ?? bank.closingDay ?? defaultClosingDay(dueDay);
  return {
    kind: 'SET_BANK_INVOICE',
    bank: bank.name,
    closingDay,
    dueDay,
    estimatedClosing: closing === undefined && !bank.closingDay,
    shiftOpen: due !== undefined && due !== bank.dueDay,
    openInvoices: bank.openInvoices,
  };
}

const SCREENS: { re: RegExp; tab: string; label: string }[] = [
  { re: /\bnaturezas?\b|\btetos?\b/, tab: 'NATUREZAS', label: 'Naturezas & Tetos' },
  { re: /\bmetas?\b/, tab: 'METAS', label: 'Metas' },
  { re: /\bfaturas?\b|\bcartoes\b/, tab: 'FATURAS', label: 'Faturas de Cartão' },
  { re: /movimentac|lancamentos?|\bextrato\b/, tab: 'MOVIMENTACOES', label: 'Lançamentos & Movimentações' },
  { re: /financiamentos?/, tab: 'EMPRESTIMOS', label: 'Contratos (Financiamentos)' },
  { re: /emprestimos?/, tab: 'EMPRESTIMOS', label: 'Contratos (Empréstimos)' },
  { re: /\bcontratos?\b/, tab: 'EMPRESTIMOS', label: 'Contratos' },
  { re: /\bpainel\b|dashboard|projecao/, tab: 'DASHBOARD', label: 'Painel (Meu Dinheiro)' },
  { re: /\binicio\b|\bhome\b/, tab: 'INICIO', label: 'Início' },
  { re: /\bperfil\b|configurac|ajustes/, tab: 'PERFIL', label: 'Perfil & Configurações' },
  { re: /oportunidades/, tab: 'OPORTUNIDADES', label: 'Oportunidades de Compra' },
  { re: /compartilhad/, tab: 'COMPARTILHADO', label: 'Planejamento Compartilhado' },
];

const CREATE_VERB = /\b(cri(a|ar|e)|adicion(a|ar|e)|cadastr(a|ar|e)|nova|novo|incluir|inclua)\b/;
const OPEN_VERB = /\b(abr(a|e|ir)|ir (para|pra|a)|va (para|pra)|vai (para|pra)|me (leva|leve)|navegue|acesse|acessar)\b/;

const cleanName = (raw: string): string => {
  const name = raw
    .replace(/\s+(por favor|pra mim|para mim|ok)\s*$/i, '')
    .replace(/^["“'\s]+|["”'\s.!?]+$/g, '')
    .trim()
    .slice(0, 40);
  return name.length < 2 ? '' : name.charAt(0).toUpperCase() + name.slice(1);
};

/**
 * Pedido de ação: abrir uma tela, criar natureza ou criar mapeamento. Nada é feito aqui: a conversa propõe
 * e só executa depois do "Confirmar". `NEED_INFO` pede o que falta (nome, natureza).
 */
export function detectAction(text: string, natures: { id: string; name: string }[], banks: BankInvoiceInfo[] = []): ForsetiActionRequest | null {
  const t = stripAccents(text);
  const invoiceTerms = detectBankInvoiceRequest(text, banks);
  if (invoiceTerms) return invoiceTerms;
  if (isQuestion(text)) return null;

  // Criar mapeamento: "criar mapeamento Ração na natureza Pets"
  if (CREATE_VERB.test(t) && /\bmapeamentos?\b/.test(t)) {
    const m = text.match(/mapeamento\s+(?:chamad[oa]\s+|de nome\s+|:\s*)?["“']?(.+?)["”']?\s+(?:na|em|para|dentro d[aeo]s?)\s+(?:a\s+)?(?:natureza\s+)?["“']?(.+?)["”']?\s*[.!?]*$/i);
    const mappingName = cleanName(m ? m[1] : text.replace(/^.*mapeamento\s+(?:chamad[oa]\s+|de nome\s+)?/i, ''));
    if (!mappingName || mappingName.length > 40 || /^(na|em|para)\b/i.test(mappingName)) {
      return { kind: 'NEED_INFO', reply: { text: 'Qual o nome do novo mapeamento e em qual natureza? Ex.: *criar mapeamento Ração na natureza Pets*.', badge: 'CRIAR MAPEAMENTO', chips: [] } };
    }
    const wanted = m ? stripAccents(m[2]).trim() : '';
    const match =
      natures.find((n) => stripAccents(n.name) === wanted) ||
      (wanted ? natures.filter((n) => stripAccents(n.name).includes(wanted) || wanted.includes(stripAccents(n.name))) : []).find(Boolean);
    if (!match) {
      const options = natures.slice(0, 6);
      return {
        kind: 'NEED_INFO',
        reply: {
          text: `Em qual natureza devo criar o mapeamento **${mappingName}**?${wanted ? ` Não encontrei uma natureza chamada "${m![2].trim()}".` : ''}`,
          badge: 'CRIAR MAPEAMENTO',
          chips: options.map((n) => `Criar mapeamento ${mappingName} na natureza ${n.name}`),
        },
      };
    }
    return { kind: 'CREATE_MAPPING', name: mappingName, natureId: match.id, natureName: match.name };
  }

  // Criar natureza: "criar natureza Pets"
  if (CREATE_VERB.test(t) && /\bnaturezas?\b/.test(t)) {
    const m = text.match(/natureza\s+(?:chamad[oa]\s+|de nome\s+|com (?:o )?nome(?: de)?\s+|:\s*)?["“']?([^"”'\n,.;]{2,40})/i);
    const name = m ? cleanName(m[1]) : '';
    if (!name || /^(nova|de gastos|para)\b/i.test(name)) {
      return { kind: 'NEED_INFO', reply: { text: 'Qual o nome da nova natureza? Ex.: *criar natureza Pets*.', badge: 'CRIAR NATUREZA', chips: [] } };
    }
    return { kind: 'CREATE_NATURE', name };
  }

  // Abrir tela: "abrir naturezas", "ir para metas"
  if (OPEN_VERB.test(t)) {
    const screen = SCREENS.find((s) => s.re.test(t));
    if (screen) return { kind: 'NAVIGATE', tab: screen.tab, label: screen.label };
  }
  return null;
}

/** Texto e detalhes da confirmação de cada ação. */
export function describeAction(a: Exclude<ForsetiActionRequest, { kind: 'NEED_INFO' }>): { title: string; details: string[] } {
  switch (a.kind) {
    case 'NAVIGATE':
      return { title: `Abrir a tela **${a.label}**?`, details: [] };
    case 'CREATE_NATURE':
      return {
        title: `Criar a natureza **${a.name}**?`,
        details: ['Nome: ' + a.name, 'Sem itens por enquanto: você completa depois em Naturezas.'],
      };
    case 'CREATE_MAPPING':
      return {
        title: `Criar o mapeamento **${a.name}** na natureza **${a.natureName}**?`,
        details: ['Todos os meses, sem itens por enquanto: você adiciona os itens depois.'],
      };
    case 'SET_BANK_INVOICE':
      return {
        title: `Ajustar a fatura do **${a.bank}**?`,
        details: [
          `Fechamento: dia ${a.closingDay}${a.estimatedClosing ? ' (estimado: confira no app do banco)' : ''}`,
          `Vencimento: dia ${a.dueDay}`,
          ...(a.shiftOpen && a.openInvoices > 0
            ? [`${a.openInvoices} ${a.openInvoices === 1 ? 'fatura em aberto passa' : 'faturas em aberto passam'} a vencer no dia ${a.dueDay}`]
            : []),
        ],
      };
  }
}


// ── Contexto da conversa: frases curtas que continuam o assunto anterior ─────
/** Último assunto respondido (para entender "e dessa semana?", "me mostre os de hoje"). */
export interface ForsetiTopic {
  intent: DoubtId;
  period?: SpendPeriod;
  text: string; // frase que originou o assunto
  at: number; // quando foi respondido (ms)
  /** Assunto e período de uma resposta de gastos com detalhe. */
  query?: SpendQuery & { range: SpendRange };
}

export const TOPIC_TTL_MS = 15 * 60 * 1000;

/** Palavras que não trazem assunto novo: ligações, verbos de "mostrar", o período e o vocabulário de gastos. */
const CONTINUATION_WORDS = new Set([
  'me', 'mostre', 'mostra', 'mostrar', 'veja', 'ver', 'quero', 'tambem', 'agora', 'apenas', 'somente', 'mesmo', 'mesma',
  'os', 'as', 'uns', 'umas', 'dos', 'das', 'dessa', 'desta', 'deste', 'desse', 'nesta', 'neste', 'essa', 'esse', 'esta', 'este',
  'para', 'pra', 'por', 'com', 'que', 'sem', 'ate', 'so', 'ja',
  'semana', 'hoje', 'quinzena', 'mes', 'mensal', 'periodo',
  'gasto', 'gastos', 'despesa', 'despesas', 'saida', 'saidas', 'compra', 'compras', 'natureza', 'naturezas', 'origem', 'origens',
  'categoria', 'categorias', 'lancamento', 'lancamentos', 'movimentacao', 'movimentacoes',
]);

const TOPIC_LABEL: Partial<Record<DoubtId, string>> = {
  GASTOS_PERIODO: 'gastos por origem',
  SEM_NATUREZA: 'gastos sem natureza',
  GASTEI: 'gastos do mês',
  ULTIMAS: 'últimas saídas',
};

/**
 * Continuação de uma pergunta de gastos com detalhe. Mudar o período não pede nada além do período; mudar o assunto
 * só vale com uma deixa de continuação ("e com…", "agora…"), para uma frase solta não ser lida como continuação.
 */
function resolveSpendFollowUp(
  text: string,
  last: SpendQuery & { range: SpendRange },
  now: number
): { intent: DoubtId; note: string; query: SpendQuery & { range: SpendRange } } | null {
  if (text.trim().split(/\s+/).length > 8) return null;
  const today = new Date(now);
  const range = parseSpendRange(text, today);
  const { subject, shown } = spendSubjectWords(text);
  const cue = /^\s*(e|mas|agora|tambem|so|somente)\b/.test(stripAccents(text));
  if (!range && !subject) return null;
  if (subject && !cue) return null;
  const query: SpendQuery & { range: SpendRange } = subject
    ? { subject, shown, range: range || last.range }
    : { subject: last.subject, ...(last.shown ? { shown: last.shown } : {}), range: range || last.range };
  const about = query.subject ? ` com ${query.shown || query.subject}` : '';
  return { intent: 'GASTOS_DETALHE', query, note: `*Continuando nos gastos${about}, agora ${query.range.label}.*` };
}

/**
 * Frase curta com um período ("me mostre os dessa semana", "e hoje?", "só da quinzena") depois de um assunto de
 * gastos: continua o assunto com o período novo. Devolve null quando não dá para ligar ao assunto anterior.
 */
export function resolveFollowUp(
  text: string,
  last: ForsetiTopic | null | undefined,
  now: number = Date.now()
): { intent: DoubtId; period?: SpendPeriod; note: string; query?: SpendQuery & { range: SpendRange } } | null {
  if (!last || now - last.at > TOPIC_TTL_MS) return null;
  // Gastos com detalhe: "e no mês passado?" muda o período, "e com uber?" muda o assunto
  if (last.intent === 'GASTOS_DETALHE' && last.query) return resolveSpendFollowUp(text, last.query, now);
  // Depois das respostas de gastos do período, o que elas não cobrem ("e no mês passado?", "e em setembro?")
  // segue como gastos com detalhe, a partir do mês atual
  const viaDetail = () =>
    ['GASTEI', 'GASTOS_PERIODO', 'ULTIMAS', 'SEM_NATUREZA'].includes(last.intent)
      ? resolveSpendFollowUp(text, { subject: '', range: parseSpendRange('este mês', new Date(now))! }, now)
      : null;
  const period = spendPeriodFrom(text);
  if (!period) return viaDetail();
  const t = stripAccents(text);
  // Períodos que as respostas por período não cobrem ("semana passada", "mês anterior", "próxima semana")
  if (/passad|anterior|proxim|ultim|seguinte|ontem|amanha/.test(t)) return viaDetail();
  // Assunto novo na frase ("salário dessa semana", "metas deste mês"): não é continuação
  const words = t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 8) return null; // frase longa traz o assunto dela mesma
  const newSubject = words.some((w) => w.length >= 3 && !CONTINUATION_WORDS.has(w));
  if (newSubject) return null;
  // Gastos do mês e últimas saídas continuam como gastos do período; os demais assuntos não têm período
  const intent: DoubtId | null =
    last.intent === 'GASTOS_PERIODO' || last.intent === 'SEM_NATUREZA'
      ? last.intent
      : last.intent === 'GASTEI' || last.intent === 'ULTIMAS'
      ? 'GASTOS_PERIODO'
      : null;
  if (!intent) return null;
  const label = { HOJE: 'de hoje', SEMANA: 'desta semana', QUINZENA: 'desta quinzena', MES: 'deste mês' }[period];
  return { intent, period, note: `*Continuando em ${TOPIC_LABEL[intent] || 'gastos'}, agora ${label}.*` };
}
