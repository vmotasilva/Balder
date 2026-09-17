import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type {
  SalaryContract,
  SalaryAdjustment,
  SalaryContractType,
  SalaryAdjustmentReason,
  SalaryPaymentSchedule,
} from '../types';
import {
  TrendingUp,
  Briefcase,
  Calendar,
  Building2,
  DollarSign,
  FileText,
  Percent,
  Check,
  Landmark,
} from 'lucide-react';

export type SalaryModalMode = 'ADJUSTMENT' | 'CONTRACT';

interface SalaryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: SalaryModalMode;
  editContract?: SalaryContract | null;
  editAdjustment?: {
    contractId: string;
    adjustment: SalaryAdjustment;
  } | null;
}

const CONTRACT_TYPE_LABELS: Record<SalaryContractType, string> = {
  CLT: 'CLT (Carteira Assinada)',
  PJ: 'Pessoa Jurídica (PJ)',
  PRO_LABORE: 'Pró-Labore (Sócio/Empresa)',
  ESTAGIO: 'Estágio',
  CONCURSO: 'Concurso / Setor Público',
  AUTONOMO: 'Profissional Autônomo',
  OUTRO: 'Outro Vínculo',
};

const ADJUSTMENT_REASONS: { label: string; value: SalaryAdjustmentReason; icon: string }[] = [
  { label: 'Dissídio / Acordo Coletivo', value: 'DISSÍDIO_CONVENÇÃO', icon: '📜' },
  { label: 'Mérito / Reconhecimento', value: 'MÉRITO', icon: '⭐' },
  { label: 'Promoção de Cargo', value: 'PROMOÇÃO', icon: '🚀' },
  { label: 'Mudança de Emprego / Nova Contratação', value: 'MUDANÇA_EMPREGO', icon: '💼' },
  { label: 'Correção Inflacionária', value: 'INFLAÇÃO_CORREÇÃO', icon: '📈' },
  { label: 'Outro Motivo', value: 'OUTRO', icon: '✨' },
];

