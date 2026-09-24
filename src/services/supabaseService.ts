import { supabase, isSupabaseConfigured, TABLES } from '../lib/supabase';
import type {
  Movement,
  ExpenseNature,
  Goal,
  BankAccount,
  SalaryContract,
  FinancialCheckpoint,
  PaymentMethodItem,
  UserProfileSettings,
} from '../types';

/**
 * Obtém o ID do usuário autenticado no Supabase.
 * Retorna null se não houver usuário logado.
 */
async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export const SupabaseService = {
  // ============================================================================
  // MOVEMENTS
  // ============================================================================
  async getMovements(): Promise<Movement[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.MOVEMENTS)
        .select('*')
        .order('due_date', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[SupabaseService] Erro ao buscar movimentações:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        title: row.title,
        type: row.type,
        amount: Number(row.amount) || 0,
        dueDate: row.due_date,
        bank: row.bank || 'Geral',
        status: row.status,
        category: row.category || 'Geral',
        notes: row.notes || undefined,
        installmentNumber: row.installment_number ?? undefined,
        installmentsTotal: row.installments_total ?? undefined,
        installmentGroupId: row.installment_group_id || undefined,
        interestRatePercent: row.interest_rate_percent ? Number(row.interest_rate_percent) : undefined,
        originalAmount: row.original_amount ? Number(row.original_amount) : undefined,
        actualAmount: row.actual_amount ? Number(row.actual_amount) : undefined,
        paymentDate: row.payment_date || undefined,
        adjustmentReason: row.adjustment_reason || undefined,
        natureId: row.nature_id || undefined,
        mappingId: row.mapping_id || undefined,
        mappingItemId: row.mapping_item_id || undefined,
        invoiceBreakdown: row.invoice_breakdown || [],
        unanalyzedAmount: row.unanalyzed_amount ? Number(row.unanalyzed_amount) : undefined,
      })) as Movement[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar movimentações:', e);
      return [];
    }
  },

  async addMovement(movement: Omit<Movement, 'id'>): Promise<Movement | null> {
    if (!isSupabaseConfigured) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
      const payload: Record<string, any> = {
        user_id: userId,
        title: movement.title,
        type: movement.type,
        amount: movement.amount,
        due_date: movement.dueDate,
        bank: movement.bank || 'Geral',
        status: movement.status || 'PREVISTA',
        category: movement.category || 'Geral',
        notes: movement.notes || null,
        installment_number: movement.installmentNumber ?? null,
        installments_total: movement.installmentsTotal ?? null,
        installment_group_id: movement.installmentGroupId || null,
        interest_rate_percent: movement.interestRatePercent ?? null,
        original_amount: movement.originalAmount ?? null,
        actual_amount: movement.actualAmount ?? null,
        payment_date: movement.paymentDate || null,
        adjustment_reason: movement.adjustmentReason || null,
        nature_id: movement.natureId || null,
        mapping_id: movement.mappingId || null,
        mapping_item_id: movement.mappingItemId || null,
        invoice_breakdown: movement.invoiceBreakdown || [],
        unanalyzed_amount: movement.unanalyzedAmount ?? null,
      };

      const { data, error } = await supabase
        .from(TABLES.MOVEMENTS)
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[SupabaseService] Erro ao inserir movimentação:', error.message);
        return null;
      }

      return {
        ...movement,
        id: String(data.id),
      } as Movement;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao inserir movimentação:', e);
      return null;
    }
  },

  async updateMovement(id: string, updates: Partial<Movement>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.amount !== undefined) payload.amount = updates.amount;
      if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
      if (updates.bank !== undefined) payload.bank = updates.bank;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.installmentNumber !== undefined) payload.installment_number = updates.installmentNumber;
      if (updates.installmentsTotal !== undefined) payload.installments_total = updates.installmentsTotal;
      if (updates.installmentGroupId !== undefined) payload.installment_group_id = updates.installmentGroupId;
      if (updates.interestRatePercent !== undefined) payload.interest_rate_percent = updates.interestRatePercent;
      if (updates.originalAmount !== undefined) payload.original_amount = updates.originalAmount;
      if (updates.actualAmount !== undefined) payload.actual_amount = updates.actualAmount;
      if (updates.paymentDate !== undefined) payload.payment_date = updates.paymentDate;
      if (updates.adjustmentReason !== undefined) payload.adjustment_reason = updates.adjustmentReason;
      if (updates.natureId !== undefined) payload.nature_id = updates.natureId;
      if (updates.mappingId !== undefined) payload.mapping_id = updates.mappingId;
      if (updates.mappingItemId !== undefined) payload.mapping_item_id = updates.mappingItemId;
      if (updates.invoiceBreakdown !== undefined) payload.invoice_breakdown = updates.invoiceBreakdown;
      if (updates.unanalyzedAmount !== undefined) payload.unanalyzed_amount = updates.unanalyzedAmount;

      const { error } = await supabase
        .from(TABLES.MOVEMENTS)
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao atualizar movimentação:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao atualizar movimentação:', e);
      return false;
    }
  },

  async deleteMovement(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.MOVEMENTS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir movimentação:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir movimentação:', e);
      return false;
    }
  },

  // ============================================================================
  // NATURES
  // ============================================================================
  async getNatures(): Promise<ExpenseNature[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.NATURES)
        .select('*')
        .order('name');

      if (error) {
        console.error('[SupabaseService] Erro ao buscar naturezas:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        color: row.color,
        icon: row.icon,
        type: row.type || 'FIXA',
        initialBudget: row.initial_budget ? Number(row.initial_budget) : 0,
        description: row.description || '',
        mappings: Array.isArray(row.mappings) ? row.mappings : [],
        overCeilingJustification: row.over_ceiling_justification || undefined,
        justificationHistory: Array.isArray(row.justification_history) ? row.justification_history : [],
      })) as ExpenseNature[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar naturezas:', e);
      return [];
    }
  },

  async addNature(nature: ExpenseNature): Promise<ExpenseNature | null> {
    if (!isSupabaseConfigured) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
      const payload: Record<string, any> = {
        id: nature.id || `nat_${Date.now()}`,
        user_id: userId,
        name: nature.name,
        color: nature.color,
        icon: nature.icon,
        type: nature.type || 'FIXA',
        initial_budget: (nature as any).initialBudget || 0,
        description: nature.description || '',
        mappings: nature.mappings || [],
        over_ceiling_justification: nature.overCeilingJustification || null,
        justification_history: nature.justificationHistory || [],
      };

      const { data, error } = await supabase
        .from(TABLES.NATURES)
        .upsert(payload)
        .select()
        .single();

      if (error) {
        console.error('[SupabaseService] Erro ao salvar natureza:', error.message);
        return null;
      }

      return {
        ...nature,
        id: String(data.id),
      };
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar natureza:', e);
      return null;
    }
  },

  async updateNature(id: string, updates: Partial<ExpenseNature>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.icon !== undefined) payload.icon = updates.icon;
      if (updates.type !== undefined) payload.type = updates.type;
      if ((updates as any).initialBudget !== undefined) payload.initial_budget = (updates as any).initialBudget;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.mappings !== undefined) payload.mappings = updates.mappings;
      if (updates.overCeilingJustification !== undefined) payload.over_ceiling_justification = updates.overCeilingJustification;
      if (updates.justificationHistory !== undefined) payload.justification_history = updates.justificationHistory;

      const { error } = await supabase
        .from(TABLES.NATURES)
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao atualizar natureza:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao atualizar natureza:', e);
      return false;
    }
  },

  async deleteNature(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.NATURES)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir natureza:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir natureza:', e);
      return false;
    }
  },

  // ============================================================================
  // GOALS
  // ============================================================================
  async getGoals(): Promise<Goal[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.GOALS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SupabaseService] Erro ao buscar metas:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        title: row.title,
        category: row.category,
        currentAmount: Number(row.current_amount) || 0,
        targetAmount: Number(row.target_amount) || 0,
        monthlyContribution: Number(row.monthly_contribution) || 0,
        targetDate: row.target_date,
        icon: row.icon,
        color: row.color,
      })) as Goal[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar metas:', e);
      return [];
    }
  },

  async addGoal(goal: Omit<Goal, 'id'>): Promise<Goal | null> {
    if (!isSupabaseConfigured) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
      const payload: Record<string, any> = {
        user_id: userId,
        title: goal.title,
        category: goal.category,
        current_amount: goal.currentAmount,
        target_amount: goal.targetAmount,
        monthly_contribution: goal.monthlyContribution,
        target_date: goal.targetDate,
        icon: goal.icon,
        color: goal.color,
      };

      const { data, error } = await supabase
        .from(TABLES.GOALS)
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[SupabaseService] Erro ao adicionar meta:', error.message);
        return null;
      }

      return {
        ...goal,
        id: String(data.id),
      };
    } catch (e) {
      console.error('[SupabaseService] Exceção ao adicionar meta:', e);
      return null;
    }
  },

  async updateGoal(id: string, updates: Partial<Goal>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const payload: Record<string, any> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.currentAmount !== undefined) payload.current_amount = updates.currentAmount;
      if (updates.targetAmount !== undefined) payload.target_amount = updates.targetAmount;
      if (updates.monthlyContribution !== undefined) payload.monthly_contribution = updates.monthlyContribution;
      if (updates.targetDate !== undefined) payload.target_date = updates.targetDate;
      if (updates.icon !== undefined) payload.icon = updates.icon;
      if (updates.color !== undefined) payload.color = updates.color;

      const { error } = await supabase
        .from(TABLES.GOALS)
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao atualizar meta:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao atualizar meta:', e);
      return false;
    }
  },

  async deleteGoal(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.GOALS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir meta:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir meta:', e);
      return false;
    }
  },

  // ============================================================================
  // ACCOUNTS
  // ============================================================================
  async getAccounts(): Promise<BankAccount[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.ACCOUNTS)
        .select('*')
        .order('name');

      if (error) {
        console.error('[SupabaseService] Erro ao buscar contas:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        bankName: row.bank || row.name,
        type: row.type || 'CORRENTE',
        balance: Number(row.balance) || 0,
        color: row.color || '#06B6D4',
        icon: row.icon || 'Wallet',
      })) as BankAccount[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar contas:', e);
      return [];
    }
  },

  async upsertAccount(account: BankAccount): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {
        id: account.id,
        user_id: userId,
        name: account.name,
        bank: account.bankName || account.name,
        type: account.type,
        balance: account.balance,
        color: account.color,
        icon: account.icon,
      };

      const { error } = await supabase
        .from(TABLES.ACCOUNTS)
        .upsert(payload);

      if (error) {
        console.error('[SupabaseService] Erro ao salvar conta:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar conta:', e);
      return false;
    }
  },

  async deleteAccount(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.ACCOUNTS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir conta:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir conta:', e);
      return false;
    }
  },

  // ============================================================================
  // SALARY CONTRACTS
  // ============================================================================
  async getSalaryContracts(): Promise<SalaryContract[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.SALARY_CONTRACTS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SupabaseService] Erro ao buscar contratos:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        employer: row.employer,
        role: row.role || '',
        contractType: row.contract_type || 'CLT',
        paymentSchedule: row.payment_schedule || 'UNICO',
        paymentDay: Number(row.payment_day) || 5,
        secondPaymentDay: row.second_payment_day ?? undefined,
        weeklyPaymentDayOfWeek: row.weekly_payment_day_of_week ?? undefined,
        firstInstallmentPercent: row.first_installment_percent ? Number(row.first_installment_percent) : undefined,
        firstInstallmentAmount: row.first_installment_amount ? Number(row.first_installment_amount) : undefined,
        secondInstallmentAmount: row.second_installment_amount ? Number(row.second_installment_amount) : undefined,
        weeklyInstallmentAmount: row.weekly_installment_amount ? Number(row.weekly_installment_amount) : undefined,
        installmentValueMode: row.installment_value_mode || 'AUTO',
        currentGrossAmount: Number(row.current_gross_amount) || 0,
        currentNetAmount: Number(row.current_net_amount) || 0,
        receivingBankAccountId: row.receiving_bank_account_id || undefined,
        receivingBankName: row.receiving_bank_name || undefined,
        startDate: row.start_date || '',
        isActive: Boolean(row.is_active),
        payInFollowingMonth: Boolean(row.pay_in_following_month),
        history: Array.isArray(row.history) ? row.history : [],
      })) as SalaryContract[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar contratos:', e);
      return [];
    }
  },

  async upsertSalaryContract(contract: SalaryContract): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {
        id: contract.id,
        user_id: userId,
        employer: contract.employer,
        role: contract.role,
        contract_type: contract.contractType,
        payment_schedule: contract.paymentSchedule || 'UNICO',
        payment_day: contract.paymentDay,
        second_payment_day: contract.secondPaymentDay ?? null,
        weekly_payment_day_of_week: contract.weeklyPaymentDayOfWeek ?? null,
        first_installment_percent: contract.firstInstallmentPercent ?? null,
        first_installment_amount: contract.firstInstallmentAmount ?? null,
        second_installment_amount: contract.secondInstallmentAmount ?? null,
        weekly_installment_amount: contract.weeklyInstallmentAmount ?? null,
        installment_value_mode: contract.installmentValueMode || 'AUTO',
        pay_in_following_month: contract.payInFollowingMonth ?? false,
        current_gross_amount: contract.currentGrossAmount,
        current_net_amount: contract.currentNetAmount,
        receiving_bank_account_id: contract.receivingBankAccountId ?? null,
        receiving_bank_name: contract.receivingBankName ?? null,
        start_date: contract.startDate,
        is_active: contract.isActive,
        history: contract.history || [],
      };

      const { error } = await supabase
        .from(TABLES.SALARY_CONTRACTS)
        .upsert(payload);

      if (error) {
        console.error('[SupabaseService] Erro ao salvar contrato:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar contrato:', e);
      return false;
    }
  },

  async deleteSalaryContract(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.SALARY_CONTRACTS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir contrato:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir contrato:', e);
      return false;
    }
  },

  // ============================================================================
  // CHECKPOINTS
  // ============================================================================
  async getCheckpoints(): Promise<FinancialCheckpoint[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.CHECKPOINTS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SupabaseService] Erro ao buscar checkpoints:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        createdAt: row.created_at,
        startDate: row.start_date,
        initialBalance: Number(row.initial_balance) || 0,
        creditCardDebt: row.credit_card_debt ? Number(row.credit_card_debt) : 0,
        cardDueDate: row.card_due_date || undefined,
        cardName: row.card_name || undefined,
        cardInstallments: row.card_installments ? Number(row.card_installments) : 1,
        cardInstallmentAmount: row.card_installment_amount ? Number(row.card_installment_amount) : undefined,
        cardDebts: Array.isArray(row.card_debts) ? row.card_debts : [],
        initialNetWorth: row.initial_net_worth ? Number(row.initial_net_worth) : undefined,
        label: row.label || undefined,
        notes: row.notes || undefined,
        isActive: Boolean(row.is_active),
      })) as FinancialCheckpoint[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar checkpoints:', e);
      return [];
    }
  },

  async upsertCheckpoint(cp: FinancialCheckpoint): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {
        id: cp.id,
        user_id: userId,
        start_date: cp.startDate,
        initial_balance: cp.initialBalance,
        credit_card_debt: cp.creditCardDebt ?? 0,
        card_due_date: cp.cardDueDate ?? null,
        card_name: cp.cardName ?? null,
        card_installments: cp.cardInstallments ?? 1,
        card_installment_amount: cp.cardInstallmentAmount ?? null,
        card_debts: cp.cardDebts || [],
        initial_net_worth: cp.initialNetWorth ?? null,
        label: cp.label ?? null,
        notes: cp.notes ?? null,
        is_active: cp.isActive,
      };

      const { error } = await supabase
        .from(TABLES.CHECKPOINTS)
        .upsert(payload);

      if (error) {
        console.error('[SupabaseService] Erro ao salvar checkpoint:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar checkpoint:', e);
      return false;
    }
  },

  async deleteCheckpoint(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.CHECKPOINTS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir checkpoint:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir checkpoint:', e);
      return false;
    }
  },

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================
  async getPaymentMethods(): Promise<PaymentMethodItem[]> {
    if (!isSupabaseConfigured) return [];
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.PAYMENT_METHODS)
        .select('*')
        .order('name');

      if (error) {
        console.error('[SupabaseService] Erro ao buscar métodos de pagamento:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        type: row.type,
        linkedAccountId: row.linked_account_id || undefined,
        linkedCardId: row.linked_card_id || undefined,
        creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
        closingDay: row.closing_day ?? undefined,
        dueDay: row.due_day ?? undefined,
        icon: row.icon || undefined,
        color: row.color || undefined,
      })) as PaymentMethodItem[];
    } catch (e) {
      console.error('[SupabaseService] Exceção ao buscar métodos de pagamento:', e);
      return [];
    }
  },

  async upsertPaymentMethod(method: PaymentMethodItem): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const userId = await getCurrentUserId();
    if (!userId) return false;

    try {
      const payload: Record<string, any> = {
        id: method.id,
        user_id: userId,
        name: method.name,
        type: method.type,
        linked_account_id: method.linkedAccountId ?? null,
        linked_card_id: method.linkedCardId ?? null,
        credit_limit: (method as any).creditLimit ?? null,
        closing_day: (method as any).closingDay ?? null,
        due_day: (method as any).dueDay ?? null,
        icon: method.icon ?? null,
        color: method.color ?? null,
      };

      const { error } = await supabase
        .from(TABLES.PAYMENT_METHODS)
        .upsert(payload);

      if (error) {
        console.error('[SupabaseService] Erro ao salvar método de pagamento:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar método de pagamento:', e);
      return false;
    }
  },

  async deletePaymentMethod(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase
        .from(TABLES.PAYMENT_METHODS)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseService] Erro ao excluir método de pagamento:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao excluir método de pagamento:', e);
      return false;
    }
  },

  // ============================================================================
  // USER PROFILE SETTINGS (Cards, Banks, Monthly Closings, Shared Scenarios)
  // ============================================================================
  async getUserProfileSettings(): Promise<UserProfileSettings | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return (user.user_metadata?.balder_settings as UserProfileSettings) || null;
    } catch (e) {
      console.error('[SupabaseService] Erro ao buscar configurações de perfil:', e);
      return null;
    }
  },

  async saveUserProfileSettings(settings: Partial<UserProfileSettings>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const current = (user.user_metadata?.balder_settings as UserProfileSettings) || {};
      const updated = {
        ...current,
        ...settings,
      };
      const { error } = await supabase.auth.updateUser({
        data: {
          balder_settings: updated,
        },
      });

      if (error) {
        console.error('[SupabaseService] Erro ao salvar configurações de perfil:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Exceção ao salvar configurações de perfil:', e);
      return false;
    }
  },
};
