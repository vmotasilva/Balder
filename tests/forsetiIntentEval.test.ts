import { describe, expect, it } from 'vitest';
import { FORSETI_INTENTS } from '../src/utils/forsetiIntents';
import { MEMORY_KINDS } from '../src/utils/forsetiMemory';
import { detectDoubt, isQuestion, parseAmount, registrationKind, resolveFollowUp, shorthandRegistration } from '../src/utils/forsetiAssistant';
import { detectMemoryStatement } from '../src/utils/forsetiMemory';
import { INTENT_CASES, type CaseTag, type IntentCase } from '../evals/forseti-intent/cases';
import { costUsd, gradeAnswer, summarize, type EvalRow } from '../evals/forseti-intent/grade';
import type { IntentAnswer } from '../api/_forsetiIntentAi';

// A avaliação da IA (evals/forseti-intent) gasta dinheiro e só roda com chave. Aqui ficam as garantias que não gastam:
// os casos são válidos, representam o que a IA de fato recebe, e a nota distingue certo de errado.

const TAGS: CaseTag[] = ['parafrase', 'periodo', 'gasto-detalhe', 'registro', 'pergunta-com-numero', 'memoria', 'memoria-sensivel', 'contexto', 'fora-do-tema'];

describe('casos da avaliação da IA', () => {
  it('têm ids únicos, todas as categorias e esperados válidos', () => {
    const ids = INTENT_CASES.map((k) => k.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(new Set(INTENT_CASES.map((k) => k.tag))).toEqual(new Set(TAGS));
    INTENT_CASES.forEach((k) => {
      const intents = Array.isArray(k.expect.intent) ? k.expect.intent : [k.expect.intent];
      intents.forEach((i) => expect([...FORSETI_INTENTS, 'DESCONHECIDO']).toContain(i));
      if (typeof k.expect.memory === 'string') expect(MEMORY_KINDS).toContain(k.expect.memory);
      if (k.expect.registration) expect(k.expect.registration.amount).toBeGreaterThan(0);
    });
  });

  it('só têm frases que as regras do aplicativo deixam passar (é o que a IA recebe em produção)', () => {
    const caught = INTENT_CASES.filter((k) => {
      const topic = k.context ? { intent: k.context.intent, period: k.context.period, text: k.context.previous, at: Date.now() } : null;
      // Mesma porta de memória do chat (useForsetiChat): sem pergunta, sem valor e sem registro
      const localMemory = !isQuestion(k.text) && parseAmount(k.text) === null && !registrationKind(k.text) ? detectMemoryStatement(k.text) : null;
      return detectDoubt(k.text) || registrationKind(k.text) || shorthandRegistration(k.text) || localMemory || (topic && resolveFollowUp(k.text, topic));
    });
    expect(caught.map((k) => k.id)).toEqual([]);
  });
});

/** A resposta certa para o caso, montada a partir do esperado: "oráculo" que precisa tirar 100%. */
const oracle = (k: IntentCase): IntentAnswer => {
  const w = k.expect;
  const r = w.registration;
  return {
    intent: Array.isArray(w.intent) ? w.intent[0] : w.intent,
    ...(w.period ? { period: w.period } : {}),
    ...(r ? { registration: { kind: r.kind, amount: r.amount, title: 'x', future: r.future ?? false, ...(r.date ? { date: r.date } : {}) } } : {}),
    ...(w.memory ? { memory: { kind: w.memory === true ? 'PREFERENCIA' : w.memory, title: 'x', body: 'texto' } } : {}),
    ...(w.spend ? { spend: { subject: w.spend.subject?.[0] ?? '', ...(w.spend.from ? { from: w.spend.from } : {}), ...(w.spend.to ? { to: w.spend.to } : {}) } } : {}),
  };
};

describe('nota da avaliação', () => {
  it('a resposta certa tira 100% em todos os casos', () => {
    INTENT_CASES.forEach((k) => expect(gradeAnswer(oracle(k), k), k.id).toMatchObject({ intent: 1, payload: 1, pass: 1, notes: [] }));
  });

  it('a resposta "não sei" erra todo caso que esperava intenção, registro, memória ou gasto', () => {
    const nothing: IntentAnswer = { intent: 'DESCONHECIDO' };
    INTENT_CASES.forEach((k) => {
      const wantsSomething = k.expect.registration || k.expect.memory || k.expect.spend || k.expect.period || !(Array.isArray(k.expect.intent) ? k.expect.intent : [k.expect.intent]).includes('DESCONHECIDO');
      expect(gradeAnswer(nothing, k).pass, k.id).toBe(wantsSomething ? 0 : 1);
    });
  });

  it('registro inventado numa pergunta reprova, mesmo com a intenção certa', () => {
    const k = INTENT_CASES.find((x) => x.id === 'neg-01')!;
    const g = gradeAnswer({ intent: 'COMPRA', registration: { kind: 'PAGAR', amount: 500, title: 'pix', future: false } }, k);
    expect(g).toMatchObject({ intent: 1, payload: 0, pass: 0 });
    expect(g.notes).toEqual(['registro que não devia existir']);
  });

  it('memória em frase sem memória reprova; valor, tipo, data e período errados são apontados', () => {
    const sens = INTENT_CASES.find((x) => x.id === 'sen-01')!;
    expect(gradeAnswer({ intent: 'DESCONHECIDO', memory: { kind: 'PREFERENCIA', title: '', body: 'prefiro pix' } }, sens).pass).toBe(0);
    const reg = INTENT_CASES.find((x) => x.id === 'reg-05')!;
    const wrong = gradeAnswer({ intent: 'DESCONHECIDO', registration: { kind: 'RECEBER', amount: 530, title: '', future: false, date: '2026-10-30' } }, reg);
    expect(wrong.notes).toHaveLength(4);
    const det = INTENT_CASES.find((x) => x.id === 'det-01')!;
    expect(gradeAnswer({ intent: 'GASTOS_DETALHE', spend: { subject: 'uber', from: '2026-09-01', to: '2026-09-29' } }, det).notes).toEqual(['fim 2026-09-29, esperava 2026-09-30']);
  });

  it('o assunto casa sem acento e por trecho', () => {
    const k = INTENT_CASES.find((x) => x.id === 'det-02')!;
    expect(gradeAnswer({ intent: 'GASTOS_DETALHE', spend: { subject: 'Farmácia', from: '2026-10-14', to: '2026-10-28' } }, k).pass).toBe(1);
  });
});

describe('resumo e custo', () => {
  const usage = { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const rowOf = (k: IntentCase, answer: IntentAnswer): EvalRow => ({
    id: k.id, rep: 0, tag: k.tag, text: k.text, answer, grade: gradeAnswer(answer, k), model: 'claude-haiku-4-5-20251001', latency_s: 1, retries: 0, usage,
  });

  it('conta acertos por categoria, precisão e revocação de registro e registros falsos', () => {
    const ok = INTENT_CASES.find((x) => x.id === 'reg-01')!;
    const missed = INTENT_CASES.find((x) => x.id === 'reg-03')!;
    const question = INTENT_CASES.find((x) => x.id === 'neg-01')!;
    const rows = [
      rowOf(ok, oracle(ok)),
      rowOf(missed, { intent: 'DESCONHECIDO' }),
      rowOf(question, { intent: 'COMPRA', registration: { kind: 'PAGAR', amount: 500, title: '', future: false } }),
    ];
    const s = summarize(rows, INTENT_CASES);
    expect(s).toMatchObject({ cases: 3, pass: 33.3, falseRegistrations: 1 });
    expect(s.registration).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 50, recall: 50 });
    expect(s.byTag.registro).toEqual({ cases: 2, pass: 50 });
  });

  it('custo pelo modelo servido; modelo sem preço cadastrado não tem custo', () => {
    expect(costUsd('claude-haiku-4-5-20251001', usage)).toBeCloseTo(0.0015, 6);
    expect(costUsd('claude-haiku-5-5', usage)).toBeCloseTo(0.00015, 7);
    expect(costUsd('outro-modelo', usage)).toBeNull();
  });
});
