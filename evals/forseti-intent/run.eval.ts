import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classify, MODEL } from '../../api/_forsetiIntentAi';
import { EVAL_DAY, INTENT_CASES, type IntentCase } from './cases';
import { costUsd, gradeAnswer, summarize, type EvalRow } from './grade';

/**
 * Avaliação da IA que entende a frase: chama o MESMO código da produção (api/_forsetiIntentAi.ts) em cada caso e dá a nota.
 * Gasta dinheiro de verdade, então só roda com EVAL_RUN=1; sem isso mostra o plano e sai. Ver evals/forseti-intent/README.md.
 *
 *   ANTHROPIC_API_KEY=... EVAL_RUN=1 npm run eval:intent
 *   EVAL_MODEL=claude-haiku-5-5 EVAL_REPS=3 EVAL_RUN=1 npm run eval:intent
 */

const here = dirname(fileURLToPath(import.meta.url));
const MODEL_UNDER_TEST = process.env.EVAL_MODEL || MODEL;
const VARIANT = process.env.EVAL_VARIANT || MODEL_UNDER_TEST;
const REPS = Math.max(1, Number(process.env.EVAL_REPS) || 1);
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY) || 4);
const ONLY = (process.env.EVAL_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const CASE_CEILING_MS = 60_000;
const MAX_ATTEMPTS = 3;

const outDir = join(here, 'results', VARIANT.replace(/[^\w.-]/g, '_'));
const resultsFile = join(outDir, 'results.jsonl');
const errorsFile = join(outDir, 'errors.jsonl');

const fmt = (v: number | null) => (v === null ? '—' : `${v}%`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJsonl = <T,>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : [];

/** Hard ceiling por tentativa: uma conexão presa não pode ocupar a vaga para sempre. */
const withCeiling = <T,>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`passou de ${CASE_CEILING_MS / 1000}s`)), CASE_CEILING_MS))]);

type Failure = { kind: 'servico' | 'timeout' | 'modelo-diferente' | 'rede'; detail: string };

async function runOne(k: IntentCase, rep: number, key: string): Promise<{ row: EvalRow } | { failure: Failure; retries: number }> {
  // Mesmo formato do contexto que api/forseti-intent.ts monta
  const context = k.context ? JSON.stringify({ intent: k.context.intent, period: k.context.period, previous: k.context.previous }) : '';
  let last: Failure = { kind: 'rede', detail: '' };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const started = Date.now();
    try {
      const r = await withCeiling(classify({ key, text: k.text, context, day: EVAL_DAY, model: MODEL_UNDER_TEST }));
      if (!r.ok) {
        last = { kind: 'servico', detail: `HTTP ${r.status}` };
        // 4xx que não é 429 não melhora tentando de novo (pedido inválido): para aqui
        if (r.status < 500 && r.status !== 429) return { failure: last, retries: attempt };
      } else if (!r.model.startsWith(MODEL_UNDER_TEST) && !MODEL_UNDER_TEST.startsWith(r.model)) {
        // Troca silenciosa de modelo invalidaria a comparação
        return { failure: { kind: 'modelo-diferente', detail: `pedi ${MODEL_UNDER_TEST}, serviu ${r.model}` }, retries: attempt };
      } else {
        const u = r.usage ?? {};
        const row: EvalRow = {
          id: k.id, rep, tag: k.tag, text: k.text, answer: r.answer, grade: gradeAnswer(r.answer, k), model: r.model,
          latency_s: Math.round((Date.now() - started) / 10) / 100, retries: attempt, stop_reason: r.stopReason,
          usage: {
            input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
            cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
          },
        };
        // Zero onde nunca deveria ser zero é bug do executor, não resultado
        if (row.usage.input_tokens === 0 && row.usage.cache_read_input_tokens === 0) return { failure: { kind: 'servico', detail: 'resposta sem usage' }, retries: attempt };
        return { row };
      }
    } catch (e) {
      last = { kind: e instanceof Error && e.message.startsWith('passou de') ? 'timeout' : 'rede', detail: e instanceof Error ? e.message : String(e) };
    }
    await sleep(500 * 2 ** attempt * (0.5 + Math.random()));
  }
  return { failure: last, retries: MAX_ATTEMPTS };
}

