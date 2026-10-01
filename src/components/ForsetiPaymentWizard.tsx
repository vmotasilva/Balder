import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { getBankBranding } from '../utils/bankBranding';
import { parseMoney } from '../utils/parseDecimal';
import type { CopilotPendingConfirmation, PaymentWizardState } from '../types';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const INSTALLMENT_CHOICES = [1, 2, 3, 4, 5, 6, 10, 12];

interface Props {
  messageId: string;
  pending: CopilotPendingConfirmation;
}

/**
 * Registro de pagamento (ou recebimento) em etapas curtas:
 * banco ou dinheiro → banco → débito ou crédito → parcelas → resumo editável.
 */
export const ForsetiPaymentWizard: React.FC<Props> = ({ messageId, pending }) => {
  const { accounts, cards, banks, updatePaymentWizard, confirmPaymentWizard, cancelPaymentWizard } = useFinancial();
  const wizard = pending.wizard as PaymentWizardState;
  const data = pending.pendingData;
  const isIncome = data.type === 'RECEBER';
  const go = (patch: Partial<PaymentWizardState>) => updatePaymentWizard(messageId, patch);

  const [amountText, setAmountText] = useState(String(data.amount).replace('.', ','));
  const [customInstallments, setCustomInstallments] = useState('');

  // Pagamento: um banco por vez; recebimento: a conta que recebe
  const institutions = isIncome
    ? accounts.map((a) => ({ name: a.name, color: getBankBranding(a.bankName || a.name).primaryColor }))
    : listPaymentInstitutions(accounts, cards, banks).map((i) => ({ name: i.name, color: i.color }));

  const back = () => {
    if (wizard.step === 'BANK') go({ step: 'WHERE', where: undefined });
    else if (wizard.step === 'METHOD') go({ step: 'BANK' });
    else if (wizard.step === 'INSTALLMENTS') go({ step: 'METHOD' });
    else if (wizard.step === 'SUMMARY') go({ step: 'WHERE', where: undefined, institution: undefined, method: undefined, installments: 1 });
  };

  const credit = wizard.method === 'CREDITO';
  const perInstallment = wizard.installments > 1 ? Math.round((data.amount / wizard.installments) * 100) / 100 : data.amount;
  const payLabel =
    wizard.where === 'CASH'
      ? 'Dinheiro em mãos'
      : isIncome
      ? wizard.institution || '—'
      : `${wizard.institution || '—'} · ${credit ? 'Crédito' : 'Débito'}`;

  return (
    <div className="pay-wizard animate-fade-in">
      <div className="pay-wizard-head">
        {wizard.step !== 'WHERE' && (
          <button type="button" className="pay-wizard-back" onClick={back} aria-label="Voltar uma etapa">
            <ArrowLeft size={14} />
          </button>
        )}
        <strong>
          {wizard.step === 'WHERE' && (isIncome ? 'Onde o dinheiro entrou?' : 'Como você pagou?')}
          {wizard.step === 'BANK' && (isIncome ? 'Em qual conta?' : 'Qual banco?')}
          {wizard.step === 'METHOD' && `${wizard.institution}: débito ou crédito?`}
          {wizard.step === 'INSTALLMENTS' && 'Em quantas vezes?'}
          {wizard.step === 'SUMMARY' && 'Confira e confirme'}
        </strong>
      </div>

      {wizard.step === 'WHERE' && (
        <div className="pay-wizard-choices">
          <button type="button" onClick={() => go({ step: 'BANK', where: 'BANK' })}>
            🏦 Banco
          </button>
          <button
            type="button"
            onClick={() => go({ step: 'SUMMARY', where: 'CASH', institution: undefined, method: undefined, installments: 1 })}
          >
            💵 Dinheiro em mãos
          </button>
        </div>
      )}

      {wizard.step === 'BANK' && (
        <div className="pay-wizard-chips">
          {institutions.length === 0 && <span className="pay-wizard-hint">Nenhum banco cadastrado ainda.</span>}
          {institutions.map((i) => (
            <button
              key={i.name}
              type="button"
              className="pay-wizard-bank"
              style={{ borderColor: i.color }}
              onClick={() => go({ institution: i.name, step: isIncome ? 'SUMMARY' : 'METHOD' })}
            >
              <span className="pay-wizard-dot" style={{ background: i.color }} />
              {i.name}
            </button>
          ))}
        </div>
      )}

      {wizard.step === 'METHOD' && (
        <div className="pay-wizard-choices">
          <button type="button" onClick={() => go({ method: 'DEBITO', installments: 1, step: 'SUMMARY' })}>
            Débito / Pix
          </button>
          <button type="button" onClick={() => go({ method: 'CREDITO', step: 'INSTALLMENTS' })}>
            💳 Crédito
          </button>
        </div>
      )}

      {wizard.step === 'INSTALLMENTS' && (
        <>
          <div className="pay-wizard-chips">
            {INSTALLMENT_CHOICES.map((n) => (
              <button key={n} type="button" className="pay-wizard-chip" onClick={() => go({ installments: n, step: 'SUMMARY' })}>
                {n === 1 ? 'À vista' : `${n}x`}
              </button>
            ))}
          </div>
          <div className="pay-wizard-custom">
            <span>Outro número:</span>
            <input
              type="number"
              min={2}
              max={72}
              value={customInstallments}
              onChange={(e) => setCustomInstallments(e.target.value)}
              aria-label="Número de parcelas"
            />
            <button
              type="button"
              className="pay-wizard-chip"
              disabled={!(parseInt(customInstallments, 10) >= 2)}
              onClick={() => go({ installments: Math.min(72, parseInt(customInstallments, 10)), step: 'SUMMARY' })}
            >
              Usar
            </button>
          </div>
        </>
      )}

      {wizard.step === 'SUMMARY' && (
        <>
          <dl className="pay-wizard-summary">
            <dt>Descrição</dt>
            <dd>
              <input value={data.rawTitle} onChange={(e) => updatePaymentWizard(messageId, undefined, { rawTitle: e.target.value })} />
            </dd>
            <dt>{credit && wizard.installments > 1 ? 'Valor total' : 'Valor'}</dt>
            <dd>
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => {
                  const v = parseMoney(amountText);
                  if (v > 0) updatePaymentWizard(messageId, undefined, { amount: v });
                  else setAmountText(String(data.amount).replace('.', ','));
                }}
              />
            </dd>
            <dt>{credit ? 'Data da compra' : isIncome ? 'Data' : 'Data do pagamento'}</dt>
            <dd>
              <input type="date" value={data.dueDate} onChange={(e) => e.target.value && updatePaymentWizard(messageId, undefined, { dueDate: e.target.value })} />
            </dd>
            <dt>{isIncome ? 'Conta' : 'Pago com'}</dt>
            <dd className="pay-wizard-edit-row">
              <span>{payLabel}</span>
              <button type="button" className="pay-wizard-link" onClick={back}>
                Alterar
              </button>
            </dd>
            {credit && (
              <>
                <dt>Parcelas</dt>
                <dd className="pay-wizard-edit-row">
                  <span>
                    {wizard.installments > 1 ? `${wizard.installments}x de ${brl(perInstallment)}` : 'À vista'}
                  </span>
                  <button type="button" className="pay-wizard-link" onClick={() => go({ step: 'INSTALLMENTS' })}>
                    Alterar
                  </button>
                </dd>
              </>
            )}
          </dl>
          <div className="pay-wizard-actions">
            <button type="button" className="pay-wizard-cancel" onClick={() => cancelPaymentWizard(messageId)}>
              Cancelar
            </button>
            <button type="button" className="pay-wizard-confirm" onClick={() => confirmPaymentWizard(messageId)}>
              Confirmar
            </button>
          </div>
        </>
      )}
    </div>
  );
};
