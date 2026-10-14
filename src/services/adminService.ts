import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SubscriptionStatus = 'TESTE' | 'ATIVA' | 'SUSPENSA' | 'CANCELADA';

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TESTE: 'Em teste',
  ATIVA: 'Ativa',
  SUSPENSA: 'Suspensa',
  CANCELADA: 'Cancelada',
};

export interface SubscriptionPlan {
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number | null;
  benefits: string[];
  maxPlannings: number | null;
  maxSharedMembers: number | null;
  forsetiEnabled: boolean;
  consolidatedEnabled: boolean;
  opportunitiesEnabled: boolean;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}

export interface ManagedUser {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  systemRole: string;
  planCode: string | null;
  status: SubscriptionStatus;
  customMonthlyPriceCents: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  notes: string;
}

export interface SubscriptionUpdate {
  planCode: string;
  status: SubscriptionStatus;
  customMonthlyPriceCents: number | null;
  expiresAt: string | null;
  notes: string;
}

const fail = (error: { message?: string } | null, fallback: string) =>
  new Error(error?.message ? `${fallback} (${error.message})` : fallback);

const mapPlan = (r: any): SubscriptionPlan => ({
  code: r.code,
  name: r.name,
  description: r.description || '',
  monthlyPriceCents: r.monthly_price_cents ?? 0,
  yearlyPriceCents: r.yearly_price_cents ?? null,
  benefits: r.benefits || [],
  maxPlannings: r.max_plannings ?? null,
  maxSharedMembers: r.max_shared_members ?? null,
  forsetiEnabled: r.forseti_enabled ?? true,
  consolidatedEnabled: r.consolidated_enabled ?? true,
  opportunitiesEnabled: r.opportunities_enabled ?? true,
  isDefault: !!r.is_default,
  active: r.active ?? true,
  sortOrder: r.sort_order ?? 0,
});

const mapUser = (r: any): ManagedUser => ({
  userId: r.user_id,
  email: r.email || '',
  name: r.name || '',
  createdAt: r.created_at,
  lastSignInAt: r.last_sign_in_at ?? null,
  systemRole: r.system_role || 'USUARIO',
  planCode: r.plan_code ?? null,
  status: (r.status as SubscriptionStatus) || 'TESTE',
  customMonthlyPriceCents: r.custom_monthly_price_cents ?? null,
  startedAt: r.started_at ?? null,
  expiresAt: r.expires_at ?? null,
  notes: r.notes || '',
});

/** Preço mensal efetivo: o negociado do usuário ou o do plano. */
export const effectiveMonthlyCents = (u: ManagedUser, plans: SubscriptionPlan[]) =>
  u.customMonthlyPriceCents ?? plans.find((p) => p.code === u.planCode)?.monthlyPriceCents ?? 0;

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const AdminService = {
  async listPlans(): Promise<SubscriptionPlan[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw fail(error, 'Não foi possível carregar os planos. O script supabase/subscriptions.sql foi executado?');
    return (data || []).map(mapPlan);
  },

  async listUsers(): Promise<ManagedUser[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) throw fail(error, 'Não foi possível carregar os usuários.');
    return (data || []).map(mapUser);
  },

  async updatePlan(code: string, u: Partial<Omit<SubscriptionPlan, 'code'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (u.name !== undefined) row.name = u.name;
    if (u.description !== undefined) row.description = u.description;
    if (u.monthlyPriceCents !== undefined) row.monthly_price_cents = u.monthlyPriceCents;
    if (u.yearlyPriceCents !== undefined) row.yearly_price_cents = u.yearlyPriceCents;
    if (u.benefits !== undefined) row.benefits = u.benefits;
    if (u.maxPlannings !== undefined) row.max_plannings = u.maxPlannings;
    if (u.maxSharedMembers !== undefined) row.max_shared_members = u.maxSharedMembers;
    if (u.forsetiEnabled !== undefined) row.forseti_enabled = u.forsetiEnabled;
    if (u.consolidatedEnabled !== undefined) row.consolidated_enabled = u.consolidatedEnabled;
    if (u.opportunitiesEnabled !== undefined) row.opportunities_enabled = u.opportunitiesEnabled;
    if (u.active !== undefined) row.active = u.active;
    const { error } = await supabase.from('subscription_plans').update(row).eq('code', code);
    if (error) throw fail(error, 'Não foi possível salvar o plano.');
  },

  async createPlan(code: string, name: string, monthlyPriceCents: number): Promise<void> {
    const { error } = await supabase.from('subscription_plans').insert({
      code,
      name,
      monthly_price_cents: monthlyPriceCents,
      sort_order: 99,
    });
    if (error) throw fail(error, 'Não foi possível criar o plano.');
  },

  async updateSubscription(userId: string, u: SubscriptionUpdate): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('user_subscriptions').upsert(
      {
        user_id: userId,
        plan_code: u.planCode,
        status: u.status,
        custom_monthly_price_cents: u.customMonthlyPriceCents,
        expires_at: u.expiresAt,
        notes: u.notes.trim() || null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'user_id' }
    );
    if (error) throw fail(error, 'Não foi possível salvar a assinatura.');
  },
};
