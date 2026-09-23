import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, TrendingUp, Plus, Trash2, X, CheckCircle2, DollarSign, Calendar } from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import type { Goal } from '../types';
import { theme } from '../theme';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const GoalsScreen: React.FC = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useFinancial();

  const [modalVisible, setModalVisible] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('2026-12-31');
  const [category, setCategory] = useState('Segurança');

  // Modal de aporte rápido
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [depositVal, setDepositVal] = useState('');

  const handleOpenAdd = () => {
    setGoalTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setDeadline('2026-12-31');
    setCategory('Segurança');
    setModalVisible(true);
  };

  const handleSaveGoal = async () => {
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;

    if (!goalTitle.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Atenção', 'Informe um título e um valor alvo válido.');
      return;
    }

    try {
      await addGoal({
        title: goalTitle.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline,
        category,
        color: category === 'Segurança' ? '#10B981' : category === 'Investimentos' ? '#06B6D4' : '#A855F7',
      });
      setModalVisible(false);
      Alert.alert('Sucesso', 'Meta criada com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta.');
    }
  };

  const handleAddDeposit = async () => {
    if (!selectedGoal) return;
    const addVal = parseFloat(depositVal);
    if (isNaN(addVal) || addVal <= 0) {
      Alert.alert('Atenção', 'Informe o valor do aporte.');
      return;
    }

    const newCurrent = selectedGoal.currentAmount + addVal;
    try {
      await updateGoal(selectedGoal.id, { currentAmount: newCurrent });
      setDepositModalVisible(false);
      Alert.alert('Parabéns!', `Aporte de R$ ${addVal.toFixed(2)} registrado na meta!`);
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o aporte.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Metas & Objetivos</Text>
            <Text style={styles.subtitle}>Evolução patrimonial e reservas</Text>
          </View>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={handleOpenAdd}>
            <Plus size={18} color="#0B0F17" />
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Target size={36} color="#64748B" />
            <Text style={styles.emptyTitle}>Nenhuma meta cadastrada</Text>
            <Text style={styles.emptySubtitle}>Defina metas para orientar seus aportes mensais.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleOpenAdd}>
              <Plus size={16} color="#06B6D4" />
              <Text style={styles.emptyButtonText}>Criar Primeira Meta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((goal) => {
            const progressPercent = Math.min(
              100,
              Math.round((goal.currentAmount / (goal.targetAmount || 1)) * 100)
            );
            const cardColor = goal.color || '#06B6D4';

            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={[styles.categoryBadge, { backgroundColor: `${cardColor}22` }]}>
                    <Target size={14} color={cardColor} />
                    <Text style={[styles.categoryText, { color: cardColor }]}>{goal.category}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.deadlineText}>Prazo: {goal.deadline}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Excluir Meta', `Deseja remover "${goal.title}"?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Excluir', style: 'destructive', onPress: () => deleteGoal(goal.id) },
                        ]);
                      }}
                    >
                      <Trash2 size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.goalTitle}>{goal.title}</Text>

                {/* Barra de Progresso */}
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: cardColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.amountLabel}>Acumulado</Text>
                    <Text style={styles.currentAmountText}>{formatCurrency(goal.currentAmount)}</Text>
                  </View>
                  <View style={styles.percentBadge}>
                    <Text style={[styles.percentText, { color: cardColor }]}>{progressPercent}%</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Objetivo</Text>
                    <Text style={styles.targetAmountText}>{formatCurrency(goal.targetAmount)}</Text>
                  </View>
                </View>

                {/* Botão de Aporte */}
                <TouchableOpacity
                  style={styles.depositAction}
                  onPress={() => {
                    setSelectedGoal(goal);
                    setDepositVal('');
                    setDepositModalVisible(true);
                  }}
                >
                  <TrendingUp size={14} color="#06B6D4" />
                  <Text style={styles.depositActionText}>Adicionar Aporte / Depósito</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Nova Meta */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Meta Financeira</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Título da Meta</Text>
            <TextInput
              style={styles.input}
              value={goalTitle}
              onChangeText={setGoalTitle}
              placeholder="Ex: Reserva de Emergência, Viagem Europa"
              placeholderTextColor="#64748B"
            />

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Valor Alvo (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="numeric"
                  placeholder="50000.00"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Saldo Atual (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={currentAmount}
                  onChangeText={setCurrentAmount}
                  keyboardType="numeric"
                  placeholder="10000.00"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Prazo Limite (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="2026-12-31"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Categoria</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Segurança, Investimentos, Bens..."
              placeholderTextColor="#64748B"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoal}>
              <Text style={styles.saveBtnText}>Criar Meta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Aporte Rápido */}
      <Modal
        visible={depositModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aporte na Meta</Text>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedGoal && (
              <Text style={styles.depositGoalTitle}>Meta: {selectedGoal.title}</Text>
            )}

            <Text style={styles.inputLabel}>Valor do Depósito (R$)</Text>
            <TextInput
              style={styles.input}
              value={depositVal}
              onChangeText={setDepositVal}
              keyboardType="numeric"
              placeholder="500.00"
              placeholderTextColor="#64748B"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddDeposit}>
              <Text style={styles.saveBtnText}>Confirmar Aporte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
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
  goalCard: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deadlineText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#0B0F17',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  currentAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  targetAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: '#0B0F17',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  depositAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  depositActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#06B6D4',
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
  depositGoalTitle: {
    fontSize: 14,
    color: '#06B6D4',
    fontWeight: '600',
    marginBottom: 12,
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
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#06B6D4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F17',
  },
});
