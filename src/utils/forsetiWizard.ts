import type { CopilotInteractiveOption, PaymentWizardState } from '../types';
import { CASH_IN_HAND } from './cashInHand';
import { stripAccents } from './forsetiMoney';
import type { PaymentInstitution } from './paymentInstitutions';

/**
 * A opção de pagamento tocada na lista ("Nubank (conta / Pix)", "Itaú", "Dinheiro em mãos") como o passo "resumo" do
 * registro em etapas. Assim um agendamento nunca é gravado só pelo toque: antes aparece o "Confira o agendamento".
 * Devolve undefined para o que não é uma forma de pagamento da lista.
 */
export function wizardForPaymentOption(
  option: Pick<CopilotInteractiveOption, 'id' | 'payload'>,
  institutions: PaymentInstitution[],
  installments = 1
): PaymentWizardState | undefined {
  const bank = option.payload.bank;
  if (!option.id.startsWith('opt_pay_') || !bank) return undefined;
  if (bank === CASH_IN_HAND) return { step: 'SUMMARY', where: 'CASH', installments: 1 };

  if (option.payload.type === 'CARTAO') {
    // Pelo cartão da opção; um cartão recém-cadastrado tem outro identificador na opção, então vale o nome do banco
    const byId = institutions.find((i) => i.card && option.id === `opt_pay_card_${i.card.id}`);
    const byName = institutions.find((i) => i.card && stripAccents(i.name) === stripAccents(bank));
    return { step: 'SUMMARY', where: 'BANK', institution: (byId || byName)?.name ?? bank, method: 'CREDITO', installments: Math.max(1, installments) };
  }
  const account = institutions.find((i) => i.account && option.id === `opt_pay_${i.account.id}`);
  return { step: 'SUMMARY', where: 'BANK', institution: account?.name ?? bank, method: 'DEBITO', installments: 1 };
}
