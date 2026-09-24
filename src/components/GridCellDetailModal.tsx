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
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Check,
  Calendar,
} from 'lucide-react';
import type { MonthlyGridProjectionRow, MappingItem, MovementStatus } from '../types';
import { buildMonthlyProjectionGrid, resolveSalaryForMonth } from '../utils/projectionMath';

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
  status?: MovementStatus | 'CANCELADA';
  originalAmount?: number;
  isReceiptEditable?: boolean;
  receiptMovementId?: string;
  receiptType?: 'SALARY_Q1' | 'SALARY_Q2' | 'SALARY_FULL' | 'SALARY_WEEKLY' | 'EXTRA' | 'MOVEMENT';
  dueDate?: string;
  paymentDate?: string;
  bank?: string;
  notes?: string;
  adjustmentReason?: string;
  payInFollowingMonth?: boolean;
  isFirstInstallment?: boolean;
}

export interface EditingReceiptData {
  id: string;
  title: string;
  category: string;
  competenceMonthKey: string;
  competenceLabel: string;
  originalAmount: number;
  amount: number;
  status: 'REALIZADA' | 'PREVISTA' | 'CANCELADA';
  dueDate: string;
  paymentDate?: string;
  bank: string;
  adjustmentReason?: string;
  notes?: string;
  receiptMovementId?: string;
  installmentGroupId?: string;
  payInFollowingMonth?: boolean;
  isFirstInstallment?: boolean;
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

/**
 * Calcula a data de vencimento / crédito do salário considerando o mês da competência e se é M+1
 */
export function computeSalaryDueDate(monthKey: string, day: number, isFollowingMonth: boolean): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  if (isFollowingMonth) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const maxDays = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), maxDays);
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Formata data ISO (YYYY-MM-DD) para formato legível DD/MM/AAAA
 */
export function formatDueDateBR(dateIso: string): string {
  if (!dateIso) return '';
  const parts = dateIso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateIso;
}

/**
 * Retorna o nome por extenso do mês seguinte à competência fornecida
 */
