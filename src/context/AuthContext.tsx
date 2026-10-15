import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ReferralService } from '../services/referralService';
import { clearAllChats } from '../utils/forsetiChatStore';
import { listSavedAccounts, removeSavedAccount, upsertSavedAccount, type SavedAccount } from '../utils/accountStore';

export interface AppUser {
  $id: string; // Mapeado a partir de user.id do Supabase para total compatibilidade retroativa
  name: string;
  email: string;
  isGuest?: boolean;
}

export type SystemRole = 'USUARIO' | 'DESENVOLVEDOR' | 'GESTOR';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  /** Papel no sistema Balder (user_profiles.system_role). Convidado e deslogado são USUARIO. */
  systemRole: SystemRole;
  /** Só o GESTOR vê o módulo de gestão; o banco reforça a regra. */
  isManager: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  /** Contas conectadas neste aparelho (inclui a ativa). */
  savedAccounts: SavedAccount[];
  /** Troca para outra conta já conectada; recarrega o app em caso de sucesso. */
  switchAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Mantém as contas salvas e abre a tela de login para entrar com outro e-mail. */
  addAccount: () => Promise<void>;
  removeAccount: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemRole, setSystemRole] = useState<SystemRole>('USUARIO');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => listSavedAccounts());

  const userId = user && !user.isGuest ? user.$id : null;
  // Quem chegou por um link de convite fica ligado a quem indicou (uma vez; o banco recusa contas antigas)
  useEffect(() => {
    if (userId) void ReferralService.claimPending();
  }, [userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setSystemRole('USUARIO');
      return;
    }
    let cancelled = false;
    supabase
      .from('user_profiles')
      .select('system_role')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSystemRole((data?.system_role as SystemRole) || 'USUARIO');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    checkSession();

    if (!isSupabaseConfigured) {
      return;
    }

    // Escuta mudanças de autenticação no Supabase em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        rememberSession(session);
        setUser((prev) => {
          if (prev && !prev.isGuest && prev.$id === session.user.id && prev.email === (session.user.email || '')) {
            return prev;
          }
          return {
            $id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || '',
            isGuest: false,
          };
        });
        sessionStorage.removeItem('balder_guest_user');
      } else {
        // Se deslogou no Supabase, verifica se há modo convidado ativo
        const guest = sessionStorage.getItem('balder_guest_user');
        if (guest) {
          try {
            setUser(JSON.parse(guest));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Guarda (e mantém atualizados) os tokens da conta ativa para poder voltar a ela depois de alternar
  const rememberSession = (session: Session) => {
    setSavedAccounts(
      upsertSavedAccount({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    );
  };

  const checkSession = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user && !error) {
          rememberSession(session);
          setUser((prev) => {
            if (prev && !prev.isGuest && prev.$id === session.user.id && prev.email === (session.user.email || '')) {
              return prev;
            }
            return {
              $id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
              email: session.user.email || '',
              isGuest: false,
            };
          });
          setIsLoading(false);
          return;
        }
      }

      // Verifica se convidado estava ativo no sessionStorage
      const guest = sessionStorage.getItem('balder_guest_user');
      if (guest) {
        try {
          setUser(JSON.parse(guest));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // No APK (WebView) o login usa o seletor nativo de contas do Android; o app devolve o id_token
  // como evento `balder-native-google`. Se o nativo não estiver disponível, cai no fluxo web.
  const loginWithGoogleNative = () =>
    new Promise<'success' | 'cancelled' | 'unavailable'>((resolve) => {
      // Sem confirmação rápida do app, ele é uma versão sem login nativo: segue pelo fluxo web.
      let timeout = window.setTimeout(() => {
        window.alert('O app não respondeu ao login nativo do Google (versão do app sem o recurso ou site em cache). Usando o login pelo navegador.');
        finish('unavailable');
      }, 1500);
      const finish = (result: 'success' | 'cancelled' | 'unavailable') => {
        window.clearTimeout(timeout);
        window.removeEventListener('balder-native-google', onResult);
        resolve(result);
      };
      const onResult = async (e: Event) => {
        const detail = (e as CustomEvent<{ status?: string; idToken?: string; reason?: string }>).detail;
        if (detail?.status === 'ack') {
          window.clearTimeout(timeout);
          timeout = window.setTimeout(() => finish('unavailable'), 120000);
          return;
        }
        if (detail?.reason) {
          window.alert(`Login nativo do Google indisponível: ${detail.reason}`);
        }
        if (detail?.status === 'success' && detail.idToken) {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: detail.idToken });
          if (error) {
            console.error('[Supabase Auth] Erro no login Google nativo:', error.message);
            window.alert(`Login nativo do Google recusado pelo Supabase: ${error.message}`);
            finish('unavailable');
          } else {
            finish('success');
          }
        } else {
          finish(detail?.status === 'cancelled' ? 'cancelled' : 'unavailable');
        }
      };
      window.addEventListener('balder-native-google', onResult);
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'balder:google-signin' }));
    });

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      if ((window as any).ReactNativeWebView) {
        const result = await loginWithGoogleNative();
        if (result !== 'unavailable') return;
      }
      const currentUrl = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl,
          // Com contas já salvas, deixa escolher outro e-mail em vez de reaproveitar o último do Google
          ...(listSavedAccounts().length > 0 ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
      if (error) {
        console.error('[Supabase Auth] Erro ao iniciar login Google:', error.message);
      }
    } catch (err) {
      console.error('[Supabase Auth] Exceção no login Google:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase não configurado. Por favor, adicione as chaves no arquivo .env ou continue como Convidado.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser({
          $id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuário',
          email: data.user.email || '',
          isGuest: false,
        });
        sessionStorage.removeItem('balder_guest_user');
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha na autenticação' };
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase não configurado. Adicione as chaves no arquivo .env.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session && data.user) {
        setUser({
          $id: data.user.id,
          name: data.user.user_metadata?.name || name || data.user.email?.split('@')[0] || 'Usuário',
          email: data.user.email || '',
          isGuest: false,
        });
        sessionStorage.removeItem('balder_guest_user');
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha no cadastro' };
    }
  };

  const continueAsGuest = () => {
    const guestUser: AppUser = {
      $id: 'guest_local_user',
      name: 'Vinicius Mota (Demo)',
      email: 'vinicius@balder.app',
      isGuest: true,
    };
    sessionStorage.setItem('balder_guest_user', JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const logout = async () => {
    try {
      if (!user?.isGuest && isSupabaseConfigured) {
        if (user) setSavedAccounts(removeSavedAccount(user.$id));
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      sessionStorage.removeItem('balder_guest_user');
      // A conversa com a Forseti não fica no aparelho depois de sair da conta
      clearAllChats();
      setUser(null);
    }
  };

  const switchAccount = async (id: string) => {
    const target = listSavedAccounts().find((a) => a.id === id);
    if (!target) return { success: false, error: 'Conta não encontrada neste aparelho.' };
    if (user && !user.isGuest && user.$id === id) return { success: true };
    try {
      const { error } = await supabase.auth.setSession({
        access_token: target.access_token,
        refresh_token: target.refresh_token,
      });
      if (error) {
        // Sessão expirada ou revogada: a conta precisa entrar de novo
        setSavedAccounts(removeSavedAccount(id));
        return { success: false, error: `A sessão de ${target.email} expirou. Entre novamente com essa conta.` };
      }
      // Recarrega para nenhum dado da conta anterior ficar em memória
      window.location.reload();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha ao trocar de conta' };
    }
  };

  const addAccount = async () => {
    try {
      // scope local: sai deste aparelho sem revogar a sessão (que continua salva para voltar depois)
      if (!user?.isGuest && isSupabaseConfigured) await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Add account error', error);
    } finally {
      sessionStorage.removeItem('balder_guest_user');
      setUser(null);
    }
  };

  const removeAccount = (id: string) => setSavedAccounts(removeSavedAccount(id));

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        systemRole,
        isManager: systemRole === 'GESTOR',
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        continueAsGuest,
        logout,
        savedAccounts,
        switchAccount,
        addAccount,
        removeAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
