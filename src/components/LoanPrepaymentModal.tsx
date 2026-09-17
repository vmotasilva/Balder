import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import {
  Sparkles,
  Calendar,
  DollarSign,
  ShieldCheck,
  Zap,
  Target,
  CheckCircle2,
  Building2,
  AlertCircle,
} from 'lucide-react';
import type { PrepaymentPurpose } from '../types';
import { calculatePresentValue, groupLoanMovements } from '../utils/loanMath';

interface LoanPrepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGroupId?: string;
  initialMovementId?: string;
}

export const LoanPrepaymentModal: React.FC<LoanPrepaymentModalProps> = ({
  isOpen,
  onClose,
  initialGroupId,
  initialMovementId,
}) => {
  const {
    movements,
    prepayInstallments,
    availableBalance,
    emergencyReserveAmount,
  } = useFinancial();

  // Data de hoje
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Data de simulação escolhida pelo usuário
  const [simulationDate, setSimulationDate] = useState<string>(todayStr);

  // Finalidade de amortização selecionada
  const [purpose, setPurpose] = useState<PrepaymentPurpose>('MAX_INTEREST_SAVING');

  // Valor avulso para amortização (quando a finalidade for EXTRA_BUDGET_AMOUNT)
  const [extraBudgetAmount, setExtraBudgetAmount] = useState<number>(5000);

  // Quantidade de parcelas a selecionar no modo rápido (ex: 3 parcelas)
  const [quickCount, setQuickCount] = useState<number>(3);

  // Agrupamento de todos os empréstimos cadastrados
  const loanGroups = useMemo(() => {
    return groupLoanMovements(movements, simulationDate);
  }, [movements, simulationDate]);

  // ID do contrato selecionado
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    if (initialGroupId) return initialGroupId;
    if (initialMovementId) {
      const mov = movements.find((m) => m.id === initialMovementId);
      if (mov?.installmentGroupId) return mov.installmentGroupId;
    }
    return loanGroups[0]?.groupId || '';
  });

  // Garantir que um grupo válido esteja selecionado
  const currentGroup = useMemo(() => {
    if (!loanGroups.length) return null;
    return loanGroups.find((g) => g.groupId === selectedGroupId) || loanGroups[0];
  }, [loanGroups, selectedGroupId]);

  // Taxa de juros editável pelo usuário para o contrato (padrão vem do contrato)
  const [customRate, setCustomRate] = useState<number>(currentGroup?.interestRatePercent || 3.03);

  // Atualizar taxa caso mude de contrato
  React.useEffect(() => {
    if (currentGroup) {
      setCustomRate(currentGroup.interestRatePercent);
    }
  }, [currentGroup?.groupId]);

  // IDs de parcelas selecionadas para antecipar
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);

  // Tabela calculada de todas as parcelas do empréstimo selecionado na data de simulação
  const calculatedInstallments = useMemo(() => {
    if (!currentGroup) return [];

    return currentGroup.openInstallments.map((item, index) => {
      const calc = calculatePresentValue(item.amount, item.dueDate, simulationDate, customRate);
      return {
        item,
        index: item.installmentNumber || index + 1,
        total: item.installmentsTotal || currentGroup.openInstallments.length,
        nominalAmount: item.amount,
        discountedAmount: calc.discountedAmount,
        discountAmount: calc.discountAmount,
        discountPercent: calc.discountPercent,
        daysToDueDate: calc.daysToDueDate,
      };
    });
  }, [currentGroup, simulationDate, customRate]);

  // Inicializar seleção automática conforme a finalidade escolhida
  React.useEffect(() => {
    if (!calculatedInstallments.length) {
      setSelectedMovementIds([]);
      return;
    }

    if (purpose === 'TOTAL_PAYOFF') {
      // Todas as parcelas
      setSelectedMovementIds(calculatedInstallments.map((c) => c.item.id));
    } else if (purpose === 'MAX_INTEREST_SAVING') {
      // Ordem inversa: pega as últimas N parcelas
      const count = Math.min(quickCount, calculatedInstallments.length);
      const reversed = [...calculatedInstallments].reverse();
      const chosen = reversed.slice(0, count);
      setSelectedMovementIds(chosen.map((c) => c.item.id));
    } else if (purpose === 'CASHFLOW_RELIEF') {
      // Ordem direta: pega as primeiras N parcelas imediatas
      const count = Math.min(quickCount, calculatedInstallments.length);
      const chosen = calculatedInstallments.slice(0, count);
      setSelectedMovementIds(chosen.map((c) => c.item.id));
    } else if (purpose === 'EXTRA_BUDGET_AMOUNT') {
      // Aloca nas parcelas de trás para frente até atingir o montante disponível
      let remainingBudget = extraBudgetAmount;
      const reversed = [...calculatedInstallments].reverse();
      const chosenIds: string[] = [];

      for (const inst of reversed) {
        if (inst.discountedAmount <= remainingBudget) {
          chosenIds.push(inst.item.id);
          remainingBudget -= inst.discountedAmount;
        }
      }
      setSelectedMovementIds(chosenIds);
    }
  }, [purpose, quickCount, extraBudgetAmount, calculatedInstallments]);

  // Alternar checkbox de uma parcela manualmente
  const toggleInstallment = (id: string) => {
    setSelectedMovementIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Métricas consolidadas das parcelas selecionadas
  const selectedCalculations = useMemo(() => {
    return calculatedInstallments.filter((c) => selectedMovementIds.includes(c.item.id));
  }, [calculatedInstallments, selectedMovementIds]);

  const totalNominalSelected = useMemo(() => {
    return selectedCalculations.reduce((acc, c) => acc + c.nominalAmount, 0);
  }, [selectedCalculations]);

  const totalDiscountedPayable = useMemo(() => {
    return selectedCalculations.reduce((acc, c) => acc + c.discountedAmount, 0);
  }, [selectedCalculations]);

  const totalSavings = Math.max(0, Math.round((totalNominalSelected - totalDiscountedPayable) * 100) / 100);
  const averageDiscountPercent = totalNominalSelected > 0
    ? Math.round((totalSavings / totalNominalSelected) * 10000) / 100
    : 0;

  // Prazo reduzido em meses
  const monthsReduced = selectedCalculations.length;

  // Saldo de caixa e Runway antes vs após amortização
  const balanceAfter = Math.max(0, availableBalance - totalDiscountedPayable);
  const avgMonthlyExpenses = Math.max(1, (emergencyReserveAmount / 6.8)); // base inferida de ~12.5k/mês
  const runwayBeforeMonths = (availableBalance / avgMonthlyExpenses).toFixed(1);
  const runwayAfterMonths = (balanceAfter / avgMonthlyExpenses).toFixed(1);

  // Efetivar a antecipação no fluxo de caixa real do Balder
  const handleConfirmPrepayment = () => {
    if (selectedMovementIds.length === 0) {
      alert('Selecione ao menos uma parcela para antecipar.');
      return;
    }

    const confirmMsg = `Confirmar antecipação de ${selectedMovementIds.length} parcela(s)?\n\n` +
      `• Desembolso na data ${simulationDate}: ${totalDiscountedPayable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
      `• Economia imediata de juros: ${totalSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${averageDiscountPercent}%)\n\n` +
      `O status das parcelas será atualizado para REALIZADA com o valor de desconto a valor presente.`;

    if (confirm(confirmMsg)) {
      const discountedAmountsMap: Record<string, number> = {};
      selectedCalculations.forEach((c) => {
        discountedAmountsMap[c.item.id] = c.discountedAmount;
      });

      prepayInstallments(selectedMovementIds, discountedAmountsMap, simulationDate);
      alert('Antecipação de parcelas efetivada com sucesso no Balder!');
      onClose();
    }
  };

  // Helpers de atalhos de data
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSimulationDate(d.toISOString().split('T')[0]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulador de Antecipação & Amortização de Empréstimos"
      subtitle="Calcule o deságio de juros a valor presente (Art. 52 CDC / BACEN) e simule o impacto no seu fluxo de caixa"
      maxWidth="900px"
    >
      <div className="prepayment-modal-content animate-fade-in">
        {!currentGroup ? (
          <div className="empty-state-box">
            <AlertCircle size={32} className="text-amber mb-2" />
            <h4>Nenhum empréstimo ativo em aberto</h4>
            <p>Você não possui parcelas de empréstimos pendentes registradas no sistema.</p>
            <button className="btn btn-primary btn-sm mt-3" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* LINHA DE SELEÇÃO DE EMPRÉSTIMO & TAXA */}
            <div className="prepayment-top-bar glass-card">
              <div className="form-group flex-1">
                <label className="text-xs text-muted flex items-center gap-1">
                  <Building2 size={13} className="text-amber" />
                  <span>Empréstimo Selecionado:</span>
                </label>
                <select
                  className="form-select select-sm font-semibold"
                  value={currentGroup.groupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                  {loanGroups.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.title} • {g.bank} ({g.openInstallments.length} parcelas abertas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ width: '150px' }}>
                <label className="text-xs text-muted">Taxa do Contrato (% a.m.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="20"
                  className="form-input font-bold text-amber"
                  value={customRate || ''}
                  onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
                  title="Taxa de juros mensal para descapitalização"
                />
              </div>

              <div className="prepayment-summary-stat">
                <span className="text-xs text-muted">Saldo Devedor Nominal</span>
                <strong className="text-white">
                  {currentGroup.nominalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
                <span className="text-xs text-cyan">
                  {currentGroup.openInstallments.length}x de{' '}
                  {currentGroup.openInstallments[0]?.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            {/* CONTROLE DE VARIAÇÃO DE DATA DE ANTECIPAÇÃO */}
            <div className="prepayment-date-card glass-card mt-3">
              <div className="prepayment-date-header">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-cyan" />
                  <h5 className="font-bold text-sm text-white">Data de Pagamento / Liquidação Antecipada:</h5>
                </div>
                <div className="quick-date-chips">
                  <button
                    type="button"
                    className={`date-chip ${simulationDate === todayStr ? 'active' : ''}`}
                    onClick={() => setSimulationDate(todayStr)}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setQuickDate(15)}
                  >
                    +15 Dias
                  </button>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setQuickDate(30)}
                  >
                    +30 Dias
                  </button>
                </div>
              </div>

              <div className="date-input-row mt-2">
                <input
                  type="date"
                  className="form-input text-sm font-bold text-cyan"
                  value={simulationDate}
                  onChange={(e) => setSimulationDate(e.target.value)}
                />
                <span className="text-xs text-secondary">
                  {simulationDate === todayStr
                    ? '⚡ Calculando deságio a valor presente para liquidação imediata hoje.'
                    : `Simulando antecipação para ${new Date(simulationDate + 'T12:00:00').toLocaleDateString('pt-BR')}. Os juros não decorridos até os vencimentos futuros serão deduzidos.`}
                </span>
              </div>
            </div>

            {/* SELEÇÃO ESTRATÉGICA POR FINALIDADE */}
            <div className="prepayment-purpose-section glass-card mt-3">
              <span className="text-xs text-muted block mb-2 font-semibold">
                Defina a Finalidade da Simulação de Antecipação:
              </span>

              <div className="purpose-buttons-grid">
                <button
                  type="button"
                  className={`purpose-btn ${purpose === 'MAX_INTEREST_SAVING' ? 'active' : ''}`}
                  onClick={() => setPurpose('MAX_INTEREST_SAVING')}
                >
                  <div className="purpose-icon">
                    <Target size={18} className="text-emerald" />
                  </div>
                  <div className="purpose-info">
                    <strong>Economia Máxima de Juros</strong>
                    <span>Antecipa do final para o começo (maior deságio)</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`purpose-btn ${purpose === 'CASHFLOW_RELIEF' ? 'active' : ''}`}
                  onClick={() => setPurpose('CASHFLOW_RELIEF')}
                >
                  <div className="purpose-icon">
                    <Zap size={18} className="text-amber" />
                  </div>
                  <div className="purpose-info">
                    <strong>Alívio Imediato de Caixa</strong>
                    <span>Quita as próximas parcelas imediatas</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`purpose-btn ${purpose === 'EXTRA_BUDGET_AMOUNT' ? 'active' : ''}`}
                  onClick={() => setPurpose('EXTRA_BUDGET_AMOUNT')}
                >
                  <div className="purpose-icon">
                    <DollarSign size={18} className="text-cyan" />
                  </div>
                  <div className="purpose-info">
                    <strong>Amortizar Montante Fixo</strong>
                    <span>Tenho R$ em mãos (13º, bônus, rendimentos)</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`purpose-btn ${purpose === 'TOTAL_PAYOFF' ? 'active' : ''}`}
                  onClick={() => setPurpose('TOTAL_PAYOFF')}
                >
                  <div className="purpose-icon">
                    <ShieldCheck size={18} className="text-purple" />
                  </div>
                  <div className="purpose-info">
                    <strong>Quitação Total</strong>
                    <span>Liquidação integral de todas as parcelas</span>
                  </div>
                </button>
              </div>

              {/* Controles Dinâmicos conforme Finalidade */}
              {purpose === 'EXTRA_BUDGET_AMOUNT' && (
                <div className="purpose-custom-controls animate-fade-in mt-3">
                  <div className="form-group flex-1">
                    <label className="text-xs text-muted">Quanto você deseja investir na antecipação?</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="500"
                        step="500"
                        className="form-input text-base font-bold text-cyan"
                        value={extraBudgetAmount || ''}
                        onChange={(e) => setExtraBudgetAmount(parseFloat(e.target.value) || 0)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setExtraBudgetAmount(3000)}
                      >
                        R$ 3.000
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setExtraBudgetAmount(5000)}
                      >
                        R$ 5.000
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setExtraBudgetAmount(10000)}
                      >
                        R$ 10.000
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(purpose === 'MAX_INTEREST_SAVING' || purpose === 'CASHFLOW_RELIEF') && (
                <div className="purpose-custom-controls animate-fade-in mt-3 flex items-center gap-3">
                  <span className="text-xs text-muted">Quantidade de parcelas a antecipar:</span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 5, 8, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`pill-btn ${quickCount === n ? 'active' : ''}`}
                        onClick={() => setQuickCount(n)}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TABELA DETALHADA DAS PARCELAS COM CHECKBOXES & VALOR SE PAGO HOJE */}
            <div className="prepayment-table-card glass-card mt-3">
              <div className="table-header-row flex justify-between items-center mb-2">
                <h5 className="font-bold text-xs text-white uppercase tracking-wider">
                  Parcelas do Contrato ({selectedMovementIds.length} de {calculatedInstallments.length} selecionadas)
                </h5>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-xs"
                    onClick={() => setSelectedMovementIds(calculatedInstallments.map((c) => c.item.id))}
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-xs"
                    onClick={() => setSelectedMovementIds([])}
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>

              <div className="prepayment-table-wrapper">
                <table className="prepayment-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px' }}></th>
                      <th>Parcela</th>
                      <th>Vencimento Original</th>
                      <th>Dias Antecipados</th>
                      <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                      <th style={{ textAlign: 'right' }} className="text-cyan">
                        Se Pago na Data
                      </th>
                      <th style={{ textAlign: 'right' }} className="text-emerald">
                        Economia de Juros
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatedInstallments.map((inst) => {
                      const isSelected = selectedMovementIds.includes(inst.item.id);
                      return (
                        <tr
                          key={inst.item.id}
                          className={isSelected ? 'row-selected' : ''}
                          onClick={() => toggleInstallment(inst.item.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInstallment(inst.item.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>
                            <span className="font-bold text-white">
                              {inst.index}/{inst.total}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-muted">{inst.item.dueDate}</span>
                          </td>
                          <td>
                            <span className="text-xs badge badge-cyan">
                              {inst.daysToDueDate > 0 ? `${inst.daysToDueDate} dias` : 'No vencimento'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="text-muted line-through text-xs mr-1">
                              {inst.daysToDueDate > 0 ? inst.nominalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                            </span>
                            <span className="font-medium text-white">
                              {inst.daysToDueDate <= 0 ? inst.nominalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} className="text-cyan font-bold">
                            {inst.discountedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {inst.discountAmount > 0 ? (
                              <span className="text-emerald font-bold text-xs">
                                - {inst.discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({inst.discountPercent}%)
                              </span>
                            ) : (
                              <span className="text-muted text-xs">R$ 0,00</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAINEL DE DIAGNÓSTICO DO IMPACTO NO FINANCEIRO */}
            <div className="prepayment-impact-card glass-card mt-3">
              <h5 className="text-xs font-bold text-cyan mb-3 flex items-center gap-1">
                <Sparkles size={14} />
                <span>Diagnóstico do Impacto Financeiro da Antecipação:</span>
              </h5>

              <div className="prepayment-impact-grid">
                <div className="impact-box">
                  <span className="impact-box-label">Desembolso Necessário</span>
                  <strong className="impact-box-val text-white">
                    {totalDiscountedPayable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                  <span className="impact-box-sub">
                    Para liquidar {selectedMovementIds.length} parcela(s)
                  </span>
                </div>

                <div className="impact-box">
                  <span className="impact-box-label">Economia Total em Juros</span>
                  <strong className="impact-box-val text-emerald">
                    +{totalSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                  <span className="impact-box-sub text-emerald">
                    Desconto médio de {averageDiscountPercent}%
                  </span>
                </div>

                <div className="impact-box">
                  <span className="impact-box-label">Redução do Contrato</span>
                  <strong className="impact-box-val text-cyan">
                    -{monthsReduced} meses
                  </strong>
                  <span className="impact-box-sub">
                    Você sai mais cedo da dívida
                  </span>
                </div>

                <div className="impact-box">
                  <span className="impact-box-label">Reserva de Emergência</span>
                  <strong className="impact-box-val text-white">
                    {runwayBeforeMonths}m → {runwayAfterMonths}m
                  </strong>
                  <span className="impact-box-sub">
                    Saldo restante: {balanceAfter.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>

            {/* AÇÕES DE SALVAR / EFETIVAR NO BALDER */}
            <div className="prepayment-actions-bar mt-4 flex justify-between items-center">
              <div className="text-xs text-muted">
                {selectedMovementIds.length > 0 ? (
                  <span>
                    Economia garantida de <strong>{totalSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> ao pagar em {simulationDate}.
                  </span>
                ) : (
                  <span>Selecione parcelas para calcular a economia.</span>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={selectedMovementIds.length === 0}
                  onClick={handleConfirmPrepayment}
                >
                  <CheckCircle2 size={16} />
                  <span>Efetivar Antecipação no Balder</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
