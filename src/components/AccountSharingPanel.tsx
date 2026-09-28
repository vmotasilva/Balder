import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, MessageSquare, Share2, Trash2, UserMinus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinancial } from '../context/FinancialContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import {
  ROLE_LABEL,
  SCOPE_LABEL,
  SharingService,
  inviteLink,
  type AccountShare,
  type ShareRole,
  type ShareScope,
} from '../services/sharingService';

const STATUS_LABEL: Record<AccountShare['status'], string> = {
  PENDENTE: 'Convite pendente',
  ATIVO: 'Com acesso',
  REVOGADO: 'Revogado',
};

const inviteSubject = (ownerName: string) => `${ownerName} compartilhou a conta do Balder com você`;

const inviteMessage = (share: AccountShare, ownerName: string) =>
  `Olá!\n\n${ownerName} compartilhou a conta do Balder com você.\n` +
  `Acesso: ${SCOPE_LABEL[share.scope]}\nPapel: ${ROLE_LABEL[share.role]}\n\n` +
  `Para aceitar, abra o link e entre com a sua conta Google${share.invitedEmail ? ` (${share.invitedEmail})` : ''}:\n` +
  `${inviteLink(share.inviteToken)}\n`;

const mailtoFor = (share: AccountShare, ownerName: string) =>
  `mailto:${encodeURIComponent(share.invitedEmail || '')}?subject=${encodeURIComponent(inviteSubject(ownerName))}&body=${encodeURIComponent(inviteMessage(share, ownerName))}`;

const whatsappFor = (share: AccountShare, ownerName: string) =>
  `https://wa.me/?text=${encodeURIComponent(inviteMessage(share, ownerName))}`;

// "?&body=" é aceito tanto pelo Android quanto pelo iOS
const smsFor = (share: AccountShare, ownerName: string) => `sms:?&body=${encodeURIComponent(inviteMessage(share, ownerName))}`;

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Compartilhamento da conta: o dono convida por link ou e-mail, escolhendo alcance (conta inteira ou só o
 * planejamento) e papel (colaborador registra pagamentos; visualizador só vê), e pode alterar ou revogar
 * a qualquer momento. Também lista as contas compartilhadas com o usuário.
 */
