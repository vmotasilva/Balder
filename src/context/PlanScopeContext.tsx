import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useAccountScope } from './AccountScopeContext';
import { PlansService, setActivePlan, type CreatePlanError, type PlanItem } from '../services/supabaseService';

/**
 * Planejamentos próprios: além do principal, a pessoa pode ter outros totalmente independentes
 * (ex.: um pequeno negócio). Cada um tem seus lançamentos, naturezas, contas, marcos e configurações.
 */
export type Plan = PlanItem;

interface PlanScopeContextType {
  /** Planejamentos extras (o principal não entra). */
  plans: Plan[];
  /** Planejamento em uso (null = o principal). Em conta compartilhada vale sempre o do dono. */
  activePlanId: string | null;
  activePlan: Plan | null;
  createPlan: (name: string, icon?: string) => Promise<{ ok: true; plan: Plan } | { ok: false; error: CreatePlanError | 'NOME' | 'LIMITE' }>;
  renamePlan: (id: string, name: string) => Promise<void>;
  /** Nome e ícone do planejamento principal. */
  mainPlan: { name: string; icon?: string };
  /** Altera nome e/ou ícone de um planejamento (null = o principal). Devolve false se o nome for inválido. */
  updatePlan: (id: string | null, changes: { name?: string; icon?: string }) => Promise<boolean>;
  /** Configurações do planejamento em uso (nome, ícone, marco, período, dados). */
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  deletePlan: (id: string) => Promise<boolean>;
  /** Troca de planejamento (null = o principal). A tela é recriada com os dados do escolhido. */
  switchPlan: (id: string | null) => void;
  /** Planejamentos marcados para somar na visão consolidada (MAIN_PLAN_KEY = o principal). */
  compareIds: string[];
  toggleCompare: (key: string) => void;
  /** Visão consolidada aberta: mostra o resultado do todo, somente leitura. */
  consolidated: boolean;
  setConsolidated: (open: boolean) => void;
}

const PlanScopeContext = createContext<PlanScopeContextType | undefined>(undefined);

export const MAX_EXTRA_PLANS = 5;
/** Chave do planejamento principal na seleção da visão consolidada. */
export const MAIN_PLAN_KEY = 'main';
export const DEFAULT_MAIN_NAME = 'Meu planejamento';
const mainKey = (userId: string) => `balder_main_plan_${userId}`;
const compareKey = (userId: string) => `balder_compare_plans_${userId}`;
const listKey = (userId: string) => `balder_plans_${userId}`;
const activeKey = (userId: string) => `balder_active_plan_${userId}`;

