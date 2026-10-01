import React, { useMemo, useState } from 'react';
import { BadgePercent, Receipt, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { MovementDetailModal } from '../components/MovementDetailModal';
import { OpportunitiesPage } from './OpportunitiesPage';
import { InfoButton } from '../components/InfoButton';
import { movementDate, movementValue } from '../components/PeriodMovementsModal';
import type { Movement, MovementType } from '../types';

interface PurchasesPageProps {
  onRegisterPurchase: (type: MovementType, initialData?: Partial<Movement>) => void;
}

type Tab = 'REALIZADAS' | 'OPORTUNIDADES';
type Window = '30' | '90' | 'TODAS';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Compras: o que já foi pago (para conferir e corrigir) e os produtos acompanhados (oportunidades). */
export const PurchasesPage: React.FC<PurchasesPageProps> = ({ onRegisterPurchase }) => {
  const { movements, deleteMovement } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const [tab, setTab] = useState<Tab>('REALIZADAS');
  const [windowDays, setWindowDays] = useState<Window>('30');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Movement | null>(null);

  const purchases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = windowDays === 'TODAS' ? '' : isoOf(new Date(Date.now() - Number(windowDays) * 86400000));
    return movements
      .filter((m) => m.type === 'PAGAR' && m.status === 'REALIZADA')
      .filter((m) => !from || movementDate(m) >= from)
      .filter((m) => !q || `${m.title} ${m.category} ${m.bank}`.toLowerCase().includes(q))
      .sort((a, b) => movementDate(b).localeCompare(movementDate(a)));
  }, [movements, windowDays, query]);

  const total = purchases.reduce((acc, m) => acc + movementValue(m), 0);

  return (
    <>
      <div className="page-container animate-fade-in" style={tab === 'OPORTUNIDADES' ? { paddingBottom: 0 } : undefined}>
        <div className="page-header flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="kicker-badge">
              <Receipt size={14} className="text-cyan" />
              <span>COMPRAS & OPORTUNIDADES</span>
            </div>
            <h1 className="page-title label-with-info">
              Compras
              <InfoButton title="Compras">
                <p>Confira o que você já pagou e corrija valor, data ou natureza se algo foi lançado errado. Na aba Oportunidades você acompanha o preço de produtos que quer comprar.</p>
              </InfoButton>
            </h1>
          </div>
          <div className="loans-nav-tabs">
            <button type="button" className={`tab-btn ${tab === 'REALIZADAS' ? 'active' : ''}`} onClick={() => setTab('REALIZADAS')}>
              <Receipt size={16} />
              <span>Compras realizadas</span>
            </button>
            <button type="button" className={`tab-btn ${tab === 'OPORTUNIDADES' ? 'active' : ''}`} onClick={() => setTab('OPORTUNIDADES')}>
              <BadgePercent size={16} />
              <span>Oportunidades</span>
            </button>
          </div>
        </div>

        {tab === 'REALIZADAS' && (
          <div className="period-mov">
            <div className="period-mov-filters">
              <div className="period-mov-chips" role="group">
                {([['30', '30 dias'], ['90', '90 dias'], ['TODAS', 'Tudo']] as [Window, string][]).map(([id, label]) => (
                  <button key={id} type="button" className={windowDays === id ? 'is-active' : ''} onClick={() => setWindowDays(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="period-mov-search">
                <Search size={14} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, natureza ou banco" aria-label="Buscar compras" />
              </label>
            </div>

            <div className="period-mov-totals">
              <span>{purchases.length} {purchases.length === 1 ? 'compra' : 'compras'}</span>
              <span>Total <strong className="text-rose">{formatBRL(total)}</strong></span>
            </div>

            {purchases.length === 0 ? (
              <p className="period-mov-empty">Nenhuma compra paga nesse período.</p>
            ) : (
              <ul className="period-mov-list purchases-list">
                {purchases.map((m) => (
                  <li key={m.id}>
                    <span className="period-mov-date">{shortDate(movementDate(m))}</span>
                    <span className="period-mov-main">
                      <b>{m.title}</b>
                      <small>{m.category} · {m.bank}</small>
                    </span>
                    <span className="purchases-actions">
                      <strong className="text-rose">{formatBRL(movementValue(m))}</strong>
                      <button type="button" className="icon-btn" title="Ajustar compra e lançamento" aria-label={`Ajustar ${m.title}`} onClick={() => setSelected(m)}>
                        <SlidersHorizontal size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Excluir compra"
                        aria-label={`Excluir ${m.title}`}
                        onClick={() =>
                          confirm({
                            title: 'Excluir compra',
                            message: `Excluir "${m.title}" (${formatBRL(movementValue(m))})? O saldo e as projeções são recalculados e isso não pode ser desfeito.`,
                            confirmLabel: 'Excluir',
                            onConfirm: () => deleteMovement(m.id),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {tab === 'OPORTUNIDADES' && <OpportunitiesPage onRegisterPurchase={onRegisterPurchase} />}

      <MovementDetailModal isOpen={!!selected} onClose={() => setSelected(null)} movement={selected} />
      <ConfirmDialog {...dialogProps} />
    </>
  );
};
