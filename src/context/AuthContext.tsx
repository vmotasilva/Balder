import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ReferralService } from '../services/referralService';
import { clearAllChats } from '../utils/forsetiChatStore';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemRole, setSystemRole] = useState<SystemRole>('USUARIO');

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

  const checkSession = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user && !error) {
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
      email: 'vinicius@getbalder.com',
      isGuest: true,
    };
    sessionStorage.setItem('balder_guest_user', JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const logout = async () => {
    try {
      if (!user?.isGuest && isSupabaseConfigured) {
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
