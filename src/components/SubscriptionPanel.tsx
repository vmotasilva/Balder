import React, { useEffect, useState } from 'react';
import { Check, Crown, Minus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { usePlans } from '../context/PlanScopeContext';
import { SharingService } from '../services/sharingService';
import { STATUS_LABEL, formatBRL } from '../services/adminService';
import { InfoButton } from './InfoButton';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null);

/** Assinatura real do usuário: plano, situação, valor, vigência, benefícios e uso dos limites. */
export const SubscriptionPanel: React.FC = () => {
  const { user } = useAuth();
  const ent = useEntitlements();
  const { plans } = usePlans();
  const sub = ent.subscription;
  const [invites, setInvites] = useState<number | null>(null);

  const realUser = !!user && !user.isGuest;
  useEffect(() => {
    if (!realUser) return;
    let cancelled = false;
    SharingService.listMyShares()
      .then((shares) => {
        if (!cancelled) setInvites(shares.filter((s) => s.status !== 'REVOGADO').length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [realUser]);

  const header = (
    <div>
      <div className="kicker-badge" style={{ marginBottom: '0.25rem' }}>
        <span>PLANO & FATURAMENTO</span>
      </div>
      <h3 className="label-with-info">
        Plano & Assinatura
        <InfoButton title="Plano & Assinatura">
          <p>Seu plano atual, o que ele inclui e quanto dos limites você já usa. Mudanças de plano são feitas pelo gestor do Balder.</p>
        </InfoButton>
      </h3>
    </div>
  );

  if (!sub) {
    return (
      <div className="subtab-content animate-fade-in space-y-6">
        {header}
        <p className="text-muted">
          {realUser
            ? 'Não encontramos uma assinatura para a sua conta. Se isso persistir, fale com o gestor do Balder.'
            : 'No modo convidado não há assinatura. Entre com a sua conta para ver o seu plano.'}
        </p>
      </div>
    );
  }

  // Restrita sem estar suspensa/cancelada só pode ser vencimento
  const expired = ent.restricted && sub.status !== 'SUSPENSA' && sub.status !== 'CANCELADA';
  const statusLabel = expired ? 'Vencida' : STATUS_LABEL[sub.status];
  const statusClass = ent.restricted ? 'badge-rose' : sub.status === 'ATIVA' ? 'badge-emerald' : 'badge-cyan';
  const monthly = sub.customMonthlyPriceCents ?? sub.planMonthlyPriceCents;
  const planningsUsed = 1 + plans.length;

  const limitRows: { label: string; used: number | null; max: number | null }[] = [
    { label: 'Planejamentos (com o principal)', used: planningsUsed, max: ent.maxPlannings },
    { label: 'Convites de compartilhamento', used: invites, max: ent.maxSharedMembers },
  ];

  return (
    <div className="subtab-content animate-fade-in space-y-6">
      {header}

      <div className="subscription-active-spotlight">
        <div className="sub-spotlight-top">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-amber" />
            <h4 className="sub-spotlight-title">{sub.planName}</h4>
            <span className={`badge ${statusClass}`}>{statusLabel}</span>
          </div>
          <span className="sub-spotlight-renewal">
            {monthly > 0 ? `${formatBRL(monthly)}/mês${sub.customMonthlyPriceCents !== null ? ' (valor negociado)' : ''}` : 'Sem cobrança'}
          </span>
        </div>

        {sub.planDescription && <p className="text-muted">{sub.planDescription}</p>}

        {ent.restricted && (
          <p className="sharing-error">
            Sua assinatura está suspensa, cancelada ou vencida. Seus dados continuam aqui, mas novos planejamentos, convites e a
            Forseti estão pausados. Fale com o gestor do Balder para regularizar.
          </p>
        )}

        <div className="spec-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div className="spec-box">
            <span className="spec-label">Desde</span>
            <span className="spec-value">{fmtDate(sub.startedAt) || '—'}</span>
          </div>
          <div className="spec-box">
            <span className="spec-label">{expired ? 'Venceu em' : 'Vigência até'}</span>
            <span className="spec-value">{fmtDate(sub.expiresAt) || 'Sem data de vencimento'}</span>
          </div>
        </div>
      </div>

      <div>
        <h4>O que o seu plano inclui</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {sub.planBenefits.map((b) => (
            <li key={b} className="flex items-center gap-2" style={{ padding: '0.2rem 0' }}>
              <Check size={14} className="text-emerald shrink-0" />
              <span>{b}</span>
            </li>
          ))}
          <li className="flex items-center gap-2" style={{ padding: '0.2rem 0' }}>
            {ent.forsetiEnabled ? <Check size={14} className="text-emerald shrink-0" /> : <Minus size={14} className="text-muted shrink-0" />}
            <span>{ent.forsetiEnabled ? 'Forseti (assistente) liberada' : 'Forseti (assistente) não incluída'}</span>
          </li>
        </ul>
      </div>

      <div>
        <h4>Uso do plano</h4>
        <div className="space-y-3" style={{ marginTop: '0.5rem' }}>
          {limitRows.map(({ label, used, max }) => {
            const pct = max === null || used === null ? 0 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
            return (
              <div key={label}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  <strong>
                    {used ?? '…'} de {max === null ? 'ilimitado' : max}
                  </strong>
                </div>
                {max !== null && (
                  <div className="profile-gs-progress-bar">
                    <div className="profile-gs-progress-fill" style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-muted">Para mudar de plano ou ajustar valores, fale com o gestor do Balder.</p>
    </div>
  );
};
