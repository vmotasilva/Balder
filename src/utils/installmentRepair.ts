import type { InvoiceNatureItemBreakdown, Movement } from '../types';

/**
 * Detecta compras parceladas com parcelas fora de ordem nas faturas de cartão (parcela repetida, renumerada
 * para "1/N" por uma conciliação antiga, ou fora do período) e monta o plano de correção.
 *
 * Premissa: a 1ª parcela cai no mês S e a k-ésima, k-1 meses depois. S é o início mais cedo que alguma parcela
 * indica (mês − (parcela−1)); linhas deslocadas por salvamentos antigos apontam para um início mais tarde.
 */
export interface InstallmentRepairInvoice {
  movement: Movement;
  items: InvoiceNatureItemBreakdown[];
  unanalyzedAmount: number;
  /** Fatura prevista que só tinha parcelas indevidas: pode ser excluída */
  remove: boolean;
}

export interface InstallmentRepairPlan {
  lines: string[];
  invoices: InstallmentRepairInvoice[];
}

const monthIdx = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return y * 12 + m;
};
const baseDesc = (d: string) => d.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
const br = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function planInstallmentRepair(movements: Movement[]): InstallmentRepairPlan {
  const cards = movements.filter((m) => m.type === 'CARTAO' && (m.invoiceBreakdown?.length ?? 0) > 0);
  const groups = new Map<string, { inv: Movement; it: InvoiceNatureItemBreakdown; N: number }[]>();
  for (const inv of cards) {
    for (const it of inv.invoiceBreakdown!) {
      const N = it.installments || 1;
      if (N < 2) continue;
      const key = `${baseDesc(it.description).toLowerCase()}|${N}|${(it.finalAmount ?? it.amount * N).toFixed(2)}`;
      const list = groups.get(key) ?? [];
      list.push({ inv, it, N });
      groups.set(key, list);
    }
  }

  const removed = new Set<string>();
  const renumbered = new Map<string, number>();
  const lines: string[] = [];
  for (const list of groups.values()) {
    const start = Math.min(...list.map((x) => monthIdx(x.inv.dueDate) - ((x.it.currentInstallment || 1) - 1)));
    for (const x of list) {
      const cur = x.it.currentInstallment || 1;
      const expected = monthIdx(x.inv.dueDate) - start + 1;
      if (cur === expected && expected >= 1 && expected <= x.N) continue;
      const twin = list.some((y) => y !== x && y.inv.id === x.inv.id && (y.it.currentInstallment || 1) === expected);
      const label = `${br(x.inv.dueDate)} · ${baseDesc(x.it.description)}`;
      if (expected < 1 || expected > x.N || twin) {
        removed.add(x.it.id);
        lines.push(`• ${label}: remover parcela ${cur}/${x.N} (${money(x.it.amount)}) — ${twin ? 'repetida' : 'fora do período'}`);
      } else {
        renumbered.set(x.it.id, expected);
        lines.push(`• ${label}: parcela ${cur}/${x.N} → ${expected}/${x.N}`);
      }
    }
  }

  const invoices: InstallmentRepairInvoice[] = [];
  for (const inv of cards) {
    const original = inv.invoiceBreakdown!;
    if (!original.some((it) => removed.has(it.id) || renumbered.has(it.id))) continue;
    const items = original
      .filter((it) => !removed.has(it.id))
      .map((it) => {
        const n = renumbered.get(it.id);
        return n === undefined ? it : { ...it, currentInstallment: n, description: it.description.replace(/\(\d+\/(\d+)\)\s*$/, `(${n}/$1)`) };
      });
    const allocated = items.reduce((s, it) => s + it.amount, 0);
    invoices.push({
      movement: inv,
      items,
      unanalyzedAmount: Math.max(0, Math.round((inv.amount - allocated) * 100) / 100),
      remove: items.length === 0 && inv.status === 'PREVISTA',
    });
  }
  return { lines, invoices };
}
