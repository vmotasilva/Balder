import type { ProductCondition, ProductOrigin, SearchResult } from '../services/productSearch';

/** Filtros da busca: refinam o que veio de todas as lojas. "Não informado" passa quando includeUnknown está ligado. */
export interface OfferFilters {
  condition: 'ANY' | ProductCondition;
  origin: 'ANY' | ProductOrigin;
  /** 0 = qualquer */
  minInstallments: number;
  noInterestOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  /** Vazio = todas as lojas */
  stores: string[];
  includeUnknown: boolean;
}

export const DEFAULT_FILTERS: OfferFilters = {
  condition: 'ANY',
  origin: 'ANY',
  minInstallments: 0,
  noInterestOnly: false,
  minPrice: null,
  maxPrice: null,
  stores: [],
  includeUnknown: true,
};

export const activeFilterCount = (f: OfferFilters) =>
  [f.condition !== 'ANY', f.origin !== 'ANY', f.minInstallments > 0, f.noInterestOnly, f.minPrice != null, f.maxPrice != null, f.stores.length > 0].filter(Boolean).length;

export function applyFilters(results: SearchResult[], f: OfferFilters): SearchResult[] {
  return results.filter((r) => {
    if (f.minPrice != null && r.price < f.minPrice) return false;
    if (f.maxPrice != null && r.price > f.maxPrice) return false;
    if (f.stores.length > 0 && !f.stores.includes(r.store)) return false;
    // Dados que a loja não informa: passam só se a pessoa aceitar "não informado"
    const ok = (known: boolean, matches: boolean) => (known ? matches : f.includeUnknown);
    if (f.condition !== 'ANY' && !ok(r.condition != null, r.condition === f.condition)) return false;
    if (f.origin !== 'ANY' && !ok(r.origin != null, r.origin === f.origin)) return false;
    if (f.minInstallments > 0 && !ok(r.installments != null, (r.installments ?? 0) >= f.minInstallments)) return false;
    if (f.noInterestOnly && !ok(r.noInterest != null, r.noInterest === true)) return false;
    return true;
  });
}

// ── Agrupamento: o mesmo produto em várias lojas ──

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const tokensOf = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2 || /\d/.test(t)));
const modelNumbers = (t: Set<string>) => new Set([...t].filter((x) => /\d{2,}/.test(x)));

// Palavras que mudam o produto: se só um dos anúncios tem, não é o mesmo item (console x controle, com ou sem jogo).
const DIFFERENTIATORS = new Set([
  'controle', 'controller', 'jogo', 'game', 'capa', 'case', 'cabo', 'carregador', 'bundle', 'edicao', 'pro', 'lite', 'oled',
  'plus', 'max', 'mini', 'kit', 'combo', 'fonte', 'bateria', 'pelicula', 'suporte', 'dock', 'acessorio', 'usado', 'seminovo',
  'recondicionado', 'cartao', 'memoria', 'fone', 'headset', 'mouse', 'teclado', 'refil', 'filtro',
]);

const sameProduct = (a: Set<string>, b: Set<string>) => {
  const na = modelNumbers(a);
  const nb = modelNumbers(b);
  if (na.size !== nb.size || [...na].some((x) => !nb.has(x))) return false;
  const da = [...a].filter((x) => DIFFERENTIATORS.has(x));
  const db = [...b].filter((x) => DIFFERENTIATORS.has(x));
  if (da.length !== db.length || da.some((x) => !b.has(x))) return false;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  // Um anúncio costuma ter mais texto (cores, "Console"): vale quando o menor está quase todo no maior
  return inter / Math.min(a.size, b.size) >= 0.8 && inter / union >= 0.35;
};

export interface ProductGroup {
  id: string;
  title: string;
  imageUrl?: string;
  /** Uma oferta por loja (a mais barata), da mais barata para a mais cara. */
  offers: SearchResult[];
}

export function groupResults(results: SearchResult[]): ProductGroup[] {
  const groups: { tokens: Set<string>; items: SearchResult[] }[] = [];
  for (const r of results) {
    const t = tokensOf(r.title);
    const hit = groups.find((g) => sameProduct(g.tokens, t));
    if (hit) hit.items.push(r);
    else groups.push({ tokens: t, items: [r] });
  }
  return groups.map((g, i) => {
    const byStore = new Map<string, SearchResult>();
    for (const r of g.items) {
      const cur = byStore.get(r.store);
      if (!cur || r.price < cur.price) byStore.set(r.store, r);
    }
    const offers = [...byStore.values()].sort((a, b) => a.price - b.price);
    const withImage = offers.find((o) => o.imageUrl);
    return {
      id: `g${i}_${offers[0].url}`,
      // Título mais curto costuma ser o mais limpo (sem o texto promocional das lojas)
      title: [...g.items].sort((a, b) => a.title.length - b.title.length)[0].title,
      imageUrl: withImage?.imageUrl,
      offers,
    };
  });
}

// ── Sugestões já marcadas ──

export interface OfferSuggestion {
  offer: SearchResult;
  reasons: string[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Até 3 ofertas de perfis diferentes: menor preço, melhor parcelamento e uma alternativa em outra loja. */
export function suggestOffers(group: ProductGroup): OfferSuggestion[] {
  const picks = new Map<string, OfferSuggestion>();
  const add = (offer: SearchResult | undefined, reason: string) => {
    if (!offer) return;
    const cur = picks.get(offer.url);
    if (cur) cur.reasons.push(reason);
    else picks.set(offer.url, { offer, reasons: [reason] });
  };
  const cheapest = group.offers[0];
  add(cheapest, `menor preço: ${brl(cheapest.price)}`);

  const withInstallments = group.offers.filter((o) => o.installments && o.installments >= 2);
  const bestInstallments = [...withInstallments].sort(
    (a, b) => Number(b.noInterest === true) - Number(a.noInterest === true) || (b.installments ?? 0) - (a.installments ?? 0) || a.price - b.price
  )[0];
  if (bestInstallments) add(bestInstallments, `melhor parcelado: até ${bestInstallments.installments}x${bestInstallments.noInterest ? ' sem juros' : ''}`);

  if (picks.size < 2) {
    const alt = group.offers.find((o) => !picks.has(o.url));
    add(alt, `alternativa em outra loja: ${alt ? brl(alt.price) : ''}`);
  }
  return [...picks.values()].slice(0, 3);
}