export function getNextMonthName(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Construtor inteligente do item contábil de Salário (com quinzenas / semanas e suporte a edições reais)
 */
export function buildSalaryBreakdownItem(
  monthPrefix: string,
  currentRow: MonthlyGridProjectionRow,
  realSalaries: any[],
  salaryContracts: any[],
  banks: any[]
): CellBreakdownItem | null {
  const activeContract = salaryContracts?.find((sc: any) => sc.isActive) || salaryContracts?.[0];
  const resolution = activeContract ? resolveSalaryForMonth(activeContract, monthPrefix) : null;
  const isPayInFollowingMonth = activeContract?.payInFollowingMonth ?? false;

  const isSemanal = (currentRow.salaryWeeklyInstallments ?? 0) > 0 || (resolution?.weeklyCount ?? 0) > 0;
  const isQuinzenal =
    !isSemanal &&
    ((currentRow.salaryFirstInstallment ?? 0) > 0 ||
      (currentRow.salarySecondInstallment ?? 0) > 0 ||
      (resolution?.first ?? 0) > 0 ||
      (resolution?.second ?? 0) > 0 ||
      activeContract?.paymentSchedule === 'QUINZENAL');

  const q1Day = activeContract?.secondPaymentDay || 15;
  const q2Day = activeContract?.paymentDay || (activeContract?.paymentDay === 31 ? 31 : 30);
  const unicoDay = activeContract?.paymentDay || 5;

  const defaultQ1DueDate = computeSalaryDueDate(monthPrefix, q1Day, isPayInFollowingMonth);
  const defaultQ2DueDate = computeSalaryDueDate(monthPrefix, q2Day, isPayInFollowingMonth);
  const defaultUnicoDueDate = computeSalaryDueDate(monthPrefix, unicoDay, isPayInFollowingMonth);

  const mQ1 = realSalaries.find(
    (m: any) =>
      m.title.toLowerCase().includes('1ª') ||
      m.title.toLowerCase().includes('adiantamento') ||
      m.installmentGroupId?.includes('q1')
  );
  const mQ2 = realSalaries.find(
    (m: any) =>
      m.title.toLowerCase().includes('2ª') ||
      m.title.toLowerCase().includes('principal') ||
      m.installmentGroupId?.includes('q2')
  );
  const mUnico = realSalaries.find(
    (m: any) =>
      !m.title.toLowerCase().includes('1ª') &&
      !m.title.toLowerCase().includes('2ª') &&
      !m.title.toLowerCase().includes('adiantamento')
  );

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  let salarySubItems: CellBreakdownSubItem[] = [];

  if (isQuinzenal) {
    const defaultQ1 = resolution?.first || currentRow.salaryFirstInstallment || 0;
    const defaultQ2 = resolution?.second || currentRow.salarySecondInstallment || 0;

    const q1Amount = mQ1 !== undefined ? mQ1.amount : (currentRow.salaryFirstInstallment ?? defaultQ1);
    const q1Original = mQ1?.originalAmount || (defaultQ1 > 0 ? defaultQ1 : q1Amount);
    const q1Status: MovementStatus | 'CANCELADA' =
      mQ1?.amount === 0 || (mQ1?.adjustmentReason && mQ1.adjustmentReason.toLowerCase().includes('não aconteceu'))
        ? 'CANCELADA'
        : (mQ1?.status || 'PREVISTA');

    const q2Amount = mQ2 !== undefined ? mQ2.amount : (currentRow.salarySecondInstallment ?? defaultQ2);
    const q2Original = mQ2?.originalAmount || (defaultQ2 > 0 ? defaultQ2 : q2Amount);
    const q2Status: MovementStatus | 'CANCELADA' =
      mQ2?.amount === 0 || (mQ2?.adjustmentReason && mQ2.adjustmentReason.toLowerCase().includes('não aconteceu'))
        ? 'CANCELADA'
        : (mQ2?.status || 'PREVISTA');

    const q1DueDate = mQ1?.dueDate || defaultQ1DueDate;
    const q2DueDate = mQ2?.dueDate || defaultQ2DueDate;

    salarySubItems = [
      {
        id: `sub_sal_q1_${monthPrefix}`,
        description: isPayInFollowingMonth
          ? '1ª Quinzena (adiantamento) · Mês seguinte'
          : '1ª Quinzena (adiantamento)',
        quantity: 1,
        price: q1Amount,
        multiplierWeeks: 1,
        totalValue: q1Amount,
        mappingName: 'Proventos — 1ª Quinzena',
        isReceiptEditable: true,
        status: q1Status,
        originalAmount: q1Original,
        receiptMovementId: mQ1?.id,
        receiptType: 'SALARY_Q1',
        dueDate: q1DueDate,
        paymentDate: mQ1?.paymentDate,
        bank: mQ1?.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
        notes:
          mQ1?.notes ||
          (isPayInFollowingMonth
            ? `Atende a competência de ${currentRow.competenceLabel}; primeiro pagamento creditado em ${formatDueDateBR(q1DueDate)}.`
            : undefined),
        adjustmentReason: mQ1?.adjustmentReason,
        payInFollowingMonth: isPayInFollowingMonth,
        isFirstInstallment: true,
        attentionReason:
          q1Status === 'CANCELADA'
            ? 'Não Aconteceu / Cancelado no Mês'
            : q1Amount < q1Original
            ? `Desconto de ${fmt(q1Original - q1Amount)}`
            : undefined,
      },
      {
        id: `sub_sal_q2_${monthPrefix}`,
        description: isPayInFollowingMonth
          ? '2ª Quinzena (pagamento principal) · Mês seguinte'
          : '2ª Quinzena (pagamento principal)',
        quantity: 1,
        price: q2Amount,
        multiplierWeeks: 1,
        totalValue: q2Amount,
        mappingName: 'Proventos — 2ª Quinzena',
        isReceiptEditable: true,
        status: q2Status,
        originalAmount: q2Original,
        receiptMovementId: mQ2?.id,
        receiptType: 'SALARY_Q2',
        dueDate: q2DueDate,
        paymentDate: mQ2?.paymentDate,
        bank: mQ2?.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
        notes:
          mQ2?.notes ||
          (isPayInFollowingMonth
            ? `Atende a competência de ${currentRow.competenceLabel}; saldo creditado em ${formatDueDateBR(q2DueDate)}.`
            : undefined),
        adjustmentReason: mQ2?.adjustmentReason,
        payInFollowingMonth: isPayInFollowingMonth,
        isFirstInstallment: false,
        attentionReason:
          q2Status === 'CANCELADA'
            ? 'Não Aconteceu / Cancelado no Mês'
            : q2Amount < q2Original
            ? `Desconto de ${fmt(q2Original - q2Amount)}`
            : undefined,
      },
    ];
  } else if (isSemanal) {
    const count = currentRow.salaryWeeklyInstallments || resolution?.weeklyCount || 4;
    const weeklyVal =
      currentRow.salaryWeeklyAmount ||
      resolution?.weeklyAmount ||
      Math.round((currentRow.salary / count) * 100) / 100;
    for (let w = 1; w <= count; w++) {
      const mW = realSalaries.find((m: any) => m.title.includes(`${w}ª semana`));
      const wAmount = mW !== undefined ? mW.amount : weeklyVal;
      const wOriginal = mW?.originalAmount || weeklyVal;
      const wStatus: MovementStatus | 'CANCELADA' =
        mW?.amount === 0 || (mW?.adjustmentReason && mW.adjustmentReason.toLowerCase().includes('não aconteceu'))
          ? 'CANCELADA'
          : (mW?.status || 'PREVISTA');

      salarySubItems.push({
        id: `sub_sal_w${w}_${monthPrefix}`,
        description: `${w}ª semana`,
        quantity: 1,
        price: wAmount,
        multiplierWeeks: 1,
        totalValue: wAmount,
        mappingName: `Provento Semanal (${w}/${count})`,
        isReceiptEditable: true,
        status: wStatus,
        originalAmount: wOriginal,
        receiptMovementId: mW?.id,
        receiptType: 'SALARY_WEEKLY',
        dueDate: mW?.dueDate || `${monthPrefix}-0${Math.min(w * 7, 28)}`,
        paymentDate: mW?.paymentDate,
        bank: mW?.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
        notes: mW?.notes,
        adjustmentReason: mW?.adjustmentReason,
        payInFollowingMonth: isPayInFollowingMonth,
        isFirstInstallment: w === 1,
        attentionReason:
          wStatus === 'CANCELADA'
            ? 'Não Aconteceu / Cancelado no Mês'
            : wAmount < wOriginal
            ? `Desconto de ${fmt(wOriginal - wAmount)}`
            : undefined,
      });
    }
  } else {
    const defaultUnico = resolution?.total || currentRow.salary || 0;
    const unicoAmount = mUnico !== undefined ? mUnico.amount : defaultUnico;
    const unicoOriginal = mUnico?.originalAmount || defaultUnico || unicoAmount;
    const unicoStatus: MovementStatus | 'CANCELADA' =
      mUnico?.amount === 0 || (mUnico?.adjustmentReason && mUnico.adjustmentReason.toLowerCase().includes('não aconteceu'))
        ? 'CANCELADA'
        : (mUnico?.status || 'PREVISTA');
    const unicoDueDate = mUnico?.dueDate || defaultUnicoDueDate;

    salarySubItems = [
      {
        id: `sub_sal_${monthPrefix}`,
        description: isPayInFollowingMonth ? 'Salário Líquido · Mês seguinte' : 'Salário Líquido',
        quantity: 1,
        price: unicoAmount,
        multiplierWeeks: 1,
        totalValue: unicoAmount,
        mappingName: 'Proventos Fixos',
        isReceiptEditable: true,
        status: unicoStatus,
        originalAmount: unicoOriginal,
        receiptMovementId: mUnico?.id,
        receiptType: 'SALARY_FULL',
        dueDate: unicoDueDate,
        paymentDate: mUnico?.paymentDate,
        bank: mUnico?.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
        notes:
          mUnico?.notes ||
          (isPayInFollowingMonth
            ? `Atende a competência de ${currentRow.competenceLabel}; creditado em ${formatDueDateBR(defaultUnicoDueDate)}.`
            : undefined),
        adjustmentReason: mUnico?.adjustmentReason,
        payInFollowingMonth: isPayInFollowingMonth,
        isFirstInstallment: true,
        attentionReason:
          unicoStatus === 'CANCELADA'
            ? 'Não Aconteceu / Cancelado no Mês'
            : unicoAmount < unicoOriginal
            ? `Desconto de ${fmt(unicoOriginal - unicoAmount)}`
            : undefined,
      },
    ];
  }

  const category = isSemanal
    ? 'Salário — Pagamento Semanal'
    : isQuinzenal
    ? 'Salário — Pagamento Quinzenal'
    : 'Salário';

  const title = isSemanal
    ? `Salário Líquido (${currentRow.salaryWeeklyInstallments || 4} semanas no mês)`
    : isQuinzenal
    ? 'Salário Líquido (1ª + 2ª Quinzena)'
    : 'Salário Líquido Regular';

  const notes = isPayInFollowingMonth
    ? `Proventos que atendem à competência de ${currentRow.competenceLabel}, creditados em ${getNextMonthName(monthPrefix)}`
    : isSemanal
    ? `${currentRow.salaryWeeklyInstallments || 4} pagamentos semanais programados`
    : isQuinzenal
    ? `1ª Quinzena: ${fmt(salarySubItems[0]?.totalValue ?? 0)} · 2ª Quinzena: ${fmt(salarySubItems[1]?.totalValue ?? 0)}`
    : 'Remuneração mensal regular conforme holerite';

  const dateOrDue = isPayInFollowingMonth
    ? (isQuinzenal
      ? `1º Pgto: ${formatDueDateBR(defaultQ1DueDate)} · 2º Pgto: ${formatDueDateBR(defaultQ2DueDate)}`
      : `Previsão: ${formatDueDateBR(defaultUnicoDueDate)}`)
    : isSemanal
    ? `Pagamentos semanais em ${currentRow.competenceLabel}`
    : isQuinzenal
    ? `Quinzenas em ${currentRow.competenceLabel}`
    : `5º dia útil (${monthPrefix})`;

  const badge = isPayInFollowingMonth
    ? 'Mês Seguinte (M+1)'
    : isSemanal
    ? 'Semanal'
    : isQuinzenal
    ? 'Quinzenal'
    : 'Proventos';

  const badgeType = isPayInFollowingMonth ? 'cyan' : 'emerald';

  const totalCalculated = salarySubItems.reduce((acc, it) => acc + it.totalValue, 0);

  return {
    id: `income_sal_${monthPrefix}`,
    category,
    bankOrOrigin: realSalaries[0]?.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
    title,
    notes,
    badge,
    badgeType,
    amount: totalCalculated,
    dateOrDue,
    isProjected: realSalaries.length === 0,
    subItems: salarySubItems,
  };
}

export const GridCellDetailModal: React.FC<GridCellDetailModalProps> = ({
  isOpen,
  onClose,
  selection,
}) => {
  const {
    movements,
    natures,
    getNatureCeiling,
    activeCheckpoint,
    monthlyClosings,
    salaryContracts,
    addMovement,
    updateMovement,
    deleteMovement,
    banks,
  } = useFinancial();

  const columnKey = selection?.columnKey;
  const columnTitle = selection?.columnTitle || '';
  const competenceLabel = selection?.competenceLabel || '';
  const formattedCompetence = selection?.formattedCompetence || '';
  const totalValue = selection?.totalValue || 0;
  const row = selection?.row;

  // Linha da projeção recalculada dinamicamente caso o usuário adicione ou edite lançamentos
  const dynamicRow = useMemo(() => {
    if (!row) return undefined;
    const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : (row.initialBalance ?? 0);
    const grid = buildMonthlyProjectionGrid(movements, natures, initialBalance, salaryContracts, monthlyClosings);
    return grid.find((r) => r.monthKey === row.monthKey) || row;
  }, [movements, natures, salaryContracts, activeCheckpoint, monthlyClosings, row]);

  const currentRow = dynamicRow || row;

  // Valor total atualizado dinamicamente em conformidade com as alterações em tempo real
  const dynamicTotalValue = useMemo(() => {
    if (!currentRow || !columnKey) return totalValue;
    if (columnKey === 'totalIncome') return currentRow.salary + currentRow.extrasTotal + currentRow.loanReceived;
    if (columnKey === 'salary') return currentRow.salary;
    if (columnKey === 'extras') return currentRow.extrasTotal;
    if (columnKey === 'totalExpense') return currentRow.creditCardTotal + currentRow.fixedCostMapped + currentRow.variableCost + currentRow.loanPayment;
    if (columnKey === 'creditCard') return currentRow.creditCardTotal;
    if (columnKey === 'fixedCost') return currentRow.fixedCostMapped;
    if (columnKey === 'variableCost') return currentRow.variableCost;
    if (columnKey === 'loanPayment') return currentRow.loanPayment;
    return totalValue;
  }, [currentRow, columnKey, totalValue]);

  // Estado para edição do recebimento clicado pelo usuário
  const [editingReceipt, setEditingReceipt] = useState<EditingReceiptData | null>(null);

  // Estado para controlar qual seleção está ativa: 'ALL' ou o ID da natureza
  const [activeSelectionId, setActiveSelectionId] = useState<string>('ALL');
  // Campo de busca para delimitar e filtrar a natureza sob análise
  const [natureSearchTerm, setNatureSearchTerm] = useState<string>('');

  // Ocupa o espaço inteiro da tela e se adapta responsivamente sem barra de rolagem horizontal
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Abrir modal de edição para um item de recebimento
  const handleOpenReceiptEditor = (sub: CellBreakdownSubItem) => {
    if (!currentRow) return;
    const monthKey = currentRow.monthKey;
    const isCanceled = sub.status === 'CANCELADA' || sub.totalValue === 0;

    setEditingReceipt({
      id: sub.id,
      title: sub.description,
      category:
        sub.mappingName?.includes('Salário') ||
        sub.mappingName?.includes('Proventos') ||
        sub.description.toLowerCase().includes('quinzena') ||
        columnKey === 'salary'
          ? 'Salário'
          : 'Receitas Extras',
      competenceMonthKey: monthKey,
      competenceLabel: currentRow.competenceLabel,
      originalAmount: sub.originalAmount ?? sub.totalValue,
      amount: sub.totalValue,
      status: isCanceled ? 'CANCELADA' : (sub.status || 'PREVISTA'),
      dueDate:
        sub.dueDate ||
        (sub.id.includes('q1')
          ? `${monthKey}-15`
          : sub.id.includes('q2')
          ? `${monthKey}-30`
          : `${monthKey}-05`),
      paymentDate:
        sub.paymentDate ||
        (sub.status === 'REALIZADA'
          ? (sub.dueDate || `${monthKey}-15`)
          : ''),
      bank: sub.bank || (banks && banks.length > 0 ? banks[0].name : 'Conta Corrente'),
      adjustmentReason: sub.adjustmentReason || '',
      notes: sub.notes || '',
      receiptMovementId: sub.receiptMovementId,
      installmentGroupId:
        sub.receiptType === 'SALARY_Q1' || sub.id.includes('q1')
          ? `sal_q1_${monthKey}`
          : sub.receiptType === 'SALARY_Q2' || sub.id.includes('q2')
          ? `sal_q2_${monthKey}`
          : undefined,
      payInFollowingMonth: sub.payInFollowingMonth,
      isFirstInstallment: sub.isFirstInstallment,
    });
  };

  // Salvar alterações do recebimento editado
  const handleSaveReceipt = () => {
    if (!editingReceipt) return;

    const isCanceled = editingReceipt.status === 'CANCELADA';
    const effectiveAmount = isCanceled ? 0 : Number(editingReceipt.amount) || 0;
    const effectiveStatus: MovementStatus = isCanceled ? 'REALIZADA' : editingReceipt.status;
    const effectiveReason = isCanceled
      ? (editingReceipt.adjustmentReason || 'Não aconteceu nem acontecerá neste mês')
      : editingReceipt.adjustmentReason;

    if (editingReceipt.receiptMovementId) {
      updateMovement(editingReceipt.receiptMovementId, {
        amount: effectiveAmount,
        originalAmount: editingReceipt.originalAmount,
        actualAmount: effectiveAmount,
        status: effectiveStatus,
        dueDate: editingReceipt.dueDate,
        paymentDate: editingReceipt.paymentDate || editingReceipt.dueDate,
        bank: editingReceipt.bank,
        adjustmentReason: effectiveReason,
        notes: editingReceipt.notes,
      });
    } else {
      addMovement({
        title: editingReceipt.title,
        type: 'RECEBER',
        amount: effectiveAmount,
        originalAmount: editingReceipt.originalAmount,
        actualAmount: effectiveAmount,
        status: effectiveStatus,
        dueDate: editingReceipt.dueDate,
        bank: editingReceipt.bank || 'Conta Corrente',
        category: editingReceipt.category || 'Salário',
        paymentDate: editingReceipt.paymentDate || editingReceipt.dueDate,
        adjustmentReason: effectiveReason,
        notes: editingReceipt.notes,
        installmentGroupId: editingReceipt.installmentGroupId,
      });
    }

    setEditingReceipt(null);
  };

  // Restaurar o valor original do contrato (remover o override)
  const handleResetToContractDefault = () => {
    if (!editingReceipt) return;
    if (editingReceipt.receiptMovementId) {
      deleteMovement(editingReceipt.receiptMovementId);
    }
    setEditingReceipt(null);
  };

  // Tratar tecla ESC para fechar o modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingReceipt) {
          setEditingReceipt(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingReceipt]);

  // Lista achatada de todos os itens das naturezas mapeadas
  const allNatureItems = useMemo(() => {
    if (!selection || !currentRow) return [];
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
  }, [natures, columnKey, selection, currentRow]);

  // Lista detalhada e reconciliada de todos os lançamentos que geraram o valor da célula
  const breakdownItems = useMemo<CellBreakdownItem[]>(() => {
    if (!selection || !row || !currentRow || !columnKey) return [];
    const monthPrefix = currentRow.monthKey;
    const items: CellBreakdownItem[] = [];

    if (columnKey === 'extras') {
      const realMovements = movements.filter(
        (m) =>
          m.type === 'RECEBER' &&
          m.category !== 'Salário' &&
          !m.title.toLowerCase().includes('salário') &&
          !m.title.toLowerCase().includes('quinzena') &&
          m.dueDate.startsWith(monthPrefix)
      );

      realMovements.forEach((m) => {
        const isCanceled =
          m.amount === 0 ||
          (m.adjustmentReason && m.adjustmentReason.toLowerCase().includes('não aconteceu'));
        const isDisc = m.originalAmount && m.amount < m.originalAmount && m.amount > 0;
        const sub: CellBreakdownSubItem = {
          id: m.id,
          description: m.title,
          quantity: 1,
          price: m.amount,
          multiplierWeeks: 1,
          totalValue: m.amount,
          mappingName: m.category,
          cardName: m.bank,
          isReceiptEditable: true,
          status: isCanceled ? 'CANCELADA' : m.status,
          originalAmount: m.originalAmount || m.amount,
          receiptMovementId: m.id,
          receiptType: 'EXTRA',
          dueDate: m.dueDate,
          paymentDate: m.paymentDate,
          bank: m.bank,
          notes: m.notes,
          adjustmentReason: m.adjustmentReason,
          attentionReason: isCanceled
            ? 'Não Aconteceu / Cancelado'
            : isDisc
            ? `Desconto de R$ ${(m.originalAmount! - m.amount).toFixed(2)}`
            : undefined,
        };

        items.push({
          id: m.id,
          category: m.category,
          bankOrOrigin: m.bank,
          title: m.title,
          notes: m.notes || 'Lançamento avulso de receita',
          badge: isCanceled ? 'Cancelado' : m.status === 'REALIZADA' ? 'Liquidado' : 'Previsto',
          badgeType: isCanceled ? 'rose' : m.status === 'REALIZADA' ? 'emerald' : 'cyan',
          amount: m.amount,
          dateOrDue: `Vencimento: ${m.dueDate}`,
          isProjected: false,
          subItems: [sub],
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
          (m.category === 'Salário' ||
            m.category.toLowerCase().includes('salário') ||
            m.title.toLowerCase().includes('salário') ||
            m.title.toLowerCase().includes('quinzena')) &&
          m.dueDate.startsWith(monthPrefix)
      );

      const salItem = buildSalaryBreakdownItem(
        monthPrefix,
        currentRow,
        realSalaries,
        salaryContracts,
        banks
      );
      if (salItem) {
        items.push(salItem);
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
      // 1. Salário (Quinzenal, Semanal ou Único com suporte a edição de recebimentos)
      const realSalaries = movements.filter(
        (m) =>
          m.type === 'RECEBER' &&
          (m.category === 'Salário' ||
            m.category.toLowerCase().includes('salário') ||
            m.title.toLowerCase().includes('salário') ||
            m.title.toLowerCase().includes('quinzena')) &&
          m.dueDate.startsWith(monthPrefix)
      );

      const salItem = buildSalaryBreakdownItem(
        monthPrefix,
        currentRow,
        realSalaries,
        salaryContracts,
        banks
      );
      if (salItem) {
        items.push(salItem);
      }

      // 2. Extras Total (Bônus, 13º, aportes, rendimentos)
      if (currentRow.extrasTotal > 0 || movements.some(m => m.type === 'RECEBER' && m.category !== 'Salário' && m.dueDate.startsWith(monthPrefix))) {
        const realMovements = movements.filter(
          (m) =>
            m.type === 'RECEBER' &&
            m.category !== 'Salário' &&
            !m.title.toLowerCase().includes('salário') &&
            !m.title.toLowerCase().includes('quinzena') &&
            m.dueDate.startsWith(monthPrefix)
        );
        const subItemsList: CellBreakdownSubItem[] = [];

        realMovements.forEach((m) => {
          const isCanceled =
            m.amount === 0 ||
            (m.adjustmentReason && m.adjustmentReason.toLowerCase().includes('não aconteceu'));
          const isDisc = m.originalAmount && m.amount < m.originalAmount && m.amount > 0;
          subItemsList.push({
            id: m.id,
            description: m.title,
            quantity: 1,
            price: m.amount,
            multiplierWeeks: 1,
            totalValue: m.amount,
            mappingName: m.category,
            cardName: m.bank,
            isReceiptEditable: true,
            status: isCanceled ? 'CANCELADA' : m.status,
            originalAmount: m.originalAmount || m.amount,
            receiptMovementId: m.id,
            receiptType: 'EXTRA',
            dueDate: m.dueDate,
            paymentDate: m.paymentDate,
            bank: m.bank,
            notes: m.notes,
            adjustmentReason: m.adjustmentReason,
            attentionReason: isCanceled
              ? 'Não Aconteceu / Cancelado'
              : isDisc
              ? `Desconto de R$ ${(m.originalAmount! - m.amount).toFixed(2)}`
              : undefined,
          });
        });

        const currentExtrasSum = subItemsList.reduce((acc, it) => acc + it.totalValue, 0);
        const remainingExtras = Math.round(((currentRow.extrasTotal || 0) - currentExtrasSum) * 100) / 100;
        if (remainingExtras > 0) {
          subItemsList.push({
            id: `sub_extras_proj_${monthPrefix}`,
            description: 'Outros Rendimentos & Proventos Previstos',
            quantity: 1,
            price: remainingExtras,
            multiplierWeeks: 1,
            totalValue: remainingExtras,
            mappingName: 'Receitas Extras',
            isReceiptEditable: true,
            status: 'PREVISTA',
            originalAmount: remainingExtras,
            dueDate: `${monthPrefix}-15`,
            bank: 'Conta Corrente',
          });
        }

        const totalExtrasItem = subItemsList.reduce((acc, it) => acc + it.totalValue, 0);

        if (totalExtrasItem > 0 || subItemsList.length > 0) {
          items.push({
            id: `income_extras_${monthPrefix}`,
            category: 'Receitas Extras',
            bankOrOrigin: 'XP / Inter',
            title:
              monthPrefix === '2026-12'
                ? '13º Salário, Bônus & Extras'
                : 'Receitas & Entradas Extras',
            notes: 'Rendimentos, bonificações e aportes previstos na competência',
            badge: 'Extras',
            badgeType: 'cyan',
            amount: totalExtrasItem,
            dateOrDue: `Vencimentos em ${currentRow.competenceLabel}`,
            isProjected: realMovements.length === 0,
            subItems: subItemsList.length > 0 ? subItemsList : undefined,
          });
        }
      }

      // 3. Empréstimos (+) Captados
      if (currentRow.loanReceived > 0) {
        items.push({
          id: `income_loan_${monthPrefix}`,
          category: 'Empréstimo Captado',
          bankOrOrigin: 'Crédito em Conta',
          title: 'Crédito / Financiamento Injetado no Caixa',
          notes: 'Entrada de capital oriunda de novo contrato',
          badge: 'Empréstimo (+)',
          badgeType: 'amber',
          amount: currentRow.loanReceived,
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
  const currentAmount = isAll ? dynamicTotalValue : activeItem?.amount || 0;
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
    if (!currentRow || !columnKey) {
      return {
        plannedAmount: 0,
        diffAmount: 0,
        percentUsed: 0,
        isOverCeiling: false,
      };
    }
    if (isAll) {
      if (columnKey === 'fixedCost') {
        planned = currentRow.fixedCostMapped || dynamicTotalValue;
      } else if (columnKey === 'creditCard') {
        const naturesTotal = breakdownItems.reduce((acc, it) => {
          const mNat = natures.find(
            (n) =>
              n.name.toLowerCase() === it.category.toLowerCase() ||
              n.name.toLowerCase() === it.title.toLowerCase()
          );
          return acc + (mNat ? getNatureCeiling(mNat) : it.amount);
        }, 0);
        planned = naturesTotal > 0 ? naturesTotal : (currentRow.creditCardTotal || dynamicTotalValue);
      } else if (columnKey === 'salary') {
        planned = currentRow.salary || dynamicTotalValue;
      } else if (columnKey === 'extras') {
        planned = currentRow.extrasTotal || dynamicTotalValue;
      } else if (columnKey === 'totalIncome') {
        planned = (currentRow.salary || 0) + (currentRow.extrasTotal || 0) + (currentRow.loanReceived || 0);
      } else if (columnKey === 'totalExpense') {
        planned = (currentRow.creditCardTotal || 0) + (currentRow.fixedCostMapped || 0) + (currentRow.variableCost || 0) + (currentRow.loanPayment || 0);
      } else {
        planned = dynamicTotalValue;
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
  }, [isAll, activeItem, columnKey, currentRow, dynamicTotalValue, currentAmount, breakdownItems, natures, getNatureCeiling]);

  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  };

  // Renderizador unificado e interativo de linha de item/recebimento
  const renderSubItemRow = (sub: CellBreakdownSubItem) => {
    const isReceipt =
      sub.isReceiptEditable ||
      columnKey === 'totalIncome' ||
      columnKey === 'salary' ||
      columnKey === 'extras';
    const isCanceled = sub.status === 'CANCELADA' || (isReceipt && sub.totalValue === 0);
    const isRealized = sub.status === 'REALIZADA';
    const hasDiscount =
      isReceipt &&
      sub.originalAmount !== undefined &&
      sub.originalAmount > sub.totalValue &&
      sub.totalValue > 0;
    const discountDiff = hasDiscount ? sub.originalAmount! - sub.totalValue : 0;

    return (
      <div
        key={sub.id}
        onClick={() => {
          if (isReceipt) {
            handleOpenReceiptEditor(sub);
          }
        }}
        className={`detail-item-row group/receipt transition-all ${
          isReceipt
            ? 'cursor-pointer hover:bg-cyan-500/[0.08] dark:hover:bg-cyan-500/[0.12] hover:border-cyan-500/30'
            : ''
        } ${
          sub.isTopOffender
            ? 'is-attention-rose'
            : sub.isAtypical
            ? 'is-attention-amber'
            : isCanceled
            ? 'opacity-60 bg-rose-500/[0.04] border-rose-500/20'
            : ''
        }`}
        title={
          isReceipt
            ? 'Clique para editar este recebimento (já aconteceu, cancelado ou com desconto)'
            : undefined
        }
      >
        <div className="detail-item-main min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`detail-item-primary truncate ${
                isCanceled ? 'line-through text-muted' : ''
              }`}
              title={sub.description}
            >
              {sub.description}
            </div>

            {/* Badges de Status do Recebimento */}
            {isReceipt &&
              (isCanceled ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <XCircle size={10} /> Não Acontecerá
                </span>
              ) : isRealized ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check size={10} /> Recebido
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <Clock size={10} /> Previsto
                </span>
              ))}

            {sub.payInFollowingMonth && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"
                title="Provento que atende a esta competência creditado no mês seguinte"
              >
                <Calendar size={10} /> Mês Seguinte (M+1)
              </span>
            )}

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

          <div className="detail-item-secondary flex items-center gap-1.5 flex-wrap">
            {sub.quantity > 1 ? (
              <span>
                {sub.quantity} un × {formatBRL(sub.price)}
              </span>
            ) : (
              <span>{formatBRL(sub.price)}</span>
            )}
            {sub.multiplierWeeks > 1 && <span>• {sub.multiplierWeeks} sem.</span>}
            {sub.cardName && <span className="detail-item-card-tag">💳 {sub.cardName}</span>}
            {sub.mappingName && !sub.cardName && (
              <span className="detail-item-mapping-tag">• {sub.mappingName}</span>
            )}
            {sub.dueDate && (
              <span className="text-[11px] font-medium text-slate-300 bg-slate-800/60 px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                <span>🗓️ {sub.isFirstInstallment ? '1º Pagamento: ' : 'Vencimento: '}{formatDueDateBR(sub.dueDate)}</span>
                {sub.payInFollowingMonth && (
                  <span className="text-cyan-400 font-semibold text-[10px]">(M+1)</span>
                )}
              </span>
            )}
            {sub.attentionReason && (
              <span
                className={`text-[10px] font-semibold ${
                  isCanceled ? 'text-rose-400' : 'text-amber-500 dark:text-amber-400'
                }`}
              >
                ({sub.attentionReason})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {hasDiscount && (
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] line-through text-muted">
                {formatBRL(sub.originalAmount)}
              </span>
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                -{formatBRL(discountDiff)}
              </span>
            </div>
          )}

          <div
            className={`detail-item-amount font-mono ${
              isCanceled
                ? 'text-muted line-through font-normal'
                : sub.isTopOffender
                ? 'text-rose-500 font-bold'
                : sub.isAtypical
                ? 'text-amber-500 font-bold'
                : ''
            }`}
          >
            {formatBRL(
              sub.totalValue || sub.quantity * sub.price * (sub.multiplierWeeks || 1)
            )}
          </div>

          {isReceipt && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenReceiptEditor(sub);
              }}
              className="p-1.5 px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.03]"
              title="Clique para editar este recebimento"
            >
              <Edit3 size={12} />
              <span className="hidden sm:inline font-medium">Editar</span>
            </button>
          )}
        </div>
      </div>
    );
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
                {formatBRL(dynamicTotalValue)}
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
                <strong style={{ color: 'var(--text-primary)' }}>Total de Entradas ({formatBRL(dynamicTotalValue)}):</strong>{' '}
                consolidado de proventos CLT, receitas extras e rendimentos da competência.
              </div>
            </div>
          )}

          {/* Banner de Ciclo M+1 quando aplicável */}
          {(columnKey === 'salary' || columnKey === 'totalIncome') && currentRow && (() => {
            const contract = salaryContracts?.find((sc) => sc.isActive) || salaryContracts?.[0];
            if (!contract?.payInFollowingMonth) return null;
            const nextMonth = getNextMonthName(currentRow.monthKey);
            const firstDay = contract.secondPaymentDay || 1;
            return (
              <div
                className="compact-info-banner mb-2"
                style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                }}
              >
                <Calendar size={15} className="text-cyan-400 flex-shrink-0" />
                <div className="text-xs min-w-0 flex-1" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Competência {currentRow.competenceLabel} (Regime M+1):
                  </strong>{' '}
                  O pagamento referente a este período é creditado no mês seguinte ({nextMonth}). O 1º pagamento ocorre no dia {firstDay} de {nextMonth}.
                </div>
              </div>
            );
          })()}

          {columnKey === 'totalExpense' && currentRow && (
            <div className="compact-info-banner mb-2">
              <Receipt size={15} className="text-rose-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Total de Saídas ({formatBRL(dynamicTotalValue)}):</strong>{' '}
                absorve faturas ({formatBRL(currentRow.creditCardTotal)}), custos fixos ({formatBRL(currentRow.fixedCostMapped)}), avulsos e parcelas.
              </div>
            </div>
          )}

          {columnKey === 'fixedCost' && currentRow && (
            <div className="compact-info-banner mb-2">
              <ShieldCheck size={15} className="text-emerald-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Proteção Anti-Duplicidade Ativa:</strong>{' '}
                Fixos no cartão ({formatBRL(currentRow.fixedCostOnCard)}) na coluna Cartão; fixos diretos ({formatBRL(currentRow.fixedCostDirect)}) debitados em conta.
              </div>
            </div>
          )}

          {columnKey === 'creditCard' && currentRow && (
            <div className="compact-info-banner mb-2">
              <Info size={15} className="text-cyan-400 flex-shrink-0" />
              <div className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Fatura de {formatBRL(currentRow.creditCardTotal)}:</strong>{' '}
                absorve compras parceladas e gastos fixos recorrentes no cartão ({formatBRL(currentRow.fixedCostOnCard)}).
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
                <span className="nature-tab-amount">{formatBRL(dynamicTotalValue)}</span>
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
                    {dg.items.map(renderSubItemRow)}
                  </div>
                </div>
              ))
            ) : displayedSubItems.length > 0 ? (
              <div className="sticky-date-items-list">
                {displayedSubItems.map(renderSubItemRow)}
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

      {/* MODAL POPUP PARA EDITAR LANÇAMENTO DE RECEBIMENTO (STATUS, CANCELADO, DESCONTO, VALOR) */}
      {editingReceipt && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[130] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setEditingReceipt(null)}
        >
          <div
            className="glass-card w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-left"
            style={{ backgroundColor: 'var(--bg-card, #0f172a)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Editor de Recebimento */}
            <div className="flex items-start justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Edit3 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                    Editar Recebimento • {editingReceipt.competenceLabel}
                  </span>
                  <h3 className="text-base font-bold truncate text-white">
                    {editingReceipt.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingReceipt(null)}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Aviso de Ciclo M+1 quando aplicável */}
            {editingReceipt.payInFollowingMonth && (
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-2">
                <Calendar size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  <strong className="text-cyan-300">Regime M+1:</strong> Este recebimento atende à competência de{' '}
                  <strong className="text-white">{editingReceipt.competenceLabel}</strong>, com crédito previsto para o mês seguinte (<strong>{formatDueDateBR(editingReceipt.dueDate)}</strong>).
                </div>
              </div>
            )}

            {/* SELEÇÃO DO STATUS DO RECEBIMENTO */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Situação do Recebimento nesta Competência:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Opção 1: Já Aconteceu */}
                <button
                  type="button"
                  onClick={() => {
                    const newAmount =
                      editingReceipt.amount === 0 && editingReceipt.originalAmount > 0
                        ? editingReceipt.originalAmount
                        : editingReceipt.amount;
                    setEditingReceipt((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: 'REALIZADA',
                            amount: newAmount,
                            paymentDate: prev.paymentDate || prev.dueDate,
                          }
                        : null
                    );
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    editingReceipt.status === 'REALIZADA'
                      ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-slate-800/40 border-white/10 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 size={15} />
                    <span>Já Aconteceu</span>
                  </div>
                  <span className="text-[10px] text-muted leading-tight">
                    Valor creditado na conta bancária.
                  </span>
                </button>

                {/* Opção 2: Não Aconteceu nem Acontecerá */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingReceipt((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: 'CANCELADA',
                            amount: 0,
                            adjustmentReason:
                              prev.adjustmentReason || 'Não aconteceu nem acontecerá neste mês',
                          }
                        : null
                    );
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    editingReceipt.status === 'CANCELADA'
                      ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30'
                      : 'bg-slate-800/40 border-white/10 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <XCircle size={15} />
                    <span>Não Ocorrerá</span>
                  </div>
                  <span className="text-[10px] text-muted leading-tight">
                    Não aconteceu nem acontecerá (R$ 0,00).
                  </span>
                </button>

                {/* Opção 3: Ainda Não Aconteceu (Previsto) */}
                <button
                  type="button"
                  onClick={() => {
                    const newAmount =
                      editingReceipt.amount === 0 && editingReceipt.originalAmount > 0
                        ? editingReceipt.originalAmount
                        : editingReceipt.amount;
                    setEditingReceipt((prev) =>
                      prev ? { ...prev, status: 'PREVISTA', amount: newAmount } : null
                    );
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    editingReceipt.status === 'PREVISTA'
                      ? 'bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/30'
                      : 'bg-slate-800/40 border-white/10 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                    <Clock size={15} />
                    <span>Previsto</span>
                  </div>
                  <span className="text-[10px] text-muted leading-tight">
                    Aguardando crédito na data programada.
                  </span>
                </button>
              </div>
            </div>

            {/* DETALHE DO VALOR E DESCONTOS */}
            {editingReceipt.status === 'CANCELADA' ? (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <XCircle size={16} className="text-rose-400 flex-shrink-0" />
                  <span>Entrada Suprimida / Cancelada</span>
                </div>
                <p className="text-[11px] text-rose-200/80 leading-relaxed">
                  Ao definir que esta entrada <strong>não aconteceu nem acontecerá neste mês</strong>, seu valor será considerado como <strong>R$ 0,00</strong> no orçamento. O total de receitas da competência será atualizado instantaneamente, protegendo a projeção de caixa contra distorções.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Valor Efetivo a Receber (R$):
                  </label>
                  <div className="text-[11px] text-muted">
                    Valor Contratual / Previsto:{' '}
                    <strong className="text-white font-mono">
                      {formatBRL(editingReceipt.originalAmount)}
                    </strong>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-mono font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingReceipt.amount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingReceipt((prev) => (prev ? { ...prev, amount: val } : null));
                    }}
                    placeholder="0,00"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>

                {/* Deteção e Motivos de Desconto */}
                {editingReceipt.amount < editingReceipt.originalAmount && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col gap-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle size={15} />
                        Desconto de {formatBRL(editingReceipt.originalAmount - editingReceipt.amount)} (
                        {Math.round(
                          ((editingReceipt.originalAmount - editingReceipt.amount) /
                            editingReceipt.originalAmount) *
                            100
                        )}
                        % a menos)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingReceipt((prev) =>
                            prev ? { ...prev, amount: prev.originalAmount } : null
                          )
                        }
                        className="text-[11px] text-amber-300 underline hover:text-white flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <RotateCcw size={11} /> Restaurar valor original
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] text-amber-200/80 block mb-1.5 font-medium">
                        Selecione o motivo do desconto ou digite abaixo:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Desconto em Folha',
                          'Faltas / Atrasos / DSR',
                          'Vale / Adiantamento Retido',
                          'Plano de Saúde / Benefícios',
                          'Pensão Alimentícia',
                          'Impostos / Retenção',
                          'Outro Desconto',
                        ].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setEditingReceipt((prev) =>
                                prev ? { ...prev, adjustmentReason: tag } : null
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition cursor-pointer ${
                              editingReceipt.adjustmentReason === tag
                                ? 'bg-amber-500 text-black border-amber-400 font-bold'
                                : 'bg-slate-800/80 text-amber-300/90 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={editingReceipt.adjustmentReason || ''}
                      onChange={(e) =>
                        setEditingReceipt((prev) =>
                          prev ? { ...prev, adjustmentReason: e.target.value } : null
                        )
                      }
                      placeholder="Ex: Desconto de 1 dia de falta e coparticipação odontológica..."
                      className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {editingReceipt.amount > editingReceipt.originalAmount && (
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-cyan-400 flex-shrink-0" />
                    <span>
                      Acréscimo de{' '}
                      <strong>{formatBRL(editingReceipt.amount - editingReceipt.originalAmount)}</strong>{' '}
                      em relação ao contrato (Horas Extras, Bônus ou Gratificação).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* DADOS DE LIQUIDAÇÃO E BANCO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/30">
              <div>
                <label className="text-[11px] font-medium text-muted block mb-1">
                  Data Prevista / Vencimento:
                </label>
                <input
                  type="date"
                  value={editingReceipt.dueDate}
                  onChange={(e) =>
                    setEditingReceipt((prev) =>
                      prev ? { ...prev, dueDate: e.target.value } : null
                    )
                  }
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {editingReceipt.status === 'REALIZADA' && (
                <div>
                  <label className="text-[11px] font-medium text-emerald-400 block mb-1">
                    Data Efetiva do Crédito:
                  </label>
                  <input
                    type="date"
                    value={editingReceipt.paymentDate || editingReceipt.dueDate}
                    onChange={(e) =>
                      setEditingReceipt((prev) =>
                        prev ? { ...prev, paymentDate: e.target.value } : null
                      )
                    }
                    className="w-full bg-slate-900/80 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              <div className={editingReceipt.status === 'REALIZADA' ? 'sm:col-span-2' : ''}>
                <label className="text-[11px] font-medium text-muted block mb-1">
                  Conta Bancária de Destino:
                </label>
                <select
                  value={editingReceipt.bank}
                  onChange={(e) =>
                    setEditingReceipt((prev) =>
                      prev ? { ...prev, bank: e.target.value } : null
                    )
                  }
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {banks && banks.length > 0 ? (
                    banks.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Conta Corrente">Conta Corrente</option>
                      <option value="Itaú">Itaú</option>
                      <option value="Nubank">Nubank</option>
                      <option value="Inter">Inter</option>
                      <option value="Bradesco">Bradesco</option>
                      <option value="Santander">Santander</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* OBSERVAÇÕES COMPLEMENTARES */}
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">
                Observações / Anotações:
              </label>
              <input
                type="text"
                value={editingReceipt.notes || ''}
                onChange={(e) =>
                  setEditingReceipt((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                }
                placeholder="Ex: Recebido via Pix, conferido com holerite..."
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* AÇÕES DE RODAPÉ */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-1">
              <div>
                {editingReceipt.receiptMovementId && (
                  <button
                    type="button"
                    onClick={handleResetToContractDefault}
                    className="text-[11px] text-muted hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                    title="Exclui o ajuste e volta a utilizar o valor automático do contrato"
                  >
                    <RotateCcw size={12} />
                    <span>Restaurar padrão do contrato</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReceipt(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveReceipt}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

