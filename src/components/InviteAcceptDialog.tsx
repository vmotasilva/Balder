import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { ROLE_LABEL, SCOPE_LABEL, SharingService, type InvitePreview } from '../services/sharingService';

const PENDING_INVITE_KEY = 'balder_pending_invite';

/**
 * Guarda o token de um link de convite (#convite=TOKEN) antes do login, para não perdê-lo no
 * redirecionamento do Google, e limpa o endereço.
 */
export function captureInviteFromUrl() {
  try {
    const match = window.location.hash.match(/convite=([a-f0-9]+)/i);
    if (!match) return;
    localStorage.setItem(PENDING_INVITE_KEY, match[1]);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // armazenamento indisponível
  }
}

const readPending = () => {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
};

const clearPending = () => {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // armazenamento indisponível
  }
};

/** Convite aberto por link: mostra quem compartilhou, o papel e o alcance, e permite aceitar. */
export const InviteAcceptDialog: React.FC = () => {
  const { user } = useAuth();
  const { openSharedAccount } = useAccountScope();
  const [token, setToken] = useState<string | null>(() => readPending());
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !user || user.isGuest) return;
    let cancelled = false;
    SharingService.previewInvite(token)
      .then((p) => {
        if (cancelled) return;
        if (!p) setError('Convite não encontrado. Peça um novo link para quem compartilhou.');
        else setPreview(p);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  if (!token || !user) return null;

  const close = () => {
    clearPending();
    setToken(null);
  };

  if (user.isGuest) {
    return (
      <Modal isOpen onClose={close} title="Convite para uma conta compartilhada" maxWidth="440px">
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          Para aceitar o convite, saia do modo convidado e entre com a sua conta Google. O convite continua guardado.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setToken(null)}>
            Entendi
          </button>
        </div>
      </Modal>
    );
  }

  const owner = preview?.ownerName || preview?.ownerEmail || 'Alguém';

  return (
    <Modal isOpen onClose={close} title="Convite para uma conta compartilhada" maxWidth="460px">
      {error && <p className="text-sm text-rose mb-3">{error}</p>}
      {!error && !preview && <p className="text-sm text-muted mb-3">Carregando convite...</p>}
      {preview && (
        <>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            <strong>{owner}</strong> compartilhou a conta do Balder com você.
          </p>
          <ul className="invite-preview-list mb-3">
            <li>
              Acesso: <strong>{SCOPE_LABEL[preview.scope]}</strong>
            </li>
            <li>
              Papel: <strong>{ROLE_LABEL[preview.role]}</strong>
            </li>
            {preview.invitedEmail && (
              <li>
                Enviado para: <strong>{preview.invitedEmail}</strong>
              </li>
            )}
          </ul>
          {preview.status === 'REVOGADO' && (
            <p className="text-sm text-rose mb-3">Este convite foi cancelado por quem compartilhou.</p>
          )}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={close}>
          {preview?.status === 'REVOGADO' || error ? 'Fechar' : 'Recusar'}
        </button>
        {preview && preview.status !== 'REVOGADO' && !error && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const share = await SharingService.acceptInvite(token);
                clearPending();
                setToken(null);
                openSharedAccount(share);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Aceitando...' : 'Aceitar e abrir a conta'}
          </button>
        )}
      </div>
    </Modal>
  );
};
