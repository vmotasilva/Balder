import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { type ForsetiMemory, type MemoryDraft, MEMORY_LIMIT, isMemoryKind, parseMemory } from '../utils/forsetiMemory';

/**
 * Memória da Forseti: tabela forseti_memories no Supabase (supabase/forseti_memories.sql). É de quem a criou, não do
 * planejamento aberto. Enquanto a tabela não existir (ou no modo demonstração), fica só neste navegador.
 * Falha de rede nunca interrompe a conversa: a cópia daqui sempre é gravada primeiro.
 */

const TABLE = 'forseti_memories';
let tableMissing = false;
const localKey = (userId: string) => `balder_forseti_memories_${userId}`;

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''));

const cloudEnabled = (isGuest: boolean) => isSupabaseConfigured && !isGuest && !tableMissing;

type Row = { id: string; kind: string; title: string; body: string; created_at: string; updated_at: string };

const fromRow = (r: Row): ForsetiMemory | null => {
  const draft = parseMemory({ kind: r.kind, title: r.title, body: r.body });
  return draft && isMemoryKind(r.kind) ? { ...draft, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at } : null;
};
const toRow = (m: ForsetiMemory, userId: string) => ({
  id: m.id, user_id: userId, kind: m.kind, title: m.title, body: m.body, created_at: m.createdAt, updated_at: m.updatedAt,
});

const readLocal = (userId: string): ForsetiMemory[] => {
  try {
    const list = JSON.parse(localStorage.getItem(localKey(userId)) || '[]');
    return Array.isArray(list) ? list.map((m) => fromRow({ id: m.id, kind: m.kind, title: m.title, body: m.body, created_at: m.createdAt, updated_at: m.updatedAt })).filter((m): m is ForsetiMemory => !!m) : [];
  } catch {
    return [];
  }
};
const writeLocal = (userId: string, list: ForsetiMemory[]) => {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(list));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
};

const byRecent = (a: ForsetiMemory, b: ForsetiMemory) => b.updatedAt.localeCompare(a.updatedAt);

export const ForsetiMemoryService = {
  /** A memória está só neste aparelho porque a tabela do Supabase ainda não existe. */
  isLocalOnly: (isGuest: boolean) => !isGuest && isSupabaseConfigured && tableMissing,

  /** Memórias da pessoa, as mais recentes primeiro. O que só existe neste aparelho sobe para a nuvem. */
  async list(userId: string, isGuest: boolean): Promise<ForsetiMemory[]> {
    const local = readLocal(userId);
    if (cloudEnabled(isGuest)) {
      const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (!error) {
        const cloud = (data as Row[]).map(fromRow).filter((m): m is ForsetiMemory => !!m);
        const known = new Set(cloud.map((m) => m.id));
        const onlyLocal = local.filter((m) => !known.has(m.id)).slice(0, Math.max(0, MEMORY_LIMIT - cloud.length));
        if (onlyLocal.length > 0) {
          const { error: uploadError } = await supabase.from(TABLE).upsert(onlyLocal.map((m) => toRow(m, userId)));
          if (uploadError) console.error('[ForsetiMemoryService] Erro ao subir memória local:', uploadError.message);
        }
        const merged = [...cloud, ...onlyLocal].sort(byRecent);
        writeLocal(userId, merged);
        return merged;
      }
      if (isMissingTable(error)) tableMissing = true;
      else console.error('[ForsetiMemoryService] Erro ao buscar a memória:', error.message);
    }
    return local.sort(byRecent);
  },

  /** Grava (cria ou atualiza). A cópia local vem antes: se o envio falhar, a próxima abertura sobe o que ficou. */
  async save(userId: string, isGuest: boolean, memory: ForsetiMemory): Promise<void> {
    const list = readLocal(userId);
    const i = list.findIndex((m) => m.id === memory.id);
    if (i >= 0) list[i] = memory;
    else list.unshift(memory);
    writeLocal(userId, list);
    if (!cloudEnabled(isGuest)) return;
    const { error } = await supabase.from(TABLE).upsert(toRow(memory, userId));
    if (!error) return;
    if (isMissingTable(error)) tableMissing = true;
    else console.error('[ForsetiMemoryService] Erro ao salvar a memória:', error.message);
  },

  async remove(userId: string, isGuest: boolean, id: string): Promise<void> {
    writeLocal(userId, readLocal(userId).filter((m) => m.id !== id));
    if (!cloudEnabled(isGuest)) return;
    const { error } = await supabase.from(TABLE).delete().eq('user_id', userId).eq('id', id);
    if (isMissingTable(error)) tableMissing = true;
    else if (error) console.error('[ForsetiMemoryService] Erro ao apagar a memória:', error.message);
  },

  /** "Esquecer tudo": apaga daqui e da nuvem. */
  async clear(userId: string, isGuest: boolean): Promise<void> {
    writeLocal(userId, []);
    if (!cloudEnabled(isGuest)) return;
    const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
    if (isMissingTable(error)) tableMissing = true;
    else if (error) console.error('[ForsetiMemoryService] Erro ao apagar a memória:', error.message);
  },
};

export const newMemory = (draft: MemoryDraft): ForsetiMemory => {
  const now = new Date().toISOString();
  return { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
