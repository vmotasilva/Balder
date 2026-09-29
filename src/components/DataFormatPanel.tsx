import React, { useMemo, useState } from 'react';
import { Eraser, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useConfirmDialog, ConfirmDialog } from './ConfirmDialog';
import type { DataFormatCategory } from '../types';
import { InfoButton } from './InfoButton';

interface FormatOption {
  id: DataFormatCategory;
  label: string;
  description: string;
  count: number;
}

const CONFIRM_WORD = 'FORMATAR';

/**
 * Formatação seletiva: o usuário escolhe quais grupos de dados apagar definitivamente
 * (ex.: manter as naturezas e apagar todo o resto).
 */
export const DataFormatPanel: React.FC = () => {
  const {
    movements,
    checkpoints,
    monthlyClosings,
    natures,
    accounts,
    paymentMethods,
    cards,
    banks,
    goals,
    sharedScenario,
    sharedSettlements,
    formatUserData,
  } = useFinancial();

  const { confirm: confirmAction, dialogProps } = useConfirmDialog();

  const [selected, setSelected] = useState<DataFormatCategory[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const options = useMemo<FormatOption[]>(() => {
    const countType = (...types: string[]) => movements.filter((m) => types.includes(m.type)).length;
    return [
      { id: 'MOVIMENTACOES', label: 'Contas a pagar e a receber', description: 'Lançamentos avulsos, salários e recebimentos', count: countType('PAGAR', 'RECEBER') },
      { id: 'FATURAS', label: 'Faturas de cartão', description: 'Faturas e seus detalhamentos por natureza', count: countType('CARTAO') },
      { id: 'EMPRESTIMOS', label: 'Empréstimos & financiamentos', description: 'Parcelas e contratos de crédito', count: countType('EMPRESTIMO') },
      { id: 'MARCOS', label: 'Marcos de início', description: 'Pontos de partida e cenários de simulação', count: checkpoints.length },
      { id: 'FECHAMENTOS', label: 'Fechamentos mensais', description: 'Competências fechadas na projeção', count: monthlyClosings.length },
      { id: 'NATUREZAS', label: 'Naturezas & mapeamentos', description: 'Naturezas, tetos, mapeamentos e itens', count: natures.length },
      { id: 'CONTAS', label: 'Contas & meios de pagamento', description: 'Contas bancárias e formas de pagamento', count: accounts.length + paymentMethods.length },
      { id: 'CARTOES', label: 'Cartões de crédito', description: 'Cartões cadastrados (limites e vencimentos)', count: cards.length },
      { id: 'BANCOS', label: 'Bancos & instituições', description: 'Instituições financeiras cadastradas', count: banks.length },
      { id: 'METAS', label: 'Metas financeiras', description: 'Objetivos e aportes planejados', count: goals.length },
      { id: 'COMPARTILHADO', label: 'Planejamento compartilhado', description: 'Cenário a dois e acertos mútuos', count: sharedSettlements.length + (sharedScenario ? 1 : 0) },
    ];
  }, [movements, checkpoints, monthlyClosings, natures, accounts, paymentMethods, cards, banks, goals, sharedScenario, sharedSettlements]);

  const toggle = (id: DataFormatCategory) => {
    setResult(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const selectPreset = (ids: DataFormatCategory[]) => {
    setResult(null);
    setSelected(ids);
  };

  const allIds = options.map((o) => o.id);
  const canFormat = selected.length > 0 && confirmText.trim().toUpperCase() === CONFIRM_WORD && !isRunning;
  const selectedLabels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  const keptLabels = options.filter((o) => !selected.includes(o.id)).map((o) => o.label);

  const runFormat = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const ok = await formatUserData(selected);
      setResult(
        ok
          ? { ok: true, message: `Formatação concluída: ${selectedLabels.join(', ')}.` }
          : {
              ok: false,
              message:
                'Os dados foram apagados deste dispositivo, mas parte da exclusão na nuvem falhou. Verifique sua conexão e repita a formatação.',
            }
      );
      if (ok) {
        setSelected([]);
        setConfirmText('');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleFormatClick = () => {
    if (!canFormat) return;
    confirmAction({
      title: 'Formatar dados selecionados',
      message: `Serão apagados definitivamente: ${selectedLabels.join(', ')}.${
        keptLabels.length > 0 ? ` Serão mantidos: ${keptLabels.join(', ')}.` : ''
      } Esta ação não pode ser desfeita.`,
      confirmLabel: 'Formatar',
      onConfirm: () => {
        void runFormat();
      },
    });
  };

  return (
    <div className="subtab-content">
      <h3 className="label-with-info">
        Formatar Dados
        <InfoButton title="Formatar Dados">
          <p>Escolha o que apagar definitivamente da projeção. O que não for marcado permanece intacto.</p>
        </InfoButton>
      </h3>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          lineHeight: 1.5,
          margin: '12px 0 16px',
        }}
      >
        <AlertTriangle size={18} style={{ color: '#F87171', flexShrink: 0, marginTop: '2px' }} />
        <span>
          A formatação remove os dados deste dispositivo <strong>e da nuvem</strong>, em todos os seus acessos. Não é
          possível desfazer.
        </span>
      </div>

      {/* Atalhos de seleção */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectPreset(allIds)}>
          Selecionar tudo
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => selectPreset(allIds.filter((id) => id !== 'NATUREZAS'))}
        >
          Tudo, exceto naturezas
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectPreset([])}>
          Limpar seleção
        </button>
      </div>

      {/* Grupos de dados */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '10px',
        }}
      >
        {options.map((opt) => {
          const isChecked = selected.includes(opt.id);
          return (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: `1px solid ${isChecked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                background: isChecked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(opt.id)}
                style={{ marginTop: '3px', accentColor: '#EF4444' }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{opt.label}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {opt.count} {opt.count === 1 ? 'item' : 'itens'}
                  </span>
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {opt.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Confirmação digitada + ação */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          marginTop: '16px',
        }}
      >
        <input
          type="text"
          className="form-input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`Digite ${CONFIRM_WORD} para confirmar`}
          aria-label={`Digite ${CONFIRM_WORD} para confirmar`}
          style={{ flex: '1 1 220px', maxWidth: '320px' }}
          disabled={selected.length === 0 || isRunning}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={handleFormatClick}
          disabled={!canFormat}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            color: '#FFFFFF',
            background: canFormat ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'rgba(239, 68, 68, 0.25)',
            border: 'none',
            cursor: canFormat ? 'pointer' : 'not-allowed',
          }}
        >
          {isRunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Eraser size={14} />}
          <span>
            {isRunning
              ? 'Formatando…'
              : selected.length > 0
              ? `Formatar ${selected.length} ${selected.length === 1 ? 'grupo' : 'grupos'}`
              : 'Selecione o que apagar'}
          </span>
        </button>
      </div>

      {result && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginTop: '12px',
            fontSize: '13px',
            color: result.ok ? '#34D399' : '#FBBF24',
          }}
        >
          {result.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{result.message}</span>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
