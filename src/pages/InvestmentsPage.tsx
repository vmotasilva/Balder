import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronUp, PlusCircle, Pencil, SkipForward, Trash2, TrendingUp } from 'lucide-react';
import { DecimalInput } from '../components/DecimalInput';
import { Modal } from '../components/Modal';
import { InfoButton } from '../components/InfoButton';
import { INVESTMENT_TYPES, useInvestments } from '../hooks/useInvestments';
import { dueOccurrences, FREQUENCY_LABELS, nextOccurrence } from '../utils/investmentPlans';
import type { Investment, InvestmentFrequency, InvestmentPlan, InvestmentType } from '../types';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 4 };

const emptyPlan = (investmentId: string): InvestmentPlan => ({
  id: '',
  investmentId,
  amount: 0,
  frequency: 'MONTHLY',
  startDate: today(),
  doneDates: [],
});

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
  const {
    investments,
    plans,
    saveInvestment,
    removeInvestment,
    contribute,
    removeContribution,
    savePlan,
    removePlan,
    settleOccurrence,
  } = useInvestments();
  const [draft, setDraft] = useState<Investment | null>(null);
  const [aporte, setAporte] = useState<{ investmentId: string; amount: number; date: string } | null>(null);
  const [planDraft, setPlanDraft] = useState<InvestmentPlan | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const nameOf = (id: string) => investments.find((i) => i.id === id)?.name ?? 'Investimento removido';
  const todayIso = today();
  const dueItems = useMemo(
    () => plans.flatMap((plan) => dueOccurrences(plan, todayIso).map((date) => ({ plan, date }))).sort((a, b) => a.date.localeCompare(b.date)),
    [plans, todayIso]
  );
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const canSavePlan = !!planDraft && !!planDraft.investmentId && planDraft.amount > 0 && !!planDraft.startDate;

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

      {dueItems.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Aportes previstos</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {dueItems.map(({ plan, date }) => (
              <div key={`${plan.id}_${date}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{nameOf(plan.investmentId)}</strong>
                  <div className="text-xs text-secondary">{formatDate(date)} · {formatBRL(plan.amount)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => settleOccurrence(plan, date, true)}>
                    <Check size={14} /> <span>Aportei</span>
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => settleOccurrence(plan, date, false)}>
                    <SkipForward size={14} /> <span>Pular</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Programação de aportes</h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={investments.length === 0}
            title={investments.length === 0 ? 'Cadastre um investimento primeiro' : undefined}
            onClick={() => setPlanDraft(emptyPlan(investments[0].id))}
          >
            <CalendarClock size={14} /> <span>Programar</span>
          </button>
        </div>
        {plans.length === 0 ? (
          <p className="text-xs text-secondary" style={{ marginTop: 8 }}>
            Defina um aporte fixo (semanal, quinzenal ou mensal) e o Balder avisa quando chegar a data de investir.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {plans.map((plan) => {
              const next = nextOccurrence(plan, todayIso);
              return (
                <div key={plan.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <strong>{nameOf(plan.investmentId)}</strong>
                    <div className="text-xs text-secondary">
                      {formatBRL(plan.amount)} · {FREQUENCY_LABELS[plan.frequency]} ·{' '}
                      {next ? `próximo em ${formatDate(next)}` : 'encerrada'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Editar programação" onClick={() => setPlanDraft(plan)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label="Excluir programação"
                      onClick={() => window.confirm('Excluir esta programação de aporte?') && removePlan(plan.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setAporte({ investmentId: inv.id, amount: 0, date: today() })}>
                    <PlusCircle size={14} /> <span>Aportar</span>
                  </button>
                  {(inv.contributions?.length ?? 0) > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleExpanded(inv.id)}>
                      {expanded.has(inv.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>Histórico de aportes ({inv.contributions!.length})</span>
                    </button>
                  )}
                </div>
                {expanded.has(inv.id) && (
                  <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                    {[...(inv.contributions ?? [])]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((c) => (
                        <div key={c.id} className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="text-secondary">
                            {formatDate(c.date)}{c.planId ? ' · programado' : ''}
                          </span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <strong>{formatBRL(c.amount)}</strong>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              aria-label="Desfazer aporte"
                              onClick={() => window.confirm('Desfazer este aporte?') && removeContribution(inv.id, c.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </div>
                      ))}
                  </div>
                )}
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
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Nome</span>
              <input
                className="form-input form-input-sm"
                placeholder="Ex.: CDB 110% CDI, PETR4, HGLG11"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label style={fieldStyle}>
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
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Valor investido (R$)</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={draft.invested}
                emptyWhenZero
                onValueChange={(v) => setDraft({ ...draft, invested: v })}
              />
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Valor atual (R$) — vazio = igual ao investido</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={draft.currentValue}
                emptyWhenZero
                onValueChange={(v) => setDraft({ ...draft, currentValue: v })}
              />
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Data da aplicação</span>
              <input
                type="date"
                className="form-input form-input-sm"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label style={fieldStyle}>
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

      <Modal isOpen={!!aporte} onClose={() => setAporte(null)} title={`Novo aporte${aporte ? ` — ${nameOf(aporte.investmentId)}` : ''}`}>
        {aporte && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Valor aportado (R$)</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={aporte.amount}
                emptyWhenZero
                onValueChange={(v) => setAporte({ ...aporte, amount: v })}
              />
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Data</span>
              <input
                type="date"
                className="form-input form-input-sm"
                value={aporte.date}
                onChange={(e) => setAporte({ ...aporte, date: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={aporte.amount <= 0 || !aporte.date}
              onClick={() => {
                contribute(aporte.investmentId, aporte.amount, aporte.date);
                setAporte(null);
              }}
            >
              Registrar aporte
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!planDraft} onClose={() => setPlanDraft(null)} title={planDraft?.id ? 'Editar programação' : 'Nova programação de aporte'}>
        {planDraft && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Investimento</span>
              <select
                className="form-input form-input-sm"
                value={planDraft.investmentId}
                onChange={(e) => setPlanDraft({ ...planDraft, investmentId: e.target.value })}
              >
                {investments.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Valor de cada aporte (R$)</span>
              <DecimalInput
                className="form-input form-input-sm"
                value={planDraft.amount}
                emptyWhenZero
                onValueChange={(v) => setPlanDraft({ ...planDraft, amount: v })}
              />
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Periodicidade</span>
              <select
                className="form-input form-input-sm"
                value={planDraft.frequency}
                onChange={(e) => setPlanDraft({ ...planDraft, frequency: e.target.value as InvestmentFrequency })}
              >
                {Object.entries(FREQUENCY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Primeiro aporte</span>
              <input
                type="date"
                className="form-input form-input-sm"
                value={planDraft.startDate}
                onChange={(e) => setPlanDraft({ ...planDraft, startDate: e.target.value })}
              />
            </label>
            <label style={fieldStyle}>
              <span className="text-xs text-secondary">Até (opcional)</span>
              <input
                type="date"
                className="form-input form-input-sm"
                value={planDraft.endDate ?? ''}
                onChange={(e) => setPlanDraft({ ...planDraft, endDate: e.target.value || undefined })}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSavePlan}
              onClick={() => {
                if (!planDraft) return;
                savePlan({ ...planDraft, id: planDraft.id || `plan_${Date.now()}` });
                setPlanDraft(null);
              }}
            >
              Salvar programação
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
