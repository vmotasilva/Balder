import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react-native';
import { useFinancial } from '../context/FinancialContext';

interface ChatMessage {
  id: string;
  sender: 'USER' | 'COPILOT';
  text: string;
  timestamp: string;
}

export const CopilotScreen: React.FC = () => {
  const { movements, natures, accounts, cards, salaryContracts, activeCheckpoint } = useFinancial();

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'COPILOT',
      text: 'Olá! Sou o Copiloto Balder, seu assistente de inteligência financeira. Analiso seus gastos, contratos de empréstimo, tetos por natureza e saldo em contas. Como posso ajudar você hoje?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Sugestões rápidas
  const suggestions = [
    'Qual meu saldo previsto para o fim do mês?',
    'Vale a pena antecipar empréstimo agora?',
    'Quais categorias estouraram o teto?',
    'Qual a minha receita garantida de salários?',
  ];

  // Motor de resposta financeira inteligente com base nos dados reais do contexto
  const generateResponse = (query: string): string => {
    const q = query.toLowerCase();

    // 1. Pergunta sobre empréstimos / antecipação
    if (q.includes('empréstimo') || q.includes('antecipar') || q.includes('desconto')) {
      const loanMovements = movements.filter(
        (m) => m.type === 'EMPRESTIMO' && m.status === 'PREVISTA'
      );
      if (loanMovements.length === 0) {
        return 'No momento você não possui parcelas pendentes de empréstimo registradas. Seus contratos estão em dia ou quitados!';
      }
      const totalLoanNominal = loanMovements.reduce((s, m) => s + m.amount, 0);
      return `Você possui ${loanMovements.length} parcelas de empréstimo em aberto, totalizando R$ ${totalLoanNominal.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2 }
      )}. Conforme a Resolução BACEN nº 3.516, antecipar as últimas parcelas pode gerar deságio médio de 15% a 35% nos juros futuros. Acesse a aba 'Empréstimos' para ver a simulação exata!`;
    }

    // 2. Pergunta sobre saldo / previsão do mês
    if (q.includes('saldo') || q.includes('previs') || q.includes('fim do mês')) {
      const currentBalance = accounts.reduce((s, a) => s + a.balance, 0);
      const pendingIncomes = movements
        .filter((m) => m.type === 'RECEITA' && m.status === 'PREVISTA')
        .reduce((s, m) => s + m.amount, 0);
      const pendingExpenses = movements
        .filter((m) => (m.type === 'DESPESA' || m.type === 'EMPRESTIMO') && m.status === 'PREVISTA')
        .reduce((s, m) => s + m.amount, 0);
      const projected = currentBalance + pendingIncomes - pendingExpenses;

      return `📊 Diagnóstico de Fluxo de Caixa:\n• Saldo consolidado em contas: R$ ${currentBalance.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2 }
      )}\n• Receitas a entrar: + R$ ${pendingIncomes.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      })}\n• Contas e faturas a pagar: - R$ ${pendingExpenses.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      })}\n\n🎯 Saldo projetado no fechamento: R$ ${projected.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      })}. ${projected > 0 ? 'Fluxo saudável e positivo!' : 'Atenção: déficit projetado, considere remanejar gastos não essenciais.'}`;
    }

    // 3. Pergunta sobre categorias / tetos
    if (q.includes('teto') || q.includes('categoria') || q.includes('natureza') || q.includes('estour')) {
      const overCeiling: string[] = [];
      natures.forEach((n) => {
        const spent = movements
          .filter((m) => m.nature === n.name && m.type === 'DESPESA')
          .reduce((s, m) => s + m.amount, 0);
        if (n.monthlyCeiling && spent > n.monthlyCeiling) {
          overCeiling.push(
            `• ${n.name}: R$ ${spent.toFixed(2)} gastos de R$ ${n.monthlyCeiling.toFixed(2)} previstos (+${Math.round(
              ((spent - n.monthlyCeiling) / n.monthlyCeiling) * 100
            )}%)`
          );
        }
      });

      if (overCeiling.length === 0) {
        return 'Excelente controle orçamentário! Todas as suas naturezas e categorias de gastos estão dentro do teto estipulado para o ciclo.';
      }
      return `⚠️ Naturezas com consumo acima do teto estipulado:\n${overCeiling.join('\n')}\n\nRecomendo checar a lista de compras essenciais na tela de 'Naturezas'.`;
    }

    // 4. Pergunta sobre salários
    if (q.includes('salário') || q.includes('receita') || q.includes('renda')) {
      const activeContracts = salaryContracts.filter((c) => c.active !== false && c.isActive !== false);
      const totalSal = activeContracts.reduce((s, c) => s + (c.baseAmount || c.currentNetAmount || 0), 0);
      return `Você possui ${activeContracts.length} contrato(s) ativo(s) cadastrado(s), garantindo uma renda base de R$ ${totalSal.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2 }
      )} distribuída em duas quinzenas mensais.`;
    }

    // Resposta padrão analítica
    return `Compreendo. Analisando sua base no Balder, identifiquei ${accounts.length} contas bancárias ativas e ${cards.length} cartões. Para otimizar seu patrimônio, mantenha seus Marcos Patrimoniais atualizados e monitore os tetos na aba 'Naturezas'.`;
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'USER',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    // Gera resposta do copiloto
    setTimeout(() => {
      const replyText = generateResponse(text);
      const copilotMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'COPILOT',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, copilotMsg]);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 400);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBox}>
            <Sparkles size={20} color="#0B0F17" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Copiloto Balder IA</Text>
            <Text style={styles.headerSubtitle}>Assistente Financeiro Pessoal</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            setMessages([
              {
                id: '1',
                sender: 'COPILOT',
                text: 'Conversa reiniciada. Em que posso ajudar você agora?',
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }}
        >
          <RotateCcw size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Lista de Mensagens */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'USER';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageWrapper,
                isUser ? styles.messageWrapperUser : styles.messageWrapperCopilot,
              ]}
            >
              {!isUser && (
                <View style={styles.copilotAvatar}>
                  <Bot size={16} color="#06B6D4" />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  isUser ? styles.bubbleUser : styles.bubbleCopilot,
                ]}
              >
                <Text style={[styles.messageText, isUser ? styles.textUser : styles.textCopilot]}>
                  {msg.text}
                </Text>
                <Text style={styles.timestampText}>{msg.timestamp}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Sugestões Rápidas */}
      <View style={styles.suggestionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
          {suggestions.map((s, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.suggestionBadge}
              onPress={() => handleSendMessage(s)}
            >
              <Zap size={12} color="#06B6D4" />
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input de Mensagem */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Pergunte ao Copiloto Balder..."
          placeholderTextColor="#64748B"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]}
          onPress={() => handleSendMessage()}
          disabled={!inputMessage.trim()}
        >
          <Send size={18} color="#0B0F17" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#06B6D4',
  },
  resetBtn: {
    padding: 8,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 10,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    maxWidth: '85%',
  },
  messageWrapperUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageWrapperCopilot: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    gap: 8,
  },
  copilotAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#06B6D4',
    borderBottomRightRadius: 2,
  },
  bubbleCopilot: {
    backgroundColor: '#161F30',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textUser: {
    color: '#0B0F17',
    fontWeight: '600',
  },
  textCopilot: {
    color: '#F8FAFC',
  },
  timestampText: {
    fontSize: 9,
    color: '#64748B',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  suggestionsContainer: {
    paddingVertical: 6,
    backgroundColor: '#161F30',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  suggestionsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  suggestionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionText: {
    fontSize: 11,
    color: '#06B6D4',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#161F30',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0B0F17',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    maxHeight: 80,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
});
