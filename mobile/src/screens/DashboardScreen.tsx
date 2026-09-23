import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  RotateCw,
  CreditCard,
  Building,
  Calendar,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useFinancial } from '../context/FinancialContext';
import { theme } from '../theme';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const { movements, accounts, totals, isLoading, refreshFinancialData } = useFinancial();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshFinancialData}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Top Bar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingSubtitle}>Visão Consolidada</Text>
            <Text style={styles.greetingTitle}>Olá, {user?.name?.split(' ')[0] || 'Investidor'}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshFinancialData}
            activeOpacity={0.7}
          >
            <RotateCw size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Hero Card - Saldo Projetado */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBox}>
              <Wallet size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.heroLabel}>SALDO PROJETADO</Text>
          </View>
          <Text style={styles.heroValue}>{formatCurrency(totals.saldoPrevisto)}</Text>
          <Text style={styles.heroFooter}>
            Baseado no fluxo de transações previstas e realizadas
          </Text>
        </View>

        {/* Mini Cards Grid (Receitas e Despesas) */}
        <View style={styles.metricsRow}>
          {/* Receitas */}
          <View style={[styles.metricCard, { borderColor: theme.colors.incomeMuted }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: theme.colors.incomeMuted }]}>
                <TrendingUp size={16} color={theme.colors.income} />
              </View>
              <Text style={styles.metricLabel}>RECEITAS</Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.income }]}>
              {formatCurrency(totals.receitas)}
            </Text>
          </View>

          {/* Despesas */}
          <View style={[styles.metricCard, { borderColor: theme.colors.expenseMuted }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: theme.colors.expenseMuted }]}>
                <TrendingDown size={16} color={theme.colors.expense} />
              </View>
              <Text style={styles.metricLabel}>DESPESAS</Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.expense }]}>
              {formatCurrency(totals.despesas)}
            </Text>
          </View>
        </View>

        {/* Seção Contas Bancárias */}
        {accounts.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Contas & Saldos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsScroll}
            >
              {accounts.map((acc) => (
                <View key={acc.id} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <Building size={16} color={acc.color || theme.colors.primary} />
                    <Text style={styles.accountBank}>{acc.bank}</Text>
                  </View>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountBalance}>{formatCurrency(acc.initialBalance)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Transações Recentes */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Próximos Vencimentos</Text>
            <Text style={styles.sectionSubtitle}>{movements.length} no total</Text>
          </View>

          {movements.slice(0, 5).map((mov) => {
            const isIncome = mov.type === 'RECEBER';
            const isLoan = mov.type === 'EMPRESTIMO';
            const isCard = mov.type === 'CARTAO';

            let typeColor = theme.colors.expense;
            let typeBg = theme.colors.expenseMuted;
            if (isIncome) {
              typeColor = theme.colors.income;
              typeBg = theme.colors.incomeMuted;
            } else if (isLoan) {
              typeColor = theme.colors.loan;
              typeBg = theme.colors.loanMuted;
            } else if (isCard) {
              typeColor = theme.colors.card;
              typeBg = theme.colors.cardMuted;
            }

            return (
              <View key={mov.id} style={styles.movementItem}>
                <View style={[styles.movementIconBox, { backgroundColor: typeBg }]}>
                  {isCard ? (
                    <CreditCard size={18} color={typeColor} />
                  ) : (
                    <Calendar size={18} color={typeColor} />
                  )}
                </View>
                <View style={styles.movementInfo}>
                  <Text style={styles.movementTitle} numberOfLines={1}>
                    {mov.title}
                  </Text>
                  <Text style={styles.movementMeta}>
                    {mov.bank} • {mov.dueDate}
                    {mov.installmentsTotal && mov.installmentsTotal > 1
                      ? ` • ${mov.installmentNumber}/${mov.installmentsTotal}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.movementAmountBox}>
                  <Text style={[styles.movementAmount, { color: typeColor }]}>
                    {isIncome ? '+' : '-'} {formatCurrency(mov.amount)}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      mov.status === 'REALIZADA' ? styles.statusPaid : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        mov.status === 'REALIZADA'
                          ? { color: theme.colors.income }
                          : { color: theme.colors.textMuted },
                      ]}
                    >
                      {mov.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  heroIconBox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginVertical: 4,
  },
  heroFooter: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricIconBox: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  accountsScroll: {
    gap: theme.spacing.md,
    paddingVertical: 4,
  },
  accountCard: {
    width: 150,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  accountBank: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  movementIconBox: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  movementInfo: {
    flex: 1,
  },
  movementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  movementMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  movementAmountBox: {
    alignItems: 'flex-end',
  },
  movementAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginTop: 4,
  },
  statusPaid: {
    backgroundColor: theme.colors.incomeMuted,
  },
  statusPending: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
