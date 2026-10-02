import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export type InvestmentType = 'RENDA_FIXA' | 'TESOURO' | 'ACOES' | 'FIIS' | 'FUNDOS' | 'CRIPTO' | 'OUTROS';

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  /** Quanto foi aplicado (custo) */
  invested: number;
  /** Valor atual de mercado */
  currentValue: number;
  /** Data da aplicação (YYYY-MM-DD) */
  date: string;
  note?: string;
}

export const INVESTMENT_TYPES: Record<InvestmentType, { label: string; color: string }> = {
  RENDA_FIXA: { label: 'Renda fixa', color: '#22d3ee' },
  TESOURO: { label: 'Tesouro Direto', color: '#34d399' },
  ACOES: { label: 'Ações', color: '#a78bfa' },
  FIIS: { label: 'FIIs', color: '#fbbf24' },
  FUNDOS: { label: 'Fundos', color: '#60a5fa' },
  CRIPTO: { label: 'Cripto', color: '#fb923c' },
  OUTROS: { label: 'Outros', color: '#94a3b8' },
};

/** Carteira de investimentos guardada no aparelho, separada por usuário. */
export const useInvestments = () => {
  const { user } = useAuth();
  const key = user && !user.isGuest ? `balder_investments_${user.$id}` : 'balder_investments_guest';
  const [items, setItems] = useState<Investment[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
  }, [key]);

  const persist = useCallback(
    (next: Investment[]) => {
      setItems(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key]
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
