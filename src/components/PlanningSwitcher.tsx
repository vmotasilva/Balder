import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Briefcase, Check, CheckSquare, ChevronDown, Layers, Plus, Settings, Square, Star, User, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { MAIN_PLAN_KEY, MAX_EXTRA_PLANS, usePlans } from '../context/PlanScopeContext';
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
  const { plans, activePlanId, activePlan, createPlan, mainPlan, setSettingsOpen, switchPlan, compareIds, toggleCompare, consolidated, setConsolidated } = usePlans();
  const [open, setOpen] = useState(false);
  // Criação de um planejamento próprio (formulário dentro do menu)
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  const currentLabel = consolidated ? `Consolidado (${compareIds.length})` : viewing ? viewing.ownerName : activePlan ? activePlan.name : mainPlan.name;
  const inMain = !viewing && !activePlanId && !consolidated;
  // Somar só faz sentido com mais de um planejamento próprio
  const canCompare = plans.length > 0 && !viewing;

  const compareToggle = (key: string, name: string) => {
    const on = compareIds.includes(key);
    return (
      <button
        type="button"
        className={`planning-switch-mini ${on ? 'is-checked' : ''}`}
        title={on ? 'Tirar da soma' : 'Somar na visão consolidada'}
        aria-label={`${on ? 'Tirar' : 'Incluir'} ${name} na visão consolidada`}
        aria-pressed={on}
        onClick={() => toggleCompare(key)}
      >
        {on ? <CheckSquare size={15} /> : <Square size={15} />}
      </button>
    );
  };

  const goMain = () => {
    setOpen(false);
    setConsolidated(false);
    if (activePlanId) switchPlan(null);
    if (viewing) backToOwnAccount();
  };

  const goPlan = (id: string) => {
    setOpen(false);
    setConsolidated(false);
    if (id === activePlanId && !viewing && !consolidated) return;
    switchPlan(id);
    if (viewing) backToOwnAccount();
  };

  const submitNewPlan = async () => {
    setBusy(true);
    setPlanError(null);
    const result = await createPlan(newName);
    setBusy(false);
    if (result.ok) {
      setCreating(false);
      setNewName('');
      setOpen(false);
      // O planejamento novo já fica ativo e começa vazio: o Balder conduz o início
      if (viewing) backToOwnAccount();
      return;
    }
    setPlanError(
      result.error === 'NOME'
        ? 'Dê um nome com pelo menos 2 letras.'
        : result.error === 'LIMITE'
        ? `Você pode ter até ${MAX_EXTRA_PLANS} planejamentos além do principal.`
        : result.error === 'SQL_PENDENTE'
        ? 'Falta preparar o banco: rode o script supabase/plans.sql no Supabase (uma vez) e tente de novo.'
        : 'Não consegui criar agora. Tente de novo.'
    );
  };

  /** Abre a configuração do planejamento: se não for o ativo, troca para ele primeiro. */
  const openSettings = (id: string | null) => {
    setOpen(false);
    setConsolidated(false);
    if (viewing) backToOwnAccount();
    if (id !== activePlanId) switchPlan(id);
    setSettingsOpen(true);
  };

  const iconOf = (icon: string | undefined, fallback: React.ReactNode) =>
    icon ? <span className="planning-switch-emoji" aria-hidden="true">{icon}</span> : fallback;

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
        {viewing ? <Users size={15} /> : activePlan ? iconOf(activePlan.icon, <Briefcase size={15} />) : iconOf(mainPlan.icon, <User size={15} />)}
        <span className="planning-switch-text">{currentLabel}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="planning-switch-menu" role="menu">
          <span className="planning-switch-caption">Meus planejamentos</span>
          <div className="planning-switch-row">
            <button type="button" role="menuitemradio" aria-checked={inMain} className="planning-switch-item" onClick={goMain}>
              {iconOf(mainPlan.icon, <User size={15} />)}
              <span className="planning-switch-item-text">
                <strong>{mainPlan.name}</strong>
                <small>Principal</small>
              </span>
              {inMain && <Check size={15} className="text-cyan" />}
            </button>
            {canCompare && compareToggle(MAIN_PLAN_KEY, mainPlan.name)}
            <button type="button" className="planning-switch-mini" title="Configurar" aria-label={`Configurar ${mainPlan.name}`} onClick={() => openSettings(null)}>
              <Settings size={14} />
            </button>
          </div>

          {plans.map((plan) => {
            const active = !viewing && !consolidated && plan.id === activePlanId;
            return (
              <div key={plan.id} className="planning-switch-row">
                <button type="button" role="menuitemradio" aria-checked={active} className="planning-switch-item" onClick={() => goPlan(plan.id)}>
                  {iconOf(plan.icon, <Briefcase size={15} />)}
                  <span className="planning-switch-item-text">
                    <strong>{plan.name}</strong>
                    <small>Independente</small>
                  </span>
                  {active && <Check size={15} className="text-cyan" />}
                </button>
                {canCompare && compareToggle(plan.id, plan.name)}
                <button type="button" className="planning-switch-mini" title="Configurar" aria-label={`Configurar ${plan.name}`} onClick={() => openSettings(plan.id)}>
                  <Settings size={14} />
                </button>
              </div>
            );
          })}

          {canCompare && (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={consolidated}
              className="planning-switch-item"
              disabled={compareIds.length < 2}
              onClick={() => {
                setOpen(false);
                setConsolidated(true);
              }}
            >
              <Layers size={15} />
              <span className="planning-switch-item-text">
                <strong>Ver consolidado</strong>
                <small>
                  {compareIds.length < 2
                    ? 'Marque 2 ou mais planejamentos (☐) para somar'
                    : `Soma de ${compareIds.length} planejamentos, somente leitura`}
                </small>
              </span>
              {consolidated && <Check size={15} className="text-cyan" />}
            </button>
          )}

          {creating ? (
            <form
              className="planning-switch-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitNewPlan();
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                placeholder="Nome (ex.: Minha loja)"
                aria-label="Nome do novo planejamento"
              />
              <div className="planning-switch-form-actions">
                <button type="submit" className="btn btn-primary btn-xs" disabled={busy}>
                  {busy ? 'Criando…' : 'Criar'}
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setCreating(false); setPlanError(null); }}>
                  Cancelar
                </button>
              </div>
              {planError && <small className="planning-switch-error" role="alert">{planError}</small>}
            </form>
          ) : (
            <button type="button" role="menuitem" className="planning-switch-item" onClick={() => { setCreating(true); setPlanError(null); }}>
              <Plus size={15} />
              <span className="planning-switch-item-text">
                <strong>Novo planejamento</strong>
                <small>Ex.: um pequeno negócio, com dados separados</small>
              </span>
            </button>
          )}

          {shares.length > 0 && <span className="planning-switch-caption">Compartilhados comigo</span>}

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
                  if (!viewing && !activePlanId) {
                    onPlanWithOthers();
                    return;
                  }
                  // Voltar ao principal recria a tela: a aba a abrir fica guardada para depois da troca
                  if (activePlanId) switchPlan(null);
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
                  <small>{activePlanId ? 'Vale para o planejamento principal' : 'Convide alguém para o seu planejamento'}</small>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
