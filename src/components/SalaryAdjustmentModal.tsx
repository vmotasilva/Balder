import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type {
  SalaryContract,
  SalaryAdjustment,
  SalaryContractType,
  SalaryAdjustmentReason,
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
  const [paymentDay, setPaymentDay] = useState(5);
  const [secondPaymentDay, setSecondPaymentDay] = useState<number | ''>('');
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
        setPaymentDay(editContract.paymentDay);
        setSecondPaymentDay(editContract.secondPaymentDay ?? '');
        setContractGross(editContract.currentGrossAmount ? editContract.currentGrossAmount.toString() : '');
        setContractNet(editContract.currentNetAmount ? editContract.currentNetAmount.toString() : '');
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
        setPaymentDay(5);
        setSecondPaymentDay('');
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

    if (editContract) {
      updateSalaryContract(editContract.id, {
        employer: employer.trim(),
        role: role.trim(),
        contractType,
        paymentDay: Math.max(1, Math.min(31, paymentDay)),
        secondPaymentDay: secondPaymentDay !== '' ? Math.max(1, Math.min(31, Number(secondPaymentDay))) : undefined,
        currentGrossAmount: gross > 0 ? gross : net * 1.3,
        currentNetAmount: net,
        receivingBankAccountId: receivingBankId || undefined,
        receivingBankName: receivingBankName || undefined,
        startDate,
        isActive,
      });
    } else {
      addSalaryContract({
        employer: employer.trim(),
        role: role.trim(),
        contractType,
        paymentDay: Math.max(1, Math.min(31, paymentDay)),
        secondPaymentDay: secondPaymentDay !== '' ? Math.max(1, Math.min(31, Number(secondPaymentDay))) : undefined,
        currentGrossAmount: gross > 0 ? gross : net * 1.3,
        currentNetAmount: net,
        receivingBankAccountId: receivingBankId || undefined,
        receivingBankName: receivingBankName || undefined,
        startDate,
        isActive,
      });
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

    if (editAdjustment) {
      updateSalaryAdjustment(editAdjustment.contractId, editAdjustment.adjustment.id, {
        title: adjTitle.trim() || undefined,
        reason: adjReason,
        effectiveDate: adjEffectiveDate,
        grossAmount: gross,
        netAmount: net,
        percentageIncrease: adjPercentage ?? undefined,
        notes: adjNotes.trim() || undefined,
      });
    } else {
      addSalaryAdjustment(selectedContractId, {
        title: adjTitle.trim() || undefined,
        reason: adjReason,
        effectiveDate: adjEffectiveDate,
        grossAmount: gross,
        netAmount: net,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle()}
      subtitle={modalSubtitle()}
      maxWidth="620px"
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
                A partir desta competência (inclusive), as projeções futuras de receitas e saldos considerarão o novo valor.
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
                placeholder="Ex: 10500,00"
                value={adjNet}
                onChange={(e) => setAdjNet(e.target.value)}
                required
                style={{ fontSize: '1.1rem', fontWeight: 600 }}
              />
              <span className="form-hint">Valor efetivamente creditado em conta corrente.</span>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Novo Salário Bruto (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 13800,00"
                value={adjGross}
                onChange={(e) => setAdjGross(e.target.value)}
              />
              <span className="form-hint">Opcional (para cálculo de impostos e FGTS).</span>
            </div>
          </div>

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
              placeholder="Ex: Inclui reajuste de VR para R$ 1.200 e bônus de performance."
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
                placeholder="Ex: Tech Inovação S.A., Prefeitura, etc."
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
                placeholder="Ex: Especialista de TI, Médico, Gerente"
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

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Dia do Pagamento Principal *</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-input"
                value={paymentDay}
                onChange={(e) => setPaymentDay(parseInt(e.target.value) || 5)}
                required
              />
              <span className="form-hint">Ex: dia 5 ou dia útil de recebimento.</span>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Dia do Adiantamento (se houver)</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-input"
                placeholder="Ex: 20"
                value={secondPaymentDay}
                onChange={(e) => setSecondPaymentDay(e.target.value ? parseInt(e.target.value) : '')}
              />
              <span className="form-hint">Deixe em branco se não recebe vale.</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <DollarSign size={14} className="inline-icon" />
                Salário Líquido Vigente (R$) *
              </label>
              <input
                type="text"
                className="form-input text-glow-cyan"
                placeholder="Ex: 8963,68"
                value={contractNet}
                onChange={(e) => setContractNet(e.target.value)}
                required
                style={{ fontSize: '1.1rem', fontWeight: 600 }}
              />
              <span className="form-hint">Valor creditado em conta.</span>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Salário Bruto Vigente (R$)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 11500,00"
                value={contractGross}
                onChange={(e) => setContractGross(e.target.value)}
              />
              <span className="form-hint">Opcional.</span>
            </div>
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
