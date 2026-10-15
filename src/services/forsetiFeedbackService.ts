import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { type FeedbackKind, checkFeedbackText } from '../utils/forsetiFeedback';

export type SendFeedbackResult = { ok: true } | { ok: false; reason: 'SEM_LOGIN' | 'LIMITE' | 'INVALIDO' | 'FALHA' };

/** Envia o feedback aos gestores (tabela user_feedback, supabase/user_feedback.sql). Exige login. */
export async function sendFeedback(kind: FeedbackKind, message: string): Promise<SendFeedbackResult> {
  const check = checkFeedbackText(message);
  if (!check.ok) return { ok: false, reason: 'INVALIDO' };
  if (!isSupabaseConfigured) return { ok: false, reason: 'SEM_LOGIN' };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, reason: 'SEM_LOGIN' };
  const { error } = await supabase.from('user_feedback').insert({ user_id: data.user.id, kind, message: check.text, source: 'FORSETI' });
  if (!error) return { ok: true };
  console.error('[forsetiFeedbackService] Erro ao enviar o feedback:', error.message);
  return { ok: false, reason: /limite de feedbacks/i.test(error.message) ? 'LIMITE' : 'FALHA' };
}
