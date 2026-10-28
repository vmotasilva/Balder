import { describe, expect, it } from 'vitest';
import type { ForsetiRegistration } from './forsetiIntents';
import {
  detectAction, detectAmbiguity, detectDoubt, detectLooseAmount, inferExpenseCategory, installmentSchedule,
  parseAmount, parseDate, parseInstallments, registrationKind, registrationPhrase, resolveFollowUp, scheduleNote, shorthandRegistration, titleFrom,
  type DoubtId, type ForsetiTopic, FALLBACK_REPLY, withAiLimitNote,
} from './forsetiAssistant';

// Frases reais de uso: cada linha é um caso que já falhou (ou poderia falhar) e não pode voltar a falhar.

describe('registrationKind: o que é registro de pagamento ou recebimento', () => {
  it.each([
    'paguei 50 na farmácia',
    'pagou r$ 30 em refeições bebidas',
    'deu r$ 30 para pagar bebidas na refeição',
    'gastamos 120 no mercado',
    'comprei uma TV em 6x no cartão Inter',
    'saiu 50 no mercado',
    'agendei um pagamento para amanhã de 178,31',
    'vou pagar 200 dia 10',
    'transferir r$ 100 via pix para minha sogra',
    'transferi 100 para a minha mãe',
    'fiz um pix de 50 para o João',
    'mandei 80 pro Pedro',
    'pix de 200 para a escola',
  ])('PAGAR: %s', (text) => expect(registrationKind(text)).toBe('PAGAR'));

  it.each([
    'recebi 1500 do freela',
    'vou receber 1.200 dia 10',
    'caiu na conta 300',
    'ele recebeu 400',
    'ganhei 500 de freela',
    'ganhei meu salário',
    'ganhei na loteria', // sem valor, mas é dinheiro
    'vou ganhar um prêmio',
    'me deu 30 reais de presente', // alguém me deu: é entrada
    'minha mãe me transferiu 100',
    'o João me pagou 50',
  ])('RECEBER: %s', (text) =>
    expect(registrationKind(text)).toBe('RECEBER')
  );

  it.each([
    'quanto gastei este mês?',
    'quanto pagou de luz?',
    'por que meu saldo caiu',
    'deu certo', // "deu" sem valor
    'me deu um abraço', // "me deu" sem valor
    'transferir para minha sogra', // transferir sem valor
    'quanto transferi este mês?',
    'vou pagar a conta', // "vou pagar" sem valor pode ser outro assunto
    'qual o previsto que não foi pago',
    'oi tudo bem',
    'quem ganhou o jogo ontem', // "ganhou" sem dinheiro
    'ele ganhou o campeonato',
    'ganhei um abraço',
    'quem me pagou 100?', // pergunta
  ])('não é registro: %s', (text) => expect(registrationKind(text)).toBeNull());
});

describe('parseAmount', () => {
  it.each([
    ['R$ 1.250,90', 1250.9],
    ['R$ 85,90 na farmácia', 85.9],
    ['1250.90', 1250.9],
    ['8,5 mil', 8500],
    ['2 mil de aluguel', 2000],
    ['paguei 50', 50],
    ['dia 12 vou receber 300', 300], // o dia não é o valor
    ['15/10 de 300', 300],
  ])('%s → %d', (text, value) => expect(parseAmount(text)).toBe(value));

  it.each(['sem valor', 'dia 12', '10/10', ''])('sem valor: "%s"', (text) => expect(parseAmount(text)).toBeNull());
});

describe('parseDate (hoje = sábado, 10/10/2026)', () => {
  const today = new Date(2026, 9, 10);
  it.each([
    ['hoje', '2026-10-10'],
    ['amanhã', '2026-10-11'],
    ['ontem', '2026-10-09'],
    ['dia 12', '2026-10-12'],
    ['dia 5', '2026-11-05'], // já passou neste mês: vale o seguinte
    ['dia 31', '2026-10-31'],
    ['15/10', '2026-10-15'],
    ['15/10/27', '2027-10-15'],
  ])('%s → %s', (text, iso) => expect(parseDate(text, false, today)).toBe(iso));

  it('data inexistente', () => expect(parseDate('31/02', false, today)).toBeNull());
  it('dia solto só vale no passo da data', () => {
    expect(parseDate('12', false, today)).toBeNull();
    expect(parseDate('12', true, today)).toBe('2026-10-12');
  });
});

