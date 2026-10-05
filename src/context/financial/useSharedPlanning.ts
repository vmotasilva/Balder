import { SupabaseService } from '../../services/supabaseService';
import { recalcPendingSettlements } from '../../utils/sharedSplit';
import {
  type SharedScenario, type SharedSettlementItem, type SharedSplitRule, type TrackingScopeMode,
} from '../../types';
import { useState } from 'react';
import { withoutDemoPartner, withoutDemoSettlements } from './sharedAccess';
import type { useCoreData } from './useCoreData';

type Deps = Pick<ReturnType<typeof useCoreData>, 'user'>;

/** Escopo de acompanhamento, planejamento compartilhado e acertos entre os membros. */
export function useSharedPlanning({ user }: Deps) {
  const [defaultTrackingScope, setDefaultTrackingScopeState] = useState<TrackingScopeMode>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_default_scope_${user.$id}` : 'balder_default_scope';
      const saved = localStorage.getItem(storageKey);
      if (saved === 'COMPARTILHADO' || saved === 'INDIVIDUAL') return saved;
    } catch {}
    return 'INDIVIDUAL';
  });

  // Escopo de Acompanhamento Ativo no Momento

  const [activeTrackingScope, setActiveTrackingScope] = useState<TrackingScopeMode>(() => defaultTrackingScope);

  const setDefaultTrackingScope = (scope: TrackingScopeMode) => {
    setDefaultTrackingScopeState(scope);
    const storageKey = user && !user.isGuest ? `balder_default_scope_${user.$id}` : 'balder_default_scope';
    try {
      localStorage.setItem(storageKey, scope);
    } catch {}
    if (user && !user.isGuest) {
      SupabaseService.saveUserProfileSettings({ defaultTrackingScope: scope }).catch(console.error);
    }
  };

  // Cenário de Planejamento Compartilhado. O cenário de exemplo (com parceira fictícia) é só do modo
  // convidado; na conta real começa vazio até haver um compartilhamento de verdade.

  const isRealUser = !!user && !user.isGuest;

  const [sharedScenario, setSharedScenario] = useState<SharedScenario | null>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_shared_scenario_${user.$id}` : 'balder_shared_scenario';
      const saved = localStorage.getItem(storageKey);
      if (saved) return isRealUser ? withoutDemoPartner(JSON.parse(saved)) : JSON.parse(saved);
    } catch {}
    if (isRealUser) return null;

    // Cenário de exemplo (modo convidado)
    return {
      id: 'shared_default',
      name: 'Planejamento Familiar & Casal',
      createdAt: new Date().toISOString(),
      inviteCode: 'BALDER-CASAL-7829',
      status: 'ACTIVE',
      members: [
        {
          id: user?.$id || 'user_owner',
          name: user?.name || 'Vinicius Mota Silva',
          email: user?.email || 'vinicius@balder.app',
          role: 'OWNER',
          status: 'ACTIVE',
          monthlyIncome: 8500,
          color: '#06b6d4',
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'partner_1',
          name: 'Camila Silva',
          email: 'camila@email.com',
          role: 'PARTNER',
          status: 'ACTIVE',
          monthlyIncome: 5200,
          color: '#ec4899',
          joinedAt: new Date().toISOString(),
        },
      ],
      splitMode: 'PROPORTIONAL_INCOME',
      userSharePercent: 62,
      partnerSharePercent: 38,
      notes: 'Rateio proporcional calculado com base na renda líquida mensal de cada parceiro.',
    };
  });

  // Lista de Despesas e Acertos Mútuos Compartilhados
  // Exibição das naturezas no detalhamento (guardada no perfil: não exige coluna nova na tabela natures)

  const [sharedSettlements, setSharedSettlements] = useState<SharedSettlementItem[]>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      const saved = localStorage.getItem(storageKey);
      if (saved) return isRealUser ? withoutDemoSettlements(JSON.parse(saved)) : JSON.parse(saved);
    } catch {}
    if (isRealUser) return [];

    const todayYm = new Date().toISOString().substring(0, 7);
    return [
      {
        id: 'settle_1',
        title: 'Supermercado Mensal (Compras Grandes)',
        category: 'Alimentação',
        totalAmount: 1450,
        paidBy: 'USER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 899,
        partnerOwes: 551,
        date: `${todayYm}-05`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_2',
        title: 'Energia Elétrica & Gás',
        category: 'Moradia',
        totalAmount: 380,
        paidBy: 'PARTNER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 235.60,
        partnerOwes: 144.40,
        date: `${todayYm}-10`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_3',
        title: 'Condomínio Residencial',
        category: 'Moradia',
        totalAmount: 650,
        paidBy: 'USER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 403,
        partnerOwes: 247,
        date: `${todayYm}-15`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_4',
        title: 'Internet Fibra 600MB',
        category: 'Moradia',
        totalAmount: 140,
        paidBy: 'PARTNER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 86.80,
        partnerOwes: 53.20,
        date: `${todayYm}-20`,
        status: 'PENDENTE',
      },
    ];
  });

  const updateSharedScenario = (updates: Partial<SharedScenario>) => {
    setSharedScenario((prev) => {
      // Sem cenário ainda: cria um novo (ex.: ao incluir no planejamento alguém que aceitou o convite)
      const base: SharedScenario = prev ?? {
        id: `shared_${Date.now()}`,
        name: 'Planejamento a dois',
        createdAt: new Date().toISOString(),
        inviteCode: '',
        status: 'ACTIVE',
        members: [],
        splitMode: 'EQUAL_50_50',
        userSharePercent: 50,
        partnerSharePercent: 50,
      };
      const updated = { ...base, ...updates };
      const storageKey = user && !user.isGuest ? `balder_shared_scenario_${user.$id}` : 'balder_shared_scenario';
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedScenario: updated }).catch(console.error);
      }
      return updated;
    });
  };

  /**
   * Grava o histórico de divisão/contribuição e recalcula as despesas conjuntas ainda pendentes
   * a partir da competência alterada (as já acertadas ficam como foram fechadas).
   */

  const setSharedSplitRules = (rules: SharedSplitRule[], fromCompetence: string) => {
    if (!sharedScenario) return;
    // O modo do cenário segue como a regra de antes da primeira mudança registrada
    const withRules: SharedScenario = { ...sharedScenario, splitHistory: rules };
    updateSharedScenario({ splitHistory: rules });
    setSharedSettlements((prev) => {
      const next = recalcPendingSettlements(prev, withRules, fromCompetence);
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  const addSharedSettlement = (item: Omit<SharedSettlementItem, 'id'>) => {
    const newItem: SharedSettlementItem = {
      ...item,
      id: `settle_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setSharedSettlements((prev) => {
      const next = [newItem, ...prev];
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  const toggleSharedSettlementStatus = (id: string) => {
    setSharedSettlements((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, status: (s.status === 'PENDENTE' ? 'ACERTADO' : 'PENDENTE') as 'PENDENTE' | 'ACERTADO' } : s));
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  const settleAllSharedDebts = () => {
    setSharedSettlements((prev) => {
      const next = prev.map((s) => ({ ...s, status: 'ACERTADO' as const }));
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  // Movimentações Financeiras

  return {
    defaultTrackingScope, setDefaultTrackingScopeState, activeTrackingScope,
    setActiveTrackingScope, setDefaultTrackingScope, sharedScenario, setSharedScenario,
    sharedSettlements, setSharedSettlements, updateSharedScenario, setSharedSplitRules,
    addSharedSettlement, toggleSharedSettlementStatus, settleAllSharedDebts,
  };
}
