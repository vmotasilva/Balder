import { describe, expect, it } from 'vitest';
import type { CopilotMessage } from '../types';
import type { ForsetiTopic } from './forsetiAssistant';
import { CHAT_MAX_MESSAGES, CHAT_TTL_HOURS, chatSavedAt, chatStorageKey, chatTimeLabel, restoreChat, serializeChat } from './forsetiChatStore';

const now = new Date(2026, 9, 11, 14, 30).getTime(); // 11/10/2026 14:30
const msg = (id: string, over: Partial<CopilotMessage> = {}): CopilotMessage => ({ id, role: 'assistant', content: `texto ${id}`, timestamp: 'Agora', ...over });
const roundTrip = (messages: CopilotMessage[], seen: Record<string, number> = {}, at = now, restoreAt = now) =>
  restoreChat(JSON.stringify(serializeChat(messages, seen, at)), restoreAt);

describe('chatStorageKey', () => {
  it('uma conversa por pessoa e por planejamento', () => {
    expect(chatStorageKey('u1')).toBe('balder_forseti_chat_u1_proprio');
    expect(chatStorageKey('u1', 'dona')).toBe('balder_forseti_chat_u1_dona');
    expect(chatStorageKey('u1')).not.toBe(chatStorageKey('u1', 'dona'));
    expect(chatStorageKey('u1')).not.toBe(chatStorageKey('u2'));
  });
});

describe('chatTimeLabel', () => {
  it('hoje só a hora; outro dia, a data e a hora', () => {
    expect(chatTimeLabel(new Date(2026, 9, 11, 9, 5).getTime(), now)).toBe('09:05');
    expect(chatTimeLabel(new Date(2026, 9, 10, 23, 59).getTime(), now)).toBe('10/10 23:59');
    expect(chatTimeLabel(new Date(2026, 8, 3, 8, 0).getTime(), now)).toBe('03/09 08:00');
  });
});

