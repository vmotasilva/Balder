-- ==============================================================================
-- BALDER - INDICAÇÕES (compartilhar o sistema e contar quem entrou por um link)
-- ==============================================================================
-- Rode uma vez no SQL Editor do Supabase, DEPOIS do subscriptions.sql e do
-- user_feedback.sql. Pode ser executado de novo sem problemas.
--
--   referral_codes        → o código de indicação de cada pessoa e quantas vezes compartilhou
--   referrals             → quem entrou pelo link de quem (um indicador por pessoa)
--   get_my_referral_code()    → devolve (e cria, se preciso) o código de quem chama
--   track_referral_share()    → conta um compartilhamento do link
--   claim_referral(code)      → liga a pessoa nova a quem a indicou
--   my_referral_stats()       → números de quem indicou (cadastros e quantos seguem ativos)
--   admin_list_referrals()    → todas as indicações com a atividade do indicado (só GESTOR)
--   admin_referral_codes()    → compartilhamentos por pessoa (só GESTOR)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  referred_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (referred_id <> referrer_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, created_at DESC);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Leitura só do que é seu (a escrita é toda pelas funções abaixo)
DROP POLICY IF EXISTS "Read own referral code" ON public.referral_codes;
CREATE POLICY "Read own referral code"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_manager());

DROP POLICY IF EXISTS "Read own referrals" ON public.referrals;
CREATE POLICY "Read own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_system_manager());

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_try INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = auth.uid();
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  LOOP
    v_code := lower(substr(md5(gen_random_uuid()::TEXT), 1, 8));
    BEGIN
      INSERT INTO public.referral_codes (user_id, code) VALUES (auth.uid(), v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- a pessoa já tinha código (chamadas ao mesmo tempo) ou o código sorteado já existe: tenta de novo
      SELECT code INTO v_code FROM public.referral_codes WHERE user_id = auth.uid();
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
      v_try := v_try + 1;
      IF v_try > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_referral_share()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.get_my_referral_code();
  UPDATE public.referral_codes SET shares_count = shares_count + 1 WHERE user_id = auth.uid();
END;
$$;

-- Liga a pessoa nova a quem a indicou. Só vale para contas criadas nos últimos 3 dias,
-- uma vez por pessoa e nunca para si mesma. Devolve TRUE se registrou.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer UUID;
  v_created TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR p_code IS NULL THEN RETURN FALSE; END IF;
  SELECT created_at INTO v_created FROM auth.users WHERE id = auth.uid();
  IF v_created IS NULL OR v_created < NOW() - INTERVAL '3 days' THEN RETURN FALSE; END IF;
  SELECT user_id INTO v_referrer FROM public.referral_codes WHERE code = lower(trim(p_code));
  IF v_referrer IS NULL OR v_referrer = auth.uid() THEN RETURN FALSE; END IF;
  INSERT INTO public.referrals (referred_id, referrer_id, code)
  VALUES (auth.uid(), v_referrer, lower(trim(p_code)))
  ON CONFLICT (referred_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- Números de quem indicou: compartilhamentos, cadastros e quantos seguem ativos (acesso nos últimos 14 dias)
CREATE OR REPLACE FUNCTION public.my_referral_stats()
RETURNS TABLE (shares INTEGER, signups INTEGER, active INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT c.shares_count FROM public.referral_codes c WHERE c.user_id = auth.uid()), 0)::INTEGER,
    (SELECT COUNT(*) FROM public.referrals r WHERE r.referrer_id = auth.uid())::INTEGER,
    (SELECT COUNT(*) FROM public.referrals r JOIN auth.users u ON u.id = r.referred_id
       WHERE r.referrer_id = auth.uid() AND u.last_sign_in_at >= NOW() - INTERVAL '14 days')::INTEGER;
END;
$$;

-- Gestão: uma linha por indicado, com a atividade dele e os sinais positivos
CREATE OR REPLACE FUNCTION public.admin_list_referrals()
RETURNS TABLE (
  referrer_id UUID,
  referrer_name TEXT,
  referrer_email TEXT,
  referred_id UUID,
  referred_name TEXT,
  referred_email TEXT,
  joined_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  movements_count INTEGER,
  feedback_count INTEGER,
  praise_count INTEGER,
  implemented_count INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_manager() THEN
    RAISE EXCEPTION 'Acesso restrito à gestão do sistema.';
  END IF;

  RETURN QUERY
  SELECT
    r.referrer_id,
    COALESCE(a.raw_user_meta_data->>'name', a.raw_user_meta_data->>'full_name')::TEXT,
    a.email::TEXT,
    r.referred_id,
    COALESCE(b.raw_user_meta_data->>'name', b.raw_user_meta_data->>'full_name')::TEXT,
    b.email::TEXT,
    r.created_at,
    GREATEST(b.last_sign_in_at, (SELECT MAX(GREATEST(m.created_at, m.updated_at)) FROM public.movements m WHERE m.user_id = r.referred_id)),
    (SELECT COUNT(*) FROM public.movements m WHERE m.user_id = r.referred_id)::INTEGER,
    (SELECT COUNT(*) FROM public.user_feedback f WHERE f.user_id = r.referred_id)::INTEGER,
    (SELECT COUNT(*) FROM public.user_feedback f WHERE f.user_id = r.referred_id AND f.kind = 'ELOGIO')::INTEGER,
    (SELECT COUNT(*) FROM public.user_feedback f WHERE f.user_id = r.referred_id AND f.status = 'IMPLEMENTADO')::INTEGER
  FROM public.referrals r
  JOIN auth.users a ON a.id = r.referrer_id
  JOIN auth.users b ON b.id = r.referred_id
  ORDER BY r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_referral_codes()
RETURNS TABLE (user_id UUID, shares_count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_manager() THEN
    RAISE EXCEPTION 'Acesso restrito à gestão do sistema.';
  END IF;
  RETURN QUERY SELECT c.user_id, c.shares_count FROM public.referral_codes c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_referral_share() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_codes() TO authenticated;
