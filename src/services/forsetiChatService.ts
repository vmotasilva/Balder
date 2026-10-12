import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CHAT_TTL_HOURS, type StoredChat } from '../utils/forsetiChatStore';

/**
 * Conversa da Forseti na nuvem: tabela forseti_chat no Supabase (supabase/forseti_chat.sql), uma linha por pessoa e
 * por planejamento aberto. Enquanto a tabela não existir (ou no modo demonstração), a conversa fica só neste aparelho.
 * Tudo aqui é melhor esforço: falha de rede nunca interrompe a conversa.
 */

const TABLE = 'forseti_chat';
let tableMissing = false;

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''));

const enabled = (isGuest: boolean) => isSupabaseConfigured && !isGuest && !tableMissing;

export const ForsetiChatService = {
  enabled,

  /** A conversa guardada na nuvem, como texto JSON (quem lê valida), ou null se não há ou não deu para ler. */
  async load(userId: string, isGuest: boolean, scope: string): Promise<string | null> {
    if (!enabled(isGuest)) return null;
    try {
      const { data, error } = await supabase.from(TABLE).select('chat').eq('user_id', userId).eq('scope', scope).maybeSingle();
      if (error) {
        if (isMissingTable(error)) tableMissing = true;
        else console.error('[ForsetiChatService] Erro ao buscar a conversa:', error.message);
        return null;
      }
      // Limpa o que passou do prazo
      const cutoff = new Date(Date.now() - CHAT_TTL_HOURS * 3600_000).toISOString();
      supabase.from(TABLE).delete().eq('user_id', userId).lt('saved_at', cutoff).then(() => undefined);
      return data?.chat ? JSON.stringify(data.chat) : null;
    } catch (e) {
      console.error('[ForsetiChatService] Exceção ao buscar a conversa:', e);
      return null;
    }
  },

  async save(userId: string, isGuest: boolean, scope: string, chat: StoredChat): Promise<void> {
    if (!enabled(isGuest)) return;
    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert({ user_id: userId, scope, saved_at: new Date(chat.savedAt).toISOString(), chat });
      if (isMissingTable(error)) tableMissing = true;
      else if (error) console.error('[ForsetiChatService] Erro ao salvar a conversa:', error.message);
    } catch (e) {
      console.error('[ForsetiChatService] Exceção ao salvar a conversa:', e);
    }
  },

  /** "Nova conversa": grava a linha vazia (e não apaga), para os outros aparelhos saberem que foi limpa. */
  clear(userId: string, isGuest: boolean, scope: string): Promise<void> {
    return ForsetiChatService.save(userId, isGuest, scope, { savedAt: Date.now(), messages: [] });
  },
};
