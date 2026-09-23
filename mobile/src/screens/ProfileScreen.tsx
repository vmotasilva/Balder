import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Shield,
  Database,
  LogOut,
  ChevronRight,
  Sparkles,
  Smartphone,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Encerrar Sessão',
      'Deseja realmente sair da sua conta no Balder?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={36} color={theme.colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.name || 'Investidor Balder'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'contato@balder.app'}</Text>

          <View style={styles.badgeRow}>
            {user?.isGuest ? (
              <View style={styles.guestBadge}>
                <Sparkles size={12} color={theme.colors.primary} />
                <Text style={styles.guestBadgeText}>Modo Demonstração</Text>
              </View>
            ) : (
              <View style={styles.verifiedBadge}>
                <Shield size={12} color={theme.colors.income} />
                <Text style={styles.verifiedBadgeText}>Supabase RLS Conectado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Informações Técnicas da Sessão */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SISTEMA & INTEGRAÇÕES</Text>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Database size={18} color={theme.colors.primary} />
              <View>
                <Text style={styles.itemTitle}>Backend Supabase Cloud</Text>
                <Text style={styles.itemSubtitle}>PostgreSQL RLS • balder</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.colors.textMuted} />
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Smartphone size={18} color={theme.colors.card} />
              <View>
                <Text style={styles.itemTitle}>Balder Mobile Engine</Text>
                <Text style={styles.itemSubtitle}>Expo SDK 57 • React Native 0.86</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.colors.textMuted} />
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Shield size={18} color={theme.colors.income} />
              <View>
                <Text style={styles.itemTitle}>Segurança de Dados</Text>
                <Text style={styles.itemSubtitle}>Document-Level Security (DLS) ativo</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.colors.textMuted} />
          </View>
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={18} color={theme.colors.expense} />
          <Text style={styles.logoutText}>Desconectar Conta</Text>
        </TouchableOpacity>
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  guestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.incomeMuted,
    borderWidth: 1,
    borderColor: theme.colors.income,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.income,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  itemSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.expenseMuted,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.expense,
    height: 48,
    marginTop: theme.spacing.md,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.expense,
  },
});
