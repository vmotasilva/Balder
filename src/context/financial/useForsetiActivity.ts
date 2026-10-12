import { ForsetiActivityService } from '../../services/forsetiActivityService';
import { ForsetiChatService } from '../../services/forsetiChatService';
import { ForsetiTranscriptService } from '../../services/forsetiTranscriptService';
import { type CopilotMessage, type ForsetiActivity } from '../../types';
import { invoiceAfterRemovingItems } from '../../utils/cardPurchase';
import { chatSavedAt, chatStorageKey, readChat, removeChat, restoreChat, serializeChat, writeChat, type StoredChat } from '../../utils/forsetiChatStore';
import {
  type ForsetiFlow, type ForsetiTopic, MAIN_CHIPS, canUndoActivity, createdMovementsOf, invoiceItemsOf,
} from '../../utils/forsetiAssistant';
import { useEffect, useRef, useState } from 'react';
import type { useCoreData } from './useCoreData';
import type { useBankEntities } from './useBankEntities';
import type { useMovementsAndGoals } from './useMovementsAndGoals';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'authUser' | 'cards' | 'movements' | 'viewing'
  > &
  Pick<ReturnType<typeof useBankEntities>,
    'deleteCard'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'deleteMovement' | 'updateMovement'
  >;

type Viewing = ReturnType<typeof useCoreData>['viewing'];

/** A mensagem de abertura da conversa (diz em qual planejamento a Forseti está atuando). */
const welcomeMessage = (viewing: Viewing): CopilotMessage => ({
  id: 'msg_welcome',
  role: 'assistant',
  content: (viewing
    ? `📍 **Estou atuando no planejamento de ${viewing.ownerName}**, onde você entrou como **${
        viewing.role === 'COLABORADOR' ? 'colaborador(a)' : 'visualizador(a)'
      }**. Tudo o que eu consultar ou registrar aqui é desse planejamento, não do seu.\n\n`
    : '') + 'Olá! Eu sou a Forseti, sua auxiliar de IA no Balder. ⚖️\n\nMe conte o que entrou ou saiu do seu jeito (ex.: *"paguei 50 na farmácia"*), mande a **foto de um comprovante ou cupom** para eu ler, ou tire uma dúvida — respondo com os números do seu planejamento.',
  timestamp: 'Agora',
  suggestedFollowUps: MAIN_CHIPS,
});

