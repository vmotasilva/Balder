import React, { useState } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { MovementType, MovementStatus, Movement } from '../types';
import { Calendar, Split } from 'lucide-react';

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
  const { addMovement, addMultipleMovements, accounts, cards, banks } = useFinancial();

  const [type, setType] = useState<MovementType>(defaultType);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [bank, setBank] = useState(() => accounts[0]?.name || 'Nubank');
  const [category, setCategory] = useState('Geral');
  const [status, setStatus] = useState<MovementStatus>('PREVISTA');
  const [notes, setNotes] = useState('');

  // Estados de Parcelamento
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [installmentValueType, setInstallmentValueType] = useState<'TOTAL' | 'PARCELA'>('TOTAL');
  const [firstInstallmentRealized, setFirstInstallmentRealized] = useState(true);

  // Cálculos das Parcelas
  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const count = Math.max(2, Math.min(installmentsCount, 72));

  let perInstallment = 0;
  let totalInstallmentsAmount = 0;

  if (installmentValueType === 'TOTAL') {
    totalInstallmentsAmount = parsedAmount;
    perInstallment = parsedAmount > 0 ? Math.round((parsedAmount / count) * 100) / 100 : 0;
  } else {
    perInstallment = parsedAmount;
    totalInstallmentsAmount = Math.round(parsedAmount * count * 100) / 100;
  }

  // Geração de datas mensais consecutivas
  const getInstallmentDates = (startDateStr: string, n: number) => {
    const dates: string[] = [];
    const parts = startDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    for (let i = 0; i < n; i++) {
      const targetMonth = month + i;
      const d = new Date(year, targetMonth, day);
      if (d.getDate() !== day) {
        d.setDate(0); // Último dia do mês correto
      }
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const installmentDates = getInstallmentDates(dueDate, count);
  const firstDueDateFormatted = installmentDates[0]?.split('-').reverse().join('/') || dueDate;
  const lastDueDateFormatted = installmentDates[installmentDates.length - 1]?.split('-').reverse().join('/') || dueDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || parsedAmount <= 0) {
      alert('Por favor, informe uma descrição e um valor numérico válido.');
      return;
    }

    if (isInstallment && count >= 2) {
      const groupId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      const itemsToAdd: Omit<Movement, 'id'>[] = installmentDates.map((dateStr, idx) => {
        const installmentNum = idx + 1;
        const isFirst = installmentNum === 1;

        // Se o status selecionado for REALIZADA e firstInstallmentRealized estiver ativo:
        // A 1ª é REALIZADA e as próximas 2..N são PREVISTA
        let itemStatus: MovementStatus = status;
        if (status === 'REALIZADA' && firstInstallmentRealized) {
          itemStatus = isFirst ? 'REALIZADA' : 'PREVISTA';
        }

        return {
          title: `${title.trim()} (${installmentNum}/${count})`,
          type,
          amount: perInstallment,
          dueDate: dateStr,
          bank,
          status: itemStatus,
          category,
          notes:
            (notes.trim() ? `${notes.trim()} • ` : '') +
            `Parcela ${installmentNum}/${count} • Total: ${totalInstallmentsAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          installmentNumber: installmentNum,
          installmentsTotal: count,
          installmentGroupId: groupId,
        };
      });

      addMultipleMovements(itemsToAdd);
    } else {
      addMovement({
        title: title.trim(),
        type,
        amount: parsedAmount,
        dueDate,
        bank,
        status,
        category,
        notes: notes.trim() || undefined,
      });
    }

    // Reset Form
    setTitle('');
    setAmount('');
    setNotes('');
    setIsInstallment(false);
    setInstallmentsCount(3);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Movimentação"
      subtitle="Adicione uma previsão, registro financeiro ou parcelamento direto ao seu fluxo"
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
            placeholder="Ex: Salário, Aluguel, Supermercado, Celular..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Amount & Due Date */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="mov-amount">
              {isInstallment && installmentValueType === 'PARCELA' ? 'Valor da Parcela (R$)' : 'Valor (R$)'}
            </label>
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
            <label htmlFor="mov-date">
              {isInstallment ? '1º Vencimento' : 'Data de Vencimento'}
            </label>
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

        {/* SEÇÃO DE PARCELAMENTO */}
        <div className="installment-box glass-card">
          <div className="installment-toggle-row">
            <div className="installment-info-header">
              <Split size={18} className="text-cyan" />
              <div>
                <strong>Parcelamento</strong>
                <span className="text-xs text-muted block">
                  Dividir esta movimentação em parcelas mensais futuras
                </span>
              </div>
            </div>

            <label className="installment-switch-label">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => setIsInstallment(e.target.checked)}
              />
              <span className="installment-switch-pill">
                {isInstallment ? 'PARCELADO' : 'À VISTA / ÚNICA'}
              </span>
            </label>
          </div>

          {isInstallment && (
            <div className="installment-expanded-controls animate-fade-in mt-3">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Número de Parcelas</label>
                  <select
                    className="form-select"
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10))}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24, 36, 48, 60, 72].map((n) => (
                      <option key={n} value={n}>
                        {n}x {n === 12 ? '(1 ano)' : n === 24 ? '(2 anos)' : n === 36 ? '(3 anos)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label>O valor digitado acima é:</label>
                  <div className="installment-type-btns">
                    <button
                      type="button"
                      className={`inst-type-btn ${installmentValueType === 'TOTAL' ? 'active' : ''}`}
                      onClick={() => setInstallmentValueType('TOTAL')}
                    >
                      Valor Total
                    </button>
                    <button
                      type="button"
                      className={`inst-type-btn ${installmentValueType === 'PARCELA' ? 'active' : ''}`}
                      onClick={() => setInstallmentValueType('PARCELA')}
                    >
                      Por Parcela
                    </button>
                  </div>
                </div>
              </div>

              {/* Opção para primeira parcela se status for Realizada */}
              {status === 'REALIZADA' && (
                <div className="installment-first-realized-row mt-2">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={firstInstallmentRealized}
                      onChange={(e) => setFirstInstallmentRealized(e.target.checked)}
                    />
                    <span className="text-xs text-secondary">
                      Apenas a 1ª parcela foi paga agora (parcelas 2 a {count} ficarão como <strong>Previstas</strong>)
                    </span>
                  </label>
                </div>
              )}

              {/* Card de Resumo e Projeção Matemática das Parcelas */}
              {parsedAmount > 0 && (
                <div className="installment-summary-banner mt-3">
                  <div className="inst-summary-header">
                    <Calendar size={15} className="text-cyan" />
                    <span>Plano de Parcelamento Projetado</span>
                  </div>
                  <div className="inst-summary-content">
                    <div className="inst-summary-metric">
                      <span className="text-xs text-muted">Parcelas</span>
                      <strong className="text-cyan">{count}x de {perInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="inst-summary-metric">
                      <span className="text-xs text-muted">Valor Total</span>
                      <strong className="text-white">{totalInstallmentsAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="inst-summary-metric">
                      <span className="text-xs text-muted">Período</span>
                      <span className="text-xs text-secondary">{firstDueDateFormatted} até {lastDueDateFormatted}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bank & Category */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="mov-bank">Conta / Cartão / Instituição</label>
            <select
              id="mov-bank"
              className="form-select"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              {accounts.length > 0 || cards.length > 0 || banks.length > 0 ? (
                <>
                  {accounts.length > 0 && (
                    <optgroup label="Minhas Contas">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.icon} {acc.name} ({acc.type})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {cards.length > 0 && (
                    <optgroup label="Meus Cartões de Crédito">
                      {cards.map((c) => (
                        <option key={c.id} value={c.name}>
                          💳 {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {banks.length > 0 && (
                    <optgroup label="Outras Instituições">
                      {banks.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.icon} {b.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="Outro">Outro</option>
                </>
              ) : (
                <>
                  <option value="Nubank">🟣 Nubank</option>
                  <option value="Inter">🟠 Banco Inter</option>
                  <option value="XP">⚪ XP Investimentos</option>
                  <option value="Caixa">🔵 Caixa Econômica</option>
                  <option value="Outro">Outro Banco</option>
                </>
              )}
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
            {isInstallment ? `Salvar ${count} Parcelas` : 'Salvar Movimentação'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