describe('guardar e restaurar a conversa', () => {
  it('o texto volta igual, com quem falou, e a hora real no lugar do "Agora"', () => {
    const back = roundTrip([msg('a', { role: 'user', content: 'paguei 50 na farmácia' }), msg('b', { actionBadge: 'FORMA DE PAGAMENTO', suggestedFollowUps: ['Hoje'] })]);
    expect(back!.messages.map((m) => [m.id, m.role, m.content])).toEqual([['a', 'user', 'paguei 50 na farmácia'], ['b', 'assistant', 'texto b']]);
    expect(back!.messages[1]).toMatchObject({ actionBadge: 'FORMA DE PAGAMENTO', suggestedFollowUps: ['Hoje'], timestamp: '14:30' });
  });

  it('cada mensagem mantém a hora em que apareceu, mesmo salvando de novo mais tarde', () => {
    const seen: Record<string, number> = {};
    const t1 = new Date(2026, 9, 11, 10, 0).getTime();
    const t2 = new Date(2026, 9, 11, 14, 30).getTime();
    serializeChat([msg('a')], seen, t1);
    const back = restoreChat(JSON.stringify(serializeChat([msg('a'), msg('b')], seen, t2)), t2)!;
    expect(back.messages.map((m) => m.timestamp)).toEqual(['10:00', '14:30']);
    expect(back.seen).toEqual({ a: t1, b: t2 });
  });

  it('mensagens de outro dia mostram a data', () => {
    const yesterday = new Date(2026, 9, 10, 18, 45).getTime();
    expect(roundTrip([msg('a')], {}, yesterday, now)!.messages[0].timestamp).toBe('10/10 18:45');
  });

  describe('o que depende de um passo em andamento não volta', () => {
    it('confirmação pendente e ação pendente saem, e a mensagem avisa que a etapa ficou em aberto', () => {
      const withWizard = msg('w', {
        content: 'Anotado: R$ 200,00 em Luz',
        pendingConfirmation: { step: 'PAYMENT_METHOD', pendingData: {}, question: 'Como?', options: [] } as unknown as CopilotMessage['pendingConfirmation'],
      });
      const withAction = msg('x', { content: 'Criar a natureza Pets?', pendingAction: { kind: 'CREATE_NATURE', name: 'Pets' } as unknown as CopilotMessage['pendingAction'] });
      const back = roundTrip([withWizard, withAction])!.messages;
      back.forEach((m) => {
        expect(m.pendingConfirmation).toBeUndefined();
        expect(m.pendingAction).toBeUndefined();
        expect(m.content).toMatch(/etapa ficou em aberto/);
      });
      expect(back[0].content.startsWith('Anotado: R$ 200,00 em Luz')).toBe(true);
    });

    it('cupom ainda não conciliado perde o cartão de confirmação; o já conciliado fica como resumo', () => {
      const card = (isReconciled: boolean) => ({ id: 'r', store: 'Mercado', date: '2026-10-11', totalAmount: 50, paymentMethod: 'PIX', items: [], isReconciled }) as unknown as CopilotMessage['receiptReconciliation'];
      const [open, done] = roundTrip([msg('o', { receiptReconciliation: card(false) }), msg('d', { receiptReconciliation: card(true) })])!.messages;
      expect(open.receiptReconciliation).toBeUndefined();
      expect(open.content).toMatch(/etapa ficou em aberto/);
      expect(done.receiptReconciliation?.isReconciled).toBe(true);
      expect(done.content).toBe('texto d');
    });

    it('mensagem comum não ganha aviso nenhum', () => expect(roundTrip([msg('a')])!.messages[0].content).toBe('texto a'));
  });

  it('fotos não são guardadas (o endereço do navegador não vale depois de recarregar); o nome fica e a foto aparece como descartada', () => {
    const withPhoto = msg('p', {
      role: 'user',
      attachmentUrl: 'blob:http://x/123',
      attachmentName: 'cupom.jpg',
      attachments: [{ url: 'blob:http://x/123', name: 'cupom.jpg' }] as unknown as CopilotMessage['attachments'],
    });
    const stored = JSON.stringify(serializeChat([withPhoto], {}, now));
    expect(stored).not.toContain('blob:');
    const back = restoreChat(stored, now)!.messages[0];
    expect(back).toMatchObject({ attachmentName: 'cupom.jpg', isEphemeralPurged: true });
    expect(back.attachmentUrl).toBeUndefined();
    expect(back.attachments).toBeUndefined();
  });

  it('guarda só as últimas mensagens', () => {
    const many = Array.from({ length: CHAT_MAX_MESSAGES + 25 }, (_, i) => msg(`m${i}`));
    const back = roundTrip(many)!.messages;
    expect(back).toHaveLength(CHAT_MAX_MESSAGES);
    expect(back[0].id).toBe('m25');
    expect(back.at(-1)!.id).toBe(`m${CHAT_MAX_MESSAGES + 24}`);
  });

  it('se passar do teto de tamanho, saem as mensagens mais antigas, nunca as novas', () => {
    const big = Array.from({ length: 10 }, (_, i) => msg(`g${i}`, { content: 'x'.repeat(40_000) }));
    const back = roundTrip(big)!.messages;
    expect(back.length).toBeLessThan(10);
    expect(back.at(-1)!.id).toBe('g9');
  });

  it('não altera as mensagens da tela', () => {
    const original = msg('a', { attachmentUrl: 'blob:x', pendingAction: { kind: 'CREATE_NATURE', name: 'P' } as unknown as CopilotMessage['pendingAction'] });
    serializeChat([original], {}, now);
    expect(original.attachmentUrl).toBe('blob:x');
    expect(original.pendingAction).toBeDefined();
    expect(original.timestamp).toBe('Agora');
  });
});

