import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

// Tab Navigator Type Definitions
export type RootTabParamList = {
  Dashboard: undefined;
  Transações: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// -----------------------------------------------------------------------------
// Placeholder Screen: Dashboard
// -----------------------------------------------------------------------------
function DashboardScreen() {
  const { user, logout } = useAuth();
  const [activeContext, setActiveContext] = useState<'family' | 'business'>('family');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView contentContainerStyle={styles.container}>
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

        {/* Chaveador de Contexto (Pessoal vs. Empresarial) */}
        <View style={styles.contextSwitchCard}>
          <Text style={styles.contextSectionLabel}>
            CHAVEADOR DE CONTEXTO (PESSOAL VS. EMPRESARIAL)
          </Text>
          <Text style={styles.contextHintText}>
            Selecione o workspace ativo para alternar visões orçamentárias e âncoras fixas:
          </Text>

          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[
                styles.switchButton,
                activeContext === 'family' && styles.switchButtonActive,
              ]}
              onPress={() => setActiveContext('family')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.switchButtonText,
                  activeContext === 'family' && styles.switchButtonTextActive,
                ]}
              >
                👤 Pessoal / Familiar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.switchButton,
                activeContext === 'business' && styles.switchButtonActive,
              ]}
              onPress={() => setActiveContext('business')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.switchButtonText,
                  activeContext === 'business' && styles.switchButtonTextActive,
                ]}
              >
                🏢 Empresarial / Negócios
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                Workspace Ativo: {activeContext === 'family' ? 'Família Mota Silva' : 'Dínamo / Negócios'}
              </Text>
            </View>
          </View>
        </View>

        {/* KPI Preview Card */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Âncoras Fixas & Despesas Inegociáveis</Text>
          <Text style={styles.kpiValue}>
            {activeContext === 'family' ? 'R$ 8.030,07 / mês' : 'R$ 513.152,13 / mês'}
          </Text>
          <Text style={styles.kpiStatus}>
            ✓ 100% monitorado pela IA via Open Finance
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
            Transações recebidas via Open Finance são comparadas automaticamente às âncoras do workspace selecionado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Placeholder Screen: Transações
// -----------------------------------------------------------------------------
function TransactionsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>TRANSAÇÕES</Text>
          <Text style={styles.headerSubtitle}>Open Finance & Histórico Auditado</Text>
        </View>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardIcon}>⚡</Text>
          <Text style={styles.emptyCardTitle}>Stream de Transações em Tempo Real</Text>
          <Text style={styles.emptyCardDescription}>
            As transações bancárias sincronizadas pelo webhook da API aparecerão aqui com score de confiança e análise de anomalias da IA.
          </Text>
        </View>

        <View style={styles.previewTransactionCard}>
          <View style={styles.previewTransHeader}>
            <Text style={styles.previewTransVendor}>Pix Pagamento Aluguel Apartamento</Text>
            <Text style={styles.previewTransAmount}>- R$ 2.500,00</Text>
          </View>
          <Text style={styles.previewTransDate}>05/09/2026 • Moradia / Habitação</Text>
          <View style={styles.auditBadge}>
            <Text style={styles.auditBadgeText}>✓ Em conformidade com Âncora Fixa (96% confiança)</Text>
          </View>
        </View>

        <View style={styles.previewTransactionCard}>
          <View style={styles.previewTransHeader}>
            <Text style={styles.previewTransVendor}>Aluguel Apartamento - Taxas</Text>
            <Text style={[styles.previewTransAmount, { color: '#F87171' }]}>- R$ 3.500,00</Text>
          </View>
          <Text style={styles.previewTransDate}>05/09/2026 • Desvio Detectado</Text>
          <View style={[styles.auditBadge, { backgroundColor: '#451A1A' }]}>
            <Text style={[styles.auditBadgeText, { color: '#FCA5A5' }]}>⚠️ Alerta IA: Desvio de 40% sobre o orçado</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Bottom Tab Navigator Component
// -----------------------------------------------------------------------------
export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Transações"
        component={TransactionsScreen}
        options={{
          tabBarLabel: 'Transações',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💳</Text>
          ),
        }}
      />
    </Tab.Navigator>
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
  },
  header: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  contextSwitchCard: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  contextSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  contextHintText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  switchButtonActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  switchButtonText: {
    fontSize: 13,
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
    fontSize: 12,
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
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 6,
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
  emptyCard: {
    backgroundColor: '#131D33',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyCardIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyCardDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  previewTransactionCard: {
    backgroundColor: '#131D33',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  previewTransHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTransVendor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  previewTransAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginLeft: 8,
  },
  previewTransDate: {
    fontSize: 12,
    color: '#64748B',
    marginVertical: 4,
  },
  auditBadge: {
    backgroundColor: '#062C22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  auditBadgeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
});
