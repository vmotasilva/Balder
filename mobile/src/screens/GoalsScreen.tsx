import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, TrendingUp, Plus, Award } from 'lucide-react-native';
import { theme } from '../theme';

interface GoalItem {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
  color: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const GoalsScreen: React.FC = () => {
  const [goals] = useState<GoalItem[]>([
    {
      id: 'g-1',
      title: 'Reserva de Emergência (6 meses)',
      targetAmount: 60000,
      currentAmount: 48500,
      deadline: 'Dez/2026',
      category: 'Segurança',
      color: theme.colors.income,
    },
    {
      id: 'g-2',
      title: 'Aporte de Ações & Fundos Imobiliários',
      targetAmount: 50000,
      currentAmount: 22000,
      deadline: 'Jul/2027',
      category: 'Investimentos',
      color: theme.colors.primary,
    },
    {
      id: 'g-3',
      title: 'Troca de Carro / Entrada Imóvel',
      targetAmount: 80000,
      currentAmount: 35000,
      deadline: 'Nov/2027',
      category: 'Patrimônio',
      color: theme.colors.card,
    },
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Metas & Objetivos</Text>
            <Text style={styles.subtitle}>Acompanhamento da sua evolução patrimonial</Text>
          </View>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.8}>
            <Plus size={18} color={theme.colors.textInverse} />
          </TouchableOpacity>
        </View>

        {goals.map((goal) => {
          const progressPercent = Math.min(
            100,
            Math.round((goal.currentAmount / goal.targetAmount) * 100)
          );

          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: `${goal.color}22` }]}>
                  <Target size={14} color={goal.color} />
                  <Text style={[styles.categoryText, { color: goal.color }]}>{goal.category}</Text>
                </View>
                <Text style={styles.deadlineText}>Prazo: {goal.deadline}</Text>
              </View>

              <Text style={styles.goalTitle}>{goal.title}</Text>

              {/* Barra de Progresso */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: goal.color,
                    },
                  ]}
                />
              </View>

              <View style={styles.goalFooter}>
                <View>
                  <Text style={styles.footerLabel}>ACUMULADO</Text>
                  <Text style={[styles.footerValue, { color: goal.color }]}>
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                </View>
                <View style={styles.rightFooter}>
                  <Text style={styles.footerLabel}>META ({progressPercent}%)</Text>
                  <Text style={styles.footerValue}>{formatCurrency(goal.targetAmount)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.motivationalCard}>
          <Award size={24} color={theme.colors.primary} />
          <View style={styles.motivationalTextContainer}>
            <Text style={styles.motivationalTitle}>Consistência é a Chave</Text>
            <Text style={styles.motivationalSubtitle}>
              Seu patrimônio projetado cresceu 14.8% no último trimestre com o controle de despesas do Balder.
            </Text>
          </View>
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deadlineText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightFooter: {
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  motivationalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  motivationalTextContainer: {
    flex: 1,
  },
  motivationalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  motivationalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
