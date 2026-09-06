import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Models } from 'react-native-appwrite';
import { account } from '../lib/appwrite';

export type UserType = Models.User<Models.DefaultPreferences>;

export interface AuthContextData {
  user: UserType | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkSession = async () => {
    try {
      setIsLoading(true);
      const currentUser = await account.get();
      setUser(currentUser);
    } catch {
      // Unauthenticated / expired session is expected if no user is logged in
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await account.createEmailPasswordSession(email, password);
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAnonymously = async () => {
    setIsLoading(true);
    try {
      await account.createAnonymousSession();
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.warn('Erro ao finalizar sessão no Appwrite:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginAnonymously,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
