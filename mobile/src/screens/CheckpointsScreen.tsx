import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {
  Flag,
  Calendar,
  CheckCircle2,
  Trash2,
  Plus,
  TrendingUp,
  ShieldCheck,
  X,
  CreditCard,
  Building,
  ArrowRight,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import type { Checkpoint } from '../types';

export const CheckpointsScreen: React.FC = () => {
  const {
    checkpoints,
    activeCheckpoint,
    activateCheckpoint,
    addCheckpoint,
    deleteCheckpoint,
    accounts,
    cards,
  } = useFinancial();

  const [modalVisible, setModalVisible] = useState(false);
  const [chkDate, setChkDate] = useState(new Date().toISOString().split('T')[0]);
  const [chkTitle, setChkTitle] = useState('Novo Marco Patrimonial');
  const [accountBalances, setAccountBalances] = useState<Record<string, string>>({});
  const [cardDebts, setCardDebts] = useState<Record<string, string>>({});

  const handleOpenNewCheckpoint = () => {
    setChkDate(new Date().toISOString().split('T')[0]);
    setChkTitle(`Marco ${new Date().toLocaleDateString('pt-BR')}`);

    const initAccs: Record<string, string> = {};
    accounts.forEach((a) => {
      initAccs[a.id] = String(a.balance || 0);
    });
    setAccountBalances(initAccs);

    const initCards: Record<string, string> = {};
    cards.forEach((c) => {
      initCards[c.id] = '0';
    });
    setCardDebts(initCards);

    setModalVisible(true);
  };

  const handleSaveCheckpoint = async () => {
    const accList = accounts.map((a) => ({
      accountId: a.id,
      accountName: a.name,
      balance: parseFloat(accountBalances[a.id] || '0') || 0,
    }));

    const cardList = cards.map((c) => ({
      cardId: c.id,
      cardName: c.name,
      invoiceAmount: parseFloat(cardDebts[c.id] || '0') || 0,
    }));

    const totalAssets = accList.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = cardList.reduce((s, c) => s + c.invoiceAmount, 0);
    const netWorth = totalAssets - totalLiabilities;

    try {
      await addCheckpoint({
        title: chkTitle.trim() || 'Marco de Abertura',
        date: chkDate,
        totalAssets,
        totalLiabilities,
        netWorth,
        accounts: accList,
        cardDebts: cardList,
        isActive: true,
      });
      setModalVisible(false);
      Alert.alert('Sucesso', 'Novo marco patrimonial ativado com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o marco.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Flag size={24} color="#06B6D4" />
          <Text style={styles.headerTitle}>Marcos Patrimoniais</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={handleOpenNewCheckpoint}>
          <Plus size={16} color="#0B0F17" />
          <Text style={styles.newBtnText}>Novo Marco</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Explicativo */}
        <View style={styles.infoBox}>
          <ShieldCheck size={20} color="#06B6D4" />
          <Text style={styles.infoText}>
            Um Marco Patrimonial fixa uma data de calibração oficial, consolidando saldos de todas as contas e dívidas de cartão para garantir projeções futuras 100% fidedignas.
          </Text>
        </View>

        {/* Marco Ativo Atual */}
        {activeCheckpoint && (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={18} color="#10B981" />
                <Text style={styles.activeBadgeText}>MARCO ATIVO NO SISTEMA</Text>
              </View>
              <Text style={styles.activeDate}>
                {(activeCheckpoint.date || activeCheckpoint.startDate || '').split('-').reverse().join('/')}
              </Text>
            </View>

            <Text style={styles.activeTitle}>{activeCheckpoint.title || activeCheckpoint.label || 'Marco Inicial'}</Text>

            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiItemLabel}>Ativos em Contas</Text>
                <Text style={styles.kpiItemValGreen}>
                  R$ {(activeCheckpoint.totalAssets ?? activeCheckpoint.initialBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiItemLabel}>Faturas Abertas</Text>
                <Text style={styles.kpiItemValRed}>
                  R$ {(activeCheckpoint.totalLiabilities ?? activeCheckpoint.creditCardDebt ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiItemLabel}>Patrimônio Líquido</Text>
                <Text style={styles.kpiItemValCyan}>
                  R$ {(activeCheckpoint.netWorth ?? activeCheckpoint.initialNetWorth ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Histórico de Marcos */}
        <Text style={styles.sectionTitle}>Histórico de Marcos Registrados</Text>

        {checkpoints.length === 0 ? (
          <View style={styles.emptyCard}>
            <Flag size={36} color="#64748B" />
            <Text style={styles.emptyTitle}>Nenhum marco registrado</Text>
            <Text style={styles.emptyDesc}>
              Crie o seu primeiro Marco Patrimonial para calibrar o saldo inicial de suas contas e faturas.
            </Text>
          </View>
        ) : (
          checkpoints.map((chk) => {
            const isCurrentActive = activeCheckpoint?.id === chk.id;
            const dateStr = chk.date || chk.startDate || '';
            const totalAssets = chk.totalAssets ?? chk.initialBalance ?? 0;
            const totalLiabilities = chk.totalLiabilities ?? chk.creditCardDebt ?? 0;
            const netWorth = chk.netWorth ?? chk.initialNetWorth ?? (totalAssets - totalLiabilities);

            return (
              <View key={chk.id} style={styles.checkpointCard}>
                <View style={styles.chkCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chkTitle}>{chk.title || chk.label || 'Marco Registrado'}</Text>
                    <Text style={styles.chkDate}>Data: {dateStr.split('-').reverse().join('/')}</Text>
                  </View>
                  {!isCurrentActive ? (
                    <TouchableOpacity
                      style={styles.activateBtn}
                      onPress={() => activateCheckpoint(chk.id)}
                    >
                      <Text style={styles.activateBtnText}>Ativar</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>Ativo</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={{ marginLeft: 8 }}
                    onPress={() => {
                      Alert.alert('Excluir Marco', `Remover o marco ${chk.title || chk.label}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Excluir',
                          style: 'destructive',
                          onPress: () => deleteCheckpoint(chk.id),
                        },
                      ]);
                    }}
                  >
                    <Trash2 size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.chkNumbers}>
                  <Text style={styles.chkNumberText}>
                    Ativos: R$ {totalAssets.toFixed(2)} | Passivos: R$ {totalLiabilities.toFixed(2)}
                  </Text>
                  <Text style={styles.chkNetWorth}>
                    Líquido: R$ {netWorth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Novo Marco */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Marco Patrimonial</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Título do Marco</Text>
              <TextInput
                style={styles.input}
                value={chkTitle}
                onChangeText={setChkTitle}
                placeholder="Ex: Marco de Fechamento Outubro"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.inputLabel}>Data de Referência (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={chkDate}
                onChangeText={setChkDate}
                placeholder="2026-10-01"
                placeholderTextColor="#64748B"
              />

              <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>
                Saldos em Contas Bancárias (R$)
              </Text>
              {accounts.map((a) => (
                <View key={a.id} style={styles.balanceInputRow}>
                  <Text style={styles.balanceInputLabel}>{a.name}:</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={accountBalances[a.id] || ''}
                    onChangeText={(val) =>
                      setAccountBalances((prev) => ({ ...prev, [a.id]: val }))
                    }
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#64748B"
                  />
                </View>
              ))}

              <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>
                Faturas em Aberto nos Cartões (R$)
              </Text>
              {cards.map((c) => (
                <View key={c.id} style={styles.balanceInputRow}>
                  <Text style={styles.balanceInputLabel}>{c.name}:</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={cardDebts[c.id] || ''}
                    onChangeText={(val) =>
                      setCardDebts((prev) => ({ ...prev, [c.id]: val }))
                    }
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#64748B"
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCheckpoint}>
                <Text style={styles.saveBtnText}>Gravar e Ativar Marco</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#06B6D4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0F17',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  activeCard: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginBottom: 20,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  activeDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 6,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiItemLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
  },
  kpiItemValGreen: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  kpiItemValRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F43F5E',
  },
  kpiItemValCyan: {
    fontSize: 12,
    fontWeight: '700',
    color: '#06B6D4',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  checkpointCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  chkDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  activateBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  activateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#06B6D4',
  },
  activePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  chkNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  chkNumberText: {
    fontSize: 11,
    color: '#64748B',
  },
  chkNetWorth: {
    fontSize: 12,
    fontWeight: '700',
    color: '#06B6D4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161F30',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  inputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 10,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06B6D4',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  balanceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceInputLabel: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  smallInput: {
    width: 120,
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 6,
    color: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    textAlign: 'right',
  },
  saveBtn: {
    backgroundColor: '#06B6D4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F17',
  },
});
