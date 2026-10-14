// Acesso às funções do servidor (Vercel): exige o login do Supabase e confere o plano da pessoa.
// O arquivo começa com "_" para a Vercel não publicá-lo como uma função.
import { computeEntitlements, snapshotFromRow, type Entitlements } from '../src/utils/entitlements.js';

// Mesmos valores (públicos) usados pelo aplicativo em src/lib/supabase.ts
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zlwghcqisnejjqugsxvp.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_dTZJs1GDyT9jOIc3JA3yRQ_0q3NpIzY';

export type PlanFeature = 'forsetiEnabled' | 'opportunitiesEnabled' | 'consolidatedEnabled';

/** Confere o login no Supabase e devolve o id da pessoa (null se o token não vale). */
export async function userIdFrom(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, authorization: auth } });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id || null;
  } catch {
    return null;
  }
}

/** O plano da pessoa inclui o recurso? Falha de leitura libera: o app não pode travar por isso. */
export async function planAllows(request: Request, userId: string, feature: PlanFeature): Promise<boolean> {
  try {
    // subscription_plans(*) lê todas as colunas: não quebra se alguma coluna nova ainda não existir no banco
    const url = `${SUPABASE_URL}/rest/v1/user_subscriptions?user_id=eq.${userId}&select=*,subscription_plans(*)`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, authorization: request.headers.get('authorization') || '' } });
    if (!res.ok) return true;
    const rows = (await res.json()) as unknown[];
    const entitlements: Entitlements = computeEntitlements(snapshotFromRow(rows[0]));
    return entitlements[feature];
  } catch {
    return true;
  }
}

/** Exige login (401) e plano com o recurso (403). Devolve o id da pessoa ou a resposta de erro. */
export async function requireFeature(request: Request, feature: PlanFeature): Promise<{ userId: string } | Response> {
  const userId = await userIdFrom(request);
  if (!userId) return Response.json({ error: 'não autorizado' }, { status: 401 });
  if (!(await planAllows(request, userId, feature))) return Response.json({ error: 'plano sem o recurso' }, { status: 403 });
  return { userId };
}
