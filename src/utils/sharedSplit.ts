import type { ExpenseSplitMode, SharedScenario, SharedSettlementItem, SharedSplitRule } from '../types';

/** Competência (YYYY-MM) de uma data ISO. */
export const competenceOf = (isoDate: string) => isoDate.slice(0, 7);

export const currentCompetence = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** "2026-10" → "10/2026" */
export const competenceLabel = (competence: string) => competence.split('-').reverse().join('/');

export const SPLIT_MODE_LABEL: Record<ExpenseSplitMode, string> = {
  CONTRIBUTION: 'Por contribuição',
  PROPORTIONAL_INCOME: 'Proporcional à renda',
  EQUAL_50_50: '50% / 50%',
  CUSTOM: 'Percentual fixo',
};

/** Regras em ordem de vigência (mais antiga primeiro). */
export const sortedRules = (scenario: SharedScenario | null | undefined): SharedSplitRule[] =>
  [...(scenario?.splitHistory || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

/** Regra que vale numa competência: a mais recente com início até ela. */
export function ruleFor(scenario: SharedScenario | null | undefined, competence: string): SharedSplitRule | null {
  let found: SharedSplitRule | null = null;
  for (const rule of sortedRules(scenario)) {
    if (rule.effectiveFrom <= competence) found = rule;
  }
  return found;
}

export interface SplitResult {
  mode: ExpenseSplitMode;
  /** Fração de cada um (0 a 1); somam 1. */
  ownerShare: number;
  partnerShare: number;
  rule: SharedSplitRule | null;
}

/**
 * Divisão das despesas numa competência. Por contribuição, cada um arca na proporção do que contribui
 * (100/0 quando só um contribui); sem valores informados, divide meio a meio.
 */
export function splitFor(scenario: SharedScenario | null | undefined, competence: string): SplitResult {
  const rule = ruleFor(scenario, competence);
  const mode: ExpenseSplitMode = rule?.splitMode ?? scenario?.splitMode ?? 'PROPORTIONAL_INCOME';
  const byValues = (owner: number, partner: number) => {
    const total = Math.max(0, owner) + Math.max(0, partner);
    return total > 0 ? Math.max(0, owner) / total : 0.5;
  };

  let ownerShare = 0.5;
  if (mode === 'CONTRIBUTION') {
    ownerShare = byValues(rule?.contributions.OWNER ?? 0, rule?.contributions.PARTNER ?? 0);
  } else if (mode === 'PROPORTIONAL_INCOME') {
    const members = scenario?.members || [];
    ownerShare = byValues(
      members.find((m) => m.role === 'OWNER')?.monthlyIncome ?? 0,
      members.find((m) => m.role === 'PARTNER')?.monthlyIncome ?? 0
    );
  } else if (mode === 'CUSTOM') {
    ownerShare = Math.min(1, Math.max(0, (scenario?.userSharePercent ?? 50) / 100));
  }
  return { mode, ownerShare, partnerShare: 1 - ownerShare, rule };
}

/** Percentual para exibir (sem casas quando inteiro). */
export const pctLabel = (share: number) => {
  const pct = Math.round(share * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toLocaleString('pt-BR')}%`;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Cota de cada um numa despesa conjunta, conforme a regra da competência dela. */
export function owesFor(scenario: SharedScenario | null | undefined, amount: number, competence: string) {
  const { ownerShare, mode } = splitFor(scenario, competence);
  const userOwes = round2(amount * ownerShare);
  return { userOwes, partnerOwes: round2(amount - userOwes), splitMode: mode };
}

/**
 * Recalcula as cotas das despesas ainda pendentes a partir de uma competência
 * (as já acertadas ficam como foram fechadas).
 */
export function recalcPendingSettlements(
  settlements: SharedSettlementItem[],
  scenario: SharedScenario | null | undefined,
  fromCompetence: string
): SharedSettlementItem[] {
  return settlements.map((s) => {
    const competence = s.competence || competenceOf(s.date);
    if (s.status !== 'PENDENTE' || competence < fromCompetence) return s;
    return { ...s, competence, ...owesFor(scenario, s.totalAmount, competence) };
  });
}
