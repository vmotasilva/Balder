/**
 * O que o plano do usuário permite. Regra única, usada pelo app e pela função do servidor da Forseti.
 * Sem assinatura conhecida (convidado, banco ainda sem o script, erro de leitura) nada é limitado:
 * o app nunca fica travado por falha de leitura.
 */
export interface PlanLimits {
  /** Total de planejamentos, contando o principal (null = sem limite). */
  maxPlannings: number | null;
  /** Pessoas com convite pendente ou ativo na conta (null = sem limite). */
  maxSharedMembers: number | null;
  forsetiEnabled: boolean;
}

export interface SubscriptionSnapshot {
  status: 'TESTE' | 'ATIVA' | 'SUSPENSA' | 'CANCELADA';
  expiresAt: string | null;
  planName: string;
  limits: PlanLimits;
  /** Dados para exibir a assinatura ao próprio usuário. */
  startedAt: string | null;
  customMonthlyPriceCents: number | null;
  planDescription: string;
  planMonthlyPriceCents: number;
  planBenefits: string[];
}

export interface Entitlements extends PlanLimits {
  /** Assinatura suspensa, cancelada ou vencida: só o essencial, nada novo. */
  restricted: boolean;
  planName: string | null;
  /** A assinatura lida do banco (null = desconhecida: convidado, script não rodado ou erro). */
  subscription: SubscriptionSnapshot | null;
}

export const UNLIMITED: Entitlements = { maxPlannings: null, maxSharedMembers: null, forsetiEnabled: true, restricted: false, planName: null, subscription: null };

/** Assinatura suspensa, cancelada ou vencida: o usuário mantém os dados, mas não cria nada novo. */
export const RESTRICTED_LIMITS: PlanLimits = { maxPlannings: 1, maxSharedMembers: 0, forsetiEnabled: false };

export function computeEntitlements(sub: SubscriptionSnapshot | null, now = Date.now()): Entitlements {
  if (!sub) return UNLIMITED;
  const expired = sub.expiresAt !== null && new Date(sub.expiresAt).getTime() < now;
  const restricted = sub.status === 'SUSPENSA' || sub.status === 'CANCELADA' || expired;
  const limits = restricted ? RESTRICTED_LIMITS : sub.limits;
  return {
    maxPlannings: limits.maxPlannings === null ? null : Math.max(1, limits.maxPlannings),
    maxSharedMembers: limits.maxSharedMembers,
    forsetiEnabled: limits.forsetiEnabled,
    restricted,
    planName: sub.planName,
    subscription: sub,
  };
}

/** Quantos planejamentos extras (fora o principal) ainda cabem; null = sem limite. */
export const extraPlansAllowed = (e: Entitlements): number | null =>
  e.maxPlannings === null ? null : Math.max(0, e.maxPlannings - 1);

/** Lê a linha de user_subscriptions com o plano embutido (formato do PostgREST). */
export function snapshotFromRow(row: any): SubscriptionSnapshot | null {
  const plan = Array.isArray(row?.subscription_plans) ? row.subscription_plans[0] : row?.subscription_plans;
  if (!row || !plan) return null;
  return {
    status: row.status,
    expiresAt: row.expires_at ?? null,
    planName: plan.name,
    startedAt: row.started_at ?? null,
    customMonthlyPriceCents: row.custom_monthly_price_cents ?? null,
    planDescription: plan.description || '',
    planMonthlyPriceCents: plan.monthly_price_cents ?? 0,
    planBenefits: plan.benefits || [],
    limits: {
      maxPlannings: plan.max_plannings ?? null,
      maxSharedMembers: plan.max_shared_members ?? null,
      forsetiEnabled: plan.forseti_enabled ?? true,
    },
  };
}

/** Frase para explicar ao usuário por que algo foi barrado. */
export function limitReason(e: Entitlements): string {
  return e.restricted
    ? 'Sua assinatura está suspensa, cancelada ou vencida.'
    : `Seu plano${e.planName ? ` (${e.planName})` : ''} não inclui isso.`;
}
