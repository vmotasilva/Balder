import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { getBankBranding } from '../utils/bankBranding';
import { parseMoney } from '../utils/parseDecimal';
import { defaultClosingDay } from '../utils/setupCatalog';
import { firstInvoiceDueDate } from '../utils/cardPurchase';
import { findMappingItemForTitle } from '../utils/mappingMatch';
import { userNatures } from '../utils/baseNatures';
import { matchNatureForTransaction } from '../services/invoiceFileParser';
import type { CopilotPendingConfirmation, PaymentWizardState } from '../types';
import { DateInput } from './DateInput';

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
  const { accounts, cards, banks, natures, setBankInvoiceTerms, updatePaymentWizard, confirmPaymentWizard, cancelPaymentWizard } = useFinancial();
  const wizard = pending.wizard as PaymentWizardState;
  const data = pending.pendingData;
  const isIncome = data.type === 'RECEBER';
  const go = (patch: Partial<PaymentWizardState>) => updatePaymentWizard(messageId, patch);

  const [amountText, setAmountText] = useState(String(data.amount).replace('.', ','));
  const [customInstallments, setCustomInstallments] = useState('');
  const [termsDue, setTermsDue] = useState(10);
  const [termsClosing, setTermsClosing] = useState(defaultClosingDay(10));
  const [closingTouched, setClosingTouched] = useState(false);
  const [termsFromSummary, setTermsFromSummary] = useState(false);

  // Pagamento: um banco por vez; recebimento: a conta que recebe
  const institutions = isIncome
    ? accounts.map((a) => ({ name: a.name, color: getBankBranding(a.bankName || a.name).primaryColor, noCredit: false }))
    : listPaymentInstitutions(accounts, cards, banks).map((i) => ({ name: i.name, color: i.color, noCredit: i.noCredit }));

  // Despesa: a Forseti sugere natureza e item do teto pelo nome; a pessoa confirma ou troca no resumo
  const ownNatures = userNatures(natures);
  useEffect(() => {
    if (isIncome || wizard.step !== 'SUMMARY' || data.natureId !== undefined) return;
    const item = findMappingItemForTitle(data.rawTitle, ownNatures);
    if (item) {
      updatePaymentWizard(messageId, undefined, { natureId: item.natureId, mappingItemId: item.itemId });
      return;
    }
    const m = matchNatureForTransaction(data.rawTitle, undefined, ownNatures);
    updatePaymentWizard(messageId, undefined, { natureId: m.natureId !== 'OUTROS' && m.confidence >= 0.9 ? m.natureId : '', mappingItemId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.step]);
  const chosenNature = ownNatures.find((n) => n.id === data.natureId);
  const natureItems = (chosenNature?.mappings || []).flatMap((mp) => (mp.items || []).map((it) => ({ id: it.id, label: `${mp.name} › ${it.description}` })));

  const back = () => {
    if (wizard.step === 'BANK') go({ step: 'WHERE', where: undefined });
    else if (wizard.step === 'METHOD') go({ step: 'BANK' });
    else if (wizard.step === 'INVOICE') go({ step: termsFromSummary ? 'SUMMARY' : 'METHOD' });
    else if (wizard.step === 'INSTALLMENTS') go({ step: 'METHOD' });
    else if (wizard.step === 'SUMMARY') go({ step: 'WHERE', where: undefined, institution: undefined, method: undefined, installments: 1 });
  };

  const credit = wizard.method === 'CREDITO';
  const terms = credit ? listPaymentInstitutions(accounts, cards, banks).find((i) => i.name === wizard.institution)?.terms : undefined;
  const invoiceDue = terms ? firstInvoiceDueDate(data.dueDate, terms.closingDay, terms.dueDay) : '';

  // Fechamento e vencimento são do banco: ficam guardados nele e valem para todas as compras no crédito
  const openTerms = (fromSummary: boolean, extra: Partial<PaymentWizardState> = {}) => {
    setTermsFromSummary(fromSummary);
    setTermsDue(terms?.dueDay ?? 10);
    setTermsClosing(terms?.closingDay ?? defaultClosingDay(terms?.dueDay ?? 10));
    setClosingTouched(!!terms);
    go({ ...extra, step: 'INVOICE' });
  };
  const saveTerms = () => {
    setBankInvoiceTerms(wizard.institution || '', { closingDay: termsClosing, dueDay: termsDue });
    go({ step: termsFromSummary ? 'SUMMARY' : 'INSTALLMENTS' });
  };
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
          {wizard.step === 'INVOICE' && `Fatura do ${wizard.institution}`}
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
              onClick={() => go(i.noCredit && !isIncome ? { institution: i.name, method: 'DEBITO', installments: 1, step: 'SUMMARY' } : { institution: i.name, step: isIncome ? 'SUMMARY' : 'METHOD' })}
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
          <button
            type="button"
            onClick={() => {
              if (terms) go({ method: 'CREDITO', step: 'INSTALLMENTS' });
              else openTerms(false, { method: 'CREDITO' });
            }}
          >
            💳 Crédito
          </button>
        </div>
      )}

      {wizard.step === 'INVOICE' && (
        <>
          <span className="pay-wizard-hint">Em que dia a fatura fecha e vence? Vale para todas as compras no crédito deste banco.</span>
          <dl className="pay-wizard-summary">
            <div className="pay-wizard-field">
              <dt>Fecha dia</dt>
              <dd>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={termsClosing}
                  onChange={(e) => {
                    setClosingTouched(true);
                    setTermsClosing(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)));
                  }}
                />
              </dd>
            </div>
            <div className="pay-wizard-field">
              <dt>Vence dia</dt>
              <dd>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={termsDue}
                  onChange={(e) => {
                    const d = Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1));
                    setTermsDue(d);
                    if (!closingTouched) setTermsClosing(defaultClosingDay(d));
                  }}
                />
              </dd>
            </div>
          </dl>
          {!closingTouched && <span className="pay-wizard-hint">Fechamento estimado (uma semana antes do vencimento): confira no app do banco.</span>}
          <div className="pay-wizard-actions">
            <button type="button" className="pay-wizard-confirm" onClick={saveTerms}>
              Continuar
            </button>
          </div>
        </>
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
              <DateInput type="date" value={data.dueDate} onChange={(e) => e.target.value && updatePaymentWizard(messageId, undefined, { dueDate: e.target.value })} />
            </dd>
            {!isIncome && (
              <>
                <dt>Natureza</dt>
                <dd>
                  <select
                    value={data.natureId || ''}
                    onChange={(e) => updatePaymentWizard(messageId, undefined, { natureId: e.target.value, mappingItemId: '' })}
                    aria-label="Natureza do gasto"
                  >
                    <option value="">Sem natureza</option>
                    {ownNatures.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </dd>
                {natureItems.length > 0 && (
                  <>
                    <dt>Item do teto</dt>
                    <dd>
                      <select
                        value={data.mappingItemId || ''}
                        onChange={(e) => updatePaymentWizard(messageId, undefined, { mappingItemId: e.target.value })}
                        aria-label="Item do teto"
                      >
                        <option value="">Sem item</option>
                        {natureItems.map((it) => (
                          <option key={it.id} value={it.id}>{it.label}</option>
                        ))}
                      </select>
                    </dd>
                  </>
                )}
              </>
            )}
            <dt>{isIncome ? 'Conta' : 'Pago com'}</dt>
            <dd className="pay-wizard-edit-row">
              <span>{payLabel}</span>
              <button type="button" className="pay-wizard-link" onClick={back}>
                Alterar
              </button>
            </dd>
            {credit && terms && (
              <>
                <dt>Fatura</dt>
                <dd className="pay-wizard-edit-row">
                  <span>
                    Fecha dia {terms.closingDay} · vence {invoiceDue.slice(8, 10)}/{invoiceDue.slice(5, 7)}
                  </span>
                  <button type="button" className="pay-wizard-link" onClick={() => openTerms(true)}>
                    Alterar
                  </button>
                </dd>
              </>
            )}
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