describe('restoreChat: o que vem do disco nunca é confiado como veio', () => {
  const good = (over: object = {}) => JSON.stringify({ savedAt: now, messages: [{ id: 'a', role: 'user', content: 'oi', at: now, ...over }] });

  it('passado o prazo de 48 horas, a conversa some', () => {
    const old = JSON.stringify(serializeChat([msg('a')], {}, now - (CHAT_TTL_HOURS * 3600_000 + 1)));
    expect(restoreChat(old, now)).toBeNull();
    const fresh = JSON.stringify(serializeChat([msg('a')], {}, now - (CHAT_TTL_HOURS * 3600_000 - 60_000)));
    expect(restoreChat(fresh, now)).not.toBeNull();
  });

  it.each([[null], [''], ['não é json'], ['null'], ['42'], ['[]'], ['{}'], [JSON.stringify({ savedAt: 'ontem', messages: [] })], [JSON.stringify({ savedAt: now, messages: 'oi' })], [JSON.stringify({ savedAt: now, messages: [] })]])(
    'sem conversa válida (%s) devolve null',
    (raw) => expect(restoreChat(raw as string | null, now)).toBeNull()
  );

  it('ignora só as mensagens malformadas e mantém as boas', () => {
    const raw = JSON.stringify({
      savedAt: now,
      messages: [
        null,
        'texto',
        { id: 1, role: 'user', content: 'id errado', at: now },
        { id: 'b', role: 'robô', content: 'papel errado', at: now },
        { id: 'c', role: 'user', content: 42, at: now },
        { id: 'd', role: 'user', content: 'sem hora' },
        { id: 'ok', role: 'user', content: 'boa', at: now },
      ],
    });
    expect(restoreChat(raw, now)!.messages.map((m) => m.id)).toEqual(['ok']);
  });

  it('se nenhuma mensagem presta, não há conversa', () => {
    expect(restoreChat(JSON.stringify({ savedAt: now, messages: [{ id: 'x' }] }), now)).toBeNull();
  });

  it('o aviso de etapa em aberto só aparece nas mensagens marcadas', () => {
    expect(restoreChat(good(), now)!.messages[0].content).toBe('oi');
    expect(restoreChat(good({ interrupted: true }), now)!.messages[0].content).toMatch(/etapa ficou em aberto/);
  });
});

describe('assunto da conversa (para "e no mês passado?" continuar depois de recarregar)', () => {
  const topic: ForsetiTopic = {
    intent: 'GASTOS_DETALHE', period: 'MES', text: 'gastos com mercado em setembro', at: now - 60_000,
    query: { subject: 'mercado', shown: 'mercado', range: { from: '2026-09-01', to: '2026-09-30', label: 'de setembro' } },
  };
  const withTopic = (t: unknown) => JSON.stringify({ savedAt: now, topic: t, messages: [{ id: 'a', role: 'user', content: 'oi', at: now }] });

  it('volta igual, com assunto e período', () => {
    const back = restoreChat(JSON.stringify(serializeChat([msg('a')], {}, now, topic)), now)!;
    expect(back.topic).toEqual(topic);
  });

  it('sem assunto guardado, volta sem assunto', () => {
    expect(restoreChat(JSON.stringify(serializeChat([msg('a')], {}, now, null)), now)!.topic).toBeUndefined();
  });

  it('assunto malformado é ignorado, a conversa volta', () => {
    for (const bad of ['texto', 42, { intent: 'GASTEI' }, { intent: 5, text: 'x', at: now }, { intent: 'GASTEI', text: 'x', at: 'ontem' }]) {
      const back = restoreChat(withTopic(bad), now)!;
      expect(back.messages).toHaveLength(1);
      expect(back.topic).toBeUndefined();
    }
  });

  it('período e consulta inválidos são descartados, o assunto fica', () => {
    const back = restoreChat(withTopic({ intent: 'GASTEI', text: 'x', at: now, period: 'SEMPRE', query: { subject: 1 } }), now)!;
    expect(back.topic).toEqual({ intent: 'GASTEI', text: 'x', at: now });
  });
});

describe('chatSavedAt', () => {
  it('diz quando a conversa foi guardada, e 0 se o texto não é uma conversa', () => {
    expect(chatSavedAt(JSON.stringify(serializeChat([msg('a')], {}, now)))).toBe(now);
    expect(chatSavedAt(null)).toBe(0);
    expect(chatSavedAt('não é json')).toBe(0);
    expect(chatSavedAt(JSON.stringify({ messages: [] }))).toBe(0);
  });

  it('a conversa limpa em outro aparelho (sem mensagens) não volta como conversa', () => {
    const cleared = JSON.stringify({ savedAt: now, messages: [] });
    expect(chatSavedAt(cleared)).toBe(now);
    expect(restoreChat(cleared, now)).toBeNull();
  });
});
