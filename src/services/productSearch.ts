/**
 * Busca de produtos por nome em comparadores/lojas que respondem sem chave de API.
 * Sem DOM: roda na função do servidor (Vercel) e no servidor de desenvolvimento.
 *
 * Fontes: Zoom (comparador, mostra o menor preço entre várias lojas) e Kabum (loja).
 * Cada fonte falha sozinha: se uma não responder, as outras continuam valendo.
 */

import { parsePrice } from './priceExtraction.js';

export type ProductCondition = 'NOVO' | 'USADO' | 'RECONDICIONADO';
export type ProductOrigin = 'NACIONAL' | 'IMPORTADO';

export interface SearchResult {
  title: string;
  price: number;
  /** Loja que oferece o preço (ou a fonte, quando o comparador não diz). */
  store: string;
  /** Fonte consultada. */
  source: 'Zoom' | 'Kabum' | 'Amazon';
  url: string;
  imageUrl?: string;
  installment?: string;
  /** Só preenchidos quando a loja informa (ou o título deixa claro); vazio = não informado. */
  condition?: ProductCondition;
  origin?: ProductOrigin;
  /** Número de parcelas e se são sem juros, lidos do texto de parcelamento. */
  installments?: number;
  noInterest?: boolean;
}

export type ProductSearchResponse =
  | { ok: true; results: SearchResult[]; failedSources: string[] }
  | { ok: false; error: string };

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 60;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

const clean = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function getText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Zoom: os cartões de produto já vêm prontos no HTML. */
export function parseZoom(html: string): SearchResult[] {
  const out: SearchResult[] = [];
  const marker = 'data-testid="product-card::card"';
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at < 0) break;
    const next = html.indexOf(marker, at + marker.length);
    const chunk = html.slice(at, next < 0 ? at + 6000 : next);
    from = at + marker.length;

    const anchorStart = html.lastIndexOf('<a ', at);
    const href = html.slice(anchorStart, at).match(/href="([^"]+)"/)?.[1];
    const title = chunk.match(/data-testid="product-card::name"[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    const price = parsePrice(chunk.match(/data-testid="product-card::price"[^>]*>\s*<strong>([^<]+)</)?.[1]);
    if (!href || !title || !price) continue;

    const merchant = chunk.match(/aria-label="Menor preço"[^>]*><span>([^<]+)</)?.[1];
    const image = chunk.match(/<img[^>]+src="(https:[^"]+)"/)?.[1];
    const installment = chunk.match(/data-testid="product-card::installment"[^>]*><span>([^<]+)</)?.[1];
    // Remove os parâmetros de rastreio do link do Zoom
    const path = decode(href).split('?')[0];
    out.push({
      title: clean(title),
      price,
      store: merchant ? clean(merchant).replace(/^via\s+/i, '') : 'Zoom',
      source: 'Zoom',
      url: path.startsWith('http') ? path : `https://www.zoom.com.br${path}`,
      imageUrl: image ? decode(image) : undefined,
      installment: installment ? clean(installment) : undefined,
    });
  }
  return out;
}

interface KabumItem {
  code?: number;
  name?: string;
  friendlyName?: string;
  image?: string;
  price?: number;
  priceWithDiscount?: number;
  available?: boolean;
  maxInstallment?: string;
}

/** Kabum: os produtos vêm no JSON da página (__NEXT_DATA__). */
export function parseKabum(html: string): SearchResult[] {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return [];
  let items: KabumItem[] = [];
  try {
    items = JSON.parse(json)?.props?.pageProps?.data?.catalogServer?.data ?? [];
  } catch {
    return [];
  }
  const out: SearchResult[] = [];
  for (const p of items) {
    if (!p.name || !p.code || !p.friendlyName || p.available === false) continue;
    // O preço de vitrine da Kabum é o à vista (Pix), igual ao que a loja mostra no destaque
    const price = parsePrice(p.priceWithDiscount || p.price);
    if (!price) continue;
    out.push({
      title: clean(p.name),
      price,
      store: 'Kabum',
      source: 'Kabum',
      url: `https://www.kabum.com.br/produto/${p.code}/${p.friendlyName}`,
      imageUrl: p.image || undefined,
      installment: p.maxInstallment || undefined,
    });
  }
  return out;
}