describe('avaliação da IA que entende a frase', () => {
  it('classifica os casos e dá a nota', async () => {
    const cases = INTENT_CASES.filter((k) => ONLY.length === 0 || ONLY.includes(k.id));
    const key = process.env.ANTHROPIC_API_KEY;
    const plan = `${cases.length} casos × ${REPS} rep(s) = ${cases.length * REPS} chamadas em ${MODEL_UNDER_TEST} (variante "${VARIANT}", hoje=${EVAL_DAY})`;

    if (process.env.EVAL_RUN !== '1' || !key) {
      console.log(`\n[eval:intent] PLANO (nada foi chamado): ${plan}\n  Para executar de verdade: ANTHROPIC_API_KEY=... EVAL_RUN=1 npm run eval:intent\n`);
      return;
    }

    mkdirSync(outDir, { recursive: true });
    const done = new Set(readJsonl<EvalRow>(resultsFile).map((r) => `${r.id}#${r.rep}`));
    const todo = cases.flatMap((k) => Array.from({ length: REPS }, (_, rep) => ({ k, rep }))).filter(({ k, rep }) => !done.has(`${k.id}#${rep}`));
    console.log(`\n[eval:intent] ${plan}${done.size ? `; ${done.size} já feitas, ${todo.length} a fazer` : ''}`);

    let failures = 0;
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const { k, rep } = todo[next++];
        const out = await runOne(k, rep, key);
        if ('row' in out) appendFileSync(resultsFile, `${JSON.stringify(out.row)}\n`);
        else {
          failures += 1;
          appendFileSync(errorsFile, `${JSON.stringify({ id: k.id, rep, ...out.failure, retries: out.retries })}\n`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

    const rows = readJsonl<EvalRow>(resultsFile).filter((r) => cases.some((k) => k.id === r.id) && r.rep < REPS);
    const s = summarize(rows, INTENT_CASES);
    const cost = rows.reduce((acc, r) => acc + (costUsd(r.model, r.usage) ?? 0), 0);
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ variant: VARIANT, model: MODEL_UNDER_TEST, ...s, costUsd: cost, failures }, null, 2));

    const wrong = rows.filter((r) => !r.grade.pass);
    console.log(`\n[eval:intent] ${VARIANT}: ${rows.length} respostas, ${failures} falhas de execução`);
    console.log(`  passou ${fmt(s.pass)} · intenção ${fmt(s.intent)} · conteúdo ${fmt(s.payload)} · registros falsos ${s.falseRegistrations}`);
    console.log(`  registro: precisão ${fmt(s.registration.precision)} revocação ${fmt(s.registration.recall)} · memória: precisão ${fmt(s.memory.precision)} revocação ${fmt(s.memory.recall)}`);
    console.log(`  por categoria: ${Object.entries(s.byTag).map(([t, v]) => `${t} ${fmt(v.pass)} (${v.cases})`).join(' · ')}`);
    console.log(`  mediana ${s.latencyMedianS ?? '—'}s · ${s.inputTokens} tokens de entrada, ${s.outputTokens} de saída · custo ~US$ ${cost.toFixed(4)}`);
    wrong.forEach((r) => console.log(`  ✗ ${r.id} (${r.tag}) "${r.text}" → ${r.grade.notes.join('; ')}`));
    console.log(`  arquivos: ${outDir}\n`);

    // Falha de execução (rede, timeout, modelo trocado) não é nota baixa: o resultado está incompleto e a rodada não vale
    expect(failures, `veja ${errorsFile}`).toBe(0);
  }, 30 * 60_000);
});
