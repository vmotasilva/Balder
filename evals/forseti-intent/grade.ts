import type { IntentAnswer } from '../../api/_forsetiIntentAi';
import { stripAccents } from '../../src/utils/forsetiMoney';
import type { CaseTag, IntentCase } from './cases';

/**
 * Nota programática (sem juiz de IA): a saída é uma intenção de lista fechada mais campos já validados por parseRegistration,
 * parseMemory e parseSpendQuery, então dá para comparar com o esperado exatamente.
 *   intent  = a intenção está entre as aceitas
 *   payload = registro, memória, período e gasto batem; o que não era esperado NÃO pode vir (registro numa pergunta é o erro mais caro)
 *   pass    = intent e payload
 */
export interface Grade {
  intent: 0 | 1;
  payload: 0 | 1;
  pass: 0 | 1;
  /** O que não bateu, em palavras, para quem revisa os resultados. */
  notes: string[];
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

export function gradeAnswer(answer: IntentAnswer, kase: IntentCase): Grade {
  const want = kase.expect;
  const notes: string[] = []; // o que não bateu além da intenção (o "payload")

  const accepted = Array.isArray(want.intent) ? want.intent : [want.intent];
  const intentOk = accepted.includes(answer.intent as (typeof accepted)[number]);
  const intentNote = intentOk ? [] : [`intenção ${answer.intent}, esperava ${accepted.join(' ou ')}`];

  if (want.period && answer.period !== want.period) notes.push(`período ${answer.period ?? 'nenhum'}, esperava ${want.period}`);

  if (want.registration) {
    const r = answer.registration;
    const w = want.registration;
    if (!r) notes.push('faltou o registro');
    else {
      if (r.kind !== w.kind) notes.push(`registro ${r.kind}, esperava ${w.kind}`);
      if (!near(r.amount, w.amount)) notes.push(`valor ${r.amount}, esperava ${w.amount}`);
      if (w.future !== undefined && r.future !== w.future) notes.push(`future ${r.future}, esperava ${w.future}`);
      if (w.date && r.date !== w.date) notes.push(`data ${r.date ?? 'nenhuma'}, esperava ${w.date}`);
    }
  } else if (answer.registration) notes.push('registro que não devia existir');

  if (want.memory) {
    const m = answer.memory;
    if (!m) notes.push('faltou a memória');
    else if (want.memory !== true && m.kind !== want.memory) notes.push(`memória ${m.kind}, esperava ${want.memory}`);
  } else if (answer.memory) notes.push('memória que não devia existir');

  if (want.spend) {
    const s = answer.spend;
    if (!s) notes.push('faltou o gasto detalhado');
    else {
      if (want.spend.subject && !want.spend.subject.some((k) => stripAccents(s.subject).includes(k))) notes.push(`assunto "${s.subject}", esperava ${want.spend.subject.join(' ou ')}`);
      if (want.spend.from && s.from !== want.spend.from) notes.push(`início ${s.from ?? 'nenhum'}, esperava ${want.spend.from}`);
      if (want.spend.to && s.to !== want.spend.to) notes.push(`fim ${s.to ?? 'nenhum'}, esperava ${want.spend.to}`);
    }
  }

  const payloadOk = notes.length === 0;
  return { intent: intentOk ? 1 : 0, payload: payloadOk ? 1 : 0, pass: intentOk && payloadOk ? 1 : 0, notes: [...intentNote, ...notes] };
}

/** Uma linha do resultado de uma rodada. */
export interface EvalRow {
  id: string;
  rep: number;
  tag: CaseTag;
  text: string;
  answer: IntentAnswer;
  grade: Grade;
  model: string;
  latency_s: number;
  retries: number;
  stop_reason?: string;
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/** Precisão e revocação de uma detecção (registro ou memória): "disse que havia" contra "de fato havia". */
function detection(rows: EvalRow[], kases: Map<string, IntentCase>, field: 'registration' | 'memory') {
  let tp = 0, fp = 0, fn = 0;
  rows.forEach((r) => {
    const predicted = !!r.answer[field];
    const actual = !!kases.get(r.id)?.expect[field];
    if (predicted && actual) tp += 1;
    else if (predicted) fp += 1;
    else if (actual) fn += 1;
  });
  return { tp, fp, fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn) };
}

export interface Summary {
  cases: number;
  intent: number | null;
  payload: number | null;
  pass: number | null;
  byTag: Record<string, { cases: number; pass: number | null }>;
  registration: ReturnType<typeof detection>;
  memory: ReturnType<typeof detection>;
  /** Registro inventado numa frase que não era registro: o erro mais caro (cria um lançamento que a pessoa não pediu). */
  falseRegistrations: number;
  latencyMedianS: number | null;
  inputTokens: number;
  outputTokens: number;
}

export function summarize(rows: EvalRow[], kases: IntentCase[]): Summary {
  const byId = new Map(kases.map((k) => [k.id, k]));
  const tags: Record<string, EvalRow[]> = {};
  rows.forEach((r) => (tags[r.tag] ||= []).push(r));
  const lat = rows.map((r) => r.latency_s).sort((a, b) => a - b);
  const sum = (f: (r: EvalRow) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  const registration = detection(rows, byId, 'registration');
  return {
    cases: rows.length,
    intent: pct(sum((r) => r.grade.intent), rows.length),
    payload: pct(sum((r) => r.grade.payload), rows.length),
    pass: pct(sum((r) => r.grade.pass), rows.length),
    byTag: Object.fromEntries(Object.entries(tags).map(([t, rs]) => [t, { cases: rs.length, pass: pct(rs.filter((r) => r.grade.pass).length, rs.length) }])),
    registration,
    memory: detection(rows, byId, 'memory'),
    falseRegistrations: registration.fp,
    latencyMedianS: lat.length ? lat[Math.floor(lat.length / 2)] : null,
    inputTokens: sum((r) => r.usage.input_tokens),
    outputTokens: sum((r) => r.usage.output_tokens),
  };
}

/** US$ por milhão de tokens (entrada, saída), pelo modelo servido. Modelos fora da lista não têm custo calculado. */
const PRICES: { prefix: string; in: number; out: number }[] = [
  { prefix: 'claude-haiku-4-5', in: 1, out: 5 },
  { prefix: 'claude-haiku-5-5', in: 0.1, out: 0.5 },
];

export function costUsd(model: string, usage: EvalRow['usage']): number | null {
  const p = PRICES.find((x) => model.startsWith(x.prefix));
  if (!p) return null;
  return (
    (usage.input_tokens * p.in + usage.cache_creation_input_tokens * p.in * 1.25 + usage.cache_read_input_tokens * p.in * 0.1 + usage.output_tokens * p.out) / 1_000_000
  );
}
