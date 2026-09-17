import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFinancial } from '../context/FinancialContext';
import {
  X,
  CreditCard,
  Building2,
  ShieldCheck,
  Receipt,
  DollarSign,
  Landmark,
  Layers,
  ArrowUpRight,
  Info,
  Search,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import type { MonthlyGridProjectionRow, MappingItem } from '../types';


export interface GridCellSelection {
  columnKey:
    | 'extras'
    | 'salary'
    | 'creditCard'
    | 'fixedCost'
    | 'variableCost'
    | 'loanReceived'
    | 'loanPayment'
    | 'monthNet'
    | 'accumulated'
    | 'totalIncome'
    | 'totalExpense';
  columnTitle: string;
  competenceLabel: string;
  formattedCompetence: string;
  totalValue: number;
  row: MonthlyGridProjectionRow;
  initialNatureId?: string;
  initialNatureName?: string;
}

interface GridCellDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection: GridCellSelection | null;
}

export const ATYPICAL_KEYWORD_REGEX =
  /\b(avulso|avulsa|avulsos|avulsas|não-recorrente|nao-recorrente|não recorrente|nao recorrente|imprevisto|imprevista|imprevistos|imprevistas|pontual|pontuais|atípico|atipico|atípica|atipica|atípicos|atipicos|extra|extras|emergência|emergencia|excepcional|anomalia)\b/i;

export interface CellBreakdownSubItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  multiplierWeeks: number;
  totalValue: number;
  paymentMethod?: string;
  cardName?: string;
  mappingName?: string;
  isAtypical?: boolean;
  isTopOffender?: boolean;
  attentionReason?: string;
}

export interface CellDateGroup {
  id: string;
  dateStr: string;        // ex: '2026-09-05'
  dateFormatted: string;  // ex: '05/09/2026 (Sábado)'
  eventTitle: string;     // ex: '1ª Semana — Feira Livre & Hortifrúti'
  periodType: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'PONTUAL';
  subtotal: number;
  items: CellBreakdownSubItem[];
}


export interface CellBreakdownItem {
  id: string;
  category: string;
  bankOrOrigin: string;
  title: string;
  notes?: string;
  badge?: string;
  badgeType?: 'cyan' | 'emerald' | 'amber' | 'purple' | 'slate' | 'rose';
  amount: number;
  dateOrDue?: string;
  isProjected?: boolean;
  subItems?: CellBreakdownSubItem[];
  dateGroups?: CellDateGroup[];
  hasAttentionPoint?: boolean;
  attentionType?: 'OVER_CEILING' | 'ATYPICAL';
  attentionMessage?: string;
}

/**
 * Motor contábil que gera agrupamentos inteligentes por Data de Gasto dentro da Natureza.
 * Exemplo: se uma pessoa faz feira toda semana e compra de estoque mensal,
 * calcula os sábados do mês e a data do supermercado, agrupando os itens de cada dia.
 */
export function generateNatureDateGroups(
  competence: string,
  natureName: string,
  items: Array<{
    natureName: string;
    natureColor: string;
    mappingName: string;
    item: MappingItem;
  }>
): CellDateGroup[] {
  const parts = competence.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 9; // 1-indexed

  // Encontrar os sábados daquele mês
  const saturdays: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    if (dateObj.getDay() === 6) { // 6 = Sábado
      saturdays.push(d);
    }
  }
  if (saturdays.length === 0) {
    saturdays.push(5, 12, 19, 26);
  }

  const formatDay = (day: number) => {
    const padD = String(day).padStart(2, '0');
    const padM = String(month).padStart(2, '0');
    return {
      dateStr: `${year}-${padM}-${padD}`,
      dateFormatted: `${padD}/${padM}/${year}`,
    };
  };

  const isFoodNature =
    natureName.toLowerCase().includes('alimentaç') ||
    natureName.toLowerCase().includes('mercado') ||
    items.some((i) => i.mappingName.toLowerCase().includes('feira') || i.mappingName.toLowerCase().includes('açougue'));

  if (isFoodNature) {
    const dateGroups: CellDateGroup[] = [];

    // 1. Supermercado Mensal / Compra de Estoque e Limpeza (Segunda-feira pós 1º sábado)
    const monthlyItems = items.filter(
      (ni) =>
        (ni.item.multiplierWeeks === 1 || ni.mappingName.toLowerCase().includes('mensal') || ni.mappingName.toLowerCase().includes('base')) &&
        !ni.item.description.toLowerCase().includes('peixe')
    );

    const monthlyDay = saturdays[0] ? Math.min(saturdays[0] + 2, daysInMonth) : 7;
    const monthlyDate = formatDay(monthlyDay);

    if (monthlyItems.length > 0) {
      const subItems: CellBreakdownSubItem[] = monthlyItems.map((ni) => {
        const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
        return {
          id: `${ni.item.id}_mensal`,
          description: ni.item.description,
          quantity: ni.item.quantity,
          price: ni.item.price,
          multiplierWeeks: 1,
          totalValue: (ni.item.quantity || 1) * (ni.item.price || 0),
          paymentMethod: ni.item.paymentMethod,
          cardName: ni.item.cardName,
          mappingName: ni.mappingName,
          isAtypical: isAtyp,
          attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
        };
      });

      dateGroups.push({
        id: `dg_mensal_${monthlyDate.dateStr}`,
        dateStr: monthlyDate.dateStr,
        dateFormatted: `${monthlyDate.dateFormatted} (Segunda-feira)`,
        eventTitle: '🏬 Supermercado Mensal (Estoque Seco & Limpeza)',
        periodType: 'MENSAL',
        subtotal: subItems.reduce((acc, it) => acc + it.totalValue, 0),
        items: subItems,
      });
    }

    // 2. Semanas de Feira e Açougue (Sábados do mês)
    const weeklyItems = items.filter(
      (ni) =>
        ni.item.multiplierWeeks === 4 ||
        ni.mappingName.toLowerCase().includes('feira') ||
        ni.item.description.toLowerCase().includes('frango')
    );

    const biweeklyItems = items.filter((ni) => ni.item.multiplierWeeks === 2);

    const specialMonthlyItems = items.filter(
      (ni) => ni.item.multiplierWeeks === 1 && ni.item.description.toLowerCase().includes('peixe')
    );

    saturdays.slice(0, 4).forEach((satDay, index) => {
      const weekNum = index + 1;
      const satDate = formatDay(satDay);
      const daySubItems: CellBreakdownSubItem[] = [];

      weeklyItems.forEach((ni) => {
        const itemUnitVal = (ni.item.quantity || 1) * (ni.item.price || 0);
        const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
        daySubItems.push({
          id: `${ni.item.id}_sem_${weekNum}`,
          description: ni.item.description,
          quantity: ni.item.quantity,
          price: ni.item.price,
          multiplierWeeks: 1,
          totalValue: itemUnitVal,
          paymentMethod: ni.item.paymentMethod,
          cardName: ni.item.cardName,
          mappingName: ni.mappingName,
          isAtypical: isAtyp,
          attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
        });
      });

      if (weekNum === 1 || weekNum === 3) {
        biweeklyItems.forEach((ni) => {
          const itemUnitVal = (ni.item.quantity || 1) * (ni.item.price || 0);
          const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
          daySubItems.push({
            id: `${ni.item.id}_quinz_${weekNum}`,
            description: ni.item.description,
            quantity: ni.item.quantity,
            price: ni.item.price,
            multiplierWeeks: 1,
            totalValue: itemUnitVal,
            paymentMethod: ni.item.paymentMethod,
            cardName: ni.item.cardName,
            mappingName: ni.mappingName,
            isAtypical: isAtyp,
            attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
          });
        });
      }

      if (weekNum === 4) {
        specialMonthlyItems.forEach((ni) => {
          const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
          daySubItems.push({
            id: `${ni.item.id}_esp_${weekNum}`,
            description: ni.item.description,
            quantity: ni.item.quantity,
            price: ni.item.price,
            multiplierWeeks: 1,
            totalValue: (ni.item.quantity || 1) * (ni.item.price || 0),
            paymentMethod: ni.item.paymentMethod,
            cardName: ni.item.cardName,
            mappingName: ni.mappingName,
            isAtypical: isAtyp,
            attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
          });
        });
      }

      if (daySubItems.length > 0) {
        let titleDesc = `${weekNum}ª Semana — Feira Livre & Hortifrúti`;
        if (weekNum === 1 || weekNum === 3) {
          titleDesc += ' + Açougue Quinzena';
        } else if (weekNum === 4 && specialMonthlyItems.length > 0) {
          titleDesc += ' + Peixaria Nobre';
        }

        dateGroups.push({
          id: `dg_feira_sem_${weekNum}_${satDate.dateStr}`,
          dateStr: satDate.dateStr,
          dateFormatted: `${satDate.dateFormatted} (Sábado)`,
          eventTitle: `🛒 ${titleDesc}`,
          periodType: 'SEMANAL',
          subtotal: daySubItems.reduce((acc, it) => acc + it.totalValue, 0),
          items: daySubItems,
        });
      }
    });

    dateGroups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return dateGroups;
  }

  // Para outras naturezas (Moradia, Educação, Transporte, etc.)
  const otherGroups: CellDateGroup[] = [];
  const defaultDay = 10;
  const defDate = formatDay(defaultDay);

  const subItems: CellBreakdownSubItem[] = items.map((ni) => {
    const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
    return {
      id: ni.item.id,
      description: ni.item.description,
      quantity: ni.item.quantity,
      price: ni.item.price,
      multiplierWeeks: ni.item.multiplierWeeks,
      totalValue:
        ni.item.totalValue ||
        (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1),
      paymentMethod: ni.item.paymentMethod,
      cardName: ni.item.cardName,
      mappingName: ni.mappingName,
      isAtypical: isAtyp,
      attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
    };
  });

  otherGroups.push({
    id: `dg_other_${defDate.dateStr}`,
    dateStr: defDate.dateStr,
    dateFormatted: `${defDate.dateFormatted} (Ciclo Mensal)`,
    eventTitle: `📑 Custos Recorrentes de ${natureName}`,
    periodType: 'MENSAL',
    subtotal: subItems.reduce((acc, it) => acc + it.totalValue, 0),
    items: subItems,
  });

  return otherGroups;
}

