import type { ExpenseNature, FixedExpenseMapping, Movement } from '../types';

export interface PendingFixedBill {
  natureId: string;
  natureName: string;
  natureColor: string;
  mappingId: string;
  mappingName: string;
  mappingIcon?: string;
  dayOfMonth: number;
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  itemCount: number;
  itemDescriptions: string[];
  daysRemaining: number; // Negativo se vencida no mês, 0 se hoje, positivo se faltam X dias
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  category: string;
  items: FixedExpenseMapping['items'];
}

/**
 * Normaliza strings para comparação flexível de nomes/descrições
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Identifica quais mapeamentos de gastos fixos configurados com dia de vencimento (`dayOfMonth`)
 * ainda não foram pagos no mês corrente e requerem confirmação ou alerta do usuário.
 */
export function getPendingFixedBills(
  natures: ExpenseNature[],
  movements: Movement[] = [],
  referenceDate: Date = new Date(),
  lookaheadDays: number = 3 // Questiona a partir de X dias antes do vencimento
): PendingFixedBill[] {
  const year = referenceDate.getFullYear();
  const currentMonthNumber = referenceDate.getMonth() + 1; // 1..12
  const monthKey = `${year}-${String(currentMonthNumber).padStart(2, '0')}`;
  const daysInMonth = new Date(year, currentMonthNumber, 0).getDate();
  const todayDay = referenceDate.getDate();

  const pendingBills: PendingFixedBill[] = [];

  for (const nature of natures) {
    if (!nature.mappings || nature.mappings.length === 0) continue;

    for (const mapping of nature.mappings) {
      // Verifica se o mapeamento tem dia de vencimento configurado
      if (!mapping.dayOfMonth || mapping.dayOfMonth < 1) continue;

      // Verifica se o mapeamento se aplica ao mês corrente
      if (
        mapping.applicableMonths &&
        mapping.applicableMonths.length > 0 &&
        !mapping.applicableMonths.includes(currentMonthNumber)
      ) {
        continue;
      }

      // Calcula o valor total previsto do mapeamento
      const items = mapping.items || [];
      const totalAmount = items.reduce((acc, it) => acc + (it.totalValue || 0), 0);
      if (totalAmount <= 0) continue;

      // Verifica se todos os itens já estão marcados como fulfilled
      const allItemsFulfilled = items.length > 0 && items.every((it) => it.isFulfilled);
      if (allItemsFulfilled) {
        // Já realizado através do checklist de itens
        continue;
      }

      // Calcula o dia de vencimento no mês corrente
      const effectiveDueDay = Math.min(mapping.dayOfMonth, daysInMonth);
      const dueDateStr = `${monthKey}-${String(effectiveDueDay).padStart(2, '0')}`;

      // Verifica se já existe uma movimentação de pagamento realizada correspondente no mês
      const normMapName = normalizeText(mapping.name);
      const normNatName = normalizeText(nature.name);
      const normItemNames = items.map((it) => normalizeText(it.description));

      const hasMatchingMovement = movements.some((m) => {
        if (m.type === 'RECEBER') return false;
        if (m.status !== 'REALIZADA') return false;
        if (!m.dueDate.startsWith(monthKey)) return false;

        const normTitle = normalizeText(m.title);
        const normCat = normalizeText(m.category);
        const normNotes = normalizeText(m.notes || '');

        // 1. Categoria idêntica à natureza e título ou anotações citam o mapeamento
        const matchesNature = normCat === normNatName || normTitle.includes(normNatName);
        const matchesMapping =
          normTitle.includes(normMapName) ||
          normNotes.includes(normMapName) ||
          normItemNames.some((itName) => itName.length > 2 && normTitle.includes(itName));

        if (matchesNature && matchesMapping) return true;

        // 2. Se o título bate exatamente com o mapeamento (ex: "Coelba" ou "Vivo Fibra")
        if (normTitle.includes(normMapName) && normMapName.length > 2) return true;

        // 3. Se o item tem o mesmo nome do título e valor próximo (+- 20%)
        if (
          normItemNames.some((itName) => itName.length > 2 && normTitle.includes(itName)) &&
          Math.abs(m.amount - totalAmount) / totalAmount < 0.2
        ) {
          return true;
        }

        return false;
      });

      if (hasMatchingMovement) {
        // Já foi registrada uma movimentação de pagamento realizada correspondente
        continue;
      }

      // Dias restantes para o vencimento
      const daysRemaining = effectiveDueDay - todayDay;

      // Questiona se:
      // - Já venceu neste mês (daysRemaining < 0)
      // - Vence hoje (daysRemaining === 0)
      // - Vence nos próximos lookaheadDays dias (ex: 1, 2 ou 3 dias antes)
      if (daysRemaining <= lookaheadDays) {
        pendingBills.push({
          natureId: nature.id,
          natureName: nature.name,
          natureColor: nature.color || 'var(--color-cyan, #06b6d4)',
          mappingId: mapping.id,
          mappingName: mapping.name,
          mappingIcon: mapping.icon,
          dayOfMonth: effectiveDueDay,
          dueDate: dueDateStr,
          totalAmount,
          itemCount: items.length,
          itemDescriptions: items.map((it) => it.description),
          daysRemaining,
          isOverdue: daysRemaining < 0,
          isDueToday: daysRemaining === 0,
          isDueSoon: daysRemaining > 0 && daysRemaining <= lookaheadDays,
          category: nature.name,
          items,
        });
      }
    }
  }

  // Ordena prioritariamente por vencimento mais urgente (mais atrasadas ou mais próximas primeiro)
  return pendingBills.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
