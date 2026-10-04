import React, { useEffect, useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { DecimalInput } from '../components/DecimalInput';
import { InfoButton } from '../components/InfoButton';
import { buildFinancingSchedule, financedAmount, type FinancingInput, type FinancingSchedule } from '../utils/financingMath';

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
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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

/** Simulador de financiamento (SAC x Price) com amortizações extras, no modelo da planilha "Tabela Financiamento". */
export const FinancingsPage: React.FC = () => {
  const [input, setInput] = useState<FinancingInput>(loadInput);
  const [extraMonth, setExtraMonth] = useState(1);
  const [extraValue, setExtraValue] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* ignora */
    }
  }, [input]);

  const sac = useMemo(() => buildFinancingSchedule(input, 'SAC'), [input]);
  const price = useMemo(() => buildFinancingSchedule(input, 'PRICE'), [input]);
  const financed = financedAmount(input);
  const extraEntries = Object.entries(input.extras)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0] - b[0]);

  const addExtra = () => {
    if (extraValue <= 0 || extraMonth < 1 || extraMonth > input.termMonths) return;
    setInput({ ...input, extras: { ...input.extras, [extraMonth]: extraValue } });
    setExtraValue(0);
  };
  const removeExtra = (k: number) => {
    const next = { ...input.extras };
    delete next[k];
    setInput({ ...input, extras: next });
  };

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
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card, #111)' }}>
            <tr>
              <th align="left">#</th><th align="left">Mês</th><th align="right">Parcela</th>
              <th align="right">Juros</th><th align="right">Amort.</th><th align="right">Extra</th>
              <th align="right">Saldo devedor</th>
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
                <td align="right">{r.extra > 0 ? brl(r.extra) : '—'}</td>
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
              <p>Calculadora de financiamento. Compara a tabela SAC (amortização constante, parcelas decrescentes) com a Price (parcela fixa) e permite lançar amortizações extras, que reduzem o saldo e encurtam o prazo.</p>
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

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Amortizações extras</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Parcela nº</label>
            <DecimalInput money={false} maxFractionDigits={0} className="form-input" value={extraMonth} onValueChange={(v) => setExtraMonth(Math.floor(v))} />
          </div>
          <div className="form-group">
            <label>Valor extra (R$)</label>
            <DecimalInput className="form-input" value={extraValue} emptyWhenZero onValueChange={setExtraValue} />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={addExtra}>Adicionar</button>
        </div>
        {extraEntries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {extraEntries.map(([k, v]) => (
              <button key={k} type="button" className="btn btn-outline btn-sm" title="Remover" onClick={() => removeExtra(k)}>
                Parcela {k}: {brl(v)} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {renderTable('Tabela SAC', 'Amortização constante: parcela inicial maior, que diminui a cada mês.', sac)}
        {renderTable('Tabela Price', 'Parcela fixa: juros maiores no começo, amortização crescente.', price)}
      </div>
    </div>
  );
};
