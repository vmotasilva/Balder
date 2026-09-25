import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AppUser {
  $id: string; // Mapeado a partir de user.id do Supabase para total compatibilidade retroativa
  name: string;
  email: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
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

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
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
      email: 'vinicius@balder.app',
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
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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
