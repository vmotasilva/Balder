import React, { useMemo, useRef, useState } from 'react';
import {
  BellRing,
  ExternalLink,
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
  OPPORTUNITY_LABEL,
  storeSearchLinks,
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
  | { step: 'MANUAL'; url: string; error: string; title: string; price: number | null; target: number | null };

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ onRegisterPurchase }) => {
  const { watches, loaded, checkingIds, storage, add, addManual, update, remove, check, checkAll, setManualPrice } =
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

  /** Escolheu um resultado da busca: segue para o preço-alvo, como se tivesse colado o link. */
  const pickResult = (r: SearchResult) =>
    setDraft({
      step: 'FOUND',
      product: { url: r.url, title: r.title, price: r.price, currency: 'BRL', store: r.store, imageUrl: r.imageUrl, available: true },
      target: null,
    });

  const startWatching = async () => {
    if (draft.step === 'FOUND') {
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
            onPick={pickResult}
            onClose={resetDraft}
          />
        )}

        {draft.step === 'LOADING' && <p className="opp-draft-hint">Lendo o preço na loja…</p>}

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
  onPick: (r: SearchResult) => void;
  onClose: () => void;
}

const SORT_LABEL: Record<SortKey, string> = {
  RELEVANCE: 'Mais relevantes',
  PRICE_ASC: 'Menor preço',
  PRICE_DESC: 'Maior preço',
};

const SearchResults: React.FC<SearchResultsProps> = ({ query, results, failedSources, error, onPick, onClose }) => {
  const [sort, setSort] = useState<SortKey>('RELEVANCE');
  const [store, setStore] = useState<string | null>(null);

  const stores = useMemo(() => {
    const count = new Map<string, number>();
    results.forEach((r) => count.set(r.store, (count.get(r.store) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);

  const shown = useMemo(() => {
    const list = store ? results.filter((r) => r.store === store) : results;
    if (sort === 'PRICE_ASC') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'PRICE_DESC') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [results, store, sort]);

  return (
    <div className="opp-draft">
      <div className="opp-results-head">
        <p className="opp-draft-hint">
          {error
            ? error
            : results.length
              ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para "${query}". Escolha o que quer acompanhar:`
              : `Não achei "${query}" nas lojas consultadas. Tente outras palavras (marca e modelo ajudam) ou cole o link do produto.`}
        </p>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar resultados">
          <X size={16} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="opp-results-tools">
          <div className="opp-store-links" role="group" aria-label="Filtrar por loja">
            <button type="button" className={`opp-store-chip ${store === null ? 'is-active' : ''}`} onClick={() => setStore(null)}>
              Todas
            </button>
            {stores.slice(0, 6).map(([name, n]) => (
              <button
                key={name}
                type="button"
                className={`opp-store-chip ${store === name ? 'is-active' : ''}`}
                onClick={() => setStore(store === name ? null : name)}
              >
                {name} · {n}
              </button>
            ))}
          </div>
          <select className="form-input opp-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar resultados">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      )}

      {shown.length > 0 && (
        <div className="opp-results">
          {shown.map((r) => (
            <button key={r.url} type="button" className="opp-result" onClick={() => onPick(r)}>
              {r.imageUrl ? <img src={r.imageUrl} alt="" className="opp-thumb" loading="lazy" /> : <div className="opp-thumb opp-thumb-empty"><Tag size={18} /></div>}
              <span className="opp-result-info">
                <span className="opp-title">{r.title}</span>
                <span className="opp-meta">
                  {r.store}
                  {r.source !== r.store ? ` · via ${r.source}` : ''}
                </span>
              </span>
              <span className="opp-result-price">
                <span className="opp-price">{brl(r.price)}</span>
                {r.installment && <span className="opp-meta">{r.installment}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {failedSources.length > 0 && (
        <p className="opp-storage-note">Não consegui consultar: {failedSources.join(', ')}. Os resultados podem estar incompletos.</p>
      )}

      <div className="opp-search-elsewhere">
        <span className="opp-draft-hint">Não é o que procura? Veja em outras lojas e cole o link aqui:</span>
        <div className="opp-store-links">
          {storeSearchLinks(query).map((s) => (
            <a key={s.store} href={s.url} target="_blank" rel="noopener noreferrer" className="opp-store-chip">
              {s.store} <ExternalLink size={12} />
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
}

const WatchCard: React.FC<WatchCardProps> = ({ w, s, checking, editing, onEdit, onEditValue, onSaveEdit, onCancelEdit, onCheck, onBuy, onRemove }) => {
  const change = s.changeFromFirstPct;
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
