import React, { useEffect, useMemo, useState } from 'react';
import { parseMoney } from '../utils/parseDecimal';
import { Ban,
  CheckCircle2,
  Clock,
  User,
  Users,
  CalendarRange,
  CalendarCheck,
  Lock,
  Undo2,
  AlertTriangle,
  Wallet,
  SlidersHorizontal,
} from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { useFinancial } from '../context/FinancialContext';
import type { MappingItemPaymentAction } from '../types';
import {
  applyMappingItemState,
  getItemOccurrences,
  itemUnitPrice,
  registerItemPayment,
  removeItemPayment,
  resolveMappingItemMonth,
  resolveMappingItemState,
} from '../utils/mappingItemState';

export interface MappingItemStateTarget {
  natureId: string;
  mappingId: string;
  itemId: string;
  monthKey: string;        // competência YYYY-MM
  occurrenceDate?: string; // data clicada no detalhamento (YYYY-MM-DD)
}

interface MappingItemStateModalProps {
  target: MappingItemStateTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatInput = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};
const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// Valores digitados aceitam vírgula ou ponto como decimal ("1.234,56", "1234,56", "1234.56")
const parseBRL = (val: string): number => parseMoney(val);

const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// Motivos da diferença, com a ação sugerida para cada um
const REASONS_ABOVE: { label: string; action: MappingItemPaymentAction }[] = [
  { label: 'Reajuste de preço', action: 'REAJUSTE' },
  { label: 'Dia ou serviço extra', action: 'PONTUAL' },
  { label: 'Multa ou juros', action: 'PONTUAL' },
  { label: 'Outro', action: 'PONTUAL' },
];
const REASONS_BELOW: { label: string; action: MappingItemPaymentAction }[] = [
  { label: 'Reajuste de preço', action: 'REAJUSTE' },
  { label: 'Desconto', action: 'QUITADO' },
  { label: 'Pagou só uma parte', action: 'SALDO_ABERTO' },
  { label: 'Serviço não realizado', action: 'QUITADO' },
  { label: 'Outro', action: 'QUITADO' },
];

