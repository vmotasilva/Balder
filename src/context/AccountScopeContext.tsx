import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { setDataOwner } from '../services/supabaseService';
import { SharingService, type AccountShare, type SharePermissions, type ShareRole, type ShareScope } from '../services/sharingService';

/** Conta compartilhada aberta no momento (null = a própria conta). */
export interface ViewingAccount {
  shareId: string;
  ownerId: string;
  ownerName: string;
  role: ShareRole;
  scope: ShareScope;
  /** Conta compartilhada autorizada como principal: o Balder abre direto nela. */
  isPrimary?: boolean;
  /** O que o colaborador pode fazer nesta conta. */
  permissions?: SharePermissions;
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

/** Escolha já feita nesta sessão: uma conta compartilhada, a própria conta ('OWN') ou nada (null). */
const readStored = (userId?: string): ViewingAccount | 'OWN' | null => {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as (ViewingAccount & { viewerId?: string }) | { own: true; viewerId?: string };
    if (parsed.viewerId !== userId) return null;
    return 'own' in parsed ? 'OWN' : parsed;
  } catch {
    return null;
  }
};

const toViewing = (share: AccountShare): ViewingAccount => ({
  shareId: share.id,
  ownerId: share.ownerId,
  ownerName: share.ownerName || share.ownerEmail || 'Conta compartilhada',
  role: share.role,
  scope: share.scope,
  isPrimary: share.primaryStatus === 'APROVADO',
  permissions: share.permissions,
});

export const AccountScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isRealUser = !!user && !user.isGuest;

  const [initialChoice] = useState(() => (isRealUser ? readStored(user?.$id) : null));
  const [viewing, setViewing] = useState<ViewingAccount | null>(() => {
    const stored = initialChoice === 'OWN' ? null : initialChoice;
    // O dono dos dados precisa estar definido antes do carregamento da conta
    setDataOwner(stored?.ownerId ?? null);
    return stored;
  });
  // Sem escolha nesta sessão, confere se há conta compartilhada principal antes de carregar os dados
  const [resolving, setResolving] = useState(isRealUser && initialChoice === null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback(
    (next: ViewingAccount | null) => {
      setDataOwner(next?.ownerId ?? null);
      try {
        // Guarda também a volta para a própria conta, para não reabrir a principal ao recarregar
        if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next ? { ...next, viewerId: user.$id } : { own: true, viewerId: user.$id }));
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
      apply(toViewing(share));
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

  // Abre direto na conta compartilhada autorizada como principal; sem ela, segue na conta individual
  useEffect(() => {
    if (!resolving) return;
    // Se o banco demorar, abre a conta individual e ignora a resposta atrasada (não troca de conta no meio do uso)
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      cancelled = true;
      setResolving(false);
    }, 5000);
    void SharingService.getApprovedPrimary()
      .then((share) => {
        if (!cancelled && share) apply(toViewing(share));
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(fallback);
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [resolving, apply]);

  // Avisa quem compartilhou que há pedido para usar a conta como principal
  useEffect(() => {
    if (!isRealUser || resolving) return;
    let cancelled = false;
    void SharingService.listMyShares()
      .then((shares) => {
        const asking = shares.filter((s) => s.status === 'ATIVO' && s.primaryStatus === 'SOLICITADO');
        if (cancelled || asking.length === 0) return;
        const names = asking.map((s) => s.memberName || s.memberEmail).join(', ');
        setNotice(`${names} pediu para usar a sua conta como principal. Responda em Planejamento Compartilhado.`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isRealUser, resolving]);

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
      const isPrimary = share.primaryStatus === 'APROVADO';
      const permissionsChanged = JSON.stringify(share.permissions || {}) !== JSON.stringify(viewing.permissions || {});
      if (share.role !== viewing.role || share.scope !== viewing.scope || isPrimary !== !!viewing.isPrimary || permissionsChanged) {
        apply({ ...viewing, role: share.role, scope: share.scope, isPrimary, permissions: share.permissions });
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

  if (resolving) {
    return <div className="loading-screen">Carregando Balder...</div>;
  }

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
