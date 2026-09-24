import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { MovementStatus } from '../types';
import { CreditCard, Calendar, DollarSign, Building2, Check, AlertCircle } from 'lucide-react';
import { getBankBranding, POPULAR_BANKS } from '../utils/bankBranding';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBank?: string;
}

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({
  isOpen,
  onClose,
  defaultBank,
}) => {
  const { addMovement, cards, banks, accounts } = useFinancial();

  // Opções consolidadas de Bancos / Cartões
  const bankOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; type: 'card' | 'bank' | 'preset'; cardDueDay?: number }> = [];
    const seen = new Set<string>();

    // 1. Cartões cadastrados pelo usuário
    cards.forEach((c) => {
      const label = c.bank ? `${c.bank} (${c.name})` : c.name;
      if (!seen.has(label.toLowerCase())) {
        seen.add(label.toLowerCase());
        list.push({
          id: `card_${c.id}`,
          name: c.bank || c.name,
          type: 'card',
          cardDueDay: c.dueDay,
        });
      }
    });

    // 2. Contas cadastradas
    accounts.forEach((a) => {
      const bName = a.bankName || a.name;
      if (bName && !seen.has(bName.toLowerCase())) {
        seen.add(bName.toLowerCase());
        list.push({
          id: `acc_${a.id}`,
          name: bName,
          type: 'bank',
        });
      }
    });

    // 3. Instituições bancárias cadastradas
    banks.forEach((b) => {
      if (b.name && !seen.has(b.name.toLowerCase())) {
        seen.add(b.name.toLowerCase());
        list.push({
          id: `inst_${b.id}`,
          name: b.name,
          type: 'bank',
        });
      }
    });

    // 4. Bancos populares predefinidos
    POPULAR_BANKS.forEach((b) => {
      if (!seen.has(b.toLowerCase())) {
        seen.add(b.toLowerCase());
        list.push({
          id: `preset_${b}`,
          name: b,
          type: 'preset',
        });
      }
    });

    return list;
  }, [cards, accounts, banks]);

  // Estados do Formulário
  const [selectedBank, setSelectedBank] = useState<string>('Nubank');
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [customBankName, setCustomBankName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [isTitleCustom, setIsTitleCustom] = useState(false);
  const [status, setStatus] = useState<MovementStatus>('PREVISTA');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Banco efetivo selecionado
  const effectiveBank = isCustomBank ? customBankName.trim() : selectedBank;
  const bankBrand = getBankBranding(effectiveBank);

  // Inicialização ao abrir modal
  useEffect(() => {
    if (isOpen) {
      // Define banco padrão
      const initialBank = defaultBank || cards[0]?.bank || 'Nubank';
      setSelectedBank(initialBank);
      setIsCustomBank(false);
      setCustomBankName('');
      setAmount('');
      setErrorMsg('');
      setStatus('PREVISTA');
      setNotes('');
      setIsTitleCustom(false);

      // Calcular data de vencimento padrão (próximo dia 10 ou dia do cartão)
      const now = new Date();
      const matchedCard = cards.find((c) => c.bank?.toLowerCase() === initialBank.toLowerCase());
      const targetDay = matchedCard?.dueDay || 10;

      let dueYear = now.getFullYear();
      let dueMonth = now.getMonth(); // 0-indexed

      // Se hoje já passou do dia de vencimento, projeta para o próximo mês
      if (now.getDate() > targetDay) {
        dueMonth += 1;
        if (dueMonth > 11) {
          dueMonth = 0;
          dueYear += 1;
        }
      }

      const dueDayStr = String(targetDay).padStart(2, '0');
      const dueMonthStr = String(dueMonth + 1).padStart(2, '0');
      const initDueDate = `${dueYear}-${dueMonthStr}-${dueDayStr}`;
      setDueDate(initDueDate);

      // Título sugerido baseado no mês de vencimento
      const dateObj = new Date(initDueDate + 'T12:00:00');
      const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
      const capMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      setTitle(`Fatura ${initialBank} (${capMonth})`);
    }
  }, [isOpen, defaultBank, cards]);

  // Atualizar título automaticamente quando o banco ou vencimento mudar (a menos que o usuário tenha customizado manualmente)
  const handleBankChange = (newBank: string) => {
    if (newBank === '__CUSTOM__') {
      setIsCustomBank(true);
      setSelectedBank('');
    } else {
      setIsCustomBank(false);
      setSelectedBank(newBank);

      // Ajustar dia do vencimento se o cartão tiver dueDay cadastrado
      const matched = cards.find((c) => c.bank?.toLowerCase() === newBank.toLowerCase());
      if (matched?.dueDay && dueDate) {
        const parts = dueDate.split('-');
        if (parts.length === 3) {
          const newDue = `${parts[0]}-${parts[1]}-${String(matched.dueDay).padStart(2, '0')}`;
          setDueDate(newDue);
        }
      }

      if (!isTitleCustom && dueDate) {
        const dateObj = new Date(dueDate + 'T12:00:00');
        const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        const capMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
        setTitle(`Fatura ${newBank} (${capMonth})`);
      }
    }
  };

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate);
    if (!isTitleCustom && newDate) {
      const dateObj = new Date(newDate + 'T12:00:00');
      const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
      const capMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      const bName = effectiveBank || 'Cartão';
      setTitle(`Fatura ${bName} (${capMonth})`);
    }
  };

  // Submissão do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAmount = amount.replace(/[R$\s]/g, '').trim();
    let parsedAmount = 0;
    if (cleanAmount.includes('.') && cleanAmount.includes(',')) {
      parsedAmount = parseFloat(cleanAmount.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (cleanAmount.includes(',')) {
      parsedAmount = parseFloat(cleanAmount.replace(',', '.')) || 0;
    } else {
      parsedAmount = parseFloat(cleanAmount) || 0;
    }

    if (parsedAmount <= 0) {
      setErrorMsg('Por favor, informe um valor válido e positivo para a fatura.');
      return;
    }

    if (!effectiveBank) {
      setErrorMsg('Por favor, selecione ou informe o banco do cartão.');
      return;
    }

    if (!dueDate) {
      setErrorMsg('Por favor, informe a data de vencimento da fatura.');
      return;
    }

    const finalTitle = title.trim() || `Fatura ${effectiveBank}`;

    addMovement({
      title: finalTitle,
      type: 'CARTAO',
      amount: Math.round(parsedAmount * 100) / 100,
      dueDate,
      bank: effectiveBank,
      status,
      category: 'Não Analisada',
      notes: notes.trim() || `Fatura cadastrada manualmente para conciliação`,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Fatura de Cartão"
      subtitle="Defina o banco emissor, o valor total e o vencimento da fatura para conciliação"
      maxWidth="520px"
    >
      <form onSubmit={handleSubmit} className="movement-form">
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Prévia do Banco Selecionado */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: bankBrand.headerGradient,
            border: `1px solid ${bankBrand.badgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: bankBrand.primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: `0 0 12px ${bankBrand.primaryColor}55`,
              }}
            >
              {bankBrand.iconText}
            </div>
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: bankBrand.textColor,
                }}
              >
                Emissor da Fatura
              </span>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
                {effectiveBank || 'Selecione o Banco'}
              </h4>
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '9999px',
              background: bankBrand.badgeBg,
              border: `1px solid ${bankBrand.badgeBorder}`,
              color: bankBrand.textColor,
            }}
          >
            Cartão de Crédito
          </span>
        </div>

        {/* Campo Banco / Instituição */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label htmlFor="inv-bank" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>Qual o Banco / Emissor?</span>
          </label>

          {!isCustomBank ? (
            <select
              id="inv-bank"
              className="form-select"
              value={selectedBank}
              onChange={(e) => handleBankChange(e.target.value)}
              required
            >
              <optgroup label="Meus Cartões & Contas">
                {bankOptions
                  .filter((b) => b.type !== 'preset')
                  .map((b) => (
                    <option key={b.id} value={b.name}>
                      💳 {b.name} {b.cardDueDay ? `(Vence dia ${b.cardDueDay})` : ''}
                    </option>
                  ))}
              </optgroup>

              <optgroup label="Principais Bancos">
                {bankOptions
                  .filter((b) => b.type === 'preset')
                  .map((b) => (
                    <option key={b.id} value={b.name}>
                      {getBankBranding(b.name).iconText} {b.name}
                    </option>
                  ))}
              </optgroup>

              <option value="__CUSTOM__">➕ Outro banco (digitar nome)...</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Banco Safra, PagBank, Mercado Pago..."
                value={customBankName}
                onChange={(e) => setCustomBankName(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '0 12px' }}
                onClick={() => {
                  setIsCustomBank(false);
                  setSelectedBank(cards[0]?.bank || 'Nubank');
                }}
              >
                Voltar à lista
              </button>
            </div>
          )}
        </div>

        {/* Campo Valor da Fatura e Data de Vencimento */}
        <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="inv-amount" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>Valor da Fatura (R$)</span>
            </label>
            <input
              id="inv-amount"
              type="text"
              className="form-input"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#38BDF8',
                letterSpacing: '0.02em',
              }}
              placeholder="0,00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              required
              autoFocus={!isCustomBank}
            />
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="inv-due-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>Vencimento</span>
            </label>
            <input
              id="inv-due-date"
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Título / Descrição da Fatura */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label htmlFor="inv-title" style={{ marginBottom: 0 }}>
              Identificação da Fatura
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (Ex: Fatura Nubank, Cartão Black...)
            </span>
          </div>
          <input
            id="inv-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsTitleCustom(true);
            }}
            placeholder="Ex: Fatura Nubank (Outubro)"
            required
          />
        </div>

        {/* Status Inicial da Fatura */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label style={{ marginBottom: '6px', display: 'block' }}>Situação da Fatura</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label
              className={`radio-pill ${status === 'PREVISTA' ? 'checked' : ''}`}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: status === 'PREVISTA' ? '1px solid #38BDF8' : '1px solid var(--border-default)',
                background: status === 'PREVISTA' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-input)',
                color: status === 'PREVISTA' ? '#38BDF8' : 'var(--text-secondary)',
                fontWeight: status === 'PREVISTA' ? 700 : 500,
                fontSize: '12px',
              }}
            >
              <input
                type="radio"
                name="inv-status"
                value="PREVISTA"
                checked={status === 'PREVISTA'}
                onChange={() => setStatus('PREVISTA')}
                style={{ display: 'none' }}
              />
              <CreditCard size={14} />
              <span>Em Aberto (Prevista no Fluxo)</span>
            </label>

            <label
              className={`radio-pill ${status === 'REALIZADA' ? 'checked' : ''}`}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: status === 'REALIZADA' ? '1px solid #10B981' : '1px solid var(--border-default)',
                background: status === 'REALIZADA' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                color: status === 'REALIZADA' ? '#34D399' : 'var(--text-secondary)',
                fontWeight: status === 'REALIZADA' ? 700 : 500,
                fontSize: '12px',
              }}
            >
              <input
                type="radio"
                name="inv-status"
                value="REALIZADA"
                checked={status === 'REALIZADA'}
                onChange={() => setStatus('REALIZADA')}
                style={{ display: 'none' }}
              />
              <Check size={14} />
              <span>Já Paga / Liquidada</span>
            </label>
          </div>
        </div>

        {/* Observações Opcionais */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label htmlFor="inv-notes">Observações adicionais (opcional)</label>
          <input
            id="inv-notes"
            type="text"
            className="form-input"
            placeholder="Ex: Compras de viagens, seguro contratado..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Rodapé / Ações */}
        <div className="modal-footer-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" style={{ padding: '9px 24px' }}>
            <CreditCard size={15} />
            <span>Adicionar Fatura</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
