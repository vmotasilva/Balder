import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Share2, MessageCircle, Users, UserCheck, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ReferralService, type MyReferralStats } from '../services/referralService';
import { REFERRAL_MESSAGE, referralLink } from '../utils/referral';

/** Convidar amigos: o link pessoal do Balder, com contagem de compartilhamentos, cadastros e quem segue ativo. */
export const ReferralPanel: React.FC = () => {
  const { user } = useAuth();
  const realUser = !!user && !user.isGuest;
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<MyReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([ReferralService.myCode(), ReferralService.myStats()]);
    setCode(c);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!realUser) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [realUser, refresh]);

  if (!realUser) {
    return (
      <div className="subtab-content animate-fade-in">
        <h3>Convidar amigos</h3>
        <p className="text-muted">Entre na sua conta para ter o seu link de convite.</p>
      </div>
    );
  }

  const link = code ? referralLink(code) : '';
  const text = `${REFERRAL_MESSAGE} ${link}`;

  const counted = async (action: () => Promise<void> | void, message: string) => {
    try {
      await action();
      void ReferralService.trackShare().then(refresh);
      setNotice(message);
    } catch {
      // compartilhamento cancelado: não conta
    }
  };

  const copy = () => counted(() => navigator.clipboard.writeText(link), 'Link copiado. É só colar na conversa.');
  const whatsapp = () => counted(() => void window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'), 'Abrindo o WhatsApp…');
  const native = () => counted(() => navigator.share({ title: 'Balder', text: REFERRAL_MESSAGE, url: link }), 'Obrigado por indicar o Balder!');

  return (
    <div className="subtab-content animate-fade-in space-y-4">
      <div>
        <h3>Convidar amigos</h3>
        <p className="subtab-desc">Compartilhe o Balder. Quem criar a conta pelo seu link fica ligado a você, e você acompanha quem entrou e segue usando.</p>
      </div>

      {loading && <p className="text-muted">Carregando…</p>}

      {!loading && !code && (
        <div className="badge badge-rose">Não foi possível gerar o seu link agora. O script supabase/referrals.sql foi executado?</div>
      )}

      {code && (
        <>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <label className="text-muted" htmlFor="referral-link">Seu link</label>
            <input id="referral-link" className="form-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <button className="btn btn-primary btn-sm" onClick={copy}><Copy size={14} /> Copiar link</button>
              <button className="btn btn-outline btn-sm" onClick={whatsapp}><MessageCircle size={14} /> WhatsApp</button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button className="btn btn-outline btn-sm" onClick={native}><Share2 size={14} /> Outros apps</button>
              )}
            </div>
            {notice && <small className="text-muted" role="status" style={{ display: 'block', marginTop: '0.5rem' }}>{notice}</small>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: Send, label: 'Compartilhamentos', value: stats?.shares ?? 0 },
              { icon: Users, label: 'Cadastros pelo seu link', value: stats?.signups ?? 0 },
              { icon: UserCheck, label: 'Seguem ativos (14 dias)', value: stats?.active ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-label">{label}</span>
                  <Icon size={16} />
                </div>
                <div className="stat-card-value">{value}</div>
              </div>
            ))}
          </div>
          <small className="text-muted">Contamos só números: não mostramos quem são as pessoas que entraram.</small>
        </>
      )}
    </div>
  );
};
