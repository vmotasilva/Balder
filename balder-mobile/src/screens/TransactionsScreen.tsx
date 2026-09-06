import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Query, Models } from 'react-native-appwrite';
import { databases, APPWRITE_DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { useWorkspace } from '../context/WorkspaceContext';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
export interface Transaction extends Models.Document {
  workspace_id: string;
  external_provider_id?: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  predicted_category?: string;
  ai_confidence_score?: number;
  is_anomaly: boolean;
  ai_justification_suggestion?: string;
  user_validated?: boolean;
}

// -----------------------------------------------------------------------------
// Helper: Format currency in BRL (pt-BR)
// -----------------------------------------------------------------------------
function formatCurrencyBRL(value: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

// -----------------------------------------------------------------------------
// Helper: Format Date & Time
// -----------------------------------------------------------------------------
function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

// -----------------------------------------------------------------------------
// Component: TransactionsScreen
// -----------------------------------------------------------------------------
export default function TransactionsScreen() {
  const {
    workspaces,
    selectedWorkspace,
    setSelectedWorkspace,
    activeWorkspace,
    isLoadingWorkspaces,
    fetchWorkspaces,
  } = useWorkspace();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Transactions from Appwrite filtered by selected workspace
  const fetchTransactions = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await databases.listDocuments<Transaction>(
          APPWRITE_DATABASE_ID,
          COLLECTIONS.TRANSACTIONS,
          [
            Query.equal('workspace_id', workspaceId),
            Query.orderDesc('date'),
            Query.limit(50),
          ]
        );

        setTransactions(response.documents);
      } catch (err: any) {
        console.error('Erro ao buscar transações:', err);
        setErrorMessage(
          err?.message || 'Falha ao sincronizar as transações com o Appwrite.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Fetch transactions whenever selectedWorkspace changes
  useEffect(() => {
    if (selectedWorkspace) {
      fetchTransactions(selectedWorkspace);
    }
  }, [selectedWorkspace, fetchTransactions]);

  // Pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWorkspaces();
    if (selectedWorkspace) {
      await fetchTransactions(selectedWorkspace);
    } else {
      setIsRefreshing(false);
    }
  };

  // KPI Metrics Calculation
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const anomalyCount = transactions.filter((t) => t.is_anomaly).length;

  // Render Item for FlatList
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'income';
    const isAnomaly = !!item.is_anomaly;
    const confidencePercent = item.ai_confidence_score != null
      ? Math.round(item.ai_confidence_score * 100)
      : null;

    return (
      <View style={[styles.card, isAnomaly && styles.cardAnomaly]}>
        {/* Top Header Row: Category & Status Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {item.predicted_category || 'Geral'}
            </Text>
          </View>

          {/* Anomaly or Compliance Badge */}
          {isAnomaly ? (
            <View style={styles.anomalyBadge}>
              <Text style={styles.anomalyBadgeText}>⚠️ Anomalia Detectada</Text>
            </View>
          ) : (
            <View style={styles.compliantBadge}>
              <Text style={styles.compliantBadgeText}>✓ Em conformidade</Text>
            </View>
          )}
        </View>

        {/* Main Content: Description, Date & Amount */}
        <View style={styles.cardBodyRow}>
          <View style={styles.descCol}>
            <Text style={styles.descriptionText} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.dateText}>{formatDateTime(item.date)}</Text>
          </View>

          <View style={styles.amountCol}>
            <Text
              style={[
                styles.amountText,
                isIncome ? styles.amountIncome : styles.amountExpense,
              ]}
            >
              {isIncome ? '+ ' : '- '}
              {formatCurrencyBRL(item.amount || 0)}
            </Text>
            <View
              style={[
                styles.typePill,
                isIncome ? styles.typePillIncome : styles.typePillExpense,
              ]}
            >
              <Text
                style={[
                  styles.typePillText,
                  isIncome ? styles.typePillTextIncome : styles.typePillTextExpense,
                ]}
              >
                {isIncome ? 'Receita ↗' : 'Despesa ↘'}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Confidence Score Indicator */}
        {confidencePercent !== null && (
          <View style={styles.aiScoreRow}>
            <Text style={styles.aiScoreLabel}>Score IA:</Text>
            <View style={styles.aiScorePill}>
              <Text style={styles.aiScoreText}>{confidencePercent}% confiança</Text>
            </View>
          </View>
        )}

        {/* AI Justification Suggestion (O Diferencial de Auditoria) */}
        {item.ai_justification_suggestion ? (
          <View
            style={[
              styles.aiJustificationBox,
              isAnomaly
                ? styles.aiJustificationBoxAnomaly
                : styles.aiJustificationBoxNormal,
            ]}
          >
            <View style={styles.aiJustificationHeader}>
              <Text style={styles.aiJustificationIcon}>🤖</Text>
              <Text
                style={[
                  styles.aiJustificationTitle,
                  isAnomaly && styles.aiJustificationTitleAnomaly,
                ]}
              >
                Auditoria de IA & Diagnóstico:
              </Text>
            </View>
            <Text style={styles.aiJustificationText}>
              {item.ai_justification_suggestion}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      {/* Header Fixo */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>TRANSAÇÕES</Text>
        <Text style={styles.headerSubtitle}>
          Open Finance • Fluxo de Caixa & Auditoria IA
        </Text>
      </View>

      {/* Chaveador de Contexto (Workspaces) */}
      <View style={styles.contextSwitchWrapper}>
        <View style={styles.switchContainer}>
          {workspaces.map((ws) => {
            const isActive = ws.$id === selectedWorkspace;
            const isFamily = ws.type === 'family';

            return (
              <TouchableOpacity
                key={ws.$id}
                style={[
                  styles.switchButton,
                  isActive && styles.switchButtonActive,
                ]}
                onPress={() => setSelectedWorkspace(ws.$id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchButtonText,
                    isActive && styles.switchButtonTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {isFamily ? '👤 ' : '🏢 '}
                  {ws.name.includes('(')
                    ? ws.name.split('(')[1].replace(')', '')
                    : ws.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* KPI Highlights Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Receitas</Text>
          <Text style={[styles.kpiValue, { color: '#34D399' }]}>
            {formatCurrencyBRL(totalIncome)}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Despesas</Text>
          <Text style={[styles.kpiValue, { color: '#F87171' }]}>
            {formatCurrencyBRL(totalExpense)}
          </Text>
        </View>

        <View style={[styles.kpiCard, anomalyCount > 0 && styles.kpiCardAlert]}>
          <Text style={styles.kpiLabel}>Anomalias</Text>
          <Text
            style={[
              styles.kpiValue,
              { color: anomalyCount > 0 ? '#F87171' : '#38BDF8' },
            ]}
          >
            {anomalyCount} {anomalyCount === 1 ? 'alerta' : 'alertas'}
          </Text>
        </View>
      </View>

      {/* Error Card */}
      {errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* FlatList de Transações */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>
            Consultando transações Open Finance no Appwrite...
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.$id}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#38BDF8"
              colors={['#38BDF8']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>⚡</Text>
              <Text style={styles.emptyTitle}>Nenhuma transação encontrada</Text>
              <Text style={styles.emptyDescription}>
                Nenhuma movimentação foi registrada ainda para o workspace{' '}
                <Text style={{ color: '#38BDF8' }}>
                  {activeWorkspace?.name || 'ativo'}
                </Text>
                . As novas transações do webhook bancário aparecerão aqui em tempo real.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  contextSwitchWrapper: {
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  switchButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  switchButtonActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  switchButtonTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#131D33',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kpiCardAlert: {
    borderColor: '#7F1D1D',
    backgroundColor: '#201217',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451A1A',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#FCA5A5',
    flex: 1,
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAnomaly: {
    backgroundColor: '#1F1217',
    borderColor: '#EF4444',
    borderWidth: 1.5,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  anomalyBadge: {
    backgroundColor: '#451A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  anomalyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FCA5A5',
  },
  compliantBadge: {
    backgroundColor: '#062C22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669',
  },
  compliantBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#34D399',
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  descCol: {
    flex: 1,
    marginRight: 12,
  },
  descriptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 20,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  amountIncome: {
    color: '#34D399',
  },
  amountExpense: {
    color: '#F8FAFC',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillIncome: {
    backgroundColor: '#062C22',
  },
  typePillExpense: {
    backgroundColor: '#1E293B',
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typePillTextIncome: {
    color: '#34D399',
  },
  typePillTextExpense: {
    color: '#94A3B8',
  },
  aiScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  aiScoreLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  aiScorePill: {
    backgroundColor: '#0C2A44',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  aiScoreText: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '700',
  },
  aiJustificationBox: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
  },
  aiJustificationBoxAnomaly: {
    backgroundColor: '#2A141A',
    borderLeftColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  aiJustificationBoxNormal: {
    backgroundColor: '#0D2036',
    borderLeftColor: '#38BDF8',
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  aiJustificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiJustificationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  aiJustificationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  aiJustificationTitleAnomaly: {
    color: '#F87171',
  },
  aiJustificationText: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 17,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptyContainer: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
});