const readPlans = (userId?: string): Plan[] => {
  if (!userId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(listKey(userId)) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const readActive = (userId: string | undefined, plans: Plan[]): string | null => {
  if (!userId) return null;
  try {
    const id = localStorage.getItem(activeKey(userId));
    return id && plans.some((p) => p.id === id) ? id : null;
  } catch {
    return null;
  }
};

/** Remove os caches locais de um planejamento (as chaves terminam em `${usuário}__${plano}`). */
export const clearPlanLocalData = (userId: string, planId: string) => {
  try {
    const suffix = `_${userId}__${planId}`;
    Object.keys(localStorage)
      .filter((k) => k.endsWith(suffix) || k.includes(`${suffix}_`))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // armazenamento indisponível
  }
};

/** Id usado nos caches locais: o do usuário no principal, `usuário__plano` nos extras. */
export const scopedUserId = (userId: string, planId: string | null): string => (planId ? `${userId}__${planId}` : userId);

export const PlanScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { viewing } = useAccountScope();
  const userId = user && !user.isGuest ? user.$id : undefined;

  // O escopo precisa estar definido antes do primeiro carregamento dos dados (como o dono da conta compartilhada)
  const [plans, setPlans] = useState<Plan[]>(() => readPlans(userId));
  const [activePlanId, setActivePlanId] = useState<string | null>(() => {
    const id = readActive(userId, readPlans(userId));
    setActivePlan(id, readPlans(userId).length > 0);
    return id;
  });

  // Planejamentos marcados para somar (guardados por aparelho) e se a visão consolidada está aberta
  const [compareRaw, setCompareRaw] = useState<string[]>(() => {
    if (!userId) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(compareKey(userId)) || '[]');
      return Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : [];
    } catch {
      return [];
    }
  });
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mainPlan, setMainPlan] = useState<{ name: string; icon?: string }>(() => {
    try {
      const raw = userId ? JSON.parse(localStorage.getItem(mainKey(userId)) || 'null') : null;
      if (raw && typeof raw.name === 'string') return raw;
    } catch {
      // sem armazenamento local
    }
    return { name: DEFAULT_MAIN_NAME };
  });

  // Nome e ícone do principal vindos da nuvem
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void PlansService.getMain().then((cloud) => {
      if (!alive || !cloud) return;
      setMainPlan(cloud);
      try {
        localStorage.setItem(mainKey(userId), JSON.stringify(cloud));
      } catch {
        // sem armazenamento local
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Atualiza a lista com a da nuvem (outro aparelho pode ter criado ou apagado planejamentos)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void PlansService.list().then((cloud) => {
      if (!alive || !cloud) return;
      setPlans(cloud);
      try {
        localStorage.setItem(listKey(userId), JSON.stringify(cloud));
      } catch {
        // sem armazenamento local
      }
      setActivePlanId((current) => {
        const next = current && cloud.some((p) => p.id === current) ? current : null;
        setActivePlan(next, cloud.length > 0);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const persistPlans = useCallback(
    async (next: Plan[]) => {
      setPlans(next);
      if (userId) {
        try {
          localStorage.setItem(listKey(userId), JSON.stringify(next));
        } catch {
          // sem armazenamento local
        }
      }
      await PlansService.save(next);
    },
    [userId]
  );

  /** Ativa um planejamento (ou o principal). `count` é quantos planejamentos extras existem depois da mudança. */
  const activate = useCallback(
    (next: string | null, count: number) => {
      if (!userId) return;
      setActivePlan(next, count > 0);
      try {
        if (next) localStorage.setItem(activeKey(userId), next);
        else localStorage.removeItem(activeKey(userId));
      } catch {
        // sem armazenamento local
      }
      setActivePlanId(next);
      window.scrollTo({ top: 0 });
    },
    [userId]
  );

  const switchPlan = useCallback(
    (id: string | null) => activate(id && plans.some((p) => p.id === id) ? id : null, plans.length),
    [activate, plans]
  );

  const createPlan = useCallback<PlanScopeContextType['createPlan']>(
    async (name, icon) => {
      const clean = name.trim().slice(0, 40);
      if (clean.length < 2) return { ok: false, error: 'NOME' };
      if (plans.length >= MAX_EXTRA_PLANS) return { ok: false, error: 'LIMITE' };
      // Sem a coluna plan_id nas tabelas os dados do novo planejamento se misturariam com os do principal
      if (!(await PlansService.isReady())) return { ok: false, error: 'SQL_PENDENTE' };
      const plan: Plan = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 12), name: clean, icon: icon || '🏢', createdAt: new Date().toISOString() };
      await persistPlans([...plans, plan]);
      // Já abre no planejamento novo (a lista de `plans` ainda é a anterior neste ponto)
      activate(plan.id, plans.length + 1);
      return { ok: true, plan };
    },
    [plans, persistPlans, activate]
  );

  const renamePlan = useCallback(
    async (id: string, name: string) => {
      const clean = name.trim().slice(0, 40);
      if (clean.length < 2) return;
      await persistPlans(plans.map((p) => (p.id === id ? { ...p, name: clean } : p)));
    },
    [plans, persistPlans]
  );

  const updatePlan = useCallback<PlanScopeContextType['updatePlan']>(
    async (id, changes) => {
      const name = changes.name === undefined ? undefined : changes.name.trim().slice(0, 40);
      if (name !== undefined && name.length < 2) return false;
      if (id === null) {
        const next = { ...mainPlan, ...(name !== undefined ? { name } : {}), ...(changes.icon !== undefined ? { icon: changes.icon } : {}) };
        setMainPlan(next);
        if (userId) {
          try {
            localStorage.setItem(mainKey(userId), JSON.stringify(next));
          } catch {
            // sem armazenamento local
          }
        }
        await PlansService.saveMain(next);
        return true;
      }
      await persistPlans(
        plans.map((p) => (p.id === id ? { ...p, ...(name !== undefined ? { name } : {}), ...(changes.icon !== undefined ? { icon: changes.icon } : {}) } : p))
      );
      return true;
    },
    [mainPlan, plans, persistPlans, userId]
  );

  const deletePlan = useCallback(
    async (id: string) => {
      if (!userId || !plans.some((p) => p.id === id)) return false;
      // Sai do planejamento antes de apagá-lo
      if (activePlanId === id) switchPlan(null);
      const ok = await PlansService.deleteData(id);
      if (!ok) return false;
      clearPlanLocalData(userId, id);
      const remaining = plans.filter((p) => p.id !== id);
      await persistPlans(remaining);
      setActivePlan(activePlanId === id ? null : activePlanId, remaining.length > 0);
      return true;
    },
    [userId, plans, activePlanId, switchPlan, persistPlans]
  );

  // Só entram na soma planejamentos que ainda existem
  const compareIds = useMemo(
    () => compareRaw.filter((k) => k === MAIN_PLAN_KEY || plans.some((p) => p.id === k)),
    [compareRaw, plans]
  );

  const toggleCompare = useCallback(
    (key: string) => {
      setCompareRaw((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        if (userId) {
          try {
            localStorage.setItem(compareKey(userId), JSON.stringify(next));
          } catch {
            // sem armazenamento local
          }
        }
        return next;
      });
    },
    [userId]
  );

  // Em conta compartilhada vale o planejamento do dono, nunca um extra do visitante
  const effectiveActiveId = viewing ? null : activePlanId;
  // A soma precisa de pelo menos dois planejamentos marcados; em conta compartilhada não se aplica
  const consolidated = consolidatedOpen && !viewing && compareIds.length >= 2;
  const value = useMemo<PlanScopeContextType>(
    () => ({
      plans,
      activePlanId: effectiveActiveId,
      activePlan: plans.find((p) => p.id === effectiveActiveId) || null,
      createPlan,
      renamePlan,
      mainPlan,
      updatePlan,
      settingsOpen,
      setSettingsOpen,
      deletePlan,
      switchPlan,
      compareIds,
      toggleCompare,
      consolidated,
      setConsolidated: setConsolidatedOpen,
    }),
    [plans, effectiveActiveId, createPlan, renamePlan, mainPlan, updatePlan, settingsOpen, deletePlan, switchPlan, compareIds, toggleCompare, consolidated]
  );

  return <PlanScopeContext.Provider value={value}>{children}</PlanScopeContext.Provider>;
};

export const usePlans = (): PlanScopeContextType => {
  const ctx = useContext(PlanScopeContext);
  if (!ctx) {
    // Fora do provedor (ex.: testes): só o planejamento principal
    return { plans: [], activePlanId: null, activePlan: null, createPlan: async () => ({ ok: false, error: 'ERRO' }), renamePlan: async () => {}, mainPlan: { name: DEFAULT_MAIN_NAME }, updatePlan: async () => false, settingsOpen: false, setSettingsOpen: () => {}, deletePlan: async () => false, switchPlan: () => {}, compareIds: [], toggleCompare: () => {}, consolidated: false, setConsolidated: () => {} };
  }
  return ctx;
};
