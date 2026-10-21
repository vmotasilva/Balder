import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Pencil } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import type { PeriodRange } from '../utils/periodSpending';
import { canRefundIof, iofRefundUpdates, invoiceItemEditUpdates } from '../utils/cardPurchase';
import { userNatures } from '../utils/baseNatures';
import { parseMoney } from '../utils/parseDecimal';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const bankKey = (m: { bank?: string; title: string }) => (m.bank || m.title).trim().toLowerCase();

interface InvoicesOverviewProps {
  range: PeriodRange;
}

/**
 * Faturas de cartão em aberto com valor registrado, por banco: navega entre elas (setas) e mostra o total e os itens
 * da fatura escolhida. Abre na fatura que recebe as compras do período (a primeira que vence depois dele, ou a
 * última vencida se não houver).
 */
export const InvoicesOverview: React.FC<InvoicesOverviewProps> = ({ range }) => {
  const { movements, updateMovement, natures } = useFinancial();
  // Edição do item da fatura: nome, natureza e mapeamento (com o item do mapeamento, quando houver)
  const [edit, setEdit] = useState<{ itemId: string; description: string; natureId: string; mappingItem: string } | null>(null);
  // Abate de IOF em edição: item da fatura e valor digitado
  const [iofEdit, setIofEdit] = useState<{ itemId: string; value: string } | null>(null);
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
  useEffect(() => {
    setIndex(null);
    setIofEdit(null);
    setEdit(null);
  }, [activeBank, range.to]);

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
        <button type="button" style={arrow(current === 0)} disabled={current === 0} onClick={() => { setIndex(current - 1); setIofEdit(null); }} aria-label="Fatura anterior">
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
          onClick={() => { setIndex(current + 1); setIofEdit(null); }}
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
            <React.Fragment key={it.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: it.iofRefund ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid var(--border-default)',
                borderLeft: it.iofRefund ? '4px solid #34D399' : undefined,
                background: it.iofRefund ? 'rgba(52, 211, 153, 0.08)' : 'var(--bg-card)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {it.description}
                  <button
                    type="button"
                    aria-label="Editar item"
                    title="Renomear e ajustar natureza e mapeamento"
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    onClick={() =>
                      setEdit({
                        itemId: it.id,
                        description: it.description.replace(/\s*\(\d+\/\d+\)$/, ''),
                        natureId: it.natureId || (it.natureName === 'Outros' ? 'OUTROS' : ''),
                        mappingItem: it.mappingId && it.mappingItemId ? `${it.mappingId}:::${it.mappingItemId}` : '',
                      })
                    }
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <div className="text-xs text-muted">
                  {it.natureName}
                  {inst > 1 ? ` · parcela ${it.currentInstallment || 1}/${inst}` : ''}
                  {it.purchaseDate ? ` · compra ${ddmm(it.purchaseDate)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ whiteSpace: 'nowrap' }}>{formatBRL(it.amount)}</strong>
                {it.iofRefund ? (
                  <button
                    type="button"
                    title="Editar o IOF estornado"
                    style={{ marginTop: '2px', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(52, 211, 153, 0.5)', background: 'rgba(52, 211, 153, 0.15)', color: '#34D399', cursor: 'pointer', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}
                    onClick={() => setIofEdit({ itemId: it.id, value: String(it.iofRefund).replace('.', ',') })}
                  >
                    IOF −{formatBRL(it.iofRefund)}
                  </button>
                ) : canRefundIof(it) ? (
                  <div>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#34D399', cursor: 'pointer', padding: '2px 0', fontWeight: 700, fontSize: '11px' }}
                      onClick={() => setIofEdit({ itemId: it.id, value: '' })}
                    >
                      + IOF
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {edit?.itemId === it.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 4px 8px' }}>
                <input
                  className="form-input"
                  aria-label="Nome do item"
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
                <select
                  className="form-input"
                  aria-label="Natureza"
                  value={edit.natureId}
                  onChange={(e) => setEdit({ ...edit, natureId: e.target.value, mappingItem: '' })}
                >
                  <option value="">Sem natureza</option>
                  {userNatures(natures).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.icon || '🏷️'} {n.name}
                    </option>
                  ))}
                  <option value="OUTROS">📦 Outros</option>
                </select>
                {(() => {
                  const mappings = edit.natureId && edit.natureId !== 'OUTROS' ? natures.find((n) => n.id === edit.natureId)?.mappings || [] : [];
                  return (
                    <select
                      className="form-input"
                      aria-label="Mapeamento"
                      value={edit.mappingItem}
                      onChange={(e) => setEdit({ ...edit, mappingItem: e.target.value })}
                      disabled={mappings.length === 0}
                    >
                      <option value="">{mappings.length > 0 ? 'Mapeamento / item (opcional)' : 'Sem mapeamento'}</option>
                      {mappings.map((mp) => (
                        <optgroup key={mp.id} label={mp.name}>
                          {mp.items.map((mi) => (
                            <option key={mi.id} value={`${mp.id}:::${mi.id}`}>
                              {mi.description}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  );
                })()}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const nat = natures.find((n) => n.id === edit.natureId);
                      const [mappingId, mappingItemId] = edit.mappingItem ? edit.mappingItem.split(':::') : [undefined, undefined];
                      const updates = invoiceItemEditUpdates(m, it.id, {
                        description: edit.description,
                        natureId: edit.natureId,
                        natureName: nat?.name || '',
                        mappingId,
                        mappingItemId,
                      });
                      if (updates) updateMovement(m.id, updates);
                      setEdit(null);
                    }}
                  >
                    Salvar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {iofEdit?.itemId === it.id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '2px 4px 6px' }}>
                <span className="text-xs text-muted">IOF a abater (R$):</span>
                <input
                  className="form-input"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0,00"
                  value={iofEdit.value}
                  onChange={(e) => setIofEdit({ ...iofEdit, value: e.target.value })}
                  style={{ width: '100px' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const updates = iofRefundUpdates(m, it.id, parseMoney(iofEdit.value) || 0);
                    if (updates) updateMovement(m.id, updates);
                    setIofEdit(null);
                  }}
                >
                  Abater
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIofEdit(null)}>
                  Cancelar
                </button>
                {it.iofRefund ? <span className="text-xs text-muted">0 desfaz o abate.</span> : null}
              </div>
            )}
            </React.Fragment>
          );
        })}
        {undetailed > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px dashed var(--border-default)' }}>
            <span className="text-muted">Sem detalhar</span>
            <strong>{formatBRL(undetailed)}</strong>
          </div>
        )}
      </div>

    </div>
  );
};
