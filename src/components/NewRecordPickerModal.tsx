import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Home, Landmark, ShoppingBag } from 'lucide-react';
import { Modal } from './Modal';

export type NewRecordKind = 'PAGAR' | 'RECEBER' | 'COMPRA' | 'EMPRESTIMO' | 'CARTAO';

interface NewRecordPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kind: NewRecordKind) => void;
}

interface Option {
  kind?: NewRecordKind;
  label: string;
  hint: string;
  icon: React.ElementType;
  color: string;
}

const OPTIONS: Option[] = [
  { kind: 'PAGAR', label: 'Conta a pagar', hint: 'Aluguel, boleto, assinatura, conta fixa', icon: ArrowDownCircle, color: 'var(--accent-rose)' },
  { kind: 'RECEBER', label: 'Conta a receber', hint: 'Salário, venda, reembolso, outras entradas', icon: ArrowUpCircle, color: 'var(--accent-emerald)' },
  { kind: 'COMPRA', label: 'Compra', hint: 'À vista ou parcelada', icon: ShoppingBag, color: 'var(--accent-cyan)' },
  { kind: 'EMPRESTIMO', label: 'Empréstimo', hint: 'Contrato com parcelas e saldo devedor', icon: Landmark, color: 'var(--accent-amber)' },
  { kind: 'CARTAO', label: 'Fatura de cartão', hint: 'Fatura ou gasto no cartão de crédito', icon: CreditCard, color: 'var(--accent-purple)' },
  { label: 'Financiamento', hint: 'Em breve', icon: Home, color: 'var(--text-muted)' },
];

/** Primeiro passo do "+": pergunta o que será registrado e o sistema abre a tela específica. */
export const NewRecordPickerModal: React.FC<NewRecordPickerModalProps> = ({ isOpen, onClose, onSelect }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="O que você quer registrar?"
    subtitle="Escolha o tipo e abrimos a tela certa para o cadastro"
    maxWidth="520px"
  >
    <div className="record-picker-list">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const disabled = !o.kind;
        return (
          <button
            key={o.label}
            type="button"
            className="record-picker-item"
            disabled={disabled}
            onClick={() => o.kind && onSelect(o.kind)}
          >
            <span className="record-picker-icon" style={{ color: o.color }}>
              <Icon size={20} />
            </span>
            <span className="record-picker-text">
              <strong>{o.label}</strong>
              <small>{o.hint}</small>
            </span>
          </button>
        );
      })}
    </div>
  </Modal>
);
