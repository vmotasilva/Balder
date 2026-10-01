import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import { OpportunityService, type WatchStorage } from '../services/opportunityService';
import type { ProductSnapshot } from '../services/priceExtraction';
import { isStale, watchOffers, withOffers, withReading, type PriceWatch, type WatchOffer } from '../utils/opportunity';

/**
 * Lista de produtos acompanhados, compartilhada entre a tela de Oportunidades e a Central de notificações.
 * Ao abrir o app, confere de novo os produtos lidos há mais de 12 horas.
 */

interface State {
  userId: string | null;
  isGuest: boolean;
  watches: PriceWatch[];
  loaded: boolean;
  checkingIds: string[];
}

let state: State = { userId: null, isGuest: false, watches: [], loaded: false, checkingIds: [] };
let loadingFor: string | null = null;
let autoCheckedFor: string | null = null;
const listeners = new Set<() => void>();

const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

const persist = async (w: PriceWatch) => {
  if (!state.userId) return;
  setState({ watches: state.watches.some((x) => x.id === w.id) ? state.watches.map((x) => (x.id === w.id ? w : x)) : [...state.watches, w] });
  await OpportunityService.save(state.userId, state.isGuest, w);
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

async function load(userId: string, isGuest: boolean) {
  if (loadingFor === userId) return;
  loadingFor = userId;
  setState({ userId, isGuest, watches: [], loaded: false, checkingIds: [] });
  const watches = await OpportunityService.list(userId, isGuest);
  if (state.userId !== userId) return;
  setState({ watches, loaded: true });
  if (autoCheckedFor !== userId) {
    autoCheckedFor = userId;
    void actions.checkStale();
  }
}

export const opportunityActions = {
  /** Começa a acompanhar um produto já lido da loja. */
  async add(product: ProductSnapshot, targetPrice: number | null): Promise<PriceWatch> {
    const base: PriceWatch = {
      id: newId(),
      url: product.url,
      title: product.title,
      store: product.store,
      imageUrl: product.imageUrl,
      currency: product.currency,
      targetPrice,
      currentPrice: null,
      available: product.available,
      history: [],
      createdAt: new Date().toISOString(),
    };
    const watch = withReading(base, product.price, 'AUTO');
    await persist(watch);
    return watch;
  },

  /** Produto de uma loja que bloqueia a leitura: o preço é informado pela pessoa. */
  async addManual(url: string, title: string, price: number, targetPrice: number | null): Promise<PriceWatch> {
    let store: string | undefined;
    try {
      store = new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/^./, (c) => c.toUpperCase());
    } catch {
      store = undefined;
    }
    const base: PriceWatch = {
      id: newId(),
      url,
      title,
      store,
      currency: 'BRL',
      targetPrice,
      currentPrice: null,
      available: true,
      history: [],
      createdAt: new Date().toISOString(),
    };
    const watch = withReading(base, price, 'MANUAL');
    await persist(watch);
    return watch;
  },

  /** Começa a acompanhar um produto em várias lojas de uma vez (as escolhidas na busca). */
  async addGroup(title: string, imageUrl: string | undefined, picks: OfferPick[], targetPrice: number | null): Promise<PriceWatch> {
    const now = new Date();
    const offers: WatchOffer[] = picks.map((p) => ({
      id: newId(),
      url: p.url,
      store: p.store,
      title: p.title,
      imageUrl: p.imageUrl,
      price: p.price,
      available: true,
      condition: p.condition,
      origin: p.origin,
      installments: p.installments,
      noInterest: p.noInterest,
      health: 'OK',
      lastCheckedAt: now.toISOString(),
      lastError: null,
      history: [{ at: now.toISOString(), price: p.price, source: 'AUTO' }],
    }));
    const base: PriceWatch = {
      id: newId(),
      url: picks[0].url,
      title,
      store: picks[0].store,
      imageUrl,
      currency: 'BRL',
      targetPrice,
      currentPrice: null,
      available: true,
      history: [],
      createdAt: now.toISOString(),
    };
    const watch = withOffers(base, offers, now);
    await persist(watch);
    return watch;
  },

  /** Acrescenta uma loja (link) a um produto já acompanhado; confere antes se o link mostra o produto. */
  async addOffer(id: string, url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const w = state.watches.find((x) => x.id === id);
    if (!w) return { ok: false, error: 'Produto não encontrado.' };
    if (watchOffers(w).some((o) => o.url === url)) return { ok: false, error: 'Essa loja já está sendo acompanhada.' };
    const result = await OpportunityService.check(url, w.title);
    if (!result.ok) return { ok: false, error: result.error };
    const now = new Date();
    const offer: WatchOffer = {
      id: newId(),
      url,
      store: result.product.store,
      title: result.product.title,
      imageUrl: result.product.imageUrl,
      price: result.product.price,
      available: result.product.available,
      health: 'OK',
      lastCheckedAt: now.toISOString(),
      lastError: null,
      history: [{ at: now.toISOString(), price: result.product.price, source: 'AUTO' }],
    };
    await persist(withOffers(w, [...watchOffers(w), offer], now));
    return { ok: true };
  },

  async removeOffer(id: string, offerId: string) {
    const w = state.watches.find((x) => x.id === id);
    if (!w) return;
    const rest = watchOffers(w).filter((o) => o.id !== offerId);
    if (rest.length === 0) return;
    await persist(withOffers(w, rest));
  },

  async update(watch: PriceWatch) {
    await persist(watch);
  },

  async setManualPrice(id: string, price: number) {
    const w = state.watches.find((x) => x.id === id);
    if (w) await persist(withReading(w, price, 'MANUAL'));
  },

  async remove(id: string) {
    if (!state.userId) return;
    setState({ watches: state.watches.filter((w) => w.id !== id) });
    await OpportunityService.remove(state.userId, state.isGuest, id);
  },

  /** Lê o preço de novo na loja. */
  async check(id: string) {
    const w = state.watches.find((x) => x.id === id);
    if (!w || state.checkingIds.includes(id)) return;
    setState({ checkingIds: [...state.checkingIds, id] });
    try {
      // Produto com várias lojas: confere cada link (e se ainda abre o mesmo produto) e fica com o menor preço
      if (w.offers && w.offers.length > 0) {
        const checked = await Promise.all(w.offers.map((o) => checkOffer(o, w.title)));
        const current = state.watches.find((x) => x.id === id);
        if (current) await persist(withOffers(current, checked));
        return;
      }
      const result = await OpportunityService.check(w.url);
      const current = state.watches.find((x) => x.id === id);
      if (!current) return;
      if (result.ok) {
        await persist({ ...withReading(current, result.product.price, 'AUTO'), available: result.product.available, imageUrl: current.imageUrl || result.product.imageUrl });
      } else {
        await persist({ ...current, lastCheckedAt: new Date().toISOString(), lastError: result.error });
      }
    } finally {
      setState({ checkingIds: state.checkingIds.filter((x) => x !== id) });
    }
  },

  /** Confere, um de cada vez, todos os produtos (ou só os lidos há mais de 12 horas). */
  async checkAll(onlyStale = false) {
    const ids = state.watches.filter((w) => !onlyStale || isStale(w)).map((w) => w.id);
    for (const id of ids) {
      await actions.check(id);
    }
  },

  checkStale() {
    return actions.checkAll(true);
  },
};
const actions = opportunityActions;

