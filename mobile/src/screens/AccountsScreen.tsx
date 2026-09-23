import React, { useState, useMemo } from 'react';
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
  Wallet,
  CreditCard,
  Building,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  X,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';
import type { Account, Card } from '../types';

export const AccountsScreen: React.FC = () => {
  const {
    accounts,
    cards,
    addAccount,
    deleteAccount,
    addCard,
    deleteCard,
    movements,
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'CARDS'>('ACCOUNTS');

  // Modal Conta
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBank, setAccBank] = useState('Nubank');
  const [accType, setAccType] = useState<'CHECKING' | 'INVESTMENT' | 'CASH'>('CHECKING');
  const [accBalance, setAccBalance] = useState('');

  // Modal Cartão
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('Nubank');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('25');
  const [cardDueDay, setCardDueDay] = useState('5');
  const [cardColor, setCardColor] = useState('#8B5CF6');

  // Totais
  const totalAccountBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  }, [accounts]);

  const totalCardLimit = useMemo(() => {
    return cards.reduce((sum, c) => sum + c.limit, 0);
  }, [cards]);

  // Salvar Conta
  const handleSaveAccount = async () => {
    const bal = parseFloat(accBalance);
    if (!accName.trim() || isNaN(bal)) {
      Alert.alert('Atenção', 'Informe o nome e o saldo inicial da conta.');
      return;
    }

    try {
      await addAccount({
        name: accName.trim(),
        bank: accBank.trim(),
        type: accType,
        balance: bal,
        color: accType === 'INVESTMENT' ? '#10B981' : '#06B6D4',
      });
      setAccountModalVisible(false);
      Alert.alert('Sucesso', 'Conta bancária criada com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conta.');
    }
  };

  // Salvar Cartão
  const handleSaveCard = async () => {
    const lim = parseFloat(cardLimit);
    if (!cardName.trim() || isNaN(lim) || lim <= 0) {
      Alert.alert('Atenção', 'Informe o nome e o limite do cartão.');
      return;
    }

    try {
      await addCard({
        name: cardName.trim(),
        bank: cardBank.trim(),
        limit: lim,
        closingDay: parseInt(cardClosingDay, 10) || 25,
        dueDay: parseInt(cardDueDay, 10) || 5,
        color: cardColor,
      });
      setCardModalVisible(false);
      Alert.alert('Sucesso', 'Cartão de crédito adicionado!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o cartão.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Wallet size={24} color="#06B6D4" />
          <Text style={styles.headerTitle}>Contas & Cartões</Text>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'ACCOUNTS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('ACCOUNTS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'ACCOUNTS' && styles.tabBtnTextActive]}>
              Contas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'CARDS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('CARDS')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'CARDS' && styles.tabBtnTextActive]}>
              Cartões
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'ACCOUNTS' ? (
          /* Aba de Contas */
          <View>
            {/* KPI Balanço */}
            <View style={styles.kpiCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={18} color="#06B6D4" />
                <Text style={styles.kpiLabel}>Patrimônio Líquido em Contas</Text>
              </View>
              <Text style={styles.kpiVal}>
                R$ {totalAccountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.kpiSub}>{accounts.length} conta(s) registradas</Text>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setAccName('');
                  setAccBank('Nubank');
                  setAccType('CHECKING');
                  setAccBalance('0');
                  setAccountModalVisible(true);
                }}
              >
                <Plus size={16} color="#0B0F17" />
                <Text style={styles.actionBtnText}>Adicionar Nova Conta</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Suas Contas Bancárias & Carteiras</Text>

            {accounts.map((acc) => {
              const isInv = acc.type === 'INVESTMENT';
              const isCash = acc.type === 'CASH';
              return (
                <View key={acc.id} style={styles.accountCard}>
                  <View style={styles.accountRow}>
                    <View
                      style={[
                        styles.accountIconBox,
                        { backgroundColor: isInv ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)' },
                      ]}
                    >
                      <Building size={20} color={isInv ? '#10B981' : '#06B6D4'} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.accName}>{acc.name}</Text>
                      <Text style={styles.accSub}>
                        {acc.bank} • {isInv ? 'Investimento' : isCash ? 'Dinheiro Físico' : 'Conta Corrente'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.accBalance}>
                        R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                      <TouchableOpacity
                        style={{ marginTop: 4 }}
                        onPress={() => {
                          Alert.alert('Excluir Conta', `Remover conta ${acc.name}?`, [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Excluir',
                              style: 'destructive',
                              onPress: () => deleteAccount(acc.id),
                            },
                          ]);
                        }}
                      >
                        <Trash2 size={16} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* Aba de Cartões */
          <View>
            {/* KPI Limites */}
            <View style={styles.kpiCardPurple}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CreditCard size={18} color="#A855F7" />
                <Text style={styles.kpiLabelPurple}>Limite Total Concedido</Text>
              </View>
              <Text style={styles.kpiVal}>
                R$ {totalCardLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.kpiSub}>{cards.length} cartão(ões) ativo(s)</Text>

              <TouchableOpacity
                style={styles.actionBtnPurple}
                onPress={() => {
                  setCardName('');
                  setCardBank('Nubank');
                  setCardLimit('5000');
                  setCardClosingDay('25');
                  setCardDueDay('5');
                  setCardColor('#8B5CF6');
                  setCardModalVisible(true);
                }}
              >
                <Plus size={16} color="#0B0F17" />
                <Text style={styles.actionBtnText}>Novo Cartão de Crédito</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Seus Cartões de Crédito</Text>

            {cards.map((card) => {
              // Calcula gastos abertos deste cartão a partir dos movements
              const used = movements
                .filter((m) => m.cardId === card.id && m.status === 'PREVISTA')
                .reduce((s, m) => s + m.amount, 0);

              const available = Math.max(0, card.limit - used);
              const usedPercent = Math.min(100, Math.round((used / (card.limit || 1)) * 100));

              return (
                <View key={card.id} style={styles.creditCardBox}>
                  <View style={styles.creditCardHeader}>
                    <View>
                      <Text style={styles.creditCardBank}>{card.bank}</Text>
                      <Text style={styles.creditCardName}>{card.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Excluir Cartão', `Remover o cartão ${card.name}?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Excluir',
                            style: 'destructive',
                            onPress: () => deleteCard(card.id),
                          },
                        ]);
                      }}
                    >
                      <Trash2 size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.creditCardDates}>
                    <Text style={styles.creditCardDateText}>Fecha dia {card.closingDay}</Text>
                    <Text style={styles.creditCardDateText}>•</Text>
                    <Text style={styles.creditCardDateText}>Vence dia {card.dueDay}</Text>
                  </View>

                  {/* Barra de Limite */}
                  <View style={styles.limitBarTrack}>
                    <View
                      style={[
                        styles.limitBarFill,
                        {
                          width: `${usedPercent}%`,
                          backgroundColor: usedPercent > 80 ? '#F43F5E' : '#A855F7',
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.creditCardFooter}>
                    <View>
                      <Text style={styles.cardFooterLabel}>Fatura Atual</Text>
                      <Text style={styles.cardFooterValRed}>
                        R$ {used.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardFooterLabel}>Limite Disponível</Text>
                      <Text style={styles.cardFooterValGreen}>
                        R$ {available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Nova Conta */}
      <Modal
        visible={accountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Nova Conta</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome da Conta</Text>
            <TextInput
              style={styles.input}
              value={accName}
              onChangeText={setAccName}
              placeholder="Ex: Conta Principal, Reserva de Emergência"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Instituição Financeira</Text>
            <TextInput
              style={styles.input}
              value={accBank}
              onChangeText={setAccBank}
              placeholder="Ex: Nubank, Itaú, Inter, XP"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Tipo de Conta</Text>
            <View style={styles.typeSelector}>
              {(['CHECKING', 'INVESTMENT', 'CASH'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOption, accType === t && styles.typeOptionActive]}
                  onPress={() => setAccType(t)}
                >
                  <Text style={[styles.typeOptionText, accType === t && styles.typeOptionTextActive]}>
                    {t === 'CHECKING' ? 'Corrente' : t === 'INVESTMENT' ? 'Investimento' : 'Dinheiro'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Saldo Inicial (R$)</Text>
            <TextInput
              style={styles.input}
              value={accBalance}
              onChangeText={setAccBalance}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#64748B"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAccount}>
              <Text style={styles.saveBtnText}>Cadastrar Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Cartão */}
      <Modal
        visible={cardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Cartão de Crédito</Text>
              <TouchableOpacity onPress={() => setCardModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome do Cartão</Text>
            <TextInput
              style={styles.input}
              value={cardName}
              onChangeText={setCardName}
              placeholder="Ex: Nubank Ultravioleta, C6 Carbon"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Banco Emissor</Text>
            <TextInput
              style={styles.input}
              value={cardBank}
              onChangeText={setCardBank}
              placeholder="Ex: Nubank, C6 Bank, Santander"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Limite de Crédito Total (R$)</Text>
            <TextInput
              style={styles.input}
              value={cardLimit}
              onChangeText={setCardLimit}
              keyboardType="numeric"
              placeholder="5000.00"
              placeholderTextColor="#64748B"
            />

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Dia de Fechamento</Text>
                <TextInput
                  style={styles.input}
                  value={cardClosingDay}
                  onChangeText={setCardClosingDay}
                  keyboardType="numeric"
                  placeholder="25"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>Dia de Vencimento</Text>
                <TextInput
                  style={styles.input}
                  value={cardDueDay}
                  onChangeText={setCardDueDay}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtnPurple} onPress={handleSaveCard}>
              <Text style={styles.saveBtnText}>Adicionar Cartão</Text>
            </TouchableOpacity>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    padding: 3,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#06B6D4',
  },
  tabBtnText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#0B0F17',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginBottom: 20,
  },
  kpiCardPurple: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    marginBottom: 20,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#06B6D4',
  },
  kpiLabelPurple: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A855F7',
  },
  kpiVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 12,
    color: '#64748B',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#06B6D4',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 14,
  },
  actionBtnPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#A855F7',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 14,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B0F17',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  accSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  accBalance: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  creditCardBox: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  creditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creditCardBank: {
    fontSize: 11,
    color: '#C084FC',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  creditCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  creditCardDates: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  creditCardDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  limitBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  limitBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  creditCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  cardFooterLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardFooterValRed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F43F5E',
    marginTop: 2,
  },
  cardFooterValGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
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
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B0F17',
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  typeOptionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#06B6D4',
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#06B6D4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnPurple: {
    backgroundColor: '#A855F7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F17',
  },
});
