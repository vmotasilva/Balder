import type { MappingItem, Movement } from '../types';
import { isExcludedState, resolveMappingItemMonth } from './mappingItemState';

/** Um pagamento já feito dentro de um mapeamento, na competência. */
export interface MappingPaidEntry {
  id: string;
  date?: string;          // YYYY-MM-DD
  amount: number;
  text: string;           // texto do lançamento (ex.: o que foi dito à Forseti) ou o nome do item
  viaForseti: boolean;
  detail?: string;        // complemento (forma/banco ou observação)
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// A Forseti grava "Despesa: <texto>"; na lista interessa o texto
const cleanTitle = (title: string) => title.replace(/^(Despesa|Recebimento):\s*/i, '').trim();
const isForseti = (m?: Movement) => !!m && /forseti/i.test(m.notes || '');

/**
 * Pagamentos feitos nos itens do mapeamento na competência, um por lançamento. Pagamentos vindos de uma
 * movimentação mostram o título dela; os lançados direto no mapeamento (modo Resumo) aparecem uma vez só,
 * mesmo divididos entre os itens.
 */
export function collectMappingPaidEntries(items: MappingItem[], monthKey: string, movements: Movement[]): MappingPaidEntry[] {
  const used = new Set<string>();
  const entries = new Map<string, MappingPaidEntry>();

  // Movimentações realizadas ligadas ao item, para casar com pagamentos sem movementId (ex.: criados pela Forseti)
  const findMovement = (item: MappingItem, amount: number, paidAt: string, movementId?: string): Movement | undefined => {
    if (movementId) return movements.find((m) => m.id === movementId);
    return movements.find(
      (m) =>
        !used.has(m.id) &&
        m.type === 'PAGAR' &&
        m.status === 'REALIZADA' &&
        m.mappingItemId === item.id &&
        Math.abs((m.actualAmount ?? m.amount) - amount) < 0.01 &&
        (m.paymentDate || m.dueDate || '').slice(0, 7) === paidAt.slice(0, 7)
    );
  };

  items.forEach((item) => {
    const summary = resolveMappingItemMonth(item, monthKey);
    if (isExcludedState(summary.state)) return;

    summary.payments.forEach((p) => {
      if (p.mappingPaymentId) {
        const key = `mp_${p.mappingPaymentId}`;
        const cur = entries.get(key);
        if (cur) cur.amount = round2(cur.amount + p.amount);
        else entries.set(key, { id: key, date: p.paidAt, amount: round2(p.amount), text: 'Pagamento lançado no mapeamento', viaForseti: false });
        return;
      }
      const mv = findMovement(item, p.amount, p.paidAt, p.movementId);
      if (mv) used.add(mv.id);
      entries.set(`pay_${p.id}`, {
        id: `pay_${p.id}`,
        date: p.paidAt,
        amount: round2(p.amount),
        text: mv ? cleanTitle(mv.title) || item.description : item.description,
        viaForseti: isForseti(mv),
        detail: mv?.bank || undefined,
      });
    });

    // Item marcado como realizado sem pagamentos lançados: o previsto conta como pago
    if (summary.payments.length === 0 && summary.paid > 0) {
      entries.set(`real_${item.id}`, {
        id: `real_${item.id}`,
        amount: round2(summary.paid),
        text: item.description,
        viaForseti: false,
        detail: 'Marcado como realizado',
      });
    }
  });

  return [...entries.values()].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}
