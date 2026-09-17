import { ID, Query, Permission, Role } from 'appwrite';
import { databases, account, databaseId, COLLECTIONS } from '../lib/appwrite';
import type { Movement, ExpenseNature, Goal } from '../types';

const isConfigured = () => !!databaseId;

// Sanitiza payload removendo chaves undefined para conformidade com a API do Appwrite
function cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as Partial<T>;
}

export const AppwriteService = {
  // ==========================================
  // MOVEMENTS
  // ==========================================
  async getMovements(): Promise<Movement[]> {
    if (!isConfigured()) return [];
    try {
      const response = await databases.listDocuments(databaseId, COLLECTIONS.MOVEMENTS, [
        Query.limit(100),
        Query.orderDesc('dueDate')
      ]);
      return response.documents.map(doc => ({
        id: doc.$id,
        title: doc.title,
        type: doc.type,
        amount: doc.amount,
        dueDate: doc.dueDate,
        bank: doc.bank,
        status: doc.status,
        category: doc.category,
        notes: doc.notes || undefined,
        installmentNumber: doc.installmentNumber || undefined,
        installmentsTotal: doc.installmentsTotal || undefined,
        installmentGroupId: doc.installmentGroupId || undefined,
        interestRatePercent: doc.interestRatePercent || undefined,
      })) as Movement[];
    } catch (e) {
      console.error('Error fetching movements:', e);
      return [];
    }
  },

  async addMovement(movement: Omit<Movement, 'id'>): Promise<Movement | null> {
    if (!isConfigured()) return null;
    try {
      let permissions: string[] = [];
      try {
        const user = await account.get();
        if (user && user.$id) {
          permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ];
        }
      } catch {
        // Se usuário anônimo ou sessão guest
      }

      const payload = cleanPayload(movement);
      const doc = await databases.createDocument(
        databaseId,
        COLLECTIONS.MOVEMENTS,
        ID.unique(),
        payload,
        permissions.length > 0 ? permissions : undefined
      );
      return { ...movement, id: doc.$id } as Movement;
    } catch (e) {
      console.error('Error adding movement to Appwrite:', e);
      return null;
    }
  },

  async updateMovement(id: string, updates: Partial<Movement>): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      const payload = cleanPayload(updates);
      delete payload.id;
      await databases.updateDocument(databaseId, COLLECTIONS.MOVEMENTS, id, payload);
      return true;
    } catch (e) {
      console.error('Error updating movement in Appwrite:', e);
      return false;
    }
  },

  async deleteMovement(id: string): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      await databases.deleteDocument(databaseId, COLLECTIONS.MOVEMENTS, id);
      return true;
    } catch (e) {
      console.error('Error deleting movement from Appwrite:', e);
      return false;
    }
  },

  // ==========================================
  // NATURES
  // ==========================================
  async getNatures(): Promise<ExpenseNature[]> {
    if (!isConfigured()) return [];
    try {
      const response = await databases.listDocuments(databaseId, COLLECTIONS.NATURES, [
        Query.limit(100)
      ]);
      return response.documents.map(doc => ({
        id: doc.$id,
        name: doc.name,
        initialBudget: doc.initialBudget || 0,
        description: doc.description || '',
        icon: doc.icon,
        color: doc.color,
        type: doc.type || 'FIXA',
        mappings: doc.mappings ? JSON.parse(doc.mappings) : [],
        overCeilingJustification: doc.overCeilingJustification || undefined,
        justificationHistory: doc.justificationHistory ? JSON.parse(doc.justificationHistory) : []
      })) as ExpenseNature[];
    } catch (e) {
      console.error('Error fetching natures:', e);
      return [];
    }
  },

  async addNature(nature: Omit<ExpenseNature, 'id'>): Promise<ExpenseNature | null> {
    if (!isConfigured()) return null;
    try {
      let permissions: string[] = [];
      try {
        const user = await account.get();
        if (user && user.$id) {
          permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ];
        }
      } catch {
        // Guest/anon
      }

      const dataToSave = cleanPayload({
        name: nature.name,
        initialBudget: (nature as any).initialBudget || 0,
        description: nature.description || '',
        icon: nature.icon,
        color: nature.color,
        type: nature.type || 'FIXA',
        mappings: JSON.stringify(nature.mappings || []),
        overCeilingJustification: nature.overCeilingJustification || '',
        justificationHistory: JSON.stringify(nature.justificationHistory || [])
      });

      const doc = await databases.createDocument(
        databaseId,
        COLLECTIONS.NATURES,
        ID.unique(),
        dataToSave,
        permissions.length > 0 ? permissions : undefined
      );
      return { ...nature, id: doc.$id };
    } catch (e) {
      console.error('Error adding nature to Appwrite:', e);
      return null;
    }
  },

  async updateNature(id: string, updates: Partial<ExpenseNature>): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      const dataToSave: any = cleanPayload({ ...updates });
      delete dataToSave.id;
      if (updates.mappings) {
        dataToSave.mappings = JSON.stringify(updates.mappings);
      }
      if (updates.justificationHistory) {
        dataToSave.justificationHistory = JSON.stringify(updates.justificationHistory);
      }
      await databases.updateDocument(databaseId, COLLECTIONS.NATURES, id, dataToSave);
      return true;
    } catch (e) {
      console.error('Error updating nature in Appwrite:', e);
      return false;
    }
  },

  async deleteNature(id: string): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      await databases.deleteDocument(databaseId, COLLECTIONS.NATURES, id);
      return true;
    } catch (e) {
      console.error('Error deleting nature from Appwrite:', e);
      return false;
    }
  },

  // ==========================================
  // GOALS
  // ==========================================
  async getGoals(): Promise<Goal[]> {
    if (!isConfigured()) return [];
    try {
      const response = await databases.listDocuments(databaseId, COLLECTIONS.GOALS, [
        Query.limit(50)
      ]);
      return response.documents.map(doc => ({
        id: doc.$id,
        title: doc.title,
        category: doc.category,
        currentAmount: doc.currentAmount,
        targetAmount: doc.targetAmount,
        monthlyContribution: doc.monthlyContribution,
        targetDate: doc.targetDate,
        icon: doc.icon,
        color: doc.color,
      })) as Goal[];
    } catch (e) {
      console.error('Error fetching goals:', e);
      return [];
    }
  },

  async addGoal(goal: Omit<Goal, 'id'>): Promise<Goal | null> {
    if (!isConfigured()) return null;
    try {
      let permissions: string[] = [];
      try {
        const user = await account.get();
        if (user && user.$id) {
          permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ];
        }
      } catch {}

      const payload = cleanPayload(goal);
      const doc = await databases.createDocument(
        databaseId,
        COLLECTIONS.GOALS,
        ID.unique(),
        payload,
        permissions.length > 0 ? permissions : undefined
      );
      return { ...goal, id: doc.$id };
    } catch (e) {
      console.error('Error adding goal to Appwrite:', e);
      return null;
    }
  },

  async updateGoal(id: string, updates: Partial<Goal>): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      const payload = cleanPayload(updates);
      delete payload.id;
      await databases.updateDocument(databaseId, COLLECTIONS.GOALS, id, payload);
      return true;
    } catch (e) {
      console.error('Error updating goal in Appwrite:', e);
      return false;
    }
  },

  async deleteGoal(id: string): Promise<boolean> {
    if (!isConfigured()) return false;
    try {
      await databases.deleteDocument(databaseId, COLLECTIONS.GOALS, id);
      return true;
    } catch (e) {
      console.error('Error deleting goal from Appwrite:', e);
      return false;
    }
  }
};
