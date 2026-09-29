import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PriceCheckResult } from './priceExtraction';
import type { PriceWatch } from '../utils/opportunity';

/**
 * Onde ficam os produtos acompanhados: tabela price_watches no Supabase (supabase/opportunities.sql).
 * Enquanto a tabela não existir (ou no modo demonstração), a lista fica só neste navegador.
 */

const TABLE = 'price_watches';
export type WatchStorage = 'CLOUD' | 'LOCAL';

let tableMissing = false;
const localKey = (userId: string) => `balder_price_watches_${userId}`;

const readLocal = (userId: string): PriceWatch[] => {
  try {
    const raw = localStorage.getItem(localKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const writeLocal = (userId: string, list: PriceWatch[]) => {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(list));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
};

/** Erro de tabela inexistente (SQL ainda não rodado no Supabase). */
const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''));

type Row = {
  id: string;
  url: string;
  title: string;
  store: string | null;
  image_url: string | null;
  currency: string;
  target_price: number | string | null;
  current_price: number | string | null;
  available: boolean;
  history: PriceWatch['history'] | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
};

const num = (v: number | string | null) => (v == null ? null : Number(v));
const fromRow = (r: Row): PriceWatch => ({
  id: r.id,
  url: r.url,
  title: r.title,
  store: r.store || undefined,
  imageUrl: r.image_url || undefined,
  currency: r.currency || 'BRL',
  targetPrice: num(r.target_price),
  currentPrice: num(r.current_price),
  available: r.available,
  history: Array.isArray(r.history) ? r.history : [],
  lastCheckedAt: r.last_checked_at,
  lastError: r.last_error,
  createdAt: r.created_at,
});
const toRow = (w: PriceWatch, userId: string) => ({
  id: w.id,
  user_id: userId,
  url: w.url,
  title: w.title,
  store: w.store || null,
  image_url: w.imageUrl || null,
  currency: w.currency,
  target_price: w.targetPrice ?? null,
  current_price: w.currentPrice ?? null,
  available: w.available,
  history: w.history,
  last_checked_at: w.lastCheckedAt ?? null,
  last_error: w.lastError ?? null,
});

const cloudEnabled = (isGuest: boolean) => isSupabaseConfigured && !isGuest && !tableMissing;

export const OpportunityService = {
  storage(isGuest: boolean): WatchStorage {
    return cloudEnabled(isGuest) ? 'CLOUD' : 'LOCAL';
  },

  async list(userId: string, isGuest: boolean): Promise<PriceWatch[]> {
    if (cloudEnabled(isGuest)) {
      const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: true });
      if (!error) return (data as Row[]).map(fromRow);
      if (isMissingTable(error)) tableMissing = true;
      else console.error('[OpportunityService] Erro ao buscar produtos:', error.message);
    }
    return readLocal(userId);
  },

  async save(userId: string, isGuest: boolean, watch: PriceWatch): Promise<void> {
    if (cloudEnabled(isGuest)) {
      const { error } = await supabase.from(TABLE).upsert(toRow(watch, userId));
      if (!error) return;
      if (isMissingTable(error)) tableMissing = true;
      else {
        console.error('[OpportunityService] Erro ao salvar produto:', error.message);
        return;
      }
    }
    const list = readLocal(userId);
    const i = list.findIndex((w) => w.id === watch.id);
    if (i >= 0) list[i] = watch;
    else list.push(watch);
    writeLocal(userId, list);
  },

  async remove(userId: string, isGuest: boolean, id: string): Promise<void> {
    if (cloudEnabled(isGuest)) {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (!error) return;
      if (isMissingTable(error)) tableMissing = true;
      else {
        console.error('[OpportunityService] Erro ao remover produto:', error.message);
        return;
      }
    }
    writeLocal(userId, readLocal(userId).filter((w) => w.id !== id));
  },

  /** Lê o produto pela função do servidor (/api/price-check). */
  async check(url: string): Promise<PriceCheckResult> {
    try {
      const res = await fetch(`/api/price-check?url=${encodeURIComponent(url)}`);
      if (!res.ok) return { ok: false, error: 'O serviço de leitura de preços não respondeu. Tente de novo em instantes.' };
      return (await res.json()) as PriceCheckResult;
    } catch {
      return { ok: false, error: 'Sem conexão para consultar a loja agora.' };
    }
  },
};
