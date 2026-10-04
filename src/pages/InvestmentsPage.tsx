import React, { useMemo, useState } from 'react';
import { PlusCircle, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { DecimalInput } from '../components/DecimalInput';
import { Modal } from '../components/Modal';
import { InfoButton } from '../components/InfoButton';
import { INVESTMENT_TYPES, useInvestments } from '../hooks/useInvestments';
import type { Investment, InvestmentType } from '../types';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const today = () => new Date().toISOString().slice(0, 10);

const emptyDraft = (): Investment => ({
  id: '',
  name: '',
  type: 'RENDA_FIXA',
  invested: 0,
  currentValue: 0,
  date: today(),
  note: '',
});

/** Carteira de investimentos: posições, rentabilidade e distribuição por tipo. */
export const InvestmentsPage: React.FC = () => {
  const { investments, saveInvestment, removeInvestment } = useInvestments();
  const [draft, setDraft] = useState<Investment | null>(null);

  const totals = useMemo(() => {
    const invested = investments.reduce((s, i) => s + i.invested, 0);
    const current = investments.reduce((s, i) => s + i.currentValue, 0);
    const byType = new Map<InvestmentType, number>();
    investments.forEach((i) => byType.set(i.type, (byType.get(i.type) ?? 0) + i.currentValue));
    return {
      invested,
      current,
      gain: current - invested,
      pct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      allocation: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [investments]);

  const canSave = !!draft && draft.name.trim().length > 0 && draft.invested > 0;

  const submit = () => {
    if (!draft || !canSave) return;
    saveInvestment({
      ...draft,
      id: draft.id || `inv_${Date.now()}`,
      name: draft.name.trim(),
      currentValue: draft.currentValue > 0 ? draft.currentValue : draft.invested,
    });
    setDraft(null);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <TrendingUp size={14} className="text-cyan" />
            <span>PATRIMÔNIO</span>
          </div>
          <h1 className="page-title label-with-info">
            Investimentos
            <InfoButton title="Investimentos">
              <p>Registre suas aplicações com o valor investido e o valor atual para acompanhar a rentabilidade e a distribuição da carteira. Os dados ficam salvos na sua conta e sincronizam entre aparelhos.</p>
            </InfoButton>
          </h1>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(emptyDraft())}>
          <PlusCircle size={14} />
          <span>Novo</span>
        </button>
      </div>

      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div className="summary-metrics-list">
          <div className="summary-metric-row highlight">
            <span className="metric-label">Patrimônio atual:</span>
            <strong className="metric-value text-cyan text-lg">{formatBRL(totals.current)}</strong>
          </div>
          <div className="summary-metric-row">
            <span className="metric-label">Total investido:</span>
            <span className="metric-value">{formatBRL(totals.invested)}</span>
          </div>
          <div className="summary-metric-row">
            <span className="metric-label">Resultado:</span>
            <span className={`metric-value font-semibold ${totals.gain >= 0 ? 'text-emerald' : 'text-rose'}`}>
              {formatBRL(totals.gain)} ({formatPct(totals.pct)})
            </span>
          </div>
        </div>

        {totals.allocation.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
              {totals.allocation.map(([type, value]) => (
                <div
                  key={type}
                  title={`${INVESTMENT_TYPES[type].label}: ${formatBRL(value)}`}
                  style={{ width: `${(value / totals.current) * 100}%`, background: INVESTMENT_TYPES[type].color }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }} className="text-xs text-secondary">
              {totals.allocation.map(([type, value]) => (
                <span key={type}>
                  <span style={{ color: INVESTMENT_TYPES[type].color }}>●</span> {INVESTMENT_TYPES[type].label}{' '}
                  {((value / totals.current) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {investments.length === 0 ? (
        <div className="glass-card text-secondary" style={{ textAlign: 'center' }}>
          Nenhum investimento cadastrado. Toque em “Novo” para registrar o primeiro.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {investments.map((inv) => {
            const gain = inv.currentValue - inv.invested;
            const pct = inv.invested > 0 ? (gain / inv.invested) * 100 : 0;
            return (
              <div key={inv.id} className="glass-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <strong>{inv.name}</strong>
                    <div className="text-xs text-secondary">
                      <span style={{ color: INVESTMENT_TYPES[inv.type].color }}>●</span> {INVESTMENT_TYPES[inv.type].label} ·{' '}
                      {inv.date.split('-').reverse().join('/')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Editar" onClick={() => setDraft(inv)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label="Excluir"
                      onClick={() => window.confirm(`Excluir "${inv.name}"?`) && removeInvestment(inv.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span className="text-xs text-secondary">Investido {formatBRL(inv.invested)}</span>
                  <span>
                    <strong>{formatBRL(inv.currentValue)}</strong>{' '}
                    <span className={`text-xs ${gain >= 0 ? 'text-emerald' : 'text-rose'}`}>{formatPct(pct)}</span>
                  </span>
                </div>
                {inv.note && <div className="text-xs text-secondary" style={{ marginTop: 6 }}>{inv.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar investimento' : 'Novo investimento'}
      >
        {draft && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              <span className="text-xs text-secondary">Nome</span>
              <input
                className="form-input form-input-sm"
                placeholder="Ex.: CDB 110% CDI, PETR4, HGLG11"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              <span className="text-xs text-secondary">Tipo</span>
              <select
                className="form-input form-input-sm"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as InvestmentType })}
              >
                {Object.entries(INVESTMENT_TYPES).map(([id, t]) => (
                  <option key={id} value={id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-secondary">Valor investido (R$)</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={draft.invested}
                emptyWhenZero
                onValueChange={(v) => setDraft({ ...draft, invested: v })}
              />
            </label>
            <label>
              <span className="text-xs text-secondary">Valor atual (R$) — vazio = igual ao investido</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={draft.currentValue}
                emptyWhenZero
                onValueChange={(v) => setDraft({ ...draft, currentValue: v })}
              />
            </label>
            <label>
              <span className="text-xs text-secondary">Data da aplicação</span>
              <input
                type="date"
                className="form-input form-input-sm"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>
              <span className="text-xs text-secondary">Observação</span>
              <input
                className="form-input form-input-sm"
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={!canSave} onClick={submit}>
              Salvar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
