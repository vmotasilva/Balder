import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';

// Tab Navigator Type Definitions
export type RootTabParamList = {
  Dashboard: undefined;
  Transações: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// -----------------------------------------------------------------------------
// Screen: Transações (Stream Open Finance & Auditoria IA)
// -----------------------------------------------------------------------------
function TransactionsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
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
