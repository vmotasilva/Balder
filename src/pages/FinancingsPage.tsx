import React, { useEffect, useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { DecimalInput } from '../components/DecimalInput';
import { InfoButton } from '../components/InfoButton';
import { buildFinancingSchedule, financedAmount, installmentPhaseAverages, type AmortizationSystem, type FinancingInput, type FinancingSchedule } from '../utils/financingMath';

const STORAGE_KEY = 'balder.financing-sim.v1';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const DEFAULTS: FinancingInput = {
  baseValue: 162810,
  downPayment: 25000,
  annualRate: 0.119,
  termMonths: 420,
  startMonth: currentMonth(),
  extras: {},
};

const loadInput = (): FinancingInput => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Amortizações extras são tratadas depois de contratado: o simulador não as usa
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw), extras: {} };
  } catch {
    /* sem storage: usa os padrões */
  }
  return DEFAULTS;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Linha das parcelas ao longo do prazo, para mostrar a tendência (cai no SAC, constante na Price). */
const InstallmentChart: React.FC<{ rows: FinancingSchedule['rows'] }> = ({ rows }) => {
  if (rows.length < 2) return null;
  const W = 600;
  const H = 140;
  const pad = 6;
  const values = rows.map((r) => r.installment);
  const max = Math.max(...values);
  const lo = 0;
  const span = max || 1;
  const x = (i: number) => pad + (i / (rows.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);
  const points = rows.map((r, i) => `${x(i).toFixed(1)},${y(r.installment).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução da parcela ao longo do prazo" style={{ width: '100%', height: 140 }}>
      <polygon points={`${x(0)},${H - pad} ${points} ${x(rows.length - 1)},${H - pad}`} fill="var(--accent-cyan, #06b6d4)" opacity="0.12" />
      <polyline points={points} fill="none" stroke="var(--accent-cyan, #06b6d4)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
};

/** Simulador de financiamento (SAC x Price) na tabela escolhida (SAC ou Price), no modelo da planilha "Tabela Financiamento". */
export const FinancingsPage: React.FC = () => {
  const [input, setInput] = useState<FinancingInput>(loadInput);
  const [system, setSystem] = useState<AmortizationSystem>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY + '.system') === 'PRICE' ? 'PRICE' : 'SAC';
    } catch {
      return 'SAC';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* ignora */
    }
    try {
      localStorage.setItem(STORAGE_KEY + '.system', system);
    } catch {
      /* ignora */
    }
  }, [input, system]);

  const schedule = useMemo(() => buildFinancingSchedule(input, system), [input, system]);
  const financed = financedAmount(input);

  const otherSystem: AmortizationSystem = system === 'SAC' ? 'PRICE' : 'SAC';
  const other = useMemo(() => buildFinancingSchedule(input, otherSystem), [input, otherSystem]);
  const phases = useMemo(() => installmentPhaseAverages(schedule.rows), [schedule]);
  const sacSummary = (system === 'SAC' ? schedule : other).summary;
  const priceSummary = (system === 'PRICE' ? schedule : other).summary;
  const maxInterest = Math.max(sacSummary.totalInterest, priceSummary.totalInterest, 1);
  const interestDiff = Math.abs(sacSummary.totalInterest - priceSummary.totalInterest);
  const cheaper = sacSummary.totalInterest <= priceSummary.totalInterest ? 'SAC' : 'Price';
  const systemName = system === 'SAC' ? 'SAC' : 'Price';

  const renderSummary = () => (
    <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Resumo da Tabela {systemName}</h3>
      <small style={{ color: 'var(--text-muted)' }}>
        {system === 'SAC'
          ? 'Amortização constante: parcela inicial maior, que diminui a cada mês.'
          : 'Parcela fixa: juros maiores no começo, amortização crescente.'}
      </small>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '12px 0' }}>
        <div><small>Parcela média — início</small><div><strong>{brl(phases.initial)}</strong></div></div>
        <div><small>Parcela média — meio</small><div><strong>{brl(phases.middle)}</strong></div></div>
        <div><small>Parcela média — fim</small><div><strong>{brl(phases.final)}</strong></div></div>
        <div><small>Total de juros</small><div><strong>{brl(schedule.summary.totalInterest)}</strong></div></div>
        <div><small>Total pago</small><div><strong>{brl(schedule.summary.totalPaid)}</strong></div></div>
        <div><small>Parcelas</small><div><strong>{schedule.summary.paidMonths}</strong></div></div>
      </div>
      <small style={{ color: 'var(--text-muted)' }}>Tendência da parcela ao longo do prazo</small>
      <InstallmentChart rows={schedule.rows} />
    </div>
  );

  const renderInterestComparison = () => (
    <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Comparativo de juros totais</h3>
      <small style={{ color: 'var(--text-muted)' }}>
        {interestDiff > 0
          ? `A tabela ${cheaper} paga ${brl(interestDiff)} a menos de juros no prazo completo.`
          : 'As duas tabelas pagam o mesmo total de juros.'}
      </small>
      {([['SAC', sacSummary], ['Price', priceSummary]] as const).map(([name, sum]) => (
        <div key={name} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{name}{name === systemName ? ' (selecionada)' : ''}</span>
            <strong>{brl(sum.totalInterest)}</strong>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(128,128,128,0.18)', overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${(sum.totalInterest / maxInterest) * 100}%`, height: '100%', background: name === 'SAC' ? 'var(--accent-cyan, #06b6d4)' : 'var(--accent-amber, #f59e0b)' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderTable = (title: string, schedule: FinancingSchedule) => (
    <div className="glass-card" style={{ padding: 16, minWidth: 0 }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        <table className="financing-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card, #111)' }}>
            <tr>
              <th align="left">#</th><th align="left">Mês</th><th align="right">Parcela</th>
              <th align="right">Juros</th><th align="right">Amort.</th>
              <th align="right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((r) => (
              <tr key={r.index}>
                <td>{r.index}</td>
                <td>{monthLabel(r.month)}</td>
                <td align="right">{brl(r.installment)}</td>
                <td align="right">{brl(r.interest)}</td>
                <td align="right">{brl(r.amortization)}</td>
                <td align="right">{brl(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <Home size={14} className="text-cyan" />
            <span>CONTRATOS</span>
          </div>
          <h1 className="page-title label-with-info">
            Financiamentos
            <InfoButton title="Financiamentos">
              <p>Simule o financiamento escolhendo a tabela: SAC (amortização constante, parcelas decrescentes) ou Price (parcela fixa). Amortizações extras são tratadas depois de contratado.</p>
              <p>A taxa mensal é a anual dividida por 12, como na planilha.</p>
            </InfoButton>
          </h1>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="params-inputs-grid">
          <div className="form-group">
            <label>Valor base (R$)</label>
            <DecimalInput className="form-input" value={input.baseValue} onValueChange={(v) => setInput({ ...input, baseValue: v })} />
          </div>
          <div className="form-group">
            <label>Entrada (FGTS + extra) (R$)</label>
            <DecimalInput className="form-input" value={input.downPayment} onValueChange={(v) => setInput({ ...input, downPayment: v })} />
          </div>
          <div className="form-group">
            <label>Valor a financiar (R$)</label>
            <input readOnly className="form-input loan-calculated-field" value={brl(financed)} />
          </div>
          <div className="form-group">
            <label>Taxa de juros anual (%)</label>
            <DecimalInput
              money={false}
              maxFractionDigits={4}
              className="form-input"
              value={Math.round(input.annualRate * 100 * 1e4) / 1e4}
              onValueChange={(v) => setInput({ ...input, annualRate: v / 100 })}
            />
          </div>
          <div className="form-group">
            <label>Taxa mensal (%)</label>
            <input readOnly className="form-input loan-calculated-field" value={((input.annualRate * 100) / 12).toFixed(4).replace('.', ',')} />
          </div>
          <div className="form-group">
            <label>Prazo (anos)</label>
            <DecimalInput
              money={false}
              maxFractionDigits={2}
              className="form-input"
              value={Math.round((input.termMonths / 12) * 100) / 100}
              onValueChange={(v) => setInput({ ...input, termMonths: Math.max(0, Math.round(v * 12)) })}
            />
          </div>
          <div className="form-group">
            <label>Prazo (meses)</label>
            <DecimalInput
              money={false}
              maxFractionDigits={0}
              className="form-input"
              value={input.termMonths}
              onValueChange={(v) => setInput({ ...input, termMonths: Math.max(0, Math.floor(v)) })}
            />
          </div>
          <div className="form-group">
            <label>Início (1ª parcela)</label>
            <input
              type="month"
              className="form-input"
              value={input.startMonth}
              onChange={(e) => e.target.value && setInput({ ...input, startMonth: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Tabela de amortização" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['SAC', 'Tabela SAC', 'parcelas decrescentes'], ['PRICE', 'Tabela Price', 'parcelas fixas']] as const).map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={system === id}
            className={`btn btn-sm ${system === id ? '' : 'btn-outline'}`}
            style={system === id ? { background: '#0369A1', color: '#fff', fontWeight: 700 } : undefined}
            onClick={() => setSystem(id)}
          >
            {label} <small style={{ opacity: system === id ? 1 : 0.75, marginLeft: 4 }}>· {hint}</small>
          </button>
        ))}
      </div>

      {renderSummary()}
      {renderInterestComparison()}
      {renderTable(`Cronograma — Tabela ${systemName}`, schedule)}
    </div>
  );
};
