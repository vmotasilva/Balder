import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CreditCard, FileSignature, Home, Landmark } from 'lucide-react';
import { Modal } from './Modal';

export type NewRecordKind = 'PAGAR' | 'RECEBER' | 'EMPRESTIMO' | 'CARTAO';

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
  /** Abre o pop-up de contratação em vez de uma tela */
  contract?: boolean;
}

const MAIN_OPTIONS: Option[] = [
  { kind: 'PAGAR', label: 'Conta a pagar', hint: 'Contas, boletos e compras (à vista ou parceladas, no saldo ou no cartão)', icon: ArrowDownCircle, color: 'var(--accent-rose)' },
  { kind: 'RECEBER', label: 'Conta a receber', hint: 'Salário, venda, reembolso, outras entradas', icon: ArrowUpCircle, color: 'var(--accent-emerald)' },
  { kind: 'CARTAO', label: 'Fatura de cartão', hint: 'Cadastrar a fatura de um cartão de crédito', icon: CreditCard, color: 'var(--accent-purple)' },
];

const CONTRACT_OPTIONS: Option[] = [
  { kind: 'EMPRESTIMO', label: 'Empréstimo', hint: 'Simular e contratar, com parcelas e saldo devedor', icon: Landmark, color: 'var(--accent-amber)' },
  { label: 'Financiamento', hint: 'Em breve', icon: Home, color: 'var(--text-muted)' },
];

/** Primeiro passo do "+": pergunta o que será registrado e o sistema abre a tela específica. */
export const NewRecordPickerModal: React.FC<NewRecordPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  // "Contratar" abre um segundo pop-up com as modalidades de crédito
  const [contracting, setContracting] = useState(false);
  useEffect(() => {
    if (isOpen) setContracting(false);
  }, [isOpen]);

  const options: Option[] = contracting
    ? CONTRACT_OPTIONS
    : [
        ...MAIN_OPTIONS,
        { label: 'Contratar', hint: 'Empréstimo ou financiamento', icon: FileSignature, color: 'var(--accent-amber)', contract: true },
      ];

  return (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={contracting ? 'O que você vai contratar?' : 'O que você quer registrar?'}
    subtitle={contracting ? 'Escolha a modalidade de crédito' : 'Escolha o tipo e abrimos a tela certa para o cadastro'}
    maxWidth="520px"
  >
    <div className="record-picker-list">
      {contracting && (
        <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setContracting(false)}>
          ← Voltar
        </button>
      )}
      {options.map((o) => {
        const Icon = o.icon;
        const disabled = !o.kind && !o.contract;
        return (
          <button
            key={o.label}
            type="button"
            className="record-picker-item"
            disabled={disabled}
            onClick={() => (o.contract ? setContracting(true) : o.kind && onSelect(o.kind))}
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
};
