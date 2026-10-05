import { SupabaseService } from '../../services/supabaseService';
import { type NatureDetailMode, type ViewPreferences } from '../../types';
import { useState } from 'react';
import type { useCoreData } from './useCoreData';

type Deps = Pick<ReturnType<typeof useCoreData>, 'user'>;

/** Preferências locais da pessoa: detalhe das naturezas, dinheiro em mãos por marco, horizonte da projeção, tela inicial e contratos arquivados. */
export function usePreferences({ user }: Deps) {
  const natureDetailModesKey = user && !user.isGuest ? `balder_nature_detail_modes_${user.$id}` : 'balder_nature_detail_modes_guest';

  const [natureDetailModes, setNatureDetailModes] = useState<Record<string, NatureDetailMode>>(() => {
    try {
      const saved = localStorage.getItem(natureDetailModesKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const setNatureDetailMode = (natureId: string, mode: NatureDetailMode) => {
    setNatureDetailModes((prev) => {
      const next = { ...prev };
      if (mode === 'ITENS') delete next[natureId];
      else next[natureId] = mode;
      try {
        localStorage.setItem(natureDetailModesKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ natureDetailModes: next }).catch(console.error);
      }
      return next;
    });
  };

  // Dinheiro em mãos no início de cada marco (guardado no perfil: a tabela de marcos não tem esse campo)

  const cashInHandKey = user && !user.isGuest ? `balder_checkpoint_cash_${user.$id}` : 'balder_checkpoint_cash_guest';

  const [checkpointCashInHand, setCheckpointCashInHandState] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(cashInHandKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const setCheckpointCashInHand = (checkpointId: string, amount: number) => {
    setCheckpointCashInHandState((prev) => {
      const next = { ...prev };
      if (amount > 0) next[checkpointId] = Math.round(amount * 100) / 100;
      else delete next[checkpointId];
      try {
        localStorage.setItem(cashInHandKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ checkpointCashInHand: next }).catch(console.error);
      }
      return next;
    });
  };

  // Horizonte da projeção: preferência de exibição de quem está usando (guardada no próprio perfil)

  const horizonKey = user && !user.isGuest ? `balder_projection_horizon_${user.$id}` : 'balder_projection_horizon_guest';

  const [projectionHorizonMonths, setProjectionHorizonState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(horizonKey));
      if (saved > 0) return saved;
    } catch {}
    return 60;
  });

  const setProjectionHorizonMonths = (months: number) => {
    setProjectionHorizonState(months);
    try {
      localStorage.setItem(horizonKey, String(months));
    } catch {}
    if (user && !user.isGuest) {
      SupabaseService.saveUserProfileSettings({ projectionHorizonMonths: months }).catch(console.error);
    }
  };

  // Preferências de uso: guardadas no perfil de quem está usando

  const viewPrefsKey = user && !user.isGuest ? `balder_view_prefs_${user.$id}` : 'balder_view_prefs_guest';

  const [viewPreferences, setViewPreferencesState] = useState<ViewPreferences>(() => {
    try {
      const saved = localStorage.getItem(viewPrefsKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const setViewPreferences = (updates: Partial<ViewPreferences>) => {
    setViewPreferencesState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(viewPrefsKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ viewPreferences: next }).catch(console.error);
      }
      return next;
    });
  };

  // Contratos de empréstimo arquivados (guardados no perfil, como a exibição das naturezas)

  const archivedLoansKey = user && !user.isGuest ? `balder_archived_loans_${user.$id}` : 'balder_archived_loans_guest';

  const [archivedLoanGroups, setArchivedLoanGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(archivedLoansKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const persistArchivedLoans = (next: string[]) => {
    try {
      localStorage.setItem(archivedLoansKey, JSON.stringify(next));
    } catch {}
    if (user && !user.isGuest) {
      SupabaseService.saveUserProfileSettings({ archivedLoanGroups: next }).catch(console.error);
    }
  };

  const setLoanGroupArchived = (groupId: string, archived: boolean) => {
    setArchivedLoanGroups((prev) => {
      const next = archived ? Array.from(new Set([...prev, groupId])) : prev.filter((id) => id !== groupId);
      persistArchivedLoans(next);
      return next;
    });
  };

  return {
    natureDetailModesKey, natureDetailModes, setNatureDetailModes, setNatureDetailMode,
    checkpointCashInHand, setCheckpointCashInHandState, setCheckpointCashInHand,
    projectionHorizonMonths, setProjectionHorizonState, setProjectionHorizonMonths,
    viewPreferences, setViewPreferencesState, setViewPreferences, archivedLoanGroups,
    setArchivedLoanGroups, setLoanGroupArchived,
  };
}
