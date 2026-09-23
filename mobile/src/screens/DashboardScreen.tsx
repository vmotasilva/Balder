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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  RotateCw,
  CreditCard,
  Building,
  Calendar,
  PieChart,
  Landmark,
  Briefcase,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useFinancial } from '../context/FinancialContext';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../theme';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    movements,
    accounts,
    totals,
    isLoading,
    refreshFinancialData,
    toggleMovementStatus,
    activeCheckpoint,
  } = useFinancial();

  // Próximos vencimentos pendentes primeiro
  const sortedMovements = [...movements].sort((a, b) => {
    if (a.status === 'PREVISTA' && b.status === 'REALIZADA') return -1;
    if (a.status === 'REALIZADA' && b.status === 'PREVISTA') return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

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
            <Text style={styles.greetingTitle}>
              Olá, {user?.name?.split(' ')[0] || 'Investidor'}
            </Text>
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
            <Text style={styles.heroLabel}>SALDO PROJETADO EM CAIXA</Text>
          </View>
          <Text style={styles.heroValue}>{formatCurrency(totals.saldoPrevisto)}</Text>
          <Text style={styles.heroFooter}>
            Baseado no saldo em contas (+ R$ {totals.receitas.toFixed(2)}) e despesas (- R${' '}
            {totals.despesas.toFixed(2)})
          </Text>
        </View>

        {/* Mini Cards Grid (Receitas e Despesas) */}
        <View style={styles.metricsRow}>
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

        {/* Atalhos Rápidos para Módulos */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
          <View style={styles.shortcutsGrid}>
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Naturezas')}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <PieChart size={18} color="#06B6D4" />
              </View>
              <Text style={styles.shortcutText}>Naturezas & Tetos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Invoices')}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <CreditCard size={18} color="#A855F7" />
              </View>
              <Text style={styles.shortcutText}>Faturas & Cartões</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Loans')}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Landmark size={18} color="#F59E0B" />
              </View>
              <Text style={styles.shortcutText}>Empréstimos PRICE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('SalaryContracts')}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Briefcase size={18} color="#10B981" />
              </View>
              <Text style={styles.shortcutText}>Salários & Renda</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Seção Contas Bancárias */}
        {accounts.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Contas & Saldos</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
                <Text style={styles.viewAllText}>Ver todas</Text>
              </TouchableOpacity>
            </View>

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
                  <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Transações Recentes com 1-touch toggle */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Próximos Vencimentos</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Movements')}>
              <Text style={styles.viewAllText}>Ver extrato</Text>
            </TouchableOpacity>
          </View>

          {sortedMovements.slice(0, 6).map((mov) => {
            const isIncome = mov.type === 'RECEITA' || mov.type === 'RECEBER';
            const isLoan = mov.type === 'EMPRESTIMO';
            const isPaid = mov.status === 'REALIZADA';

            let typeColor = theme.colors.expense;
            let typeBg = theme.colors.expenseMuted;
            if (isIncome) {
              typeColor = theme.colors.income;
              typeBg = theme.colors.incomeMuted;
            } else if (isLoan) {
              typeColor = theme.colors.loan;
              typeBg = theme.colors.loanMuted;
            }

            return (
              <View key={mov.id} style={styles.movementItem}>
                <TouchableOpacity
                  style={[styles.movementIconBox, { backgroundColor: typeBg }]}
                  onPress={() => toggleMovementStatus(mov.id)}
                >
                  {isPaid ? (
                    <CheckCircle2 size={18} color="#10B981" />
                  ) : (
                    <Clock size={18} color={typeColor} />
                  )}
                </TouchableOpacity>

                <View style={styles.movementInfo}>
                  <Text style={styles.movementTitle} numberOfLines={1}>
                    {mov.title}
                  </Text>
                  <Text style={styles.movementMeta}>
                    {mov.bank} • Venc: {mov.dueDate.split('-').reverse().join('/')}
                    {mov.installmentsTotal && mov.installmentsTotal > 1
                      ? ` • ${mov.installmentNumber}/${mov.installmentsTotal}`
                      : ''}
                  </Text>
                </View>

                <View style={styles.movementAmountBox}>
                  <Text style={[styles.movementAmount, { color: isIncome ? '#10B981' : '#F43F5E' }]}>
                    {isIncome ? '+' : '-'} {formatCurrency(mov.amount)}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      isPaid ? styles.statusPaid : styles.statusPending,
                    ]}
                    onPress={() => toggleMovementStatus(mov.id)}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isPaid ? { color: theme.colors.income } : { color: theme.colors.loan },
                      ]}
                    >
                      {isPaid ? 'Pago' : 'Pendente'}
                    </Text>
                  </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  heroFooter: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  shortcutsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shortcutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  accountsScroll: {
    gap: 12,
  },
  accountCard: {
    width: 140,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  accountBank: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.income,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  movementIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  movementInfo: {
    flex: 1,
  },
  movementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  movementMeta: {
    fontSize: 11,
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
    borderRadius: 4,
    marginTop: 4,
  },
  statusPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
