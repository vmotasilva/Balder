import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, Trash2, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { useFinancial } from '../context/FinancialContext';
import {
  registerMappingPayment,
  removeMappingPayment,
  resolveMappingMonth,
  resolveMappingPeriodGap,
} from '../utils/mappingItemState';
import { periodRangeLabel, trackingPeriodRange, TRACKING_PERIOD_LABELS, type TrackingPeriod } from '../utils/periodSpending';
import { DateInput } from './DateInput';

/** Mapeamento em modo Resumo na competência (a linha de cobrança da natureza). */
export interface MappingPaymentTarget {
  natureId: string;
  mappingId: string;
  /** Itens que compõem a linha (um mapeamento misto tem uma linha para cartão e outra para os demais). */
  itemIds: string[];
  monthKey: string; // YYYY-MM
  title: string;
}

interface MappingPaymentModalProps {
  target: MappingPaymentTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const defaultPaidAt = (monthKey: string) => {
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return today.startsWith(monthKey) ? today : `${monthKey}-01`;
};

/**
 * Lançamento do mapeamento em modo Resumo: só valor e data. Os itens servem apenas para compor o previsto;
 * cada pagamento abate do previsto do mapeamento (pode ser em partes, ex.: uma compra por semana).
 */
export const MappingPaymentModal: React.FC<MappingPaymentModalProps> = ({ target, onClose }) => {
  if (!target) return null;
  return <MappingPaymentForm key={`${target.mappingId}_${target.monthKey}_${target.itemIds.join('.')}`} target={target} onClose={onClose} />;
};

const MappingPaymentForm: React.FC<{ target: MappingPaymentTarget; onClose: () => void }> = ({ target, onClose }) => {
  const { natures, updateMappingItemState, viewPreferences } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const { monthKey } = target;

  const scope = useMemo(() => {
    const mapping = natures.find((n) => n.id === target.natureId)?.mappings.find((m) => m.id === target.mappingId);
    return { items: (mapping?.items || []).filter((it) => target.itemIds.includes(it.id)) };
  }, [natures, target]);
  const month = resolveMappingMonth(scope, monthKey);

  const [amount, setAmount] = useState<number | null>(null);
  const paidAmount = amount ?? month.pending;
  const [paidAt, setPaidAt] = useState(() => defaultPaidAt(monthKey));
  const [feedback, setFeedback] = useState<string | null>(null);
  // Pagou menos que o previsto do período de acompanhamento: pergunta se o restante se mantém
  const [askRest, setAskRest] = useState<{ rest: number; later: number } | null>(null);

  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'MES';
  // O período que contém a data do pagamento, limitado à competência (o previsto é calculado mês a mês)
  const range = useMemo(() => {
    if (!paidAt.startsWith(monthKey)) return trackingPeriodRange('MES', dateOf(`${monthKey}-01`));
    return trackingPeriodRange(period, dateOf(paidAt));
  }, [paidAt, monthKey, period]);
  const clippedRange = useMemo(() => {
    const first = `${monthKey}-01`;
    const last = trackingPeriodRange('MES', dateOf(first)).to;
    return { from: range.from < first ? first : range.from, to: range.to > last ? last : range.to };
  }, [range, monthKey]);

  const apply = (changes: { itemId: string; patch: Parameters<typeof updateMappingItemState>[3] }[]) =>
    changes.forEach((c) => updateMappingItemState(target.natureId, target.mappingId, c.itemId, c.patch));

  const commit = (waive: number) => {
    apply(registerMappingPayment(scope, monthKey, { paidAt, amount: paidAmount, waive }));
    const left = Math.max(0, Math.round((month.pending - paidAmount - waive) * 100) / 100);
    setFeedback(
      left > 0.005
        ? `${formatBRL(paidAmount)} lançado em ${formatDate(paidAt)}. Ainda faltam ${formatBRL(left)} no mês.`
        : waive > 0.005
        ? `${formatBRL(paidAmount)} lançado em ${formatDate(paidAt)}. ${formatBRL(waive)} saiu do previsto; ${target.title} está quitado no mês.`
        : `${formatBRL(paidAmount)} lançado em ${formatDate(paidAt)}. ${target.title} está quitado no mês.`
    );
    setAskRest(null);
    setAmount(null);
  };

  const register = () => {
    if (paidAmount <= 0) return;
    const gap = resolveMappingPeriodGap(scope, monthKey, clippedRange);
    const rest = Math.round((gap.expected - paidAmount) * 100) / 100;
    if (rest > 0.005) setAskRest({ rest, later: gap.laterOccurrences });
    else commit(0);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Lançar pagamento: ${target.title}`} subtitle={`Competência de ${monthLabel(monthKey)}`} maxWidth="460px">
      <div className="mapping-pay">
        <div className="mapping-pay-summary">
          <span>
            Previsto <strong>{formatBRL(month.planned)}</strong>
          </span>
          <span>
            Pago <strong className="text-emerald">{formatBRL(month.paid)}</strong>
          </span>
          <span>
            Falta <strong className="text-amber">{formatBRL(month.pending)}</strong>
          </span>
        </div>

        {feedback && (
          <p className="mapping-pay-feedback">
            <CheckCircle2 size={15} className="text-emerald" /> {feedback}
          </p>
        )}

        <div className="mapping-pay-fields">
          <label>
            <span>Valor pago</span>
            <DecimalInput className="form-input" value={paidAmount} onValueChange={(v) => setAmount(v)} emptyWhenZero aria-label="Valor pago" />
          </label>
          <label>
            <span>Data do pagamento</span>
            <DateInput type="date" showToday className="form-input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
        </div>

        {month.payments.length > 0 && (
          <div className="mapping-pay-history">
            <span className="mapping-pay-history-title">Pagamentos deste mês</span>
            <ul>
              {month.payments.map((p) => (
                <li key={p.id}>
                  <span>{formatDate(p.paidAt)}</span>
                  <strong>{formatBRL(p.amount)}</strong>
                  {p.waived > 0.005 && <small title="Parte do previsto descartada neste lançamento"> −{formatBRL(p.waived)} previsto</small>}
                  <button
                    type="button"
                    className="mapping-pay-undo"
                    title="Desfazer este pagamento"
                    aria-label="Desfazer este pagamento"
                    onClick={() =>
                      confirm({
                        title: 'Desfazer pagamento',
                        message: `O pagamento de ${formatBRL(p.amount)} em ${formatDate(p.paidAt)} volta a ficar em aberto no previsto.`,
                        confirmLabel: 'Desfazer',
                        onConfirm: () => {
                          apply(removeMappingPayment(scope, monthKey, p.id));
                          setFeedback(null);
                        },
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {askRest ? (
          <div className="mapping-pay-rest" role="group" aria-label="O restante do previsto se mantém?">
            <p className="mapping-pay-rest-question">
              <CircleHelp size={16} className="text-amber" />
              <span>
                Faltaram <strong>{formatBRL(askRest.rest)}</strong> do previsto {period === 'MES' || !paidAt.startsWith(monthKey) ? 'deste mês' : `${TRACKING_PERIOD_LABELS[period].this} (${periodRangeLabel(period, range)})`}. O restante se mantém?
              </span>
            </p>
            <button type="button" className="btn btn-primary" onClick={() => commit(0)}>
              <span>
                Sim, manter {formatBRL(askRest.rest)} no previsto
                <small>
                  {askRest.later > 0
                    ? ` · fica para as próximas compras do mês (${askRest.later} ${askRest.later === 1 ? 'prevista' : 'previstas'})`
                    : ' · não há mais compras previstas no mês: continua em aberto'}
                </small>
              </span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => commit(askRest.rest)}>
              <span>
                Não, descartar {formatBRL(askRest.rest)}
                <small> · sai do previsto; o mês fecha com o que foi pago</small>
              </span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAskRest(null)}>
              Voltar
            </button>
          </div>
        ) : (
          <div className="mapping-pay-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {feedback ? 'Fechar' : 'Cancelar'}
            </button>
            <button type="button" className="btn btn-primary" onClick={register} disabled={paidAmount <= 0}>
              <Wallet size={16} />
              <span>Registrar {paidAmount > 0 ? formatBRL(paidAmount) : ''}</span>
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </Modal>
  );
};