/** Botão de opção (segmentado) reutilizado nas perguntas. */
const Choice: React.FC<{
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  tone?: 'emerald' | 'amber' | 'cyan';
  compact?: boolean;
}> = ({ active, onClick, icon, label, hint, tone = 'cyan', compact }) => {
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
        flex: compact ? '0 0 auto' : '1 1 160px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        textAlign: 'left',
        padding: compact ? '6px 10px' : '10px 12px',
        borderRadius: '10px',
        cursor: 'pointer',
        border: `1px solid ${active ? colors.border : 'rgba(255, 255, 255, 0.1)'}`,
        background: active ? colors.bg : 'rgba(255, 255, 255, 0.03)',
        color: active ? colors.fg : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
    >
      {icon && <span style={{ marginTop: '1px', flexShrink: 0 }}>{icon}</span>}
      <span>
        <span style={{ display: 'block', fontSize: compact ? '12px' : '13px', fontWeight: 700 }}>{label}</span>
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

const Stat: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={{ flex: '1 1 110px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
    <strong style={{ fontSize: '14px', color: color || 'var(--text-primary)' }}>{formatBRL(value)}</strong>
  </div>
);

/**
 * Situação e pagamentos de um item mapeado de natureza em uma competência:
 * - Pagamentos: cada pagamento cobre datas (ocorrências) do mês; datas pagas ficam travadas (sem duplicidade).
 *   Se o valor pago difere do esperado, pergunta o motivo e o que fazer (reajustar, pontual, saldo em aberto, quitar).
 * - Situação: realizado, quem paga (eu / outra pessoa, fora dos valores) e se vale para os próximos meses.
 */
export const MappingItemStateModal: React.FC<MappingItemStateModalProps> = ({ target, onClose }) => {
  const { natures, updateMappingItemState } = useFinancial();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();

  const nature = target ? natures.find((n) => n.id === target.natureId) : undefined;
  const mapping = nature?.mappings.find((m) => m.id === target?.mappingId);
  const item = mapping?.items.find((it) => it.id === target?.itemId);

  const [tab, setTab] = useState<'PAGAMENTOS' | 'SITUACAO'>('PAGAMENTOS');

  // ── Aba Situação ───────────────────────────────────────────────────────────
  const [realized, setRealized] = useState(false);
  const [paidByOthers, setPaidByOthers] = useState(false);
  const [paidBy, setPaidBy] = useState('');
  // Não vai acontecer nesta competência (com justificativa opcional)
  const [skipped, setSkipped] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [applyToFuture, setApplyToFuture] = useState(false);

  // ── Aba Pagamentos ─────────────────────────────────────────────────────────
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [paidAt, setPaidAt] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [action, setAction] = useState<MappingItemPaymentAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const monthKey = target?.monthKey || '';
  const summary = useMemo(() => (item && monthKey ? resolveMappingItemMonth(item, monthKey) : null), [item, monthKey]);
  const occurrences = useMemo(() => (item && monthKey ? getItemOccurrences(item, monthKey) : []), [item, monthKey]);
  const openOccurrences = occurrences.filter((o) => !summary?.coveredDates.has(o.date));
  const occurrenceValue = item && monthKey ? (item.quantity || 1) * itemUnitPrice(item, monthKey) : 0;

  // Carrega a situação vigente e a seleção inicial sempre que abrir para um item/competência
  useEffect(() => {
    if (!target || !item) return;
    const state = resolveMappingItemState(item, target.monthKey);
    setRealized(!!state.realized);
    setPaidByOthers(!!state.paidByOthers);
    setPaidBy(state.paidBy || '');
    setSkipped(!!state.skipped);
    setSkipReason(state.skipReason || '');
    // Sugere "próximos meses" quando a situação atual já vem de uma regra recorrente
    setApplyToFuture(!item.monthStates?.[target.monthKey] && (item.stateRules || []).some((r) => r.fromMonth <= target.monthKey));
    setTab('PAGAMENTOS');
    setFeedback(null);
    resetPaymentForm(target.occurrenceDate);
  }, [target]);

  const resetPaymentForm = (referenceDate?: string) => {
    const summaryNow = item && target ? resolveMappingItemMonth(item, target.monthKey) : null;
    const occ = item && target ? getItemOccurrences(item, target.monthKey) : [];
    const open = occ.filter((o) => !summaryNow?.coveredDates.has(o.date));
    const initial =
      referenceDate && open.some((o) => o.date === referenceDate)
        ? [referenceDate]
        : open.length === 1
        ? [open[0].date]
        : [];
    setSelectedDates(initial);
    setAmountTouched(false);
    setPaidAt(todayIso());
    setReason('');
    setCustomReason('');
    setAction(null);
  };

  const expected = Math.round(selectedDates.length * occurrenceValue * 100) / 100;

  // Enquanto o usuário não digitar, o valor pago acompanha o esperado das datas selecionadas
  useEffect(() => {
    if (!amountTouched) setAmountInput(expected > 0 ? formatInput(expected) : '');
  }, [expected, amountTouched]);

  const amount = parseBRL(amountInput);
  const diff = Math.round((amount - expected) * 100) / 100;
  const hasDiff = selectedDates.length > 0 && amount > 0 && Math.abs(diff) >= 0.01;
  const reasons = diff > 0 ? REASONS_ABOVE : REASONS_BELOW;
  const newUnitPrice =
    selectedDates.length > 0 && item ? Math.round((amount / (selectedDates.length * (item.quantity || 1))) * 100) / 100 : 0;

  const actionOptions: { value: MappingItemPaymentAction; label: string; hint: string }[] =
    diff > 0
      ? [
          { value: 'REAJUSTE', label: 'Reajustar o previsto', hint: `Novo valor por ocorrência: ${formatBRL(newUnitPrice)}, a partir de ${monthLabel(monthKey)}` },
          { value: 'PONTUAL', label: 'Diferença pontual', hint: 'Só neste pagamento; o previsto dos próximos não muda' },
        ]
      : [
          { value: 'REAJUSTE', label: 'Reajustar o previsto', hint: `Novo valor por ocorrência: ${formatBRL(newUnitPrice)}, a partir de ${monthLabel(monthKey)}` },
          { value: 'SALDO_ABERTO', label: 'Restante continua previsto', hint: `${formatBRL(Math.abs(diff))} fica em aberto neste mês` },
          { value: 'QUITADO', label: 'Quitar com a diferença', hint: `Estas datas ficam quitadas; os ${formatBRL(Math.abs(diff))} não serão cobrados` },
        ];

  // Ações inválidas para o sinal atual da diferença são descartadas
  useEffect(() => {
    if (action && !actionOptions.some((o) => o.value === action)) setAction(null);
  }, [diff > 0]);

  if (!target) return null;

  const month = monthLabel(target.monthKey);

  const toggleDate = (date: string) =>
    setSelectedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()));

  // Atalhos de cobertura: só a data clicada, a semana dela (dom–sáb) ou o mês inteiro
  const reference = target.occurrenceDate && openOccurrences.some((o) => o.date === target.occurrenceDate)
    ? target.occurrenceDate
    : openOccurrences[0]?.date;
  const weekOf = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const start = new Date(y, m - 1, d - new Date(y, m - 1, d).getDay());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return openOccurrences
      .filter((o) => {
        const [oy, om, od] = o.date.split('-').map(Number);
        const t = new Date(oy, om - 1, od).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .map((o) => o.date);
  };

  const finalReason = reason === 'Outro' ? customReason.trim() || 'Outro' : reason;
  const canRegister = !!item && selectedDates.length > 0 && amount > 0 && (!hasDiff || (!!reason && !!action));

  const handleRegister = () => {
    if (!item || !canRegister) return;
    updateMappingItemState(
      target.natureId,
      target.mappingId,
      target.itemId,
      registerItemPayment(item, target.monthKey, {
        paidAt,
        amount,
        coveredDates: selectedDates,
        reason: hasDiff ? finalReason : undefined,
        action: hasDiff && action ? action : undefined,
      })
    );
    setFeedback(
      `Pagamento de ${formatBRL(amount)} registrado para ${selectedDates.map(formatDate).join(', ')}.` +
        (hasDiff && action === 'REAJUSTE' ? ` Previsto reajustado para ${formatBRL(newUnitPrice)} por ocorrência.` : '')
    );
    setSelectedDates([]);
    setAmountTouched(false);
    setReason('');
    setCustomReason('');
    setAction(null);
  };

  const handleUndo = (paymentId: string, label: string) => {
    if (!item) return;
    confirmAction({
      title: 'Desfazer pagamento',
      message: `Desfazer o pagamento de ${label}? As datas cobertas voltam a ficar previstas. Reajustes de preço já aplicados são mantidos.`,
      confirmLabel: 'Desfazer',
      variant: 'warning',
      onConfirm: () => {
        updateMappingItemState(target.natureId, target.mappingId, target.itemId, removeItemPayment(item, target.monthKey, paymentId));
        setFeedback(null);
      },
    });
  };

  const handleSaveSituation = () => {
    if (!item) return;
    updateMappingItemState(
      target.natureId,
      target.mappingId,
      target.itemId,
      applyMappingItemState(item, target.monthKey, { realized, paidByOthers, paidBy, skipped, skipReason }, applyToFuture)
    );
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={!!target}
        onClose={onClose}
        title={item ? item.description : 'Item não encontrado'}
        subtitle={item ? `${nature?.name} • ${mapping?.name} • Competência de ${month}` : undefined}
        maxWidth="560px"
      >
        {!item || !summary ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Este item não existe mais no mapeamento da natureza.
          </p>
        ) : (
          <div>
            {/* Resumo do mês */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                marginBottom: '14px',
              }}
            >
              <Stat label="Previsto no mês" value={summary.base} />
              <Stat label="Pago" value={summary.paid} color="#34D399" />
              <Stat label="Em aberto" value={summary.pending} color={summary.pending > 0 ? '#FBBF24' : undefined} />
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <Choice compact active={tab === 'PAGAMENTOS'} onClick={() => setTab('PAGAMENTOS')} icon={<Wallet size={14} />} label="Pagamentos" />
              <Choice compact active={tab === 'SITUACAO'} onClick={() => setTab('SITUACAO')} icon={<SlidersHorizontal size={14} />} label="Situação" />
            </div>

            {tab === 'PAGAMENTOS' ? (
              <div>
                {summary.state.skipped && (
                  <p style={{ fontSize: '12px', color: 'var(--accent-amber)', marginBottom: '12px' }}>
                    Este item está marcado como "não vai acontecer" em {month}
                    {summary.state.skipReason ? ` (${summary.state.skipReason})` : ''} e não entra nos valores. Altere na aba
                    Situação para registrar pagamentos.
                  </p>
                )}
                {summary.state.paidByOthers && (
                  <p style={{ fontSize: '12px', color: '#FBBF24', marginBottom: '12px' }}>
                    Este item está como pago por {summary.state.paidBy || 'outra pessoa'} em {month} e não entra nos valores.
                    Altere na aba Situação para registrar pagamentos.
                  </p>
                )}

                {/* Pagamentos já registrados */}
                {summary.payments.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Pagamentos em {month}
                    </div>
                    {summary.payments.map((p) => {
                      const pDiff = Math.round((p.amount - p.expectedAmount) * 100) / 100;
                      const actionLabel =
                        p.action === 'REAJUSTE'
                          ? 'Reajuste'
                          : p.action === 'SALDO_ABERTO'
                          ? 'Saldo em aberto'
                          : p.action === 'QUITADO'
                          ? 'Quitado com diferença'
                          : p.action === 'PONTUAL'
                          ? 'Diferença pontual'
                          : '';
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            marginBottom: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <CheckCircle2 size={14} style={{ color: '#34D399', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--text-primary)' }}>
                              <strong>{formatBRL(p.amount)}</strong> em {formatDate(p.paidAt)} • cobre{' '}
                              {p.coveredDates.map(formatDate).join(', ')}
                            </div>
                            {Math.abs(pDiff) >= 0.01 && (
                              <div style={{ color: '#FBBF24', marginTop: '2px' }}>
                                {pDiff > 0 ? '+' : '−'}
                                {formatBRL(Math.abs(pDiff))} vs previsto
                                {p.reason ? ` • ${p.reason}` : ''}
                                {actionLabel ? ` • ${actionLabel}` : ''}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleUndo(p.id, `${formatBRL(p.amount)} (${p.coveredDates.map(formatDate).join(', ')})`)}
                            title="Desfazer este pagamento"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Undo2 size={13} /> Desfazer
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Registrar novo pagamento */}
                {!summary.state.paidByOthers && !summary.state.skipped && openOccurrences.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Registrar pagamento — o que ele cobre?
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {reference && (
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setSelectedDates([reference])}>
                          Só {formatDate(reference)}
                        </button>
                      )}
                      {reference && occurrences.length > 1 && (
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setSelectedDates(weekOf(reference))}>
                          Esta semana
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setSelectedDates(openOccurrences.map((o) => o.date))}
                      >
                        Mês inteiro
                      </button>
                    </div>

                    {/* Datas do mês: pagas ficam travadas */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '6px',
                        maxHeight: '170px',
                        overflowY: 'auto',
                        marginBottom: '12px',
                      }}
                    >
                      {occurrences.map((o) => {
                        const coveringPayment = summary.coveredDates.get(o.date);
                        const checked = selectedDates.includes(o.date);
                        return (
                          <label
                            key={o.date}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              cursor: coveringPayment ? 'not-allowed' : 'pointer',
                              opacity: coveringPayment ? 0.55 : 1,
                              border: `1px solid ${checked ? 'rgba(56, 189, 248, 0.55)' : 'rgba(255, 255, 255, 0.08)'}`,
                              background: checked ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                              color: 'var(--text-secondary)',
                            }}
                            title={coveringPayment ? `Pago em ${formatDate(coveringPayment.paidAt)}` : undefined}
                          >
                            {coveringPayment ? (
                              <Lock size={12} />
                            ) : (
                              <input type="checkbox" checked={checked} onChange={() => toggleDate(o.date)} />
                            )}
                            <span style={{ flex: 1 }}>
                              {formatDate(o.date)} ({weekday(o.date)})
                            </span>
                            <span>{coveringPayment ? 'pago' : formatBRL(o.value)}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <label style={{ flex: '1 1 150px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Valor pago (esperado {formatBRL(expected)})
                        <input
                          type="text"
                          className="form-input"
                          inputMode="decimal"
                          value={amountInput}
                          onChange={(e) => {
                            setAmountTouched(true);
                            setAmountInput(e.target.value);
                          }}
                          placeholder="0,00"
                          style={{ width: '100%', marginTop: '4px' }}
                        />
                      </label>
                      <label style={{ flex: '1 1 150px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Data do pagamento
                        <input
                          type="date"
                          className="form-input"
                          value={paidAt}
                          onChange={(e) => setPaidAt(e.target.value)}
                          style={{ width: '100%', marginTop: '4px' }}
                        />
                      </label>
                    </div>

                    {/* Diferença: por quê e o que fazer */}
                    {hasDiff && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          background: 'rgba(245, 158, 11, 0.06)',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#FBBF24', fontWeight: 700, marginBottom: '8px' }}>
                          <AlertTriangle size={14} />
                          Diferença de {diff > 0 ? '+' : '−'}
                          {formatBRL(Math.abs(diff))} em relação ao previsto
                        </div>
                        <Question title="Por que o valor foi diferente?">
                          {reasons.map((r) => (
                            <Choice
                              key={r.label}
                              compact
                              active={reason === r.label}
                              onClick={() => {
                                setReason(r.label);
                                setAction(r.action);
                              }}
                              label={r.label}
                              tone="amber"
                            />
                          ))}
                        </Question>
                        {reason === 'Outro' && (
                          <input
                            type="text"
                            className="form-input"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Descreva o motivo"
                            style={{ width: '100%', marginTop: '-8px', marginBottom: '12px' }}
                          />
                        )}
                        <Question title="O que fazer a seguir?">
                          {actionOptions.map((o) => (
                            <Choice
                              key={o.value}
                              active={action === o.value}
                              onClick={() => setAction(o.value)}
                              label={o.label}
                              hint={o.hint}
                            />
                          ))}
                        </Question>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                        Fechar
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleRegister} disabled={!canRegister}>
                        Registrar pagamento
                      </button>
                    </div>
                  </div>
                )}

                {!summary.state.paidByOthers && !summary.state.skipped && openOccurrences.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#34D399' }}>Todas as datas de {month} já foram pagas.</p>
                )}

                {feedback && (
                  <p role="status" style={{ fontSize: '12px', color: '#34D399', marginTop: '10px' }}>
                    {feedback}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Question title={`Como fica ${month}?`}>
                  <Choice
                    active={realized && !skipped}
                    onClick={() => {
                      setRealized(true);
                      setSkipped(false);
                    }}
                    icon={<CheckCircle2 size={16} />}
                    label="Sim, já foi pago"
                    hint="Sem pagamentos registrados, conta o valor previsto"
                    tone="emerald"
                  />
                  <Choice
                    active={!realized && !skipped}
                    onClick={() => {
                      setRealized(false);
                      setSkipped(false);
                    }}
                    icon={<Clock size={16} />}
                    label="Ainda não"
                    hint="Continua previsto a vencer"
                    tone="amber"
                  />
                  <Choice
                    active={skipped}
                    onClick={() => {
                      setSkipped(true);
                      setRealized(false);
                    }}
                    icon={<Ban size={16} />}
                    label="Não vai acontecer"
                    hint="Esta compra não ocorre: sai dos valores"
                  />
                </Question>

                {skipped && (
                  <input
                    type="text"
                    className="form-input"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="Por quê? (opcional)"
                    aria-label="Justificativa"
                    style={{ width: '100%', marginTop: '-6px', marginBottom: '16px' }}
                  />
                )}

                {!skipped && (
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
                )}

                {!skipped && paidByOthers && (
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
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveSituation}>
                    Salvar situação
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog {...dialogProps} />
    </>
  );
};
