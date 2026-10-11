import { describe, expect, it } from 'vitest';
import type { ExpenseNature, Movement } from '../types';
import { answerDoubt, detectDoubt, resolveFollowUp, type ForsetiData, type ForsetiTopic } from './forsetiAssistant';
import {
  answerSpendDetail, describeRange, detectSpendDetail, parseSpendRange, spendQueryFrom, spendSubject, type SpendRange,
} from './forsetiSpend';

// Hoje = domingo, 11/10/2026
const today = new Date(2026, 9, 11);

const natures = [
  { id: 'n_mercado', name: 'Alimentação & Mercado' },
  { id: 'n_saude', name: 'Saúde' },
  { id: 'n_transp', name: 'Transporte' },
  { id: 'n_fora', name: 'Alimentação fora de casa' },
  { id: 'n_pet', name: 'Pet' }, // existe, mas nunca teve gasto pago
] as unknown as ExpenseNature[];

let seq = 0;
const paid = (title: string, date: string, amount: number, extra: Partial<Movement> = {}): Movement =>
  ({ id: `m${++seq}`, type: 'PAGAR', status: 'REALIZADA', title, dueDate: date, paymentDate: date, amount, actualAmount: amount, ...extra }) as unknown as Movement;

const movements: Movement[] = [
  paid('Supermercado Extra', '2026-09-10', 300, { natureId: 'n_mercado' }),
  paid('Padaria', '2026-09-20', 50, { category: 'Alimentação & Mercado' }), // natureza pela categoria
  paid('Drogaria', '2026-09-12', 80, { natureId: 'n_saude' }),
  paid('Uber', '2026-09-15', 40, { natureId: 'n_transp' }),
  paid('Uber', '2026-10-03', 30, { natureId: 'n_transp' }),
  paid('Supermercado Extra', '2026-10-03', 200, { natureId: 'n_mercado' }),
  paid('Restaurante do Zé', '2026-09-28', 90, { natureId: 'n_fora' }),
  // Fatura paga em setembro: 400 já analisados como mercado, 100 como "outros", o resto sem análise
  paid('Fatura Nubank', '2026-09-25', 1000, {
    type: 'CARTAO',
    invoiceBreakdown: [
      { id: 'i1', natureId: 'n_mercado', natureName: 'Alimentação & Mercado', description: 'Compras do mês', amount: 400, isAnalyzed: true },
      { id: 'i2', natureId: 'outros', natureName: 'Outros', description: 'Diversos', amount: 100, isAnalyzed: true },
    ] as Movement['invoiceBreakdown'],
  }),
  // Não contam: recebimento, previsto e cancelado
  paid('Salário', '2026-09-05', 5000, { type: 'RECEBER' }),
  paid('Mercado previsto', '2026-10-20', 999, { status: 'PREVISTA', natureId: 'n_mercado', paymentDate: undefined }),
];

const ask = (subject: string, range?: SpendRange) => answerSpendDetail({ subject, range }, movements, natures, today);
const sept = parseSpendRange('em setembro', today)!;

describe('parseSpendRange (hoje = 11/10/2026)', () => {
  it.each([
    ['hoje', '2026-10-11', '2026-10-11', 'hoje'],
    ['ontem', '2026-10-10', '2026-10-10', 'ontem'],
    ['nos últimos 30 dias', '2026-09-12', '2026-10-11', 'dos últimos 30 dias'],
    ['esta semana', '2026-10-05', '2026-10-11', 'desta semana'],
    ['na semana passada', '2026-09-28', '2026-10-04', 'da semana passada'],
    ['nesta quinzena', '2026-10-01', '2026-10-15', 'desta quinzena'],
    ['neste mês', '2026-10-01', '2026-10-31', 'deste mês'],
    ['no mês passado', '2026-09-01', '2026-09-30', 'do mês passado'],
    ['em setembro', '2026-09-01', '2026-09-30', 'de setembro'],
    ['em outubro', '2026-10-01', '2026-10-31', 'de outubro'],
    ['em novembro', '2025-11-01', '2025-11-30', 'de novembro de 2025'], // ainda não chegou: o do ano passado
    ['em março de 2024', '2024-03-01', '2024-03-31', 'de março de 2024'],
    ['em fevereiro', '2026-02-01', '2026-02-28', 'de fevereiro'],
    ['este ano', '2026-01-01', '2026-12-31', 'deste ano'],
    ['no ano passado', '2025-01-01', '2025-12-31', 'do ano passado'],
  ])('%s', (text, from, to, label) => expect(parseSpendRange(text, today)).toEqual({ from, to, label }));

  it('mês passado em janeiro é dezembro do ano anterior', () => {
    expect(parseSpendRange('no mês passado', new Date(2026, 0, 15))).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });
  it.each(['quanto gastei com mercado', 'oi'])('sem período: %s', (text) => expect(parseSpendRange(text, today)).toBeNull());
});

