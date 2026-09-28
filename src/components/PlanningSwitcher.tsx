import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Star, User, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { SharingService, type AccountShare } from '../services/sharingService';

/** Aba a abrir depois de trocar de planejamento (a troca recria a tela). */
export const PENDING_TAB_KEY = 'balder_pending_tab';

interface PlanningSwitcherProps {
  /** Abre a tela onde se convida pessoas para planejar junto. */
  onPlanWithOthers?: () => void;
}

/**
 * Seletor de planejamento na barra superior: alterna entre o planejamento individual e os
 * planejamentos compartilhados com o usuário, e leva a convidar pessoas para um planejamento conjunto.
 */
export const PlanningSwitcher: React.FC<PlanningSwitcherProps> = ({ onPlanWithOthers }) => {
  const { user } = useAuth();
  const { viewing, openSharedAccount, backToOwnAccount } = useAccountScope();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<AccountShare[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await SharingService.listSharedWithMe();
      setShares(list.filter((s) => s.status === 'ATIVO'));
    } catch {
      setShares([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user || user.isGuest) return null;

  const currentLabel = viewing ? viewing.ownerName : 'Meu planejamento';

  return (
    <div className="planning-switch" ref={rootRef}>
      <button
        type="button"
        className={`planning-switch-btn ${viewing ? 'is-shared' : ''}`}
        onClick={() => {
          if (!open) void load();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Alternar planejamento"
      >
        {viewing ? <Users size={15} /> : <User size={15} />}
        <span className="planning-switch-text">{currentLabel}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="planning-switch-menu" role="menu">
          <span className="planning-switch-caption">Planejamento em uso</span>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!viewing}
            className="planning-switch-item"
            onClick={() => {
              setOpen(false);
              if (viewing) backToOwnAccount();
            }}
          >
            <User size={15} />
            <span className="planning-switch-item-text">
              <strong>Meu planejamento</strong>
              <small>Individual</small>
            </span>
            {!viewing && <Check size={15} className="text-cyan" />}
          </button>

          {shares.map((share) => {
            const active = viewing?.shareId === share.id;
            return (
              <button
                key={share.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="planning-switch-item"
                onClick={() => {
                  setOpen(false);
                  if (!active) openSharedAccount(share);
                }}
              >
                <Users size={15} />
                <span className="planning-switch-item-text">
                  <strong>
                    {share.ownerName || share.ownerEmail || 'Conta compartilhada'}
                    {share.primaryStatus === 'APROVADO' && <Star size={11} className="planning-switch-star" aria-label="Conta principal" />}
                  </strong>
                  <small>
                    Compartilhado · {share.role === 'COLABORADOR' ? 'colaborador(a)' : 'visualizador(a)'}
                  </small>
                </span>
                {active && <Check size={15} className="text-cyan" />}
              </button>
            );
          })}

          {onPlanWithOthers && (
            <>
              <div className="planning-switch-divider" />
              <button
                type="button"
                role="menuitem"
                className="planning-switch-item"
                onClick={() => {
                  setOpen(false);
                  if (!viewing) {
                    onPlanWithOthers();
                    return;
                  }
                  // Voltar à própria conta recria a tela: a aba a abrir fica guardada para depois da troca
                  try {
                    sessionStorage.setItem(PENDING_TAB_KEY, 'COMPARTILHADO');
                  } catch {
                    // sem armazenamento: abre no início
                  }
                  backToOwnAccount();
                }}
              >
                <UserPlus size={15} />
                <span className="planning-switch-item-text">
                  <strong>Planejar com outras pessoas</strong>
                  <small>Convide alguém para o seu planejamento</small>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