export const GridCellDetailModal: React.FC<GridCellDetailModalProps> = ({
  isOpen,
  onClose,
  selection,
}) => {
  const { movements, natures, getNatureCeiling, activeCheckpoint, monthlyClosings } = useFinancial();

  const columnKey = selection?.columnKey;
  const columnTitle = selection?.columnTitle || '';
  const competenceLabel = selection?.competenceLabel || '';
  const formattedCompetence = selection?.formattedCompetence || '';
  const totalValue = selection?.totalValue || 0;
  const row = selection?.row;

  // Estado para controlar qual seleção está ativa: 'ALL' ou o ID da natureza
  const [activeSelectionId, setActiveSelectionId] = useState<string>('ALL');
  // Campo de busca para delimitar e filtrar a natureza sob análise
  const [natureSearchTerm, setNatureSearchTerm] = useState<string>('');

  // Ocupa o espaço inteiro da tela e se adapta responsivamente sem barra de rolagem horizontal
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };


  // Tratar tecla ESC para fechar o modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lista achatada de todos os itens das naturezas mapeadas
  const allNatureItems = useMemo(() => {
    if (!selection || !row) return [];
    if (columnKey !== 'fixedCost' && columnKey !== 'creditCard' && columnKey !== 'totalExpense') return [];

    const itemsList: {
      natureName: string;
      natureColor: string;
      mappingName: string;
      item: MappingItem;
    }[] = [];

    natures.forEach((nat) => {
      nat.mappings.forEach((m) => {
        m.items.forEach((it) => {
          itemsList.push({
            natureName: nat.name,
            natureColor: nat.color,
            mappingName: m.name,
            item: it,
          });
        });
      });
    });

    return itemsList;
  }, [natures, columnKey, selection, row]);

  // Lista detalhada e reconciliada de todos os lançamentos que geraram o valor da célula
  const breakdownItems = useMemo<CellBreakdownItem[]>(() => {
    if (!selection || !row || !columnKey) return [];
    const monthPrefix = row.monthKey;
    const items: CellBreakdownItem[] = [];

    if (columnKey === 'extras') {
      const realMovements = movements.filter(
        (m) =>
          m.type === 'RECEBER' &&
          m.category !== 'Salário' &&
          m.dueDate.startsWith(monthPrefix)
      );

      realMovements.forEach((m) => {
        items.push({
          id: m.id,
          category: m.category,
          bankOrOrigin: m.bank,
          title: m.title,
          notes: m.notes || 'Lançamento avulso de receita',
          badge: m.status === 'REALIZADA' ? 'Liquidado' : 'Previsto',
          badgeType: m.status === 'REALIZADA' ? 'emerald' : 'cyan',
          amount: m.amount,
          dateOrDue: `Vencimento: ${m.dueDate}`,
          isProjected: false,
        });
      });



      const currentSum = items.reduce((acc, it) => acc + it.amount, 0);
      const remaining = Math.round(((totalValue || 0) - currentSum) * 100) / 100;
      if (remaining > 0) {
        items.push({
          id: `extras_proj_${monthPrefix}`,
          category: 'Receitas Extras',
          bankOrOrigin: 'Conta Corrente',
          title: 'Outros Proventos & Entradas Previstas',
          notes: 'Complemento de projeção orçamentária',
          badge: 'Projeção',
          badgeType: 'slate',
          amount: remaining,
          dateOrDue: `Previsão: ${monthPrefix}-15`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'creditCard') {
      const realCards = movements.filter(
        (m) =>
          m.type === 'PAGAR' &&
          (m.category === 'Cartão' || m.category.toLowerCase().includes('cartão')) &&
          m.dueDate.startsWith(monthPrefix)
      );

      realCards.forEach((m) => {
        items.push({
          id: m.id,
          category: 'Fatura de Cartão',
          bankOrOrigin: m.bank,
          title: m.title,
          notes: m.notes || 'Fatura consolidada do banco',
          badge: m.status === 'REALIZADA' ? 'Liquidado' : 'Fatura Aberta',
          badgeType: m.status === 'REALIZADA' ? 'emerald' : 'purple',
          amount: m.amount,
          dateOrDue: `Vencimento: ${m.dueDate}`,
          isProjected: false,
        });
      });

      const fixedCardItems = allNatureItems.filter((ni) => {
        if (ni.item.paymentMethod === 'CARTAO') return true;
        if (
          selection?.initialNatureName &&
          ni.natureName.toLowerCase() === selection.initialNatureName.toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      const cardNatureMap = new Map<string, {
        natureName: string;
        natureColor: string;
        cardName: string;
        items: typeof fixedCardItems;
        totalAmount: number;
      }>();

      fixedCardItems.forEach((ni) => {
        const itemVal =
          ni.item.totalValue ||
          (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1);
        if (itemVal > 0) {
          const key = ni.natureName;
          const cur = cardNatureMap.get(key) || {
            natureName: ni.natureName,
            natureColor: ni.natureColor,
            cardName: ni.item.cardName || 'Cartão Nubank / Inter',
            items: [],
            totalAmount: 0,
          };
          cur.items.push(ni);
          cur.totalAmount += itemVal;
          cardNatureMap.set(key, cur);
        }
      });

      // Garantir que a natureza clicada pelo usuário esteja presente mesmo com métodos mistos
      if (selection?.initialNatureName && !cardNatureMap.has(selection.initialNatureName)) {
        const matchingItems = allNatureItems.filter(
          (ni) => ni.natureName.toLowerCase() === selection.initialNatureName!.toLowerCase()
        );
        if (matchingItems.length > 0) {
          const first = matchingItems[0];
          cardNatureMap.set(selection.initialNatureName, {
            natureName: selection.initialNatureName,
            natureColor: first.natureColor,
            cardName: first.item.cardName || 'Custos da Natureza',
            items: matchingItems,
            totalAmount: matchingItems.reduce(
              (acc, ni) =>
                acc +
                (ni.item.totalValue ||
                  (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1)),
              0
            ),
          });
        }
      }

      cardNatureMap.forEach((group, natName) => {
        const dateGroups = generateNatureDateGroups(
          row.monthKey,
          natName,
          group.items
        );

        const mNat = natures.find((n) => n.name.toLowerCase() === natName.toLowerCase());
        const plannedCeiling = mNat ? getNatureCeiling(mNat) : group.totalAmount;
        const isOver = group.totalAmount > plannedCeiling && plannedCeiling > 0;
        const hasAtypical = group.items.some((ni) =>
          ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`)
        );
        const hasAttention = isOver || hasAtypical;
        const attentionType: 'OVER_CEILING' | 'ATYPICAL' | undefined = isOver
          ? 'OVER_CEILING'
          : hasAtypical
          ? 'ATYPICAL'
          : undefined;
        const attentionMessage = isOver
          ? `Teto orçado excedido (${Math.round((group.totalAmount / plannedCeiling) * 100)}% usado)`
          : hasAtypical
          ? 'Contém gastos atípicos ou não-recorrentes'
          : undefined;

        const subItemsList: CellBreakdownSubItem[] = group.items.map((ni) => {
          const itemVal =
            ni.item.totalValue ||
            ni.item.quantity * ni.item.price * (ni.item.multiplierWeeks || 1);
          const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
          return {
            id: ni.item.id,
            description: ni.item.description,
            quantity: ni.item.quantity,
            price: ni.item.price,
            multiplierWeeks: ni.item.multiplierWeeks,
            totalValue: itemVal,
            paymentMethod: ni.item.paymentMethod,
            cardName: ni.item.cardName,
            mappingName: ni.mappingName,
            isAtypical: isAtyp,
            attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
          };
        });

        if (isOver && subItemsList.length > 0) {
          const topAtyp = subItemsList.find((s) => s.isAtypical);
          if (topAtyp) {
            topAtyp.isTopOffender = true;
            topAtyp.attentionReason = 'Ofensor de Teto (Gasto Atípico)';
          } else {
            const sorted = [...subItemsList].sort((a, b) => b.totalValue - a.totalValue);
            sorted[0].isTopOffender = true;
            sorted[0].attentionReason = 'Maior Despesa (Ofensor de Teto)';
          }
        }

        items.push({
          id: `card_nat_${natName}`,
          category: natName,
          bankOrOrigin: group.cardName,
          title: natName,
          notes: `Teto orçado na fatura (${group.items.length} itens mapeados • ${dateGroups.length} datas de compra)`,
          badge: 'Fixo no Cartão',
          badgeType: isOver ? 'rose' : 'purple',
          amount: Math.round(group.totalAmount * 100) / 100,
          dateOrDue: `Recorrente no ciclo ${row.competenceLabel}`,
          isProjected: true,
          dateGroups,
          subItems: subItemsList,
          hasAttentionPoint: hasAttention,
          attentionType,
          attentionMessage,
        });
      });

      const currentSum = items.reduce((acc, it) => acc + it.amount, 0);
      const remaining = Math.round(((totalValue || 0) - currentSum) * 100) / 100;
      if (remaining > 0) {
        items.push({
          id: `card_installments_${monthPrefix}`,
          category: 'Compras Parceladas',
          bankOrOrigin: 'Cartão de Crédito',
          title: 'Parcelamentos Anteriores & Compras no Cartão',
          notes: 'Faturas e compras parceladas em andamento da planilha do usuário',
          badge: 'Parcelamentos',
          badgeType: 'cyan',
          amount: remaining,
          dateOrDue: `Vencimento da fatura: ${monthPrefix}-10`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'variableCost') {
      const realVars = movements.filter(
        (m) =>
          m.type === 'PAGAR' &&
          m.category !== 'Cartão' &&
          !m.category.toLowerCase().includes('cartão') &&
          m.category !== 'Custo Fixo' &&
          m.dueDate.startsWith(monthPrefix)
      );

      realVars.forEach((m) => {
        items.push({
          id: m.id,
          category: m.category,
          bankOrOrigin: m.bank,
          title: m.title,
          notes: m.notes || 'Despesa avulsa / imprevisto',
          badge: m.status === 'REALIZADA' ? 'Pago' : 'Previsto',
          badgeType: m.status === 'REALIZADA' ? 'emerald' : 'cyan',
          amount: m.amount,
          dateOrDue: `Vencimento: ${m.dueDate}`,
          isProjected: false,
        });
      });

      const currentSum = items.reduce((acc, it) => acc + it.amount, 0);
      const remaining = Math.round(((totalValue || 0) - currentSum) * 100) / 100;
      if (remaining > 0) {
        items.push({
          id: `var_provision_${monthPrefix}`,
          category: 'Gastos Variáveis',
          bankOrOrigin: 'Conta Corrente',
          title: 'Provisão para Imprevistos & Gastos Variáveis',
          notes: 'Teto orçado projetado para compras de conveniência e lazer',
          badge: 'Orçamento',
          badgeType: 'slate',
          amount: remaining,
          dateOrDue: `Reserva para o ciclo ${row.competenceLabel}`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'salary') {
      const realSalaries = movements.filter(
        (m) =>
          m.type === 'RECEBER' &&
          (m.category === 'Salário' || m.category.toLowerCase().includes('salário')) &&
          m.dueDate.startsWith(monthPrefix)
      );

      if (realSalaries.length > 0) {
        realSalaries.forEach((m) => {
          items.push({
            id: m.id,
            category: 'Salário CLT',
            bankOrOrigin: m.bank,
            title: m.title,
            notes: m.notes || 'Proventos salariais regulares',
            badge: m.status === 'REALIZADA' ? 'Creditado' : 'Previsto',
            badgeType: m.status === 'REALIZADA' ? 'emerald' : 'cyan',
            amount: m.amount,
            dateOrDue: `Data de crédito: ${m.dueDate}`,
            isProjected: false,
          });
        });
      } else {
        items.push({
          id: `sal_regular_${monthPrefix}`,
          category: 'Salário CLT',
          bankOrOrigin: 'Conta Corrente (Itaú / Bradesco)',
          title: 'Salário CLT Líquido Regular',
          notes: 'Remuneração mensal projetada conforme contrato CLT',
          badge: 'Projeção',
          badgeType: 'emerald',
          amount: totalValue,
          dateOrDue: `Previsto: 5º dia útil (${monthPrefix})`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'loanPayment') {
      const realLoans = movements.filter(
        (m) =>
          m.type === 'PAGAR' &&
          (m.category === 'Empréstimo' || m.category.toLowerCase().includes('empréstimo') || m.category.toLowerCase().includes('financiamento')) &&
          m.dueDate.startsWith(monthPrefix)
      );

      if (realLoans.length > 0) {
        realLoans.forEach((m) => {
          items.push({
            id: m.id,
            category: 'Amortização',
            bankOrOrigin: m.bank,
            title: m.title,
            notes: m.notes || 'Parcela de empréstimo contratado',
            badge: m.status === 'REALIZADA' ? 'Pago' : 'A Vencer',
            badgeType: m.status === 'REALIZADA' ? 'emerald' : 'amber',
            amount: m.amount,
            dateOrDue: `Vencimento: ${m.dueDate}`,
            isProjected: false,
          });
        });
      } else {
        items.push({
          id: `loan_inst_${monthPrefix}`,
          category: 'Empréstimo Contratado',
          bankOrOrigin: 'Débito em Conta',
          title: 'Parcela de Financiamento / Empréstimo',
          notes: 'Amortização e juros da dívida em curso (Tabela Price)',
          badge: 'Contrato Ativo',
          badgeType: 'amber',
          amount: totalValue,
          dateOrDue: `Vencimento: ${monthPrefix}-10`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'fixedCost') {
      natures.forEach((nat) => {
        const natItems: typeof allNatureItems = [];
        nat.mappings.forEach((m) => {
          m.items.forEach((it) => {
            natItems.push({
              natureName: nat.name,
              natureColor: nat.color,
              mappingName: m.name,
              item: it,
            });
          });
        });

        const natSum = natItems.reduce((acc, ni) => {
          const val =
            ni.item.totalValue ||
            (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1);
          return acc + val;
        }, 0);

        if (natSum > 0) {
          const onCardCount = natItems.filter((ni) => ni.item.paymentMethod === 'CARTAO').length;
          const onDirectCount = natItems.filter((ni) => ni.item.paymentMethod !== 'CARTAO').length;

          let badgeText = 'Débito em Conta';
          let badgeType: 'emerald' | 'purple' | 'cyan' = 'emerald';
          if (onCardCount > 0 && onDirectCount === 0) {
            badgeText = 'No Cartão';
            badgeType = 'purple';
          } else if (onCardCount > 0 && onDirectCount > 0) {
            badgeText = 'Misto (Cartão & Conta)';
            badgeType = 'cyan';
          }

          const dateGroups = generateNatureDateGroups(
            row.monthKey,
            nat.name,
            natItems
          );

          const plannedCeiling = getNatureCeiling(nat);
          const isOver = natSum > plannedCeiling && plannedCeiling > 0;
          const hasAtypical = natItems.some((ni) =>
            ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`)
          );
          const hasAttention = isOver || hasAtypical;
          const attentionType: 'OVER_CEILING' | 'ATYPICAL' | undefined = isOver
            ? 'OVER_CEILING'
            : hasAtypical
            ? 'ATYPICAL'
            : undefined;
          const attentionMessage = isOver
            ? `Teto orçado excedido (${Math.round((natSum / plannedCeiling) * 100)}% usado)`
            : hasAtypical
            ? 'Contém gastos atípicos ou não-recorrentes'
            : undefined;

          const subItemsList: CellBreakdownSubItem[] = natItems.map((ni) => {
            const itemVal =
              ni.item.totalValue ||
              ni.item.quantity * ni.item.price * (ni.item.multiplierWeeks || 1);
            const isAtyp = ATYPICAL_KEYWORD_REGEX.test(`${ni.item.description} ${ni.mappingName || ''}`);
            return {
              id: ni.item.id,
              description: ni.item.description,
              quantity: ni.item.quantity,
              price: ni.item.price,
              multiplierWeeks: ni.item.multiplierWeeks,
              totalValue: itemVal,
              paymentMethod: ni.item.paymentMethod,
              cardName: ni.item.cardName,
              mappingName: ni.mappingName,
              isAtypical: isAtyp,
              attentionReason: isAtyp ? 'Gasto Atípico / Não-Recorrente' : undefined,
            };
          });

          if (isOver && subItemsList.length > 0) {
            const topAtyp = subItemsList.find((s) => s.isAtypical);
            if (topAtyp) {
              topAtyp.isTopOffender = true;
              topAtyp.attentionReason = 'Ofensor de Teto (Gasto Atípico)';
            } else {
              const sorted = [...subItemsList].sort((a, b) => b.totalValue - a.totalValue);
              sorted[0].isTopOffender = true;
              sorted[0].attentionReason = 'Maior Despesa (Ofensor de Teto)';
            }
          }

          items.push({
            id: `nat_${nat.id}`,
            category: nat.name,
            bankOrOrigin: onCardCount > 0 ? 'Cartão & Débito em Conta' : 'Conta Corrente / Boleto',
            title: nat.name,
            notes: nat.description || `Teto orçado mensal (${natItems.length} itens cadastrados • ${dateGroups.length} datas no mês)`,
            badge: badgeText,
            badgeType: isOver ? 'rose' : badgeType,
            amount: Math.round(natSum * 100) / 100,
            dateOrDue: `Recorrente no ciclo ${row.competenceLabel}`,
            isProjected: true,
            dateGroups,
            subItems: subItemsList,
            hasAttentionPoint: hasAttention,
            attentionType,
            attentionMessage,
          });
        }
      });
    } else if (columnKey === 'totalIncome') {
      // 1. Salário
      if (row.salary > 0) {
        const realSalaries = movements.filter(
          (m) =>
            m.type === 'RECEBER' &&
            (m.category === 'Salário' || m.category.toLowerCase().includes('salário')) &&
            m.dueDate.startsWith(monthPrefix)
        );

        const fmt = (v: number) =>
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        const isSemanal   = (row.salaryWeeklyInstallments ?? 0) > 0;
        const isQuinzenal = !isSemanal && ((row.salaryFirstInstallment ?? 0) > 0 || (row.salarySecondInstallment ?? 0) > 0);

        let salarySubItems: CellBreakdownSubItem[] = [];

        if (isSemanal) {
          // Gera N sub-itens, um por semana no mês
          const count     = row.salaryWeeklyInstallments ?? 0;
          const weeklyVal = row.salaryWeeklyAmount ?? Math.round((row.salary / count) * 100) / 100;
          for (let w = 1; w <= count; w++) {
            salarySubItems.push({
              id: `sub_sal_w${w}_${monthPrefix}`,
              description: `${w}ª semana`,
              quantity: 1,
              price: weeklyVal,
              multiplierWeeks: 1,
              totalValue: weeklyVal,
              mappingName: `Provento Semanal (${w}/${count})`,
            });
          }
        } else if (isQuinzenal) {
          salarySubItems = [
            {
              id: `sub_sal_q1_${monthPrefix}`,
              description: '1ª Quinzena (adiantamento)',
              quantity: 1,
              price: row.salaryFirstInstallment ?? 0,
              multiplierWeeks: 1,
              totalValue: row.salaryFirstInstallment ?? 0,
              mappingName: 'Proventos — 1ª Quinzena',
            },
            {
              id: `sub_sal_q2_${monthPrefix}`,
              description: '2ª Quinzena (pagamento principal)',
              quantity: 1,
              price: row.salarySecondInstallment ?? 0,
              multiplierWeeks: 1,
              totalValue: row.salarySecondInstallment ?? 0,
              mappingName: 'Proventos — 2ª Quinzena',
            },
          ];
        } else {
          salarySubItems = [
            {
              id: `sub_sal_${monthPrefix}`,
              description: 'Salário Líquido',
              quantity: 1,
              price: row.salary,
              multiplierWeeks: 1,
              totalValue: row.salary,
              mappingName: 'Proventos Fixos',
            },
          ];
        }

        const category = isSemanal ? 'Salário — Pagamento Semanal'
          : isQuinzenal ? 'Salário — Pagamento Quinzenal'
          : 'Salário';

        const title = isSemanal
          ? `Salário Líquido (${row.salaryWeeklyInstallments} semanas no mês)`
          : isQuinzenal
          ? 'Salário Líquido (1ª + 2ª Quinzena)'
          : 'Salário Líquido Regular';

        const notes = isSemanal
          ? `${row.salaryWeeklyInstallments} pagamentos × ${fmt(row.salaryWeeklyAmount ?? 0)} = ${fmt(row.salary)}`
          : isQuinzenal
          ? `1ª Quinzena: ${fmt(row.salaryFirstInstallment ?? 0)} · 2ª Quinzena: ${fmt(row.salarySecondInstallment ?? 0)}`
          : 'Remuneração mensal regular conforme holerite';

        const dateOrDue = isSemanal
          ? `${row.salaryWeeklyInstallments} pagamentos semanais em ${row.competenceLabel}`
          : isQuinzenal
          ? `Quinzenas em ${row.competenceLabel}`
          : `5º dia útil (${monthPrefix})`;

        items.push({
          id: `income_sal_${monthPrefix}`,
          category,
          bankOrOrigin: realSalaries[0]?.bank || 'Conta Corrente',
          title,
          notes,
          badge: isSemanal ? 'Semanal' : isQuinzenal ? 'Quinzenal' : 'Proventos',
          badgeType: 'emerald',
          amount: row.salary,
          dateOrDue,
          isProjected: true,
          subItems: salarySubItems,
        });
      }



      // 2. Extras Total (Bônus, 13º, aportes)
      if (row.extrasTotal > 0) {
        const realMovements = movements.filter(
          (m) =>
            m.type === 'RECEBER' &&
            m.category !== 'Salário' &&
            !m.title.toLowerCase().includes('salário') &&
            m.dueDate.startsWith(monthPrefix)
        );
        const subItemsList: CellBreakdownSubItem[] = [];

        realMovements.forEach((m) => {
          subItemsList.push({
            id: m.id,
            description: m.title,
            quantity: 1,
            price: m.amount,
            multiplierWeeks: 1,
            totalValue: m.amount,
            mappingName: m.category,
          });
        });

        items.push({
          id: `income_extras_${monthPrefix}`,
          category: 'Receitas Extras',
          bankOrOrigin: 'XP / Inter',
          title: monthPrefix === '2026-12' ? '13º Salário, Bônus & Extras' : 'Receitas & Entradas Extras',
          notes: 'Rendimentos, bonificações e aportes previstos na competência',
          badge: 'Extras',
          badgeType: 'cyan',
          amount: row.extrasTotal,
          dateOrDue: `Vencimentos em ${row.competenceLabel}`,
          isProjected: true,
          subItems: subItemsList.length > 0 ? subItemsList : undefined,
        });
      }

      // 3. Empréstimos (+) Captados
      if (row.loanReceived > 0) {
        items.push({
          id: `income_loan_${monthPrefix}`,
          category: 'Empréstimo Captado',
          bankOrOrigin: 'Crédito em Conta',
          title: 'Crédito / Financiamento Injetado no Caixa',
          notes: 'Entrada de capital oriunda de novo contrato',
          badge: 'Empréstimo (+)',
          badgeType: 'amber',
          amount: row.loanReceived,
          dateOrDue: `Data de crédito: ${monthPrefix}-10`,
          isProjected: true,
        });
      }
    } else if (columnKey === 'totalExpense') {
      // 1. Faturas de Cartão de Crédito
      if (row.creditCardTotal > 0) {
        const fixedCardItems = allNatureItems.filter((ni) => ni.item.paymentMethod === 'CARTAO');
        const cardSubItems: CellBreakdownSubItem[] = fixedCardItems.map((ni) => ({
          id: ni.item.id,
          description: ni.item.description,
          quantity: ni.item.quantity || 1,
          price: ni.item.price || 0,
          multiplierWeeks: ni.item.multiplierWeeks || 1,
          totalValue: ni.item.totalValue || (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1),
          paymentMethod: ni.item.paymentMethod,
          cardName: ni.item.cardName,
          mappingName: ni.mappingName,
        }));

        items.push({
          id: `expense_card_${monthPrefix}`,
          category: 'Cartão de Crédito',
          bankOrOrigin: 'Nubank / Inter',
          title: 'Faturas de Cartão de Crédito',
          notes: 'Fatura mensal consolidada (absorve fixos no cartão e parcelamentos)',
          badge: 'Cartão',
          badgeType: 'purple',
          amount: row.creditCardTotal,
          dateOrDue: `Vencimento: ${monthPrefix}-10`,
          isProjected: true,
          subItems: cardSubItems.length > 0 ? cardSubItems : undefined,
        });
      }

      // 2. Custos Fixos Mapeados pelas Naturezas
      if (row.fixedCostMapped > 0) {
        natures.forEach((nat) => {
          const natItems: typeof allNatureItems = [];
          nat.mappings.forEach((m) => {
            m.items.forEach((it) => {
              natItems.push({
                natureName: nat.name,
                natureColor: nat.color,
                mappingName: m.name,
                item: it,
              });
            });
          });

          const natSum = natItems.reduce((acc, ni) => {
            const val =
              ni.item.totalValue ||
              (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1);
            return acc + val;
          }, 0);

          if (natSum > 0) {
            const dateGroups = generateNatureDateGroups(row.monthKey, nat.name, natItems);
            items.push({
              id: `expense_fix_${nat.id}`,
              category: nat.name,
              bankOrOrigin: 'Débito / Cartão',
              title: `Custo Fixo: ${nat.name}`,
              notes: nat.description || `Teto orçado mensal (${natItems.length} itens cadastrados)`,
              badge: 'Custo Fixo',
              badgeType: 'cyan',
              amount: Math.round(natSum * 100) / 100,
              dateOrDue: `Recorrente no ciclo ${row.competenceLabel}`,
              isProjected: true,
              dateGroups,
              subItems: natItems.map((ni) => ({
                id: ni.item.id,
                description: ni.item.description,
                quantity: ni.item.quantity,
                price: ni.item.price,
                multiplierWeeks: ni.item.multiplierWeeks,
                totalValue:
                  ni.item.totalValue ||
                  ni.item.quantity * ni.item.price * (ni.item.multiplierWeeks || 1),
                paymentMethod: ni.item.paymentMethod,
                cardName: ni.item.cardName,
                mappingName: ni.mappingName,
              })),
            });
          }
        });
      }

      // 3. Custos Avulsos & Variáveis
      if (row.variableCost > 0) {
        items.push({
          id: `expense_var_${monthPrefix}`,
          category: 'Gastos Variáveis',
          bankOrOrigin: 'Conta Corrente',
          title: 'Custos Avulsos & Variáveis',
          notes: 'Gastos de conveniência, imprevistos e desembolsos pontuais',
          badge: 'Variável',
          badgeType: 'slate',
          amount: row.variableCost,
          dateOrDue: `Previsão: ${row.competenceLabel}`,
          isProjected: true,
        });
      }

      // 4. Parcelas de Empréstimo / Financiamento
      if (row.loanPayment > 0) {
        items.push({
          id: `expense_loan_${monthPrefix}`,
          category: 'Financiamentos & Dívidas',
          bankOrOrigin: 'Débito em Conta',
          title: 'Parcelas de Empréstimos & Dívidas',
          notes: 'Amortização e juros das parcelas ativas (Tabela Price)',
          badge: 'Empréstimo (-)',
          badgeType: 'amber',
          amount: row.loanPayment,
          dateOrDue: `Vencimento: ${monthPrefix}-10`,
          isProjected: true,
        });
      }
    } else if (columnTitle === 'Saldo Inicial do Ciclo') {
      const isFirst = row?.isFirstMonth ?? (monthPrefix === '2026-09');
      const prevKey = row?.previousMonthKey;

      if (isFirst) {
        const checkpointLabel = activeCheckpoint?.label || 'Ponto de Partida';
        const initialDateFormatted = activeCheckpoint?.startDate
          ? activeCheckpoint.startDate.split('-').reverse().join('/')
          : formattedCompetence;

        items.push({
          id: `saldo_inicial_${monthPrefix}`,
          category: 'Ponto de Partida',
          bankOrOrigin: checkpointLabel,
          title: 'Saldo Inicial do Ponto de Partida',
          notes: activeCheckpoint
            ? `Saldo em caixa definido no marco de acompanhamento ativo (${checkpointLabel}) com início em ${initialDateFormatted}`
            : 'Saldo em caixa inicial configurado como marco de partida das projeções',
          badge: 'Marco Inicial',
          badgeType: 'emerald',
          amount: totalValue,
          dateOrDue: `Início do Ciclo: ${initialDateFormatted}`,
          isProjected: true,
        });
      } else {
        const prevClosing = monthlyClosings?.find(
          (c) => c.monthKey === prevKey && c.status === 'FECHADO'
        );

        let prevMonthLabel = 'Mês Anterior';
        if (prevKey) {
          const [py, pm] = prevKey.split('-');
          const pDate = new Date(parseInt(py, 10), parseInt(pm, 10) - 1, 1);
          prevMonthLabel = pDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        }

        if (prevClosing) {
          items.push({
            id: `saldo_carryover_${monthPrefix}`,
            category: 'Fechamento Contábil',
            bankOrOrigin: `Fechamento ${prevMonthLabel}`,
            title: `Saldo Transportado de ${prevMonthLabel}`,
            notes: `Saldo final de ${prevMonthLabel} conciliado formalmente no fechamento contábil e fixado como abertura deste ciclo.`,
            badge: 'Fechamento Consolidado',
            badgeType: 'emerald',
            amount: totalValue,
            dateOrDue: `Abertura: ${formattedCompetence}`,
            isProjected: true,
          });
        } else {
          items.push({
            id: `saldo_carryover_${monthPrefix}`,
            category: 'Carryover de Saldo',
            bankOrOrigin: `Projeção ${prevMonthLabel}`,
            title: `Saldo Remanescente de ${prevMonthLabel}`,
            notes: `Saldo final acumulado apurado na competência anterior (${prevMonthLabel}) e transferido automaticamente para abertura deste ciclo.`,
            badge: 'Saldo Transportado',
            badgeType: 'cyan',
            amount: totalValue,
            dateOrDue: `Abertura: ${formattedCompetence}`,
            isProjected: true,
          });
        }
      }
    } else {
      items.push({
        id: `summary_${columnKey}_${monthPrefix}`,
        category: 'Resumo DRE',
        bankOrOrigin: 'Conciliação Balder',
        title: columnTitle,
        notes: `Resultado apurado para a competência ${competenceLabel}`,
        badge: 'Competência',
        badgeType: 'cyan',
        amount: totalValue,
        dateOrDue: formattedCompetence,
        isProjected: true,
      });
    }

    return items;
  }, [selection, movements, columnKey, row, totalValue, allNatureItems, natures, competenceLabel, formattedCompetence, columnTitle, activeCheckpoint, monthlyClosings]);

  // Inicialização e foco na natureza específica ao abrir o modal ou mudar de seleção
  useEffect(() => {
    if (isOpen) {
      if (selection?.initialNatureName) {
        const target = selection.initialNatureName.toLowerCase();
        const found = breakdownItems.find(
          (it) =>
            it.title.toLowerCase() === target ||
            it.category.toLowerCase() === target ||
            it.id.toLowerCase().includes(target)
        );
        if (found) {
          setActiveSelectionId(found.id);
        } else {
          setActiveSelectionId('ALL');
        }
      } else if (selection?.initialNatureId) {
        const found = breakdownItems.find(
          (it) => it.id.includes(selection.initialNatureId!)
        );
        if (found) {
          setActiveSelectionId(found.id);
        } else {
          setActiveSelectionId('ALL');
        }
      } else {
        setActiveSelectionId('ALL');
      }
      setNatureSearchTerm('');
    }
  }, [isOpen, selection, breakdownItems]);

  // Filtragem de naturezas pelo termo de busca informado pelo usuário
  const filteredBreakdownItems = useMemo(() => {
    if (!natureSearchTerm.trim()) return breakdownItems;
    const term = natureSearchTerm.trim().toLowerCase();
    return breakdownItems.filter((item) => {
      const matchesTitle = item.title.toLowerCase().includes(term);
      const matchesCategory = item.category.toLowerCase().includes(term);
      const matchesBank = item.bankOrOrigin.toLowerCase().includes(term);
      const matchesNotes = item.notes ? item.notes.toLowerCase().includes(term) : false;
      const matchesSubItems = item.subItems
        ? item.subItems.some(
            (sub) =>
              sub.description.toLowerCase().includes(term) ||
              (sub.mappingName && sub.mappingName.toLowerCase().includes(term))
          )
        : false;
      return matchesTitle || matchesCategory || matchesBank || matchesNotes || matchesSubItems;
    });
  }, [breakdownItems, natureSearchTerm]);

  // Itens de todas as naturezas concatenados para visão consolidada
  const consolidatedSubItems = useMemo<CellBreakdownSubItem[]>(() => {
    const items: CellBreakdownSubItem[] = [];
    breakdownItems.forEach((b) => {
      if (b.subItems && b.subItems.length > 0) {
        items.push(...b.subItems);
      } else if (b.amount > 0) {
        items.push({
          id: b.id,
          description: b.title,
          quantity: 1,
          price: b.amount,
          multiplierWeeks: 1,
          totalValue: b.amount,
          mappingName: b.category,
          cardName: b.bankOrOrigin,
        });
      }
    });
    return items;
  }, [breakdownItems]);

  // Agrupamentos por data de todas as naturezas combinadas para visão consolidada
  const consolidatedDateGroups = useMemo<CellDateGroup[]>(() => {
    const map = new Map<string, CellDateGroup>();
    breakdownItems.forEach((b) => {
      if (b.dateGroups) {
        b.dateGroups.forEach((dg) => {
          const cur = map.get(dg.dateStr);
          if (cur) {
            cur.subtotal += dg.subtotal;
            cur.items.push(...dg.items);
          } else {
            map.set(dg.dateStr, {
              id: dg.id,
              dateStr: dg.dateStr,
              dateFormatted: dg.dateFormatted,
              eventTitle: dg.eventTitle,
              periodType: dg.periodType,
              subtotal: dg.subtotal,
              items: [...dg.items],
            });
          }
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [breakdownItems]);

  // Item ativo no painel de detalhe dedicado
  const isAll = activeSelectionId === 'ALL';
  const activeItem = isAll
    ? null
    : breakdownItems.find((b) => b.id === activeSelectionId) || breakdownItems[0];

  const currentTitle = isAll ? 'Todos os Itens (Consolidado)' : activeItem?.title || '';
  const currentCategory = isAll ? 'Consolidado da Competência' : activeItem?.category || '';
  const currentOrigin = isAll ? `${breakdownItems.length} naturezas mapeadas` : activeItem?.bankOrOrigin || '';
  const currentBadge = isAll ? 'Visão Geral' : activeItem?.badge;
  const currentAmount = isAll ? totalValue : activeItem?.amount || 0;
  const currentSubItems = isAll ? consolidatedSubItems : activeItem?.subItems || [];
  const currentDateGroups = isAll ? consolidatedDateGroups : activeItem?.dateGroups || [];

  // Itens filtrados para exibição caso haja busca ativa por natureza/item
  const displayedSubItems = useMemo(() => {
    if (!natureSearchTerm.trim()) return currentSubItems;
    const term = natureSearchTerm.trim().toLowerCase();
    return currentSubItems.filter(
      (it) =>
        it.description.toLowerCase().includes(term) ||
        (it.mappingName && it.mappingName.toLowerCase().includes(term)) ||
        (it.cardName && it.cardName.toLowerCase().includes(term)) ||
        currentTitle.toLowerCase().includes(term)
    );
  }, [currentSubItems, natureSearchTerm, currentTitle]);

  const displayedDateGroups = useMemo(() => {
    if (!natureSearchTerm.trim()) return currentDateGroups;
    const term = natureSearchTerm.trim().toLowerCase();
    return currentDateGroups
      .map((dg) => {
        const filteredItems = dg.items.filter(
          (it) =>
            it.description.toLowerCase().includes(term) ||
            (it.mappingName && it.mappingName.toLowerCase().includes(term)) ||
            (it.cardName && it.cardName.toLowerCase().includes(term)) ||
            dg.eventTitle.toLowerCase().includes(term) ||
            currentTitle.toLowerCase().includes(term)
        );
        if (filteredItems.length === 0) return null;
        const subtotal = filteredItems.reduce((acc, it) => acc + (it.totalValue || it.price || 0), 0);
        return {
          ...dg,
          items: filteredItems,
          subtotal,
        };
      })
      .filter((dg): dg is CellDateGroup => dg !== null);
  }, [currentDateGroups, natureSearchTerm, currentTitle]);

  // Se a busca delimitar para exatamente uma natureza, auto-seleciona a aba dessa natureza
  useEffect(() => {
    if (!natureSearchTerm.trim()) return;
    if (filteredBreakdownItems.length === 1 && activeSelectionId !== filteredBreakdownItems[0].id) {
      setActiveSelectionId(filteredBreakdownItems[0].id);
    }
  }, [natureSearchTerm, filteredBreakdownItems, activeSelectionId]);

  // Comparativo com o Previsto do Mês
  const { plannedAmount, diffAmount, percentUsed, isOverCeiling } = useMemo(() => {
    let planned = 0;
    if (!row || !columnKey) {
      return {
        plannedAmount: 0,
        diffAmount: 0,
        percentUsed: 0,
        isOverCeiling: false,
      };
    }
    if (isAll) {
      if (columnKey === 'fixedCost') {
        planned = row.fixedCostMapped || totalValue;
      } else if (columnKey === 'creditCard') {
        const naturesTotal = breakdownItems.reduce((acc, it) => {
          const mNat = natures.find(
            (n) =>
              n.name.toLowerCase() === it.category.toLowerCase() ||
              n.name.toLowerCase() === it.title.toLowerCase()
          );
          return acc + (mNat ? getNatureCeiling(mNat) : it.amount);
        }, 0);
        planned = naturesTotal > 0 ? naturesTotal : (row.creditCardTotal || totalValue);
      } else if (columnKey === 'salary') {
        planned = row.salary || totalValue;
      } else if (columnKey === 'extras') {
        planned = row.extrasTotal || totalValue;
      } else if (columnKey === 'totalIncome') {
        planned = (row.salary || 0) + (row.extrasTotal || 0) + (row.loanReceived || 0);
      } else if (columnKey === 'totalExpense') {
        planned = (row.creditCardTotal || 0) + (row.fixedCostMapped || 0) + (row.variableCost || 0) + (row.loanPayment || 0);
      } else {
        planned = totalValue;
      }
    } else if (activeItem) {
      const mNat = natures.find(
        (n) =>
          n.name.toLowerCase() === activeItem.category.toLowerCase() ||
          n.name.toLowerCase() === activeItem.title.toLowerCase()
      );
      planned = mNat ? getNatureCeiling(mNat) : activeItem.amount;
    }

    const realized = currentAmount;
    const diff = planned - realized;
    const pct = planned > 0 ? Math.round((realized / planned) * 100) : 100;
    const isOver = realized > planned && planned > 0;

    return {
      plannedAmount: planned,
      diffAmount: diff,
      percentUsed: pct,
      isOverCeiling: isOver,
    };
  }, [isAll, activeItem, columnKey, row, totalValue, currentAmount, breakdownItems, natures, getNatureCeiling]);

  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        borderRadius: 0,
        zIndex: 105,
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }
    : {
        position: 'fixed',
        top: '16px',
        left: '16px',
        right: '16px',
        bottom: '16px',
        width: 'calc(100vw - 32px)',
        height: 'calc(100vh - 32px)',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        borderRadius: '16px',
        zIndex: 105,
        boxSizing: 'border-box',
        overflowX: 'hidden',
      };

  if (!isOpen || !selection || !row) return null;

  return createPortal(
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="modal-container glass-card cell-detail-modal-container"
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Principal do Modal */}
        <div
          className="modal-header py-2.5 px-4 border-b border-border/40 select-none flex-shrink-0 w-full min-w-0"
          onDoubleClick={toggleFullscreen}
          title="Dê duplo clique para alternar tela cheia"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
            <div className="cell-icon-wrap p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0">
              {columnKey === 'fixedCost' && <Layers size={18} />}
              {columnKey === 'creditCard' && <CreditCard size={18} />}
              {columnKey === 'salary' && <Building2 size={18} />}
              {columnKey === 'extras' && <ArrowUpRight size={18} />}
              {columnKey === 'totalIncome' && <ArrowUpRight size={18} className="text-emerald-400" />}
              {columnKey === 'totalExpense' && <Receipt size={18} className="text-rose-400" />}
              {columnKey === 'variableCost' && <Receipt size={18} />}
              {columnKey === 'loanPayment' && <Landmark size={18} />}
              {(columnKey === 'monthNet' || columnKey === 'accumulated') && <DollarSign size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  Detalhamento de Competência
                </span>
                <span className="badge badge-cyan text-[10px]">{competenceLabel} ({formattedCompetence})</span>
              </div>
              <h2 className="text-base font-bold flex items-center gap-2 truncate" style={{ color: 'var(--text-primary)' }}>
                {columnTitle}
              </h2>
            </div>
          </div>

          <div className="cell-detail-header-actions flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="text-right flex flex-col items-end whitespace-nowrap">
              <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Valor Total da Célula</span>
              <span className="text-lg font-mono font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                {formatBRL(totalValue)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pl-2.5 border-l border-border/40">
              {/* Botão Tela Inteira */}
              <button
                type="button"
                className="modal-action-btn p-1.5 transition rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onClick={toggleFullscreen}
                title={isFullscreen ? "Sair da Tela Inteira (100%)" : "Tela Inteira (100% da tela)"}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              {/* Botão Fechar */}
              <button
                type="button"
                className="modal-close-btn p-1.5 transition rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onClick={onClose}
                title="Fechar (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Corpo do Detalhamento: Master-Detail Grid */}
        <div className="modal-body cell-detail-modal-body flex-1 min-h-0 w-full box-border">
          {/* Banner Inteligente Compacto Anti-Duplicidade se aplicável */}
          {columnKey === 'totalIncome' && (
            <div className="compact-info-banner mb-2">
              <ArrowUpRight size={15} className="text-emerald-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Total de Entradas ({formatBRL(totalValue)}):</strong>{' '}
                consolidado de proventos CLT, receitas extras e rendimentos da competência.
              </div>
            </div>
          )}

          {columnKey === 'totalExpense' && (
            <div className="compact-info-banner mb-2">
              <Receipt size={15} className="text-rose-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Total de Saídas ({formatBRL(totalValue)}):</strong>{' '}
                absorve faturas ({formatBRL(row.creditCardTotal)}), custos fixos ({formatBRL(row.fixedCostMapped)}), avulsos e parcelas.
              </div>
            </div>
          )}

          {columnKey === 'fixedCost' && (
            <div className="compact-info-banner mb-2">
              <ShieldCheck size={15} className="text-emerald-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Proteção Anti-Duplicidade Ativa:</strong>{' '}
                Fixos no cartão ({formatBRL(row.fixedCostOnCard)}) na coluna Cartão; fixos diretos ({formatBRL(row.fixedCostDirect)}) debitados em conta.
              </div>
            </div>
          )}

          {columnKey === 'creditCard' && (
            <div className="compact-info-banner mb-2">
              <Info size={15} className="text-cyan-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Fatura de {formatBRL(row.creditCardTotal)}:</strong>{' '}
                absorve compras parceladas e gastos fixos recorrentes no cartão ({formatBRL(row.fixedCostOnCard)}).
              </div>
            </div>
          )}

          {/* SELETOR DE ABAS HORIZONTAIS DE NATUREZAS COM CAMPO DE BUSCA */}
          <div className="nature-tabs-bar-container">
            {/* Campo de Busca para Delimitar a Natureza sob Análise */}
            <div className="nature-search-wrap">
              <Search size={14} className="nature-search-icon" />
              <input
                type="text"
                value={natureSearchTerm}
                onChange={(e) => setNatureSearchTerm(e.target.value)}
                placeholder="Buscar natureza..."
                className="nature-search-input"
              />
              {natureSearchTerm && (
                <button
                  type="button"
                  onClick={() => setNatureSearchTerm('')}
                  className="nature-search-clear"
                  title="Limpar busca"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Abas Horizontais com Rolagem Suave */}
            <div className="nature-horizontal-tabs">
              {/* Aba Consolidada: Todos os Itens */}
              <button
                type="button"
                className={`nature-tab-pill ${isAll ? 'active' : ''}`}
                onClick={() => setActiveSelectionId('ALL')}
              >
                <span>📁 Todos os Itens</span>
                <span className="nature-tab-amount">{formatBRL(totalValue)}</span>
                <span className="text-[10px] opacity-75">
                  ({consolidatedDateGroups.length} datas • {consolidatedSubItems.length} itens)
                </span>
              </button>

              {/* Abas Individuais Filtradas */}
              {filteredBreakdownItems.map((item) => {
                const isSelected = activeSelectionId === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`nature-tab-pill ${isSelected ? 'active' : ''} ${
                      item.hasAttentionPoint
                        ? item.attentionType === 'OVER_CEILING'
                          ? 'has-attention-rose'
                          : 'has-attention-amber'
                        : ''
                    }`}
                    onClick={() => setActiveSelectionId(item.id)}
                    title={`${item.title} - ${item.bankOrOrigin}${
                      item.attentionMessage ? ` (${item.attentionMessage})` : ''
                    }`}
                  >
                    <span className="truncate max-w-[170px]">{item.title}</span>
                    {item.hasAttentionPoint && (
                      <span
                        className={`nature-tab-attention-pill ${
                          item.attentionType === 'OVER_CEILING' ? 'rose' : 'amber'
                        }`}
                      >
                        <AlertTriangle size={10} />
                        {item.attentionType === 'OVER_CEILING' ? 'Estouro' : 'Atípico'}
                      </span>
                    )}
                    <span className="nature-tab-amount">{formatBRL(item.amount)}</span>
                  </button>
                );
              })}

              {filteredBreakdownItems.length === 0 && (
                <div className="text-xs text-muted py-1 px-3 whitespace-nowrap italic">
                  Nenhuma natureza encontrada para "{natureSearchTerm}"
                </div>
              )}
            </div>
          </div>

          {/* BARRA DE MÉTRICAS E STATUS EM LINHA ÚNICA */}
          <div className="compact-metrics-strip">
            {/* Lado Esquerdo: Identificação e Badge de Status */}
            <div className="metrics-strip-title-area">
              {currentCategory && currentCategory !== currentTitle && (
                <span className="nature-category-tag font-semibold truncate max-w-[140px]">{currentCategory}</span>
              )}
              <strong className="text-xs font-bold truncate max-w-[220px]" style={{ color: 'var(--text-primary)' }} title={currentTitle}>
                {currentTitle}
              </strong>
              {currentOrigin && (
                <span className="nature-origin-tag truncate max-w-[160px]">{currentOrigin}</span>
              )}
              {currentBadge && <span className="badge badge-cyan text-[10px] flex-shrink-0">{currentBadge}</span>}
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
                isOverCeiling
                  ? 'bg-rose-500/15 text-rose font-bold'
                  : 'bg-emerald-500/15 text-emerald font-bold'
              }`}>
                {isOverCeiling ? '⚠️ Acima do Teto' : '✓ Dentro do Teto'}
              </span>
            </div>

            {/* Lado Direito: Os 4 Indicadores em Chips Compactos */}
            <div className="metrics-strip-kpis">
              <div className="metric-strip-chip">
                <span className="metric-strip-chip-label">Teto:</span>
                <span className="metric-strip-chip-val">{formatBRL(plannedAmount)}</span>
              </div>
              <div className="metric-strip-chip">
                <span className="metric-strip-chip-label">Realizado:</span>
                <span className="metric-strip-chip-val">{formatBRL(currentAmount)}</span>
              </div>
              <div className="metric-strip-chip">
                <span className="metric-strip-chip-label">{diffAmount >= 0 ? 'Saldo:' : 'Estouro:'}</span>
                <span className={`metric-strip-chip-val ${diffAmount >= 0 ? 'text-emerald' : 'text-rose'}`}>
                  {diffAmount >= 0 ? `+${formatBRL(diffAmount)}` : `-${formatBRL(Math.abs(diffAmount))}`}
                </span>
              </div>
              <div className="metric-strip-chip">
                <span className="metric-strip-chip-label">Aderência:</span>
                <span className={`metric-strip-chip-val ${isOverCeiling ? 'text-rose' : 'text-emerald'}`}>
                  {percentUsed}%
                </span>
                <div className="w-10 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden ml-1">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverCeiling ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* LISTAGEM VERTICAL AGRUPADA COM STICKY HEADERS (DATA & SUBTOTAL DO DIA) */}
          <div className="detail-items-scroll-area">
            {/* Banner de Ponto de Atenção se a natureza atual possuir alerta */}
            {activeItem?.hasAttentionPoint && (
              <div
                className={`modal-attention-banner ${
                  activeItem.attentionType === 'OVER_CEILING' ? 'rose' : 'amber'
                } animate-fade-in`}
              >
                <div className="attention-banner-icon-wrap">
                  <AlertTriangle
                    size={18}
                    className={
                      activeItem.attentionType === 'OVER_CEILING'
                        ? 'text-rose-500 animate-pulse'
                        : 'text-amber-500'
                    }
                  />
                </div>
                <div className="attention-banner-content min-w-0 flex-1">
                  <div className="attention-banner-title">
                    {activeItem.attentionType === 'OVER_CEILING'
                      ? '🚨 Ponto de Atenção: Limite do Teto Orçamentário Excedido'
                      : '⚠️ Ponto de Atenção: Gasto Atípico / Imprevisto Detectado'}
                  </div>
                  <div className="attention-banner-desc">
                    {activeItem.attentionType === 'OVER_CEILING'
                      ? 'Esta natureza ultrapassou o teto estipulado para a competência. Os itens de maior impacto financeiro estão destacados com marcação visual abaixo.'
                      : 'Foram identificadas despesas avulsas ou não-recorrentes nesta competência. O item causador da anomalia está destacado com marcação visual abaixo.'}
                  </div>
                </div>
              </div>
            )}

            {displayedDateGroups.length > 0 ? (
              displayedDateGroups.map((dg) => (
                <div key={dg.id} className="sticky-date-group-block">
                  {/* Cabeçalho fixo (Sticky) contendo apenas a Data e o Subtotal do dia */}
                  <div className="sticky-date-group-header">
                    <span className="sticky-date-title">
                      📅 {dg.dateFormatted}
                    </span>
                    <div className="sticky-date-subtotal">
                      <span className="subtotal-prefix">Subtotal:</span>
                      <span className="subtotal-val">{formatBRL(dg.subtotal)}</span>
                    </div>
                  </div>

                  {/* Lista de itens da data */}
                  <div className="sticky-date-items-list">
                    {dg.items.map((sub) => (
                      <div
                        key={sub.id}
                        className={`detail-item-row ${
                          sub.isTopOffender
                            ? 'is-attention-rose'
                            : sub.isAtypical
                            ? 'is-attention-amber'
                            : ''
                        }`}
                      >
                        <div className="detail-item-main min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="detail-item-primary truncate" title={sub.description}>
                              {sub.description}
                            </div>
                            {sub.isTopOffender ? (
                              <span className="item-attention-tag rose">
                                <AlertTriangle size={11} /> 🚨 Ponto de Atenção: Ofensor de Teto
                              </span>
                            ) : sub.isAtypical ? (
                              <span className="item-attention-tag amber">
                                <AlertTriangle size={11} /> ⚠️ Ponto de Atenção: Gasto Atípico
                              </span>
                            ) : null}
                          </div>
                          <div className="detail-item-secondary">
                            {sub.quantity > 1 ? (
                              <span>{sub.quantity} un × {formatBRL(sub.price)}</span>
                            ) : (
                              <span>{formatBRL(sub.price)}</span>
                            )}
                            {sub.multiplierWeeks > 1 && (
                              <span>• {sub.multiplierWeeks} sem.</span>
                            )}
                            {sub.cardName && (
                              <span className="detail-item-card-tag">💳 {sub.cardName}</span>
                            )}
                            {sub.mappingName && !sub.cardName && (
                              <span className="detail-item-mapping-tag">• {sub.mappingName}</span>
                            )}
                            {sub.attentionReason && (
                              <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">
                                ({sub.attentionReason})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`detail-item-amount font-mono ${
                          sub.isTopOffender
                            ? 'text-rose-500 font-bold'
                            : sub.isAtypical
                            ? 'text-amber-500 font-bold'
                            : ''
                        }`}>
                          {formatBRL(sub.totalValue || (sub.quantity * sub.price * (sub.multiplierWeeks || 1)))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : displayedSubItems.length > 0 ? (
              <div className="sticky-date-items-list">
                {displayedSubItems.map((sub) => (
                  <div
                    key={sub.id}
                    className={`detail-item-row ${
                      sub.isTopOffender
                        ? 'is-attention-rose'
                        : sub.isAtypical
                        ? 'is-attention-amber'
                        : ''
                    }`}
                  >
                    <div className="detail-item-main min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="detail-item-primary truncate" title={sub.description}>
                          {sub.description}
                        </div>
                        {sub.isTopOffender ? (
                          <span className="item-attention-tag rose">
                            <AlertTriangle size={11} /> 🚨 Ponto de Atenção: Ofensor de Teto
                          </span>
                        ) : sub.isAtypical ? (
                          <span className="item-attention-tag amber">
                            <AlertTriangle size={11} /> ⚠️ Ponto de Atenção: Gasto Atípico
                          </span>
                        ) : null}
                      </div>
                      <div className="detail-item-secondary">
                        {sub.quantity > 1 ? (
                          <span>{sub.quantity} un × {formatBRL(sub.price)}</span>
                        ) : (
                          <span>{formatBRL(sub.price)}</span>
                        )}
                        {sub.multiplierWeeks > 1 && (
                          <span>• {sub.multiplierWeeks} sem.</span>
                        )}
                        {sub.cardName && (
                          <span className="detail-item-card-tag">💳 {sub.cardName}</span>
                        )}
                        {sub.mappingName && !sub.cardName && (
                          <span className="detail-item-mapping-tag">• {sub.mappingName}</span>
                        )}
                        {sub.attentionReason && (
                          <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">
                            ({sub.attentionReason})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`detail-item-amount font-mono ${
                      sub.isTopOffender
                        ? 'text-rose-500 font-bold'
                        : sub.isAtypical
                        ? 'text-amber-500 font-bold'
                        : ''
                    }`}>
                      {formatBRL(sub.totalValue || (sub.quantity * sub.price * (sub.multiplierWeeks || 1)))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                <Search size={32} className="opacity-30 mb-2" />
                <p className="text-xs">
                  {natureSearchTerm
                    ? `Nenhum lançamento encontrado para "${natureSearchTerm}".`
                    : 'Nenhum lançamento encontrado para esta seleção.'}
                </p>
                {natureSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setNatureSearchTerm('')}
                    className="mt-2 text-xs text-cyan-500 hover:underline cursor-pointer font-medium"
                  >
                    Limpar filtro de busca
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

