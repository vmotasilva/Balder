import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ExpenseNature, ReceiptItemLine } from '../types';
import { MAX_ITEMS_PER_CALL, applySuggestions, buildOptions, cleanItemName, itemKey } from '../utils/receiptItemSuggest';

/**
 * Pede à IA (api/forseti-items), em UMA chamada por cupom, em qual item do mapeamento cada linha desconhecida entra.
 * Só saem nomes (linhas do cupom e itens do mapeamento), nunca valores. O que já foi perguntado fica guardado neste aparelho:
 * a mesma descrição não volta à IA. Sem login, offline, lento ou sem sugestão, o cupom segue exatamente como estava.
 */

const CACHE_KEY = 'balder_receipt_ai_suggestions';
/** "Sem sugestão" vale por um tempo: a pessoa pode ter cadastrado o item depois. */
const NO_MATCH_DAYS = 7;
const TIMEOUT_MS = 8000;

type Cached = { id: string | null; at: number };

const readCache = (): Record<string, Cached> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
const writeCache = (cache: Record<string, Cached>) => {
  try {
    // Mantém só as mais recentes para não crescer sem fim
    const entries = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, 500);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
};

async function askApi(names: string[], options: ReturnType<typeof buildOptions>): Promise<Map<string, string | null> | null> {
  if (!isSupabaseConfigured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/forseti-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: names, options }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: { name?: unknown; option?: unknown }[] };
    const valid = new Set(options.map((o) => o.id));
    const out = new Map<string, string | null>();
    (data.matches || []).forEach((m) => {
      if (typeof m.name !== 'string') return;
      out.set(itemKey(m.name), typeof m.option === 'string' && valid.has(m.option) ? m.option : null);
    });
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Preenche com a sugestão da Forseti as linhas do cupom que as regras não souberam associar. Nunca falha: devolve as linhas como vieram. */
export async function suggestReceiptItems(items: ReceiptItemLine[], natures: ExpenseNature[]): Promise<ReceiptItemLine[]> {
  try {
    const options = buildOptions(natures);
    const pending = items.filter((it) => !it.matchedMappingItemId);
    if (options.length === 0 || pending.length === 0) return items;

    const validIds = new Set(options.map((o) => o.id));
    const cache = readCache();
    const now = Date.now();
    const known = new Map<string, string | null>();
    const toAsk = new Map<string, string>(); // chave → nome limpo
    for (const it of pending) {
      const name = cleanItemName(it.rawName || it.detectedName);
      if (!name) continue;
      const key = itemKey(name);
      const hit = cache[key];
      const fresh = hit && (hit.id ? validIds.has(hit.id) : now - hit.at < NO_MATCH_DAYS * 86400000);
      if (fresh) known.set(key, hit.id);
      else if (!toAsk.has(key)) toAsk.set(key, name);
    }

    if (toAsk.size > 0) {
      const answered = await askApi([...toAsk.values()].slice(0, MAX_ITEMS_PER_CALL), options);
      if (answered) {
        answered.forEach((id, key) => {
          known.set(key, id);
          cache[key] = { id, at: now };
        });
        writeCache(cache);
      }
    }
    return known.size > 0 ? applySuggestions(items, known, natures) : items;
  } catch {
    return items;
  }
}
