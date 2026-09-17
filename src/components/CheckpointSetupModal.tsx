import React, { useState, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from './Modal';
import { Flag, Calendar, DollarSign, Tag, Info, AlertTriangle, CheckCircle } from 'lucide-react';

interface CheckpointSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialSetup?: boolean;
}

// Utilitário robusto de conversão para moeda brasileira (trata milhares com ponto, vírgula e decimais)
const parseBRLNumber = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/[R$\s]/g, '').trim();
  if (!clean) return 0;
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  if ((clean.match(/\./g) || []).length > 1) {
    return parseFloat(clean.replace(/\./g, '')) || 0;
  }
  return parseFloat(clean) || 0;
};

export const CheckpointSetupModal: React.FC<CheckpointSetupModalProps> = ({
  isOpen,
  onClose,
  isInitialSetup = false,
}) => {
  const { addCheckpoint, activeCheckpoint, checkpoints } = useFinancial();

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const getFirstDayOfMonthString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [label, setLabel] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSavedSuccess(false);
      if (activeCheckpoint && !isInitialSetup) {
        setStartDate(activeCheckpoint.startDate || getTodayString());
        setInitialBalance(String(activeCheckpoint.initialBalance || 0));
        setLabel(`Recomeço ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);
      } else {
        setStartDate(getFirstDayOfMonthString());
        setInitialBalance('0');
        setLabel(isInitialSetup ? 'Ponto de Partida Inicial' : '');
      }
    }
  }, [isOpen, activeCheckpoint, isInitialSetup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseBRLNumber(initialBalance);

    addCheckpoint({
      startDate: startDate || getTodayString(),
      initialBalance: balanceNum,
      label: label.trim() || (isInitialSetup ? 'Ponto de Partida Inicial' : `Marco de ${startDate}`),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 450);
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Banner Informativo */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <Info size={18} className="text-cyan" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--accent-cyan)' }}>Como funciona o Marco Financeiro?</strong>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              O sistema utiliza a <strong>data de início</strong> e o <strong>saldo em caixa</strong> como âncora principal.
              Movimentações a partir dessa data alimentarão o saldo disponível e todas as projeções futuras.
            </p>
          </div>
        </div>

        {checkpoints.length > 0 && !isInitialSetup && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.8rem',
              color: '#FCD34D',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={16} className="text-amber" />
            <span>
              O marco atual ativo será substituído por este novo ponto de partida. Seu histórico anterior continuará seguro.
            </span>
          </div>
        )}

        {/* Campo 1: Data de Início */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem' }}>
              <Calendar size={14} className="text-cyan" />
              Data de Início do Acompanhamento
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={() => setStartDate(getFirstDayOfMonthString())}
              >
                1º do Mês
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={() => setStartDate(getTodayString())}
              >
                Hoje
              </button>
            </div>
          </label>
          <input
            type="date"
            required
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
            Apenas transações a partir desta data influenciarão o saldo em caixa e fluxo do dashboard.
          </span>
        </div>

        {/* Campo 2: Saldo Inicial em Caixa */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
            <DollarSign size={14} className="text-emerald" />
            Saldo Total em Caixa nessa Data (R$)
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                fontSize: '0.9rem',
              }}
            >
              R$
            </span>
            <input
              type="text"
              required
              className="form-input"
              style={{ paddingLeft: '40px', fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '1.05rem' }}
              placeholder="0,00"
              value={initialBalance}
              onFocus={(e) => {
                if (e.target.value === '0') setInitialBalance('');
              }}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
            Valor total real que você tinha disponível (somando conta corrente e carteira) no dia inicial escolhido.
          </span>
        </div>

        {/* Campo 3: Nome do Marco (Opcional) */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
            <Tag size={14} className="text-cyan" />
            Nome do Marco (Opcional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="ex: Ponto de Partida 2026, Novo Ciclo Março"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Botões do Rodapé */}
        <div className="modal-footer-actions" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={savedSuccess}
          >
            {savedSuccess ? (
              <>
                <CheckCircle size={15} />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Flag size={15} />
                <span>{isInitialSetup ? 'Salvar Ponto de Partida' : 'Ativar Novo Marco'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
