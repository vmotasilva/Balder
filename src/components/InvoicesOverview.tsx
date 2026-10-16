import React, { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import type { PeriodRange } from '../utils/periodSpending';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

interface InvoicesOverviewProps {
  range: PeriodRange;
  onNavigateToInvoices: () => void;
}

/**
 * Faturas de cartão em aberto com valor registrado: as vencidas, as que vencem no período e a próxima de cada banco
 * (a que recebe as compras do período, mesmo vencendo depois dele).
 */
export const InvoicesOverview: React.FC<InvoicesOverviewProps> = ({ range, onNavigateToInvoices }) => {
  const { movements } = useFinancial();
  const invoices = useMemo(() => {
    const open = movements
      .filter((m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && m.amount > 0.004)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    // Vencidas ou vencendo no período, mais a fatura aberta de cada banco que recebe as compras do período
    // (vence só depois dele: ex.: gastos de outubro, fatura de 10/11)
    const seenAfter = new Set<string>();
    return open.filter((m) => {
      if (m.dueDate <= range.to) return true;
      const bank = (m.bank || m.title).trim().toLowerCase();
      if (seenAfter.has(bank)) return false;
      seenAfter.add(bank);
      return true;
    });
  }, [movements, range.to]);
  const total = Math.round(invoices.reduce((acc, m) => acc + m.amount, 0) * 100) / 100;

  if (invoices.length === 0) {
    return <p className="text-sm text-muted">Nenhuma fatura em aberto com valor.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="text-sm text-muted">
          {invoices.length} {invoices.length === 1 ? 'fatura em aberto' : 'faturas em aberto'}
        </span>
        <strong style={{ fontSize: '18px' }}>{formatBRL(total)}</strong>
      </div>
      {invoices.map((m) => {
        const items = m.invoiceBreakdown?.length || 0;
        return (
          <div
            key={m.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={14} /> {m.bank || m.title}
              </div>
              <div className="text-xs text-muted">
                {m.dueDate > range.to ? (
                  <>fatura aberta · vence {ddmm(m.dueDate)}</>
                ) : m.dueDate < range.from ? (
                  <span style={{ color: 'var(--accent-rose, #f87171)', fontWeight: 600 }}>vencida em {ddmm(m.dueDate)}</span>
                ) : (
                  <>vence {ddmm(m.dueDate)}</>
                )}
                {items > 0 ? ` · ${items} ${items === 1 ? 'item' : 'itens'}` : ''}
                {m.unanalyzedAmount && m.unanalyzedAmount > 0.004 ? ` · ${formatBRL(m.unanalyzedAmount)} sem detalhar` : ''}
              </div>
            </div>
            <strong>{formatBRL(m.amount)}</strong>
          </div>
        );
      })}
      <button type="button" className="btn btn-secondary" onClick={onNavigateToInvoices}>
        Ver faturas
      </button>
    </div>
  );
};
