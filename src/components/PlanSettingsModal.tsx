import React, { useEffect, useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { usePlans } from '../context/PlanScopeContext';
import { Modal } from './Modal';
import { CheckpointSetupModal } from './CheckpointSetupModal';
import { DataFormatPanel } from './DataFormatPanel';
import { TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { TrackingPeriod } from '../utils/periodSpending';

const ICONS = ['🏠', '💼', '🏢', '🛒', '🚗', '🎓', '💰', '🌱', '✈️', '❤️'];
const PERIODS: TrackingPeriod[] = ['SEMANA', 'QUINZENA', 'MES'];
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Configuração do planejamento em uso: nome e ícone, marco inicial (data e saldo de partida),
 * período padrão do acompanhamento e dados (zerar partes ou excluir o planejamento extra).
 */
export const PlanSettingsModal: React.FC = () => {
  const { activePlanId, activePlan, mainPlan, updatePlan, deletePlan, settingsOpen, setSettingsOpen } = usePlans();
  const { isDataReady, activeCheckpoint, viewPreferences, setViewPreferences } = useFinancial();
  const current = activePlan ?? { ...mainPlan, id: null as string | null };
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);

  // Cada abertura parte dos valores atuais do planejamento
  useEffect(() => {
    if (!settingsOpen) return;
    setName(current.name);
    setIcon(current.icon);
    setSaved(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, activePlanId]);

  const dirty = name.trim() !== current.name || icon !== current.icon;
  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'SEMANA';

  const save = async () => {
    const ok = await updatePlan(activePlanId, { name, icon });
    setError(ok ? null : 'Dê um nome com pelo menos 2 letras.');
    setSaved(ok);
  };

  const remove = async () => {
    if (!activePlan) return;
    const typed = window.prompt(
      `Excluir "${activePlan.name}" apaga TODOS os dados dele (lançamentos, naturezas, contas, metas) e não dá para desfazer.\n\nPara confirmar, digite o nome do planejamento:`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== activePlan.name.trim().toLowerCase()) {
      window.alert('O nome não confere. Nada foi excluído.');
      return;
    }
    setSettingsOpen(false);
    const ok = await deletePlan(activePlan.id);
    if (!ok) window.alert('Não consegui excluir agora. Nada foi apagado por completo; tente de novo.');
  };

  return (
    <>
      <Modal
        isOpen={settingsOpen && !checkpointOpen}
        onClose={() => setSettingsOpen(false)}
        title="Configurar planejamento"
        subtitle={activePlan ? 'Planejamento independente' : 'Planejamento principal'}
        maxWidth="560px"
      >
        <div className="plan-settings">
          <section>
            <h3>Nome e ícone</h3>
            <input
              className="plan-settings-input"
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              aria-label="Nome do planejamento"
            />
            <div className="plan-settings-icons" role="group" aria-label="Ícone">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={i === icon ? 'is-active' : ''}
                  aria-pressed={i === icon}
                  onClick={() => {
                    setIcon(i === icon ? undefined : i);
                    setSaved(false);
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
            {error && <small className="text-rose" role="alert">{error}</small>}
            <div>
              <button type="button" className="btn btn-primary btn-xs" disabled={!dirty} onClick={() => void save()}>
                {saved && !dirty ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          </section>

          <section>
            <h3>Marco inicial</h3>
            <p>
              {!isDataReady
                ? 'Carregando…'
                : activeCheckpoint
                ? `Parte de ${activeCheckpoint.startDate.split('-').reverse().join('/')} com saldo de ${formatBRL(activeCheckpoint.initialBalance)}. É a base do "Saldo hoje" e da projeção.`
                : 'Ainda sem marco: o saldo vem da soma das contas. Defina a data e o saldo de partida.'}
            </p>
            <div>
              <button type="button" className="btn btn-outline btn-xs" disabled={!isDataReady} onClick={() => setCheckpointOpen(true)}>
                <Flag size={13} />
                <span>{activeCheckpoint ? 'Redefinir marco' : 'Definir marco'}</span>
              </button>
            </div>
          </section>

          <section>
            <h3>Período padrão</h3>
            <p>Usado nos resumos do Início deste planejamento.</p>
            <div className="home-period-switch" role="group" aria-label="Período padrão">
              {PERIODS.map((p) => (
                <button key={p} type="button" className={p === period ? 'is-active' : ''} onClick={() => setViewPreferences({ trackingPeriod: p })}>
                  {TRACKING_PERIOD_LABELS[p].name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Zerar dados</h3>
            <p>Apague só o que quiser deste planejamento; o resto fica como está.</p>
            <DataFormatPanel />
          </section>

          {activePlan && (
            <section>
              <h3>Excluir planejamento</h3>
              <p>Apaga o planejamento e todos os dados dele.</p>
              <div>
                <button type="button" className="btn btn-outline btn-xs plan-settings-danger" onClick={() => void remove()}>
                  <Trash2 size={13} />
                  <span>Excluir "{activePlan.name}"</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </Modal>

      <CheckpointSetupModal
        isOpen={settingsOpen && checkpointOpen}
        onClose={() => setCheckpointOpen(false)}
        isInitialSetup={!activeCheckpoint}
        mode={activeCheckpoint ? 'EDIT' : 'CREATE'}
        checkpointToEdit={activeCheckpoint}
      />
    </>
  );
};
