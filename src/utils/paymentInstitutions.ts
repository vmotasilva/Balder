import type { BankAccount, BankInstitution, CreditCardItem } from '../types';
import { getBankBranding } from './bankBranding';

export interface PaymentInstitution {
  name: string;
  color: string;
  /** Conta (débito / Pix) do banco, quando houver. */
  account?: BankAccount;
  /** Cartão de crédito do banco, quando houver. */
  card?: CreditCardItem;
  /** Fechamento e vencimento da fatura do banco; vem do próprio banco e, na falta, do cartão dele. */
  terms?: { closingDay: number; dueDay: number };
}

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Cada banco uma única vez, com a conta e o cartão dele (só o nome, com a cor da marca). */
export function listPaymentInstitutions(accounts: BankAccount[], cards: CreditCardItem[], banks: BankInstitution[]): PaymentInstitution[] {
  const names: string[] = [];
  const add = (n?: string) => {
    if (n && n.trim() && !names.some((x) => same(x, n))) names.push(n.trim());
  };
  banks.forEach((b) => add(b.name));
  cards.forEach((c) => add(c.bank));
  accounts.forEach((a) => {
    const known = names.find((n) => a.name.toLowerCase().includes(n.toLowerCase()));
    add(a.bankName || known || a.name);
  });
  const debitTypes = ['CORRENTE', 'CARTEIRA', 'OUTRO'];
  return names.map((name) => {
    const accountsOfBank = accounts.filter((a) => same(a.bankName, name) || a.name.toLowerCase().includes(name.toLowerCase()));
    const bank = banks.find((b) => same(b.name, name));
    const card = cards.find((c) => same(c.bank, name) || same(c.name, name));
    return {
      name,
      color: getBankBranding(name).primaryColor,
      terms: bank?.closingDay && bank?.dueDay ? { closingDay: bank.closingDay, dueDay: bank.dueDay } : card ? { closingDay: card.closingDay, dueDay: card.dueDay } : undefined,
      account: accountsOfBank.find((a) => debitTypes.includes(a.type)) || accountsOfBank[0],
      card,
    };
  });
}
