import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ForsetiActivity } from '../types';

/**
 * Histórico das solicitações à Forseti: tabela forseti_activity no Supabase (supabase/forseti_activity.sql).
 * Enquanto a tabela não existir (ou no modo demonstração), o histórico fica só neste navegador.
 * Guarda os últimos FORSETI_ACTIVITY_DAYS dias.
 */

export const FORSETI_ACTIVITY_DAYS = 30;
const TABLE = 'forseti_activity';

let tableMissing = false;
const localKey = (userId: string) => `balder_forseti_activity_${userId}`;
const cutoffIso = () => new Date(Date.now() - FORSETI_ACTIVITY_DAYS * 86400000).toISOString();
const recent = (list: ForsetiActivity[]) => {
  const cutoff = cutoffIso();
  return list.filter((a) => a.at >= cutoff);
};

const readLocal = (userId: string): ForsetiActivity[] => {
  try {
    const raw = localStorage.getItem(localKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? recent(list) : [];
  } catch {
    return [];
  }
};
const writeLocal = (userId: string, list: ForsetiActivity[]) => {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(recent(list)));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
};

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''));

type Row = {
  id: string;
  created_at: string;
  kind: ForsetiActivity['kind'];
  request: string;
  result: string;
  plan_owner_id: string | null;
  plan_owner_name: string | null;
  movements: ForsetiActivity['movements'] | null;
  card_name: string | null;
  rating: ForsetiActivity['rating'] | null;
  undone_at: string | null;
};

const fromRow = (r: Row): ForsetiActivity => ({
  id: r.id,
  at: r.created_at,
  kind: r.kind,
  request: r.request,
  result: r.result,
  planOwnerId: r.plan_owner_id || undefined,
  planOwnerName: r.plan_owner_name || undefined,
  movements: Array.isArray(r.movements) ? r.movements : [],
  cardName: r.card_name || undefined,
  rating: r.rating || undefined,
  undoneAt: r.undone_at || undefined,
});
const toRow = (a: ForsetiActivity, userId: string) => ({
  id: a.id,
  user_id: userId,
  created_at: a.at,
  kind: a.kind,
  request: a.request,
  result: a.result,
  plan_owner_id: a.planOwnerId || null,
  plan_owner_name: a.planOwnerName || null,
  movements: a.movements || [],
  card_name: a.cardName || null,
  rating: a.rating || null,
  undone_at: a.undoneAt || null,
});

const cloudEnabled = (isGuest: boolean) => isSupabaseConfigured && !isGuest && !tableMissing;

export const ForsetiActivityService = {
  /** Últimos dias, mais recentes primeiro; apaga do servidor o que passou do período. */
  async list(userId: string, isGuest: boolean): Promise<ForsetiActivity[]> {
    if (cloudEnabled(isGuest)) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffIso())
        .order('created_at', { ascending: false });
      if (!error) {
        supabase.from(TABLE).delete().eq('user_id', userId).lt('created_at', cutoffIso()).then(() => undefined);
        return (data as Row[]).map(fromRow);
      }
      if (isMissingTable(error)) tableMissing = true;
      else console.error('[ForsetiActivityService] Erro ao buscar histórico:', error.message);
    }
    return readLocal(userId).sort((a, b) => b.at.localeCompare(a.at));
  },

  async save(userId: string, isGuest: boolean, activity: ForsetiActivity): Promise<void> {
    if (cloudEnabled(isGuest)) {
      const { error } = await supabase.from(TABLE).upsert(toRow(activity, userId));
      if (!error) return;
      if (isMissingTable(error)) tableMissing = true;
      else {
        console.error('[ForsetiActivityService] Erro ao salvar histórico:', error.message);
        return;
      }
    }
    const list = readLocal(userId);
    const i = list.findIndex((a) => a.id === activity.id);
    if (i >= 0) list[i] = activity;
    else list.unshift(activity);
    writeLocal(userId, list);
  },
};
