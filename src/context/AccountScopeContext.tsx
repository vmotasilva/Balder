import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { setDataOwner } from '../services/supabaseService';
import { SharingService, type AccountShare, type ShareRole, type ShareScope } from '../services/sharingService';

/** Conta compartilhada aberta no momento (null = a própria conta). */
export interface ViewingAccount {
  shareId: string;
  ownerId: string;
  ownerName: string;
  role: ShareRole;
  scope: ShareScope;
}

interface AccountScopeContextType {
  viewing: ViewingAccount | null;
  openSharedAccount: (share: AccountShare) => void;
  backToOwnAccount: (notice?: string) => void;
  /** Aviso a mostrar (ex.: acesso revogado). */
  notice: string | null;
  clearNotice: () => void;
}

const AccountScopeContext = createContext<AccountScopeContextType | undefined>(undefined);

const STORAGE_KEY = 'balder_viewing_account';
const POLL_MS = 30000;

const readStored = (userId?: string): ViewingAccount | null => {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewingAccount & { viewerId?: string };
    return parsed.viewerId === userId ? parsed : null;
  } catch {
    return null;
  }
};

export const AccountScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isRealUser = !!user && !user.isGuest;

  const [viewing, setViewing] = useState<ViewingAccount | null>(() => {
    const stored = isRealUser ? readStored(user?.$id) : null;
    // O dono dos dados precisa estar definido antes do carregamento da conta
    setDataOwner(stored?.ownerId ?? null);
    return stored;
  });
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback(
    (next: ViewingAccount | null) => {
      setDataOwner(next?.ownerId ?? null);
      try {
        if (next && user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, viewerId: user.$id }));
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // armazenamento indisponível
      }
      setViewing(next);
    },
    [user]
  );

  const openSharedAccount = useCallback(
    (share: AccountShare) => {
      apply({
        shareId: share.id,
        ownerId: share.ownerId,
        ownerName: share.ownerName || share.ownerEmail || 'Conta compartilhada',
        role: share.role,
        scope: share.scope,
      });
      window.scrollTo({ top: 0 });
    },
    [apply]
  );

  const backToOwnAccount = useCallback(
    (message?: string) => {
      apply(null);
      if (message) setNotice(message);
    },
    [apply]
  );

  // Saiu da conta ou trocou de usuário: volta para a própria conta
  useEffect(() => {
    if (!isRealUser && viewing) apply(null);
  }, [isRealUser, viewing, apply]);

  // Acompanha o acesso: revogado → volta na hora; papel/alcance alterados → aplica
  useEffect(() => {
    if (!viewing) return;
    let cancelled = false;
    const check = async () => {
      const share = await SharingService.getShareStatus(viewing.shareId);
      if (cancelled) return;
      if (!share || share.status !== 'ATIVO') {
        backToOwnAccount(`O acesso à conta de ${viewing.ownerName} foi encerrado.`);
        return;
      }
      if (share.role !== viewing.role || share.scope !== viewing.scope) {
        apply({ ...viewing, role: share.role, scope: share.scope });
      }
    };
    void check();
    const timer = window.setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [viewing, apply, backToOwnAccount]);

  return (
    <AccountScopeContext.Provider
      value={{ viewing, openSharedAccount, backToOwnAccount, notice, clearNotice: () => setNotice(null) }}
    >
      {children}
    </AccountScopeContext.Provider>
  );
};

export const useAccountScope = () => {
  const ctx = useContext(AccountScopeContext);
  if (!ctx) throw new Error('useAccountScope deve ser utilizado dentro de um AccountScopeProvider');
  return ctx;
};
