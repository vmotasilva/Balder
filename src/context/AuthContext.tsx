import React, { createContext, useContext, useEffect, useState } from 'react';
import { OAuthProvider } from 'appwrite';
import { account } from '../lib/appwrite';

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const currentAccount = await account.get();
      setUser({
        $id: currentAccount.$id,
        name: currentAccount.name || currentAccount.email,
        email: currentAccount.email,
      });
    } catch (error) {
      // Check if guest was active in sessionStorage
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
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = () => {
    const currentUrl = window.location.origin;
    account.createOAuth2Session(OAuthProvider.Google, currentUrl, currentUrl);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await account.createEmailPasswordSession(email, pass);
      const current = await account.get();
      const mappedUser: AppUser = {
        $id: current.$id,
        name: current.name || current.email,
        email: current.email,
      };
      setUser(mappedUser);
      sessionStorage.removeItem('balder_guest_user');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha na autenticação' };
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    try {
      await account.create('unique()', email, pass, name);
      return await loginWithEmail(email, pass);
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
      if (!user?.isGuest) {
        await account.deleteSession('current');
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
