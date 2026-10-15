import React, { useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const initialsOf = (name: string, email: string) =>
  (name || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const AccountSwitcherModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, savedAccounts, switchAccount, addAccount, removeAccount } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const activeId = user && !user.isGuest ? user.$id : null;

  const handleSwitch = async (id: string) => {
    if (id === activeId) return onClose();
    setError('');
    setBusyId(id);
    const res = await switchAccount(id);
    if (!res.success) {
      setError(res.error || 'Não foi possível trocar de conta.');
      setBusyId(null);
    }
  };

  return (
    <div className="account-switcher-overlay" onClick={onClose} role="presentation">
      <div
        className="account-switcher-card"
        role="dialog"
        aria-modal="true"
        aria-label="Trocar de conta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="account-switcher-header">
          <Users size={18} />
          <h3>Trocar de conta</h3>
          <button type="button" className="account-switcher-close" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <ul className="account-switcher-list">
          {savedAccounts.map((acc) => {
            const isActive = acc.id === activeId;
            return (
              <li key={acc.id} className="account-switcher-row">
                <button
                  type="button"
                  className={`account-switcher-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSwitch(acc.id)}
                  disabled={busyId !== null}
                >
                  <span className="account-switcher-avatar">{initialsOf(acc.name, acc.email)}</span>
                  <span className="account-switcher-info">
                    <span className="account-switcher-name">{acc.name}</span>
                    <span className="account-switcher-email">{acc.email}</span>
                  </span>
                  {isActive && <Check size={16} className="account-switcher-check" />}
                  {busyId === acc.id && <span className="account-switcher-busy">Trocando…</span>}
                </button>
                {!isActive && (
                  <button
                    type="button"
                    className="account-switcher-remove"
                    onClick={() => removeAccount(acc.id)}
                    title="Esquecer esta conta neste aparelho"
                    aria-label={`Esquecer ${acc.email}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {error && <p className="account-switcher-error">{error}</p>}

        <button
          type="button"
          className="account-switcher-add"
          onClick={() => {
            onClose();
            void addAccount();
          }}
        >
          <Plus size={16} /> Adicionar outra conta
        </button>
      </div>
    </div>
  );
};
