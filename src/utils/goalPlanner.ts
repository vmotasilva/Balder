/**
 * Sugestões de metas por categoria, com as métricas usuais de planejamento financeiro, e
 * checagem de viabilidade contra a folga mensal da projeção.
 */

export type GoalCategoryId = 'RESERVA' | 'VIAGEM' | 'IMOVEL' | 'VEICULO' | 'EDUCACAO' | 'DIVIDA' | 'APOSENTADORIA' | 'OUTRO';

export type IncomeStability = 'ESTAVEL' | 'CLT' | 'VARIAVEL';

/** Meses de custo de vida guardados na reserva, conforme a estabilidade da renda. */
export const RESERVE_MONTHS: Record<IncomeStability, number> = { ESTAVEL: 3, CLT: 6, VARIAVEL: 12 };

export interface GoalAnswers {
  // Reserva
  monthlyCost?: number;
  stability?: IncomeStability;
  // Viagem
  travelers?: number;
  days?: number;
  dailyCostPerPerson?: number;
  ticketPerPerson?: number;
  // Imóvel / Veículo
  assetPrice?: number;
  vehiclePurchase?: 'A_VISTA' | 'ENTRADA';
  // Educação
  monthlyFee?: number;
  courseMonths?: number;
  enrollmentFee?: number;
  // Dívida
  debtAmount?: number;
  // Aposentadoria
  desiredMonthlyIncome?: number;
}

