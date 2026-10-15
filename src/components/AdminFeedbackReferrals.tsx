import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminService, isPositiveReferral, isRetainedReferral, type FeedbackItem, type ReferralRow } from '../services/adminService';
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABEL,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  type FeedbackKind,
  type FeedbackStatus,
} from '../utils/forsetiFeedback';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const who = (name: string, email: string) => name || email.split('@')[0] || '—';

const KIND_BADGE: Record<FeedbackKind, string> = {
  SUGESTAO: 'badge-cyan',
  PROBLEMA: 'badge-rose',
  ELOGIO: 'badge-emerald',
  OUTRO: 'badge-purple',
};

/** Feedbacks que os usuários enviaram pela Forseti: a gestão lê e acompanha a situação de cada um. */
export const FeedbackPanel: React.FC = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind | ''>('');
  const [status, setStatus] = useState<FeedbackStatus | ''>('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await AdminService.listFeedback());
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar os feedbacks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => items.filter((f) => (!kind || f.kind === kind) && (!status || f.status === status)), [items, kind, status]);

  const changeStatus = async (f: FeedbackItem, next: FeedbackStatus) => {
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)));
    try {
      await AdminService.setFeedbackStatus(f.id, next);
    } catch (e: any) {
      setError(e?.message || 'Falha ao atualizar.');
      void load();
    }
  };

  const countStatus = (s: FeedbackStatus) => items.filter((f) => f.status === s).length;

  return (
    <div className="space-y-3">
      {error && <div className="badge badge-rose">{error}</div>}
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        <select className="form-select" style={{ flex: '0 1 200px' }} value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind | '')} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {FEEDBACK_KINDS.map((k) => (
            <option key={k} value={k}>{FEEDBACK_KIND_LABEL[k]} ({items.filter((f) => f.kind === k).length})</option>
          ))}
        </select>
        <select className="form-select" style={{ flex: '0 1 200px' }} value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | '')} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]} ({countStatus(s)})</option>
          ))}
        </select>
      </div>
      <small className="text-muted">{shown.length} de {items.length} feedback(s) · {countStatus('NOVO')} novo(s)</small>

      {loading && <p className="text-muted">Carregando…</p>}
      {!loading && shown.length === 0 && !error && <p className="text-muted">Nenhum feedback por aqui ainda. Os usuários enviam conversando com a Forseti.</p>}

      {shown.map((f) => (
        <div key={f.id} className="glass-card" style={{ padding: '0.9rem' }}>
          <div className="flex gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <span className={`badge ${KIND_BADGE[f.kind]}`}>{FEEDBACK_KIND_LABEL[f.kind]}</span>{' '}
              <strong>{who(f.name, f.email)}</strong>
              <br />
              <small className="text-muted">{f.email} · {fmtDate(f.createdAt)}</small>
            </div>
            <select className="form-select" style={{ maxWidth: 170 }} value={f.status} onChange={(e) => void changeStatus(f, e.target.value as FeedbackStatus)} aria-label="Situação do feedback">
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <p style={{ marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>{f.message}</p>
        </div>
      ))}
    </div>
  );
};

interface ReferrerSummary {
  userId: string;
  name: string;
  email: string;
  shares: number;
  signups: number;
  retained: number;
  positive: number;
}

