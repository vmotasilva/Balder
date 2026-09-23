import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {
  Landmark,
  Calculator,
  CheckCircle2,
  Clock,
  Zap,
  TrendingDown,
  Sparkles,
  ChevronRight,
  X,
  Calendar,
  Layers,
  ArrowDownRight,
  ShieldCheck,
  Plus,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import { groupLoanMovements, calculatePresentValue, type LoanContractGroup } from '../utils/loanMath';
import { calculateLoanSpreadsheet, type LoanSpreadsheetInput } from '../utils/loanSpreadsheetMath';
import type { Movement } from '../types';

export const LoansScreen: React.FC = () => {
  const { movements, toggleMovementStatus, prepayInstallments, addMovement } = useFinancial();

  const [activeTab, setActiveTab] = useState<'CONTRACTS' | 'SIMULATOR'>('CONTRACTS');
  const [selectedGroup, setSelectedGroup] = useState<LoanContractGroup | null>(null);

  // Modal de antecipação com desconto
  const [prepayModalVisible, setPrepayModalVisible] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Movement | null>(null);

  // Simulador Inputs
  const [simPrincipal, setSimPrincipal] = useState('42000');
  const [simRate, setSimRate] = useState('3.612');
  const [simTerm, setSimTerm] = useState('15');
  const [simContractDate, setSimContractDate] = useState('2026-10-03');
  const [simFirstDueDate, setSimFirstDueDate] = useState('2026-10-15');
  const [simContractName, setSimContractName] = useState('Empréstimo Financiado');
  const [simBank, setSimBank] = useState('Banco do Brasil');

  // Contratos agrupados
  const loanGroups = useMemo(() => {
    return groupLoanMovements(movements);
  }, [movements]);

  // Totais consolidados
  const totals = useMemo(() => {
    const nominal = loanGroups.reduce((acc, g) => acc + g.nominalBalance, 0);
    const pv = loanGroups.reduce((acc, g) => acc + g.presentValueToday, 0);
    const savings = loanGroups.reduce((acc, g) => acc + g.totalImmediateSavings, 0);
    const openCount = loanGroups.reduce((acc, g) => acc + g.openInstallments.length, 0);
    return { nominal, pv, savings, openCount };
  }, [loanGroups]);

  // Cálculo do simulador
  const simResult = useMemo(() => {
    const input: LoanSpreadsheetInput = {
      principalAmount: parseFloat(simPrincipal) || 0,
      monthlyInterestRate: (parseFloat(simRate) || 0) / 100,
      termMonths: parseInt(simTerm, 10) || 0,
      contractDate: simContractDate,
      firstDueDate: simFirstDueDate,
    };
    return calculateLoanSpreadsheet(input);
  }, [simPrincipal, simRate, simTerm, simContractDate, simFirstDueDate]);

  // Handler para abrir modal de antecipação
  const handleOpenPrepay = (inst: Movement) => {
    setSelectedInstallment(inst);
    setPrepayModalVisible(true);
  };

  // Executar antecipação com desconto
  const handleConfirmPrepay = async () => {
    if (!selectedInstallment) return;
    const rate = selectedInstallment.interestRatePercent || 2.5;
    const todayStr = new Date().toISOString().split('T')[0];
    const calc = calculatePresentValue(selectedInstallment.amount, selectedInstallment.dueDate, todayStr, rate);

    try {
      await prepayInstallments([
        {
          id: selectedInstallment.id,
          nominalAmount: selectedInstallment.amount,
          discountedAmount: calc.discountedAmount,
          discountAmount: calc.discountAmount,
        },
      ]);
      setPrepayModalVisible(false);
      Alert.alert('Sucesso', `Parcela antecipada com economia de R$ ${calc.discountAmount.toFixed(2)}!`);
    } catch {
      Alert.alert('Erro', 'Não foi possível antecipar a parcela.');
    }
  };

  // Contratar simulação e lançar no sistema
  const handleCreateFromSimulation = async () => {
    if (!simResult.rows.length) return;
    const term = parseInt(simTerm, 10);
    const pmt = simResult.summary.installmentValue;
    const rate = parseFloat(simRate);
    const groupId = 'loan-' + Date.now();

    try {
      for (const row of simResult.rows) {
        if (row.month === 0) continue;
        const [d, m, y] = row.dueDate.split('/');
        const isoDate = `${y}-${m}-${d}`;
        await addMovement({
          title: `${simContractName} (${row.month}/${term})`,
          amount: pmt,
          type: 'EMPRESTIMO',
          category: 'Empréstimos',
          nature: 'Dívidas & Empréstimos',
          date: isoDate,
          dueDate: isoDate,
          status: 'PREVISTA',
          bank: simBank,
          installmentNumber: row.month,
          installmentsTotal: term,
          installmentGroupId: groupId,
          interestRatePercent: rate,
          notes: `Simulação PRICE | Taxa ${rate}% a.m.`,
        });
      }
      Alert.alert('Parabéns!', `${term} parcelas geradas com sucesso.`);
      setActiveTab('CONTRACTS');
    } catch {
      Alert.alert('Erro', 'Falha ao salvar as parcelas do empréstimo.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Landmark size={24} color="#F59E0B" />
          <Text style={styles.headerTitle}>Empréstimos & PRICE</Text>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'CONTRACTS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('CONTRACTS')}
          >
            <Text style={[styles.tabText, activeTab === 'CONTRACTS' && styles.tabTextActive]}>
              Contratos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'SIMULATOR' && styles.tabButtonActive]}
            onPress={() => setActiveTab('SIMULATOR')}
          >
            <Text style={[styles.tabText, activeTab === 'SIMULATOR' && styles.tabTextActive]}>
              Simulador
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KPI Banner */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Saldo Nominal</Text>
            <Text style={styles.kpiValue}>
              R$ {totals.nominal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.kpiSub}>{totals.openCount} parcelas a vencer</Text>
          </View>
          <View style={styles.kpiCardHighlight}>
            <View style={styles.kpiRow}>
              <Zap size={16} color="#06B6D4" />
              <Text style={styles.kpiLabelCyan}>Quitação Hoje</Text>
            </View>
            <Text style={styles.kpiValueCyan}>
              R$ {totals.pv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <View style={styles.discountBadge}>
              <ArrowDownRight size={12} color="#10B981" />
              <Text style={styles.discountText}>
                Econ. R$ {totals.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {activeTab === 'CONTRACTS' ? (
          /* Aba: Contratos Ativos */
          <View>
            <Text style={styles.sectionTitle}>Seus Contratos Ativos</Text>

            {loanGroups.length === 0 ? (
              <View style={styles.emptyCard}>
                <Landmark size={40} color="#475569" />
                <Text style={styles.emptyTitle}>Nenhum empréstimo ativo</Text>
                <Text style={styles.emptyDesc}>
                  Utilize o Simulador PRICE para simular e cadastrar um novo contrato.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => setActiveTab('SIMULATOR')}
                >
                  <Sparkles size={16} color="#06B6D4" />
                  <Text style={styles.emptyActionText}>Ir para o Simulador</Text>
                </TouchableOpacity>
              </View>
            ) : (
              loanGroups.map((group) => {
                const isExpanded = selectedGroup?.groupId === group.groupId;
                return (
                  <View key={group.groupId} style={styles.contractCard}>
                    <TouchableOpacity
                      style={styles.contractHeader}
                      onPress={() => setSelectedGroup(isExpanded ? null : group)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                          <Text style={styles.contractTitle}>{group.title}</Text>
                          <View style={styles.rateBadge}>
                            <Text style={styles.rateBadgeText}>{group.interestRatePercent}% a.m.</Text>
                          </View>
                        </View>
                        <Text style={styles.contractBank}>{group.bank} • {group.category}</Text>

                        {/* Barra de progresso */}
                        <View style={styles.progressContainer}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${Math.min(
                                  100,
                                  (group.paidInstallments.length / (group.totalInstallmentsCount || 1)) * 100
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {group.paidInstallments.length} de {group.totalInstallmentsCount} parcelas quitadas
                        </Text>
                      </View>
                      <ChevronRight
                        size={20}
                        color="#94A3B8"
                        style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                      />
                    </TouchableOpacity>

                    {/* Resumo de Quitação */}
                    <View style={styles.contractSummaryRow}>
                      <View>
                        <Text style={styles.summaryLabel}>Saldo Devedor</Text>
                        <Text style={styles.summaryVal}>
                          R$ {group.nominalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.summaryLabel}>Valor Presente (Hoje)</Text>
                        <Text style={styles.summaryValCyan}>
                          R$ {group.presentValueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>

                    {/* Detalhamento de Parcelas (Quando expandido) */}
                    {isExpanded && (
                      <View style={styles.installmentsList}>
                        <Text style={styles.installmentsSubtitle}>Parcelas do Contrato:</Text>
                        {group.allInstallments.map((inst) => {
                          const isPaid = inst.status === 'REALIZADA';
                          const today = new Date().toISOString().split('T')[0];
                          const calc = calculatePresentValue(
                            inst.amount,
                            inst.dueDate,
                            today,
                            group.interestRatePercent
                          );

                          return (
                            <View key={inst.id} style={styles.installmentRow}>
                              <TouchableOpacity
                                onPress={() => toggleMovementStatus(inst.id)}
                                style={styles.checkButton}
                              >
                                {isPaid ? (
                                  <CheckCircle2 size={20} color="#10B981" />
                                ) : (
                                  <Clock size={20} color="#F59E0B" />
                                )}
                              </TouchableOpacity>
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.installmentTitle}>
                                  Parcela {inst.installmentNumber || '1'} • Venc. {inst.dueDate.split('-').reverse().join('/')}
                                </Text>
                                <Text style={styles.installmentAmount}>
                                  Nominal: R$ {inst.amount.toFixed(2)}
                                </Text>
                              </View>

                              {!isPaid && calc.discountAmount > 0 ? (
                                <TouchableOpacity
                                  style={styles.prepayActionBadge}
                                  onPress={() => handleOpenPrepay(inst)}
                                >
                                  <Zap size={12} color="#06B6D4" />
                                  <Text style={styles.prepayActionText}>
                                    Antecipar R$ {calc.discountedAmount.toFixed(2)}
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <View
                                  style={[
                                    styles.statusTag,
                                    { backgroundColor: isPaid ? '#064E3B' : '#78350F' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusTagText,
                                      { color: isPaid ? '#10B981' : '#F59E0B' },
                                    ]}
                                  >
                                    {isPaid ? 'Paga' : 'Pendente'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* Aba: Simulador PRICE */
          <View>
            <View style={styles.simCard}>
              <View style={styles.simHeader}>
                <Calculator size={20} color="#06B6D4" />
                <Text style={styles.simTitle}>Simulador de Financiamento PRICE</Text>
              </View>

              {/* Formulário */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Valor Financiado (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={simPrincipal}
                    onChangeText={setSimPrincipal}
                    keyboardType="numeric"
                    placeholder="42000"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Taxa Juros (% a.m.)</Text>
                  <TextInput
                    style={styles.input}
                    value={simRate}
                    onChangeText={setSimRate}
                    keyboardType="numeric"
                    placeholder="3.612"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Prazo (Meses)</Text>
                  <TextInput
                    style={styles.input}
                    value={simTerm}
                    onChangeText={setSimTerm}
                    keyboardType="numeric"
                    placeholder="15"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.label}>1º Vencimento (AAAA-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={simFirstDueDate}
                    onChangeText={setSimFirstDueDate}
                    placeholder="2026-10-15"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Nome do Contrato</Text>
                  <TextInput
                    style={styles.input}
                    value={simContractName}
                    onChangeText={setSimContractName}
                    placeholder="Empréstimo Financiado"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Banco Emissor</Text>
                  <TextInput
                    style={styles.input}
                    value={simBank}
                    onChangeText={setSimBank}
                    placeholder="Banco do Brasil"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              {/* Resultado Resumo */}
              <View style={styles.simSummaryBox}>
                <View style={styles.simSummaryItem}>
                  <Text style={styles.simSummaryItemLabel}>Parcela Fixa (PMT)</Text>
                  <Text style={styles.simSummaryItemValCyan}>
                    R$ {simResult.summary.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.simSummaryItem}>
                  <Text style={styles.simSummaryItemLabel}>Total em Juros</Text>
                  <Text style={styles.simSummaryItemValRed}>
                    R$ {simResult.summary.totalInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.simSummaryItem}>
                  <Text style={styles.simSummaryItemLabel}>Custo Total</Text>
                  <Text style={styles.simSummaryItemVal}>
                    R$ {simResult.summary.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.createContractButton}
                onPress={handleCreateFromSimulation}
              >
                <Plus size={18} color="#0B0F17" />
                <Text style={styles.createContractButtonText}>Contratar e Lançar no Sistema</Text>
              </TouchableOpacity>
            </View>

            {/* Tabela de Amortização */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              Cronograma de Amortização PRICE
            </Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCol, { flex: 0.8 }]}>Nº</Text>
                <Text style={[styles.tableCol, { flex: 1.5 }]}>Venc.</Text>
                <Text style={[styles.tableCol, { flex: 1.8 }]}>Parcela</Text>
                <Text style={[styles.tableCol, { flex: 1.8 }]}>Juros</Text>
                <Text style={[styles.tableCol, { flex: 1.8 }]}>Saldo</Text>
              </View>
              {simResult.rows.map((row) => (
                <View key={row.month} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>{row.month}</Text>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>{row.dueDate}</Text>
                  <Text style={[styles.tableCell, { flex: 1.8, color: '#06B6D4' }]}>
                    R$ {row.installmentValue.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1.8, color: '#F43F5E' }]}>
                    R$ {row.interestValue.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1.8 }]}>
                    R$ {row.balanceRemaining.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal Antecipação com Desconto */}
      <Modal
        visible={prepayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrepayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Zap size={20} color="#06B6D4" />
                <Text style={styles.modalTitle}>Antecipação com Desconto</Text>
              </View>
              <TouchableOpacity onPress={() => setPrepayModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedInstallment && (() => {
              const rate = selectedInstallment.interestRatePercent || 2.5;
              const today = new Date().toISOString().split('T')[0];
              const calc = calculatePresentValue(selectedInstallment.amount, selectedInstallment.dueDate, today, rate);

              return (
                <View style={styles.modalBody}>
                  <Text style={styles.modalDesc}>
                    Conforme Resolução BACEN nº 3.516 e Art. 52 do CDC, a liquidação antecipada concede abatimento proporcional dos juros futuros.
                  </Text>

                  <View style={styles.modalCalcBox}>
                    <View style={styles.modalCalcRow}>
                      <Text style={styles.modalCalcLabel}>Parcela:</Text>
                      <Text style={styles.modalCalcVal}>{selectedInstallment.title}</Text>
                    </View>
                    <View style={styles.modalCalcRow}>
                      <Text style={styles.modalCalcLabel}>Vencimento Original:</Text>
                      <Text style={styles.modalCalcVal}>
                        {selectedInstallment.dueDate.split('-').reverse().join('/')}
                      </Text>
                    </View>
                    <View style={styles.modalCalcRow}>
                      <Text style={styles.modalCalcLabel}>Dias de Antecipação:</Text>
                      <Text style={styles.modalCalcVal}>{calc.daysToDueDate} dias</Text>
                    </View>
                    <View style={styles.modalCalcRow}>
                      <Text style={styles.modalCalcLabel}>Valor Nominal:</Text>
                      <Text style={styles.modalCalcVal}>R$ {selectedInstallment.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.modalCalcRow}>
                      <Text style={styles.modalCalcLabel}>Desconto Obtido ({calc.discountPercent}%):</Text>
                      <Text style={[styles.modalCalcVal, { color: '#10B981' }]}>
                        - R$ {calc.discountAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.modalCalcRow, styles.modalCalcRowHighlight]}>
                      <Text style={styles.modalHighlightLabel}>Valor para Pagar Hoje:</Text>
                      <Text style={styles.modalHighlightVal}>
                        R$ {calc.discountedAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmPrepayButton}
                    onPress={handleConfirmPrepay}
                  >
                    <ShieldCheck size={18} color="#0B0F17" />
                    <Text style={styles.confirmPrepayButtonText}>
                      Confirmar Quitação por R$ {calc.discountedAmount.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#161F30',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#06B6D4',
  },
  tabText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0B0F17',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kpiCardHighlight: {
    flex: 1,
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  kpiLabelCyan: {
    fontSize: 12,
    color: '#06B6D4',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  kpiValueCyan: {
    fontSize: 16,
    fontWeight: '700',
    color: '#06B6D4',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748B',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#06B6D4',
  },
  contractCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contractTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rateBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rateBadgeText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  contractBank: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#0B0F17',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  contractSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 2,
  },
  summaryValCyan: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06B6D4',
    marginTop: 2,
  },
  installmentsList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  installmentsSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  installmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkButton: {
    padding: 4,
  },
  installmentTitle: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  installmentAmount: {
    fontSize: 11,
    color: '#64748B',
  },
  prepayActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  prepayActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#06B6D4',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  simCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  simTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  simSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  simSummaryItem: {
    alignItems: 'center',
  },
  simSummaryItemLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
  },
  simSummaryItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  simSummaryItemValCyan: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06B6D4',
  },
  simSummaryItemValRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F43F5E',
  },
  createContractButton: {
    backgroundColor: '#06B6D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 12,
  },
  createContractButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B0F17',
  },
  tableCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableCol: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableCell: {
    fontSize: 11,
    color: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161F30',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalBody: {
    marginTop: 4,
  },
  modalDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalCalcBox: {
    backgroundColor: '#0B0F17',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  modalCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalCalcRowHighlight: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 6,
    paddingTop: 8,
  },
  modalCalcLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalCalcVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  modalHighlightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06B6D4',
  },
  modalHighlightVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#06B6D4',
  },
  confirmPrepayButton: {
    backgroundColor: '#06B6D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
  },
  confirmPrepayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F17',
  },
});