export const AccountSharingPanel: React.FC = () => {
  const { user } = useAuth();
  const { sharedScenario, updateSharedScenario } = useFinancial();
  const { openSharedAccount } = useAccountScope();
  const { confirm, dialogProps } = useConfirmDialog();

  const [myShares, setMyShares] = useState<AccountShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<AccountShare[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState<ShareScope>('CONTA');
  const [role, setRole] = useState<ShareRole>('COLABORADOR');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<AccountShare | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const ownerName = user?.name || user?.email || 'Titular';
  const isGuest = !user || user.isGuest;

  const reload = useCallback(async () => {
    if (isGuest) return;
    try {
      const [mine, withMe] = await Promise.all([SharingService.listMyShares(), SharingService.listSharedWithMe()]);
      setMyShares(mine);
      setSharedWithMe(withMe);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const copyLink = async (share: AccountShare) => {
    try {
      await navigator.clipboard.writeText(inviteLink(share.inviteToken));
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copie o link do convite:', inviteLink(share.inviteToken));
    }
  };

  const shareInvite = async (share: AccountShare) => {
    try {
      await navigator.share({
        title: inviteSubject(ownerName),
        text: inviteMessage(share, ownerName),
      });
    } catch {
      // Usuário fechou a janela de compartilhamento
    }
  };

  const sendActions = (share: AccountShare, compact: boolean) => (
    <>
      <button type="button" className="btn btn-outline btn-xs" onClick={() => copyLink(share)}>
        {copiedId === share.id ? <Check size={13} /> : <Copy size={13} />}
        <span>{copiedId === share.id ? 'Copiado' : compact ? 'Link' : 'Copiar link'}</span>
      </button>
      <a className="btn btn-outline btn-xs" href={whatsappFor(share, ownerName)} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={13} />
        <span>WhatsApp</span>
      </a>
      <a className="btn btn-outline btn-xs" href={smsFor(share, ownerName)}>
        <MessageSquare size={13} />
        <span>SMS</span>
      </a>
      <a className="btn btn-outline btn-xs" href={mailtoFor(share, ownerName)}>
        <Mail size={13} />
        <span>{compact ? 'E-mail' : 'Enviar por e-mail'}</span>
      </a>
      {canNativeShare && (
        <button type="button" className="btn btn-outline btn-xs" onClick={() => void shareInvite(share)}>
          <Share2 size={13} />
          <span>Compartilhar</span>
        </button>
      )}
    </>
  );

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Inclui no planejamento a dois quem aceitou o convite (se ainda não houver parceiro(a))
  const partnerInScenario = sharedScenario?.members?.some((m) => m.role === 'PARTNER');
  const addToPlanning = (share: AccountShare) => {
    const owner = {
      id: user?.$id || 'owner',
      name: ownerName,
      email: user?.email || '',
      role: 'OWNER' as const,
      status: 'ACTIVE' as const,
      color: '#06b6d4',
      joinedAt: new Date().toISOString(),
    };
    const partner = {
      id: share.memberId || share.id,
      name: share.memberName || share.memberEmail || 'Parceiro(a)',
      email: share.memberEmail || '',
      role: 'PARTNER' as const,
      status: 'ACTIVE' as const,
      color: '#ec4899',
      joinedAt: share.acceptedAt || new Date().toISOString(),
    };
    const others = (sharedScenario?.members || []).filter((m) => m.role !== 'PARTNER' && m.role !== 'OWNER');
    updateSharedScenario({ members: [owner, partner, ...others] });
  };

  if (isGuest) {
    return (
      <section className="glass-card sharing-panel mb-6">
        <div className="sharing-panel-head">
          <Share2 size={18} className="text-cyan" />
          <h3>Compartilhar minha conta</h3>
        </div>
        <p className="text-sm text-muted">Entre com a sua conta Google para compartilhar o seu planejamento.</p>
      </section>
    );
  }

  const activeOrPending = myShares.filter((s) => s.status !== 'REVOGADO');
  const revoked = myShares.filter((s) => s.status === 'REVOGADO');

  return (
    <section className="glass-card sharing-panel mb-6">
      <div className="sharing-panel-head">
        <Share2 size={18} className="text-cyan" />
        <h3>Compartilhar minha conta</h3>
      </div>
      <p className="text-xs text-muted mb-3">
        Convide por link, WhatsApp, SMS ou e-mail. O colaborador vê e registra pagamentos; o visualizador só vê. Você pode alterar ou
        revogar o acesso a qualquer momento, e a mudança vale na hora.
      </p>

      {error && <p className="sharing-error">{error}</p>}

      {/* Novo convite */}
      <div className="sharing-form">
        <label className="sharing-field">
          <span>Acesso</span>
          <select className="form-select select-sm" value={scope} onChange={(e) => setScope(e.target.value as ShareScope)}>
            <option value="CONTA">{SCOPE_LABEL.CONTA}</option>
            <option value="PLANEJAMENTO">{SCOPE_LABEL.PLANEJAMENTO}</option>
          </select>
        </label>
        <label className="sharing-field">
          <span>Papel</span>
          <select className="form-select select-sm" value={role} onChange={(e) => setRole(e.target.value as ShareRole)}>
            <option value="COLABORADOR">{ROLE_LABEL.COLABORADOR}</option>
            <option value="VISUALIZADOR">{ROLE_LABEL.VISUALIZADOR}</option>
          </select>
        </label>
        <label className="sharing-field sharing-field-grow">
          <span>E-mail (opcional: só este e-mail poderá aceitar)</span>
          <input
            type="email"
            className="form-input form-input-sm"
            placeholder="pessoa@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            try {
              const share = await SharingService.createInvite({
                role,
                scope,
                invitedEmail: email.trim() || undefined,
                ownerName,
                ownerEmail: user?.email,
              });
              setJustCreated(share);
              setEmail('');
              await reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setCreating(false);
            }
          }}
        >
          <Link2 size={14} />
          <span>{creating ? 'Gerando...' : 'Gerar convite'}</span>
        </button>
      </div>

      {justCreated && (
        <div className="sharing-created">
          <span>
            Convite criado ({SCOPE_LABEL[justCreated.scope].toLowerCase()}, {ROLE_LABEL[justCreated.role].toLowerCase()}).
            Envie o link:
          </span>
          <code>{inviteLink(justCreated.inviteToken)}</code>
          <div className="sharing-created-actions">{sendActions(justCreated, false)}</div>
        </div>
      )}

      {/* Quem tem acesso */}
      <div className="sharing-list-head">
        <Users size={15} />
        <span>Pessoas com acesso</span>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Carregando...</p>
      ) : activeOrPending.length === 0 ? (
        <p className="text-xs text-muted">Ninguém tem acesso à sua conta.</p>
      ) : (
        <ul className="sharing-list">
          {activeOrPending.map((share) => (
            <li key={share.id} className="sharing-item">
              <div className="sharing-item-who">
                <strong>{share.memberName || share.memberEmail || share.invitedEmail || 'Convite por link'}</strong>
                <small>
                  <span className={`sharing-status is-${share.status.toLowerCase()}`}>{STATUS_LABEL[share.status]}</span>
                  {share.memberEmail && share.memberName ? ` · ${share.memberEmail}` : ''}
                </small>
              </div>
              <select
                className="form-select select-sm"
                value={share.scope}
                onChange={(e) => run(() => SharingService.updateShare(share.id, { scope: e.target.value as ShareScope }))}
                aria-label="Acesso"
              >
                <option value="CONTA">{SCOPE_LABEL.CONTA}</option>
                <option value="PLANEJAMENTO">{SCOPE_LABEL.PLANEJAMENTO}</option>
              </select>
              <select
                className="form-select select-sm"
                value={share.role}
                onChange={(e) => run(() => SharingService.updateShare(share.id, { role: e.target.value as ShareRole }))}
                aria-label="Papel"
              >
                <option value="COLABORADOR">{ROLE_LABEL.COLABORADOR}</option>
                <option value="VISUALIZADOR">{ROLE_LABEL.VISUALIZADOR}</option>
              </select>
              <div className="sharing-item-actions">
                {share.status === 'PENDENTE' && sendActions(share, true)}
                {share.status === 'ATIVO' && !partnerInScenario && (
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => addToPlanning(share)}>
                    <Users size={13} />
                    <span>Incluir no planejamento a dois</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-xs sharing-revoke"
                  onClick={() =>
                    confirm({
                      title: 'Revogar acesso',
                      message:
                        share.status === 'ATIVO'
                          ? `${share.memberName || share.memberEmail} perde o acesso à sua conta agora.`
                          : 'O link deste convite deixa de funcionar.',
                      confirmLabel: 'Revogar',
                      onConfirm: () => void run(() => SharingService.revoke(share.id)),
                    })
                  }
                >
                  <UserMinus size={13} />
                  <span>Revogar</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 && (
        <details className="sharing-revoked">
          <summary>Acessos revogados ({revoked.length})</summary>
          <ul className="sharing-list">
            {revoked.map((share) => (
              <li key={share.id} className="sharing-item">
                <div className="sharing-item-who">
                  <strong>{share.memberName || share.memberEmail || share.invitedEmail || 'Convite por link'}</strong>
                  <small>
                    <span className="sharing-status is-revogado">Revogado</span>
                  </small>
                </div>
                <div className="sharing-item-actions">
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => run(() => SharingService.remove(share.id))}>
                    <Trash2 size={13} />
                    <span>Remover da lista</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Contas compartilhadas comigo */}
      {sharedWithMe.length > 0 && (
        <>
          <div className="sharing-list-head">
            <ExternalLink size={15} />
            <span>Compartilhadas comigo</span>
          </div>
          <ul className="sharing-list">
            {sharedWithMe.map((share) => (
              <li key={share.id} className="sharing-item">
                <div className="sharing-item-who">
                  <strong>{share.ownerName || share.ownerEmail || 'Conta compartilhada'}</strong>
                  <small>
                    {SCOPE_LABEL[share.scope]} · {ROLE_LABEL[share.role]}
                  </small>
                </div>
                <div className="sharing-item-actions">
                  {share.status === 'ATIVO' ? (
                    <>
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => openSharedAccount(share)}>
                        <ExternalLink size={13} />
                        <span>Abrir conta</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs sharing-revoke"
                        onClick={() =>
                          confirm({
                            title: 'Sair da conta compartilhada',
                            message: `Você deixa de acessar a conta de ${share.ownerName || share.ownerEmail}.`,
                            confirmLabel: 'Sair',
                            onConfirm: () => void run(() => SharingService.leave(share.id)),
                          })
                        }
                      >
                        <UserMinus size={13} />
                        <span>Sair</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() =>
                        void run(async () => {
                          const accepted = await SharingService.acceptInvite(share.inviteToken);
                          openSharedAccount(accepted);
                        })
                      }
                    >
                      <Check size={13} />
                      <span>Aceitar convite</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog {...dialogProps} />
    </section>
  );
};
