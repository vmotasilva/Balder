import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import type { PeriodRange } from '../utils/periodSpending';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const bankKey = (m: { bank?: string; title: string }) => (m.bank || m.title).trim().toLowerCase();

interface InvoicesOverviewProps {
  range: PeriodRange;
  onNavigateToInvoices: () => void;
}

/**
 * Faturas de cartão em aberto com valor registrado, por banco: navega entre elas (setas) e mostra o total e os itens
 * da fatura escolhida. Abre na fatura que recebe as compras do período (a primeira que vence depois dele, ou a
 * última vencida se não houver).
 */
export const InvoicesOverview: React.FC<InvoicesOverviewProps> = ({ range, onNavigateToInvoices }) => {
  const { movements } = useFinancial();
  const open = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && m.amount > 0.004)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [movements]
  );
  const banks = useMemo(() => {
    const map = new Map<string, string>();
    open.forEach((m) => {
      if (!map.has(bankKey(m))) map.set(bankKey(m), m.bank || m.title);
    });
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [open]);

  const [bank, setBank] = useState<string | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const activeBank = banks.find((b) => b.key === bank)?.key ?? banks[0]?.key;
  const invoices = useMemo(() => open.filter((m) => bankKey(m) === activeBank), [open, activeBank]);
  const defaultIndex = useMemo(() => {
    const after = invoices.findIndex((m) => m.dueDate > range.to);
    return after >= 0 ? after : Math.max(0, invoices.length - 1);
  }, [invoices, range.to]);
  const current = Math.min(index ?? defaultIndex, Math.max(0, invoices.length - 1));
  useEffect(() => setIndex(null), [activeBank, range.to]);

  if (invoices.length === 0) {
    return <p className="text-sm text-muted">Nenhuma fatura em aberto com valor.</p>;
  }

  const m = invoices[current];
  const items = m.invoiceBreakdown || [];
  const undetailed = m.unanalyzedAmount && m.unanalyzedAmount > 0.004 ? m.unanalyzedAmount : 0;
  const status = m.dueDate < range.from ? 'vencida' : m.dueDate > range.to ? 'fatura aberta' : 'vence neste período';
  const arrow = (disabled: boolean): React.CSSProperties => ({
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    borderRadius: '50%',
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.35 : 1,
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {banks.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Banco">
          {banks.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`btn ${b.key === activeBank ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBank(b.key)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button type="button" style={arrow(current === 0)} disabled={current === 0} onClick={() => setIndex(current - 1)} aria-label="Fatura anterior">
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <CreditCard size={14} /> {m.bank || m.title}
          </div>
          <div className="text-xs text-muted">
            <span style={m.dueDate < range.from ? { color: 'var(--accent-rose, #f87171)', fontWeight: 600 } : undefined}>{status}</span> · vence{' '}
            {ddmm(m.dueDate)} · {current + 1} de {invoices.length}
          </div>
        </div>
        <button
          type="button"
          style={arrow(current >= invoices.length - 1)}
          disabled={current >= invoices.length - 1}
          onClick={() => setIndex(current + 1)}
          aria-label="Próxima fatura"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div className="text-xs text-muted">Valor da fatura</div>
        <strong style={{ fontSize: '28px' }}>{formatBRL(m.amount)}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '45vh', overflowY: 'auto' }}>
        {items.length === 0 && undetailed === 0 && <p className="text-sm text-muted">Esta fatura ainda não tem itens detalhados.</p>}
        {items.map((it) => {
          const inst = it.installments || 1;
          return (
            <div
              key={it.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{it.description}</div>
                <div className="text-xs text-muted">
                  {it.natureName}
                  {inst > 1 ? ` · parcela ${it.currentInstallment || 1}/${inst}` : ''}
                  {it.purchaseDate ? ` · compra ${ddmm(it.purchaseDate)}` : ''}
                  {it.iofRefund ? ` · IOF estornado −${formatBRL(it.iofRefund)}` : ''}
                </div>
              </div>
              <strong style={{ whiteSpace: 'nowrap' }}>{formatBRL(it.amount)}</strong>
            </div>
          );
        })}
        {undetailed > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px dashed var(--border-default)' }}>
            <span className="text-muted">Sem detalhar</span>
            <strong>{formatBRL(undetailed)}</strong>
          </div>
        )}
      </div>

      <button type="button" className="btn btn-secondary" onClick={onNavigateToInvoices}>
        Ver faturas
      </button>
    </div>
  );
};
