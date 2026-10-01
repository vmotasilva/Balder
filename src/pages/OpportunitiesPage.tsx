import React, { useMemo, useRef, useState } from 'react';
import {
  BellRing,
  ChevronDown,
  ExternalLink,
  SlidersHorizontal,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { InfoButton } from '../components/InfoButton';
import { DecimalInput } from '../components/DecimalInput';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { useOpportunities } from '../hooks/useOpportunities';
import { OpportunityService } from '../services/opportunityService';
import type { ProductSnapshot } from '../services/priceExtraction';
import type { SearchResult } from '../services/productSearch';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  groupResults,
  suggestOffers,
  type OfferFilters,
  type ProductGroup,
} from '../utils/offerSearch';
import {
  HEALTH_LABEL,
  OPPORTUNITY_LABEL,
  bestOffer,
  storeSearchLinks,
  watchOffers,
  watchStats,
  type PriceWatch,
  type WatchStats,
} from '../utils/opportunity';
import type { Movement, MovementType } from '../types';
import './OpportunitiesPage.css';

interface OpportunitiesPageProps {
  onRegisterPurchase: (type: MovementType, initialData?: Partial<Movement>) => void;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isUrl = (text: string) => /^https?:\/\/\S+\.\S+/i.test(text.trim());

const sinceLabel = (iso?: string | null) => {
  if (!iso) return 'ainda não conferido';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'conferido agora';
  if (min < 60) return `conferido há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `conferido há ${h} h`;
  const d = Math.round(h / 24);
  return `conferido há ${d} ${d === 1 ? 'dia' : 'dias'}`;
};

/** Mini gráfico do histórico de preços (mais baixo = mais barato). */
const Sparkline: React.FC<{ prices: number[]; good: boolean }> = ({ prices, good }) => {
  if (prices.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - 3 - ((p - min) / span) * (h - 6)}`).join(' ');
  return (
    <svg className={`opp-spark ${good ? 'is-good' : ''}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

type SortKey = 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC';

type Draft =
  | { step: 'IDLE' }
  | { step: 'SEARCHING'; query: string }
  | { step: 'RESULTS'; query: string; results: SearchResult[]; failedSources: string[]; error?: string }
  | { step: 'LOADING'; url: string }
  | { step: 'FOUND'; product: ProductSnapshot; target: number | null }
  | { step: 'GROUP'; title: string; imageUrl?: string; picks: SearchResult[]; target: number | null }
  | { step: 'MANUAL'; url: string; error: string; title: string; price: number | null; target: number | null };

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ onRegisterPurchase }) => {
  const { watches, loaded, checkingIds, storage, add, addGroup, addOffer, removeOffer, addManual, update, remove, check, checkAll, setManualPrice } =
    useOpportunities();
  const { confirm, dialogProps } = useConfirmDialog();
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft>({ step: 'IDLE' });
  const [editing, setEditing] = useState<{ id: string; field: 'TARGET' | 'PRICE'; value: number | null } | null>(null);

  const rows = useMemo(() => {
    const list = watches.map((w) => ({ w, s: watchStats(w) }));
    // Oportunidades primeiro; depois as maiores quedas
    return list.sort(
      (a, b) => Number(!!b.s.opportunity) - Number(!!a.s.opportunity) || a.s.changeFromFirstPct - b.s.changeFromFirstPct
    );
  }, [watches]);
  const opportunities = rows.filter((r) => r.s.opportunity).length;
  const checkingAll = checkingIds.length > 0;

  const searchSeq = useRef(0);

  const lookup = async () => {
    const text = input.trim();
    if (!text) return;
    const seq = ++searchSeq.current;
    if (!isUrl(text)) {
      setDraft({ step: 'SEARCHING', query: text });
      const found = await OpportunityService.search(text);
      if (seq !== searchSeq.current) return; // a pessoa mudou a busca enquanto esta carregava
      setDraft(
        found.ok
          ? { step: 'RESULTS', query: text, results: found.results, failedSources: found.failedSources }
          : { step: 'RESULTS', query: text, results: [], failedSources: [], error: found.error }
      );
      return;
    }
    setDraft({ step: 'LOADING', url: text });
    const result = await OpportunityService.check(text);
    if (result.ok) {
      setDraft({ step: 'FOUND', product: result.product, target: null });
    } else {
      setDraft({ step: 'MANUAL', url: text, error: result.error, title: '', price: null, target: null });
    }
  };

  const resetDraft = () => {
    searchSeq.current++;
    setDraft({ step: 'IDLE' });
    setInput('');
  };

  /** Escolheu as lojas de um produto: segue para o preço-alvo. */
  const trackGroup = (group: ProductGroup, picks: SearchResult[]) =>
    setDraft({ step: 'GROUP', title: group.title, imageUrl: group.imageUrl, picks, target: null });

  const startWatching = async () => {
    if (draft.step === 'GROUP') {
      await addGroup(
        draft.title,
        draft.imageUrl,
        draft.picks.map((r) => ({
          url: r.url,
          store: r.store,
          title: r.title,
          imageUrl: r.imageUrl,
          price: r.price,
          condition: r.condition,
          origin: r.origin,
          installments: r.installments,
          noInterest: r.noInterest,
        })),
        draft.target && draft.target > 0 ? draft.target : null
      );
      resetDraft();
    } else if (draft.step === 'FOUND') {
      await add(draft.product, draft.target && draft.target > 0 ? draft.target : null);
      resetDraft();
    } else if (draft.step === 'MANUAL' && draft.title.trim() && draft.price && draft.price > 0) {
      await addManual(draft.url, draft.title.trim(), draft.price, draft.target && draft.target > 0 ? draft.target : null);
      resetDraft();
    }
  };

  const saveEdit = async (w: PriceWatch) => {
    if (!editing) return;
    if (editing.field === 'TARGET') await update({ ...w, targetPrice: editing.value && editing.value > 0 ? editing.value : null });
    else if (editing.value && editing.value > 0) await setManualPrice(w.id, editing.value);
    setEditing(null);
  };

  const registerPurchase = (w: PriceWatch) =>
    onRegisterPurchase('PAGAR', {
      title: w.title.length > 80 ? `${w.title.slice(0, 77)}…` : w.title,
      amount: w.currentPrice ?? undefined,
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'REALIZADA',
      notes: `Compra em ${w.store || 'loja online'} (acompanhada em Oportunidades): ${w.url}`,
    });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>COMPRAS INTELIGENTES</span>
          </div>
          <h1 className="page-title label-with-info">
            Oportunidades
            <InfoButton title="Como funcionam as Oportunidades">
              <p>
                Busque o produto pelo nome (ou cole o link da loja). O Balder procura em lojas e comparadores, mostra os
                preços encontrados e, ao escolher um, guarda o histórico e confere de novo sempre que você abre o app
                (se a última leitura tiver mais de 12 horas).
              </p>
              <p>
                <strong>Quando vira oportunidade:</strong> o preço chegou ao seu preço-alvo, ficou abaixo de todos os
                preços já vistos ou caiu 7% ou mais em relação à média. Você recebe o aviso no sino.
              </p>
              <p>
                Algumas lojas (como Mercado Livre, Amazon e Magalu) bloqueiam a leitura automática. Nesses casos você pode
                acompanhar informando o preço quando vir, e o Balder faz as contas do mesmo jeito.
              </p>
            </InfoButton>
          </h1>
        </div>
      </div>

      {/* Adicionar produto: link (lê na loja) ou nome (atalhos de busca nas lojas) */}
      <section className="opp-add glass-card">
        <form
          className="opp-add-row"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <Search size={16} className="opp-add-icon" aria-hidden="true" />
          <input
            className="form-input opp-add-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (draft.step === 'RESULTS') {
                searchSeq.current++;
                setDraft({ step: 'IDLE' });
              }
            }}
            placeholder="Busque pelo nome do produto ou cole o link"
            aria-label="Link ou nome do produto"
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || draft.step === 'LOADING' || draft.step === 'SEARCHING'}>
            {draft.step === 'LOADING' || draft.step === 'SEARCHING' ? <Loader2 size={16} className="opp-spin" /> : <span>Buscar</span>}
          </button>
        </form>

        {draft.step === 'SEARCHING' && <p className="opp-draft-hint">Buscando "{draft.query}" nas lojas…</p>}

        {draft.step === 'RESULTS' && (
          <SearchResults
            query={draft.query}
            results={draft.results}
            failedSources={draft.failedSources}
            error={draft.error}
            onTrack={trackGroup}
            onClose={resetDraft}
          />
        )}

        {draft.step === 'LOADING' && <p className="opp-draft-hint">Lendo o preço na loja…</p>}

        {draft.step === 'GROUP' && (
          <div className="opp-draft opp-found">
            <div className="opp-found-product">
              {draft.imageUrl && <img src={draft.imageUrl} alt="" className="opp-thumb" />}
              <div className="opp-found-info">
                <strong className="opp-title">{draft.title}</strong>
                <span className="opp-meta">
                  {draft.picks.length} {draft.picks.length === 1 ? 'loja' : 'lojas'}: o aviso vale para qualquer uma delas
                </span>
              </div>
            </div>
            <ul className="opp-pick-list">
              {draft.picks.map((r) => (
                <li key={r.url}>
                  <span>{r.store}</span>
                  <strong>{brl(r.price)}</strong>
                </li>
              ))}
            </ul>
            <label className="opp-field">
              <span>Me avise quando alguma chegar a (opcional)</span>
              <DecimalInput
                className="form-input"
                value={draft.target}
                onValueChange={(v) => setDraft({ ...draft, target: v })}
                emptyWhenZero
                placeholder={`Ex.: ${brl(Math.round(Math.min(...draft.picks.map((r) => r.price)) * 0.9))}`}
              />
            </label>
            <div className="opp-draft-actions">
              <button type="button" className="btn btn-outline" onClick={resetDraft}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void startWatching()}>
                <BellRing size={16} />
                <span>Acompanhar nas {draft.picks.length} {draft.picks.length === 1 ? 'loja' : 'lojas'}</span>
              </button>
            </div>
          </div>
        )}

        {draft.step === 'FOUND' && (
          <div className="opp-draft opp-found">
            <div className="opp-found-product">
              {draft.product.imageUrl && <img src={draft.product.imageUrl} alt="" className="opp-thumb" />}
              <div className="opp-found-info">
                <strong className="opp-title">{draft.product.title}</strong>
                <span className="opp-meta">{draft.product.store}</span>
                <span className="opp-price">{brl(draft.product.price)}</span>
                {!draft.product.available && <span className="opp-warning">Indisponível no momento</span>}
              </div>
            </div>
            <label className="opp-field">
              <span>Me avise quando chegar a (opcional)</span>
              <DecimalInput
                className="form-input"
                value={draft.target}
                onValueChange={(v) => setDraft({ ...draft, target: v })}
                emptyWhenZero
                placeholder={`Ex.: ${brl(Math.round(draft.product.price * 0.9))}`}
              />
            </label>
            <div className="opp-draft-actions">
              <button type="button" className="btn btn-outline" onClick={resetDraft}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void startWatching()}>
                <BellRing size={16} />
                <span>Acompanhar preço</span>
              </button>
            </div>
          </div>
        )}

        {draft.step === 'MANUAL' && (
          <div className="opp-draft">
            <p className="opp-warning">{draft.error}</p>
            <p className="opp-draft-hint">Você ainda pode acompanhar este produto informando o preço que está vendo:</p>
            <label className="opp-field">
              <span>Nome do produto</span>
              <input
                className="form-input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ex.: Air fryer Mondial 4L"
              />
            </label>
            <div className="opp-field-row">
              <label className="opp-field">
                <span>Preço atual</span>
                <DecimalInput className="form-input" value={draft.price} onValueChange={(v) => setDraft({ ...draft, price: v })} emptyWhenZero />
              </label>
              <label className="opp-field">
                <span>Preço-alvo (opcional)</span>
                <DecimalInput className="form-input" value={draft.target} onValueChange={(v) => setDraft({ ...draft, target: v })} emptyWhenZero />
              </label>
            </div>
            <div className="opp-draft-actions">
              <button type="button" className="btn btn-outline" onClick={resetDraft}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!draft.title.trim() || !draft.price}
                onClick={() => void startWatching()}
              >
                <BellRing size={16} />
                <span>Acompanhar</span>
              </button>
            </div>
          </div>
        )}

        {storage === 'LOCAL' && watches.length > 0 && (
          <p className="opp-storage-note">A lista está salva só neste aparelho por enquanto.</p>
        )}
      </section>

      {!loaded ? (
        <p className="opp-empty">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="opp-empty glass-card">
          <Tag size={28} className="text-cyan" />
          <h4>Nenhum produto acompanhado</h4>
          <p>Busque acima o nome de algo que você quer comprar (ou cole o link). Quando o preço cair, o Balder te avisa.</p>
        </div>
      ) : (
        <section className="opp-watchlist">
          <div className="opp-summary">
            <span>
              {rows.length} {rows.length === 1 ? 'produto' : 'produtos'}
            </span>
            {opportunities > 0 && (
              <span className="opp-summary-hot">
                <TrendingDown size={14} /> {opportunities} {opportunities === 1 ? 'oportunidade' : 'oportunidades'}
              </span>
            )}
            <button type="button" className="opp-check-all" onClick={() => checkAll()} disabled={checkingAll}>
              <RefreshCw size={14} className={checkingAll ? 'opp-spin' : ''} />
              <span>{checkingAll ? 'Conferindo…' : 'Conferir todos'}</span>
            </button>
          </div>

          <div className="opp-list">
            {rows.map(({ w, s }) => (
              <WatchCard
                key={w.id}
                w={w}
                s={s}
                checking={checkingIds.includes(w.id)}
                editing={editing?.id === w.id ? editing : null}
                onEdit={(field) =>
                  setEditing({ id: w.id, field, value: field === 'TARGET' ? w.targetPrice ?? null : w.currentPrice ?? null })
                }
                onEditValue={(value) => editing && setEditing({ ...editing, value })}
                onSaveEdit={() => void saveEdit(w)}
                onCancelEdit={() => setEditing(null)}
                onCheck={() => void check(w.id)}
                onBuy={() => registerPurchase(w)}
                onAddOffer={(url) => addOffer(w.id, url)}
                onRemoveOffer={(offerId) => void removeOffer(w.id, offerId)}
                onRemove={() =>
                  confirm({
                    title: 'Parar de acompanhar?',
                    message: `"${w.title}" sai da lista e o histórico de preços é apagado.`,
                    confirmLabel: 'Parar de acompanhar',
                    onConfirm: () => void remove(w.id),
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  failedSources: string[];
  error?: string;
  onTrack: (group: ProductGroup, picks: SearchResult[]) => void;
  onClose: () => void;
}

const SORT_LABEL: Record<SortKey, string> = {
  RELEVANCE: 'Mais relevantes',
  PRICE_ASC: 'Menor preço',
  PRICE_DESC: 'Maior preço',
};

const CONDITION_LABEL = { NOVO: 'Novo', USADO: 'Usado', RECONDICIONADO: 'Recondicionado' } as const;
const ORIGIN_LABEL = { NACIONAL: 'Nacional', IMPORTADO: 'Importado' } as const;

const OfferTags: React.FC<{ r: SearchResult }> = ({ r }) => (
  <span className="opp-tags">
    {r.condition && <span className={`opp-tag ${r.condition !== 'NOVO' ? 'is-warn' : ''}`}>{CONDITION_LABEL[r.condition]}</span>}
    {r.origin && <span className={`opp-tag ${r.origin === 'IMPORTADO' ? 'is-warn' : ''}`}>{ORIGIN_LABEL[r.origin]}</span>}
    {r.installments && r.installments > 1 && (
      <span className="opp-tag">
        até {r.installments}x{r.noInterest ? ' sem juros' : ''}
      </span>
    )}
  </span>
);

const SearchResults: React.FC<SearchResultsProps> = ({ query, results, failedSources, error, onTrack, onClose }) => {
  const [sort, setSort] = useState<SortKey>('RELEVANCE');
  const [filters, setFilters] = useState<OfferFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Lojas marcadas por produto; sem escolha ainda, valem as sugestões
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const allStores = useMemo(() => {
    const count = new Map<string, number>();
    results.forEach((r) => count.set(r.store, (count.get(r.store) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);

  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);
  const groups = useMemo(() => {
    const list = groupResults(filtered);
    if (sort === 'PRICE_ASC') return [...list].sort((a, b) => a.offers[0].price - b.offers[0].price);
    if (sort === 'PRICE_DESC') return [...list].sort((a, b) => b.offers[0].price - a.offers[0].price);
    return list;
  }, [filtered, sort]);

  const set = <K extends keyof OfferFilters>(key: K, value: OfferFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const filterCount = activeFilterCount(filters);

  const selectedUrls = (g: ProductGroup) => picked[g.id] ?? suggestOffers(g).map((x) => x.offer.url);
  const toggleOffer = (g: ProductGroup, url: string) => {
    const cur = selectedUrls(g);
    setPicked({ ...picked, [g.id]: cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url] });
  };

  return (
    <div className="opp-draft">
      <div className="opp-results-head">
        <p className="opp-draft-hint">
          {error
            ? error
            : results.length
              ? `${groups.length} ${groups.length === 1 ? 'produto' : 'produtos'} (${filtered.length} de ${results.length} ofertas) para "${query}". Marque as lojas que quer acompanhar:`
              : `Não achei "${query}" nas lojas consultadas. Tente outras palavras (marca e modelo ajudam) ou cole o link do produto.`}
        </p>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar resultados">
          <X size={16} />
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div className="opp-results-tools">
            <button type="button" className={`opp-store-chip ${showFilters || filterCount > 0 ? 'is-active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={13} /> Filtros{filterCount > 0 ? ` · ${filterCount}` : ''}
            </button>
            {filterCount > 0 && (
              <button type="button" className="link-button" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpar filtros
              </button>
            )}
            <select className="form-input opp-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar resultados">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          {showFilters && (
            <div className="opp-filters">
              <label className="opp-field">
                <span>Condição</span>
                <select className="form-input" value={filters.condition} onChange={(e) => set('condition', e.target.value as OfferFilters['condition'])}>
                  <option value="ANY">Qualquer</option>
                  <option value="NOVO">Novo</option>
                  <option value="USADO">Usado</option>
                  <option value="RECONDICIONADO">Recondicionado</option>
                </select>
              </label>
              <label className="opp-field">
                <span>Origem</span>
                <select className="form-input" value={filters.origin} onChange={(e) => set('origin', e.target.value as OfferFilters['origin'])}>
                  <option value="ANY">Qualquer</option>
                  <option value="NACIONAL">Nacional</option>
                  <option value="IMPORTADO">Importado</option>
                </select>
              </label>
              <label className="opp-field">
                <span>Parcelas (mínimo)</span>
                <select className="form-input" value={filters.minInstallments} onChange={(e) => set('minInstallments', Number(e.target.value))}>
                  <option value={0}>Qualquer</option>
                  <option value={3}>3x ou mais</option>
                  <option value={6}>6x ou mais</option>
                  <option value={10}>10x ou mais</option>
                  <option value={12}>12x ou mais</option>
                </select>
              </label>
              <label className="opp-field">
                <span>Preço mínimo</span>
                <DecimalInput className="form-input" value={filters.minPrice} onValueChange={(v) => set('minPrice', v > 0 ? v : null)} emptyWhenZero placeholder="R$" />
              </label>
              <label className="opp-field">
                <span>Preço máximo</span>
                <DecimalInput className="form-input" value={filters.maxPrice} onValueChange={(v) => set('maxPrice', v > 0 ? v : null)} emptyWhenZero placeholder="R$" />
              </label>
              <div className="opp-filter-checks">
                <label>
                  <input type="checkbox" checked={filters.noInterestOnly} onChange={(e) => set('noInterestOnly', e.target.checked)} /> Só parcelado sem juros
                </label>
                <label>
                  <input type="checkbox" checked={filters.includeUnknown} onChange={(e) => set('includeUnknown', e.target.checked)} /> Incluir quando a loja não informa
                </label>
              </div>
              <div className="opp-store-links opp-filter-stores" role="group" aria-label="Filtrar por loja">
                {allStores.slice(0, 10).map(([name, n]) => (
                  <button
                    key={name}
                    type="button"
                    className={`opp-store-chip ${filters.stores.includes(name) ? 'is-active' : ''}`}
                    onClick={() => set('stores', filters.stores.includes(name) ? filters.stores.filter((x) => x !== name) : [...filters.stores, name])}
                  >
                    {name} · {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {groups.length > 0 && (
        <div className="opp-groups">
          {groups.map((g) => {
            const sel = selectedUrls(g);
            const suggestions = new Map(suggestOffers(g).map((x) => [x.offer.url, x.reasons]));
            const open = openGroup === g.id || g.offers.length === 1;
            return (
              <article key={g.id} className="opp-group">
                <button type="button" className="opp-group-head" onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)} aria-expanded={open}>
                  {g.imageUrl ? <img src={g.imageUrl} alt="" className="opp-thumb" loading="lazy" /> : <div className="opp-thumb opp-thumb-empty"><Tag size={18} /></div>}
                  <span className="opp-result-info">
                    <span className="opp-title">{g.title}</span>
                    <span className="opp-meta">
                      {g.offers.length} {g.offers.length === 1 ? 'loja' : 'lojas'}: {g.offers.map((o) => o.store).join(', ')}
                    </span>
                  </span>
                  <span className="opp-result-price">
                    <span className="opp-meta">{g.offers.length > 1 ? 'a partir de' : ''}</span>
                    <span className="opp-price">{brl(g.offers[0].price)}</span>
                  </span>
                  {g.offers.length > 1 && <ChevronDown size={16} className={`opp-chevron ${open ? 'is-open' : ''}`} />}
                </button>

                {open && (
                  <div className="opp-group-offers">
                    {g.offers.map((o) => (
                      <label key={o.url} className="opp-group-offer">
                        <input type="checkbox" checked={sel.includes(o.url)} onChange={() => toggleOffer(g, o.url)} />
                        <span className="opp-group-offer-main">
                          <span>
                            <strong>{o.store}</strong>
                            {o.source !== o.store ? <small> · via {o.source}</small> : null}
                          </span>
                          <OfferTags r={o} />
                          {suggestions.has(o.url) && <small className="opp-reason">Sugerida: {suggestions.get(o.url)!.join(' · ')}</small>}
                        </span>
                        <span className="opp-price">{brl(o.price)}</span>
                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Abrir na loja" aria-label={`Abrir ${o.store}`} onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={13} />
                        </a>
                      </label>
                    ))}
                  </div>
                )}

                <div className="opp-group-actions">
                  <button
                    type="button"
                    className="btn btn-primary opp-btn"
                    disabled={sel.length === 0}
                    onClick={() => onTrack(g, g.offers.filter((o) => sel.includes(o.url)))}
                  >
                    <BellRing size={14} />
                    <span>
                      Acompanhar {sel.length} {sel.length === 1 ? 'loja' : 'lojas'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {results.length > 0 && groups.length === 0 && (
        <p className="opp-draft-hint">Nenhuma oferta com esses filtros. Afrouxe um filtro ou aceite resultados em que a loja não informa o dado.</p>
      )}

      {failedSources.length > 0 && (
        <p className="opp-storage-note">Não consegui consultar: {failedSources.join(', ')}. Os resultados podem estar incompletos.</p>
      )}

      <div className="opp-search-elsewhere">
        <span className="opp-draft-hint">Não é o que procura? Veja em outras lojas e cole o link aqui:</span>
        <div className="opp-store-links">
          {storeSearchLinks(query).map((st) => (
            <a key={st.store} href={st.url} target="_blank" rel="noopener noreferrer" className="opp-store-chip">
              {st.store} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

interface WatchCardProps {
  w: PriceWatch;
  s: WatchStats;
  checking: boolean;
  editing: { field: 'TARGET' | 'PRICE'; value: number | null } | null;
  onEdit: (field: 'TARGET' | 'PRICE') => void;
  onEditValue: (value: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onCheck: () => void;
  onBuy: () => void;
  onRemove: () => void;
  onAddOffer: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemoveOffer: (offerId: string) => void;
}

const WatchCard: React.FC<WatchCardProps> = ({ w, s, checking, editing, onEdit, onEditValue, onSaveEdit, onCancelEdit, onCheck, onBuy, onRemove, onAddOffer, onRemoveOffer }) => {
  const change = s.changeFromFirstPct;
  const offers = watchOffers(w);
  const best = bestOffer(w);
  const [newLink, setNewLink] = useState('');
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const submitLink = async () => {
    const url = newLink.trim();
    if (!url) return;
    setAddingLink(true);
    const r = await onAddOffer(url);
    setAddingLink(false);
    if (r.ok) {
      setNewLink('');
      setLinkMsg(null);
    } else setLinkMsg(r.error);
  };
  return (
    <article className={`opp-card glass-card ${s.opportunity ? 'is-opportunity' : ''}`}>
      {s.opportunity && (
        <div className="opp-badge">
          <TrendingDown size={13} />
          <strong>{OPPORTUNITY_LABEL[s.opportunity]}</strong>
          <span>{s.reason}</span>
        </div>
      )}

      <div className="opp-card-main">
        {w.imageUrl ? <img src={w.imageUrl} alt="" className="opp-thumb" loading="lazy" /> : <div className="opp-thumb opp-thumb-empty"><Tag size={18} /></div>}
        <div className="opp-card-info">
          <a href={w.url} target="_blank" rel="noopener noreferrer" className="opp-title" title={w.title}>
            {w.title}
          </a>
          <span className="opp-meta">
            {w.store || 'Loja'} · {checking ? 'conferindo…' : sinceLabel(w.lastCheckedAt)}
            {w.history[w.history.length - 1]?.source === 'MANUAL' ? ' · preço informado' : ''}
          </span>
        </div>
        <div className="opp-card-price">
          <span className="opp-price">{w.currentPrice != null ? brl(w.currentPrice) : '—'}</span>
          {change !== 0 && (
            <span className={`opp-change ${change < 0 ? 'is-down' : 'is-up'}`} title="Desde que você começou a acompanhar">
              {change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {Math.abs(change).toLocaleString('pt-BR')}%
            </span>
          )}
          <Sparkline prices={w.history.map((h) => h.price)} good={change < 0} />
        </div>
      </div>

      <div className="opp-card-stats">
        <span>
          Menor: <strong>{s.lowest != null ? brl(s.lowest) : '—'}</strong>
        </span>
        <span>
          Maior: <strong>{s.highest != null ? brl(s.highest) : '—'}</strong>
        </span>
        <span>
          Alvo: <strong>{w.targetPrice ? brl(w.targetPrice) : '—'}</strong>
        </span>
      </div>

      <div className="opp-offers">
        <span className="opp-offers-title">{offers.length === 1 ? 'Loja' : `${offers.length} lojas acompanhadas`}</span>
        {offers.map((o) => (
          <div key={o.id} className={`opp-offer ${best?.id === o.id ? 'is-best' : ''} ${o.health !== 'OK' ? 'is-broken' : ''}`}>
            <a href={o.url} target="_blank" rel="noopener noreferrer" className="opp-offer-store" title={o.title || w.title}>
              {o.store}
              <ExternalLink size={11} />
            </a>
            {o.health !== 'OK' ? (
              <span className="opp-offer-health" title={o.lastError || undefined}>
                {HEALTH_LABEL[o.health]}
              </span>
            ) : (
              <span className="opp-offer-price">{o.price != null ? brl(o.price) : '—'}</span>
            )}
            {best?.id === o.id && offers.length > 1 && <span className="opp-offer-tag">menor preço</span>}
            {offers.length > 1 && (
              <button type="button" className="icon-btn" onClick={() => onRemoveOffer(o.id)} title="Parar de acompanhar esta loja" aria-label={`Parar de acompanhar ${o.store}`}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <form
          className="opp-offer-add"
          onSubmit={(e) => {
            e.preventDefault();
            void submitLink();
          }}
        >
          <input
            className="form-input"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Acompanhar em outra loja: cole o link"
            aria-label="Link de outra loja"
          />
          <button type="submit" className="btn btn-outline opp-btn" disabled={!newLink.trim() || addingLink}>
            {addingLink ? <Loader2 size={14} className="opp-spin" /> : <span>Adicionar</span>}
          </button>
        </form>
        {linkMsg && <p className="opp-warning">{linkMsg}</p>}
      </div>

      {!w.available && <p className="opp-warning">A loja indica que o produto está indisponível.</p>}
      {w.lastError && (
        <p className="opp-warning">
          {w.lastError}{' '}
          <button type="button" className="link-button" onClick={() => onEdit('PRICE')}>
            Informar o preço
          </button>
        </p>
      )}

      {editing && (
        <div className="opp-edit">
          <span>{editing.field === 'TARGET' ? 'Preço-alvo' : 'Preço que você está vendo'}</span>
          <DecimalInput className="form-input" value={editing.value} onValueChange={onEditValue} emptyWhenZero autoFocus />
          <button type="button" className="btn btn-primary opp-btn" onClick={onSaveEdit}>
            Salvar
          </button>
          <button type="button" className="icon-btn" onClick={onCancelEdit} aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="opp-actions">
        <a href={w.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary opp-btn">
          <ExternalLink size={14} />
          <span>Ir para a loja</span>
        </a>
        <button type="button" className="btn btn-outline opp-btn" onClick={onBuy} title="Lançar a compra nas suas movimentações">
          <ShoppingCart size={14} />
          <span>Registrar compra</span>
        </button>
        <div className="opp-icon-actions">
          <button type="button" className="icon-btn" onClick={onCheck} disabled={checking} title="Conferir o preço agora" aria-label="Conferir o preço agora">
            <RefreshCw size={15} className={checking ? 'opp-spin' : ''} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onEdit('PRICE')} title="Informar o preço" aria-label="Informar o preço">
            <Pencil size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onEdit('TARGET')} title="Definir preço-alvo" aria-label="Definir preço-alvo">
            <Target size={15} />
          </button>
          <button type="button" className="icon-btn opp-remove" onClick={onRemove} title="Parar de acompanhar" aria-label="Parar de acompanhar">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
};
