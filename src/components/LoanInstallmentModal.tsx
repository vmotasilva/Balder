import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, RotateCcw, Zap } from 'lucide-react';
import { Modal } from './Modal';
import { InstallmentPaymentForm } from './InstallmentPaymentModal';
import { LoanPrepaymentModal } from './LoanPrepaymentModal';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { useFinancial } from '../context/FinancialContext';
import { calculatePresentValue, groupLoanMovements } from '../utils/loanMath';

interface LoanInstallmentModalProps {
  movementId: string;
  onClose: () => void;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * Manuseio de uma parcela de empréstimo a partir do detalhamento da competência: pagar (no vencimento ou
 * antecipado, com o desconto dos juros pela taxa do banco), reabrir e ver as demais parcelas do contrato.
 */
export const LoanInstallmentModal: React.FC<LoanInstallmentModalProps> = ({ movementId, onClose }) => {
  const { movements, updateMovement } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const [focusedId, setFocusedId] = useState(movementId);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const today = todayIso();
  const installment = movements.find((m) => m.id === focusedId);
  const group = useMemo(
    () => groupLoanMovements(movements).find((g) => g.allInstallments.some((m) => m.id === focusedId)),
    [movements, focusedId]
  );
  const rate = group?.interestRatePercent || 0;
  // Parcelas do contrato (sem a captação)
  const contractInstallments = (group?.allInstallments || []).filter((m) => m.category !== 'Recebimento');

  if (!installment) return null;

  const isPaid = installment.status === 'REALIZADA';
  const total = installment.installmentsTotal || group?.totalInstallmentsCount;
  const label = installment.installmentNumber
    ? `Parcela ${installment.installmentNumber}${total ? `/${total}` : ''}`
    : installment.title;
  const expected = installment.originalAmount ?? installment.amount;

  const reopen = () =>
    confirm({
      title: 'Reabrir parcela',
      message: `A ${label.toLowerCase()} volta a ficar em aberto, com o valor previsto e no mês do vencimento.`,
      confirmLabel: 'Reabrir',
      variant: 'warning',
      onConfirm: () =>
        updateMovement(installment.id, {
          status: 'PREVISTA',
          amount: installment.originalAmount ?? installment.amount,
          paymentDate: '',
        }),
    });

  return (
    <>
      <Modal
        isOpen={!simulatorOpen}
        onClose={onClose}
        title={label}
        subtitle={`${group?.title || installment.title}${installment.bank ? ` · ${installment.bank}` : ''}`}
        maxWidth="640px"
      >
        <div className="loan-inst-modal">
          {isPaid ? (
            <div className="loan-inst-paid">
              <div>
                <span className="badge badge-emerald loan-inst-badge">
                  <CheckCircle2 size={12} /> Paga
                </span>
                <p className="text-xs text-muted">
                  {formatBRL(installment.amount)}
                  {installment.paymentDate && <> em {formatDate(installment.paymentDate)}</>}
                  {Math.abs(expected - installment.amount) > 0.005 && (
                    <> · parcela de {formatBRL(expected)} (vencimento {formatDate(installment.dueDate)})</>
                  )}
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-xs" onClick={reopen}>
                <RotateCcw size={12} />
                <span>Reabrir</span>
              </button>
            </div>
          ) : (
            <>
              <p className="loan-inst-hint">
                <Zap size={13} /> Para antecipar, escolha a data do pagamento: o valor já sai com o desconto dos juros.
              </p>
              <InstallmentPaymentForm
                key={installment.id}
                installment={installment}
                monthlyRatePercent={rate}
                onClose={onClose}
                submitLabel="Confirmar pagamento"
                onConfirm={(paymentDate, amount) =>
                  updateMovement(installment.id, {
                    status: 'REALIZADA',
                    paymentDate,
                    amount,
                    actualAmount: amount,
                    originalAmount: installment.originalAmount ?? installment.amount,
                  })
                }
              />
            </>
          )}

          {contractInstallments.length > 1 && (
            <div className="loan-inst-contract">
              <div className="loan-inst-contract-head">
                <div>
                  <h4>Parcelas do contrato</h4>
                  {group && group.openInstallments.length > 0 && (
                    <span className="text-xs text-muted">
                      {group.openInstallments.length} em aberto · quitação hoje {formatBRL(group.presentValueToday)}
                      {group.totalImmediateSavings > 0 && <> (economia de {formatBRL(group.totalImmediateSavings)})</>}
                    </span>
                  )}
                </div>
                {group && group.openInstallments.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => setSimulatorOpen(true)}
                    title="Antecipar várias parcelas de uma vez (economia máxima, alívio de caixa, montante fixo ou quitação)"
                  >
                    <Zap size={12} />
                    <span>Simular antecipação</span>
                  </button>
                )}
              </div>

              <div className="loan-inst-table-wrap">
                <table className="loan-inst-table">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th className="th-right">Valor</th>
                      <th className="th-right">Se paga hoje</th>
                      <th className="th-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractInstallments.map((inst) => {
                      const paid = inst.status === 'REALIZADA';
                      const pv = paid ? null : calculatePresentValue(inst.amount, inst.dueDate, today, rate);
                      return (
                        <tr
                          key={inst.id}
                          className={`${inst.id === focusedId ? 'is-focused' : ''} ${paid ? 'is-paid' : ''}`}
                          onClick={() => setFocusedId(inst.id)}
                          title="Abrir esta parcela"
                        >
                          <td className="font-mono">
                            {inst.installmentNumber || '—'}/{inst.installmentsTotal || group?.totalInstallmentsCount}
                          </td>
                          <td className="font-mono">{formatDate(inst.dueDate)}</td>
                          <td className="th-right font-mono">{formatBRL(inst.amount)}</td>
                          <td className="th-right font-mono">
                            {pv ? (
                              <>
                                {formatBRL(pv.discountedAmount)}
                                {pv.discountAmount > 0 && (
                                  <small className="text-emerald"> −{formatBRL(pv.discountAmount)}</small>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="th-center">
                            {paid ? (
                              <span className="loan-inst-status paid">
                                <CheckCircle2 size={11} /> {inst.paymentDate ? formatDate(inst.paymentDate) : 'Paga'}
                              </span>
                            ) : (
                              <span className="loan-inst-status open">
                                <Clock size={11} /> Em aberto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {simulatorOpen && (
        <LoanPrepaymentModal
          isOpen
          onClose={() => setSimulatorOpen(false)}
          initialGroupId={group?.groupId}
          initialMovementId={installment.id}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </>
  );
};
