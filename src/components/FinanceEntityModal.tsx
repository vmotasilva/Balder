import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type {
  BankAccount,
  BankAccountType,
  CreditCardItem,
  CardBrand,
  PaymentMethodItem,
  PaymentMethodType,
  BankInstitution,
} from '../types';
import {
  Landmark,
  CreditCard,
  Wallet,
  Building2,
  Check,
  Sparkles,
} from 'lucide-react';

export type EntityTab = 'CONTA' | 'CARTAO' | 'PAGAMENTO' | 'BANCO';

interface FinanceEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: EntityTab;
  editItem?: {
    type: EntityTab;
    data: any;
  } | null;
}

const COLOR_PRESETS = [
  { label: 'Roxo Nubank', value: '#8A05BE' },
  { label: 'Laranja Inter', value: '#FF7A00' },
  { label: 'Esmeralda', value: '#10B981' },
  { label: 'Ciano Balder', value: '#06B6D4' },
  { label: 'Azul Real', value: '#2563EB' },
  { label: 'Dourado / Âmbar', value: '#F59E0B' },
  { label: 'Grafite Escuro', value: '#1E293B' },
  { label: 'Rosa Magenta', value: '#EC4899' },
  { label: 'Vermelho Santander', value: '#DC2626' },
];

const POPULAR_BANKS = [
  { name: 'Nubank S.A.', code: '260', color: '#8A05BE', icon: '🟣' },
  { name: 'Banco Inter', code: '077', color: '#FF7A00', icon: '🟠' },
  { name: 'Itaú Unibanco', code: '341', color: '#EC7000', icon: '🟧' },
  { name: 'Bradesco', code: '237', color: '#CC092F', icon: '🔴' },
  { name: 'Santander', code: '033', color: '#EC0000', icon: '🟥' },
  { name: 'Caixa Econômica', code: '104', color: '#0066B3', icon: '🔵' },
  { name: 'Banco do Brasil', code: '001', color: '#F8D117', icon: '🟡' },
  { name: 'C6 Bank', code: '336', color: '#242424', icon: '⚫' },
  { name: 'XP Investimentos', code: '102', color: '#1E293B', icon: '⚪' },
  { name: 'BTG Pactual', code: '208', color: '#001E62', icon: '🔷' },
];

const ACCOUNT_ICONS = ['🟣', '🟠', '🟢', '🔵', '🟡', '🏦', '💵', '💼', '📈', '🪙', '✨'];
const PAYMENT_ICONS = ['⚡', '💳', '📄', '💵', '🏧', '📲', '🔄', '🏦'];

