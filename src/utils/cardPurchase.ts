/** Vencimento (AAAA-MM-DD) da fatura que recebe uma compra feita em `purchaseDate`. */
export const firstInvoiceDueDate = (purchaseDate: string, closingDay?: number, dueDay?: number): string => {
  const [y, m, d] = purchaseDate.split('-').map((n) => parseInt(n, 10));
  const due = dueDay || 10;
  // Sem cartão cadastrado, assume fechamento 7 dias antes do vencimento
  const closing = closingDay || Math.max(1, due - 7);
  // Compra no dia do fechamento ou depois cai na fatura seguinte
  const closeMonthOffset = d >= closing ? 1 : 0;
  // Se o vencimento é depois do fechamento, vence no mesmo mês do fechamento; senão, no seguinte
  const dueMonthOffset = closeMonthOffset + (due > closing ? 0 : 1);
  return monthDateKeepingDay(y, m - 1 + dueMonthOffset, due);
};

/** Data do mês indicado (índice pode extrapolar), limitando o dia ao fim do mês. */
export const monthDateKeepingDay = (year: number, monthIndex: number, day: number): string => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const date = new Date(year, monthIndex, Math.min(day, lastDay));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Vencimentos das N faturas consecutivas a partir da primeira. */
export const invoiceDueDates = (firstDue: string, count: number): string[] => {
  const [y, m, d] = firstDue.split('-').map((n) => parseInt(n, 10));
  return Array.from({ length: count }, (_, i) => monthDateKeepingDay(y, m - 1 + i, d));
};