/** Histórico do chat e das solicitações da Forseti (avaliar e desfazer). */
export function useForsetiActivity({
  authUser, cards, deleteCard, deleteMovement, movements, updateMovement, viewing,
}: Deps) {
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>(() => [welcomeMessage(viewing)]);
  // Registro guiado em andamento (valor → data/categoria → conta)

  const forsetiFlowRef = useRef<ForsetiFlow | null>(null);
  // Mensagens da pessoa desde o início do registro em andamento (o pedido, no histórico)

  const requestTrailRef = useRef<string[]>([]);

  // Histórico das solicitações à Forseti: é de quem usa (não do dono do planejamento aberto)

  const activityUserId = authUser?.$id;

  const activityGuest = !authUser || !!authUser.isGuest;

  const [forsetiActivity, setForsetiActivity] = useState<ForsetiActivity[]>([]);
  // Tabela do histórico ainda não criada no Supabase: o histórico vale só neste aparelho

  const [forsetiActivityLocalOnly, setForsetiActivityLocalOnly] = useState(false);

  useEffect(() => {
    if (!activityUserId) {
      setForsetiActivity([]);
      return;
    }
    let alive = true;
    ForsetiActivityService.list(activityUserId, activityGuest).then((list) => {
      if (!alive) return;
      setForsetiActivity(list);
      setForsetiActivityLocalOnly(ForsetiActivityService.isLocalOnly(activityGuest));
    });
    return () => {
      alive = false;
    };
  }, [activityUserId, activityGuest]);

  // Uma conversa vai do primeiro pedido até o desfecho (lançamento feito); depois começa outra

  const conversationIdRef = useRef<string>(crypto.randomUUID());
  // Último assunto respondido: dá contexto a frases curtas ("e dessa semana?") e à IA de reserva

  const lastTopicRef = useRef<ForsetiTopic | null>(null);

  // ── Conversa guardada neste aparelho (48 h), uma por pessoa e planejamento ──
  const chatKey = activityUserId ? chatStorageKey(activityUserId, viewing?.ownerId) : null;
  const chatLoadedKey = useRef<string | null>(null);
  // Hora em que cada mensagem apareceu (a tela só diz "Agora")
  const chatSeen = useRef<Record<string, number>>({});
  // Conversa que acabou de ser posta na tela (restaurada ou nova): ela não deve ser gravada de volta
  // (regravar renovaria o prazo sem ninguém ter falado) nem ser confundida com a anterior
  const chatJustSet = useRef<CopilotMessage[] | null>(null);
  // O que a tela mostra agora (para saber se a pessoa já mexeu quando a conversa da nuvem chega)
  const latestChat = useRef(chatHistory);
  latestChat.current = chatHistory;
  // Planejamento da conversa: o próprio ou o do dono do planejamento aberto
  const chatScope = viewing?.ownerId || 'proprio';
  // Envio à nuvem: espera a conversa assentar (1,5 s) e sai também quando o app vai para segundo plano
  const pendingCloudSave = useRef<{ userId: string; guest: boolean; scope: string; stored: StoredChat } | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  const flushCloudSave = () => {
    if (cloudSaveTimer.current !== null) {
      window.clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
    const p = pendingCloudSave.current;
    pendingCloudSave.current = null;
    if (p) void ForsetiChatService.save(p.userId, p.guest, p.scope, p.stored);
  };
  const flushCloudSaveRef = useRef(flushCloudSave);
  flushCloudSaveRef.current = flushCloudSave;

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushCloudSaveRef.current();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      flushCloudSaveRef.current();
    };
  }, []);

  useEffect(() => {
    if (!chatKey) return;
    const previous = chatLoadedKey.current;
    chatLoadedKey.current = chatKey;
    const switched = !!previous && previous !== chatKey;
    const localRaw = readChat(chatKey);
    const saved = restoreChat(localRaw);
    chatSeen.current = saved?.seen || {};
    if (saved) {
      // O assunto da última resposta volta junto: "e no mês passado?" continua depois de recarregar
      lastTopicRef.current = saved.topic || null;
      chatJustSet.current = saved.messages;
      setChatHistory(saved.messages);
    } else if (switched) {
      // Outro planejamento sem conversa guardada: começa uma nova, não leva a conversa do planejamento anterior
      const fresh = [welcomeMessage(viewing)];
      chatJustSet.current = fresh;
      setChatHistory(fresh);
    }
    if (switched) {
      forsetiFlowRef.current = null;
      lastTopicRef.current = null;
      requestTrailRef.current = [];
    }

    // Conversa da nuvem: a mais recente vence. Vale a da nuvem só se a pessoa ainda não mexeu na que está na tela.
    if (!activityUserId || !ForsetiChatService.enabled(activityGuest)) return;
    let cancelled = false;
    const userId = activityUserId;
    const scope = chatScope;
    const shownLocal = saved?.messages ?? null;
    void ForsetiChatService.load(userId, activityGuest, scope).then((cloudRaw) => {
      if (cancelled) return;
      const cloudAt = chatSavedAt(cloudRaw);
      const localAt = saved ? chatSavedAt(localRaw) : 0;
      if (localAt > cloudAt) {
        // O aparelho tem a mais nova (ou a nuvem ainda não tem nada): sobe
        void ForsetiChatService.save(userId, activityGuest, scope, JSON.parse(localRaw as string) as StoredChat);
        return;
      }
      if (cloudAt <= localAt) return;
      const shown = latestChat.current;
      const untouched = shown === shownLocal || (shown.length === 1 && shown[0].id === 'msg_welcome');
      if (!untouched) return;
      const cloud = restoreChat(cloudRaw);
      if (cloud) {
        chatSeen.current = cloud.seen;
        lastTopicRef.current = cloud.topic || null;
        chatJustSet.current = cloud.messages;
        setChatHistory(cloud.messages);
        writeChat(chatKey, JSON.parse(cloudRaw as string) as StoredChat);
      } else if (saved) {
        // Limpada em outro aparelho ("Nova conversa"): aqui também recomeça
        removeChat(chatKey);
        const fresh = [welcomeMessage(viewing)];
        chatJustSet.current = fresh;
        chatSeen.current = {};
        lastTopicRef.current = null;
        setChatHistory(fresh);
      }
    });
    return () => {
      cancelled = true;
    };
    // Só quando a pessoa ou o planejamento muda: viewing entra aqui apenas para a mensagem de abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);

  useEffect(() => {
    if (!chatKey || chatLoadedKey.current !== chatKey) return;
    if (chatJustSet.current) {
      // Enquanto a tela ainda mostra a conversa anterior, não grava; quando mostra a nova, também não
      const shown = chatHistory === chatJustSet.current;
      if (shown) chatJustSet.current = null;
      return;
    }
    // Só a abertura, sem ninguém ter falado: nada a guardar
    if (chatHistory.length === 1 && chatHistory[0].id === 'msg_welcome') {
      removeChat(chatKey);
      return;
    }
    const stored = serializeChat(chatHistory, chatSeen.current, Date.now(), lastTopicRef.current);
    chatSeen.current = Object.fromEntries(stored.messages.map((m) => [m.id, m.at]));
    writeChat(chatKey, stored);
    if (activityUserId && ForsetiChatService.enabled(activityGuest)) {
      pendingCloudSave.current = { userId: activityUserId, guest: activityGuest, scope: chatScope, stored };
      if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = window.setTimeout(flushCloudSave, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, chatKey]);

  /** "Nova conversa": limpa a tela e o que estava guardado, e esquece o passo que estava em andamento. */
  const resetForsetiChat = () => {
    const fresh = [welcomeMessage(viewing)];
    chatJustSet.current = fresh;
    chatSeen.current = {};
    setChatHistory(fresh);
    forsetiFlowRef.current = null;
    lastTopicRef.current = null;
    requestTrailRef.current = [];
    conversationIdRef.current = crypto.randomUUID();
    if (chatKey) removeChat(chatKey);
    // Cancela o envio pendente e avisa a nuvem que a conversa foi limpa
    pendingCloudSave.current = null;
    if (activityUserId) void ForsetiChatService.clear(activityUserId, activityGuest, chatScope);
  };

  const saveActivity = (activity: ForsetiActivity) => {
    if (!activityUserId) return;
    ForsetiActivityService.save(activityUserId, activityGuest, activity).catch(console.error);
    // Cópia para estudo (só o administrador lê): guarda pedido, resposta, desfecho e avaliação
    ForsetiTranscriptService.record(activityUserId, activityGuest, activity, conversationIdRef.current);
  };

  const logForsetiActivity = (entry: Omit<ForsetiActivity, 'id' | 'at' | 'planOwnerId' | 'planOwnerName'>) => {
    const activity: ForsetiActivity = {
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      request: entry.request.slice(0, 600),
      // A resposta fica inteira (como apareceu na conversa), para poder ser avaliada
      result: entry.result.slice(0, 4000),
      ...(viewing ? { planOwnerId: viewing.ownerId, planOwnerName: viewing.ownerName } : {}),
    };
    setForsetiActivity((prev) => [activity, ...prev]);
    saveActivity(activity);
    if (entry.kind !== 'CONVERSA') conversationIdRef.current = crypto.randomUUID();
  };

  const updateForsetiActivity = (id: string, updates: Partial<ForsetiActivity>) => {
    const current = forsetiActivity.find((a) => a.id === id);
    if (!current) return;
    const next = { ...current, ...updates };
    setForsetiActivity((prev) => prev.map((a) => (a.id === id ? next : a)));
    saveActivity(next);
  };

  const rateForsetiActivity = (id: string, rating: ForsetiActivity['rating']) => updateForsetiActivity(id, { rating });

  /** Desfaz o que a solicitação criou (lançamentos e/ou cartão). Devolve o que aconteceu, para mostrar. */

  const undoForsetiActivity = (id: string): { ok: boolean; message: string } => {
    const activity = forsetiActivity.find((a) => a.id === id);
    if (!activity || !canUndoActivity(activity)) return { ok: false, message: 'Esta solicitação não pode ser desfeita.' };
    if ((activity.planOwnerId || null) !== (viewing?.ownerId || null)) {
      return {
        ok: false,
        message: activity.planOwnerId
          ? `Foi feita no planejamento de ${activity.planOwnerName || 'outra pessoa'}. Abra esse planejamento para desfazer.`
          : 'Foi feita no seu planejamento. Volte para ele para desfazer.',
      };
    }
    const created = createdMovementsOf(activity, movements);
    const card = activity.cardName ? cards.find((c) => c.name === activity.cardName) : undefined;
    if (card && movements.some((m) => m.bank === card.name && !created.includes(m))) {
      return { ok: false, message: `Ainda há lançamentos no cartão ${card.name}. Desfaça antes as compras feitas nele.` };
    }
    // Compra no cartão: o item sai da fatura e o total dela volta ao que era (por fatura, se a compra foi parcelada)
    const invoiceItems = invoiceItemsOf(activity, movements);
    if (invoiceItems.some(({ invoice }) => invoice.status === 'REALIZADA')) {
      return { ok: false, message: 'A fatura desta compra já foi paga. Reabra a fatura para desfazer.' };
    }
    created.forEach((m) => deleteMovement(m.id));
    const byInvoice = new Map<string, { invoice: (typeof invoiceItems)[number]['invoice']; itemIds: string[]; grow: number }>();
    invoiceItems.forEach(({ invoice, item, grow }) => {
      const entry = byInvoice.get(invoice.id) || { invoice, itemIds: [], grow: 0 };
      entry.itemIds.push(item.id);
      entry.grow += grow;
      byInvoice.set(invoice.id, entry);
    });
    byInvoice.forEach(({ invoice, itemIds, grow }) => {
      const after = invoiceAfterRemovingItems(invoice, itemIds, grow);
      if (after === 'DELETE') deleteMovement(invoice.id);
      else updateMovement(invoice.id, after);
    });
    if (card) deleteCard(card.id);
    updateForsetiActivity(id, { undoneAt: new Date().toISOString() });
    const parts = [
      created.length > 0 ? `${created.length} lançamento${created.length > 1 ? 's' : ''} apagado${created.length > 1 ? 's' : ''}` : '',
      invoiceItems.length > 0 ? `${invoiceItems.length} item${invoiceItems.length > 1 ? 's' : ''} removido${invoiceItems.length > 1 ? 's' : ''} da fatura` : '',
      card ? `cartão ${card.name} removido` : '',
    ].filter(Boolean);
    return { ok: true, message: parts.length > 0 ? `Desfeito: ${parts.join(' e ')}.` : 'Desfeito. Os lançamentos já tinham sido apagados.' };
  };

  // Sincronização inicial com Supabase

  return {
    chatHistory, setChatHistory, forsetiFlowRef, requestTrailRef, forsetiActivity, forsetiActivityLocalOnly,
    lastTopicRef, logForsetiActivity, rateForsetiActivity, undoForsetiActivity, resetForsetiChat,
  };
}
