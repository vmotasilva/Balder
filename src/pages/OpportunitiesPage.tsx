import React, { useMemo, useState } from 'react';
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

type Draft =
  | { step: 'IDLE' }
  | { step: 'SEARCH'; query: string }
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

  const lookup = async () => {
    const text = input.trim();
    if (!text) return;
    if (!isUrl(text)) {
      setDraft({ step: 'SEARCH', query: text });
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
    setDraft({ step: 'IDLE' });
    setInput('');
  };

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
                Cole o link de um produto que você quer comprar. O Balder lê o preço na loja, guarda o histórico e confere
                de novo sempre que você abre o app (se a última leitura tiver mais de 12 horas).
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
              if (draft.step === 'SEARCH') setDraft({ step: 'IDLE' });
            }}
            placeholder="Cole o link do produto ou digite o nome"
            aria-label="Link ou nome do produto"
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || draft.step === 'LOADING'}>
            {draft.step === 'LOADING' ? <Loader2 size={16} className="opp-spin" /> : <span>Buscar</span>}
          </button>
        </form>

        {draft.step === 'SEARCH' && (
          <div className="opp-draft">
            <p className="opp-draft-hint">Abra o produto em uma loja, copie o link da página e cole aqui:</p>
            <div className="opp-store-links">
              {storeSearchLinks(draft.query).map((s) => (
                <a key={s.store} href={s.url} target="_blank" rel="noopener noreferrer" className="opp-store-chip">
                  {s.store} <ExternalLink size={12} />
                </a>
              ))}
            </div>
          </div>
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
          <p>Cole acima o link de algo que você quer comprar. Quando o preço cair, o Balder te avisa.</p>
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
