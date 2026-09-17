import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  Unlock,
  CheckCircle2,
  Calculator,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type { MonthlyGridProjectionRow } from '../types';

interface MonthClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: MonthlyGridProjectionRow | null;
  onCloseMonth: (
    monthKey: string,
    closingBalance: number,
    projectedBalance: number,
    notes?: string
  ) => void;
  onReopenMonth: (monthKey: string) => void;
}

export const MonthClosingModal: React.FC<MonthClosingModalProps> = ({
  isOpen,
  onClose,
  row,
  onCloseMonth,
  onReopenMonth,
}) => {
  if (!isOpen || !row) return null;

  // Próxima competência para feedback visual
  const [yearStr, monthStr] = row.monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const nextMonthDate = new Date(year, month, 1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const totalIncome =
    row.extrasTotal + row.salary + (row.loanReceived || 0);
  const totalExpense =
    row.creditCardTotal +
    row.fixedCostDirect +
    row.variableCost +
    (row.loanPayment || 0);

  // Saldo projetado apurado pelo sistema
  const projectedBalance = Math.round((row.initialBalance + row.monthNet) * 100) / 100;

  // Estado para o valor informado de fechamento
  const [closingValueInput, setClosingValueInput] = useState<string>(() => {
    if (row.closingDetails) {
      return row.closingDetails.closingBalance.toFixed(2).replace('.', ',');
    }
    return projectedBalance.toFixed(2).replace('.', ',');
  });

  const [notes, setNotes] = useState<string>(() => row.closingDetails?.notes || '');

  // Atualizar quando o row mudar
  useEffect(() => {
    if (row.closingDetails) {
      setClosingValueInput(row.closingDetails.closingBalance.toFixed(2).replace('.', ','));
      setNotes(row.closingDetails.notes || '');
    } else {
      setClosingValueInput(projectedBalance.toFixed(2).replace('.', ','));
      setNotes('');
    }
  }, [row, projectedBalance]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Converter valor digitado
  const numericClosingValue = useMemo(() => {
    const clean = closingValueInput.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }, [closingValueInput]);

  const difference = Math.round((numericClosingValue - projectedBalance) * 100) / 100;

  const handleConfirmClosing = (e: React.FormEvent) => {
    e.preventDefault();
    onCloseMonth(row.monthKey, numericClosingValue, projectedBalance, notes.trim() || undefined);
    onClose();
  };

  const handleReopen = () => {
    if (window.confirm(`Tem certeza que deseja reabrir a competência de ${row.competenceLabel}? Os cálculos voltarão a ser projetados dinamicamente.`)) {
      onReopenMonth(row.monthKey);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${row.isClosed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'}`}>
              {row.isClosed ? <Lock className="w-5 h-5" /> : <Calculator className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Fechamento Financeiro da Competência
                </h2>
                {row.isClosed ? (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                    Fechado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    Em Aberto
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {row.competenceLabel.toUpperCase()} ({row.formattedCompetence})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmClosing} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Resumo Contábil do Mês */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Saldo Abertura</span>
              <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                {row.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Entradas (+)</span>
              <span className="text-xs font-semibold text-emerald-400 block mt-0.5">
                {totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Saídas (-)</span>
              <span className="text-xs font-semibold text-rose-400 block mt-0.5">
                {totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Resultado Mês</span>
              <span className={`text-xs font-semibold block mt-0.5 ${row.monthNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {row.monthNet >= 0 ? '+' : ''}
                {row.monthNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {/* Saldo Apurado vs Saldo Real de Fechamento */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
              <div>
                <span className="text-xs text-slate-400 font-medium block">
                  Saldo Final Calculado pelo Balder
                </span>
                <span className="text-sm text-slate-200 font-bold block mt-0.5">
                  {projectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Diferença de Conciliação</span>
                <span
                  className={`text-xs font-semibold block mt-0.5 ${
                    difference === 0
                      ? 'text-emerald-400'
                      : difference > 0
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                  }`}
                >
                  {difference === 0
                    ? '✓ R$ 0,00 (Exato)'
                    : `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Saldo Real em Conta ao Fechar o Mês (R$)</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Extrato bancário no último dia do mês
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                  R$
                </span>
                <input
                  type="text"
                  value={closingValueInput}
                  onChange={(e) => setClosingValueInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            {/* Impacto no próximo mês */}
            <div className="p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-primary-200 leading-relaxed">
                <span className="font-semibold text-white">Transporte Contínuo de Saldo:</span> Ao
                fechar esta competência, o valor de{' '}
                <strong className="text-white">
                  {numericClosingValue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </strong>{' '}
                será transportado e fixado como o <strong>Saldo Inicial</strong> de{' '}
                <span className="capitalize">{nextMonthLabel}</span>.
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Notas de Conciliação (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Conciliado com extrato do Itaú e fatura Nubank quitada"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          {row.isClosed && row.closingDetails && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Competência fechada em{' '}
                  <strong>
                    {new Date(row.closingDetails.closedAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(row.closingDetails.closedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleReopen}
                className="px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors flex items-center gap-1"
              >
                <Unlock className="w-3 h-3" />
                Reabrir
              </button>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-500 active:bg-primary-700 rounded-xl shadow-lg shadow-primary-900/30 transition-all flex items-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              {row.isClosed ? 'Atualizar Fechamento' : 'Efetivar Fechamento'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
