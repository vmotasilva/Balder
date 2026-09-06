import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Query, Models } from 'react-native-appwrite';
import { databases, APPWRITE_DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
export interface Workspace extends Models.Document {
  name: string;
  type: 'family' | 'business';
  created_at?: string;
}

export interface FixedAnchor extends Models.Document {
  workspace_id: string;
  name: string;
  expected_amount: number;
  category: string;
  periodicity?: 'monthly' | 'annual' | 'variable_season' | string;
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
// Component: DashboardScreen
// -----------------------------------------------------------------------------
export default function DashboardScreen() {
  const { user, logout } = useAuth();

  // State Management
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [anchors, setAnchors] = useState<FixedAnchor[]>([]);

  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(true);
  const [isLoadingAnchors, setIsLoadingAnchors] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Workspaces from Appwrite
  const fetchWorkspaces = async () => {
    try {
      setErrorMessage(null);
      const response = await databases.listDocuments<Workspace>(
        APPWRITE_DATABASE_ID,
        COLLECTIONS.WORKSPACES,
        [Query.limit(20)]
      );

      const docs = response.documents;
      setWorkspaces(docs);

      if (docs.length > 0) {
        // Padrão: prioriza o workspace do tipo 'family' ou seleciona o primeiro
        const defaultWs = docs.find((ws) => ws.type === 'family') || docs[0];
        setSelectedWorkspace((prev) => (prev ? prev : defaultWs.$id));
      }
    } catch (err: any) {
      console.error('Erro ao buscar workspaces:', err);
      setErrorMessage(
        err?.message || 'Falha na conexão com o Appwrite ao carregar os workspaces.'
      );
    } finally {
      setIsLoadingWorkspaces(false);
      setIsRefreshing(false);
    }
  };

  // 2. Fetch Fixed Anchors for the selected Workspace
  const fetchAnchors = async (workspaceId: string) => {
    if (!workspaceId) return;

    try {
      setIsLoadingAnchors(true);
      setErrorMessage(null);

      const response = await databases.listDocuments<FixedAnchor>(
        APPWRITE_DATABASE_ID,
        COLLECTIONS.FIXED_ANCHORS,
        [
          Query.equal('workspace_id', workspaceId),
          Query.limit(100),
        ]
      );

      setAnchors(response.documents);
    } catch (err: any) {
      console.error('Erro ao buscar âncoras fixas:', err);
      setErrorMessage(
        err?.message || 'Falha ao carregar as âncoras fixas do workspace.'
      );
    } finally {
      setIsLoadingAnchors(false);
      setIsRefreshing(false);
    }
  };

  // Lifecycle: Load workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Lifecycle: Load anchors whenever selectedWorkspace changes
  useEffect(() => {
    if (selectedWorkspace) {
      fetchAnchors(selectedWorkspace);
    }
  }, [selectedWorkspace]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWorkspaces();
    if (selectedWorkspace) {
      await fetchAnchors(selectedWorkspace);
    }
  };

  // Active Workspace entity
  const activeWorkspaceObj = workspaces.find((w) => w.$id === selectedWorkspace);

  // Total calculated expected amount
  const totalAnchorsAmount = anchors.reduce(
    (total, anchor) => total + (anchor.expected_amount || 0),
    0
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#38BDF8"
            colors={['#38BDF8']}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandTitle}>BALDER</Text>
            <Text style={styles.headerSubtitle}>
              {user?.email || (user?.name ? user.name : 'Sessão Ativa')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Sair ↪</Text>
          </TouchableOpacity>
        </View>

        {/* Error Alert */}
        {errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Chaveador Dinâmico de Contexto */}
        <View style={styles.contextSwitchCard}>
          <View style={styles.switchHeaderRow}>
            <Text style={styles.contextSectionLabel}>
              CHAVEADOR DE CONTEXTO (WORKSPACES)
            </Text>
            {isLoadingWorkspaces && (
              <ActivityIndicator size="small" color="#38BDF8" />
            )}
          </View>

          <Text style={styles.contextHintText}>
            Selecione o workspace para alternar orçamentos e despesas inegociáveis:
          </Text>

          {isLoadingWorkspaces && workspaces.length === 0 ? (
            <View style={styles.loadingPlaceholder}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.loadingPlaceholderText}>
                Carregando workspaces...
              </Text>
            </View>
          ) : (
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
          )}

          {activeWorkspaceObj && (
            <View style={styles.badgeRow}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  Workspace Ativo: {activeWorkspaceObj.name}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* KPI Card */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Âncoras Fixas & Despesas Inegociáveis</Text>
          {isLoadingAnchors ? (
            <View style={styles.kpiLoadingRow}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.kpiLoadingText}>Calculando âncoras...</Text>
            </View>
          ) : (
            <Text style={styles.kpiValue}>
              {formatCurrencyBRL(totalAnchorsAmount)}
              <Text style={styles.kpiPeriod}> / mês</Text>
            </Text>
          )}
          <Text style={styles.kpiStatus}>
            ✓ {anchors.length} despesas monitoradas pela IA no Appwrite
          </Text>
        </View>

        {/* AI Audit Status Widget */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeaderRow}>
            <Text style={styles.aiTitle}>🤖 Auditoria Contínua IA</Text>
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>ATIVO</Text>
            </View>
          </View>
          <Text style={styles.aiDescription}>
            Transações recebidas via Open Finance são confrontadas com as {anchors.length} âncoras ativas deste workspace.
          </Text>
        </View>

        {/* Anchors Section */}
        <View style={styles.anchorsSectionHeader}>
          <Text style={styles.anchorsSectionTitle}>
            Despesas e Orçamentos Fixos
          </Text>
          <Text style={styles.anchorsCountBadge}>{anchors.length}</Text>
        </View>

        {/* Anchors List */}
        {isLoadingAnchors ? (
          <View style={styles.anchorsLoadingContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.anchorsLoadingText}>
              Sincronizando âncoras com o Appwrite...
            </Text>
          </View>
        ) : anchors.length === 0 ? (
          <View style={styles.emptyAnchorsCard}>
            <Text style={styles.emptyAnchorsIcon}>📋</Text>
            <Text style={styles.emptyAnchorsTitle}>Nenhuma âncora cadastrada</Text>
            <Text style={styles.emptyAnchorsText}>
              Este workspace ainda não possui âncoras fixas registradas no Appwrite.
            </Text>
          </View>
        ) : (
          anchors.map((anchor) => (
            <View key={anchor.$id} style={styles.anchorCard}>
              <View style={styles.anchorLeftCol}>
                <Text style={styles.anchorName}>{anchor.name}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {anchor.category}
                  </Text>
                </View>
              </View>
              <View style={styles.anchorRightCol}>
                <Text style={styles.anchorAmount}>
                  {formatCurrencyBRL(anchor.expected_amount || 0)}
                </Text>
                <Text style={styles.periodicityText}>
                  {anchor.periodicity === 'annual'
                    ? 'Anual'
                    : anchor.periodicity === 'variable_season'
                    ? 'Variável'
                    : 'Mensal'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#38BDF8',
    marginTop: 4,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutButtonText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451A1A',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  contextSwitchCard: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  switchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contextSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  contextHintText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingPlaceholderText: {
    color: '#94A3B8',
    fontSize: 13,
    marginLeft: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
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
  badgeRow: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  activeBadge: {
    backgroundColor: '#0C2A44',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  activeBadgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  kpiCard: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  kpiLoadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginLeft: 8,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 6,
  },
  kpiPeriod: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  kpiStatus: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '500',
  },
  aiCard: {
    backgroundColor: '#111E38',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  onlinePill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlinePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
  },
  aiDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  anchorsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  anchorsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  anchorsCountBadge: {
    backgroundColor: '#1E293B',
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  anchorsLoadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  anchorsLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 10,
  },
  emptyAnchorsCard: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyAnchorsIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyAnchorsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  emptyAnchorsText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  anchorCard: {
    backgroundColor: '#131D33',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  anchorLeftCol: {
    flex: 1,
    marginRight: 12,
  },
  anchorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  anchorRightCol: {
    alignItems: 'flex-end',
  },
  anchorAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 2,
  },
  periodicityText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
