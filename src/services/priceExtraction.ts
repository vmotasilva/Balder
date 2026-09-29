/**
 * Leitura do preço de um produto a partir do HTML da página da loja.
 * Sem DOM: roda na função do servidor (Vercel) e no servidor de desenvolvimento.
 *
 * Ordem de confiança: dados estruturados (JSON-LD schema.org Product) → metatags de produto
 * (og/product:price, itemprop="price") → marcações conhecidas de lojas (Amazon).
 */

export interface ProductSnapshot {
  url: string;
  title: string;
  price: number;
  currency: string;
  store: string;
  imageUrl?: string;
  available: boolean;
}

export type PriceCheckResult = { ok: true; product: ProductSnapshot } | { ok: false; error: string };

const MAX_HTML_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** "1.234,56", "1234.56", "R$ 1.234", 1234.56 → 1234.56 */
export function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const m = value.replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!m) return null;
  let raw = m[0].replace(/[.,]$/, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  if (lastComma > lastDot) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1 && lastComma > -1) {
    raw = raw.replace(/,/g, '');
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, '');
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const metaContent = (html: string, key: string): string | undefined => {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${esc}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() : undefined;
};

type Json = Record<string, unknown>;
const asArray = <T,>(v: T | T[] | undefined | null): T[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const typeOf = (o: Json) => asArray(o['@type'] as string | string[]).map((t) => String(t).toLowerCase());

/** Todos os objetos dos blocos JSON-LD (inclui @graph e listas). */
function jsonLdObjects(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const walk = (node: unknown) => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === 'object') {
          out.push(node as Json);
          const graph = (node as Json)['@graph'];
          if (graph) walk(graph);
        }
      };
      walk(parsed);
    } catch {
      // bloco inválido: ignora
    }
  }
  return out;
}

function fromJsonLd(html: string): Partial<ProductSnapshot> | null {
  const product = jsonLdObjects(html).find((o) => typeOf(o).includes('product'));
  if (!product) return null;
  let price: number | null = null;
  let currency = 'BRL';
  let available = true;
  for (const offer of asArray(product.offers as Json | Json[])) {
    const spec = asArray(offer.priceSpecification as Json | Json[])[0];
    const candidates = [offer.price, offer.lowPrice, spec?.price];
    for (const c of candidates) {
      const p = parsePrice(c);
      if (p !== null && (price === null || p < price)) price = p;
    }
    if (typeof offer.priceCurrency === 'string') currency = offer.priceCurrency;
    if (typeof offer.availability === 'string' && /outofstock|soldout|discontinued/i.test(offer.availability)) available = false;
  }
  const image = asArray(product.image as string | Json | (string | Json)[])[0];
  const imageUrl = typeof image === 'string' ? image : typeof image?.url === 'string' ? (image.url as string) : undefined;
  return {
    title: typeof product.name === 'string' ? decodeEntities(product.name) : undefined,
    price: price ?? undefined,
    currency,
    imageUrl,
    available,
  };
}

function fromMeta(html: string): Partial<ProductSnapshot> {
  const price =
    parsePrice(metaContent(html, 'product:price:amount')) ??
    parsePrice(metaContent(html, 'og:price:amount')) ??
    parsePrice(metaContent(html, 'price')) ??
    parsePrice(html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1]) ??
    undefined;
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: metaContent(html, 'og:title') || (titleTag ? decodeEntities(titleTag).trim() : undefined),
    price,
    currency: metaContent(html, 'product:price:currency') || metaContent(html, 'og:price:currency') || 'BRL',
    imageUrl: metaContent(html, 'og:image'),
  };
}

/** Amazon não publica JSON-LD de produto: o preço à vista fica no bloco "corePrice". */
function fromAmazon(html: string): Partial<ProductSnapshot> {
  const core = html.match(/id=["']corePrice[\s\S]{0,4000}?class=["']a-offscreen["']>\s*([^<]+)</i)?.[1];
  const any = html.match(/class=["']a-price[^"']*["'][^>]*>\s*<span class=["']a-offscreen["']>\s*([^<]+)</i)?.[1];
  const title = html.match(/id=["']productTitle["'][^>]*>\s*([^<]+)</i)?.[1];
  return {
    price: parsePrice(core ? decodeEntities(core) : any ? decodeEntities(any) : undefined) ?? undefined,
    title: title ? decodeEntities(title).trim() : undefined,
  };
}

const storeName = (html: string, url: URL) => {
  const site = metaContent(html, 'og:site_name');
  if (site) return site;
  const host = url.hostname.replace(/^www\./, '').replace(/^(produto|lista|m)\./, '');
  return host.split('.')[0].replace(/^./, (c) => c.toUpperCase());
};

export function extractProduct(html: string, pageUrl: string): PriceCheckResult {
  const url = new URL(pageUrl);
  const ld = fromJsonLd(html) || {};
  const meta = fromMeta(html);
  const amazon = /amazon\./i.test(url.hostname) ? fromAmazon(html) : {};
  const price = ld.price ?? amazon.price ?? meta.price;
  const title = (amazon.title || ld.title || meta.title || '').replace(/\s+/g, ' ').trim();
  if (!price) {
    return {
      ok: false,
      error: 'Não encontrei o preço nesta página. Confira se o link é da página do produto (não de uma busca) ou tente o link de outra loja.',
    };
  }
  let imageUrl = ld.imageUrl || meta.imageUrl;
  if (imageUrl && imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;
  return {
    ok: true,
    product: {
      url: pageUrl,
      title: title || 'Produto',
      price,
      currency: ld.currency || meta.currency || 'BRL',
      store: storeName(html, url),
      imageUrl,
      available: ld.available ?? true,
    },
  };
}

/** Endereços internos/privados não podem ser consultados (evita usar o servidor para acessar a rede interna). */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\[?[0-9a-f:]+\]?$/i.test(h) && h.includes(':')) return true; // IPv6 literal
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  return false;
}

export function validateProductUrl(raw: string): URL | string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return 'Link inválido. Cole o endereço completo da página do produto (começando com https://).';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Use um link que comece com https://.';
  if (isBlockedHost(url.hostname)) return 'Esse endereço não pode ser consultado.';
  return url;
}

/** Busca a página e lê o produto. Usado pela função /api/price-check. */
export async function fetchProduct(rawUrl: string): Promise<PriceCheckResult> {
  const checked = validateProductUrl(rawUrl);
  if (typeof checked === 'string') return { ok: false, error: checked };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(checked.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    const finalUrl = new URL(res.url || checked.toString());
    if (isBlockedHost(finalUrl.hostname)) return { ok: false, error: 'Esse endereço não pode ser consultado.' };
    // Lojas com proteção contra robôs respondem 403/429 ou erro 5xx em vez da página
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      return { ok: false, error: `A loja ${finalUrl.hostname.replace(/^www\./, '')} bloqueou a consulta automática. Tente o link do mesmo produto em outra loja.` };
    }
    if (!res.ok) return { ok: false, error: `A página respondeu com erro (${res.status}). Confira se o link ainda funciona.` };
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) return { ok: false, error: 'O link não é de uma página de produto.' };
    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    if (/captcha|robot check|are you a human/i.test(html) && !/application\/ld\+json/i.test(html)) {
      return { ok: false, error: 'A loja pediu verificação de "não sou um robô". Tente de novo mais tarde ou use o link de outra loja.' };
    }
    return extractProduct(html, finalUrl.toString());
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: false, error: aborted ? 'A loja demorou demais para responder. Tente de novo.' : 'Não consegui acessar a página da loja.' };
  } finally {
    clearTimeout(timer);
  }
}
