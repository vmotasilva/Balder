import type { BankAccount, BankInstitution, CreditCardItem, Movement } from '../types';
import { canonicalBankName, listPaymentInstitutions } from './paymentInstitutions';
import { invoiceClosingDate, monthDateKeepingDay } from './cardPurchase';

/** Dia anterior a uma data AAAA-MM-DD. */
export const dayBefore = (iso: string): string => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const prev = new Date(y, m - 1, d - 1);
  return monthDateKeepingDay(prev.getFullYear(), prev.getMonth(), prev.getDate());
};

export interface OpenInvoiceCheck {
  invoice: Movement;
  /** Dia em que a fatura fecha. */
  closingDate: string;
  /** Último dia em que uma compra ainda entra nela (um dia antes do fechamento). */
  lastPurchaseDate: string;
  /** Dias até o fechamento a partir de hoje. */
  daysToClosing: number;
}

export interface BankClosingCheck {
  bank: string;
  closingDay?: number;
  dueDay?: number;
  /** O fechamento não foi cadastrado de fato (veio estimado pelo vencimento). */
  closingMissing: boolean;
  /** Fatura em aberto que ainda não fechou e pode crescer. */
  open?: OpenInvoiceCheck;
  /** Compras do mês feitas a partir do fechamento: já pertencem à fatura seguinte. */
  afterClosing: { count: number; total: number };
  /** Faturas previstas (não pagas) que vencem no mês fechado. */
  unpaidDueInMonth: Movement[];
}

const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86400000);

/** Pontos a conferir por banco ao fechar a competência `monthKey` (AAAA-MM). */
export function buildMonthClosingChecks(
  monthKey: string,
  movements: Movement[],
  accounts: BankAccount[],
  cards: CreditCardItem[],
  banks: BankInstitution[],
  today: string
): BankClosingCheck[] {
  const institutions = listPaymentInstitutions(accounts, cards, banks).filter((i) => !i.noCredit);
  const invoices = movements.filter((m) => m.type === 'CARTAO' && m.status !== 'CANCELADA');
  const result: BankClosingCheck[] = [];

  institutions.forEach((inst) => {
    const mine = invoices.filter((m) => canonicalBankName(m.bank, banks, cards).toLowerCase() === inst.name.toLowerCase());
    if (mine.length === 0 && !inst.card) return;
    const bankRec = banks.find((b) => b.name.trim().toLowerCase() === inst.name.toLowerCase());
    const closingDay = inst.terms?.closingDay;
    const dueDay = inst.terms?.dueDay;
    // Fechamento "real": informado no banco ou no cartão com ambos os dias
    const closingMissing = !closingDay || (!bankRec?.closingDay && !inst.card?.closingDay);

    // Primeira fatura prevista cujo fechamento ainda não chegou
    const open = mine
      .filter((m) => m.status === 'PREVISTA')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((invoice) => {
        const closingDate = invoiceClosingDate(invoice.dueDate, closingDay, dueDay);
        return { invoice, closingDate, lastPurchaseDate: dayBefore(closingDate), daysToClosing: diffDays(closingDate, today) };
      })
      .find((o) => o.daysToClosing > 0);

    // Compras do mês feitas do fechamento em diante
    let count = 0;
    let total = 0;
    if (closingDay) {
      mine.forEach((inv) =>
        (inv.invoiceBreakdown || []).forEach((it) => {
          if (!it.purchaseDate || !it.purchaseDate.startsWith(monthKey)) return;
          if ((it.installments ?? 1) > 1 && (it.currentInstallment ?? 1) > 1) return;
          if (parseInt(it.purchaseDate.slice(8, 10), 10) >= closingDay) {
            count += 1;
            total += it.amount;
          }
        })
      );
    }

    result.push({
      bank: inst.name,
      closingDay,
      dueDay,
      closingMissing,
      open,
      afterClosing: { count, total: Math.round(total * 100) / 100 },
      unpaidDueInMonth: mine.filter((m) => m.status === 'PREVISTA' && m.dueDate.startsWith(monthKey)),
    });
  });
  return result;
}

/** Soma `extra` à fatura prevista (valor e parte ainda sem detalhar), para a previsão já sair realista. */
export const invoiceWithExtra = (invoice: Movement, extra: number): Partial<Movement> => {
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    amount: round(invoice.amount + extra),
    unanalyzedAmount: round((invoice.unanalyzedAmount ?? 0) + extra),
    category: 'Não Analisada',
  };
};
