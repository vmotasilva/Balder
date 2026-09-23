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
  Briefcase,
  TrendingUp,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  ChevronRight,
  X,
  History,
  Clock,
  DollarSign,
  Building,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import type { SalaryContract, SalaryAdjustment } from '../types';

export const SalaryContractsScreen: React.FC = () => {
  const {
    salaryContracts,
    addSalaryContract,
    updateSalaryContract,
    deleteSalaryContract,
    addSalaryAdjustment,
    deleteSalaryAdjustment,
  } = useFinancial();

  // Estados de modais
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<SalaryContract | null>(null);

  // Form Contrato
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [contractType, setContractType] = useState<'CLT' | 'PJ' | 'PRO_LABORE'>('CLT');
  const [baseAmount, setBaseAmount] = useState('');
  const [firstPaymentDay, setFirstPaymentDay] = useState('20');
  const [firstPaymentPercent, setFirstPaymentPercent] = useState('40');
  const [secondPaymentDay, setSecondPaymentDay] = useState('5');
  const [secondPaymentPercent, setSecondPaymentPercent] = useState('60');

  // Form Reajuste
  const [adjNewAmount, setAdjNewAmount] = useState('');
  const [adjEffectiveDate, setAdjEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjReason, setAdjReason] = useState('Promoção');
  const [adjNotes, setAdjNotes] = useState('');

  // Total mensal consolidado
  const totalMonthlyIncome = useMemo(() => {
    return salaryContracts
      .filter((c) => c.active !== false && c.isActive !== false)
      .reduce((sum, c) => {
        const adjs = c.adjustments || c.history || [];
        if (adjs.length > 0) {
          const sorted = [...adjs].sort(
            (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
          );
          return sum + (sorted[0]?.newAmount ?? sorted[0]?.netAmount ?? c.baseAmount ?? c.currentNetAmount ?? 0);
        }
        return sum + (c.baseAmount ?? c.currentNetAmount ?? 0);
      }, 0);
  }, [salaryContracts]);

  // Abrir modal de criação de contrato
  const handleOpenNewContract = () => {
    setCompanyName('');
    setRoleTitle('');
    setContractType('CLT');
    setBaseAmount('');
    setFirstPaymentDay('20');
    setFirstPaymentPercent('40');
    setSecondPaymentDay('5');
    setSecondPaymentPercent('60');
    setContractModalVisible(true);
  };

  // Salvar novo contrato
  const handleSaveContract = async () => {
    const val = parseFloat(baseAmount);
    if (!companyName.trim() || isNaN(val) || val <= 0) {
      Alert.alert('Atenção', 'Informe o nome da empresa e um salário válido.');
      return;
    }

    try {
      await addSalaryContract({
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim() || 'Colaborador',
        contractType,
        baseAmount: val,
        firstPaymentDay: parseInt(firstPaymentDay, 10) || 20,
        firstPaymentPercent: parseFloat(firstPaymentPercent) || 40,
        secondPaymentDay: parseInt(secondPaymentDay, 10) || 5,
        secondPaymentPercent: parseFloat(secondPaymentPercent) || 60,
        active: true,
        adjustments: [],
      });
      setContractModalVisible(false);
      Alert.alert('Sucesso', 'Contrato de salário adicionado!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o contrato.');
    }
  };

  // Abrir modal de reajuste
  const handleOpenAdjustment = (contract: SalaryContract) => {
    setSelectedContract(contract);
    const currentVal = getCurrentSalary(contract);
    setAdjNewAmount(String(currentVal));
    setAdjEffectiveDate(new Date().toISOString().split('T')[0]);
    setAdjReason('Mérito');
    setAdjNotes('');
    setAdjustmentModalVisible(true);
  };

  // Salvar reajuste
  const handleSaveAdjustment = async () => {
    if (!selectedContract) return;
    const newVal = parseFloat(adjNewAmount);
    if (isNaN(newVal) || newVal <= 0) {
      Alert.alert('Atenção', 'Informe o novo valor do salário.');
      return;
    }

    try {
      await addSalaryAdjustment(selectedContract.id, {
        effectiveDate: adjEffectiveDate,
        newAmount: newVal,
        reason: adjReason,
        notes: adjNotes,
      });
      setAdjustmentModalVisible(false);
      Alert.alert('Sucesso', 'Reajuste registrado no histórico!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o reajuste.');
    }
  };

  const getCurrentSalary = (c: SalaryContract): number => {
    const adjs = c.adjustments || c.history || [];
    if (adjs.length > 0) {
      const sorted = [...adjs].sort(
        (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
      );
      return sorted[0]?.newAmount ?? sorted[0]?.netAmount ?? c.baseAmount ?? c.currentNetAmount ?? 0;
    }
    return c.baseAmount ?? c.currentNetAmount ?? 0;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Briefcase size={24} color="#10B981" />
          <Text style={styles.headerTitle}>Contratos & Salários</Text>
        </View>
        <TouchableOpacity style={styles.newButton} onPress={handleOpenNewContract}>
          <Plus size={16} color="#0B0F17" />
          <Text style={styles.newButtonText}>Novo Contrato</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Totalizador Banner */}
        <View style={styles.totalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={18} color="#10B981" />
            <Text style={styles.totalLabel}>Receita Mensal em Contratos</Text>
          </View>
          <Text style={styles.totalValue}>
            R$ {totalMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.totalSub}>
            {salaryContracts.filter((c) => c.active !== false && c.isActive !== false).length} contrato(s) ativo(s)
          </Text>
        </View>

        {/* Lista de Contratos */}
        <Text style={styles.sectionTitle}>Seus Contratos de Trabalho</Text>

        {salaryContracts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Briefcase size={36} color="#64748B" />
            <Text style={styles.emptyTitle}>Nenhum contrato cadastrado</Text>
            <Text style={styles.emptyDesc}>
              Cadastre suas fontes de renda (CLT, PJ, Pró-labore) para projeção automática de recebimentos.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleOpenNewContract}>
              <Plus size={16} color="#06B6D4" />
              <Text style={styles.emptyButtonText}>Cadastrar Contrato</Text>
            </TouchableOpacity>
          </View>
        ) : (
          salaryContracts.map((contract) => {
            const currentSalary = getCurrentSalary(contract);
            const compName = contract.companyName || contract.employer || 'Empresa';
            const role = contract.roleTitle || contract.role || 'Colaborador';
            const p1Day = contract.firstPaymentDay ?? 20;
            const p1Pct = contract.firstPaymentPercent ?? 40;
            const p2Day = contract.secondPaymentDay ?? contract.paymentDay ?? 5;
            const p2Pct = contract.secondPaymentPercent ?? (100 - p1Pct);
            const adjs = contract.adjustments || contract.history || [];

            return (
              <View key={contract.id} style={styles.contractCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.companyTitle}>{compName}</Text>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{contract.contractType}</Text>
                      </View>
                    </View>
                    <Text style={styles.roleTitle}>{role}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Remover Contrato', `Deseja excluir ${compName}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Excluir',
                          style: 'destructive',
                          onPress: () => deleteSalaryContract(contract.id),
                        },
                      ]);
                    }}
                  >
                    <Trash2 size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Salário Atual */}
                <View style={styles.salaryRow}>
                  <View>
                    <Text style={styles.salaryLabel}>Salário Líquido Atual</Text>
                    <Text style={styles.salaryValue}>
                      R$ {currentSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => handleOpenAdjustment(contract)}
                  >
                    <History size={14} color="#06B6D4" />
                    <Text style={styles.adjustButtonText}>Reajustar</Text>
                  </TouchableOpacity>
                </View>

                {/* Datas de Pagamento */}
                <View style={styles.scheduleBox}>
                  <View style={styles.scheduleCol}>
                    <Text style={styles.scheduleLabel}>1ª Parcela ({p1Pct}%)</Text>
                    <Text style={styles.scheduleValue}>
                      Todo dia {p1Day} • R${' '}
                      {((currentSalary * p1Pct) / 100).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.scheduleCol}>
                    <Text style={styles.scheduleLabel}>2ª Parcela ({p2Pct}%)</Text>
                    <Text style={styles.scheduleValue}>
                      Todo dia {p2Day} • R${' '}
                      {((currentSalary * p2Pct) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Histórico de Reajustes */}
                {adjs.length > 0 && (
                  <View style={styles.historyBox}>
                    <Text style={styles.historyTitle}>Histórico de Reajustes:</Text>
                    {adjs.map((adj) => (
                      <View key={adj.id} style={styles.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyReason}>
                            {adj.reason} • {adj.effectiveDate.split('-').reverse().join('/')}
                          </Text>
                          {adj.notes ? <Text style={styles.historyNotes}>{adj.notes}</Text> : null}
                        </View>
                        <Text style={styles.historyAmount}>
                          R$ {(adj.newAmount ?? adj.netAmount ?? 0).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Novo Contrato */}
      <Modal
        visible={contractModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContractModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Contrato de Salário</Text>
              <TouchableOpacity onPress={() => setContractModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Empresa / Empregador</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Ex: Nubank, Google, Própria Empresa"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Cargo / Função</Text>
              <TextInput
                style={styles.input}
                value={roleTitle}
                onChangeText={setRoleTitle}
                placeholder="Ex: Engenheiro de Software"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Regime de Contratação</Text>
              <View style={styles.typeSelector}>
                {(['CLT', 'PJ', 'PRO_LABORE'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOption, contractType === t && styles.typeOptionActive]}
                    onPress={() => setContractType(t)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        contractType === t && styles.typeOptionTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Salário Base Líquido (R$)</Text>
              <TextInput
                style={styles.input}
                value={baseAmount}
                onChangeText={setBaseAmount}
                keyboardType="numeric"
                placeholder="8500.00"
                placeholderTextColor="#64748B"
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dia 1ª Parcela</Text>
                  <TextInput
                    style={styles.input}
                    value={firstPaymentDay}
                    onChangeText={setFirstPaymentDay}
                    keyboardType="numeric"
                    placeholder="20"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>% 1ª Parcela</Text>
                  <TextInput
                    style={styles.input}
                    value={firstPaymentPercent}
                    onChangeText={setFirstPaymentPercent}
                    keyboardType="numeric"
                    placeholder="40"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dia 2ª Parcela</Text>
                  <TextInput
                    style={styles.input}
                    value={secondPaymentDay}
                    onChangeText={setSecondPaymentDay}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor="#64748B"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>% 2ª Parcela</Text>
                  <TextInput
                    style={styles.input}
                    value={secondPaymentPercent}
                    onChangeText={setSecondPaymentPercent}
                    keyboardType="numeric"
                    placeholder="60"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveContract}>
                <Text style={styles.saveButtonText}>Salvar Contrato</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Reajuste */}
      <Modal
        visible={adjustmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjustmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reajuste de Salário</Text>
              <TouchableOpacity onPress={() => setAdjustmentModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Novo Salário Líquido (R$)</Text>
            <TextInput
              style={styles.input}
              value={adjNewAmount}
              onChangeText={setAdjNewAmount}
              keyboardType="numeric"
              placeholder="9500.00"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Data de Vigência (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={adjEffectiveDate}
              onChangeText={setAdjEffectiveDate}
              placeholder="2026-10-01"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Motivo do Reajuste</Text>
            <TextInput
              style={styles.input}
              value={adjReason}
              onChangeText={setAdjReason}
              placeholder="Ex: Dissídio Anual, Promoção, Mérito"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Observações</Text>
            <TextInput
              style={styles.input}
              value={adjNotes}
              onChangeText={setAdjNotes}
              placeholder="Ex: Passou para nível Sênior"
              placeholderTextColor="#64748B"
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAdjustment}>
              <Text style={styles.saveButtonText}>Registrar Reajuste</Text>
            </TouchableOpacity>
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0F17',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  totalCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  totalSub: {
    fontSize: 12,
    color: '#64748B',
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#06B6D4',
  },
  contractCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  typeBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#06B6D4',
  },
  roleTitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  salaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  salaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 2,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  adjustButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#06B6D4',
  },
  scheduleBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
  },
  scheduleValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  historyBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyReason: {
    fontSize: 11,
    color: '#F8FAFC',
  },
  historyNotes: {
    fontSize: 10,
    color: '#64748B',
  },
  historyAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  inputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B0F17',
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  typeOptionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#06B6D4',
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F17',
  },
});
