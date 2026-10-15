import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearPendingReferral, normalizeReferralCode, readPendingReferral } from '../utils/referral';

export interface MyReferralStats {
  shares: number;
  signups: number;
  active: number;
}

export const ReferralService = {
  /** O código de indicação da pessoa (criado na primeira vez). Null sem login ou sem o script referrals.sql. */
  async myCode(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('get_my_referral_code');
    if (error) {
      console.error('[ReferralService] Erro ao buscar o código:', error.message);
      return null;
    }
    return normalizeReferralCode(data as string) || null;
  },

  /** Conta um compartilhamento do link (botão de copiar, WhatsApp ou menu do aparelho). */
  async trackShare(): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('track_referral_share');
    if (error) console.error('[ReferralService] Erro ao contar o compartilhamento:', error.message);
  },

  async myStats(): Promise<MyReferralStats | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('my_referral_stats');
    const r = Array.isArray(data) ? data[0] : data;
    if (error || !r) return null;
    return { shares: r.shares ?? 0, signups: r.signups ?? 0, active: r.active ?? 0 };
  },

  /** Quem chegou por um link e já está logado: liga à pessoa que indicou (uma vez) e limpa o código guardado. */
  async claimPending(): Promise<void> {
    const code = readPendingReferral();
    if (!code || !isSupabaseConfigured) return;
    const { error } = await supabase.rpc('claim_referral', { p_code: code });
    // Com erro de rede o código segue guardado para a próxima abertura; sem erro (aceito ou não), já cumpriu o papel
    if (!error) clearPendingReferral();
  },
};