/** Oferta escolhida na busca. */
export interface OfferPick {
  url: string;
  store: string;
  title: string;
  imageUrl?: string;
  price: number;
  condition?: WatchOffer['condition'];
  origin?: WatchOffer['origin'];
  installments?: number;
  noInterest?: boolean;
}

/** Lê uma oferta de novo e registra o preço e a situação do link. */
async function checkOffer(o: WatchOffer, productTitle: string): Promise<WatchOffer> {
  const at = new Date();
  const result = await OpportunityService.check(o.url, o.title || productTitle);
  if (result.ok) {
    const last = o.history[o.history.length - 1];
    const same = last && last.price === result.product.price && at.getTime() - new Date(last.at).getTime() < 20 * 60 * 60 * 1000;
    return {
      ...o,
      price: result.product.price,
      available: result.product.available,
      health: 'OK',
      lastCheckedAt: at.toISOString(),
      lastError: null,
      history: same ? o.history : [...o.history, { at: at.toISOString(), price: result.product.price, source: 'AUTO' as const }].slice(-120),
    };
  }
  // Link que não mostra o produto (ou loja que barrou a leitura) fica marcado e não entra no menor preço
  return { ...o, health: result.kind || 'ERRO', lastCheckedAt: at.toISOString(), lastError: result.error };
}

export function useOpportunities() {
  const { user } = useAuth();
  const s = useSyncExternalStore(subscribe, snapshot);
  const userId = user?.$id || null;
  const isGuest = !!user?.isGuest;

  useEffect(() => {
    if (userId && state.userId !== userId) void load(userId, isGuest);
  }, [userId, isGuest]);

  const mine = s.userId === userId;
  return {
    watches: mine ? s.watches : [],
    loaded: mine && s.loaded,
    checkingIds: s.checkingIds,
    storage: OpportunityService.storage(isGuest) as WatchStorage,
    ...opportunityActions,
  };
}
