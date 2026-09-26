import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, User, Users, CalendarRange, CalendarCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { applyMappingItemState, mappingItemBaseValue, resolveMappingItemState } from '../utils/mappingItemState';

export interface MappingItemStateTarget {
  natureId: string;
  mappingId: string;
  itemId: string;
  monthKey: string; // competência YYYY-MM
}

interface MappingItemStateModalProps {
  target: MappingItemStateTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/** Botão de opção (segmentado) reutilizado nas três perguntas. */
const Choice: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  tone?: 'emerald' | 'amber' | 'cyan';
}> = ({ active, onClick, icon, label, hint, tone = 'cyan' }) => {
  const colors = {
    emerald: { border: 'rgba(16, 185, 129, 0.55)', bg: 'rgba(16, 185, 129, 0.12)', fg: '#34D399' },
    amber: { border: 'rgba(245, 158, 11, 0.55)', bg: 'rgba(245, 158, 11, 0.12)', fg: '#FBBF24' },
    cyan: { border: 'rgba(56, 189, 248, 0.55)', bg: 'rgba(56, 189, 248, 0.12)', fg: '#38BDF8' },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: '1 1 160px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: '10px',
        cursor: 'pointer',
        border: `1px solid ${active ? colors.border : 'rgba(255, 255, 255, 0.1)'}`,
        background: active ? colors.bg : 'rgba(255, 255, 255, 0.03)',
        color: active ? colors.fg : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ marginTop: '1px', flexShrink: 0 }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{label}</span>
        {hint && (
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</span>
        )}
      </span>
    </button>
  );
};

const Question: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{children}</div>
  </div>
);

/**
 * Define a situação de um item mapeado de natureza em uma competência:
 * se já foi realizado, se foi pago pelo usuário ou por outra pessoa (fora dos valores)
 * e se o mesmo comportamento vale para as competências seguintes.
 */
export const MappingItemStateModal: React.FC<MappingItemStateModalProps> = ({ target, onClose }) => {
  const { natures, updateMappingItemState } = useFinancial();

  const nature = target ? natures.find((n) => n.id === target.natureId) : undefined;
  const mapping = nature?.mappings.find((m) => m.id === target?.mappingId);
  const item = mapping?.items.find((it) => it.id === target?.itemId);

  const [realized, setRealized] = useState(false);
  const [paidByOthers, setPaidByOthers] = useState(false);
  const [paidBy, setPaidBy] = useState('');
  const [applyToFuture, setApplyToFuture] = useState(false);

  // Carrega a situação vigente sempre que abrir para um item/competência
  useEffect(() => {
    if (!target || !item) return;
    const state = resolveMappingItemState(item, target.monthKey);
    setRealized(!!state.realized);
    setPaidByOthers(!!state.paidByOthers);
    setPaidBy(state.paidBy || '');
    // Sugere "próximos meses" quando a situação atual já vem de uma regra recorrente
    setApplyToFuture(!item.monthStates?.[target.monthKey] && (item.stateRules || []).some((r) => r.fromMonth <= target.monthKey));
  }, [target, item]);

  if (!target) return null;

  const month = monthLabel(target.monthKey);

  const handleSave = () => {
    if (!item) return;
    updateMappingItemState(
      target.natureId,
      target.mappingId,
      target.itemId,
      applyMappingItemState(item, target.monthKey, { realized, paidByOthers, paidBy }, applyToFuture)
    );
    onClose();
  };

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title={item ? item.description : 'Item não encontrado'}
      subtitle={item ? `${nature?.name} • ${mapping?.name} • Competência de ${month}` : undefined}
      maxWidth="520px"
    >
      {!item ? (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Este item não existe mais no mapeamento da natureza.
        </p>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.2)',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Valor planejado no mês</span>
            <strong
              style={{
                color: paidByOthers ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: paidByOthers ? 'line-through' : 'none',
              }}
            >
              {formatBRL(mappingItemBaseValue(item))}
            </strong>
          </div>

          <Question title={`Já foi realizado em ${month}?`}>
            <Choice
              active={realized}
              onClick={() => setRealized(true)}
              icon={<CheckCircle2 size={16} />}
              label="Sim, já foi pago"
              tone="emerald"
            />
            <Choice
              active={!realized}
              onClick={() => setRealized(false)}
              icon={<Clock size={16} />}
              label="Ainda não"
              hint="Continua previsto a vencer"
              tone="amber"
            />
          </Question>

          <Question title="Quem paga este item?">
            <Choice
              active={!paidByOthers}
              onClick={() => setPaidByOthers(false)}
              icon={<User size={16} />}
              label="Eu"
              hint="Entra nos valores da projeção"
            />
            <Choice
              active={paidByOthers}
              onClick={() => setPaidByOthers(true)}
              icon={<Users size={16} />}
              label="Outra pessoa"
              hint="Não entra nos valores"
              tone="amber"
            />
          </Question>

          {paidByOthers && (
            <input
              type="text"
              className="form-input"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              placeholder="Quem pagou? (opcional)"
              aria-label="Quem pagou"
              style={{ width: '100%', marginTop: '-6px', marginBottom: '16px' }}
            />
          )}

          <Question title="As próximas competências terão o mesmo comportamento?">
            <Choice
              active={!applyToFuture}
              onClick={() => setApplyToFuture(false)}
              icon={<CalendarCheck size={16} />}
              label={`Só em ${month}`}
              hint="Os outros meses não mudam"
            />
            <Choice
              active={applyToFuture}
              onClick={() => setApplyToFuture(true)}
              icon={<CalendarRange size={16} />}
              label="Este e os próximos meses"
              hint="Vale a partir desta competência"
            />
          </Question>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