describe('parcelas', () => {
  it('lê "6x de 295,87" e tira o trecho do texto', () => {
    const r = parseInstallments('comprei uma TV em 6x de 295,87');
    expect(r).toMatchObject({ count: 6, perInstallment: 295.87 });
    expect(r!.rest).not.toMatch(/6x/);
  });
  it('"dividido em 10 vezes" não traz valor da parcela', () => {
    expect(parseInstallments('dividido em 10 vezes')).toMatchObject({ count: 10, perInstallment: null });
  });
  it.each(['comprei uma TV', 'em 49x'])('sem parcelamento válido: %s', (text) => expect(parseInstallments(text)).toBeNull());

  it('a última parcela absorve os centavos e o dia se ajusta ao fim do mês', () => {
    const plan = installmentSchedule(100, 3, '2026-01-31');
    expect(plan.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(plan.map((p) => p.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('título e categoria do gasto', () => {
  it.each([
    ['deu r$ 30 para pagar bebidas na refeição', 'Bebidas na refeição'],
    ['pagou r$ 30 em refeições bebidas', 'Refeições bebidas'],
    ['paguei 50 na farmácia', 'Farmácia'],
    ['recebi 1500 do freela', 'Freela'],
    ['vou pagar uma conta de 200', ''], // só sobra algo genérico
    ['agendei um pagamento de 200 de luz para amanhã', 'Luz'], // sem "Pagamento de de luz"
    ['agendei o boleto da escola de 450 dia 15', 'Escola'],
    ['agendei o boleto', 'Boleto'], // sem nada depois, a palavra fica
    ['transferir r$ 100 via pix para minha sogra', 'Pix para minha sogra'], // o destinatário fica no título
    ['transferi 100 para a minha mãe', 'Transferência para a minha mãe'],
    ['fiz um pix de 50 para o João hoje', 'Pix para o João'],
    ['agendei um pix de 200 para amanhã', 'Pix'], // "para amanhã" é data, não destinatário
  ])('%s → "%s"', (text, title) => expect(titleFrom(text)).toBe(title));

  it.each([
    ['refeições bebidas', 'Alimentação fora de casa'],
    ['almoço no restaurante', 'Alimentação fora de casa'],
    ['mercado', 'Alimentação & Mercado'],
    ['farmácia', 'Saúde'],
    ['uber', 'Transporte'],
  ])('categoria de "%s"', (text, category) => expect(inferExpenseCategory(text)?.category).toBe(category));

  it('sem palavra conhecida, não inventa categoria', () => expect(inferExpenseCategory('presente do João')).toBeNull());
});

// Os casos de detectDoubt ficam em forsetiEvalCases.ts (rodados por forsetiEval.test.ts).

describe('continuação do assunto (resolveFollowUp)', () => {
  const now = 1_000_000_000_000;
  const topic = (intent: DoubtId, ago = 60_000): ForsetiTopic => ({ intent, text: 'gastos por natureza', at: now - ago });

  it.each([
    ['me mostre os dessa semana', 'SEMANA'],
    ['e hoje?', 'HOJE'],
    ['só da quinzena', 'QUINZENA'],
  ])('"%s" continua em gastos (%s)', (text, period) => {
    expect(resolveFollowUp(text, topic('GASTOS_PERIODO'), now)).toMatchObject({ intent: 'GASTOS_PERIODO', period });
  });

  it('gastos do mês e últimas saídas continuam como gastos do período', () => {
    expect(resolveFollowUp('e hoje?', topic('GASTEI'), now)?.intent).toBe('GASTOS_PERIODO');
    expect(resolveFollowUp('e hoje?', topic('ULTIMAS'), now)?.intent).toBe('GASTOS_PERIODO');
  });

  it.each([
    ['salário dessa semana'], // assunto novo
    ['o que eu quero ver dessa semana com tudo que eu gastei no mercado e na farmácia'], // frase longa
  ])('não continua: %s', (text) => expect(resolveFollowUp(text, topic('GASTOS_PERIODO'), now)).toBeNull());

  it('"semana passada" e "mês passado" não são das respostas por período, mas continuam como gastos com detalhe', () => {
    expect(resolveFollowUp('semana passada', topic('GASTOS_PERIODO'), now)).toMatchObject({ intent: 'GASTOS_DETALHE', query: { range: { label: 'da semana passada' } } });
    expect(resolveFollowUp('e no mês passado?', topic('GASTEI'), now)).toMatchObject({ intent: 'GASTOS_DETALHE' });
  });

  it('assunto expirado (15 min) ou sem período não continua', () => {
    expect(resolveFollowUp('e hoje?', topic('GASTOS_PERIODO', 16 * 60_000), now)).toBeNull();
    expect(resolveFollowUp('e hoje?', topic('SALDO_HOJE'), now)).toBeNull();
    expect(resolveFollowUp('e hoje?', null, now)).toBeNull();
  });
});

describe('palavra solta ou valor sem verbo', () => {
  it('"financiamento" pergunta qual das opções', () => {
    const r = detectAmbiguity('financiamento');
    expect(r?.choices).toHaveLength(2);
    expect(r?.choices?.[0].label).toMatch(/^A\) /);
  });
  it('sem palavra ambígua, nada a perguntar', () => expect(detectAmbiguity('xyz')).toBeNull());

  it('valor com R$ e sem verbo conhecido pergunta gasto ou recebimento, com a frase já limpa', () => {
    const r = detectLooseAmount('30 reais de bebidas');
    // brl() separa o "R$" do número com espaço inseparável
    expect(r?.text).toMatch(/gasto ou um recebimento/);
    expect(r?.choices?.map((c) => c.send.replace(/\u00a0/g, ' '))).toEqual(['Paguei R$ 30,00 Bebidas', 'Recebi R$ 30,00 Bebidas']);
    // a frase reenviada tem de ser entendida como registro
    expect(registrationKind(r!.choices![0].send)).toBe('PAGAR');
    expect(registrationKind(r!.choices![1].send)).toBe('RECEBER');
  });
  it('sem R$, deixa as perguntas de ambiguidade responderem ("parcela 12")', () => {
    expect(detectLooseAmount('parcela 12')).toBeNull();
  });
  it.each(['quanto sobrou de 30 reais?', 'oi tudo bem'])('não pergunta: %s', (text) => expect(detectLooseAmount(text)).toBeNull());
});

describe('detectAction: só propõe, nunca executa', () => {
  const natures = [{ id: 'n1', name: 'Pets' }, { id: 'n2', name: 'Moradia' }];

  it('criar natureza', () => expect(detectAction('criar natureza Viagens', natures)).toEqual({ kind: 'CREATE_NATURE', name: 'Viagens' }));
  it('criar natureza sem nome pede o nome', () => expect(detectAction('criar natureza', natures)?.kind).toBe('NEED_INFO'));
  it('criar mapeamento numa natureza existente', () => {
    expect(detectAction('criar mapeamento Ração na natureza Pets', natures)).toMatchObject({
      kind: 'CREATE_MAPPING', name: 'Ração', natureId: 'n1', natureName: 'Pets',
    });
  });
  it('criar mapeamento numa natureza inexistente pergunta qual', () => {
    expect(detectAction('criar mapeamento Ração na natureza Carro', natures)?.kind).toBe('NEED_INFO');
  });
  it('abrir uma tela', () => expect(detectAction('abrir início', natures)).toMatchObject({ kind: 'NAVIGATE', tab: 'INICIO' }));
  it.each(['quanto custa criar uma natureza?', 'paguei 50 na farmácia'])('não é ação: %s', (text) => expect(detectAction(text, natures)).toBeNull());
});

// A IA só interpreta; quem registra é o fluxo guiado das regras. Então a frase que montamos a partir do registro
// da IA precisa ser entendida pelas regras do mesmo jeito: tipo, valor, título e data.
describe('registrationPhrase: do registro da IA para o fluxo guiado', () => {
  const reg = (over: Partial<ForsetiRegistration>): ForsetiRegistration => ({ kind: 'PAGAR', amount: 100, title: '', future: false, ...over });

  it.each([
    [reg({ title: 'Pix para minha sogra' }), 'Paguei R$ 100,00 Pix para minha sogra'],
    [reg({ title: 'Mercado', amount: 85.9 }), 'Paguei R$ 85,90 Mercado'],
    [reg({ kind: 'RECEBER', title: 'Freela', amount: 1500 }), 'Recebi R$ 1.500,00 Freela'],
    [reg({ future: true, title: 'Aluguel', amount: 1200, date: '2026-10-12' }), 'Agendei R$ 1.200,00 Aluguel 12/10/2026'],
    [reg({ kind: 'RECEBER', future: true, title: 'Salário', amount: 5000, date: '2026-11-05' }), 'Vou receber R$ 5.000,00 Salário 05/11/2026'],
    [reg({ title: 'Farmácia', date: '2026-10-01' }), 'Paguei R$ 100,00 Farmácia'], // pagamento feito conta hoje: a data é ignorada
    [reg({ title: '' }), 'Paguei R$ 100,00'],
  ])('%j', (r, phrase) => expect(registrationPhrase(r).replace(/\u00a0/g, ' ')).toBe(phrase));

  it.each([
    reg({ title: 'Pix para minha sogra' }),
    reg({ title: 'Mercado', amount: 85.9 }),
    reg({ title: 'Bebidas na refeição', amount: 30 }),
    reg({ kind: 'RECEBER', title: 'Freela', amount: 1500 }),
    reg({ kind: 'RECEBER', future: true, title: 'Salário', amount: 5000, date: '2026-11-05' }),
    reg({ future: true, title: 'Aluguel', amount: 1200, date: '2026-10-12' }),
  ])('as regras leem a frase de volta igual: %j', (r) => {
    const phrase = registrationPhrase(r);
    expect(registrationKind(phrase)).toBe(r.kind);
    expect(parseAmount(phrase)).toBe(r.amount);
    expect(titleFrom(phrase)).toBe(r.title);
    if (r.future && r.kind === 'PAGAR') expect(parseDate(phrase)).toBe(r.date);
    if (r.future && r.kind === 'RECEBER') expect(parseDate(phrase)).toBe(r.date);
  });

  it('pagamento agendado sem data é lido como agendado (o fluxo pergunta "para quando")', () => {
    expect(registrationKind(registrationPhrase(reg({ future: true, title: 'Boleto' })))).toBe('PAGAR');
    expect(parseDate(registrationPhrase(reg({ future: true, title: 'Boleto' })))).toBeNull();
  });
});

describe('scheduleNote: o resumo do agendamento diz que ainda não aconteceu', () => {
  it('pagamento: ainda não saiu da conta, fica previsto na data', () => {
    const note = scheduleNote(false, '2026-10-12');
    expect(note).toMatch(/Pagamento agendado/);
    expect(note).toMatch(/ainda não saiu da conta/);
    expect(note).toContain('12/10/2026');
  });
  it('recebimento: o dinheiro ainda não entrou', () => {
    const note = scheduleNote(true, '2026-11-05');
    expect(note).toMatch(/Recebimento agendado/);
    expect(note).toMatch(/ainda não entrou/);
    expect(note).toContain('05/11/2026');
  });
});

// "30 mercado": o jeito mais curto de registrar. Só vale com assunto reconhecível; o resto segue com as perguntas de antes.
describe('shorthandRegistration: valor + o que foi, sem verbo', () => {
  it.each([
    '30 mercado',
    'mercado 30',
    'r$ 30 mercado',
    '85,90 farmácia',
    'uber 18,50',
    '1.200 aluguel',
    'conta de luz 150',
    '30 bebidas', // refeição/bebida é restaurante
    '45 almoço no restaurante',
    '30 Mercado', // maiúscula
  ])('PAGAR: %s', (text) => expect(shorthandRegistration(text)).toBe('PAGAR'));

  it.each(['5000 salário', 'salário 5000', '1.200 freela', '300 reembolso', 'bônus 800', '2 mil comissão', '150 venda'])('RECEBER: %s', (text) =>
    expect(shorthandRegistration(text)).toBe('RECEBER')
  );

  it.each([
    ['parcela 12', 'pode ser o número da parcela'],
    ['cartão 3000', 'pode ser limite, fatura ou compra'],
    ['reserva 10000', 'assunto sem categoria'],
    ['metas 2026', 'ano, não valor'],
    ['dia 10 mercado', 'só data, sem valor'],
    ['10/10 mercado', 'só data, sem valor'],
    ['mercado 30 farmácia 20', 'mais de um valor'],
    ['3x mercado', 'parcelamento'],
    ['mercado em 6 vezes', 'parcelamento'],
    ['quanto custa mercado 30?', 'pergunta'],
    ['quanto gastei com mercado 30', 'pergunta'],
    ['mercado', 'sem valor'],
    ['30', 'sem assunto'],
    ['30 presente do João', 'assunto sem categoria: pergunta gasto ou recebimento'],
    ['eu fui ao mercado hoje e comprei um monte de coisa 30', 'frase longa'],
    ['oi tudo bem', 'sem valor'],
  ])('não registra sozinho: %s (%s)', (text) => expect(shorthandRegistration(text)).toBeNull());

  it('o registro lê valor, título e categoria da própria frase, como no fluxo guiado', () => {
    for (const [text, amount, title, category] of [
      ['30 mercado', 30, 'Mercado', 'Alimentação & Mercado'],
      ['mercado 30', 30, 'Mercado', 'Alimentação & Mercado'],
      ['85,90 farmácia', 85.9, 'Farmácia', 'Saúde'],
      ['conta de luz 150', 150, 'Luz', 'Utilidades / Moradia'],
    ] as const) {
      expect(parseAmount(text)).toBe(amount);
      expect(titleFrom(text)).toBe(title);
      expect(inferExpenseCategory(text)?.category).toBe(category);
    }
    expect(titleFrom('5000 salário')).toBe('Salário');
  });

  it('não muda o que já era registro nem dúvida: o que tem verbo segue como antes', () => {
    expect(registrationKind('30 mercado')).toBeNull(); // dentro de um registro em andamento isto é resposta, não registro novo
    expect(registrationKind('paguei 30 no mercado')).toBe('PAGAR');
    expect(detectDoubt('30 mercado')).toBeNull();
  });

  it('o que não registra sozinho continua com as perguntas de ambiguidade (parcela, cartão) ou gasto/recebimento (com R$)', () => {
    expect(detectAmbiguity('parcela 12')).not.toBeNull();
    expect(detectAmbiguity('cartão 3000')).not.toBeNull();
    expect(detectLooseAmount('30 reais de presente')?.choices).toHaveLength(2);
  });
});

// A categoria vem de palavras-chave. Palavra curta só vale inteira: "gas" não é "gastei", "bar" não é "barbeiro".
describe('inferExpenseCategory: palavra inteira, não pedaço de outra', () => {
  it.each([
    ['Gastei 39,90 em lazer', 'Lazer'], // antes: "Conta da casa" (gas em gastei)
    ['gastei 30 com netflix', 'Lazer'],
    ['gastei 25 no bar', 'Lazer'],
    ['gastamos 80 em lazer', 'Lazer'],
    ['paguei 99 na farmácia', 'Farmácia'], // antes: "Transporte" (o 99 do valor casava com o app 99)
    ['paguei 99,90 no mercado', 'Mercado'],
    ['conta de luz 150', 'Conta da casa'],
    ['gás 80', 'Conta da casa'],
    ['botijão de gás', 'Conta da casa'],
  ])('%s → %s', (text, title) => expect(inferExpenseCategory(text)?.title).toBe(title));

  it.each([
    ['paguei 39,90 no barbeiro', 'bar dentro de barbeiro'],
    ['gastei 50 com a Luzia', 'luz dentro de Luzia'],
    ['paguei 99', 'só o valor'],
    ['gastei 40 no gastrobar', 'bar dentro de gastrobar'],
  ])('não casa por acidente: %s (%s)', (text) => expect(inferExpenseCategory(text)).toBeNull());

  it.each([
    ['39,90 assinatura', 'Lazer'],
    ['assinatura do spotify 21,90', 'Lazer'],
    ['50 ingresso', 'Lazer'],
    ['180 hotel', 'Lazer'],
    ['89 academia', 'Farmácia'],
    ['150 psicólogo', 'Farmácia'],
    ['40 taxi', 'Transporte'],
    ['80 ipva', 'Transporte'],
    ['250 oficina', 'Transporte'],
    ['90 iptu', 'Conta da casa'],
    ['120 diarista', 'Conta da casa'],
    ['45 sushi', 'Restaurante'],
    ['25 delivery', 'Restaurante'],
  ])('vocabulário novo: %s → %s', (text, title) => expect(inferExpenseCategory(text)?.title).toBe(title));

  it('as palavras novas fazem o registro curto funcionar sem perguntar', () => {
    for (const t of ['39,90 assinatura', '40 taxi', '89 academia', '45 sushi', 'iptu 90']) expect(shorthandRegistration(t), t).toBe('PAGAR');
  });

  it('o que continua sem categoria segue com a pergunta (ou a IA, quando logado)', () => {
    for (const t of ['50 barbeiro', '30 presente do João', '25 cabeleireiro']) {
      expect(shorthandRegistration(t), t).toBeNull();
      expect(detectLooseAmount(t), t).not.toBeNull();
    }
  });

  it('palavras novas não viram categoria de verbos e números: o título e o valor ficam intactos', () => {
    expect(parseAmount('Gastei 39,90 em lazer')).toBe(39.9);
    expect(titleFrom('Gastei 39,90 em lazer')).toBe('Lazer');
  });
});

describe('limite de pedidos à IA', () => {
  it('a Forseti avisa e mantém a resposta de sempre logo depois', () => {
    const r = withAiLimitNote(FALLBACK_REPLY);
    expect(r.text.startsWith('⏳ Já usei todos os pedidos de IA desta hora')).toBe(true);
    expect(r.text.endsWith(FALLBACK_REPLY.text)).toBe(true);
    expect(r.chips).toBe(FALLBACK_REPLY.chips);
    expect(r.badge).toBe(FALLBACK_REPLY.badge);
  });
});
