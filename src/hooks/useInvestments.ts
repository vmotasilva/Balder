import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';
import type { Investment, InvestmentPlan, InvestmentType } from '../types';

export type { Investment, InvestmentType };

export const INVESTMENT_TYPES: Record<InvestmentType, { label: string; color: string }> = {
  RENDA_FIXA: { label: 'Renda fixa', color: '#22d3ee' },
  TESOURO: { label: 'Tesouro Direto', color: '#34d399' },
  ACOES: { label: 'Ações', color: '#a78bfa' },
  FIIS: { label: 'FIIs', color: '#fbbf24' },
  FUNDOS: { label: 'Fundos', color: '#60a5fa' },
  CRIPTO: { label: 'Cripto', color: '#fb923c' },
  OUTROS: { label: 'Outros', color: '#94a3b8' },
};

type SyncedField = 'investments' | 'investmentPlans';

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Lista guardada no aparelho (por usuário) e sincronizada com o perfil na nuvem. */
function useSyncedList<T>(field: SyncedField, localPrefix: string) {
  const { user } = useAuth();
  const isGuest = !user || user.isGuest;
  const key = !isGuest ? `${localPrefix}_${user.$id}` : `${localPrefix}_guest`;
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    let cancelled = false;
    let local: T[] = [];
    try {
      const saved = localStorage.getItem(key);
      local = saved ? JSON.parse(saved) : [];
    } catch {}
    setItems(local);
    if (isGuest) return;
    SupabaseService.getUserProfileSettings()
      .then((settings) => {
        if (cancelled) return;
        const remote = settings?.[field] as T[] | undefined;
        if (Array.isArray(remote)) {
          // A nuvem é a fonte da verdade: traz os dados de outros aparelhos
          setItems(remote);
          try {
            localStorage.setItem(key, JSON.stringify(remote));
          } catch {}
        } else if (local.length > 0) {
          // Primeira sincronização: sobe o que já estava guardado no aparelho
          SupabaseService.saveUserProfileSettings({ [field]: local }).catch(console.error);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [key, isGuest, field]);

  const persist = useCallback(
    (next: T[]) => {
      setItems(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      if (!isGuest) SupabaseService.saveUserProfileSettings({ [field]: next }).catch(console.error);
    },
    [key, isGuest, field]
  );

  return [items, persist] as const;
}

/** Carteira de investimentos, histórico de aportes e programações fixas. */
export const useInvestments = () => {
  const [items, persist] = useSyncedList<Investment>('investments', 'balder_investments');
  const [plans, persistPlans] = useSyncedList<InvestmentPlan>('investmentPlans', 'balder_investment_plans');

  const save = useCallback(
    (inv: Investment) => {
      persist(items.some((i) => i.id === inv.id) ? items.map((i) => (i.id === inv.id ? inv : i)) : [...items, inv]);
    },
    [items, persist]
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((i) => i.id !== id));
      persistPlans(plans.filter((p) => p.investmentId !== id));
    },
    [items, plans, persist, persistPlans]
  );

  const addContribution = useCallback(
    (list: Investment[], investmentId: string, amount: number, date: string, planId?: string): Investment[] =>
      list.map((i) =>
        i.id === investmentId
          ? {
              ...i,
              invested: round2(i.invested + amount),
              currentValue: round2(i.currentValue + amount),
              contributions: [...(i.contributions ?? []), { id: `ctb_${Date.now()}`, date, amount, planId }],
            }
          : i
      ),
    []
  );

  /** Registra um aporte: soma no investido e no valor atual e guarda no histórico. */
  const contribute = useCallback(
    (investmentId: string, amount: number, date: string) => persist(addContribution(items, investmentId, amount, date)),
    [items, persist, addContribution]
  );

  const removeContribution = useCallback(
    (investmentId: string, contributionId: string) => {
      persist(
        items.map((i) => {
          const c = i.contributions?.find((x) => x.id === contributionId);
          if (i.id !== investmentId || !c) return i;
          return {
            ...i,
            invested: round2(i.invested - c.amount),
            currentValue: round2(i.currentValue - c.amount),
            contributions: i.contributions!.filter((x) => x.id !== contributionId),
          };
        })
      );
    },
    [items, persist]
  );

  const savePlan = useCallback(
    (plan: InvestmentPlan) => {
      persistPlans(plans.some((p) => p.id === plan.id) ? plans.map((p) => (p.id === plan.id ? plan : p)) : [...plans, plan]);
    },
    [plans, persistPlans]
  );

  const removePlan = useCallback((id: string) => persistPlans(plans.filter((p) => p.id !== id)), [plans, persistPlans]);

  /** Confirma uma ocorrência (gera o aporte) ou a pula (só marca como tratada). */
  const settleOccurrence = useCallback(
    (plan: InvestmentPlan, date: string, confirm: boolean) => {
      if (confirm) persist(addContribution(items, plan.investmentId, plan.amount, date, plan.id));
      persistPlans(plans.map((p) => (p.id === plan.id ? { ...p, doneDates: [...p.doneDates, date] } : p)));
    },
    [items, plans, persist, persistPlans, addContribution]
  );

  return {
    investments: items,
    plans,
    saveInvestment: save,
    removeInvestment: remove,
    contribute,
    removeContribution,
    savePlan,
    removePlan,
    settleOccurrence,
  };
};
