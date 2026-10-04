import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';
import type { Investment, InvestmentType } from '../types';

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

/** Carteira de investimentos: cópia no aparelho (por usuário) sincronizada com o perfil na nuvem. */
export const useInvestments = () => {
  const { user } = useAuth();
  const isGuest = !user || user.isGuest;
  const key = !isGuest ? `balder_investments_${user.$id}` : 'balder_investments_guest';
  const [items, setItems] = useState<Investment[]>([]);

  useEffect(() => {
    let cancelled = false;
    let local: Investment[] = [];
    try {
      const saved = localStorage.getItem(key);
      local = saved ? JSON.parse(saved) : [];
    } catch {}
    setItems(local);
    if (isGuest) return;
    SupabaseService.getUserProfileSettings()
      .then((settings) => {
        if (cancelled) return;
        if (Array.isArray(settings?.investments)) {
          // A nuvem é a fonte da verdade: traz a carteira de outros aparelhos
          setItems(settings.investments);
          try {
            localStorage.setItem(key, JSON.stringify(settings.investments));
          } catch {}
        } else if (local.length > 0) {
          // Primeira sincronização: sobe o que já estava guardado no aparelho
          SupabaseService.saveUserProfileSettings({ investments: local }).catch(console.error);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [key, isGuest]);

  const persist = useCallback(
    (next: Investment[]) => {
      setItems(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      if (!isGuest) SupabaseService.saveUserProfileSettings({ investments: next }).catch(console.error);
    },
    [key, isGuest]
  );

  const save = useCallback(
    (inv: Investment) => {
      persist(items.some((i) => i.id === inv.id) ? items.map((i) => (i.id === inv.id ? inv : i)) : [...items, inv]);
    },
    [items, persist]
  );

  const remove = useCallback((id: string) => persist(items.filter((i) => i.id !== id)), [items, persist]);

  return { investments: items, saveInvestment: save, removeInvestment: remove };
};
