import type { MappingItem } from '../types';

export const WEEKDAY_OPTIONS: Array<{
  value: 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO';
  label: string;
  short: string;
  jsDay: number;
}> = [
  { value: 'SEGUNDA', label: 'Segunda-feira', short: 'Seg', jsDay: 1 },
  { value: 'TERCA', label: 'Terça-feira', short: 'Ter', jsDay: 2 },
  { value: 'QUARTA', label: 'Quarta-feira', short: 'Qua', jsDay: 3 },
  { value: 'QUINTA', label: 'Quinta-feira', short: 'Qui', jsDay: 4 },
  { value: 'SEXTA', label: 'Sexta-feira', short: 'Sex', jsDay: 5 },
  { value: 'SABADO', label: 'Sábado', short: 'Sáb', jsDay: 6 },
  { value: 'DOMINGO', label: 'Domingo', short: 'Dom', jsDay: 0 },
];

export const WEEKDAY_LABEL_MAP: Record<string, string> = {
  DOMINGO: 'Domingo',
  SEGUNDA: 'Segunda-feira',
  TERCA: 'Terça-feira',
  QUARTA: 'Quarta-feira',
  QUINTA: 'Quinta-feira',
  SEXTA: 'Sexta-feira',
  SABADO: 'Sábado',
};

export const WEEKDAY_SHORT_MAP: Record<string, string> = {
  DOMINGO: 'Dom',
  SEGUNDA: 'Seg',
  TERCA: 'Ter',
  QUARTA: 'Qua',
  QUINTA: 'Qui',
  SEXTA: 'Sex',
  SABADO: 'Sáb',
};

export const WEEKDAY_JS_INDEX: Record<string, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
};

/**
 * Retorna o dia efetivo no mês para um item mensal, ajustando automaticamente para o último dia do mês
 * caso o mês tenha menos dias que o dia desejado (ex: dia 31 em fevereiro com 28 dias vira dia 28).
 */
export function getEffectiveDayOfMonth(desiredDay: number, year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(Math.max(1, desiredDay), daysInMonth);
}

/**
 * Retorna os dias de manifestação de um item dentro de uma competência (ano, mês).
 */
export function getItemManifestationDays(
  item: MappingItem,
  year: number,
  month: number
): { days: number[]; periodType: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' } {
  const daysInMonth = new Date(year, month, 0).getDate();

  const recType: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' =
    item.recurrenceType ||
    (item.dayOfWeek
      ? 'SEMANAL'
      : item.dayOfFortnight !== undefined && item.dayOfFortnight > 0
      ? 'QUINZENAL'
      : item.dayOfMonth !== undefined && item.dayOfMonth > 0
      ? 'MENSAL'
      : item.multiplierWeeks === 4 || item.multiplierWeeks === 5
      ? 'SEMANAL'
      : item.multiplierWeeks === 2
      ? 'QUINZENAL'
      : 'MENSAL');

  if (recType === 'SEMANAL') {
    const targetJsDay = WEEKDAY_JS_INDEX[item.dayOfWeek || 'SABADO'] ?? 6;
    const days: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(year, month - 1, d);
      if (dObj.getDay() === targetJsDay) {
        days.push(d);
      }
    }
    return { days, periodType: 'SEMANAL' };
  }

  if (recType === 'QUINZENAL') {
    const fDay = Math.min(Math.max(1, item.dayOfFortnight || 1), 15);
    const day1 = Math.min(fDay, daysInMonth);
    const day2 = Math.min(fDay + 15, daysInMonth);
    return {
      days: day1 === day2 ? [day1] : [day1, day2],
      periodType: 'QUINZENAL',
    };
  }

  // MENSAL
  const desiredDay = item.dayOfMonth !== undefined && item.dayOfMonth > 0 ? item.dayOfMonth : 10;
  // Ajuste automático para o último dia do mês quando o mês tiver < 31 dias (ou < desiredDay)
  const effectiveDay = Math.min(Math.max(1, desiredDay), daysInMonth);
  return {
    days: [effectiveDay],
    periodType: 'MENSAL',
  };
}

/**
 * Retorna o texto formatado do dia/frequência de manifestação do item para exibição em badges e tabelas.
 */
export function formatItemScheduleBadge(item: {
  recurrenceType?: 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
  dayOfWeek?: string;
  dayOfFortnight?: number;
  dayOfMonth?: number;
  multiplierWeeks?: number;
}): { label: string; icon: string; badgeClass: string; detail: string } {
  const rec =
    item.recurrenceType ||
    (item.dayOfWeek
      ? 'SEMANAL'
      : item.dayOfFortnight !== undefined && item.dayOfFortnight > 0
      ? 'QUINZENAL'
      : item.dayOfMonth !== undefined && item.dayOfMonth > 0
      ? 'MENSAL'
      : item.multiplierWeeks === 4 || item.multiplierWeeks === 5
      ? 'SEMANAL'
      : item.multiplierWeeks === 2
      ? 'QUINZENAL'
      : 'MENSAL');

  if (rec === 'SEMANAL') {
    const dayName = WEEKDAY_LABEL_MAP[item.dayOfWeek || 'SABADO'] || 'Sábado';
    return {
      label: `Toda ${dayName}`,
      icon: '🗓️',
      badgeClass: 'badge-cyan',
      detail: `Semanal (${dayName})`,
    };
  }

  if (rec === 'QUINZENAL') {
    const d = item.dayOfFortnight || 1;
    return {
      label: `Dias ${d} e ${d + 15}`,
      icon: '🌓',
      badgeClass: 'badge-purple',
      detail: `Quinzenal (Dia ${d} da quinzena)`,
    };
  }

  // MENSAL
  const d = item.dayOfMonth !== undefined && item.dayOfMonth > 0 ? item.dayOfMonth : 10;
  const isLastDay = d === 31;
  return {
    label: isLastDay ? 'Dia 31 (Fim do Mês - auto)' : `Dia ${d}`,
    icon: '📅',
    badgeClass: 'badge-emerald',
    detail: isLastDay
      ? 'Último dia do mês (ajuste auto para 28, 29, 30 ou 31 dias)'
      : `Mensal no dia ${d}`,
  };
}
