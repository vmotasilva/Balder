import React, { useEffect, useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { DecimalInput } from '../components/DecimalInput';
import { InfoButton } from '../components/InfoButton';
import { buildFinancingSchedule, financedAmount, type AmortizationSystem, type FinancingInput, type FinancingSchedule } from '../utils/financingMath';

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

  const renderTable = (title: string, hint: string, schedule: FinancingSchedule) => (
    <div className="glass-card" style={{ padding: 16, minWidth: 0 }}>
      <h3 style={{ marginBottom: 4 }}>{title}</h3>
      <small style={{ color: 'var(--text-muted)' }}>{hint}</small>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '12px 0' }}>
        <div><small>1ª parcela</small><div><strong>{brl(schedule.summary.firstInstallment)}</strong></div></div>
        <div><small>Última parcela</small><div><strong>{brl(schedule.summary.lastInstallment)}</strong></div></div>
        <div><small>Total de juros</small><div><strong>{brl(schedule.summary.totalInterest)}</strong></div></div>
        <div><small>Total pago</small><div><strong>{brl(schedule.summary.totalPaid)}</strong></div></div>
        <div><small>Parcelas pagas</small><div><strong>{schedule.summary.paidMonths}</strong></div></div>
      </div>
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
            <label>Tabela de amortização</label>
            <select className="form-input" value={system} onChange={(e) => setSystem(e.target.value as AmortizationSystem)}>
              <option value="SAC">SAC — parcelas decrescentes</option>
              <option value="PRICE">Price — parcelas fixas</option>
            </select>
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

      {system === 'SAC'
        ? renderTable('Tabela SAC', 'Amortização constante: parcela inicial maior, que diminui a cada mês.', schedule)
        : renderTable('Tabela Price', 'Parcela fixa: juros maiores no começo, amortização crescente.', schedule)}
    </div>
  );
};
