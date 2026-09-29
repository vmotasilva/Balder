/**
 * Oportunidades: produtos acompanhados e a regra que decide quando o preço virou uma boa hora de comprar.
 */

export interface PricePoint {
  at: string; // ISO
  price: number;
  source: 'AUTO' | 'MANUAL';
}

export interface PriceWatch {
  id: string;
  url: string;
  title: string;
  store?: string;
  imageUrl?: string;
  currency: string;
  targetPrice?: number | null;
  currentPrice?: number | null;
  available: boolean;
  history: PricePoint[];
  lastCheckedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export type OpportunityKind = 'ALVO' | 'MENOR_PRECO' | 'QUEDA';

export interface WatchStats {
  first?: number;
  previous?: number;
  lowest?: number;
  highest?: number;
  average?: number;
  /** Variação desde a primeira leitura (negativo = ficou mais barato). */
  changeFromFirstPct: number;
  /** Variação desde a leitura anterior. */
  changeFromPreviousPct: number;
  opportunity: OpportunityKind | null;
  /** Frase curta que explica a oportunidade. */
  reason?: string;
}

/** Queda mínima em relação à média para contar como oportunidade. */
export const DROP_VS_AVERAGE = 0.07;
/** Mantém o histórico enxuto (≈ 4 meses de leituras diárias). */
export const MAX_HISTORY = 120;
/** Idade máxima da última leitura antes de conferir de novo ao abrir o app. */
export const RECHECK_AFTER_MS = 12 * 60 * 60 * 1000;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : 0);

export function watchStats(w: PriceWatch): WatchStats {
  const prices = w.history.map((h) => h.price);
  const current = w.currentPrice ?? prices[prices.length - 1];
  const earlier = prices.slice(0, -1);
  const stats: WatchStats = {
    first: prices[0],
    previous: earlier[earlier.length - 1],
    lowest: prices.length ? Math.min(...prices) : undefined,
    highest: prices.length ? Math.max(...prices) : undefined,
    average: prices.length ? prices.reduce((a, p) => a + p, 0) / prices.length : undefined,
    changeFromFirstPct: current != null && prices[0] != null ? pct(current, prices[0]) : 0,
    changeFromPreviousPct: current != null && earlier.length ? pct(current, earlier[earlier.length - 1]) : 0,
    opportunity: null,
  };
  if (current == null || !w.available) return stats;

  if (w.targetPrice && current <= w.targetPrice) {
    stats.opportunity = 'ALVO';
    stats.reason = `Chegou ao seu preço-alvo de ${brl(w.targetPrice)}.`;
  } else if (earlier.length >= 1 && current < Math.min(...earlier)) {
    stats.opportunity = 'MENOR_PRECO';
    stats.reason = `Menor preço desde que você começou a acompanhar (antes: ${brl(Math.min(...earlier))}).`;
  } else if (earlier.length >= 2) {
    const avg = earlier.reduce((a, p) => a + p, 0) / earlier.length;
    if (current <= avg * (1 - DROP_VS_AVERAGE)) {
      stats.opportunity = 'QUEDA';
      stats.reason = `${Math.abs(pct(current, avg)).toLocaleString('pt-BR')}% abaixo da média (${brl(avg)}).`;
    }
  }
  return stats;
}

export const OPPORTUNITY_LABEL: Record<OpportunityKind, string> = {
  ALVO: 'Preço-alvo atingido',
  MENOR_PRECO: 'Menor preço',
  QUEDA: 'Preço em queda',
};

/** Acrescenta uma leitura ao histórico (uma nova só entra se o preço mudou ou passou 1 dia). */
export function withReading(w: PriceWatch, price: number, source: PricePoint['source'], at = new Date()): PriceWatch {
  const last = w.history[w.history.length - 1];
  const sameDayAndPrice = last && last.price === price && at.getTime() - new Date(last.at).getTime() < 20 * 60 * 60 * 1000;
  const history = sameDayAndPrice ? w.history : [...w.history, { at: at.toISOString(), price, source }].slice(-MAX_HISTORY);
  return { ...w, history, currentPrice: price, lastCheckedAt: at.toISOString(), lastError: null };
}

export const isStale = (w: PriceWatch, now = Date.now()) =>
  !w.lastCheckedAt || now - new Date(w.lastCheckedAt).getTime() > RECHECK_AFTER_MS;

/** Texto livre (não é link): atalhos de busca nas lojas para achar a página do produto. */
export function storeSearchLinks(query: string): { store: string; url: string }[] {
  const q = encodeURIComponent(query.trim());
  return [
    { store: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { store: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${q}` },
    { store: 'Amazon', url: `https://www.amazon.com.br/s?k=${q}` },
    { store: 'Magalu', url: `https://www.magazineluiza.com.br/busca/${q}/` },
    { store: 'Kabum', url: `https://www.kabum.com.br/busca/${q}` },
  ];
}
