import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ForsetiActivity } from '../types';

/**
 * Conversas da Forseti guardadas para estudo (melhorar a associação de palavras-chave).
 * Só grava: o usuário não lê (sem política de leitura em supabase/forseti_conversations.sql);
 * quem administra o projeto consulta pelo painel do Supabase. Sem prazo de expiração.
 * Enquanto a tabela não existir (ou no modo demonstração), não faz nada.
 */
const TABLE = 'forseti_conversations';
let tableMissing = false;

export const ForsetiTranscriptService = {
  /** Registra um evento da solicitação (criação, avaliação ou desfazer). Nunca interrompe o app. */
  async record(userId: string, isGuest: boolean, activity: ForsetiActivity, conversationId?: string): Promise<void> {
    if (!isSupabaseConfigured || isGuest || tableMissing) return;
    try {
      const { error } = await supabase.from(TABLE).insert({
        activity_id: activity.id,
        conversation_id: conversationId || null,
        user_id: userId,
        created_at: activity.at,
        kind: activity.kind,
        request: activity.request,
        result: activity.result,
        rating: activity.rating || null,
        undone_at: activity.undoneAt || null,
      });
      if (error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''))) {
        tableMissing = true;
      }
    } catch {
      // armazenamento para estudo é opcional
    }
  },
};
