import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  PieChart,
  CreditCard,
  Landmark,
  Briefcase,
  Wallet,
  Flag,
  Sparkles,
  Target,
  Receipt,
  LayoutDashboard,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/RootNavigator';

export const HubScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const hubItems = [
    {
      id: 'Naturezas',
      title: 'Naturezas & Tetos',
      subtitle: 'Controle de tetos de gastos e rotinas de compras',
      icon: PieChart,
      color: '#06B6D4',
      screen: 'Naturezas' as const,
      badge: 'Orçamento',
    },
    {
      id: 'Invoices',
      title: 'Faturas & Cartões',
      subtitle: 'Visão de ciclos, limites e parcelamentos',
      icon: CreditCard,
      color: '#A855F7',
      screen: 'Invoices' as const,
      badge: 'Faturas',
    },
    {
      id: 'Loans',
      title: 'Empréstimos & PRICE',
      subtitle: 'Cronograma PRICE e simulador de quitação com desconto',
      icon: Landmark,
      color: '#F59E0B',
      screen: 'Loans' as const,
      badge: 'Juros BACEN',
    },
    {
      id: 'SalaryContracts',
      title: 'Contratos & Salários',
      subtitle: 'Fontes CLT/PJ, quinzenas e reajustes salariais',
      icon: Briefcase,
      color: '#10B981',
      screen: 'SalaryContracts' as const,
      badge: 'Renda',
    },
    {
      id: 'Accounts',
      title: 'Contas & Carteiras',
      subtitle: 'Saldos bancários, carteiras e cartões vinculados',
      icon: Wallet,
      color: '#3B82F6',
      screen: 'Accounts' as const,
      badge: 'Bancos',
    },
    {
      id: 'Checkpoints',
      title: 'Marcos Patrimoniais',
      subtitle: 'Calibração de patrimônio líquido e ponto de partida',
      icon: Flag,
      color: '#EC4899',
      screen: 'Checkpoints' as const,
      badge: 'Balanço',
    },
    {
      id: 'Goals',
      title: 'Metas Financeiras',
      subtitle: 'Objetivos de poupança, prazos e barras de progresso',
      icon: Target,
      color: '#F97316',
      screen: 'Goals' as const,
      badge: 'Economia',
    },
    {
      id: 'Copilot',
      title: 'Copiloto Balder IA',
      subtitle: 'Assistente inteligente para diagnósticos e perguntas',
      icon: Sparkles,
      color: '#06B6D4',
      screen: 'Copilot' as const,
      badge: 'IA Integrada',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShieldCheck size={24} color="#06B6D4" />
          <Text style={styles.headerTitle}>Módulos Balder</Text>
        </View>
        <Text style={styles.headerVersion}>v2.0 Mobile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="#06B6D4" />
            <Text style={styles.heroLabel}>CENTRAL DE NAVEGAÇÃO</Text>
          </View>
          <Text style={styles.heroTitle}>Todas as Funcionalidades</Text>
          <Text style={styles.heroDesc}>
            Acesse rapidamente todas as janelas do sistema adaptadas para mobile com integridade total aos dados da versão web.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Ferramentas & Gestão</Text>

        {hubItems.map((item) => {
          const IconComp = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.iconBox, { backgroundColor: `${item.color}20` }]}>
                <IconComp size={22} color={item.color} />
              </View>

              <View style={styles.itemInfo}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <View style={[styles.badge, { backgroundColor: `${item.color}25` }]}>
                    <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                  </View>
                </View>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>

              <ChevronRight size={18} color="#64748B" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  headerVersion: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
});
