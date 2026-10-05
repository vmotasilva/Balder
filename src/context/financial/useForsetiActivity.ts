import { ForsetiActivityService } from '../../services/forsetiActivityService';
import { ForsetiTranscriptService } from '../../services/forsetiTranscriptService';
import { type CopilotMessage, type ForsetiActivity } from '../../types';
import {
  type ForsetiFlow, type ForsetiTopic, MAIN_CHIPS, canUndoActivity, createdMovementsOf,
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
    'deleteMovement'
  >;

/** Histórico do chat e das solicitações da Forseti (avaliar e desfazer). */
export function useForsetiActivity({
  authUser, cards, deleteCard, deleteMovement, movements, viewing,
}: Deps) {
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: (viewing
        ? `📍 **Estou atuando no planejamento de ${viewing.ownerName}**, onde você entrou como **${
            viewing.role === 'COLABORADOR' ? 'colaborador(a)' : 'visualizador(a)'
          }**. Tudo o que eu consultar ou registrar aqui é desse planejamento, não do seu.\n\n`
        : '') + 'Olá! Eu sou a Forseti, sua auxiliar de IA no Balder. ⚖️\n\nMe conte o que entrou ou saiu do seu jeito (ex.: *"paguei 50 na farmácia"*), mande a **foto de um comprovante ou cupom** para eu ler, ou tire uma dúvida — respondo com os números do seu planejamento.',
      timestamp: 'Agora',
      suggestedFollowUps: MAIN_CHIPS,
    },
  ]);
  // Registro guiado em andamento (valor → data/categoria → conta)

  const forsetiFlowRef = useRef<ForsetiFlow | null>(null);
  // Mensagens da pessoa desde o início do registro em andamento (o pedido, no histórico)

  const requestTrailRef = useRef<string[]>([]);

  // Histórico das solicitações à Forseti: é de quem usa (não do dono do planejamento aberto)

  const activityUserId = authUser?.$id;

  const activityGuest = !authUser || !!authUser.isGuest;

  const [forsetiActivity, setForsetiActivity] = useState<ForsetiActivity[]>([]);

  useEffect(() => {
    if (!activityUserId) {
      setForsetiActivity([]);
      return;
    }
    let alive = true;
    ForsetiActivityService.list(activityUserId, activityGuest).then((list) => {
      if (alive) setForsetiActivity(list);
    });
    return () => {
      alive = false;
    };
  }, [activityUserId, activityGuest]);

  // Uma conversa vai do primeiro pedido até o desfecho (lançamento feito); depois começa outra

  const conversationIdRef = useRef<string>(crypto.randomUUID());
  // Último assunto respondido: dá contexto a frases curtas ("e dessa semana?") e à IA de reserva

  const lastTopicRef = useRef<ForsetiTopic | null>(null);

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
    created.forEach((m) => deleteMovement(m.id));
    if (card) deleteCard(card.id);
    updateForsetiActivity(id, { undoneAt: new Date().toISOString() });
    const parts = [
      created.length > 0 ? `${created.length} lançamento${created.length > 1 ? 's' : ''} apagado${created.length > 1 ? 's' : ''}` : '',
      card ? `cartão ${card.name} removido` : '',
    ].filter(Boolean);
    return { ok: true, message: parts.length > 0 ? `Desfeito: ${parts.join(' e ')}.` : 'Desfeito. Os lançamentos já tinham sido apagados.' };
  };

  // Sincronização inicial com Supabase

  return {
    chatHistory, setChatHistory, forsetiFlowRef, requestTrailRef, forsetiActivity, lastTopicRef,
    logForsetiActivity, rateForsetiActivity, undoForsetiActivity,
  };
}
