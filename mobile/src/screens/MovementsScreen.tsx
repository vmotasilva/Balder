import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  Calendar,
  Building2,
  DollarSign,
  Filter,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import { Movement, MovementType } from '../types';
import { theme } from '../theme';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const MovementsScreen: React.FC = () => {
  const { movements, isLoading, refreshFinancialData } = useFinancial();
  const [selectedFilter, setSelectedFilter] = useState<'TODOS' | MovementType>('TODOS');

  const filteredMovements = movements.filter((mov) => {
    if (selectedFilter === 'TODOS') return true;
    return mov.type === selectedFilter;
  });

  const filterOptions: Array<{ label: string; value: 'TODOS' | MovementType }> = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Receitas', value: 'RECEBER' },
    { label: 'Despesas', value: 'PAGAR' },
    { label: 'Cartões', value: 'CARTAO' },
    { label: 'Empréstimos', value: 'EMPRESTIMO' },
  ];

  const renderItem = ({ item }: { item: Movement }) => {
    const isIncome = item.type === 'RECEBER';
    const isLoan = item.type === 'EMPRESTIMO';
    const isCard = item.type === 'CARTAO';

    let badgeColor = theme.colors.expense;
    let badgeBg = theme.colors.expenseMuted;
    if (isIncome) {
      badgeColor = theme.colors.income;
      badgeBg = theme.colors.incomeMuted;
    } else if (isLoan) {
      badgeColor = theme.colors.loan;
      badgeBg = theme.colors.loanMuted;
    } else if (isCard) {
      badgeColor = theme.colors.card;
      badgeBg = theme.colors.cardMuted;
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
            {isCard && <CreditCard size={14} color={badgeColor} />}
            {isLoan && <Building2 size={14} color={badgeColor} />}
            {isIncome && <DollarSign size={14} color={badgeColor} />}
            {!isCard && !isLoan && !isIncome && <Calendar size={14} color={badgeColor} />}
            <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{item.type}</Text>
          </View>
          <Text style={styles.dueDateText}>{item.dueDate}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.movementTitle}>{item.title}</Text>
          <Text style={styles.movementMeta}>
            {item.bank} • {item.category}
            {item.installmentsTotal && item.installmentsTotal > 1
              ? ` • Parcela ${item.installmentNumber}/${item.installmentsTotal}`
              : ''}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.statusTag,
              item.status === 'REALIZADA' ? styles.statusPaidTag : styles.statusPendingTag,
            ]}
          >
            <Text
              style={[
                styles.statusTagText,
                item.status === 'REALIZADA'
                  ? { color: theme.colors.income }
                  : { color: theme.colors.textMuted },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <Text style={[styles.amountText, { color: badgeColor }]}>
            {isIncome ? '+' : '-'} {formatCurrency(item.amount)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Lançamentos</Text>
        <Text style={styles.subtitle}>
          Histórico e projeções de fluxo ({filteredMovements.length} itens)
        </Text>

        {/* Barra de Filtros */}
        <FlatList
          horizontal
          data={filterOptions}
          keyExtractor={(opt) => opt.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => {
            const isSelected = selectedFilter === item.value;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedFilter(item.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

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
            <Text style={styles.emptySubtitle}>Altere os filtros acima para visualizar seus itens</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  filterScroll: {
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dueDateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  cardBody: {
    marginBottom: theme.spacing.sm,
  },
  movementTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  movementMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  statusPaidTag: {
    backgroundColor: theme.colors.incomeMuted,
  },
  statusPendingTag: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
