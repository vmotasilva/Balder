import { describe, expect, it } from 'vitest';
import { buildPhraseGroups, buildUsageStats, latestPerActivity, normalizePhrase, type ConversationRow } from './forsetiLearning';

const row = (over: Partial<ConversationRow> & { activity_id: string; request: string }): ConversationRow => ({
  kind: 'CONVERSA',
  result: 'ok',
  event_at: '2026-10-10T10:00:00Z',
  ...over,
});

describe('normalizePhrase: agrupa pedidos parecidos sem guardar dados pessoais', () => {
  it.each([
    ['Paguei R$ 1.250,90 no Mercado!!', 'paguei <valor> no mercado'],
    ['PAGUEI 50 NA FARMÁCIA', 'paguei <n> na farmacia'],
    ['vou receber dia 10/11', 'vou receber dia <n>'],
    ['veja https://exemplo.com/x?a=1 agora', 'veja <link> agora'],
    ['meu email é fulano@exemplo.com.br', 'meu email e <email>'],
  ])('%s → %s', (text, out) => expect(normalizePhrase(text)).toBe(out));

  it('corta em 120 caracteres', () => expect(normalizePhrase('a'.repeat(300))).toHaveLength(120));
});

describe('latestPerActivity', () => {
  it('fica com o evento mais recente de cada solicitação (avaliar e desfazer entram como novos eventos)', () => {
    const rows = [
      row({ activity_id: 'a', request: 'x', event_at: '2026-10-10T10:00:00Z' }),
      row({ activity_id: 'a', request: 'x', event_at: '2026-10-10T11:00:00Z', rating: 'NAO_UTIL' }),
      row({ activity_id: 'b', request: 'y' }),
    ];
    const latest = latestPerActivity(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.activity_id === 'a')?.rating).toBe('NAO_UTIL');
  });
});

describe('buildPhraseGroups: onde a Forseti atendeu mal', () => {
  it('conta "não entendi", resposta não útil, ação desfeita e frases resolvidas só pela IA', () => {
    const { total, groups } = buildPhraseGroups([
      row({ activity_id: '1', request: 'Paguei 30 reais', result: 'Não entendi bem 🤔.' }),
      row({ activity_id: '2', request: 'paguei 80 reais', result: 'Toque na opção ou escreva de outro jeito.' }),
      row({ activity_id: '3', request: 'qual meu saldo', result: 'Seu saldo é...', rating: 'NAO_UTIL' }),
      row({ activity_id: '4', request: 'registrar luz', result: 'feito', undone_at: '2026-10-10T12:00:00Z' }),
      row({ activity_id: '5', request: 'quanto tenho hoje?', kind: 'CONVERSA_IA' }),
      row({ activity_id: '6', request: 'oi', result: 'Olá!' }), // atendida bem: não entra
    ]);
    expect(total).toBe(6);
    const by = Object.fromEntries(groups.map((g) => [g.phrase, g]));
    expect(by['paguei <n> reais']).toMatchObject({ total: 2, notUnderstood: 2 });
    expect(by['qual meu saldo']).toMatchObject({ notUseful: 1 });
    expect(by['registrar luz']).toMatchObject({ undone: 1 });
    expect(by['quanto tenho hoje']).toMatchObject({ viaAi: 1 });
    expect(by['oi']).toBeUndefined();
  });

  it('ordena do sinal mais frequente para o menos', () => {
    const { groups } = buildPhraseGroups([
      row({ activity_id: '1', request: 'a', rating: 'NAO_UTIL' }),
      row({ activity_id: '2', request: 'b', result: 'Não entendi bem' }),
      row({ activity_id: '3', request: 'b', result: 'Não entendi bem' }),
    ]);
    expect(groups.map((g) => g.phrase)).toEqual(['b', 'a']);
  });

  it('respeita o limite e ignora pedidos vazios', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ activity_id: `${i}`, request: `frase ${'x'.repeat(i)}`, result: 'Não entendi bem' }));
    rows.push(row({ activity_id: 'v', request: '   ', result: 'Não entendi bem' }));
    const { total, groups } = buildPhraseGroups(rows, 3);
    expect(total).toBe(5);
    expect(groups).toHaveLength(3);
  });
});

describe('buildUsageStats: quem resolveu cada frase digitada', () => {
  it('separa regras, IA e sem resposta; conta avaliações e ações desfeitas', () => {
    const stats = buildUsageStats([
      row({ activity_id: 'a', request: 'saldo atual', result: 'Seu saldo é...' }),
      row({ activity_id: 'b', request: 'quanto sobra', result: 'Sobra...', rating: 'UTIL' }),
      row({ activity_id: 'c', request: 'frase estranha', result: 'Não entendi bem o que você quis dizer' }),
      row({ activity_id: 'd', request: 'me mostra o mercado', kind: 'CONVERSA_IA', result: 'Gastos com mercado...', rating: 'NAO_UTIL' }),
      row({ activity_id: 'e', request: 'paguei 50 no mercado', kind: 'PAGAMENTO', result: 'Registrado', undone_at: '2026-10-28T10:00:00Z' }),
    ]);
    expect(stats).toEqual({ total: 5, conversation: 4, rules: 2, ai: 1, notUnderstood: 1, useful: 1, notUseful: 1, undone: 1 });
  });

  it('usa só o evento mais recente de cada solicitação e ignora pedidos vazios', () => {
    const stats = buildUsageStats([
      row({ activity_id: 'a', request: 'saldo', result: 'ok', event_at: '2026-10-28T10:00:00Z' }),
      row({ activity_id: 'a', request: 'saldo', result: 'ok', rating: 'UTIL', event_at: '2026-10-28T10:05:00Z' }),
      row({ activity_id: 'b', request: '   ', result: 'Não entendi bem' }),
    ]);
    expect(stats).toMatchObject({ total: 1, conversation: 1, rules: 1, useful: 1 });
  });

  it('sem solicitações, tudo zero', () => {
    expect(buildUsageStats([])).toEqual({ total: 0, conversation: 0, rules: 0, ai: 0, notUnderstood: 0, useful: 0, notUseful: 0, undone: 0 });
  });
});