export interface GoalSuggestion {
  target: number;
  title: string;
  /** Métrica aplicada, em frases curtas para exibir ao usuário. */
  rationale: string[];
  /** Falta alguma resposta para calcular. */
  missing?: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function suggestGoal(category: GoalCategoryId, a: GoalAnswers): GoalSuggestion | null {
  switch (category) {
    case 'RESERVA': {
      const months = RESERVE_MONTHS[a.stability || 'CLT'];
      if (!a.monthlyCost || a.monthlyCost <= 0) return { target: 0, title: 'Reserva de Emergência', rationale: [], missing: 'Informe o custo de vida mensal.' };
      return {
        target: round2(a.monthlyCost * months),
        title: `Reserva de Emergência (${months} meses)`,
        rationale: [
          `Custo de vida mensal: ${brl(a.monthlyCost)}.`,
          `Reserva de ${months} meses de custo de vida (3 para renda estável, 6 para CLT, 12 para autônomo ou renda variável).`,
          'Guarde em aplicação de liquidez diária (ex.: CDB com liquidez diária ou Tesouro Selic).',
        ],
      };
    }
    case 'VIAGEM': {
      const people = a.travelers || 0;
      const days = a.days || 0;
      if (people <= 0 || days <= 0 || (!a.dailyCostPerPerson && !a.ticketPerPerson)) {
        return { target: 0, title: 'Viagem', rationale: [], missing: 'Informe pessoas, dias e os custos estimados.' };
      }
      const stay = people * days * (a.dailyCostPerPerson || 0);
      const tickets = people * (a.ticketPerPerson || 0);
      const base = stay + tickets;
      return {
        target: round2(base * 1.1),
        title: 'Viagem',
        rationale: [
          `Estadia e alimentação: ${people} pessoa(s) × ${days} dia(s) = ${brl(stay)}.`,
          `Passagens: ${brl(tickets)}.`,
          '+10% de margem para imprevistos e câmbio.',
        ],
      };
    }
    case 'IMOVEL': {
      if (!a.assetPrice || a.assetPrice <= 0) return { target: 0, title: 'Entrada do imóvel', rationale: [], missing: 'Informe o valor do imóvel.' };
      return {
        target: round2(a.assetPrice * 0.25),
        title: 'Entrada do imóvel',
        rationale: [
          `Entrada de 20% do valor (${brl(a.assetPrice * 0.2)}): mínimo usual do financiamento imobiliário.`,
          `+5% para ITBI, cartório e registro (${brl(a.assetPrice * 0.05)}).`,
        ],
      };
    }
    case 'VEICULO': {
      if (!a.assetPrice || a.assetPrice <= 0) return { target: 0, title: 'Veículo', rationale: [], missing: 'Informe o valor do veículo.' };
      const cash = (a.vehiclePurchase || 'A_VISTA') === 'A_VISTA';
      const principal = cash ? a.assetPrice : a.assetPrice * 0.3;
      return {
        target: round2(principal + a.assetPrice * 0.1),
        title: cash ? 'Veículo à vista' : 'Entrada do veículo',
        rationale: [
          cash ? `Compra à vista: ${brl(a.assetPrice)}.` : `Entrada de 30% (${brl(principal)}) para reduzir juros do financiamento.`,
          `+10% do valor para IPVA, seguro e documentação do 1º ano (${brl(a.assetPrice * 0.1)}).`,
        ],
      };
    }
    case 'EDUCACAO': {
      if (!a.monthlyFee || !a.courseMonths) return { target: 0, title: 'Educação', rationale: [], missing: 'Informe a mensalidade e a duração.' };
      const total = a.monthlyFee * a.courseMonths + (a.enrollmentFee || 0);
      return {
        target: round2(total),
        title: 'Educação',
        rationale: [
          `${a.courseMonths} mensalidade(s) de ${brl(a.monthlyFee)}${a.enrollmentFee ? ` + matrícula de ${brl(a.enrollmentFee)}` : ''}.`,
          'Guardar o curso inteiro antes evita comprometer o orçamento mensal durante o curso.',
        ],
      };
    }
    case 'DIVIDA': {
      if (!a.debtAmount || a.debtAmount <= 0) return { target: 0, title: 'Quitar dívida', rationale: [], missing: 'Escolha a dívida ou informe o valor.' };
      return {
        target: round2(a.debtAmount),
        title: 'Quitar dívida',
        rationale: [
          `Saldo a quitar: ${brl(a.debtAmount)}.`,
          'Priorize a dívida de juros mais altos (cartão e cheque especial antes de consignado e financiamento).',
          'Na antecipação de parcelas, os juros futuros são descontados (valor presente).',
        ],
      };
    }
    case 'APOSENTADORIA': {
      if (!a.desiredMonthlyIncome || a.desiredMonthlyIncome <= 0) {
        return { target: 0, title: 'Aposentadoria', rationale: [], missing: 'Informe a renda mensal desejada.' };
      }
      return {
        target: round2(a.desiredMonthlyIncome * 12 * 25),
        title: 'Aposentadoria (independência financeira)',
        rationale: [
          `Renda desejada: ${brl(a.desiredMonthlyIncome)}/mês = ${brl(a.desiredMonthlyIncome * 12)}/ano.`,
          'Regra dos 4%: o patrimônio precisa ser 25 vezes a renda anual para retirá-la sem esgotar o principal.',
        ],
      };
    }
    default:
      return null;
  }
}

export type FeasibilityLevel = 'CONFORTAVEL' | 'APERTADA' | 'ACIMA' | 'SEM_FOLGA' | 'SEM_DADOS';

export interface GoalFeasibility {
  level: FeasibilityLevel;
  requiredMonthly: number;
  /** Folga mensal que sobra depois das outras metas. */
  availableCapacity: number;
  /** Meses para chegar guardando metade da folga disponível (prazo confortável). */
  comfortableMonths: number | null;
  /** Meses para chegar usando toda a folga disponível (prazo mínimo). */
  minimumMonths: number | null;
}

/**
 * Compara o aporte necessário com a folga mensal (resultado médio da projeção) menos o que já está
 * comprometido com outras metas. Até 50% da folga é confortável; até 100%, apertada.
 */
export function checkFeasibility(params: {
  target: number;
  current: number;
  months: number;
  monthlyCapacity: number | null;
  committedToOtherGoals?: number;
}): GoalFeasibility {
  const missing = Math.max(0, params.target - params.current);
  const requiredMonthly = params.months > 0 ? round2(missing / params.months) : missing;
  if (params.monthlyCapacity === null) {
    return { level: 'SEM_DADOS', requiredMonthly, availableCapacity: 0, comfortableMonths: null, minimumMonths: null };
  }
  const availableCapacity = round2(Math.max(0, params.monthlyCapacity - (params.committedToOtherGoals || 0)));
  if (availableCapacity <= 0) {
    return { level: 'SEM_FOLGA', requiredMonthly, availableCapacity, comfortableMonths: null, minimumMonths: null };
  }
  const minimumMonths = missing > 0 ? Math.ceil(missing / availableCapacity) : 0;
  const comfortableMonths = missing > 0 ? Math.ceil(missing / (availableCapacity / 2)) : 0;
  const share = requiredMonthly / availableCapacity;
  const level: FeasibilityLevel = share <= 0.5 ? 'CONFORTAVEL' : share <= 1 ? 'APERTADA' : 'ACIMA';
  return { level, requiredMonthly, availableCapacity, comfortableMonths, minimumMonths };
}
