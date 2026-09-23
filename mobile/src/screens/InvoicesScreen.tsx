import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  Calendar,
  Layers,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import { theme } from '../theme';

export const InvoicesScreen: React.FC = () => {
  const { cards, movements } = useFinancial();
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id || 'card-1');

  const activeCard = useMemo(() => {
    return cards.find((c) => c.id === selectedCardId) || cards[0];
  }, [cards, selectedCardId]);

  // Filtra compras ou movimentações de cartão
  const cardMovements = useMemo(() => {
    return movements.filter((m) => m.type === 'CARTAO');
  }, [movements]);

  // Itens da fatura atual consolidados
  const currentInvoiceItems = useMemo(() => {
    const items: any[] = [];
    cardMovements.forEach((m) => {
      if (m.invoiceBreakdown && m.invoiceBreakdown.length > 0) {
        m.invoiceBreakdown.forEach((item) => items.push(item));
      } else {
        items.push({
          id: m.id,
          natureName: m.category || 'Outros',
          description: m.title,
          amount: m.amount,
          isAnalyzed: true,
        });
      }
    });
    return items;
  }, [cardMovements]);

  const totalInvoiceAmount = useMemo(() => {
    return cardMovements.reduce((acc, m) => acc + m.amount, 0);
  }, [cardMovements]);

  const limitUsed = activeCard?.limitUsed || totalInvoiceAmount;
  const limitTotal = activeCard?.limitTotal || 30000;
  const availableLimit = Math.max(0, limitTotal - limitUsed);
  const limitPercent = Math.min(Math.round((limitUsed / limitTotal) * 100), 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>GESTÃO DE CRÉDITO</Text>
          <Text style={styles.headerTitle}>Faturas de Cartão</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Seletor de Cartões */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {cards.map((card) => {
            const isSelected = card.id === selectedCardId;
            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.cardSelectorItem,
                  isSelected && styles.cardSelectorItemActive,
                  { borderColor: isSelected ? theme.colors.card : theme.colors.border },
                ]}
                onPress={() => setSelectedCardId(card.id)}
              >
                <CreditCard size={18} color={isSelected ? theme.colors.card : theme.colors.textMuted} />
                <View>
                  <Text style={[styles.cardSelectorName, isSelected && styles.cardSelectorNameActive]}>
                    {card.name}
                  </Text>
                  <Text style={styles.cardSelectorSub}>Venc. dia {card.dueDay}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Card Virtual da Fatura Atual */}
        <View style={styles.invoiceHeroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>FATURA ATUAL (SETEMBRO 2026)</Text>
              <Text style={styles.heroAmount}>
                {totalInvoiceAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Clock size={12} color={theme.colors.loan} />
              <Text style={styles.statusBadgeText}>Aberta</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Fechamento</Text>
              <Text style={styles.metaValue}>Dia {activeCard?.closingDay || 3}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Vencimento</Text>
              <Text style={styles.metaValue}>Dia {activeCard?.dueDay || 10}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Bandeira</Text>
              <Text style={styles.metaValue}>{activeCard?.brand || 'VISA'}</Text>
            </View>
          </View>

          {/* Barra de Limite */}
          <View style={styles.limitBarSection}>
            <View style={styles.limitTextRow}>
              <Text style={styles.limitLabel}>Limite Utilizado ({limitPercent}%)</Text>
              <Text style={styles.limitAvailable}>
                Disponível: {availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
            <View style={styles.limitTrack}>
              <View style={[styles.limitFill, { width: `${limitPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Detalhamento por Natureza na Fatura */}
        <View style={styles.sectionHeader}>
          <Layers size={18} color={theme.colors.card} />
          <Text style={styles.sectionTitle}>Detalhamento por Categoria</Text>
        </View>

        <View style={styles.itemsCard}>
          {currentInvoiceItems.map((item, idx) => (
            <View key={item.id || idx} style={styles.invoiceItemRow}>
              <View style={styles.invoiceItemInfo}>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <View style={styles.natureTag}>
                  <Text style={styles.natureTagText}>{item.natureName || 'Geral'}</Text>
                </View>
              </View>
              <Text style={styles.itemAmount}>
                {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.card,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  cardsRow: { gap: 12 },
  cardSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
  },
  cardSelectorItemActive: { backgroundColor: theme.colors.cardMuted },
  cardSelectorName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  cardSelectorNameActive: { color: theme.colors.textPrimary },
  cardSelectorSub: { fontSize: 11, color: theme.colors.textMuted },
  invoiceHeroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderHighlight,
    padding: theme.spacing.xl,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.colors.textSecondary,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.loanMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.loan,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  metaCol: { gap: 2 },
  metaLabel: { fontSize: 10, color: theme.colors.textMuted },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  limitBarSection: { gap: 6 },
  limitTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitLabel: { fontSize: 11, color: theme.colors.textSecondary },
  limitAvailable: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.income,
  },
  limitTrack: {
    height: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  itemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  invoiceItemInfo: { gap: 4 },
  itemDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  natureTag: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    alignSelf: 'flex-start',
  },
  natureTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
});
