import { describe, expect, it } from 'vitest';
import type { ForecastEntry, ForecastPeriod, ForecastWindow } from './forecastWindow';
import { detectDoubt } from './forsetiAssistant';
import { buildDigest, isDigestRequest } from './forsetiDigest';
import { answerDoubt, type ForsetiData } from './forsetiAssistant';
import type { ForsetiMemory } from './forsetiMemory';

// Quarta-feira, 15/10/2025, 08:00
const TODAY = new Date(2025, 9, 15, 8, 0, 0);

const entry = (over: Partial<ForecastEntry>): ForecastEntry => ({
  id: over.title || 'x', date: '2025-10-15', title: 'Conta', kind: 'SAIDA', source: 'CONTA', amount: 100, overdue: false, ...over,
});

const window = (entries: ForecastEntry[], projectedBalance = 500): ForecastWindow => ({
  fromDate: '2025-10-15', toDate: '2025-10-31', days: 17, startingBalance: 1000, income: 0, expenses: 0, net: 0, projectedBalance, entries,
});

const input = (entries: ForecastEntry[], projectedBalance = 500, availableBalance = 1000) => {
  const w = window(entries, projectedBalance);
  const forecasts = { SEMANA: w, QUINZENA: w, MES: w, DIAS_30: w } as Record<ForecastPeriod, ForecastWindow>;
  return { availableBalance, forecasts };
};

describe('isDigestRequest: quando a frase pede o briefing', () => {
  it.each([
    'bom dia', 'Bom dia!', 'bom dia forseti', 'oi, bom dia', 'boa tarde', 'boa noite',
    'resumo do dia', 'resumo de hoje', 'me dá um resumo', 'briefing', 'como está meu dia?', 'o que tem pra hoje',
  ])('sim: %s', (text) => expect(isDigestRequest(text)).toBe(true));

  it.each([
    'bom dia, paguei 50 na farmácia', 'paguei 50 no mercado', 'o que vence hoje', 'quanto gastei hoje', 'resumo da fatura do cartão', '',
  ])('não: %s', (text) => expect(isDigestRequest(text)).toBe(false));

  it('entra como dúvida BOM_DIA e não atrapalha as outras', () => {
    expect(detectDoubt('bom dia')).toBe('BOM_DIA');
    expect(detectDoubt('o que vence nos próximos dias')).toBe('VENCE');
  });
});

describe('buildDigest', () => {
  it('saúda pela hora, com nome e data', () => {
    const d = buildDigest(input([]), TODAY, 'Vitor Mota');
    expect(d.greeting).toBe('Bom dia, Vitor!');
    expect(d.text).toContain('quarta-feira, 15/10');
    expect(buildDigest(input([]), new Date(2025, 9, 15, 14), undefined).greeting).toBe('Boa tarde!');
    expect(buildDigest(input([]), new Date(2025, 9, 15, 21), undefined).greeting).toBe('Boa noite!');
  });

  it('dia sem nada pendente: tranquilo, com saldo e sobra', () => {
    const d = buildDigest(input([]), TODAY);
    expect(d.items[0].text).toContain('Dia tranquilo');
    expect(d.text).toContain('Saldo hoje');
    expect(d.text).toContain('sobram');
  });

  it('destaca atrasados e o que vence hoje, e lista os próximos dias', () => {
    const d = buildDigest(
      input([
        entry({ title: 'Luz', date: '2025-10-10', overdue: true, amount: 200 }),
        entry({ title: 'Aluguel', date: '2025-10-15', amount: 1500 }),
        entry({ title: 'Internet', date: '2025-10-17', amount: 120 }),
        entry({ title: 'Seguro', date: '2025-10-25', amount: 300 }), // fora da janela de 3 dias
      ]),
      TODAY
    );
    expect(d.text).toContain('1 conta em atraso');
    expect(d.text).toContain('Vence hoje');
    expect(d.text).toContain('Aluguel');
    expect(d.text).toContain('Internet');
    expect(d.text).not.toContain('Seguro');
    expect(d.text).not.toContain('Dia tranquilo');
    expect(d.items.filter((i) => i.tone === 'alert').length).toBeGreaterThanOrEqual(2);
  });

  it('separa recebimentos de hoje, próximos e atrasados', () => {
    const d = buildDigest(
      input([
        entry({ title: 'Salário', kind: 'ENTRADA', date: '2025-10-15', amount: 5000 }),
        entry({ title: 'Freela', kind: 'ENTRADA', date: '2025-10-20', amount: 800 }),
        entry({ title: 'Reembolso', kind: 'ENTRADA', date: '2025-10-01', overdue: true, amount: 90 }),
      ]),
      TODAY
    );
    expect(d.text).toContain('Entra hoje');
    expect(d.text).toContain('Próximos recebimentos');
    expect(d.text).toContain('Era para ter entrado');
  });

  it('avisa quando a sobra do mês é negativa', () => {
    const d = buildDigest(input([], -300), TODAY);
    expect(d.text).toContain('faltam');
    expect(d.items.at(-1)?.tone).toBe('alert');
  });

  it('limita a lista e conta o resto', () => {
    const many = Array.from({ length: 7 }, (_, i) => entry({ title: `Conta ${i + 1}`, date: '2025-10-15' }));
    const d = buildDigest(input(many), TODAY);
    expect(d.text).toContain('Conta 4');
    expect(d.text).not.toContain('Conta 5');
    expect(d.text).toContain('e mais 3');
  });
});

const memory = (over: Partial<ForsetiMemory>): ForsetiMemory => ({
  id: 'm', kind: 'PRIORIDADE', title: 'T', body: 'Quitar o empréstimo', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', ...over,
});

describe('memória no briefing e nas respostas', () => {
  it('o briefing traz o foco do dia a partir das prioridades', () => {
    const d = buildDigest({ ...input([]), memories: [memory({})] }, TODAY);
    expect(d.text).toContain('🎯 Seu foco: Quitar o empréstimo.');
  });

  it('sem memória, o briefing não tem linha de foco', () => {
    expect(buildDigest(input([]), TODAY).text).not.toContain('🎯');
  });

  const data = (memories?: ForsetiMemory[]): ForsetiData => ({
    ...input([]), goals: [], movements: [], emergencyReserveAmount: 0, emergencyReserveMonths: 0, monthlyFreeCashflow: 2000, memories,
  });

  it('"o que você sabe sobre mim" lista a memória', () => {
    expect(detectDoubt('o que você sabe sobre mim?')).toBe('MEMORIAS');
    expect(answerDoubt('MEMORIAS', '', data([memory({})])).text).toContain('Quitar o empréstimo');
    expect(answerDoubt('MEMORIAS', '', data([])).text).toContain('Ainda não guardei nada');
  });

  it('a resposta de compra lembra o que a pessoa contou, e não muda sem memória', () => {
    const evita = memory({ kind: 'RESTRICAO', body: 'Evito parcelar compras' });
    const sem = answerDoubt('COMPRA', 'posso comprar um carro?', data()).text;
    const com = answerDoubt('COMPRA', 'posso comprar um carro?', data([evita])).text;
    expect(com).toContain('Evito parcelar compras');
    expect(com.startsWith(sem)).toBe(true);
    expect(sem).not.toContain('🧠');
  });
});