export const SalaryAdjustmentModal: React.FC<SalaryAdjustmentModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'ADJUSTMENT',
  editContract = null,
  editAdjustment = null,
}) => {
  const {
    salaryContracts,
    accounts,
    addSalaryContract,
    updateSalaryContract,
    addSalaryAdjustment,
    updateSalaryAdjustment,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<SalaryModalMode>(initialMode);

  // States for Contract
  const [employer, setEmployer] = useState('');
  const [role, setRole] = useState('');
  const [contractType, setContractType] = useState<SalaryContractType>('CLT');
  const [paymentSchedule, setPaymentSchedule] = useState<SalaryPaymentSchedule>('QUINZENAL');
  const [installmentValueMode, setInstallmentValueMode] = useState<'FIXED' | 'AUTO'>('AUTO');
  const [paymentDay, setPaymentDay] = useState(1);
  const [firstInstallmentDay, setFirstInstallmentDay] = useState(15);
  const [secondInstallmentDay, setSecondInstallmentDay] = useState(1);
  const [isSecondInstallmentLastDay, setIsSecondInstallmentLastDay] = useState(false);
  const [isPaymentDayLastDay, setIsPaymentDayLastDay] = useState(false);
  const [quinzenaSplitMode, setQuinzenaSplitMode] = useState<'40_60' | '50_50' | 'CUSTOM'>('40_60');
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState('');
  const [secondInstallmentAmount, setSecondInstallmentAmount] = useState('');
  const [weeklyInstallmentAmount, setWeeklyInstallmentAmount] = useState('');
  const [weeklyPaymentDayOfWeek, setWeeklyPaymentDayOfWeek] = useState(5); // 5 = Sexta-feira
  const [contractGross, setContractGross] = useState('');
  const [contractNet, setContractNet] = useState('');
  const [receivingBankId, setReceivingBankId] = useState('');
  const [receivingBankName, setReceivingBankName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isActive, setIsActive] = useState(true);

  // States for Adjustment
  const [selectedContractId, setSelectedContractId] = useState('');
  const [adjTitle, setAdjTitle] = useState('');
  const [adjReason, setAdjReason] = useState<SalaryAdjustmentReason>('DISSÍDIO_CONVENÇÃO');
  const [adjEffectiveDate, setAdjEffectiveDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [adjGross, setAdjGross] = useState('');
  const [adjNet, setAdjNet] = useState('');
  const [adjPercentage, setAdjPercentage] = useState<number | null>(null);
  const [adjNotes, setAdjNotes] = useState('');

  // Helper para recalcular valores da quinzena com base no valor líquido
  const updateQuinzenaAmounts = (netVal: number, mode: '40_60' | '50_50' | 'CUSTOM') => {
    if (netVal > 0) {
      if (mode === '40_60') {
        const first = Math.round(netVal * 0.40 * 100) / 100;
        const second = Math.round((netVal - first) * 100) / 100;
        setFirstInstallmentAmount(first.toFixed(2));
        setSecondInstallmentAmount(second.toFixed(2));
      } else if (mode === '50_50') {
        const first = Math.round(netVal * 0.50 * 100) / 100;
        const second = Math.round((netVal - first) * 100) / 100;
        setFirstInstallmentAmount(first.toFixed(2));
        setSecondInstallmentAmount(second.toFixed(2));
      }
    }
  };

  const handleContractNetChange = (val: string) => {
    setContractNet(val);
    const num = parseFloat(val.replace(',', '.'));
    if (num > 0) {
      if (quinzenaSplitMode === '40_60') {
        const first = Math.round(num * 0.40 * 100) / 100;
        const second = Math.round((num - first) * 100) / 100;
        setFirstInstallmentAmount(first.toFixed(2));
        setSecondInstallmentAmount(second.toFixed(2));
      } else if (quinzenaSplitMode === '50_50') {
        const first = Math.round(num * 0.50 * 100) / 100;
        const second = Math.round((num - first) * 100) / 100;
        setFirstInstallmentAmount(first.toFixed(2));
        setSecondInstallmentAmount(second.toFixed(2));
      } else if (quinzenaSplitMode === 'CUSTOM' && firstInstallmentAmount) {
        const f = parseFloat(firstInstallmentAmount.replace(',', '.')) || 0;
        setSecondInstallmentAmount(Math.max(0, num - f).toFixed(2));
      }
    }
  };

  // Synchronize initial data on open or changes
  useEffect(() => {
    if (isOpen) {
      if (editAdjustment) {
        setActiveTab('ADJUSTMENT');
        setSelectedContractId(editAdjustment.contractId);
        setAdjTitle(editAdjustment.adjustment.title || '');
        setAdjReason(editAdjustment.adjustment.reason);
        setAdjEffectiveDate(editAdjustment.adjustment.effectiveDate);
        setAdjGross(editAdjustment.adjustment.grossAmount ? editAdjustment.adjustment.grossAmount.toString() : '');
        setAdjNet(editAdjustment.adjustment.netAmount ? editAdjustment.adjustment.netAmount.toString() : '');
        setAdjPercentage(editAdjustment.adjustment.percentageIncrease ?? null);
        setAdjNotes(editAdjustment.adjustment.notes || '');
      } else if (editContract) {
        setActiveTab('CONTRACT');
        setEmployer(editContract.employer);
        setRole(editContract.role);
        setContractType(editContract.contractType);
        const sched = editContract.paymentSchedule || (editContract.secondPaymentDay ? 'QUINZENAL' : 'UNICO');
        setPaymentSchedule(sched);
        const pDay = editContract.paymentDay || 1;
        const isLastDay = pDay === 31;
        setPaymentDay(pDay);
        setSecondInstallmentDay(pDay);
        setIsSecondInstallmentLastDay(isLastDay);
        setIsPaymentDayLastDay(isLastDay);
        setFirstInstallmentDay(editContract.secondPaymentDay || 15);

        const net = editContract.currentNetAmount || 0;
        setContractGross(editContract.currentGrossAmount ? editContract.currentGrossAmount.toString() : '');
        setContractNet(net ? net.toString() : '');

        if (editContract.firstInstallmentAmount) {
          setFirstInstallmentAmount(editContract.firstInstallmentAmount.toString());
        } else if (net > 0) {
          setFirstInstallmentAmount((net * 0.4).toFixed(2));
        }
        if (editContract.secondInstallmentAmount) {
          setSecondInstallmentAmount(editContract.secondInstallmentAmount.toString());
        } else if (net > 0) {
          setSecondInstallmentAmount((net * 0.6).toFixed(2));
        }

        setReceivingBankId(editContract.receivingBankAccountId || '');
        setReceivingBankName(editContract.receivingBankName || '');
        setStartDate(editContract.startDate);
        setIsActive(editContract.isActive);
      } else {
        setActiveTab(initialMode);
        // Default contract selection
        const defaultContract = salaryContracts.find((c) => c.isActive) || salaryContracts[0];
        if (defaultContract) {
          setSelectedContractId(defaultContract.id);
        }
        // Reset adjustment form
        setAdjTitle('');
        setAdjReason('DISSÍDIO_CONVENÇÃO');
        setAdjEffectiveDate(new Date().toISOString().slice(0, 7));
        setAdjGross('');
        setAdjNet('');
        setAdjPercentage(null);
        setAdjNotes('');

        // Reset contract form
        setEmployer('');
        setRole('');
        setContractType('CLT');
        setPaymentSchedule('QUINZENAL');
        setPaymentDay(1);
        setFirstInstallmentDay(15);
        setSecondInstallmentDay(1);
        setIsSecondInstallmentLastDay(false);
        setIsPaymentDayLastDay(false);
        setQuinzenaSplitMode('40_60');
        setFirstInstallmentAmount('');
        setSecondInstallmentAmount('');
        setContractGross('');
        setContractNet('');
        setReceivingBankId('');
        setReceivingBankName('');
        setStartDate(new Date().toISOString().slice(0, 7));
        setIsActive(true);
      }
    }
  }, [isOpen, editContract, editAdjustment, initialMode, salaryContracts]);

  // Real-time calculation of percentage gain when user types new net salary
  useEffect(() => {
    if (activeTab === 'ADJUSTMENT') {
      const netVal = parseFloat(adjNet.replace(',', '.'));
      if (!netVal || isNaN(netVal)) {
        setAdjPercentage(null);
        return;
      }
      const targetContract = salaryContracts.find((c) => c.id === selectedContractId);
      if (targetContract) {
        // Base salary is current contract net or latest adjustment
        const baseNet = targetContract.currentNetAmount || 0;
        if (baseNet > 0 && Math.abs(netVal - baseNet) > 0.01) {
          const pct = ((netVal - baseNet) / baseNet) * 100;
          setAdjPercentage(Number(pct.toFixed(2)));
        } else {
          setAdjPercentage(null);
        }
      }
    }
  }, [adjNet, selectedContractId, activeTab, salaryContracts]);

  // Handle bank selection
  const handleBankSelect = (accId: string) => {
    setReceivingBankId(accId);
    const acc = accounts.find((a) => a.id === accId);
    if (acc) {
      setReceivingBankName(acc.bankName || acc.name);
    }
  };

  const handleSubmitContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employer.trim()) {
      alert('Informe o nome da empresa ou fonte pagadora.');
      return;
    }
    if (!role.trim()) {
      alert('Informe o cargo ou função.');
      return;
    }

    const gross = parseFloat(contractGross.replace(',', '.')) || 0;
    const net = parseFloat(contractNet.replace(',', '.')) || 0;
    if (net <= 0) {
      alert('Informe o salário líquido atual (maior que zero).');
      return;
    }

    const isQuinzenal = paymentSchedule === 'QUINZENAL';
    const isSemanal   = paymentSchedule === 'SEMANAL';
    const isFixed     = installmentValueMode === 'FIXED';

    const autoPct = quinzenaSplitMode === '50_50' ? 50 : 40;
    const calcFirst = Math.round(net * (autoPct / 100) * 100) / 100;
    const calcSecond = Math.round((net - calcFirst) * 100) / 100;

    const firstAmt = isQuinzenal
      ? isFixed
        ? parseFloat(firstInstallmentAmount.replace(',', '.')) || calcFirst
        : calcFirst
      : undefined;
    const secondAmt = isQuinzenal
      ? isFixed
        ? parseFloat(secondInstallmentAmount.replace(',', '.')) || calcSecond
        : calcSecond
      : undefined;
    const pct = isQuinzenal && firstAmt && net > 0
      ? Math.round((firstAmt / net) * 100)
      : isQuinzenal
      ? autoPct
      : undefined;
    const weeklyAmt = isFixed && isSemanal
      ? parseFloat(weeklyInstallmentAmount.replace(',', '.')) || Math.round((net * 12 / 52) * 100) / 100
      : undefined;

    const payload = {
      employer: employer.trim(),
      role: role.trim(),
      contractType,
      paymentSchedule,
      installmentValueMode,
      paymentDay: isQuinzenal
        ? (isSecondInstallmentLastDay ? 31 : Math.max(1, Math.min(31, secondInstallmentDay)))
        : (isPaymentDayLastDay ? 31 : Math.max(1, Math.min(31, paymentDay))),
      secondPaymentDay: isQuinzenal ? Math.max(1, Math.min(31, firstInstallmentDay)) : undefined,
      weeklyPaymentDayOfWeek: isSemanal ? weeklyPaymentDayOfWeek : undefined,
      firstInstallmentPercent: pct,
      firstInstallmentAmount: firstAmt,
      secondInstallmentAmount: secondAmt,
      weeklyInstallmentAmount: weeklyAmt,
      currentGrossAmount: gross > 0 ? gross : net * 1.3,
      currentNetAmount: net,
      receivingBankAccountId: receivingBankId || undefined,
      receivingBankName: receivingBankName || undefined,
      startDate,
      isActive,
    };

    if (editContract) {
      updateSalaryContract(editContract.id, payload);
    } else {
      addSalaryContract(payload);
    }
    onClose();
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) {
      alert('Selecione um contrato de trabalho para aplicar o reajuste.');
      return;
    }

    const net = parseFloat(adjNet.replace(',', '.'));
    if (!net || isNaN(net) || net <= 0) {
      alert('Informe o novo salário líquido após o reajuste.');
      return;
    }

    const gross = parseFloat(adjGross.replace(',', '.')) || net * 1.3;
    const targetContract = salaryContracts.find((c) => c.id === selectedContractId);
    const isQuinzenal = targetContract?.paymentSchedule === 'QUINZENAL' || !!targetContract?.secondPaymentDay;
    const splitPct = targetContract?.firstInstallmentPercent || 40;
    const firstAmt = isQuinzenal ? Math.round(net * (splitPct / 100) * 100) / 100 : undefined;
    const secondAmt = isQuinzenal ? Math.round((net - (firstAmt || 0)) * 100) / 100 : undefined;

    if (editAdjustment) {
      updateSalaryAdjustment(editAdjustment.contractId, editAdjustment.adjustment.id, {
        title: adjTitle.trim() || undefined,
        reason: adjReason,
        effectiveDate: adjEffectiveDate,
        grossAmount: gross,
        netAmount: net,
        percentageIncrease: adjPercentage ?? undefined,
        firstInstallmentAmount: firstAmt,
        secondInstallmentAmount: secondAmt,
        notes: adjNotes.trim() || undefined,
      });
    } else {
      addSalaryAdjustment(selectedContractId, {
        title: adjTitle.trim() || undefined,
        reason: adjReason,
        effectiveDate: adjEffectiveDate,
        grossAmount: gross,
        netAmount: net,
        firstInstallmentAmount: firstAmt,
        secondInstallmentAmount: secondAmt,
        notes: adjNotes.trim() || undefined,
      });
    }
    onClose();
  };

  const modalTitle = () => {
    if (activeTab === 'CONTRACT') {
      return editContract ? 'Editar Contrato de Trabalho' : 'Novo Contrato / Emprego';
    }
    return editAdjustment ? 'Editar Reajuste Salarial' : 'Registrar Reajuste Salarial';
  };

  const modalSubtitle = () => {
    if (activeTab === 'CONTRACT') {
      return 'Cadastre seus vínculos empregatícios (CLT, PJ, etc.) e dados de remuneração';
    }
    return 'Registre aumentos, dissídios e promoções com data de vigência para atualização de projeções';
  };

  const selectedContractForAdj = salaryContracts.find((c) => c.id === selectedContractId);
  const isSelectedContractQuinzenal =
    selectedContractForAdj?.paymentSchedule === 'QUINZENAL' || !!selectedContractForAdj?.secondPaymentDay;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle()}
      subtitle={modalSubtitle()}
      maxWidth="640px"
    >
      {/* Selector Tabs (oculto quando editando item específico) */}
      {!editContract && !editAdjustment && (
        <div className="entity-modal-tabs" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'ADJUSTMENT' ? 'active' : ''}`}
            onClick={() => setActiveTab('ADJUSTMENT')}
          >
            <TrendingUp size={15} />
            <span>Novo Reajuste</span>
          </button>
          <button
            type="button"
            className={`entity-modal-tab ${activeTab === 'CONTRACT' ? 'active' : ''}`}
            onClick={() => setActiveTab('CONTRACT')}
          >
            <Briefcase size={15} />
            <span>Novo Contrato</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: REGISTRAR REAJUSTE SALARIAL                                       */}
      {/* ========================================================================= */}
      {activeTab === 'ADJUSTMENT' && (
        <form onSubmit={handleSubmitAdjustment} className="entity-form animate-fade-in">
          {/* Seletor de Contrato de Trabalho */}
          <div className="form-group">
            <label className="form-label">
              <Briefcase size={14} className="inline-icon" />
              Contrato / Empregador Alvo *
            </label>
            {salaryContracts.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                Nenhum contrato de trabalho ativo cadastrado. Crie um contrato primeiro na aba "Novo Contrato".
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                required
                disabled={!!editAdjustment}
              >
                {salaryContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.employer} — {c.role} ({CONTRACT_TYPE_LABELS[c.contractType]}) | Atual: R${' '}
                    {c.currentNetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-row">
            {/* Título do Reajuste */}
            <div className="form-group flex-1">
              <label className="form-label">
                <FileText size={14} className="inline-icon" />
                Título / Descritivo
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Acordo Coletivo 2026, Promoção Tech Lead"
                value={adjTitle}
                onChange={(e) => setAdjTitle(e.target.value)}
              />
            </div>

            {/* Motivo do Reajuste */}
            <div className="form-group flex-1">
              <label className="form-label">Motivo do Reajuste *</label>
              <select
                className="form-select"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value as SalaryAdjustmentReason)}
                required
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.icon} {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mês de Início de Vigência */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} className="inline-icon" />
              Mês de Início da Vigência (Competência) *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="month"
                className="form-input"
                value={adjEffectiveDate}
                onChange={(e) => setAdjEffectiveDate(e.target.value)}
                required
                style={{ maxWidth: '200px' }}
              />
              <span className="text-xs text-muted">
                A partir desta competência, as projeções considerarão o novo valor.
              </span>
            </div>
          </div>

          {/* Valores: Bruto e Líquido */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <DollarSign size={14} className="inline-icon" />
                Novo Salário Líquido (R$) *
              </label>
              <input
                type="text"
                className="form-input text-glow-cyan"
                placeholder="Ex: 3500,00"
                value={adjNet}
                onChange={(e) => setAdjNet(e.target.value)}
                required
                style={{ fontSize: '1.1rem', fontWeight: 600 }}
              />
              <span className="form-hint">Total líquido mensal a ser creditado.</span>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Novo Salário Bruto (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 4200,00"
                value={adjGross}
                onChange={(e) => setAdjGross(e.target.value)}
              />
              <span className="form-hint">Opcional.</span>
            </div>
          </div>

          {/* Se o contrato for quinzenal, exibir a projeção das 2 quinzenas */}
          {isSelectedContractQuinzenal && adjNet && parseFloat(adjNet.replace(',', '.')) > 0 && (
            <div
              className="glass-card"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                background: 'rgba(6, 182, 212, 0.05)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.35rem' }}>
                🌓 Distribuição Automática por Quinzena
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>
                  1ª Quinzena (Dia {selectedContractForAdj?.secondPaymentDay || 15}):{' '}
                  <strong className="text-glow-cyan">
                    R${' '}
                    {(
                      parseFloat(adjNet.replace(',', '.')) *
                      ((selectedContractForAdj?.firstInstallmentPercent || 40) / 100)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span>
                  2ª Quinzena ({selectedContractForAdj?.paymentDay === 31 ? 'Último dia do mês' : `Dia ${selectedContractForAdj?.paymentDay || 1}`}):{' '}
                  <strong className="text-glow-cyan">
                    R${' '}
                    {(
                      parseFloat(adjNet.replace(',', '.')) *
                      ((100 - (selectedContractForAdj?.firstInstallmentPercent || 40)) / 100)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Card de Percentual de Aumento Dinâmico */}
          {adjPercentage !== null && (
            <div
              className="glass-card"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: adjPercentage > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${adjPercentage > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Percent size={18} color={adjPercentage > 0 ? '#10B981' : '#EF4444'} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {adjPercentage > 0 ? 'Reajuste Positivo Calculado' : 'Ajuste Salarial'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Em relação ao salário anterior do contrato
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: adjPercentage > 0 ? '#10B981' : '#EF4444',
                }}
              >
                {adjPercentage > 0 ? `+${adjPercentage}%` : `${adjPercentage}%`}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="form-group">
            <label className="form-label">Observações Adicionais</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Ex: Acordo coletivo, promoção de cargo, benefícios adicionais."
              value={adjNotes}
              onChange={(e) => setAdjNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={salaryContracts.length === 0}
            >
              <Check size={16} />
              {editAdjustment ? 'Salvar Alterações' : 'Confirmar Reajuste'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: NOVO CONTRATO DE TRABALHO OU EDITAR CONTRATO                      */}
      {/* ========================================================================= */}
      {activeTab === 'CONTRACT' && (
        <form onSubmit={handleSubmitContract} className="entity-form animate-fade-in">
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <Building2 size={14} className="inline-icon" />
                Empresa / Fonte Pagadora *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Tecnolens Laboratório Ótico Ltda"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                required
              />
            </div>

            <div className="form-group flex-1">
              <label className="form-label">
                <Briefcase size={14} className="inline-icon" />
                Cargo / Função *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Coordenador de Qualidade"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Regime de Contratação *</label>
              <select
                className="form-select"
                value={contractType}
                onChange={(e) => setContractType(e.target.value as SalaryContractType)}
                required
              >
                {Object.entries(CONTRACT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">
                <Calendar size={14} className="inline-icon" />
                Data de Início / Admissão
              </label>
              <input
                type="month"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Salários: Líquido e Bruto */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <DollarSign size={14} className="inline-icon" />
                Salário Líquido Total Vigente (R$) *
              </label>
              <input
                type="text"
                className="form-input text-glow-cyan"
                placeholder="Ex: 3200,00"
                value={contractNet}
                onChange={(e) => handleContractNetChange(e.target.value)}
                required
                style={{ fontSize: '1.1rem', fontWeight: 600 }}
              />
              <span className="form-hint">Total líquido mensal creditado.</span>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Salário Bruto Vigente (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 3766,98"
                value={contractGross}
                onChange={(e) => setContractGross(e.target.value)}
              />
              <span className="form-hint">Opcional.</span>
            </div>
          </div>

          {/* Formato de Recebimento: Parcela Única vs Em 2 Quinzenas */}
          <div className="form-group" style={{ marginTop: '0.25rem', marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Formato de Recebimento Salarial</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>NOVO</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${paymentSchedule === 'QUINZENAL' ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'center', padding: '0.6rem' }}
                onClick={() => {
                  setPaymentSchedule('QUINZENAL');
                  const netVal = parseFloat(contractNet.replace(',', '.')) || 0;
                  updateQuinzenaAmounts(netVal, quinzenaSplitMode);
                }}
              >
                🌓 Em 2 Quinzenas (Adiantamento + Saldo)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${paymentSchedule === 'UNICO' ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'center', padding: '0.6rem' }}
                onClick={() => setPaymentSchedule('UNICO')}
              >
                📅 Parcela Única (Integral)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${paymentSchedule === 'SEMANAL' ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'center', padding: '0.6rem' }}
                onClick={() => setPaymentSchedule('SEMANAL')}
              >
                📆 Semanal (por semana)
              </button>
            </div>

            {/* Toggle Fixo / Automático — aparece apenas para QUINZENAL e SEMANAL */}
            {paymentSchedule !== 'UNICO' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>
                  💡 Como definir os valores por período?
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setInstallmentValueMode('AUTO')}
                    className={`btn btn-sm ${installmentValueMode === 'AUTO' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                    title="O sistema calcula o valor por período automaticamente com base no salário líquido"
                  >
                    ⚡ Automático
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallmentValueMode('FIXED')}
                    className={`btn btn-sm ${installmentValueMode === 'FIXED' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                    title="Fixar manualmente o valor exato de cada parcela / semana"
                  >
                    📌 Valor Fixo
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                  {installmentValueMode === 'AUTO'
                    ? 'Calculado dinamicamente ao reajustar o salário'
                    : 'Valor por período travado; atualize manualmente ao reajustar'}
                </span>
              </div>
            )}

            {paymentSchedule === 'QUINZENAL' && (() => {
              const currentNetVal = parseFloat(contractNet.replace(',', '.')) || 0;
              const autoPct = quinzenaSplitMode === '50_50' ? 50 : 40;
              const refFirst = installmentValueMode === 'FIXED' && firstInstallmentAmount
                ? parseFloat(firstInstallmentAmount.replace(',', '.')) || 0
                : Math.round(currentNetVal * (autoPct / 100) * 100) / 100;
              const refSecond = installmentValueMode === 'FIXED' && secondInstallmentAmount
                ? parseFloat(secondInstallmentAmount.replace(',', '.')) || 0
                : Math.round((currentNetVal - refFirst) * 100) / 100;

              return (
                <div
                  className="glass-card"
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    background: 'rgba(6, 182, 212, 0.04)',
                    marginBottom: '1rem',
                  }}
                >
                  {/* Seletor de Divisão / Proporção de Referência */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Divisão de Referência:
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                        (base para os cálculos da quinzena)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${quinzenaSplitMode === '40_60' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                          setQuinzenaSplitMode('40_60');
                          const netVal = parseFloat(contractNet.replace(',', '.')) || 0;
                          updateQuinzenaAmounts(netVal, '40_60');
                        }}
                        title="Proporção comum da CLT onde o adiantamento é 40% e o saldo de 60% recebe os descontos da folha"
                      >
                        40% / 60% (Padrão CLT)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${quinzenaSplitMode === '50_50' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                          setQuinzenaSplitMode('50_50');
                          const netVal = parseFloat(contractNet.replace(',', '.')) || 0;
                          updateQuinzenaAmounts(netVal, '50_50');
                        }}
                        title="Divisão de 50% em cada quinzena"
                      >
                        50% / 50% (Iguais)
                      </button>
                      {installmentValueMode === 'FIXED' && (
                        <button
                          type="button"
                          className={`btn btn-xs ${quinzenaSplitMode === 'CUSTOM' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setQuinzenaSplitMode('CUSTOM')}
                        >
                          Personalizado
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quadro Visual dos Valores de Referência */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.75rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    {/* Card 1ª Quinzena: Adiantamento */}
                    <div
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🗓️ 1ª Quinzena
                          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)' }}>
                            Adiantamento
                          </span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Dia {firstInstallmentDay}
                        </span>
                      </div>
                      <div style={{ margin: '0.35rem 0' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                          Valor de Referência:
                        </span>
                        <strong className="text-glow-cyan" style={{ fontSize: '1.05rem' }}>
                          {currentNetVal > 0
                            ? refFirst.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'Informe o salário líquido acima'}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                        Adiantamento salarial (sem incidência dos principais descontos).
                      </span>
                    </div>

                    {/* Card 2ª Quinzena: Saldo do Mês */}
                    <div
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🗓️ 2ª Quinzena
                          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                            Saldo c/ Descontos
                          </span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isSecondInstallmentLastDay || secondInstallmentDay === 31 ? 'Último dia do mês' : `Dia ${secondInstallmentDay}`}
                        </span>
                      </div>
                      <div style={{ margin: '0.35rem 0' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                          Valor de Referência:
                        </span>
                        <strong className="text-glow-cyan" style={{ fontSize: '1.05rem', color: '#34d399' }}>
                          {currentNetVal > 0
                            ? refSecond.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'Informe o salário líquido acima'}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                        Saldo da competência sujeito a variações e descontos (INSS, IRRF, benefícios).
                      </span>
                    </div>
                  </div>

                  {/* Informação sobre os descontos e total líquido */}
                  <div
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Total Líquido Base:</span>
                      <strong style={{ color: '#fff' }}>
                        {currentNetVal > 0
                          ? currentNetVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : 'R$ 0,00'}
                      </strong>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                      💡 A 2ª quinzena geralmente varia conforme os descontos aplicados pelo empregador.
                    </span>
                  </div>

                  {/* Configuração dos Dias e Valores */}
                  {installmentValueMode === 'FIXED' ? (
                    <div className="form-row">
                      {/* 1ª Quinzena */}
                      <div className="form-group flex-1">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          🗓️ 1ª Quinzena (Adiantamento)
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ width: '80px' }}>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              className="form-input text-center"
                              placeholder="Dia"
                              value={firstInstallmentDay}
                              onChange={(e) => setFirstInstallmentDay(parseInt(e.target.value) || 15)}
                              title="Dia do mês da 1ª quinzena"
                              required
                            />
                            <span className="form-hint">Dia do mês</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              className="form-input text-glow-cyan font-semibold"
                              placeholder="Valor R$"
                              value={firstInstallmentAmount}
                              readOnly={quinzenaSplitMode !== 'CUSTOM'}
                              onChange={(e) => {
                                setFirstInstallmentAmount(e.target.value);
                                const netVal = parseFloat(contractNet.replace(',', '.')) || 0;
                                const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                                if (netVal > 0) {
                                  setSecondInstallmentAmount(Math.max(0, netVal - val).toFixed(2));
                                }
                              }}
                              required
                            />
                            <span className="form-hint">Valor da 1ª quinzena</span>
                          </div>
                        </div>
                      </div>

                      {/* 2ª Quinzena */}
                      <div className="form-group flex-1">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                            🗓️ 2ª Quinzena (Saldo do Mês)
                          </label>
                          <label
                            style={{
                              fontSize: '0.73rem',
                              color: isSecondInstallmentLastDay ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: isSecondInstallmentLastDay ? 600 : 400,
                            }}
                            title="Marca automaticamente para direcionar ao último dia de cada mês (28, 29, 30 ou 31)"
                          >
                            <input
                              type="checkbox"
                              checked={isSecondInstallmentLastDay}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsSecondInstallmentLastDay(checked);
                                if (checked) {
                                  setSecondInstallmentDay(31);
                                } else {
                                  setSecondInstallmentDay(1);
                                }
                              }}
                              style={{ accentColor: 'var(--color-primary)', width: '13px', height: '13px', cursor: 'pointer' }}
                            />
                            Último dia do mês
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ width: '85px' }}>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              className="form-input text-center"
                              placeholder="Dia"
                              value={isSecondInstallmentLastDay ? 31 : secondInstallmentDay}
                              disabled={isSecondInstallmentLastDay}
                              onChange={(e) => setSecondInstallmentDay(parseInt(e.target.value) || 1)}
                              title={isSecondInstallmentLastDay ? 'Direcionado para o último dia de cada mês' : 'Dia do mês da 2ª quinzena'}
                              required
                            />
                            <span className="form-hint">{isSecondInstallmentLastDay ? 'Último dia' : 'Dia do mês'}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              className="form-input text-glow-cyan font-semibold"
                              placeholder="Valor R$"
                              value={secondInstallmentAmount}
                              readOnly={quinzenaSplitMode !== 'CUSTOM'}
                              onChange={(e) => {
                                setSecondInstallmentAmount(e.target.value);
                                const netVal = parseFloat(contractNet.replace(',', '.')) || 0;
                                const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                                if (netVal > 0) {
                                  setFirstInstallmentAmount(Math.max(0, netVal - val).toFixed(2));
                                }
                              }}
                              required
                            />
                            <span className="form-hint">Valor da 2ª quinzena</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Dia da 1ª Quinzena (Adiantamento)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="form-input text-center"
                          value={firstInstallmentDay}
                          onChange={(e) => setFirstInstallmentDay(parseInt(e.target.value) || 15)}
                        />
                        <span className="form-hint">Normalmente entre os dias 15 e 20</span>
                      </div>
                      <div className="form-group flex-1">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                            Dia da 2ª Quinzena (Saldo do Mês)
                          </label>
                          <label
                            style={{
                              fontSize: '0.73rem',
                              color: isSecondInstallmentLastDay ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: isSecondInstallmentLastDay ? 600 : 400,
                            }}
                            title="Marca automaticamente para direcionar ao último dia de cada mês (28, 29, 30 ou 31)"
                          >
                            <input
                              type="checkbox"
                              checked={isSecondInstallmentLastDay}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsSecondInstallmentLastDay(checked);
                                if (checked) {
                                  setSecondInstallmentDay(31);
                                } else {
                                  setSecondInstallmentDay(1);
                                }
                              }}
                              style={{ accentColor: 'var(--color-primary)', width: '13px', height: '13px', cursor: 'pointer' }}
                            />
                            Último dia do mês
                          </label>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="form-input text-center"
                          value={isSecondInstallmentLastDay ? 31 : secondInstallmentDay}
                          disabled={isSecondInstallmentLastDay}
                          onChange={(e) => setSecondInstallmentDay(parseInt(e.target.value) || 1)}
                        />
                        <span className="form-hint">
                          {isSecondInstallmentLastDay
                            ? 'Direcionado automaticamente ao último dia do mês (28, 29, 30 ou 31)'
                            : 'Normalmente entre os dias 1 e 5 ou fim do mês'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {paymentSchedule === 'SEMANAL' && (
              <div
                className="glass-card"
                style={{ padding: '1rem', borderRadius: '10px', marginBottom: '0.75rem',
                  background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)' }}
              >
                {installmentValueMode === 'AUTO' ? (
                  <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.07)',
                    borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    ⚡ <strong>Modo Automático:</strong> o valor semanal será calculado como <em>líquido × 12 ÷ 52</em>,
                    ajustando o total conforme o número de ocorrências do dia da semana em cada mês.
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Valor Líquido por Semana (R$) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      placeholder={contractNet
                        ? (Math.round((parseFloat(contractNet.replace(',', '.')) || 0) * 12 / 52 * 100) / 100).toFixed(2)
                        : '0,00'}
                      value={weeklyInstallmentAmount}
                      onChange={(e) => setWeeklyInstallmentAmount(e.target.value)}
                    />
                    <span className="form-hint">
                      Valor fixo a receber por semana. Meses com 5 ocorrências recebem 5× esse valor.
                    </span>
                  </div>
                )}

                {/* Dia da semana — sempre visível */}
                <div className="form-group">
                  <label className="form-label">Dia da Semana do Pagamento</label>
                  <select
                    className="form-select"
                    value={weeklyPaymentDayOfWeek}
                    onChange={(e) => setWeeklyPaymentDayOfWeek(parseInt(e.target.value))}
                  >
                    <option value={0}>Domingo</option>
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                  <span className="form-hint">Dia fixo do recebimento semanal.</span>
                </div>

                {/* Preview de projeção — sempre visível */}
                {contractNet && (() => {
                  const base = installmentValueMode === 'FIXED' && weeklyInstallmentAmount
                    ? parseFloat(weeklyInstallmentAmount.replace(',', '.')) || 0
                    : Math.round((parseFloat(contractNet.replace(',', '.')) || 0) * 12 / 52 * 100) / 100;
                  return base > 0 ? (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.82rem',
                      color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
                      borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                      📊 Projetado: mês com 4 semanas =&nbsp;
                      <span className="text-glow-cyan font-bold">
                        R$ {(Math.round(base * 4 * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      &nbsp;· mês com 5 semanas =&nbsp;
                      <span className="text-glow-cyan font-bold">
                        R$ {(Math.round(base * 5 * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}


            {paymentSchedule === 'UNICO' && (
              <div className="form-group" style={{ maxWidth: '280px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Dia do Pagamento Principal *</label>
                  <label
                    style={{
                      fontSize: '0.73rem',
                      color: isPaymentDayLastDay ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: isPaymentDayLastDay ? 600 : 400,
                    }}
                    title="Marca automaticamente para receber no último dia do mês"
                  >
                    <input
                      type="checkbox"
                      checked={isPaymentDayLastDay}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsPaymentDayLastDay(checked);
                        if (checked) {
                          setPaymentDay(31);
                        } else {
                          setPaymentDay(5);
                        }
                      }}
                      style={{ accentColor: 'var(--color-primary)', width: '13px', height: '13px', cursor: 'pointer' }}
                    />
                    Último dia do mês
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="form-input text-center"
                  value={isPaymentDayLastDay ? 31 : paymentDay}
                  disabled={isPaymentDayLastDay}
                  onChange={(e) => setPaymentDay(parseInt(e.target.value) || 5)}
                  required
                />
                <span className="form-hint">
                  {isPaymentDayLastDay
                    ? 'Ajustado ao último dia do mês (28, 29, 30 ou 31).'
                    : 'Ex: dia 5 ou dia útil de recebimento.'}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              <Landmark size={14} className="inline-icon" />
              Conta / Banco de Recebimento
            </label>
            <select
              className="form-select"
              value={receivingBankId}
              onChange={(e) => handleBankSelect(e.target.value)}
            >
              <option value="">Selecione uma conta cadastrada ou defina manual...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon} {acc.name} {acc.bankName ? `(${acc.bankName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Ativo */}
          <div
            className="form-group"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.5rem',
              padding: '0.5rem 0',
            }}
          >
            <input
              type="checkbox"
              id="chk-contract-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="chk-contract-active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              Contrato ativo atualmente (gera projeção mensal regular)
            </label>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              {editContract ? 'Salvar Contrato' : 'Cadastrar Contrato'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