describe('spendSubject: o que sobra é o assunto', () => {
  it.each([
    ['quanto gastei com mercado em setembro?', 'mercado'],
    ['gastos de farmácia no mês passado', 'farmacia'],
    ['quanto paguei de uber esta semana', 'uber'],
    ['quanto gastei com alimentação fora de casa', 'alimentacao fora casa'],
    ['meus gastos com o João nos últimos 30 dias', 'joao'],
    ['quanto gastei este mês?', ''],
    ['gastos por natureza em setembro', ''],
    ['por que gastei tanto?', ''],
  ])('%s → "%s"', (text, subject) => expect(spendSubject(text)).toBe(subject));
});

describe('detectSpendDetail: quando é pergunta com detalhe', () => {
  it.each([
    ['quanto gastei com mercado em setembro?', 'mercado', 'de setembro'],
    ['quanto gastei com uber?', 'uber', undefined], // sem período: vale o mês atual
    ['gastos de farmácia no mês passado', 'farmacia', 'do mês passado'],
    ['quanto gastei no mês passado?', '', 'do mês passado'], // só o período, que as respostas simples não cobrem
    ['gastos por natureza em setembro', '', 'de setembro'],
  ])('%s', (text, subject, label) => {
    const q = detectSpendDetail(text, today);
    expect(q?.subject).toBe(subject);
    expect(q?.range?.label).toBe(label);
  });

  it.each([
    'quanto gastei este mês?', // resposta simples do mês
    'gastos desta semana', // resposta simples da semana
    'quanto gastei hoje?',
    'gastos por natureza',
    'últimas compras',
    'por que gastei tanto?',
    'qual meu saldo hoje?', // não é de gastos
    'quanto ainda posso gastar?',
    'paguei 50 na farmácia', // registro, não pergunta
    'gastei 30 no mercado ontem',
  ])('segue para as respostas simples: %s', (text) => expect(detectSpendDetail(text, today)).toBeNull());

  it('detectDoubt manda a pergunta com detalhe para a resposta nova, e as simples continuam como eram', () => {
    expect(detectDoubt('quanto gastei com mercado em setembro?')).toBe('GASTOS_DETALHE');
    expect(detectDoubt('quanto gastei no mês passado?')).toBe('GASTOS_DETALHE');
    expect(detectDoubt('quanto gastei este mês?')).toBe('GASTEI');
    expect(detectDoubt('gastos desta semana')).toBe('GASTOS_PERIODO');
    expect(detectDoubt('gastos por natureza')).toBe('GASTOS_PERIODO');
    expect(detectDoubt('quanto ainda posso gastar este mês?')).toBe('SOBRA');
  });
});

