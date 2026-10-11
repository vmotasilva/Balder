import type { Movement } from '../types';

// Auxiliares de valor e data usados pelas respostas da Forseti (módulo à parte para as respostas poderem
// ser divididas em arquivos sem dependência circular).

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const stripAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recebimentos (inclusive empréstimo recebido) não são gasto. */
export const isIncomeMovement = (m: Movement) => m.type === 'RECEBER' || (m.type === 'EMPRESTIMO' && m.category === 'Recebimento');
/** Dia em que a saída conta: o pagamento, se já aconteceu; senão o vencimento. */
export const outflowDate = (m: Movement) => (m.status === 'REALIZADA' && m.paymentDate ? m.paymentDate : m.dueDate);
export const outflowValue = (m: Movement) => (m.status === 'REALIZADA' ? m.actualAmount ?? m.amount : m.amount);