/** Amazon: cada resultado é um bloco s-search-result com título, preço e imagem. */
export function parseAmazon(html: string): SearchResult[] {
  const marks = [...html.matchAll(/<div[^>]*data-component-type="s-search-result"[^>]*>/g)];
  const out: SearchResult[] = [];
  marks.forEach((m, i) => {
    const start = m.index ?? 0;
    const chunk = html.slice(start, marks[i + 1]?.index ?? start + 12000);
    const asin = m[0].match(/data-asin="([^"]+)"/)?.[1];
    const title = chunk.match(/<h2[^>]*aria-label="([^"]+)"/)?.[1] || chunk.match(/<h2[\s\S]*?<span[^>]*>([^<]+)</)?.[1];
    // O primeiro a-offscreen é o preço atual ("De: ..." vem depois e é o preço antigo)
    const priceText = [...chunk.matchAll(/class="a-offscreen">([^<]+)</g)].map((x) => x[1]).find((t) => /R\$/.test(t) && !/^De/i.test(t.trim()));
    const price = parsePrice(priceText);
    if (!asin || !title || !price) return;
    const image = chunk.match(/class="s-image"[^>]*src="([^"]+)"/)?.[1] || chunk.match(/src="([^"]+)"[^>]*class="s-image"/)?.[1];
    out.push({
      title: clean(title),
      price,
      store: 'Amazon',
      source: 'Amazon',
      url: `https://www.amazon.com.br/dp/${asin}`,
      imageUrl: image ? decode(image) : undefined,
    });
  });
  return out;
}

const USED_RE = /\b(usado|usada|seminovo|semi-novo|semi novo|segunda m[aã]o)\b/i;
const REFURB_RE = /\b(recondicionado|recondicionada|renovado|renovada|open box|vitrine|outlet)\b/i;
const IMPORTED_RE = /\b(importado|importada|internacional|importa[cç][aã]o|aliexpress)\b/i;

/** Acrescenta condição, origem e parcelas, só quando o texto deixa claro (senão fica "não informado"). */
export function enrichResult(r: SearchResult): SearchResult {
  const text = fold(`${r.title} ${r.store}`);
  const condition: ProductCondition | undefined = REFURB_RE.test(text) ? 'RECONDICIONADO' : USED_RE.test(text) ? 'USADO' : undefined;
  const origin: ProductOrigin | undefined = IMPORTED_RE.test(text) ? 'IMPORTADO' : /\b(nacional|brasil)\b/.test(text) ? 'NACIONAL' : undefined;
  const inst = r.installment ? fold(r.installment) : '';
  const count = inst.match(/(\d{1,2})\s*x/)?.[1];
  return {
    ...r,
    condition: r.condition ?? condition,
    origin: r.origin ?? origin,
    installments: r.installments ?? (count ? Number(count) : undefined),
    noInterest: r.noInterest ?? (/sem juros/.test(inst) ? true : undefined),
  };
}

const tokens = (q: string) => fold(q).split(/[^a-z0-9]+/).filter((t) => t.length > 1 || /\d/.test(t));

/** A loja devolve resultados "parecidos" (a Kabum, por exemplo, mistura categorias): só entra quem cita todos os termos. */
export function matchesQuery(title: string, query: string): boolean {
  const t = fold(title);
  const words = tokens(query);
  return words.length > 0 && words.every((w) => t.includes(w));
}

export async function searchProducts(rawQuery: string): Promise<ProductSearchResponse> {
  const query = rawQuery.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (query.length < 2) return { ok: false, error: 'Digite pelo menos 2 letras para buscar.' };

  const q = encodeURIComponent(query);
  const sources: { name: string; run: () => Promise<SearchResult[]> }[] = [
    { name: 'Zoom', run: async () => parseZoom(await getText(`https://www.zoom.com.br/search?q=${q}`)) },
    { name: 'Kabum', run: async () => parseKabum(await getText(`https://www.kabum.com.br/busca/${q.replace(/%20/g, '-')}`)) },
    { name: 'Amazon', run: async () => parseAmazon(await getText(`https://www.amazon.com.br/s?k=${q.replace(/%20/g, '+')}`)) },
  ];
  const settled = await Promise.allSettled(sources.map((s) => s.run()));

  const failedSources: string[] = [];
  const lists: SearchResult[][] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') lists.push(r.value.filter((p) => matchesQuery(p.title, query)));
    else failedSources.push(sources[i].name);
  });
  if (failedSources.length === sources.length) {
    return { ok: false, error: 'Não consegui consultar as lojas agora. Tente de novo em instantes ou cole o link do produto.' };
  }

  // Relevância: cada fonte já ordena do mais ao menos relevante; intercala para nenhuma dominar o topo
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (let i = 0; results.length < MAX_RESULTS && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const r = l[i];
      if (r && !seen.has(r.url) && results.length < MAX_RESULTS) {
        seen.add(r.url);
        results.push(r);
      }
    }
  }

  return { ok: true, results: results.map(enrichResult), failedSources };
}
