import React, { useMemo, useState } from 'react';
import { CheckCircle2, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import { getItemOccurrences, isExcludedState, registerItemPayment, resolveMappingItemMonth } from '../utils/mappingItemState';

/** Linha-resumo de um mapeamento (modo Resumo) na competência. */
export interface MappingPaymentTarget {
  natureId: string;
  mappingId: string;
  itemIds: string[];
  monthKey: string; // YYYY-MM
  title: string;
}

interface MappingPaymentModalProps {
  target: MappingPaymentTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (v: number) => Math.round(v * 100) / 100;
const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const defaultPaidAt = (monthKey: string) => {
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return today.startsWith(monthKey) ? today : `${monthKey}-01`;
};

/**
 * Lançamento de um mapeamento em modo Resumo: o valor pago é distribuído entre os itens ainda pendentes
 * (proporcional ao previsto de cada um) e cada item recebe o pagamento, dando baixa no previsto da competência.
 */
export const MappingPaymentModal: React.FC<MappingPaymentModalProps> = ({ target, onClose }) => {
  if (!target) return null;
  return <MappingPaymentForm key={`${target.mappingId}_${target.monthKey}_${target.itemIds.join('.')}`} target={target} onClose={onClose} />;
};

const MappingPaymentForm: React.FC<{ target: MappingPaymentTarget; onClose: () => void }> = ({ target, onClose }) => {
  const { natures, updateMappingItemState } = useFinancial();
  const { monthKey } = target;

  const rows = useMemo(() => {
    const mapping = natures.find((n) => n.id === target.natureId)?.mappings.find((m) => m.id === target.mappingId);
    if (!mapping) return [];
    return mapping.items
      .filter((it) => target.itemIds.includes(it.id))
      .map((item) => {
        const summary = resolveMappingItemMonth(item, monthKey);
        const excluded = isExcludedState(summary.state);
        const pendingDates = getItemOccurrences(item, monthKey)
          .map((o) => o.date)
          .filter((d) => !summary.coveredDates.has(d));
        return {
          item,
          paid: excluded ? 0 : summary.paid,
          planned: excluded ? 0 : summary.value,
          pending: excluded || summary.state.realized ? 0 : round2(summary.pending),
          pendingDates,
        };
      });
  }, [natures, target, monthKey]);

  const payable = rows.filter((r) => r.pending > 0.005 && r.pendingDates.length > 0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(payable.map((r) => r.item.id)));
  const selected = payable.filter((r) => selectedIds.has(r.item.id));
  const selectedTotal = round2(selected.reduce((acc, r) => acc + r.pending, 0));

  const [amount, setAmount] = useState<number | null>(null);
  const paidAmount = amount ?? selectedTotal;
  const [paidAt, setPaidAt] = useState(() => defaultPaidAt(monthKey));
  const [done, setDone] = useState<string | null>(null);

  const plannedTotal = round2(rows.reduce((acc, r) => acc + r.planned, 0));
  const paidTotal = round2(rows.reduce((acc, r) => acc + r.paid, 0));
  const pendingTotal = round2(payable.reduce((acc, r) => acc + r.pending, 0));
  const diff = round2(paidAmount - selectedTotal);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const register = () => {
    if (selected.length === 0 || paidAmount <= 0) return;
    // Divide o valor pago na proporção do previsto de cada item; o último fica com o arredondamento
    let remaining = round2(paidAmount);
    selected.forEach((r, i) => {
      const share = i === selected.length - 1 ? remaining : round2((paidAmount * r.pending) / selectedTotal);
      remaining = round2(remaining - share);
      const hasDiff = Math.abs(share - r.pending) >= 0.01;
      updateMappingItemState(
        target.natureId,
        target.mappingId,
        r.item.id,
        registerItemPayment(r.item, monthKey, {
          paidAt,
          amount: share,
          coveredDates: r.pendingDates,
          ...(hasDiff
            ? { reason: `Pagamento do mapeamento ${target.title}`, action: share > r.pending ? 'PONTUAL' : 'QUITADO' }
            : {}),
        })
      );
    });
    setDone(`${formatBRL(paidAmount)} registrado em ${selected.length} ${selected.length === 1 ? 'item' : 'itens'} de ${target.title}.`);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Lançar pagamento: ${target.title}`} subtitle={`Competência de ${monthLabel(monthKey)}`} maxWidth="520px">
      <div className="mapping-pay">
        <div className="mapping-pay-summary">
          <span>
            Previsto <strong>{formatBRL(plannedTotal)}</strong>
          </span>
          <span>
            Pago <strong className="text-emerald">{formatBRL(paidTotal)}</strong>
          </span>
          <span>
            Falta <strong className="text-amber">{formatBRL(pendingTotal)}</strong>
          </span>
        </div>

        {done ? (
          <div className="mapping-pay-done">
            <CheckCircle2 size={28} className="text-emerald" />
            <p>{done}</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Concluir
            </button>
          </div>
        ) : payable.length === 0 ? (
          <div className="mapping-pay-done">
            <CheckCircle2 size={28} className="text-emerald" />
            <p>Tudo deste mapeamento já está pago nesta competência.</p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="mapping-pay-fields">
              <label>
                <span>Valor pago</span>
                <DecimalInput
                  className="form-input"
                  value={paidAmount}
                  onValueChange={(v) => setAmount(v)}
                  aria-label="Valor pago"
                />
              </label>
              <label>
                <span>Data do pagamento</span>
                <input type="date" className="form-input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </label>
            </div>
            {Math.abs(diff) >= 0.01 && selected.length > 0 && (
              <p className="mapping-pay-hint">
                {diff < 0
                  ? `Você pagou ${formatBRL(Math.abs(diff))} a menos que o previsto: os itens marcados ficam quitados com o valor real.`
                  : `Você pagou ${formatBRL(diff)} a mais que o previsto: a diferença fica registrada como gasto pontual.`}
              </p>
            )}

            <div className="mapping-pay-list-head">
              <span>O que este pagamento cobre</span>
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  setSelectedIds(selected.length === payable.length ? new Set() : new Set(payable.map((r) => r.item.id)))
                }
              >
                {selected.length === payable.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <ul className="mapping-pay-list">
              {payable.map((r) => (
                <li key={r.item.id}>
                  <label>
                    <input type="checkbox" checked={selectedIds.has(r.item.id)} onChange={() => toggle(r.item.id)} />
                    <span className="mapping-pay-item">{r.item.description}</span>
                    <span className="mapping-pay-value">{formatBRL(r.pending)}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="mapping-pay-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={register} disabled={selected.length === 0 || paidAmount <= 0}>
                <Wallet size={16} />
                <span>Registrar {formatBRL(paidAmount)}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
