import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, Link2, Trash2, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { useFinancial } from '../context/FinancialContext';
import {
  registerMappingPayment,
  removeMappingPayment,
  resolveMappingMonth,
  resolveMappingPeriodGap,
  waiveMappingPeriod,
} from '../utils/mappingItemState';
import { findMappingSpendCandidates, spendAmount, spendDate } from '../utils/mappingSpendCandidates';
import type { Movement } from '../types';
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
  /** Data da compra prevista (YYYY-MM-DD): a semana dela é onde se procura gasto já feito. */
  forecastDate?: string;
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
  const { natures, movements, updateMovement, updateMappingItemState, viewPreferences } = useFinancial();
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
  // Gasto que já aconteceu e o usuário disse ser esta compra prevista
  const [linked, setLinked] = useState<Movement | null>(null);
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

  // Semana da compra prevista (limitada à competência): onde se procura gasto que já aconteceu
  const weekRange = useMemo(() => {
    const first = `${monthKey}-01`;
    const last = trackingPeriodRange('MES', dateOf(first)).to;
    const ref = target.forecastDate && target.forecastDate.startsWith(monthKey) ? target.forecastDate : defaultPaidAt(monthKey);
    const week = trackingPeriodRange('SEMANA', dateOf(ref));
    return { from: week.from < first ? first : week.from, to: week.to > last ? last : week.to };
  }, [target.forecastDate, monthKey]);
  // A compra pode ter sido feita em outra semana (ou dia) que a prevista: procura no mês todo, os mais próximos primeiro
  const monthRange = useMemo(() => {
    const first = `${monthKey}-01`;
    return { from: first, to: trackingPeriodRange('MES', dateOf(first)).to };
  }, [monthKey]);
  const candidates = useMemo(
    () =>
      findMappingSpendCandidates({
        movements,
        natures,
        natureId: target.natureId,
        mappingId: target.mappingId,
        range: monthRange,
        near: target.forecastDate,
      }),
    [movements, natures, target.natureId, target.mappingId, monthRange, target.forecastDate]
  );

  const pickSpend = (m: Movement) => {
    setLinked(m);
    setAmount(spendAmount(m));
    setPaidAt(spendDate(m));
  };

  const apply = (changes: { itemId: string; patch: Parameters<typeof updateMappingItemState>[3] }[]) =>
    changes.forEach((c) => updateMappingItemState(target.natureId, target.mappingId, c.itemId, c.patch));

  const commit = (waive: number) => {
    const changes = registerMappingPayment(scope, monthKey, { paidAt, amount: paidAmount, waive, movementId: linked?.id });
    apply(changes);
    // O gasto passa a pertencer ao mapeamento: o item ligado evita que ele conte de novo no "Real" da natureza
    if (linked && changes.length > 0) {
      updateMovement(linked.id, { natureId: target.natureId, mappingId: target.mappingId, mappingItemId: changes[0].itemId });
    }
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
    setLinked(null);
  };

  const discardWeek = () => {
    const { waived, changes } = waiveMappingPeriod(scope, monthKey, weekRange);
    if (changes.length === 0) return;
    apply(changes);
    setFeedback(`${formatBRL(waived)} saiu do previsto da semana. Nada foi pago: o saldo deixa de contar com essa compra.`);
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

        {candidates.length > 0 && (
          <div className="mapping-pay-suggest" role="group" aria-label="Gastos já feitos no mês">
            <p className="mapping-pay-suggest-title">
              <Link2 size={15} className="text-amber" />
              <span>
                {candidates.length === 1 ? 'Já há um gasto' : `Já há ${candidates.length} gastos`} de {target.title} em{' '}
                {monthLabel(monthKey)}, ainda sem ligação com o previsto. {candidates.length === 1 ? 'É esta compra prevista?' : 'Algum deles é esta compra prevista?'}
              </span>
            </p>
            <ul>
              {candidates.map((m) => (
                <li key={m.id} className={linked?.id === m.id ? 'is-linked' : undefined}>
                  <span>{formatDate(spendDate(m))}</span>
                  <span className="mapping-pay-suggest-name">{m.title.replace(/^Despesa:\s*/i, '')}</span>
                  <strong>{formatBRL(spendAmount(m))}</strong>
                  {linked?.id === m.id ? (
                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => setLinked(null)}>
                      Desassociar
                    </button>
                  ) : (
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => pickSpend(m)}>
                      Já foi este
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {linked && <small>Associado: ao registrar, este gasto passa a abater o previsto em vez de ser lançado de novo.</small>}
          </div>
        )}

        <div className="mapping-pay-fields">
          <label>
            <span>Valor pago</span>
            <DecimalInput
              className="form-input"
              value={paidAmount}
              onValueChange={(v) => {
                setAmount(v);
                if (linked && v !== spendAmount(linked)) setLinked(null);
              }}
              emptyWhenZero
              aria-label="Valor pago"
            />
          </label>
          <label>
            <span>Data do pagamento</span>
            <DateInput type="date" showToday className="form-input" value={paidAt} onChange={(e) => {
                setPaidAt(e.target.value);
                if (linked && e.target.value !== spendDate(linked)) setLinked(null);
              }}
            />
          </label>
        </div>

        {month.payments.length > 0 && (
          <div className="mapping-pay-history">
            <span className="mapping-pay-history-title">Pagamentos deste mês</span>
            <ul>
              {month.payments.map((p) => (
                <li key={p.id}>
                  <span>{formatDate(p.paidAt)}</span>
                  {p.amount > 0.005 ? <strong>{formatBRL(p.amount)}</strong> : <strong>Previsto desconsiderado</strong>}
                  {p.waived > 0.005 && <small title="Parte do previsto descartada neste lançamento"> −{formatBRL(p.waived)} previsto</small>}
                  <button
                    type="button"
                    className="mapping-pay-undo"
                    title="Desfazer este pagamento"
                    aria-label="Desfazer este pagamento"
                    onClick={() =>
                      confirm({
                        title: 'Desfazer pagamento',
                        message:
                          p.amount > 0.005
                            ? `O pagamento de ${formatBRL(p.amount)} em ${formatDate(p.paidAt)} volta a ficar em aberto no previsto.${p.movementId ? ' O gasto associado deixa de estar ligado ao mapeamento.' : ''}`
                            : `${formatBRL(p.waived)} desconsiderados em ${formatDate(p.paidAt)} voltam ao previsto.`,
                        confirmLabel: 'Desfazer',
                        onConfirm: () => {
                          apply(removeMappingPayment(scope, monthKey, p.id));
                          if (p.movementId) updateMovement(p.movementId, { mappingId: undefined, mappingItemId: undefined });
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
            {month.pending > 0.005 && (
              <button
                type="button"
                className="btn btn-outline mapping-pay-discard"
                title="Tira a compra prevista da semana do previsto, sem lançar pagamento"
                onClick={() =>
                  confirm({
                    title: 'Desconsiderar previsto',
                    message: `A compra prevista de ${target.title} na semana de ${formatDate(weekRange.from)} a ${formatDate(weekRange.to)} deixa de contar no previsto. Nenhum pagamento é lançado.`,
                    confirmLabel: 'Desconsiderar',
                    variant: 'warning',
                    onConfirm: discardWeek,
                  })
                }
              >
                Desconsiderar previsto
              </button>
            )}
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