export const FinanceEntityModal: React.FC<FinanceEntityModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'CONTA',
  editItem = null,
}) => {
  const {
    accounts,
    cards,
    banks,
    addAccount,
    updateAccount,
    addCard,
    updateCard,
    addPaymentMethod,
    updatePaymentMethod,
    addBank,
    updateBank,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<EntityTab>(initialTab);

  // Estados Conta
  const [accountName, setAccountName] = useState('');
  const [accountBank, setAccountBank] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('CORRENTE');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountColor, setAccountColor] = useState('#06B6D4');
  const [accountIcon, setAccountIcon] = useState('🏦');

  // Estados Cartão
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardBrand, setCardBrand] = useState<CardBrand>('MASTERCARD');
  const [cardLimit, setCardLimit] = useState('');
  const [cardLimitUsed, setCardLimitUsed] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState(28);
  const [cardDueDay, setCardDueDay] = useState(5);
  const [cardColor, setCardColor] = useState('#8A05BE');

  // Estados Forma de Pagamento
  const [paymentName, setPaymentName] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('PIX');
  const [paymentLinkedAccount, setPaymentLinkedAccount] = useState('');
  const [paymentLinkedCard, setPaymentLinkedCard] = useState('');
  const [paymentIcon, setPaymentIcon] = useState('⚡');
  const [paymentColor, setPaymentColor] = useState('#00D2B6');

  // Estados Banco
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankColor, setBankColor] = useState('#06B6D4');
  const [bankIcon, setBankIcon] = useState('🏦');
  const [bankStatus, setBankStatus] = useState<'CONECTADO' | 'MANUAL'>('MANUAL');

  // Inicialização quando abre ou muda aba/item para edição
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setActiveTab(editItem.type);
        if (editItem.type === 'CONTA') {
          const d: BankAccount = editItem.data;
          setAccountName(d.name || '');
          setAccountBank(d.bankName || '');
          setAccountType(d.type || 'CORRENTE');
          setAccountBalance(d.balance !== undefined ? String(d.balance) : '');
          setAccountColor(d.color || '#06B6D4');
          setAccountIcon(d.icon || '🏦');
        } else if (editItem.type === 'CARTAO') {
          const d: CreditCardItem = editItem.data;
          setCardName(d.name || '');
          setCardBank(d.bank || '');
          setCardBrand(d.brand || 'MASTERCARD');
          setCardLimit(d.limitTotal !== undefined ? String(d.limitTotal) : '');
          setCardLimitUsed(d.limitUsed !== undefined ? String(d.limitUsed) : '');
          setCardClosingDay(d.closingDay || 28);
          setCardDueDay(d.dueDay || 5);
          setCardColor(d.color || '#8A05BE');
        } else if (editItem.type === 'PAGAMENTO') {
          const d: PaymentMethodItem = editItem.data;
          setPaymentName(d.name || '');
          setPaymentType(d.type || 'PIX');
          setPaymentLinkedAccount(d.linkedAccountId || '');
          setPaymentLinkedCard(d.linkedCardId || '');
          setPaymentIcon(d.icon || '⚡');
          setPaymentColor(d.color || '#00D2B6');
        } else if (editItem.type === 'BANCO') {
          const d: BankInstitution = editItem.data;
          setBankName(d.name || '');
          setBankCode(d.code || '');
          setBankColor(d.color || '#06B6D4');
          setBankIcon(d.icon || '🏦');
          setBankStatus(d.status || 'MANUAL');
        }
      } else {
        setActiveTab(initialTab);
        // Reset defaults
        setAccountName('');
        setAccountBank(banks[0]?.name || 'Nubank');
        setAccountType('CORRENTE');
        setAccountBalance('');
        setAccountColor('#06B6D4');
        setAccountIcon('🏦');

        setCardName('');
        setCardBank(banks[0]?.name || 'Nubank');
        setCardBrand('MASTERCARD');
        setCardLimit('');
        setCardLimitUsed('');
        setCardClosingDay(28);
        setCardDueDay(5);
        setCardColor('#8A05BE');

        setPaymentName('');
        setPaymentType('PIX');
        setPaymentLinkedAccount(accounts[0]?.id || '');
        setPaymentLinkedCard(cards[0]?.id || '');
        setPaymentIcon('⚡');
        setPaymentColor('#00D2B6');

        setBankName('');
        setBankCode('');
        setBankColor('#06B6D4');
        setBankIcon('🏦');
        setBankStatus('MANUAL');
      }
    }
  }, [isOpen, initialTab, editItem]);

  const handleSubmitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      alert('Informe o nome da conta ou carteira.');
      return;
    }

    const bal = parseFloat(accountBalance.replace(',', '.')) || 0;
    if (editItem && editItem.type === 'CONTA') {
      updateAccount(editItem.data.id, {
        name: accountName.trim(),
        bankName: accountBank.trim() || undefined,
        type: accountType,
        balance: bal,
        color: accountColor,
        icon: accountIcon,
      });
    } else {
      addAccount({
        name: accountName.trim(),
        bankName: accountBank.trim() || undefined,
        type: accountType,
        balance: bal,
        color: accountColor,
        icon: accountIcon,
      });
    }
    onClose();
  };

  const handleSubmitCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) {
      alert('Informe o nome do cartão.');
      return;
    }

    const limit = parseFloat(cardLimit.replace(',', '.')) || 0;
    const used = parseFloat(cardLimitUsed.replace(',', '.')) || 0;

    if (editItem && editItem.type === 'CARTAO') {
      updateCard(editItem.data.id, {
        name: cardName.trim(),
        bank: cardBank.trim() || 'Outro',
        brand: cardBrand,
        limitTotal: limit,
        limitUsed: used,
        closingDay: Math.max(1, Math.min(cardClosingDay, 31)),
        dueDay: Math.max(1, Math.min(cardDueDay, 31)),
        color: cardColor,
      });
    } else {
      addCard({
        name: cardName.trim(),
        bank: cardBank.trim() || 'Outro',
        brand: cardBrand,
        limitTotal: limit,
        limitUsed: used,
        closingDay: Math.max(1, Math.min(cardClosingDay, 31)),
        dueDay: Math.max(1, Math.min(cardDueDay, 31)),
        color: cardColor,
      });
    }
    onClose();
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentName.trim()) {
      alert('Informe o nome da forma de pagamento.');
      return;
    }

    if (editItem && editItem.type === 'PAGAMENTO') {
      updatePaymentMethod(editItem.data.id, {
        name: paymentName.trim(),
        type: paymentType,
        linkedAccountId: paymentLinkedAccount || undefined,
        linkedCardId: paymentLinkedCard || undefined,
        icon: paymentIcon,
        color: paymentColor,
      });
    } else {
      addPaymentMethod({
        name: paymentName.trim(),
        type: paymentType,
        linkedAccountId: paymentLinkedAccount || undefined,
        linkedCardId: paymentLinkedCard || undefined,
        icon: paymentIcon,
        color: paymentColor,
      });
    }
    onClose();
  };

  const handleSubmitBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      alert('Informe o nome da instituição financeira.');
      return;
    }

    if (editItem && editItem.type === 'BANCO') {
      updateBank(editItem.data.id, {
        name: bankName.trim(),
        code: bankCode.trim() || undefined,
        color: bankColor,
        icon: bankIcon,
        status: bankStatus,
      });
    } else {
      addBank({
        name: bankName.trim(),
        code: bankCode.trim() || undefined,
        color: bankColor,
        icon: bankIcon,
        status: bankStatus,
      });
    }
    onClose();
  };

  const getModalTitle = () => {
    const isEdit = !!editItem;
    switch (activeTab) {
      case 'CONTA':
        return isEdit ? 'Editar Conta Bancária / Carteira' : 'Nova Conta Bancária ou Carteira';
      case 'CARTAO':
        return isEdit ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito';
      case 'PAGAMENTO':
        return isEdit ? 'Editar Meio de Pagamento' : 'Novo Meio de Pagamento';
      case 'BANCO':
        return isEdit ? 'Editar Banco / Instituição' : 'Novo Banco ou Instituição';
    }
  };

  const getModalSubtitle = () => {
    switch (activeTab) {
      case 'CONTA':
        return 'Cadastre contas correntes, poupanças, contas de investimento ou carteiras físicas';
      case 'CARTAO':
        return 'Cadastre seus cartões de crédito para controle de limites, faturas e parcelas';
      case 'PAGAMENTO':
        return 'Configure opções de liquidação rápida como PIX, Boletos e Cartões';
      case 'BANCO':
        return 'Adicione bancos e instituições para organização das suas contas e conciliação';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      subtitle={getModalSubtitle()}
      maxWidth="620px"
    >
      {/* Entity Type Selector Tabs (oculto quando editando item específico) */}
      {!editItem && (
        <div className="entity-modal-tabs">
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'CONTA' ? 'active' : ''}`}
            onClick={() => setActiveTab('CONTA')}
          >
            <Landmark size={15} />
            <span>Conta</span>
          </button>
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'CARTAO' ? 'active' : ''}`}
            onClick={() => setActiveTab('CARTAO')}
          >
            <CreditCard size={15} />
            <span>Cartão</span>
          </button>
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'PAGAMENTO' ? 'active' : ''}`}
            onClick={() => setActiveTab('PAGAMENTO')}
          >
            <Wallet size={15} />
            <span>Forma Pagamento</span>
          </button>
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'BANCO' ? 'active' : ''}`}
            onClick={() => setActiveTab('BANCO')}
          >
            <Building2 size={15} />
            <span>Banco / Instituição</span>
          </button>
        </div>
      )}

      {/* TAB 1: CONTA BANCÁRIA & CARTEIRA */}
      {activeTab === 'CONTA' && (
        <form onSubmit={handleSubmitAccount} className="space-y-4">
          <div className="form-group">
            <label>Nome / Identificador da Conta *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Nubank Principal, Itaú Reserva, Carteira Dinheiro"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Instituição / Banco</label>
              <div className="flex gap-2">
                <select
                  className="form-select flex-1"
                  value={accountBank}
                  onChange={(e) => setAccountBank(e.target.value)}
                >
                  <option value="">Nenhum / Não vinculado</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.icon} {b.name}
                    </option>
                  ))}
                  <option value="Nubank">🟣 Nubank</option>
                  <option value="Inter">🟠 Banco Inter</option>
                  <option value="Itaú">🟧 Itaú</option>
                  <option value="Bradesco">🔴 Bradesco</option>
                  <option value="Santander">🟥 Santander</option>
                  <option value="Caixa">🔵 Caixa Econômica</option>
                  <option value="Banco do Brasil">🟡 Banco do Brasil</option>
                  <option value="XP">⚪ XP Investimentos</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div className="form-group flex-1">
              <label>Tipo da Conta</label>
              <select
                className="form-select"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as BankAccountType)}
              >
                <option value="CORRENTE">Conta Corrente (Caixa)</option>
                <option value="POUPANCA">Poupança / Reserva de Emergência</option>
                <option value="INVESTIMENTO">Conta de Investimentos (Ações/FIIs/Renda Fixa)</option>
                <option value="CARTEIRA">Carteira Física (Dinheiro em Mãos)</option>
                <option value="OUTRO">Outra</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Saldo Inicial (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="0,00"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
              />
              <span className="text-xs text-muted mt-1 block">
                {accountType === 'CORRENTE' || accountType === 'CARTEIRA'
                  ? 'Compõe o "Saldo em Caixa" imediatamente.'
                  : 'Compõe o Patrimônio Total Líquido.'}
              </span>
            </div>

            <div className="form-group flex-1">
              <label>Ícone / Emoji Representativo</label>
              <div className="icon-selector-row">
                {ACCOUNT_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`icon-choice-btn ${accountIcon === emoji ? 'active' : ''}`}
                    onClick={() => setAccountIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Cor de Destaque</label>
            <div className="color-presets-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-preset-circle ${accountColor === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onClick={() => setAccountColor(c.value)}
                >
                  {accountColor === c.value && <Check size={12} color="#FFF" />}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions-row mt-6">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{editItem ? 'Salvar Alterações' : 'Cadastrar Conta'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CARTÃO DE CRÉDITO */}
      {activeTab === 'CARTAO' && (
        <form onSubmit={handleSubmitCard} className="space-y-4">
          {/* Card Visual Preview */}
          <div
            className="credit-card-preview-box animate-fade-in"
            style={{
              background: `linear-gradient(135deg, ${cardColor} 0%, #0b0f19 100%)`,
              borderColor: cardColor,
            }}
          >
            <div className="cc-preview-top">
              <div className="cc-preview-chip"></div>
              <span className="cc-preview-brand">{cardBrand}</span>
            </div>
            <div className="cc-preview-number">•••• •••• •••• 8842</div>
            <div className="cc-preview-bottom">
              <div>
                <span className="cc-preview-label">TITULAR</span>
                <strong className="cc-preview-val">{cardName || 'NOME DO CARTÃO'}</strong>
              </div>
              <div>
                <span className="cc-preview-label">VENCIMENTO</span>
                <strong className="cc-preview-val">Dia {cardDueDay}</strong>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Nome do Cartão *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Nubank Ultravioleta, Inter Black, XP Infinite"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Banco Emissor</label>
              <select
                className="form-select"
                value={cardBank}
                onChange={(e) => setCardBank(e.target.value)}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.icon} {b.name}
                  </option>
                ))}
                <option value="Nubank">🟣 Nubank</option>
                <option value="Inter">🟠 Banco Inter</option>
                <option value="XP">⚪ XP Investimentos</option>
                <option value="Itaú">🟧 Itaú</option>
                <option value="Santander">🟥 Santander</option>
                <option value="Bradesco">🔴 Bradesco</option>
                <option value="C6 Bank">⚫ C6 Bank</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Bandeira</label>
              <select
                className="form-select"
                value={cardBrand}
                onChange={(e) => setCardBrand(e.target.value as CardBrand)}
              >
                <option value="MASTERCARD">Mastercard</option>
                <option value="VISA">Visa</option>
                <option value="ELO">Elo</option>
                <option value="AMEX">American Express</option>
                <option value="HIPERCARD">Hipercard</option>
                <option value="OUTRA">Outra Bandeira</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Limite Total do Cartão (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 15.000,00"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
                required
              />
            </div>

            <div className="form-group flex-1">
              <label>Fatura Atual / Limite Utilizado (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 2.350,00 (opcional)"
                value={cardLimitUsed}
                onChange={(e) => setCardLimitUsed(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Dia de Fechamento da Fatura</label>
              <select
                className="form-select"
                value={cardClosingDay}
                onChange={(e) => setCardClosingDay(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Dia de Vencimento da Fatura</label>
              <select
                className="form-select"
                value={cardDueDay}
                onChange={(e) => setCardDueDay(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Cor do Cartão</label>
            <div className="color-presets-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-preset-circle ${cardColor === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onClick={() => setCardColor(c.value)}
                >
                  {cardColor === c.value && <Check size={12} color="#FFF" />}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions-row mt-6">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{editItem ? 'Salvar Alterações' : 'Cadastrar Cartão'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: FORMA DE PAGAMENTO */}
      {activeTab === 'PAGAMENTO' && (
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          <div className="form-group">
            <label>Nome / Identificador da Forma de Pagamento *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: PIX Nubank, Boleto Bancário, Cartão de Crédito Inter"
              value={paymentName}
              onChange={(e) => setPaymentName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Tipo do Meio</label>
              <select
                className="form-select"
                value={paymentType}
                onChange={(e) => {
                  const val = e.target.value as PaymentMethodType;
                  setPaymentType(val);
                  if (val === 'PIX') setPaymentIcon('⚡');
                  else if (val === 'BOLETO') setPaymentIcon('📄');
                  else if (val === 'CARTAO_CREDITO' || val === 'CARTAO_DEBITO') setPaymentIcon('💳');
                  else if (val === 'DINHEIRO') setPaymentIcon('💵');
                  else setPaymentIcon('🔄');
                }}
              >
                <option value="PIX">⚡ PIX</option>
                <option value="CARTAO_CREDITO">💳 Cartão de Crédito</option>
                <option value="CARTAO_DEBITO">🏧 Cartão de Débito</option>
                <option value="BOLETO">📄 Boleto Bancário</option>
                <option value="DINHEIRO">💵 Dinheiro em Espécie</option>
                <option value="TRANSFERENCIA">🔄 Transferência (TED/DOC)</option>
                <option value="OUTRO">Outro Meio</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Ícone</label>
              <div className="icon-selector-row">
                {PAYMENT_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`icon-choice-btn ${paymentIcon === emoji ? 'active' : ''}`}
                    onClick={() => setPaymentIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vínculo opcional com Conta ou Cartão */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Conta Bancária Vinculada (Opcional)</label>
              <select
                className="form-select"
                value={paymentLinkedAccount}
                onChange={(e) => setPaymentLinkedAccount(e.target.value)}
              >
                <option value="">Nenhuma conta vinculada</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon} {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Cartão Vinculado (Opcional)</label>
              <select
                className="form-select"
                value={paymentLinkedCard}
                onChange={(e) => setPaymentLinkedCard(e.target.value)}
              >
                <option value="">Nenhum cartão vinculado</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    💳 {c.name} ({c.brand})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Cor do Meio</label>
            <div className="color-presets-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-preset-circle ${paymentColor === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onClick={() => setPaymentColor(c.value)}
                >
                  {paymentColor === c.value && <Check size={12} color="#FFF" />}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions-row mt-6">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{editItem ? 'Salvar Alterações' : 'Cadastrar Meio de Pagamento'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: BANCO / INSTITUIÇÃO */}
      {activeTab === 'BANCO' && (
        <form onSubmit={handleSubmitBank} className="space-y-4">
          {/* Quick Popular Banks Buttons */}
          <div className="popular-banks-box mb-4">
            <span className="text-xs text-muted block mb-2 font-semibold">
              <Sparkles size={12} className="text-cyan inline mr-1" />
              Bancos Populares (Clique para preencher rápido):
            </span>
            <div className="popular-banks-grid">
              {POPULAR_BANKS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className="popular-bank-btn"
                  onClick={() => {
                    setBankName(b.name);
                    setBankCode(b.code);
                    setBankColor(b.color);
                    setBankIcon(b.icon);
                  }}
                >
                  <span>{b.icon}</span>
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Nome da Instituição Financeira *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Nubank S.A., Banco Inter, BTG Pactual"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group flex-1">
              <label>Código de Compensação (COMPE)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 260, 077, 341"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Tipo de Conexão</label>
              <select
                className="form-select"
                value={bankStatus}
                onChange={(e) => setBankStatus(e.target.value as 'CONECTADO' | 'MANUAL')}
              >
                <option value="MANUAL">Manual (Lançamentos Próprios)</option>
                <option value="CONECTADO">Open Finance Brasil (Integrado)</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Ícone / Logo</label>
              <div className="icon-selector-row">
                {ACCOUNT_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`icon-choice-btn ${bankIcon === emoji ? 'active' : ''}`}
                    onClick={() => setBankIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Cor Institucional</label>
            <div className="color-presets-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-preset-circle ${bankColor === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onClick={() => setBankColor(c.value)}
                >
                  {bankColor === c.value && <Check size={12} color="#FFF" />}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions-row mt-6">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{editItem ? 'Salvar Alterações' : 'Cadastrar Banco'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