/** Indicações: quem compartilhou o Balder, quantos entraram, quantos ficaram e quantos geram referência positiva. */
export const ReferralsAdminPanel: React.FC = () => {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [shares, setShares] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AdminService.listReferrals()
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setShares(r.shares);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Falha ao carregar as indicações.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();

  const { referrers, totals } = useMemo(() => {
    const by = new Map<string, ReferrerSummary>();
    const ensure = (id: string, name: string, email: string) => {
      let s = by.get(id);
      if (!s) {
        s = { userId: id, name, email, shares: shares.get(id) ?? 0, signups: 0, retained: 0, positive: 0 };
        by.set(id, s);
      }
      return s;
    };
    for (const r of rows) {
      const s = ensure(r.referrerId, r.referrerName, r.referrerEmail);
      s.signups += 1;
      if (isRetainedReferral(r, now)) s.retained += 1;
      if (isPositiveReferral(r, now)) s.positive += 1;
    }
    const list = [...by.values()].sort((a, b) => b.positive - a.positive || b.retained - a.retained || b.signups - a.signups);
    const total = {
      shares: [...shares.values()].reduce((sum, n) => sum + n, 0),
      signups: rows.length,
      retained: rows.filter((r) => isRetainedReferral(r, now)).length,
      positive: rows.filter((r) => isPositiveReferral(r, now)).length,
    };
    return { referrers: list, totals: total };
  }, [rows, shares, now]);

  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

  return (
    <div className="space-y-4">
      {error && <div className="badge badge-rose">{error}</div>}
      {loading && <p className="text-muted">Carregando…</p>}

      {!loading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'Compartilhamentos', value: totals.shares },
              { label: 'Novos usuários por indicação', value: totals.signups },
              { label: 'Ficaram (7+ dias, ativos)', value: `${totals.retained} · ${pct(totals.retained, totals.signups)}` },
              { label: 'Referências positivas', value: totals.positive },
            ].map(({ label, value }) => (
              <div key={label} className="stat-card">
                <div className="stat-card-header"><span className="stat-card-label">{label}</span></div>
                <div className="stat-card-value">{value}</div>
              </div>
            ))}
          </div>

          <div className="admin-users-table-wrap" style={{ display: 'block', overflowX: 'auto' }}>
            <table className="movements-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Quem indicou</th>
                  <th>Compartilhou</th>
                  <th>Cadastros</th>
                  <th>Ficaram</th>
                  <th>Positivas</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((s) => (
                  <tr key={s.userId}>
                    <td>
                      <strong>{who(s.name, s.email)}</strong>
                      <br />
                      <small className="text-muted">{s.email}</small>
                    </td>
                    <td>{s.shares}</td>
                    <td>{s.signups}</td>
                    <td>{s.retained} <small className="text-muted">({pct(s.retained, s.signups)})</small></td>
                    <td>{s.positive}</td>
                  </tr>
                ))}
                {referrers.length === 0 && <tr><td colSpan={5} className="text-muted">Ninguém entrou por indicação ainda.</td></tr>}
              </tbody>
            </table>
          </div>

          {rows.length > 0 && (
            <div className="admin-users-table-wrap" style={{ display: 'block', overflowX: 'auto' }}>
              <table className="movements-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Novo usuário</th>
                    <th>Indicado por</th>
                    <th>Entrou em</th>
                    <th>Última atividade</th>
                    <th>Lançamentos</th>
                    <th>Feedbacks (elogios · aproveitados)</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const positive = isPositiveReferral(r, now);
                    const retained = isRetainedReferral(r, now);
                    return (
                      <tr key={r.referredId}>
                        <td>
                          <strong>{who(r.referredName, r.referredEmail)}</strong>
                          <br />
                          <small className="text-muted">{r.referredEmail}</small>
                        </td>
                        <td>{who(r.referrerName, r.referrerEmail)}</td>
                        <td>{fmtDate(r.joinedAt)}</td>
                        <td>{fmtDate(r.lastActivityAt)}</td>
                        <td>{r.movements}</td>
                        <td>{r.feedbacks} ({r.praises} · {r.implemented})</td>
                        <td>
                          <span className={`badge ${positive ? 'badge-emerald' : retained ? 'badge-cyan' : 'badge-amber'}`}>
                            {positive ? 'Referência positiva' : retained ? 'Ficou' : 'Em observação'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <small className="text-muted">
            Ficou = criou a conta há 7+ dias e teve atividade nos últimos 14. Referência positiva = ficou e enviou um elogio
            ou teve um feedback marcado como implementado.
          </small>
        </>
      )}
    </div>
  );
};
