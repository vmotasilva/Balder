import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { getBankBranding } from '../utils/bankBranding';
import { parseMoney } from '../utils/parseDecimal';
import { firstInvoiceDueDate, todayIso } from '../utils/cardPurchase';
import { findMappingForTitle, findMappingItemForTitle } from '../utils/mappingMatch';
import { userNatures } from '../utils/baseNatures';
import { scheduleNote } from '../utils/forsetiAssistant';
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
  const { accounts, cards, banks, movements, natures, setBankInvoiceTerms, updatePaymentWizard, confirmPaymentWizard, cancelPaymentWizard } = useFinancial();
  const wizard = pending.wizard as PaymentWizardState;
  const data = pending.pendingData;
  const isIncome = data.type === 'RECEBER';
  // Agendamento (previsto numa data): o resumo precisa dizer que ainda não aconteceu
  const scheduled = data.status === 'PREVISTA';
  const go = (patch: Partial<PaymentWizardState>) => updatePaymentWizard(messageId, patch);

  const [amountText, setAmountText] = useState(String(data.amount).replace('.', ','));
  const [customInstallments, setCustomInstallments] = useState('');
  const [invoiceInput, setInvoiceInput] = useState('');
  // Veio do resumo (Alterar a fatura): depois dela volta ao resumo
  const [termsFromSummary, setTermsFromSummary] = useState(false);

  // Pagamento: um banco por vez; recebimento: a conta que recebe
  const institutions = isIncome
    ? accounts.map((a) => ({ name: a.name, color: getBankBranding(a.bankName || a.name).primaryColor, noCredit: false, terms: undefined }))
    : listPaymentInstitutions(accounts, cards, banks, movements).map((i) => ({ name: i.name, color: i.color, noCredit: i.noCredit, terms: i.terms }));

  // Despesa: a Forseti sugere natureza e item do teto pelo nome; a pessoa confirma ou troca no resumo
  const ownNatures = userNatures(natures);
  useEffect(() => {
    if (isIncome || wizard.step !== 'SUMMARY' || data.natureId !== undefined) return;
    const item = findMappingItemForTitle(data.rawTitle, ownNatures);
    if (item) {
      updatePaymentWizard(messageId, undefined, { natureId: item.natureId, mappingId: item.mappingId, mappingItemId: item.itemId });
      return;
    }
    // Mapeamento sem itens (ou que não bate com nenhum item): liga pelo nome ou pelas palavras-chave dele
    const mapping = findMappingForTitle(data.rawTitle, ownNatures);
    if (mapping) {
      updatePaymentWizard(messageId, undefined, { natureId: mapping.natureId, mappingId: mapping.mappingId, mappingItemId: '' });
      return;
    }
    const m = matchNatureForTransaction(data.rawTitle, undefined, ownNatures);
    updatePaymentWizard(messageId, undefined, { natureId: m.natureId !== 'OUTROS' && m.confidence >= 0.9 ? m.natureId : '', mappingId: '', mappingItemId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.step]);
  const chosenNature = ownNatures.find((n) => n.id === data.natureId);
  // Os itens só compõem o previsto: o vínculo é com o mapeamento (inclusive os que ainda não têm itens)
  const natureMappings = chosenNature?.mappings || [];
  const chosenMappingId =
    data.mappingId ||
    natureMappings.find((mp) => data.mappingItemId && (mp.items || []).some((it) => it.id === data.mappingItemId))?.id ||
    '';
  const chooseMapping = (mappingId: string) =>
    updatePaymentWizard(messageId, undefined, { mappingId, mappingItemId: '' });

  const back = () => {
    if (wizard.step === 'BANK') go({ step: 'WHERE', where: undefined });
    else if (wizard.step === 'METHOD') go({ step: 'BANK' });
    else if (wizard.step === 'DATE') go({ step: 'BANK' });
    else if (wizard.step === 'INVOICE') go({ step: termsFromSummary ? 'SUMMARY' : 'DATE' });
    else if (wizard.step === 'INSTALLMENTS') go({ step: 'DATE' });
    else if (wizard.step === 'SUMMARY') go({ step: 'WHERE', where: undefined, institution: undefined, method: undefined, installments: 1 });
  };

  const credit = wizard.method === 'CREDITO';
  const terms = credit ? listPaymentInstitutions(accounts, cards, banks, movements).find((i) => i.name === wizard.institution)?.terms : undefined;
  // A fatura da compra: a que a pessoa informou ou, havendo fechamento e vencimento do banco, a calculada pela data da compra
  const invoiceDue = wizard.invoiceDueDate || (terms ? firstInvoiceDueDate(data.dueDate, terms.closingDay, terms.dueDay) : '');
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  // Depois da data (e da fatura, se preciso): parcelas, ou o resumo quando já veio parcelado
  const afterInvoice = () => go({ step: termsFromSummary || wizard.installments > 1 ? 'SUMMARY' : 'INSTALLMENTS' });
  const openInvoice = (fromSummary: boolean) => {
    setTermsFromSummary(fromSummary);
    setInvoiceInput(invoiceDue);
    go({ step: 'INVOICE' });
  };
  const confirmDate = () => {
    setTermsFromSummary(false);
    if (terms) {
      go({ invoiceDueDate: undefined, step: wizard.installments > 1 ? 'SUMMARY' : 'INSTALLMENTS' });
      return;
    }
    // Banco sem fechamento e vencimento: pergunta só em que fatura a compra caiu
    setInvoiceInput(wizard.invoiceDueDate || '');
    go({ step: 'INVOICE' });
  };
  const pickCredit = (name: string) => {
    setTermsFromSummary(false);
    go({ institution: name, method: 'CREDITO', invoiceDueDate: undefined, step: 'DATE' });
  };
  const saveInvoice = () => {
    if (!invoiceInput) return;
    // Só o dia do vencimento vira dado do banco; o fechamento real ele não informou
    if (!terms) setBankInvoiceTerms(wizard.institution || '', { dueDay: parseInt(invoiceInput.slice(8, 10), 10) });
    go({ invoiceDueDate: invoiceInput });
    afterInvoice();
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
          {wizard.step === 'WHERE' && (isIncome ? (scheduled ? 'Onde o dinheiro vai entrar?' : 'Onde o dinheiro entrou?') : scheduled ? 'Como você vai pagar?' : 'Como você pagou?')}
          {wizard.step === 'BANK' && (isIncome ? 'Em qual conta?' : 'Qual banco?')}
          {wizard.step === 'METHOD' && `${wizard.institution}: débito ou crédito?`}
          {wizard.step === 'DATE' && 'Quando foi a compra?'}
          {wizard.step === 'INVOICE' && `Em qual fatura do ${wizard.institution}?`}
          {wizard.step === 'INSTALLMENTS' && 'Em quantas vezes?'}
          {wizard.step === 'SUMMARY' && (scheduled ? 'Confira o agendamento' : 'Confira e confirme')}
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
              onClick={() =>
                !isIncome && wizard.method === 'CREDITO' && !i.noCredit
                  ? pickCredit(i.name)
                  : go(i.noCredit && !isIncome ? { institution: i.name, method: 'DEBITO', installments: 1, step: 'SUMMARY' } : { institution: i.name, step: isIncome ? 'SUMMARY' : 'METHOD' })
              }
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
            onClick={() => pickCredit(wizard.institution || '')}
          >
            💳 Crédito
          </button>
        </div>
      )}

      {wizard.step === 'DATE' && (
        <>
          <span className="pay-wizard-hint">É a data da compra que define em qual fatura ela cai. Pode ser de outro dia, não só de hoje.</span>
          <DateInput
            type="date"
            showToday
            value={data.dueDate}
            max={todayIso()}
            onChange={(e) => e.target.value && updatePaymentWizard(messageId, undefined, { dueDate: e.target.value })}
          />
          {terms && data.dueDate && (
            <span className="pay-wizard-hint">Cai na fatura que vence em {ddmm(firstInvoiceDueDate(data.dueDate, terms.closingDay, terms.dueDay))}.</span>
          )}
          <div className="pay-wizard-actions">
            <button type="button" className="pay-wizard-confirm" onClick={confirmDate} disabled={!data.dueDate}>
              Continuar
            </button>
          </div>
        </>
      )}

      {wizard.step === 'INVOICE' && (
        <>
          <span className="pay-wizard-hint">
            {terms
              ? 'Informe o vencimento da fatura em que esta compra entrou.'
              : `Compra de ${ddmm(data.dueDate)}. Ainda não sei o fechamento deste banco: em qual fatura ela caiu? Informe o vencimento dela, que está no app do banco.`}
          </span>
          <DateInput type="date" value={invoiceInput} onChange={(e) => setInvoiceInput(e.target.value)} />
          <div className="pay-wizard-actions">
            <button type="button" className="pay-wizard-confirm" onClick={saveInvoice} disabled={!invoiceInput || invoiceInput < data.dueDate}>
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
          {scheduled && <p className="pay-wizard-note">{scheduleNote(isIncome, data.dueDate)}</p>}
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
            <dt>{credit ? 'Data da compra' : scheduled ? 'Agendado para' : isIncome ? 'Data' : 'Data do pagamento'}</dt>
            <dd>
              <DateInput type="date" showToday={!credit && !isIncome} value={data.dueDate} onChange={(e) => {
                  if (!e.target.value) return;
                  // Outra data da compra pode cair em outra fatura: com o fechamento do banco, o cálculo volta a valer
                  if (terms) go({ invoiceDueDate: undefined });
                  updatePaymentWizard(messageId, undefined, { dueDate: e.target.value });
                }} />
            </dd>
            {!isIncome && (
              <>
                <dt>Natureza</dt>
                <dd>
                  <select
                    value={data.natureId || ''}
                    onChange={(e) => updatePaymentWizard(messageId, undefined, { natureId: e.target.value, mappingId: '', mappingItemId: '' })}
                    aria-label="Natureza do gasto"
                  >
                    <option value="">Sem natureza</option>
                    {ownNatures.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </dd>
                {natureMappings.length > 0 && (
                  <>
                    <dt>Mapeamento</dt>
                    <dd>
                      <select
                        value={chosenMappingId}
                        onChange={(e) => chooseMapping(e.target.value)}
                        aria-label="Mapeamento do teto"
                      >
                        <option value="">Sem mapeamento</option>
                        {natureMappings.map((mp) => (
                          <option key={mp.id} value={mp.id}>{mp.name}</option>
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
            {credit && invoiceDue && (
              <>
                <dt>Fatura</dt>
                <dd className="pay-wizard-edit-row">
                  <span>Vence em {ddmm(invoiceDue)}</span>
                  <button type="button" className="pay-wizard-link" onClick={() => openInvoice(true)}>
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
              {scheduled ? 'Confirmar agendamento' : 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
