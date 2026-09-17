import React, { useState, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from './Modal';
import { Flag, Calendar, DollarSign, Tag, Info, AlertTriangle } from 'lucide-react';

interface CheckpointSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialSetup?: boolean;
}

export const CheckpointSetupModal: React.FC<CheckpointSetupModalProps> = ({
  isOpen,
  onClose,
  isInitialSetup = false,
}) => {
  const { addCheckpoint, activeCheckpoint, checkpoints } = useFinancial();

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (activeCheckpoint && !isInitialSetup) {
        // Se já existe e quer criar novo recomeço
        setStartDate(getTodayString());
        setInitialBalance(String(activeCheckpoint.initialBalance || 0));
        setLabel(`Recomeço ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);
      } else {
        setStartDate(getTodayString());
        setInitialBalance('0');
        setLabel(isInitialSetup ? 'Início do Acompanhamento' : '');
      }
    }
  }, [isOpen, activeCheckpoint, isInitialSetup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(initialBalance.replace(',', '.')) || 0;

    addCheckpoint({
      startDate: startDate || getTodayString(),
      initialBalance: balanceNum,
      label: label.trim() || (isInitialSetup ? 'Início do Acompanhamento' : `Marco de ${startDate}`),
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isInitialSetup ? '🎯 Definir Ponto de Partida' : '🚩 Novo Marco de Acompanhamento'}
      subtitle={
        isInitialSetup
          ? 'Defina a data e o saldo inicial em caixa a partir de quando suas métricas serão calculadas.'
          : 'Inicie uma nova fase de acompanhamento sem perder seu histórico anterior.'
      }
      maxWidth="540px"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner Informativo */}
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 flex gap-2.5 items-start">
          <Info size={18} className="text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-cyan-300">Como funciona o Marco Financeiro?</p>
            <p className="mt-1 leading-relaxed text-slate-300">
              O sistema utiliza a <strong>data de início</strong> e o <strong>saldo em caixa</strong> como âncora principal. 
              Movimentos realizados e previstos a partir dessa data alimentarão o saldo disponível e os cálculos futuros.
            </p>
          </div>
        </div>

        {checkpoints.length > 0 && !isInitialSetup && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex gap-2.5 items-center">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span>
              O marco atual ativo será substituído por este novo ponto de partida. Seu histórico anterior continuará seguro.
            </span>
          </div>
        )}

        {/* Data de Início */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-indigo-400" />
            Data de Início do Acompanhamento
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            Apenas transações a partir desta data influenciarão o saldo e fluxo.
          </span>
        </div>

        {/* Saldo Inicial em Caixa */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <DollarSign size={14} className="text-emerald-400" />
            Saldo em Caixa nessa Data (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">
              R$
            </span>
            <input
              type="text"
              required
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0,00"
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Valor total real disponível em contas e carteira no dia inicial escolhido.
          </span>
        </div>

        {/* Nome do Marco (Opcional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Tag size={14} className="text-purple-400" />
            Nome do Marco (Opcional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: Início 2026, Recomeço Balder, Planejamento Março"
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all flex items-center gap-2"
          >
            <Flag size={14} />
            {isInitialSetup ? 'Salvar Ponto de Partida' : 'Ativar Novo Marco'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