describe('answerSpendDetail: os números', () => {
  it('natureza em um mês: soma lançamentos, categoria e os itens analisados da fatura do cartão', () => {
    const a = ask('mercado', sept);
    // 300 (Extra) + 50 (Padaria, pela categoria) + 400 (itens de mercado da fatura)
    expect(a.text).toContain('**Gastos com Alimentação & Mercado de setembro** (01/09 a 30/09)');
    expect(a.text).toMatch(/Total pago: \*\*R\$\s750,00\*\* \(3 saídas\)/);
    expect(a.text).toContain('Compras do mês (Fatura Nubank)');
    expect(a.text).not.toMatch(/Drogaria|Uber/);
  });

  it('o restante da fatura sem natureza aparece como "Sem natureza", sem contar o que já foi detalhado', () => {
    const a = ask('', sept);
    // 300+50+80+40+90+1000 = 1560; a fatura de 1000 vira 400 (mercado) + 600 (restante)
    expect(a.text).toMatch(/Total pago: \*\*R\$\s1\.560,00\*\*/);
    expect(a.text).toMatch(/Sem natureza:\*\* R\$\s600,00/);
    expect(a.text).toMatch(/Alimentação & Mercado:\*\* R\$\s750,00/);
  });

  it('sem assunto divide por natureza, da maior para a menor, com porcentagem', () => {
    const lines = ask('', sept).text.split('\n').filter((l) => l.startsWith('• **') && l.includes('%'));
    expect(lines[0]).toContain('Alimentação & Mercado');
    expect(lines.map((l) => l.match(/\((\d+)%\)/)![1]).map(Number)).toEqual([...lines.map((l) => Number(l.match(/\((\d+)%\)/)![1]))].sort((x, y) => y - x));
  });

  it('sem período vale o mês atual e avisa que só conta o que já foi pago', () => {
    const a = ask('mercado');
    expect(a.text).toContain('deste mês');
    expect(a.text).toMatch(/Total pago: \*\*R\$\s200,00\*\* \(1 saída\)/); // o previsto (999) não entra
    expect(a.text).toMatch(/só o que já foi pago/);
  });

  it('assunto por texto do lançamento, sem natureza cadastrada para ele', () => {
    const a = ask('drogaria', sept);
    expect(a.text).toMatch(/Total pago: \*\*R\$\s80,00\*\* \(1 saída\)/);
  });

  it('plural acha o singular ("refeições" × "refeição") e vários nomes de natureza', () => {
    expect(ask('alimentacao fora casa', sept).text).toMatch(/Total pago: \*\*R\$\s90,00\*\*/);
    expect(ask('alimentacao', sept).text).toMatch(/Alimentação & Mercado \+ Alimentação fora de casa/); // dois nomes casam
  });

  it('o assunto existe, mas não neste período: diz quanto há em outros', () => {
    const a = ask('uber', parseSpendRange('em agosto', today)!);
    expect(a.text).toMatch(/Não há saídas pagas assim neste período/);
    expect(a.text).toMatch(/Em outros períodos há \*\*R\$\s70,00\*\* em 2 lançamentos/);
  });

  it('natureza que existe mas nunca teve gasto pago: não diz que "não achou" (ela existe)', () => {
    const a = ask('pet', sept);
    expect(a.text).toContain('**Gastos com Pet de setembro**');
    expect(a.text).toMatch(/Não há saídas pagas assim neste período/);
    expect(a.text).not.toMatch(/Não achei/);
  });

  it('o título mostra o assunto como a pessoa escreveu, com acento', () => {
    const q = detectSpendDetail('quanto gastei com drogaria e farmácia em setembro?', today)!;
    expect(q.subject).toBe('drogaria farmacia');
    expect(q.shown).toBe('drogaria farmácia');
    const a = answerSpendDetail({ subject: 'padaria nova', shown: 'padaria nova', range: sept }, movements, natures, today);
    expect(a.text).toMatch(/Não achei \*\*padaria nova\*\*/);
    const b = answerSpendDetail({ subject: 'farmacia', shown: 'farmácia', range: sept }, movements, natures, today);
    expect(b.text).toMatch(/Não achei \*\*farmácia\*\*/); // nada com esse nome nos lançamentos desta massa de teste
  });

  it('assunto que não existe em lugar nenhum: diz isso, não inventa zero', () => {
    const a = ask('helicoptero', sept);
    expect(a.text).toMatch(/Não achei \*\*helicoptero\*\*/);
    expect(a.text).not.toMatch(/Total pago/);
  });

  it('devolve o que foi respondido para "e no mês passado?" continuar', () => {
    const a = ask('mercado', sept);
    expect(a.query).toEqual({ subject: 'mercado', range: sept });
    expect(a.chips).toContain('E no mês passado?');
    expect(ask('mercado', parseSpendRange('no mês passado', today)!).chips).toContain('E neste mês?');
  });

  it('o atalho "Gastos por natureza" leva o período junto, e a frase dele volta para a mesma resposta', () => {
    const chips = ask('mercado', sept).chips;
    expect(chips).toContain('Gastos por natureza de setembro');
    const back = detectSpendDetail('Gastos por natureza de setembro', today);
    expect(back).toMatchObject({ subject: '', range: { label: 'de setembro' } });
    expect(ask('mercado').chips).toContain('Gastos por natureza'); // mês atual: o atalho simples já serve
    // período em datas livres não dá para repetir como frase: atalho simples
    expect(ask('mercado', describeRange('2026-09-05', '2026-09-20', today)).chips).toContain('Gastos por natureza');
  });

  it('lista no máximo 8 saídas, das mais recentes', () => {
    const many = Array.from({ length: 12 }, (_, i) => paid(`Cafe ${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, 5, { natureId: 'n_fora' }));
    const text = answerSpendDetail({ subject: 'cafe', range: sept }, many, natures, today).text;
    expect(text.match(/^• \d\d\/09/gm)).toHaveLength(8);
    expect(text).toContain('…e mais 4.');
    expect(text.indexOf('Cafe 11')).toBeLessThan(text.indexOf('Cafe 4'));
  });
});

describe('answerDoubt GASTOS_DETALHE', () => {
  const data = { movements, natures, availableBalance: 0, forecasts: { MES: {} } } as unknown as ForsetiData;

  it('lê assunto e período da própria frase', () => {
    const r = answerDoubt('GASTOS_DETALHE', 'quanto gastei com mercado em setembro?', data, { today });
    expect(r.badge).toBe('GASTOS COM DETALHE');
    expect(r.text).toMatch(/Total pago: \*\*R\$\s750,00\*\*/);
    expect(r.spendQuery?.subject).toBe('mercado');
  });

  it('usa a pergunta que a IA entendeu quando vem pronta', () => {
    const q = spendQueryFrom({ subject: 'com Uber', from: '2026-09-01', to: '2026-09-30' }, today);
    expect(q).toEqual({ subject: 'uber', shown: 'uber', range: { from: '2026-09-01', to: '2026-09-30', label: 'de setembro' } });
    expect(answerDoubt('GASTOS_DETALHE', 'frase que as regras não entendem', data, { spend: q, today }).text).toMatch(/Total pago: \*\*R\$\s40,00\*\*/);
  });
});

describe('spendQueryFrom e describeRange (datas livres da IA)', () => {
  it('mês inteiro vira o nome do mês; o resto, as datas', () => {
    expect(describeRange('2026-09-01', '2026-09-30', today).label).toBe('de setembro');
    expect(describeRange('2025-02-01', '2025-02-28', today).label).toBe('de fevereiro de 2025');
    expect(describeRange('2026-09-05', '2026-09-20', today).label).toBe('de 05/09 a 20/09');
    expect(describeRange('2026-09-05', '2026-09-05', today).label).toBe('em 05/09');
  });
  it('sem as duas datas não há período (vale o mês atual)', () => {
    expect(spendQueryFrom({ subject: 'mercado', from: '2026-09-01' }, today).range).toBeUndefined();
  });
});

describe('continuação das perguntas com detalhe', () => {
  const now = new Date(2026, 9, 11).getTime();
  const topic = (over: Partial<ForsetiTopic> = {}): ForsetiTopic => ({
    intent: 'GASTOS_DETALHE', text: 'gastos com mercado em setembro', at: now - 60_000, query: { subject: 'mercado', range: sept }, ...over,
  });
  const follow = (text: string, t: ForsetiTopic | null = topic()) => resolveFollowUp(text, t, now);

  it('"e no mês passado?" muda só o período', () => {
    expect(follow('e no mês passado?')?.query).toMatchObject({ subject: 'mercado', range: { label: 'do mês passado' } });
  });
  it('"e com uber?" muda só o assunto', () => {
    const f = follow('e com uber?');
    expect(f?.query).toMatchObject({ subject: 'uber', range: sept });
    expect(f?.note).toMatch(/Continuando nos gastos com uber, agora de setembro/);
  });
  it('"e uber em agosto?" muda os dois', () => {
    expect(follow('e uber em agosto?')?.query).toMatchObject({ subject: 'uber', range: { label: 'de agosto' } });
  });
  it.each([
    ['qual o saldo em setembro'], // assunto novo, sem deixa de continuação
    ['uber'], // idem
    ['oi tudo bem'],
    ['e o que eu comprei no mercado e na farmácia e no uber e em tudo isso junto'], // frase longa
  ])('não continua: %s', (text) => expect(follow(text)).toBeNull());

  it('assunto expirado (15 min) não continua', () => {
    expect(follow('e no mês passado?', topic({ at: now - 16 * 60_000 }))).toBeNull();
  });

  it('depois de "quanto gastei este mês?", "e no mês passado?" e "e em setembro?" viram gastos com detalhe', () => {
    const gastei = topic({ intent: 'GASTEI', query: undefined });
    expect(follow('e no mês passado?', gastei)).toMatchObject({ intent: 'GASTOS_DETALHE', query: { subject: '', range: { label: 'do mês passado' } } });
    expect(follow('e em setembro?', gastei)?.query?.range.label).toBe('de setembro');
  });
  it('e as continuações antigas seguem iguais: "e hoje?" depois de gastos do mês', () => {
    expect(follow('e hoje?', topic({ intent: 'GASTEI', query: undefined }))).toMatchObject({ intent: 'GASTOS_PERIODO', period: 'HOJE' });
  });
});
