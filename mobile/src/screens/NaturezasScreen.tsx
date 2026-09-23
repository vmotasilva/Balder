import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PieChart,
  Plus,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  X,
  Layers,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import { theme } from '../theme';
import { ExpenseNature } from '../types';

export const NaturezasScreen: React.FC = () => {
  const { natures, movements, addNature, deleteNature } = useFinancial();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [type, setType] = useState<'FIXA' | 'VARIAVEL' | 'ESSENCIAL'>('FIXA');
  const [color, setColor] = useState('#3B82F6');

  // Calcula gastos realizados por natureza no mês
  const spendingByNature = useMemo(() => {
    const map: Record<string, number> = {};
    movements.forEach((m) => {
      if (m.type === 'PAGAR' || m.type === 'CARTAO') {
        const cat = m.category || 'Geral';
        map[cat] = (map[cat] || 0) + m.amount;
      }
    });
    return map;
  }, [movements]);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe o nome da categoria / natureza.');
      return;
    }
    const numBudget = parseFloat(budget.replace(',', '.')) || 0;
    await addNature({
      name: name.trim(),
      color,
      icon: 'Tag',
      type,
      initialBudget: numBudget,
      description: 'Criado via app mobile',
      justificationHistory: [],
    });
    setName('');
    setBudget('');
    setModalVisible(false);
  };

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>PLANEJAMENTO DE GASTOS</Text>
          <Text style={styles.headerTitle}>Naturezas Orçamentárias</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={18} color="#0B0F17" />
          <Text style={styles.addButtonText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner de Controle de Teto */}
        <View style={styles.infoBanner}>
          <Layers size={20} color={theme.colors.primary} />
          <View style={styles.infoBannerTextContainer}>
            <Text style={styles.infoBannerTitle}>Tetos e Mapeamentos Fixos</Text>
            <Text style={styles.infoBannerDesc}>
              Acompanhe o consumo das suas categorias e garanta que os gastos fiquem dentro do teto.
            </Text>
          </View>
        </View>

        {/* Lista de Naturezas */}
        {natures.map((nat) => {
          const spent = spendingByNature[nat.name] || 0;
          const ceiling = nat.initialBudget || 0;
          const percent = ceiling > 0 ? Math.min(Math.round((spent / ceiling) * 100), 100) : 0;
          const isOver = ceiling > 0 && spent > ceiling;

          return (
            <View key={nat.id} style={styles.natureCard}>
              <View style={styles.natureCardHeader}>
                <View style={styles.natureNameRow}>
                  <View style={[styles.colorIndicator, { backgroundColor: nat.color || '#3B82F6' }]} />
                  <View>
                    <Text style={styles.natureTitle}>{nat.name}</Text>
                    <Text style={styles.natureBadge}>{nat.type}</Text>
                  </View>
                </View>
                <View style={styles.valuesCol}>
                  <Text style={styles.spentValue}>
                    {spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                  <Text style={styles.ceilingText}>
                    Teto: {ceiling > 0 ? ceiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Livre'}
                  </Text>
                </View>
              </View>

              {/* Barra de Progresso do Teto */}
              {ceiling > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${percent}%`,
                          backgroundColor: isOver ? theme.colors.expense : nat.color || theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressFooter}>
                    <View style={styles.statusRow}>
                      {isOver ? (
                        <>
                          <AlertCircle size={12} color={theme.colors.expense} />
                          <Text style={[styles.statusText, { color: theme.colors.expense }]}>
                            Teto Ultrapassado ({(spent - ceiling).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </Text>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} color={theme.colors.income} />
                          <Text style={styles.statusText}>{percent}% utilizado</Text>
                        </>
                      )}
                    </View>
                    <Text style={styles.statusText}>
                      Resta {(Math.max(0, ceiling - spent)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Rotinas Mapeadas vinculadas */}
              {nat.mappings && nat.mappings.length > 0 && (
                <View style={styles.mappingsList}>
                  <Text style={styles.mappingsTitle}>ROTINAS MAPEADAS</Text>
                  {nat.mappings.map((map) => (
                    <View key={map.id} style={styles.mappingItem}>
                      <ShoppingBag size={14} color={theme.colors.textMuted} />
                      <Text style={styles.mappingName}>{map.name}</Text>
                      <Text style={styles.mappingFreq}>{map.frequency || 'MENSAL'}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Modal Nova Natureza */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Natureza Orçamentária</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome da Categoria / Natureza</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Alimentação, Educação, Lazer..."
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Teto Orçamentário Mensal (R$)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2500,00 (Opcional)"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={budget}
              onChangeText={setBudget}
            />

            <Text style={styles.inputLabel}>Tipo de Custo</Text>
            <View style={styles.typeSelector}>
              {(['FIXA', 'VARIAVEL', 'ESSENCIAL'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeButton, type === t && styles.typeButtonActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Cor de Identificação</Text>
            <View style={styles.colorPalette}>
              {colors.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorBall,
                    { backgroundColor: c },
                    color === c && styles.colorBallSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleCreate}>
              <Text style={styles.confirmButtonText}>Salvar Natureza</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B0F17',
  },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderHighlight,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  infoBannerTextContainer: { flex: 1 },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  infoBannerDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  natureCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
  },
  natureCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  natureNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorIndicator: { width: 10, height: 36, borderRadius: 3 },
  natureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  natureBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  valuesCol: { alignItems: 'flex-end' },
  spentValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  ceilingText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  progressContainer: { gap: 6 },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, color: theme.colors.textSecondary },
  mappingsList: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  mappingsTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.colors.textMuted,
  },
  mappingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  mappingName: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  mappingFreq: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeButtonTextActive: { color: theme.colors.primary },
  colorPalette: { flexDirection: 'row', gap: 12, marginVertical: 6 },
  colorBall: { width: 28, height: 28, borderRadius: 14 },
  colorBallSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B0F17',
  },
});
