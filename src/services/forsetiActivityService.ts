import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ForsetiActivity } from '../types';

/**
 * Histórico das solicitações à Forseti: tabela forseti_activity no Supabase (supabase/forseti_activity.sql).
 * Enquanto a tabela não existir (ou no modo demonstração), o histórico fica só neste navegador.
 * Guarda só as últimas FORSETI_ACTIVITY_HOURS horas: o que for mais antigo é apagado.
 */

export const FORSETI_ACTIVITY_HOURS = 48;
const TABLE = 'forseti_activity';

let tableMissing = false;
const localKey = (userId: string) => `balder_forseti_activity_${userId}`;
export const activityCutoffIso = () => new Date(Date.now() - FORSETI_ACTIVITY_HOURS * 3600000).toISOString();
const cutoffIso = activityCutoffIso;
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
  /** O histórico está só neste aparelho porque a tabela do Supabase ainda não existe (supabase/forseti_activity.sql). */
  isLocalOnly: (isGuest: boolean) => !isGuest && isSupabaseConfigured && tableMissing,

  /**
   * Últimos dias, mais recentes primeiro; apaga do servidor o que passou do período.
   * Solicitações que só existem neste aparelho (feitas antes da tabela existir ou durante uma falha) sobem para a
   * nuvem, para o app instalado e o navegador mostrarem o mesmo histórico.
   */
  async list(userId: string, isGuest: boolean): Promise<ForsetiActivity[]> {
    const local = readLocal(userId);
    if (cloudEnabled(isGuest)) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffIso())
        .order('created_at', { ascending: false });
      if (!error) {
        supabase.from(TABLE).delete().eq('user_id', userId).lt('created_at', cutoffIso()).then(() => undefined);
        const cloud = (data as Row[]).map(fromRow);
        const known = new Set(cloud.map((a) => a.id));
        const onlyLocal = local.filter((a) => !known.has(a.id));
        if (onlyLocal.length > 0) {
          const { error: uploadError } = await supabase.from(TABLE).upsert(onlyLocal.map((a) => toRow(a, userId)));
          if (uploadError) console.error('[ForsetiActivityService] Erro ao subir histórico local:', uploadError.message);
        }
        const merged = [...cloud, ...onlyLocal].sort((a, b) => b.at.localeCompare(a.at));
        writeLocal(userId, merged);
        return merged;
      }
      if (isMissingTable(error)) tableMissing = true;
      else console.error('[ForsetiActivityService] Erro ao buscar histórico:', error.message);
    }
    return local.sort((a, b) => b.at.localeCompare(a.at));
  },

  async save(userId: string, isGuest: boolean, activity: ForsetiActivity): Promise<void> {
    // Sempre guarda uma cópia aqui: se o envio falhar, a próxima abertura sobe o que ficou para trás
    const list = readLocal(userId);
    const i = list.findIndex((a) => a.id === activity.id);
    if (i >= 0) list[i] = activity;
    else list.unshift(activity);
    writeLocal(userId, list);
    if (!cloudEnabled(isGuest)) return;
    const { error } = await supabase.from(TABLE).upsert(toRow(activity, userId));
    if (!error) return;
    if (isMissingTable(error)) tableMissing = true;
    else console.error('[ForsetiActivityService] Erro ao salvar histórico:', error.message);
  },
};
