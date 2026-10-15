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

export interface UserMetrics {
  userId: string;
  movementsTotal: number;
  movements30d: number;
  movementsRealized: number;
  activeDays30d: number;
  lastActivityAt: string | null;
  accounts: number;
  natures: number;
  goals: number;
  contracts: number;
  paymentMethods: number;
  forsetiActions: number;
  forsetiUseful: number;
  forsetiNotUseful: number;
  forsetiMemories: number;
  forsetiChats: number;
  priceWatches: number;
  sharesSent: number;
}

const mapMetrics = (r: any): UserMetrics => ({
  userId: r.user_id,
  movementsTotal: r.movements_total ?? 0,
  movements30d: r.movements_30d ?? 0,
  movementsRealized: r.movements_realized ?? 0,
  activeDays30d: r.active_days_30d ?? 0,
  lastActivityAt: r.last_activity_at ?? null,
  accounts: r.accounts_count ?? 0,
  natures: r.natures_count ?? 0,
  goals: r.goals_count ?? 0,
  contracts: r.contracts_count ?? 0,
  paymentMethods: r.payment_methods_count ?? 0,
  forsetiActions: r.forseti_actions ?? 0,
  forsetiUseful: r.forseti_useful ?? 0,
  forsetiNotUseful: r.forseti_not_useful ?? 0,
  forsetiMemories: r.forseti_memories ?? 0,
  forsetiChats: r.forseti_chats ?? 0,
  priceWatches: r.price_watches_count ?? 0,
  sharesSent: r.shares_sent ?? 0,
});

/** Cadastros estruturais feitos pelo usuário (contas, naturezas, metas, contratos, meios). */
export const setupCount = (m: UserMetrics) => m.accounts + m.natures + m.goals + m.contracts + m.paymentMethods;

/**
 * Pontuação de contribuição: pesa uso recorrente e feedback à Forseti acima de volume bruto.
 * Lançamentos contam até 100 para não premiar importação em massa.
 */
export const contributionScore = (m: UserMetrics) =>
  Math.min(m.movementsTotal, 100) +
  m.activeDays30d * 5 +
  m.forsetiUseful * 5 +
  m.forsetiNotUseful * 5 + // feedback negativo também ensina a Forseti
  m.forsetiActions * 2 +
  m.forsetiMemories * 3 +
  m.forsetiChats +
  setupCount(m) * 2 +
  m.priceWatches * 2 +
  m.sharesSent * 3;

export type EngagementLevel = 'MUITO_ATIVO' | 'ATIVO' | 'POUCO_ATIVO' | 'INATIVO';

export const ENGAGEMENT_LABEL: Record<EngagementLevel, string> = {
  MUITO_ATIVO: 'Muito ativo',
  ATIVO: 'Ativo',
  POUCO_ATIVO: 'Pouco ativo',
  INATIVO: 'Inativo',
};

/** Nível pela recência (últimos 14 dias) e pela pontuação. */
export const engagementLevel = (m: UserMetrics | undefined, now = Date.now()): EngagementLevel => {
  if (!m || !m.lastActivityAt) return 'INATIVO';
  const days = (now - new Date(m.lastActivityAt).getTime()) / 86_400_000;
  if (days > 14) return 'INATIVO';
  const score = contributionScore(m);
  if (score >= 120 && m.activeDays30d >= 5) return 'MUITO_ATIVO';
  if (score >= 40) return 'ATIVO';
  return 'POUCO_ATIVO';
};

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

  /** Métricas de uso. Falha isolada: sem o script admin_metrics.sql a gestão segue funcionando. */
  async listMetrics(): Promise<UserMetrics[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.rpc('admin_user_metrics');
    if (error) throw fail(error, 'Não foi possível carregar as métricas. O script supabase/admin_metrics.sql foi executado?');
    return (data || []).map(mapMetrics);
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
