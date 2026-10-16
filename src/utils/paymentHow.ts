/** Como um pagamento foi feito (mesmas escolhas da Forseti): dinheiro em mãos, débito no banco ou crédito no banco. */
export type PaymentHow =
  | { where: 'CASH' }
  | { where: 'BANK'; institution: string; method: 'DEBITO' | 'CREDITO'; installments: number };

export const INSTALLMENT_CHOICES = [1, 2, 3, 4, 5, 6, 10, 12];
