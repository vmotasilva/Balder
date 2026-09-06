import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Query, Models } from 'react-native-appwrite';
import { databases, APPWRITE_DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { useAuth } from './AuthContext';

export interface Workspace extends Models.Document {
  name: string;
  type: 'family' | 'business';
  created_at?: string;
}

export interface WorkspaceContextData {
  workspaces: Workspace[];
  selectedWorkspace: string;
  setSelectedWorkspace: (id: string) => void;
  activeWorkspace: Workspace | undefined;
  isLoadingWorkspaces: boolean;
  fetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextData>({} as WorkspaceContextData);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(true);

  const fetchWorkspaces = async () => {
    try {
      setIsLoadingWorkspaces(true);
      const response = await databases.listDocuments<Workspace>(
        APPWRITE_DATABASE_ID,
        COLLECTIONS.WORKSPACES,
        [Query.limit(20)]
      );

      const docs = response.documents;
      setWorkspaces(docs);

      if (docs.length > 0) {
        setSelectedWorkspace((prev) => {
          if (prev && docs.some((w) => w.$id === prev)) {
            return prev;
          }
          const defaultWs = docs.find((ws) => ws.type === 'family') || docs[0];
          return defaultWs.$id;
        });
      }
    } catch (error) {
      console.error('Erro ao carregar workspaces:', error);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  const activeWorkspace = workspaces.find((w) => w.$id === selectedWorkspace);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        selectedWorkspace,
        setSelectedWorkspace,
        activeWorkspace,
        isLoadingWorkspaces,
        fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextData {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace deve ser utilizado dentro de um WorkspaceProvider');
  }
  return context;
}
