import React, { useState } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { MovementType, MovementStatus } from '../types';

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MovementType;
}

export const NewMovementModal: React.FC<NewMovementModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'PAGAR',
}) => {
  const { addMovement } = useFinancial();

  const [type, setType] = useState<MovementType>(defaultType);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [bank, setBank] = useState('Nubank');
  const [category, setCategory] = useState('Geral');
  const [status, setStatus] = useState<MovementStatus>('PREVISTA');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor, informe uma descrição e um valor numérico válido.');
      return;
    }

    addMovement({
      title: title.trim(),
      type,
      amount: numAmount,
      dueDate,
      bank,
      status,
      category,
      notes: notes.trim() || undefined,
    });

    // Reset Form
    setTitle('');
    setAmount('');
    setNotes('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Movimentação"
      subtitle="Adicione uma previsão ou registro financeiro direto ao seu fluxo"
    >
      <form onSubmit={handleSubmit} className="movement-form">
        {/* Type Selector Tabs */}
        <div className="form-type-selector">
          <button
            type="button"
            className={`type-chip ${type === 'RECEBER' ? 'active-receber' : ''}`}
            onClick={() => setType('RECEBER')}
          >
            + A Receber
          </button>
          <button
            type="button"
            className={`type-chip ${type === 'PAGAR' ? 'active-pagar' : ''}`}
            onClick={() => setType('PAGAR')}
          >
            - A Pagar
          </button>
          <button
            type="button"
            className={`type-chip ${type === 'EMPRESTIMO' ? 'active-emp' : ''}`}
            onClick={() => setType('EMPRESTIMO')}
          >
            ⚡ Empréstimo
          </button>
          <button
            type="button"
            className={`type-chip ${type === 'CARTAO' ? 'active-cc' : ''}`}
            onClick={() => setType('CARTAO')}
          >
            💳 Cartão
          </button>
        </div>

        {/* Title */}
        <div className="form-group">
          <label htmlFor="mov-title">Descrição / Título</label>
          <input
            id="mov-title"
            type="text"
            className="form-input"
            placeholder="Ex: Salário, Aluguel, Supermercado..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Amount & Due Date */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="mov-amount">Valor (R$)</label>
            <input
              id="mov-amount"
              type="text"
              className="form-input text-lg font-bold"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="mov-date">Data de Vencimento</label>
            <input
              id="mov-date"
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Bank & Category */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="mov-bank">Conta / Instituição</label>
            <select
              id="mov-bank"
              className="form-select"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              <option value="Nubank">Nubank</option>
              <option value="Inter">Inter</option>
              <option value="XP">XP Investimentos</option>
              <option value="Caixa">Caixa Econômica</option>
              <option value="Outro">Outro Banco</option>
            </select>
          </div>

          <div className="form-group flex-1">
            <label htmlFor="mov-category">Categoria</label>
            <select
              id="mov-category"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Salário">Salário & Renda</option>
              <option value="Moradia">Moradia / Condomínio</option>
              <option value="Alimentação">Alimentação & Mercado</option>
              <option value="Educação">Educação</option>
              <option value="Saúde">Saúde & Farmácia</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Investimentos">Investimentos & FIIs</option>
              <option value="Geral">Outras Despesas</option>
            </select>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="form-group">
          <label>Status Inicial</label>
          <div className="status-radio-group">
            <label className={`radio-pill ${status === 'PREVISTA' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="status"
                value="PREVISTA"
                checked={status === 'PREVISTA'}
                onChange={() => setStatus('PREVISTA')}
              />
              <span>Prevista (Futura)</span>
            </label>

            <label className={`radio-pill ${status === 'REALIZADA' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="status"
                value="REALIZADA"
                checked={status === 'REALIZADA'}
                onChange={() => setStatus('REALIZADA')}
              />
              <span>Já Realizada (Liquidada)</span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label htmlFor="mov-notes">Observações (opcional)</label>
          <input
            id="mov-notes"
            type="text"
            className="form-input"
            placeholder="Anotações adicionais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="modal-footer-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar Movimentação
          </button>
        </div>
      </form>
    </Modal>
  );
};
