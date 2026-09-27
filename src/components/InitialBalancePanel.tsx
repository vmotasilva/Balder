import React, { useState } from 'react';
import { CheckCircle2, Lock, Unlock } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { DecimalInput } from './DecimalInput';
import type { MonthlyGridProjectionRow } from '../types';

interface InitialBalancePanelProps {
  row: MonthlyGridProjectionRow;
  previousRow?: MonthlyGridProjectionRow;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Saldo inicial da competência: no 1º mês vem do ponto de partida (editável aqui); nos demais, é o saldo
 * de fechamento do mês anterior. Ajustá-lo fecha o mês anterior com o saldo real conferido, e a diferença
 * para a projeção fica registrada como ajuste de conciliação.
 */
export const InitialBalancePanel: React.FC<InitialBalancePanelProps> = ({ row, previousRow }) => {
  const { activeCheckpoint, updateCheckpoint, addCheckpoint, monthlyClosings, closeMonth, reopenMonth } = useFinancial();

  const previousClosing = previousRow ? monthlyClosings.find((c) => c.monthKey === previousRow.monthKey) : undefined;
  // Saldo final do mês anterior pela projeção (sem o fechamento)
  const previousProjectedEnd = previousRow
    ? Math.round(((previousRow.initialBalance || 0) + previousRow.monthNet) * 100) / 100
    : 0;

  const [value, setValue] = useState<number>(
    previousRow ? previousClosing?.closingBalance ?? previousProjectedEnd : row.initialBalance || 0
  );
  const [notes, setNotes] = useState(previousClosing?.notes || '');
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  // ── 1º mês: saldo do ponto de partida ──
  if (!previousRow) {
    return (
      <div className="initial-balance-panel">
        <div className="initial-balance-head">
          <span>
            Saldo inicial de <strong>{row.competenceLabel}</strong>: <strong>{formatBRL(row.initialBalance || 0)}</strong>
          </span>
          <small>
            {activeCheckpoint
              ? `Vem do ponto de partida "${activeCheckpoint.label || 'Marco'}" (${formatDate(activeCheckpoint.startDate)}).`
              : 'Ainda não há ponto de partida: informe o saldo para começar a acompanhar.'}
          </small>
        </div>
        <div className="initial-balance-form">
          <label className="initial-balance-field">
            <span>Saldo inicial (R$)</span>
            <DecimalInput className="form-input" value={value} onValueChange={setValue} />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (activeCheckpoint) {
                updateCheckpoint(activeCheckpoint.id, { initialBalance: value });
              } else {
                addCheckpoint({ startDate: `${row.monthKey}-01`, initialBalance: value, label: 'Ponto de Partida Inicial' });
              }
              flashSaved();
            }}
          >
            Salvar saldo inicial
          </button>
          {saved && (
            <span className="initial-balance-saved">
              <CheckCircle2 size={14} /> Salvo
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Demais meses: fechamento do mês anterior ──
  const diff = Math.round((value - previousProjectedEnd) * 100) / 100;
  return (
    <div className="initial-balance-panel">
      <div className="initial-balance-head">
        <span>
          Saldo inicial de <strong>{row.competenceLabel}</strong>: <strong>{formatBRL(row.initialBalance || 0)}</strong>
        </span>
        <small>
          {previousClosing ? (
            <>
              <Lock size={12} /> {previousRow.competenceLabel} foi fechado com {formatBRL(previousClosing.closingBalance)} (a
              projeção indicava {formatBRL(previousClosing.projectedBalance)}; ajuste de{' '}
              {formatBRL(previousClosing.adjustmentAmount)}).
            </>
          ) : (
            <>
              Transportado de {previousRow.competenceLabel}, ainda não fechado: a projeção indica{' '}
              {formatBRL(previousProjectedEnd)} no fim do mês.
            </>
          )}
        </small>
      </div>

      <div className="initial-balance-form">
        <label className="initial-balance-field">
          <span>Saldo real no fim de {previousRow.competenceLabel} (R$)</span>
          <DecimalInput className="form-input" value={value} onValueChange={setValue} />
        </label>
        <label className="initial-balance-field initial-balance-notes">
          <span>Observação (opcional)</span>
          <input
            type="text"
            className="form-input"
            placeholder="Ex.: conferido com o extrato do banco"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            closeMonth(previousRow.monthKey, value, previousProjectedEnd, notes.trim() || undefined);
            flashSaved();
          }}
        >
          {previousClosing ? 'Atualizar fechamento' : `Fechar ${previousRow.competenceLabel} com este saldo`}
        </button>
        {previousClosing && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => reopenMonth(previousRow.monthKey)}>
            <Unlock size={13} /> Reabrir {previousRow.competenceLabel}
          </button>
        )}
        {saved && (
          <span className="initial-balance-saved">
            <CheckCircle2 size={14} /> Salvo
          </span>
        )}
      </div>

      {Math.abs(diff) > 0.005 && (
        <small className={diff > 0 ? 'text-emerald' : 'text-rose'}>
          {formatBRL(Math.abs(diff))} {diff > 0 ? 'acima' : 'abaixo'} do previsto pela projeção; a diferença fica registrada como
          ajuste de conciliação do mês.
        </small>
      )}
    </div>
  );
};
