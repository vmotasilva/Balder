import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { UNLIMITED, computeEntitlements, snapshotFromRow, type Entitlements, type SubscriptionSnapshot } from '../utils/entitlements';

interface EntitlementsContextType extends Entitlements {
  /** Recarrega a assinatura (o gestor pode ter mudado o plano). */
  refresh: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsContextType>({ ...UNLIMITED, refresh: async () => {} });

/** Carrega o plano do usuário logado e expõe o que ele permite. */
export const EntitlementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const userId = user && !user.isGuest ? user.$id : null;

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setSnapshot(null);
      return;
    }
    const { data, error } = await supabase
      .from('user_subscriptions')
      // subscription_plans(*) não quebra se alguma coluna nova do plano ainda não existir no banco
      .select('*, subscription_plans(*)')
      .eq('user_id', userId)
      .maybeSingle();
    // Falha de leitura (ou script ainda não rodado) não trava o app
    setSnapshot(error ? null : snapshotFromRow(data));
  }, [userId]);

  useEffect(() => {
    void refresh();
    // Pega mudanças feitas pelo gestor quando o usuário volta para a aba
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo(() => ({ ...computeEntitlements(snapshot), refresh }), [snapshot, refresh]);
  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useEntitlements = () => useContext(EntitlementsContext);
