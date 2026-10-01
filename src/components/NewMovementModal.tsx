import React, { useState, useEffect } from 'react';
import { getSalaryCompetenceKey, isSalaryMovement } from '../utils/projectionMath';
import { CASH_IN_HAND } from '../utils/cashInHand';
import { parseMoney } from '../utils/parseDecimal';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import type { MovementType, MovementStatus, Movement, InvoiceNatureItemBreakdown } from '../types';
import { firstInvoiceDueDate, invoiceDueDates } from '../utils/cardPurchase';
import { Calendar, Split, Repeat } from 'lucide-react';

// Valores digitados aceitam vírgula ou ponto como decimal ("7.073,70", "7073,70", "7073.70")
const parseBRLAmount = (val: string): number => parseMoney(val);

// Limite da repetição mensal (20 anos)
const MAX_REPEAT_MONTHS = 240;

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MovementType;
  initialData?: Partial<Movement>;
  /** Registro de compra (à vista ou parcelada): mantém só a saída e libera o parcelamento */
  purchase?: boolean;
}

export const NewMovementModal: React.FC<NewMovementModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'PAGAR',
  initialData,
  purchase = false,
}) => {
  const { addMovement, updateMovement, addMultipleMovements, accounts, cards, banks, movements, sharedScenario } = useFinancial();
  const { user } = useAuth();
  const { viewing } = useAccountScope();

  // Instituições para compras: cada banco aparece uma vez, com a conta e o cartão dele
  const institutions = React.useMemo(() => {
    const names: string[] = [];
    const add = (n?: string) => {
      if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    };
    banks.forEach((b) => add(b.name));
    cards.forEach((c) => add(c.bank));
    accounts.forEach((a) => {
      const known = names.find((n) => a.name.toLowerCase().includes(n.toLowerCase()));
      add(a.bankName || known || a.name);
    });
    return names.map((name) => ({
      name,
      card: cards.find((c) => (c.bank || '').toLowerCase() === name.toLowerCase()),
      account: accounts.find(
        (a) => (a.bankName || '').toLowerCase() === name.toLowerCase() || a.name.toLowerCase().includes(name.toLowerCase())
      ),
    }));
  }, [banks, cards, accounts]);

  // Receitas no planejamento a dois: quem recebe (só essa pessoa confirma o recebimento)
  const [responsibleId, setResponsibleId] = useState('');
  const incomePeople = (sharedScenario?.members || []).filter((m) => m.id && m.status === 'ACTIVE');
  const hasPartner = incomePeople.some((m) => m.role === 'PARTNER');
  // Na conta de outra pessoa, a receita lançada é sempre de quem lança (definido ao gravar)
  const showResponsible = hasPartner && !viewing;

  // Esta tela só registra contas a receber e a pagar; outros tipos viram a pagar
  const baseType = (t: MovementType): MovementType => (t === 'RECEBER' && !purchase ? 'RECEBER' : 'PAGAR');
  const [type, setType] = useState<MovementType>(baseType(defaultType));
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [bank, setBank] = useState(() => accounts[0]?.name || 'Nubank');
  const [category, setCategory] = useState('Geral');
  const [status, setStatus] = useState<MovementStatus>('PREVISTA');
  const [notes, setNotes] = useState('');
  // Compra: primeiro o banco (ou dinheiro em mãos), depois como foi paga
  const [institution, setInstitution] = useState(CASH_IN_HAND);
  const [payMethod, setPayMethod] = useState<'SALDO' | 'CARTAO'>('SALDO');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(baseType(initialData.type || defaultType));
        setTitle(initialData.title || '');
        setAmount(initialData.amount ? String(initialData.amount) : '');
        setDueDate(initialData.dueDate || new Date().toISOString().split('T')[0]);
        setBank(initialData.bank || accounts[0]?.name || 'Nubank');
        setCategory(initialData.category || (initialData.type === 'RECEBER' ? 'Salário' : 'Geral'));
        setStatus(initialData.status || 'REALIZADA');
        setNotes(initialData.notes || '');
      } else {
        setType(baseType(defaultType));
        setTitle('');
        setAmount('');
        setDueDate(new Date().toISOString().split('T')[0]);
        setBank(accounts[0]?.name || 'Nubank');
        setCategory(defaultType === 'RECEBER' ? 'Receita' : 'Geral');
        setStatus(purchase || defaultType === 'RECEBER' ? 'REALIZADA' : 'PREVISTA');
        setNotes('');
      }
      setInstitution(initialData?.bank || (institutions[0]?.name ?? CASH_IN_HAND));
      setPayMethod('SALDO');
      setIsInstallment(false);
      setIsRecurring(false);
      setRecurringMonths(12);
      setInstallmentsCount(3);
      setInstallmentValueType('TOTAL');
      setFirstInstallmentRealized(true);
    }
  }, [isOpen, defaultType, initialData, accounts, purchase]);

  // Repetição mensal (mesmo valor nos meses seguintes) — contas a receber e a pagar
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(12);
  const canRepeat = !purchase;
  const repeating = canRepeat && isRecurring;

  // Estados de Parcelamento
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [installmentValueType, setInstallmentValueType] = useState<'TOTAL' | 'PARCELA'>('TOTAL');
  const [firstInstallmentRealized, setFirstInstallmentRealized] = useState(true);

  // Férias: sugere o último salário antes da data (somando as quinzenas da mesma competência) + 1/3 constitucional
  const buildVacationSuggestion = (typeArg: MovementType, categoryArg: string, dateArg: string) => {
    if (typeArg !== 'RECEBER' || categoryArg !== 'Férias') return null;
    const salaries = movements
      .filter((m) => isSalaryMovement(m) && m.status !== 'CANCELADA' && m.dueDate <= dateArg)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    if (salaries.length === 0) return null;
    // Prefere o último salário já recebido; senão, o último previsto
    const reference = salaries.find((m) => m.status === 'REALIZADA') || salaries[0];
    const competence = getSalaryCompetenceKey(reference);
    const salary =
      Math.round(
        salaries
          .filter((m) => getSalaryCompetenceKey(m) === competence && m.status === reference.status)
          .reduce((acc, m) => acc + (m.actualAmount ?? m.amount), 0) * 100
      ) / 100;
    if (salary <= 0) return null;
    return { salary, competence, value: Math.round((salary + salary / 3) * 100) / 100 };
  };
  const vacationSuggestion = buildVacationSuggestion(type, category, dueDate);

  // Cálculos das Parcelas
  const parsedAmount = parseBRLAmount(amount);
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

  // Compra no cartão: cai direto na fatura do banco (e as parcelas nas faturas seguintes)
  const selectedInstitution = institutions.find((i) => i.name === institution);
  const cardPurchase = purchase && institution !== CASH_IN_HAND && payMethod === 'CARTAO';
  const installing = cardPurchase && isInstallment;
  const firstInvoiceDue = cardPurchase
    ? firstInvoiceDueDate(dueDate, selectedInstitution?.card?.closingDay, selectedInstitution?.card?.dueDay)
    : dueDate;
  const installmentDates = cardPurchase ? invoiceDueDates(firstInvoiceDue, count) : getInstallmentDates(dueDate, count);
  const firstDueDateFormatted = installmentDates[0]?.split('-').reverse().join('/') || dueDate;
  const lastDueDateFormatted = installmentDates[installmentDates.length - 1]?.split('-').reverse().join('/') || dueDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || parsedAmount <= 0) {
      alert('Por favor, informe uma descrição e um valor numérico válido.');
      return;
    }

    // Receita de outra pessoa: entra prevista e só ela confirma o recebimento
    const incomeOwner = type === 'RECEBER' && showResponsible && responsibleId ? responsibleId : undefined;
    const confirmableByMe = !incomeOwner || incomeOwner === user?.$id;
    const extra: Partial<Movement> = incomeOwner ? { responsibleId: incomeOwner } : {};
    const submitStatus: MovementStatus = confirmableByMe ? status : 'PREVISTA';

    if (cardPurchase) {
      const n = installing ? count : 1;
      const dates = invoiceDueDates(firstInvoiceDue, n);
      const cleanTitle = title.trim();
      const itemId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const total = installing ? totalInstallmentsAmount : parsedAmount;
      const each = installing ? perInstallment : parsedAmount;
      dates.forEach((dateStr, idx) => {
        const item: InvoiceNatureItemBreakdown = {
          id: `${itemId}_${idx + 1}`,
          natureId: 'OUTROS',
          natureName: 'Outros',
          description: n > 1 ? `${cleanTitle} (${idx + 1}/${n})` : cleanTitle,
          amount: each,
          isAnalyzed: true,
          installments: n,
          currentInstallment: idx + 1,
          finalAmount: total,
        };
        const target = movements.find(
          (inv) =>
            inv.type === 'CARTAO' &&
            inv.status === 'PREVISTA' &&
            (inv.bank || '').trim().toLowerCase() === institution.trim().toLowerCase() &&
            inv.dueDate.startsWith(dateStr.substring(0, 7))
        );
        if (target) {
          // Usa o que a fatura ainda tem sem detalhar; o que passar disso aumenta o total da fatura
          const free = target.unanalyzedAmount ?? 0;
          const extra = Math.max(0, Math.round((each - free) * 100) / 100);
          updateMovement(target.id, {
            amount: Math.round((target.amount + extra) * 100) / 100,
            invoiceBreakdown: [...(target.invoiceBreakdown || []), item],
            unanalyzedAmount: Math.max(0, Math.round((free - each) * 100) / 100),
          });
        } else {
          const monthName = new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
          addMovement({
            title: `Fatura ${institution} (${monthName.charAt(0).toUpperCase()}${monthName.slice(1)})`,
            type: 'CARTAO',
            amount: each,
            dueDate: dateStr,
            bank: institution,
            status: 'PREVISTA',
            category: 'Fatura de Cartão',
            notes: notes.trim() || undefined,
            invoiceBreakdown: [item],
            unanalyzedAmount: 0,
          });
        }
      });
    } else if (repeating && recurringMonths >= 2) {
      const groupId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const dates = getInstallmentDates(dueDate, recurringMonths);
      addMultipleMovements(
        dates.map((dateStr, idx) => ({
          title: title.trim(),
          type,
          amount: parsedAmount,
          dueDate: dateStr,
          bank,
          // Só o primeiro mês pode já ter acontecido; os seguintes ficam previstos
          status: idx === 0 ? submitStatus : 'PREVISTA',
          category,
          notes: (notes.trim() ? `${notes.trim()} • ` : '') + `Repetição mensal ${idx + 1}/${recurringMonths}`,
          installmentGroupId: groupId,
          ...extra,
        }))
      );
    } else if (installing && count >= 2) {
      const groupId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      const itemsToAdd: Omit<Movement, 'id'>[] = installmentDates.map((dateStr, idx) => {
        const installmentNum = idx + 1;
        const isFirst = installmentNum === 1;

        // Se o status selecionado for REALIZADA e firstInstallmentRealized estiver ativo:
        // A 1ª é REALIZADA e as próximas 2..N são PREVISTA
        let itemStatus: MovementStatus = submitStatus;
        if (submitStatus === 'REALIZADA' && firstInstallmentRealized) {
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
          ...extra,
        };
      });

      addMultipleMovements(itemsToAdd);
    } else {
      addMovement({
        title: title.trim(),
        type,
        amount: parsedAmount,
        dueDate,
        bank: purchase ? (selectedInstitution?.account?.name ?? institution) : bank,
        status: submitStatus,
        category,
        notes: notes.trim() || undefined,
        ...extra,
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
      title={purchase ? 'Registrar Compra' : 'Conta a Receber / a Pagar'}
      subtitle={
        purchase
          ? 'Compra à vista ou parcelada, lançada nas saídas do seu fluxo'
          : 'Adicione uma previsão ou registro financeiro ao seu fluxo'
      }
    >
      <form onSubmit={handleSubmit} className="movement-form">
        {/* Type Selector Tabs (compra é sempre saída) */}
        {!purchase && (
          <div className="form-type-selector" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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
          </div>
        )}

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
              {installing && installmentValueType === 'PARCELA' ? 'Valor da Parcela (R$)' : 'Valor (R$)'}
            </label>
            <input
              id="mov-amount"
              type="text"
              inputMode="decimal"
              className="form-input text-lg font-bold"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {vacationSuggestion && (
              <span className="form-hint vacation-hint">
                Último salário ({vacationSuggestion.competence.split('-').reverse().join('/')}):{' '}
                {vacationSuggestion.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} + 1/3 de férias ={' '}
                <strong>{vacationSuggestion.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                {parseBRLAmount(amount) !== vacationSuggestion.value && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setAmount(vacationSuggestion.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}
                  >
                    usar
                  </button>
                )}
              </span>
            )}
          </div>

          <div className="form-group flex-1">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label htmlFor="mov-date" style={{ marginBottom: 0 }}>
                {purchase ? 'Data da compra' : 'Data de Vencimento'}
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.7rem', padding: '1px 6px', height: 'auto', color: 'var(--accent-cyan)' }}
                  onClick={() => setDueDate(new Date().toISOString().split('T')[0])}
                  title="Definir para a data de hoje"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.7rem', padding: '1px 6px', height: 'auto', color: 'var(--accent-cyan)' }}
                  onClick={() => {
                    const now = new Date();
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
                    setDueDate(`${now.getFullYear()}-${monthStr}-${String(lastDay).padStart(2, '0')}`);
                  }}
                  title="Definir para o último dia do mês atual"
                >
                  Fim do Mês
                </button>
              </div>
            </div>
            <input
              id="mov-date"
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {}
              }}
              style={{ cursor: 'pointer' }}
              required
            />
            <span className="form-hint" style={{ fontSize: '0.72rem' }}>
              Clique para abrir o calendário e selecionar
            </span>
          </div>
        </div>

        {/* SEÇÃO DE PARCELAMENTO (só na compra) */}
        {cardPurchase && (
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
                onChange={(e) => {
                  setIsInstallment(e.target.checked);
                  if (e.target.checked) setIsRecurring(false);
                }}
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
              {false && (
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
        )}

        {/* REPETIÇÃO MENSAL (contas a receber e a pagar) */}
        {canRepeat && (
          <div className="installment-box glass-card">
            <div className="installment-toggle-row">
              <div className="installment-info-header">
                <Repeat size={18} className="text-cyan" />
                <div>
                  <strong>Repetição mensal</strong>
                  <span className="text-xs text-muted block">
                    Repetir o mesmo valor todo mês, a partir da data informada
                  </span>
                </div>
              </div>

              <label className="installment-switch-label">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    setIsRecurring(e.target.checked);
                    if (e.target.checked) setIsInstallment(false);
                  }}
                />
                <span className="installment-switch-pill">{isRecurring ? 'TODO MÊS' : 'NÃO REPETE'}</span>
              </label>
            </div>

            {isRecurring && (
              <div className="installment-expanded-controls animate-fade-in mt-3">
                {/* Quantidade livre de meses (atalhos para as mais comuns) e a previsão de término e total */}
                <div className="form-group">
                  <label htmlFor="mov-repeat-months">Repetir por quantos meses?</label>
                  <div className="repeat-months-row">
                    <input
                      id="mov-repeat-months"
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={MAX_REPEAT_MONTHS}
                      className="form-input repeat-months-input"
                      value={recurringMonths || ''}
                      onChange={(e) => setRecurringMonths(Math.min(MAX_REPEAT_MONTHS, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      onBlur={() => setRecurringMonths((n) => Math.min(MAX_REPEAT_MONTHS, Math.max(2, n)))}
                    />
                    <span className="text-xs text-muted">meses</span>
                    <div className="repeat-months-chips">
                      {[6, 12, 24].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`pill-btn ${recurringMonths === n ? 'active' : ''}`}
                          onClick={() => setRecurringMonths(n)}
                        >
                          {n === 12 ? '1 ano' : n === 24 ? '2 anos' : `${n} meses`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {recurringMonths >= 2 && (() => {
                  const dates = getInstallmentDates(dueDate, recurringMonths);
                  const last = dates[dates.length - 1];
                  const lastLabel = last
                    ? new Date(`${last}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                    : '';
                  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  return (
                    <div className="repeat-forecast">
                      <div>
                        <span>Termina em</span>
                        <strong>{lastLabel}</strong>
                        <small>último em {last?.split('-').reverse().join('/')}</small>
                      </div>
                      <div>
                        <span>{type === 'RECEBER' ? 'Total recebido' : 'Total pago'} ao final</span>
                        <strong>{parsedAmount > 0 ? brl(parsedAmount * recurringMonths) : '—'}</strong>
                        <small>
                          {recurringMonths}× {parsedAmount > 0 ? brl(parsedAmount) : 'o valor informado'}
                        </small>
                      </div>
                      {status === 'REALIZADA' && (
                        <p>O primeiro mês fica como realizado; os demais, previstos.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Compra: banco (ou dinheiro) e depois como foi paga */}
        {purchase && (
          <>
            <div className="form-group">
              <label htmlFor="mov-institution">Banco ou dinheiro</label>
              <select
                id="mov-institution"
                className="form-select"
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  if (e.target.value === CASH_IN_HAND) {
                    setPayMethod('SALDO');
                    setIsInstallment(false);
                  }
                }}
              >
                <option value={CASH_IN_HAND}>💵 Dinheiro em mãos</option>
                {institutions.map((i) => (
                  <option key={i.name} value={i.name}>
                    🏦 {i.name}
                  </option>
                ))}
              </select>
            </div>

            {institution !== CASH_IN_HAND && (
              <div className="form-group">
                <label>Como foi pago?</label>
                <div className="form-type-selector" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <button
                    type="button"
                    className={`type-chip ${payMethod === 'SALDO' ? 'active-pagar' : ''}`}
                    onClick={() => {
                      setPayMethod('SALDO');
                      setIsInstallment(false);
                    }}
                  >
                    Saldo da conta (débito / Pix)
                  </button>
                  <button
                    type="button"
                    className={`type-chip ${payMethod === 'CARTAO' ? 'active-cc' : ''}`}
                    onClick={() => setPayMethod('CARTAO')}
                  >
                    💳 Cartão de crédito
                  </button>
                </div>
                {cardPurchase && (
                  <small className="form-hint">
                    Entra na fatura de {institution} com vencimento em{' '}
                    {firstInvoiceDue.split('-').reverse().join('/')}
                    {installing ? `; as demais parcelas seguem nas faturas seguintes` : ''}.
                  </small>
                )}
              </div>
            )}
          </>
        )}

        {/* Bank & Category */}
        <div className="form-row">
          {!purchase && (
          <div className="form-group flex-1">
            <label htmlFor="mov-bank">Conta / Cartão / Instituição</label>
            <select
              id="mov-bank"
              className="form-select"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              <optgroup label="Dinheiro">
                <option value={CASH_IN_HAND}>💵 Dinheiro em mãos</option>
              </optgroup>
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
          )}

          <div className="form-group flex-1">
            <label htmlFor="mov-category">Categoria</label>
            <select
              id="mov-category"
              className="form-select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                // Férias: já preenche o valor sugerido se o campo estiver vazio
                const suggestion = buildVacationSuggestion(type, e.target.value, dueDate);
                if (suggestion && !amount.trim()) {
                  setAmount(suggestion.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                }
              }}
            >
              <option value="Salário">Salário & Renda</option>
              <option value="Horas Extras">Horas Extras</option>
              <option value="Férias">Férias</option>
              <option value="13º Salário">13º Salário</option>
              <option value="Receita">Outras Receitas</option>
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

        {type === 'RECEBER' && showResponsible && (
          <div className="form-group">
            <label htmlFor="mov-responsible">Quem recebe</label>
            <select
              id="mov-responsible"
              className="form-select"
              value={responsibleId}
              onChange={(e) => setResponsibleId(e.target.value)}
            >
              <option value="">Titular da conta</option>
              {incomePeople.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {responsibleId && responsibleId !== user?.$id && (
              <small className="form-hint">
                Só {incomePeople.find((m) => m.id === responsibleId)?.name || 'essa pessoa'} poderá confirmar o recebimento; a
                receita entra como prevista.
              </small>
            )}
          </div>
        )}

        {/* Status Toggle (compra no cartão fica prevista na fatura) */}
        {!cardPurchase && (
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
        )}

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
            {repeating ? `Salvar ${recurringMonths} meses` : installing ? `Salvar ${count} Parcelas` : purchase ? (cardPurchase ? 'Lançar na Fatura' : 'Salvar Compra') : 'Salvar Movimentação'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

