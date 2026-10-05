import { SupabaseService } from '../../services/supabaseService';
import { type FinancialCheckpoint, type MonthlyClosing } from '../../types';
import { useEffect, useMemo, useState } from 'react';
import type { useCoreData } from './useCoreData';

type Deps = Pick<ReturnType<typeof useCoreData>, 'user'>;

/** Marcos de acompanhamento financeiro, cenários e fechamentos mensais. */
export function useCheckpoints({ user }: Deps) {
  const [checkpoints, setCheckpoints] = useState<FinancialCheckpoint[]>(() => {
    try {
      const savedUser = user ? localStorage.getItem(`balder_checkpoints_${user.$id}`) : null;
      if (savedUser) return JSON.parse(savedUser);
      const savedGuest = localStorage.getItem('balder_checkpoints_guest');
      if (savedGuest) return JSON.parse(savedGuest);
    } catch {}
    return [];
  });

  // Checkpoint ativo (o único com isActive = true, ou null se ainda não configurado)

  const activeCheckpoint = useMemo(
    () => checkpoints.find((cp) => cp.isActive) ?? null,
    [checkpoints]
  );

  // Persistência dos checkpoints (apenas salva quando houver checkpoints definidos, evitando sobrescrita por array vazio)

  useEffect(() => {
    if (user && !user.isGuest && checkpoints.length > 0) {
      localStorage.setItem(`balder_checkpoints_${user.$id}`, JSON.stringify(checkpoints));
    }
  }, [checkpoints, user]);

  // Adicionar novo checkpoint (desativa todos os anteriores)

  const addCheckpoint = (cp: Omit<FinancialCheckpoint, 'id' | 'createdAt' | 'isActive'>) => {
    const newCp: FinancialCheckpoint = {
      ...cp,
      id: `cp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setCheckpoints((prev) => {
      const next = [...prev.map((c) => ({ ...c, isActive: false })), newCp];
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao salvar checkpoint:', e);
      }
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.upsertCheckpoint(newCp).catch(console.error);
      SupabaseService.saveUserProfileSettings({
        checkpoints: [...checkpoints.map((c) => ({ ...c, isActive: false })), newCp],
      }).catch(console.error);
    }
    return newCp.id;
  };

  // Ativar um checkpoint existente pelo ID (garante que estritamente apenas 1 fique ativo)

  const activateCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const next = prev.map((c) => ({ ...c, isActive: c.id === id }));
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao ativar checkpoint:', e);
      }
      if (user && !user.isGuest) {
        next.forEach((c) => {
          SupabaseService.upsertCheckpoint(c).catch(console.error);
        });
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Atualizar dados de um checkpoint existente (rótulo, notas, tipo, etc.)

  const updateCheckpoint = (id: string, updates: Partial<FinancialCheckpoint>) => {
    setCheckpoints((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao atualizar checkpoint:', e);
      }
      if (user && !user.isGuest) {
        const updated = next.find((c) => c.id === id);
        if (updated) {
          SupabaseService.upsertCheckpoint(updated).catch(console.error);
        }
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Arquivar um checkpoint

  const archiveCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target) return prev;
      
      const wasActive = target.isActive;
      let next = prev.map((c) => (c.id === id ? { ...c, isArchived: true, isActive: false } : c));
      
      // Se era o marco ativo, ativa o primeiro não-arquivado restante
      if (wasActive) {
        const nextCandidate = next.find((c) => !c.isArchived);
        if (nextCandidate) {
          next = next.map((c) => ({ ...c, isActive: c.id === nextCandidate.id }));
        }
      }

      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {}
      if (user && !user.isGuest) {
        next.forEach((c) => SupabaseService.upsertCheckpoint(c).catch(console.error));
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Desarquivar um checkpoint

  const unarchiveCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, isArchived: false } : c));
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {}
      if (user && !user.isGuest) {
        const updated = next.find((c) => c.id === id);
        if (updated) SupabaseService.upsertCheckpoint(updated).catch(console.error);
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Excluir um checkpoint existente pelo ID

  const deleteCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.some((c) => c.isActive) && next.length > 0) {
        // Ativa o primeiro não-arquivado
        const candidate = next.find((c) => !c.isArchived) || next[0];
        candidate.isActive = true;
      }
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao excluir checkpoint:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.deleteCheckpoint(id).catch(console.error);
        const activeOne = next.find((c) => c.isActive);
        if (activeOne) {
          SupabaseService.upsertCheckpoint(activeOne).catch(console.error);
        }
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Zerar Todos os Marcos: exclusão definitiva (memória, caches local/convidado e nuvem),
  // sem que o carregamento seguinte os restaure a partir de caches antigos

  const duplicateCheckpointAsSimulation = (id: string, newLabel?: string) => {
    const source = checkpoints.find((c) => c.id === id);
    if (!source) return;
    const clone: FinancialCheckpoint = {
      ...source,
      id: `cp_sim_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      label: newLabel || `Simulação de ${source.label || 'Cenário'}`,
      type: 'SIMULATION',
      isActive: false,
      isArchived: false,
      notes: `Cenário simulado a partir de ${source.label || source.startDate}`,
    };
    setCheckpoints((prev) => {
      const next = [...prev, clone];
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {}
      if (user && !user.isGuest) {
        SupabaseService.upsertCheckpoint(clone).catch(console.error);
        SupabaseService.saveUserProfileSettings({ checkpoints: next }).catch(console.error);
      }
      return next;
    });
  };

  // Fechamentos Mensais de Competência (Reconciliação e carryover de saldo)

  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>(() => {
    try {
      const savedUser = user ? localStorage.getItem(`balder_monthly_closings_${user.$id}`) : null;
      if (savedUser) return JSON.parse(savedUser);
      const savedGuest = localStorage.getItem('balder_monthly_closings_guest');
      if (savedGuest) return JSON.parse(savedGuest);
    } catch {}
    return [];
  });

  // Persistência de fechamentos mensais

  useEffect(() => {
    if (user && !user.isGuest && monthlyClosings.length > 0) {
      localStorage.setItem(`balder_monthly_closings_${user.$id}`, JSON.stringify(monthlyClosings));
    }
  }, [monthlyClosings, user]);

  const closeMonth = (
    monthKey: string,
    closingBalance: number,
    projectedBalance: number,
    notes?: string
  ) => {
    const newClosing: MonthlyClosing = {
      id: `closing_${monthKey}_${Date.now()}`,
      monthKey,
      closedAt: new Date().toISOString(),
      closingBalance,
      projectedBalance,
      adjustmentAmount: Math.round((closingBalance - projectedBalance) * 100) / 100,
      status: 'FECHADO',
      notes,
    };
    setMonthlyClosings((prev) => {
      const filtered = prev.filter((c) => c.monthKey !== monthKey);
      const next = [...filtered, newClosing];
      const storageKey =
        user && !user.isGuest ? `balder_monthly_closings_${user.$id}` : 'balder_monthly_closings_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao salvar fechamento mensal:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ monthlyClosings: next }).catch(console.error);
      }
      return next;
    });
  };

  const reopenMonth = (monthKey: string) => {
    setMonthlyClosings((prev) => {
      const next = prev.filter((c) => c.monthKey !== monthKey);
      const storageKey =
        user && !user.isGuest ? `balder_monthly_closings_${user.$id}` : 'balder_monthly_closings_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao reabrir competência:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ monthlyClosings: next }).catch(console.error);
      }
      return next;
    });
  };

  const getMonthlyClosing = (monthKey: string): MonthlyClosing | undefined => {
    return monthlyClosings.find((c) => c.monthKey === monthKey);
  };

  // -------------------------------------------------------------
  // Acompanhamento Mútuo & Planejamento Compartilhado
  // -------------------------------------------------------------
  // Preferência do Acompanhamento Principal (INDIVIDUAL ou COMPARTILHADO)

  return {
    checkpoints, setCheckpoints, activeCheckpoint, addCheckpoint, activateCheckpoint,
    updateCheckpoint, archiveCheckpoint, unarchiveCheckpoint, deleteCheckpoint,
    duplicateCheckpointAsSimulation, monthlyClosings, setMonthlyClosings, closeMonth, reopenMonth,
    getMonthlyClosing,
  };
}
