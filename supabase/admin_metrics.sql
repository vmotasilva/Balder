-- ==============================================================================
-- BALDER - MÉTRICAS DE USO POR USUÁRIO (GESTÃO DO SISTEMA)
-- ==============================================================================
-- Rode uma vez no SQL Editor do Supabase, DEPOIS do subscriptions.sql e dos scripts
-- das tabelas citadas abaixo (forseti_activity, forseti_memories, forseti_chat,
-- opportunities, sharing, user_feedback, referrals). Pode ser executado de novo sem problemas.
--
-- admin_user_metrics() devolve, por usuário, só CONTAGENS e datas (nunca o conteúdo
-- dos lançamentos). Só GESTOR pode chamar.
-- ==============================================================================

-- O formato de saída mudou (feedbacks e indicações): a função antiga precisa sair antes
DROP FUNCTION IF EXISTS public.admin_user_metrics();

CREATE OR REPLACE FUNCTION public.admin_user_metrics()
RETURNS TABLE (
  user_id UUID,
  movements_total INTEGER,
  movements_30d INTEGER,
  movements_realized INTEGER,
  active_days_30d INTEGER,
  last_activity_at TIMESTAMPTZ,
  accounts_count INTEGER,
  natures_count INTEGER,
  goals_count INTEGER,
  contracts_count INTEGER,
  payment_methods_count INTEGER,
  forseti_actions INTEGER,
  forseti_useful INTEGER,
  forseti_not_useful INTEGER,
  forseti_memories INTEGER,
  forseti_chats INTEGER,
  price_watches_count INTEGER,
  shares_sent INTEGER,
  feedback_count INTEGER,
  feedback_implemented INTEGER,
  referral_shares INTEGER,
  referral_signups INTEGER,
  referral_active INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_manager() THEN
    RAISE EXCEPTION 'Acesso restrito à gestão do sistema.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    (SELECT COUNT(*) FROM public.movements m WHERE m.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.movements m WHERE m.user_id = u.id AND m.created_at >= NOW() - INTERVAL '30 days')::INTEGER,
    (SELECT COUNT(*) FROM public.movements m WHERE m.user_id = u.id AND m.status = 'REALIZADA')::INTEGER,
    -- dias distintos, nos últimos 30, com lançamento criado ou ação da Forseti
    (SELECT COUNT(DISTINCT d) FROM (
       SELECT (m.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS d
         FROM public.movements m WHERE m.user_id = u.id AND m.created_at >= NOW() - INTERVAL '30 days'
       UNION
       SELECT (a.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE
         FROM public.forseti_activity a WHERE a.user_id = u.id AND a.created_at >= NOW() - INTERVAL '30 days'
     ) days)::INTEGER,
    GREATEST(
      (SELECT MAX(GREATEST(m.created_at, m.updated_at)) FROM public.movements m WHERE m.user_id = u.id),
      (SELECT MAX(a.created_at) FROM public.forseti_activity a WHERE a.user_id = u.id)
    ),
    (SELECT COUNT(*) FROM public.accounts x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.natures x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.goals x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.salary_contracts x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.payment_methods x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.forseti_activity a WHERE a.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.forseti_activity a WHERE a.user_id = u.id AND a.rating = 'UTIL')::INTEGER,
    (SELECT COUNT(*) FROM public.forseti_activity a WHERE a.user_id = u.id AND a.rating = 'NAO_UTIL')::INTEGER,
    (SELECT COUNT(*) FROM public.forseti_memories x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.forseti_chat x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.price_watches x WHERE x.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.account_shares x WHERE x.owner_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.user_feedback f WHERE f.user_id = u.id)::INTEGER,
    (SELECT COUNT(*) FROM public.user_feedback f WHERE f.user_id = u.id AND f.status = 'IMPLEMENTADO')::INTEGER,
    COALESCE((SELECT c.shares_count FROM public.referral_codes c WHERE c.user_id = u.id), 0)::INTEGER,
    (SELECT COUNT(*) FROM public.referrals r WHERE r.referrer_id = u.id)::INTEGER,
    -- indicados que seguem ativos: acessaram nos últimos 14 dias
    (SELECT COUNT(*) FROM public.referrals r JOIN auth.users b ON b.id = r.referred_id
       WHERE r.referrer_id = u.id AND b.last_sign_in_at >= NOW() - INTERVAL '14 days')::INTEGER
  FROM auth.users u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_metrics() TO authenticated;
