import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  Calendar,
  Building2,
  DollarSign,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Layers,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import type { Movement, MovementType } from '../types';
import { theme } from '../theme';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const MovementsScreen: React.FC = () => {
  const {
    movements,
    isLoading,
    refreshFinancialData,
    addMovement,
    toggleMovementStatus,
    deleteMovement,
    natures,
    accounts,
    cards,
  } = useFinancial();

  const [selectedFilter, setSelectedFilter] = useState<'TODOS' | 'RECEITA' | 'DESPESA' | 'EMPRESTIMO'>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<MovementType>('DESPESA');
  const [formCategory, setFormCategory] = useState('Alimentação');
  const [formNature, setFormNature] = useState(natures[0]?.name || 'Consumo');
  const [formBank, setFormBank] = useState('Nubank');
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formInstallments, setFormInstallments] = useState('1');
  const [formIsPaid, setFormIsPaid] = useState(false);

  // Filtro e Busca combinados
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      // Filtro de tipo
      if (selectedFilter !== 'TODOS') {
        if (selectedFilter === 'RECEITA' && mov.type !== 'RECEITA' && mov.type !== 'RECEBER') return false;
        if (selectedFilter === 'DESPESA' && mov.type !== 'DESPESA' && mov.type !== 'PAGAR' && mov.type !== 'CARTAO') return false;
        if (selectedFilter === 'EMPRESTIMO' && mov.type !== 'EMPRESTIMO') return false;
      }
      // Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = mov.title.toLowerCase().includes(q);
        const matchBank = mov.bank.toLowerCase().includes(q);
        const matchCat = (mov.category || '').toLowerCase().includes(q);
        const matchNature = (mov.nature || '').toLowerCase().includes(q);
        return matchTitle || matchBank || matchCat || matchNature;
      }
      return true;
    });
  }, [movements, selectedFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setFormTitle('');
    setFormAmount('');
    setFormType('DESPESA');
    setFormCategory('Alimentação');
    setFormNature(natures[0]?.name || 'Consumo');
    setFormBank(accounts[0]?.name || 'Nubank');
    setFormDueDate(new Date().toISOString().split('T')[0]);
    setFormInstallments('1');
    setFormIsPaid(false);
    setModalVisible(true);
  };

  const handleSaveMovement = async () => {
    const amountVal = parseFloat(formAmount);
    if (!formTitle.trim() || isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Atenção', 'Informe uma descrição e um valor positivo.');
      return;
    }

    const totalInst = parseInt(formInstallments, 10) || 1;
    const groupId = totalInst > 1 ? 'grp-' + Date.now() : undefined;

    try {
      if (totalInst > 1) {
        // Gera parcelas
        for (let i = 1; i <= totalInst; i++) {
          const [y, m, d] = formDueDate.split('-').map(Number);
          const targetDate = new Date(y, m - 1 + (i - 1), d);
          const isoDate = targetDate.toISOString().split('T')[0];

          await addMovement({
            title: `${formTitle.trim()} (${i}/${totalInst})`,
            amount: amountVal / totalInst,
            type: formType,
            category: formCategory,
            nature: formNature,
            date: isoDate,
            dueDate: isoDate,
            status: i === 1 && formIsPaid ? 'REALIZADA' : 'PREVISTA',
            bank: formBank,
            installmentNumber: i,
            installmentsTotal: totalInst,
            installmentGroupId: groupId,
          });
        }
      } else {
        await addMovement({
          title: formTitle.trim(),
          amount: amountVal,
          type: formType,
          category: formCategory,
          nature: formNature,
          date: formDueDate,
          dueDate: formDueDate,
          status: formIsPaid ? 'REALIZADA' : 'PREVISTA',
          bank: formBank,
        });
      }

      setModalVisible(false);
      Alert.alert('Sucesso', 'Lançamento registrado com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o lançamento.');
    }
  };

  const renderItem = ({ item }: { item: Movement }) => {
    const isIncome = item.type === 'RECEITA' || item.type === 'RECEBER';
    const isLoan = item.type === 'EMPRESTIMO';
    const isPaid = item.status === 'REALIZADA';

    let badgeColor = theme.colors.expense;
    let badgeBg = theme.colors.expenseMuted;
    if (isIncome) {
      badgeColor = theme.colors.income;
      badgeBg = theme.colors.incomeMuted;
    } else if (isLoan) {
      badgeColor = theme.colors.loan;
      badgeBg = theme.colors.loanMuted;
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
            {isLoan && <Building2 size={13} color={badgeColor} />}
            {isIncome && <DollarSign size={13} color={badgeColor} />}
            {!isLoan && !isIncome && <Calendar size={13} color={badgeColor} />}
            <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{item.type}</Text>
          </View>
          <Text style={styles.dueDateText}>
            Venc: {item.dueDate.split('-').reverse().join('/')}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.movementTitle}>{item.title}</Text>
          <Text style={styles.movementMeta}>
            {item.bank} • {item.nature || item.category || 'Geral'}
            {item.installmentsTotal && item.installmentsTotal > 1
              ? ` • Parcela ${item.installmentNumber}/${item.installmentsTotal}`
              : ''}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          {/* 1-touch Status Toggle */}
          <TouchableOpacity
            style={[
              styles.statusTag,
              isPaid ? styles.statusPaidTag : styles.statusPendingTag,
            ]}
            onPress={() => toggleMovementStatus(item.id)}
            activeOpacity={0.7}
          >
            {isPaid ? (
              <CheckCircle2 size={14} color={theme.colors.income} />
            ) : (
              <Clock size={14} color={theme.colors.loan} />
            )}
            <Text
              style={[
                styles.statusTagText,
                isPaid ? { color: theme.colors.income } : { color: theme.colors.loan },
              ]}
            >
              {isPaid ? 'Realizada' : 'Pendente'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[styles.amountText, { color: isIncome ? '#10B981' : '#F43F5E' }]}>
              {isIncome ? '+' : '-'} {formatCurrency(item.amount)}
            </Text>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Excluir Lançamento', `Deseja remover "${item.title}"?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: () => deleteMovement(item.id),
                  },
                ]);
              }}
            >
              <Trash2 size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Lançamentos</Text>
            <Text style={styles.subtitle}>
              {filteredMovements.length} lançamentos encontrados
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
            <Plus size={16} color="#0B0F17" />
            <Text style={styles.addButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Campo de Busca */}
        <View style={styles.searchBar}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por descrição, banco, categoria..."
            placeholderTextColor="#64748B"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Barra de Filtros */}
        <View style={styles.filterRow}>
          {(['TODOS', 'RECEITA', 'DESPESA', 'EMPRESTIMO'] as const).map((opt) => {
            const isSelected = selectedFilter === opt;
            const labels: Record<string, string> = {
              TODOS: 'Todos',
              RECEITA: 'Receitas',
              DESPESA: 'Despesas',
              EMPRESTIMO: 'Empréstimos',
            };
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedFilter(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {labels[opt]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Lista */}
      <FlatList
        data={filteredMovements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshFinancialData}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Filter size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum lançamento encontrado</Text>
            <Text style={styles.emptySubtitle}>Altere a busca ou adicione um novo lançamento</Text>
          </View>
        }
      />

      {/* Modal Adicionar Lançamento */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Lançamento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.typeSelectorRow}>
              {(['DESPESA', 'RECEITA', 'EMPRESTIMO'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, formType === t && styles.typeBtnActive]}
                  onPress={() => setFormType(t)}
                >
                  <Text style={[styles.typeBtnText, formType === t && styles.typeBtnTextActive]}>
                    {t === 'DESPESA' ? 'Despesa' : t === 'RECEITA' ? 'Receita' : 'Empréstimo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Ex: Aluguel, Supermercado, Salário"
              placeholderTextColor="#64748B"
            />

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Valor (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={formAmount}
                  onChangeText={setFormAmount}
                  keyboardType="numeric"
                  placeholder="150.00"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Parcelas</Text>
                <TextInput
                  style={styles.input}
                  value={formInstallments}
                  onChangeText={setFormInstallments}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Natureza Orçamentária</Text>
                <TextInput
                  style={styles.input}
                  value={formNature}
                  onChangeText={setFormNature}
                  placeholder="Consumo, Fixas..."
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Conta / Banco</Text>
                <TextInput
                  style={styles.input}
                  value={formBank}
                  onChangeText={setFormBank}
                  placeholder="Nubank, Itaú..."
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Data de Vencimento (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={formDueDate}
              onChangeText={setFormDueDate}
              placeholder="2026-10-15"
              placeholderTextColor="#64748B"
            />

            {/* Já Pago? */}
            <TouchableOpacity
              style={styles.paidCheckboxRow}
              onPress={() => setFormIsPaid(!formIsPaid)}
            >
              <View style={[styles.checkbox, formIsPaid && styles.checkboxActive]}>
                {formIsPaid && <CheckCircle2 size={14} color="#0B0F17" />}
              </View>
              <Text style={styles.paidCheckboxText}>Marcar como já pago / recebido hoje</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMovement}>
              <Text style={styles.saveBtnText}>Salvar Lançamento</Text>
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
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0F17',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    paddingVertical: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dueDateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cardBody: {
    marginBottom: 10,
  },
  movementTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  movementMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPaidTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPendingTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
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
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B0F17',
  },
  typeBtnActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  typeBtnTextActive: {
    color: '#06B6D4',
    fontWeight: '700',
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
    paddingVertical: 9,
    fontSize: 13,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  paidCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F17',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  paidCheckboxText: {
    fontSize: 12,
    color: '#F8FAFC',
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
