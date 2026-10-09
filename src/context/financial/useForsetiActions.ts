import { CASH_IN_HAND } from '../../utils/cashInHand';
import {
  CHIP_DUVIDA, CHIP_PAGAR, CHIP_RECEBER, MAIN_CHIPS, NEW_CARD_DUE_CHIPS, OPTION_OTHER_PAYMENT,
  OPTION_REGISTER_CARD, brl, installmentSchedule,
} from '../../utils/forsetiAssistant';
import { addCardPurchaseToInvoices, firstInvoiceDueDate } from '../../utils/cardPurchase';
import { findMappingForTitle, findMappingItemForTitle } from '../../utils/mappingMatch';
import { learnReceiptItemAssociation } from '../../services/receiptMemoryService';
import { listPaymentInstitutions } from '../../utils/paymentInstitutions';
import { matchNatureForTransaction } from '../../services/invoiceFileParser';
import { resolveMovementNatureId } from '../../utils/movementNature';
import {
  type CopilotInteractiveOption, type CopilotMessage, type CopilotPendingConfirmation,
  type FixedExpenseMapping, type Movement, type PaymentWizardState, type ReceiptReconciliationData,
} from '../../types';
import { useRef } from 'react';
import { userNatures } from '../../utils/baseNatures';
import type { useCoreData } from './useCoreData';
import type { useBankEntities } from './useBankEntities';
import type { useForsetiActivity } from './useForsetiActivity';
import type { useMovementsAndGoals } from './useMovementsAndGoals';
import type { useForsetiChat } from './useForsetiChat';
import type { useNatures } from './useNatures';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'accounts' | 'authUser' | 'banks' | 'cards' | 'movements' | 'natures' | 'setNatures' |
    'viewing'
  > &
  Pick<ReturnType<typeof useBankEntities>,
    'applyBankDueDayToOpenInvoices' | 'setBankInvoiceTerms'
  > &
  Pick<ReturnType<typeof useForsetiActivity>,
    'chatHistory' | 'forsetiFlowRef' | 'logForsetiActivity' | 'requestTrailRef' |
    'setChatHistory'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'addMovement' | 'addMultipleMovements' | 'associateReceiptItemsToInvoice' | 'updateMovement'
  > &
  Pick<ReturnType<typeof useForsetiChat>,
    'forsetiBlockedInShared'
  > &
  Pick<ReturnType<typeof useNatures>,
    'addMappingToNature' | 'addNature' | 'saveNaturesData'
  >;

/** Ações da Forseti: etapas de pagamento, opções, confirmação e conciliação de recibos. */
export function useForsetiActions({
  accounts, addMappingToNature, addMovement, addMultipleMovements, addNature,
  applyBankDueDayToOpenInvoices, associateReceiptItemsToInvoice, authUser, banks, cards,
  chatHistory, forsetiBlockedInShared, forsetiFlowRef, logForsetiActivity, movements, natures,
  requestTrailRef, saveNaturesData, setBankInvoiceTerms, setChatHistory, setNatures,
  updateMovement, viewing,
}: Deps) {
  const updatePaymentWizard = (
    messageId: string,
    wizard?: Partial<PaymentWizardState>,
    data?: Partial<CopilotPendingConfirmation['pendingData']>
  ) => {
    setChatHistory((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.pendingConfirmation) return m;
        const pc = m.pendingConfirmation;
        const nextWizard = pc.wizard && wizard ? { ...pc.wizard, ...wizard } : pc.wizard;
        let nextData = data ? { ...pc.pendingData, ...data } : pc.pendingData;
        if (nextWizard && pc.pendingData.type !== 'RECEBER') {
          const n = nextWizard.method === 'CREDITO' ? nextWizard.installments : 1;
          nextData = { ...nextData, installments: n >= 2 ? n : undefined };
        }
        return { ...m, pendingConfirmation: { ...pc, wizard: nextWizard, pendingData: nextData } };
      })
    );
  };

  const cancelPaymentWizard = (messageId: string) => {
    setChatHistory((prev) => prev.map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m)));
  };

  // Resumo confirmado: vira a opção equivalente da lista antiga e segue o mesmo caminho de gravação

  const confirmPaymentWizard = (messageId: string) => {
    const msg = chatHistory.find((m) => m.id === messageId);
    const pc = msg?.pendingConfirmation;
    const w = pc?.wizard;
    if (!pc || !w) return;
    const pending = pc.pendingData;
    const category = pending.category || 'Outros';
    const inst = listPaymentInstitutions(accounts, cards, banks).find((i) => i.name === w.institution);
    let option: CopilotInteractiveOption;
    if (pending.type === 'RECEBER') {
      const bank = w.where === 'CASH' ? CASH_IN_HAND : w.institution || 'Geral';
      option = { id: 'opt_wizard', label: bank, payload: { bank, type: 'RECEBER' } };
    } else if (w.where === 'CASH') {
      option = { id: 'opt_wizard', label: CASH_IN_HAND, payload: { bank: CASH_IN_HAND, type: 'PAGAR', category } };
    } else if (w.method === 'CREDITO') {
      // A fatura é do banco: fechamento e vencimento vêm do banco (ou do cartão dele), sem exigir cartão cadastrado
      const bank = w.institution || 'Geral';
      const terms = inst?.terms;
      option = {
        id: 'opt_wizard_card',
        label: `${bank} (crédito)`,
        icon: '💳',
        badge: 'Cartão de crédito',
        payload: {
          bank,
          type: 'CARTAO',
          category,
          dueDate: firstInvoiceDueDate(pending.dueDate, terms?.closingDay, terms?.dueDay),
          dueDay: terms?.dueDay || 10,
        },
      };
    } else {
      const bank = inst?.account?.name ?? w.institution ?? 'Geral';
      option = { id: 'opt_wizard', label: `${w.institution} (débito)`, payload: { bank, type: 'PAGAR', category } };
    }
    respondToCopilotOption(messageId, option);
  };

  const forsetiNavigatorRef = useRef<((tab: string) => void) | null>(null);

  const registerForsetiNavigator = (navigate: ((tab: string) => void) | null) => {
    forsetiNavigatorRef.current = navigate;
  };

  // Confirmação (ou cancelamento) de uma ação proposta pela Forseti no chat

  const confirmForsetiAction = (messageId: string, accept: boolean) => {
    const action = chatHistory.find((m) => m.id === messageId)?.pendingAction;
    if (!action) return;
    const say = (content: string, chips: string[] = [], badge = 'AÇÃO') => {
      logForsetiActivity({ kind: 'CONVERSA', request: action.request, result: content.replace(/\*\*/g, '') });
      setChatHistory((prev) => [
        ...prev.map((m) => (m.pendingAction ? { ...m, pendingAction: undefined } : m)),
        { id: `usr_${Date.now()}`, role: 'user', content: accept ? '✅ Sim, pode fazer' : '✖️ Não, cancelar', timestamp: 'Agora' },
        { id: `ast_${Date.now() + 1}`, role: 'assistant', content, timestamp: 'Agora', actionBadge: badge, suggestedFollowUps: chips },
      ]);
    };
    const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    if (!accept) {
      say('Tudo bem, não fiz nada. Se precisar, é só pedir.', MAIN_CHIPS, 'CANCELADO');
      return;
    }

    if (action.kind === 'NAVIGATE') {
      say(`Abrindo **${action.label}**…`, [], 'TELA ABERTA');
      forsetiNavigatorRef.current?.(action.tab);
      return;
    }

    if (action.kind === 'ASSIGN_NATURES') {
      if (forsetiBlockedInShared('associo despesas a naturezas', undefined, ['REGISTRAR_PAGAMENTOS'])) return;
      const done: string[] = [];
      action.assignments.forEach((a) => {
        const mov = movements.find((m) => m.id === a.movementId);
        if (!mov || resolveMovementNatureId(mov, natures)) return; // já mudou desde a proposta
        if (!natures.some((n) => n.id === a.natureId)) return;
        updateMovement(a.movementId, { natureId: a.natureId });
        done.push(`• ${a.title} → **${a.natureName}**`);
      });
      say(
        done.length > 0
          ? `✅ Associei ${done.length} ${done.length === 1 ? 'despesa' : 'despesas'}:\n\n${done.join('\n')}\n\nElas passam a contar nos tetos dessas naturezas.`
          : 'Nada a associar: essas despesas já foram ligadas a uma natureza ou não existem mais.',
        ['Gastos por origem', 'Gastos sem natureza'],
        done.length > 0 ? 'DESPESAS ASSOCIADAS' : 'NÃO FEITO'
      );
      return;
    }

    if (action.kind === 'SET_BANK_INVOICE') {
      if (forsetiBlockedInShared('ajusto as datas da fatura', undefined, ['REGISTRAR_PAGAMENTOS'])) return;
      setBankInvoiceTerms(action.bank, { closingDay: action.closingDay, dueDay: action.dueDay });
      const moved = action.shiftOpen ? applyBankDueDayToOpenInvoices(action.bank, action.dueDay) : 0;
      say(
        `✅ Fatura do **${action.bank}**: fecha dia **${action.closingDay}**${action.estimatedClosing ? ' *(estimado: confira no app do banco)*' : ''} e vence dia **${action.dueDay}**.${
          moved > 0 ? `\n\n${moved} ${moved === 1 ? 'fatura em aberto passou' : 'faturas em aberto passaram'} a vencer no dia ${action.dueDay}.` : ''
        }\n\nAs próximas compras no crédito já usam essas datas.`,
        ['Abrir faturas', 'Registrar um gasto'],
        'FATURA AJUSTADA'
      );
      return;
    }

    if (forsetiBlockedInShared('crio naturezas nem mapeamentos')) return;

    if (action.kind === 'CREATE_NATURE') {
      if (natures.some((n) => norm(n.name) === norm(action.name))) {
        say(`Você já tem a natureza **${action.name}**. Não criei outra igual.`, ['Abrir naturezas'], 'JÁ EXISTE');
        return;
      }
      addNature({
        name: action.name,
        icon: '🏷️',
        color: '#10B981',
        type: 'VARIAVEL',
        description: '',
        overCeilingJustification: '',
        justificationHistory: [],
        keywords: [],
      });
      say(
        `✅ Natureza **${action.name}** criada.\n\nAgora você pode criar um mapeamento nela ou abrir Naturezas para completar.`,
        [`Criar mapeamento Despesas na natureza ${action.name}`, 'Abrir naturezas'],
        'NATUREZA CRIADA'
      );
      return;
    }

    const nature = natures.find((n) => n.id === action.natureId);
    if (!nature) {
      say('Não encontrei mais essa natureza. Nada foi criado.', ['Abrir naturezas'], 'NÃO FEITO');
      return;
    }
    if (nature.mappings.some((m) => norm(m.name) === norm(action.name))) {
      say(`A natureza **${nature.name}** já tem o mapeamento **${action.name}**. Não criei outro igual.`, ['Abrir naturezas'], 'JÁ EXISTE');
      return;
    }
    addMappingToNature(nature.id, action.name);
    say(
      `✅ Mapeamento **${action.name}** criado na natureza **${nature.name}**.\n\nEle começa sem itens: abra Naturezas para adicionar os itens e valores.`,
      ['Abrir naturezas'],
      'MAPEAMENTO CRIADO'
    );
  };

  const respondToCopilotOption = (messageId: string, option: CopilotInteractiveOption) => {
    const targetMsg = chatHistory.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.pendingConfirmation) return;

    const pending = targetMsg.pendingConfirmation.pendingData;

    // Caso o usuário queira ajustar o valor / favorecido
    if (option.payload.action === 'ADJUST_AMOUNT') {
      const userAdjustMsg: CopilotMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: '✏️ Gostaria de ajustar os dados deste lançamento.',
        timestamp: 'Agora',
      };

      const assistantAdjustReply: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: `Sem problemas! Como você prefere ajustar?\n\nVocê pode digitar diretamente na barra de texto abaixo (ex: *"Gastei R$ 42 na feira via Pix Inter"* ou *"Paguei 55 reais no dinheiro"*), e eu registrarei a movimentação com a conciliação determinística exata.`,
        timestamp: 'Agora',
        actionBadge: 'AJUSTE DE LANÇAMENTO',
        suggestedFollowUps: ['Paguei R$ 40 na feira no Pix', 'Paguei R$ 50 no cartão', 'Paguei R$ 35 em dinheiro'],
      };

      setChatHistory((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m)).concat(userAdjustMsg, assistantAdjustReply)
      );
      return;
    }

    // Cartão citado não está cadastrado: cadastra na conversa (nome → vencimento → fechamento)
    if (option.payload.action === OPTION_REGISTER_CARD) {
      if (forsetiBlockedInShared('cadastro cartões', option.label)) return;
      const name: string = option.payload.cardName || '';
      requestTrailRef.current = [pending.request || pending.rawTitle, option.label];
      forsetiFlowRef.current = { kind: 'PAGAR', step: name ? 'CARTAO_VENCIMENTO' : 'CARTAO_NOME', newCard: { name }, purchase: pending };
      setChatHistory((prev) =>
        prev
          .map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m))
          .concat(
            { id: `usr_${Date.now()}`, role: 'user', content: option.label, timestamp: 'Agora' },
            name
              ? {
                  id: `ast_${Date.now()}`,
                  role: 'assistant',
                  content: `Vamos cadastrar o cartão **${name}**. **Em que dia vence a fatura?**\n\nEscolha ou escreva o dia (ex.: *dia 12*).`,
                  timestamp: 'Agora',
                  actionBadge: 'NOVO CARTÃO',
                  suggestedFollowUps: NEW_CARD_DUE_CHIPS,
                }
              : {
                  id: `ast_${Date.now()}`,
                  role: 'assistant',
                  content: 'Vamos cadastrar. **Qual é o cartão?** Escreva o banco ou o nome dele (ex.: *Itaú*, *Renner*).',
                  timestamp: 'Agora',
                  actionBadge: 'NOVO CARTÃO',
                  suggestedFollowUps: [],
                }
          )
      );
      return;
    }

    // A forma citada não era a certa: mostra todas as contas e cartões
    if (option.payload.action === OPTION_OTHER_PAYMENT) {
      const plan = pending.installments && pending.installments >= 2 ? { count: pending.installments, total: pending.amount } : undefined;
      setChatHistory((prev) =>
        prev.map((m) =>
          m.id === messageId && m.pendingConfirmation
            ? {
                ...m,
                pendingConfirmation: {
                  ...m.pendingConfirmation,
                  question: 'Como você pagou?',
                  options: [],
                  wizard: { step: 'WHERE', installments: plan?.count ?? 1 },
                },
              }
            : m
        )
      );
      return;
    }

    // Confirmar cria lançamento (conforme as permissões) ou altera fatura (só quem compartilhou)
    const confirmType = option.payload.type || pending?.type;
    if (
      option.payload.action === 'LINK_TO_INVOICE'
        ? forsetiBlockedInShared('altero faturas', `Vincular à fatura`)
        : forsetiBlockedInShared(
            confirmType === 'RECEBER' ? 'lanço receitas' : 'lanço despesas',
            `Paguei via ${option.label}`,
            [confirmType === 'RECEBER' ? 'LANCAR_RECEITAS' : 'LANCAR_DESPESAS']
          )
    )
      return;

    // Caso o usuário opte por abater diretamente de uma fatura de cartão aberta
    if (option.payload.action === 'LINK_TO_INVOICE') {
      const cardInvoices = movements.filter((m) => m.type === 'CARTAO');
      const targetInvoice =
        cardInvoices.find((m) => m.id === option.payload.invoiceId) ||
        cardInvoices.find((m) => (m.unanalyzedAmount || 0) > 0.01) ||
        cardInvoices[0];

      const itemsToLink = targetMsg.receiptReconciliation?.items || [];

      if (!targetInvoice || itemsToLink.length === 0) {
        return;
      }

      const res = associateReceiptItemsToInvoice(targetInvoice.id, itemsToLink);
      logForsetiActivity({
        kind: 'FATURA',
        request: `Comprovante${targetMsg.receiptReconciliation?.store ? ` de ${targetMsg.receiptReconciliation.store}` : ''}`,
        result: `${res.itemsCount} itens vinculados à fatura ${targetInvoice.bank} · ${brl(res.allocatedAmount)}`,
      });

      const userConfirmMsg: CopilotMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: `💳 Vincular ${itemsToLink.length} itens à fatura do ${targetInvoice.bank} para abater do valor não mapeado`,
        timestamp: 'Agora',
      };

      const botConfirmMsg: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: `✅ **Itens Vinculados à Fatura com Sucesso!**\n\nAdicionei os **${res.itemsCount} itens** do comprovante diretamente à fatura do **${targetInvoice.bank}** (${res.invoiceTitle}), abatendo do valor não mapeado:\n\n• **Valor Alocado:** ${res.allocatedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n• **Saldo Restante Não Mapeado:** ${res.newUnanalyzed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${res.newUnanalyzed <= 0.01 ? ' 🎉 *(Fatura 100% categorizada!)*' : ''}\n• **Status:** Fatura atualizada e categorizada nas naturezas corretas.`,
        timestamp: 'Agora',
        actionBadge: 'FATURA CONCILIADA',
        suggestedFollowUps: ['Ver Faturas', 'Quanto sobrou para gastar no mês?', 'Anexar outro comprovante'],
      };

      setChatHistory((prev) =>
        prev
          .map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  pendingConfirmation: undefined,
                  receiptReconciliation: m.receiptReconciliation
                    ? { ...m.receiptReconciliation, isReconciled: true }
                    : undefined,
                }
              : m
          )
          .concat(userConfirmMsg, botConfirmMsg)
      );
      return;
    }

    const userConfirmMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: option.payload.type === 'RECEBER' ? `Na conta ${option.label}` : `Paguei com ${option.label}`,
      timestamp: 'Agora',
    };

    setChatHistory((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m)).concat(userConfirmMsg)
    );

    const isCredit = option.payload.type === 'CARTAO';
    const isIncome = option.payload.type === 'RECEBER';
    const finalBank = option.payload.bank || pending.bank || 'Nubank';
    const finalType = option.payload.type || pending.type;
    const finalCategory = option.payload.category || pending.category || 'Geral';

    // Compra no cartão vence com a fatura do cartão escolhido; recebimento "recebi" já entra como realizado
    const finalDueDate = isCredit ? option.payload.dueDate || pending.dueDate : pending.dueDate;
    // Pagamento agendado ("agendei para amanhã") fica previsto na data; o demais já saiu da conta
    const finalStatus = isCredit ? 'PREVISTA' : isIncome ? pending.status || 'PREVISTA' : pending.status === 'PREVISTA' ? 'PREVISTA' : 'REALIZADA';
    const whenLabel = `${finalDueDate.slice(8, 10)}/${finalDueDate.slice(5, 7)}`;
    const ddmmOf = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    const movementTitle =
      isIncome && pending.rawTitle === 'Recebimento' ? 'Recebimento' : `${isIncome ? 'Recebimento' : 'Despesa'}: ${pending.rawTitle}`;

    // Despesa: liga ao item do mapeamento (natureza → mapeamento → item) que o nome indica, ex.: "Neon.tech"
    // Se a pessoa já confirmou/ajustou a sugestão no resumo, vale a escolha dela (inclusive "nenhuma")
    const confirmedLink = isIncome || pending.natureId === undefined ? null : pending.natureId;
    const itemLink = isIncome || confirmedLink !== null ? null : findMappingItemForTitle(pending.rawTitle, userNatures(natures));
    const mappingLink = isIncome || confirmedLink !== null || itemLink ? null : findMappingForTitle(pending.rawTitle, userNatures(natures));
    const natureLink: Partial<Movement> = confirmedLink !== null
      ? confirmedLink
        ? {
            natureId: confirmedLink,
            ...(pending.mappingId ? { mappingId: pending.mappingId } : {}),
            ...(pending.mappingItemId ? { mappingItemId: pending.mappingItemId } : {}),
          }
        : {}
      : itemLink
      ? { natureId: itemLink.natureId, mappingId: itemLink.mappingId, mappingItemId: itemLink.itemId }
      : mappingLink
      ? { natureId: mappingLink.natureId, mappingId: mappingLink.mappingId }
      : isIncome
      ? {}
      : (() => {
          // Título e categoria escolhida ('Saúde' ↔ 'Saúde & Cuidados'): a natureza fica gravada já no lançamento
          const m = matchNatureForTransaction(pending.rawTitle, finalCategory, userNatures(natures));
          return m.natureId !== 'OUTROS' && m.confidence >= 0.9 ? { natureId: m.natureId } : {};
        })();

    // Compra parcelada: uma parcela por mês (no cartão, uma em cada fatura; na conta, a 1ª já sai hoje)
    const count = !isIncome && pending.installments && pending.installments >= 2 ? pending.installments : 0;
    const schedule = count ? installmentSchedule(pending.amount, count, finalDueDate, isCredit ? option.payload.dueDay : undefined) : [];
    // O pagamento no item da natureza (Real do mês) é lançado pela reconciliação de movimentações realizadas
    if (isCredit && !isIncome) {
      // Compra no cartão não é um lançamento solto: entra na fatura do banco, com a natureza e o item escolhidos
      const nature = natureLink.natureId ? natures.find((n) => n.id === natureLink.natureId) : undefined;
      const mapping = natureLink.mappingId
        ? nature?.mappings?.find((mp) => mp.id === natureLink.mappingId)
        : natureLink.mappingItemId
        ? nature?.mappings?.find((mp) => (mp.items || []).some((it) => it.id === natureLink.mappingItemId))
        : undefined;
      addCardPurchaseToInvoices(
        {
          institution: finalBank,
          title: pending.rawTitle,
          total: pending.amount,
          natureId: natureLink.natureId,
          natureName: nature?.name,
          mappingId: mapping?.id,
          mappingItemId: natureLink.mappingItemId,
          notes: `Confirmado via Forseti: ${option.label}.`,
        },
        count ? schedule : [{ dueDate: finalDueDate, amount: pending.amount }],
        movements,
        { addMovement, updateMovement }
      );
    } else if (count) {
      const groupId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addMultipleMovements(
        schedule.map((p, idx) => ({
          title: `${movementTitle} (${idx + 1}/${count})`,
          type: finalType,
          amount: p.amount,
          dueDate: p.dueDate,
          bank: finalBank,
          status: idx === 0 ? finalStatus : 'PREVISTA',
          category: finalCategory,
          notes: `Confirmado via Forseti: ${option.label}${option.badge ? ` (${option.badge})` : ''}. Parcela ${idx + 1}/${count} • Total: ${brl(pending.amount)}`,
          installmentNumber: idx + 1,
          installmentsTotal: count,
          installmentGroupId: groupId,
          ...natureLink,
        }))
      );
    } else {
      addMovement({
        title: movementTitle,
        type: finalType,
        amount: pending.amount,
        dueDate: finalDueDate,
        bank: finalBank,
        status: finalStatus,
        category: finalCategory,
        notes: `Confirmado via Forseti: ${option.label}${option.badge ? ` (${option.badge})` : ''}.`,
        ...natureLink,
        // Na conta de outra pessoa, a receita lançada é de quem lançou: só essa pessoa confirma
        ...(viewing && finalType === 'RECEBER' ? { responsibleId: authUser?.$id } : {}),
      });
    }

    const created = count
      ? schedule.map((p, idx) => ({ title: `${movementTitle} (${idx + 1}/${count})`, dueDate: p.dueDate, type: finalType, bank: finalBank }))
      : [{ title: movementTitle, dueDate: finalDueDate, type: finalType, bank: finalBank }];
    logForsetiActivity({
      kind: isIncome ? 'RECEBIMENTO' : 'PAGAMENTO',
      request: pending.request || pending.rawTitle,
      result: [
        count ? `${brl(pending.amount)} em ${count}x` : brl(pending.amount),
        pending.rawTitle,
        option.label,
        isIncome ? `${finalStatus === 'REALIZADA' ? 'recebido' : 'previsto'} em ${whenLabel}` : isCredit ? `fatura de ${whenLabel}` : finalStatus === 'PREVISTA' ? `agendado para ${whenLabel}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      movements: created,
    });

    setTimeout(() => {
      let confirmationText = '';
      if (count) {
        const first = schedule[0];
        const last = schedule[schedule.length - 1];
        confirmationText = isCredit
          ? `✓ **Compra parcelada lançada no cartão!**\n\n**${brl(pending.amount)}** (${pending.rawTitle}) em **${count}x de ${brl(first.amount)}** no **${option.label}**.\n\n• **1ª parcela:** fatura que vence em **${ddmmOf(first.dueDate)}**\n• **Última:** fatura de **${ddmmOf(last.dueDate)}**\n• **Categoria:** ${finalCategory}\n• Cada parcela entra na previsão do seu mês; o saldo só muda quando a fatura for paga.`
          : `✓ **Pagamento parcelado registrado!**\n\n**${brl(pending.amount)}** (${pending.rawTitle}) em **${count}x de ${brl(first.amount)}** com **${option.label}**.\n\n• **1ª parcela:** paga hoje\n• **As outras:** todo dia ${first.dueDate.slice(8, 10)}, até **${ddmmOf(last.dueDate)}**\n• **Categoria:** ${finalCategory}`;
      } else if (isCredit) {
        confirmationText = `✓ **Compra lançada no cartão!**\n\n**${brl(pending.amount)}** (${pending.rawTitle}) entrou na fatura do **${option.label}** que vence em **${whenLabel}**.\n\n• **Categoria:** ${finalCategory}\n• O saldo da conta só muda quando a fatura for paga.`;
      } else if (isIncome) {
        confirmationText =
          finalStatus === 'REALIZADA'
            ? `✓ **Recebimento registrado!**\n\n**${brl(pending.amount)}** entrou em **${option.label}** em ${whenLabel} e já está no seu saldo de hoje.`
            : `✓ **Recebimento agendado!**\n\n**${brl(pending.amount)}** vai entrar em **${option.label}** em **${whenLabel}**. Já considerei no saldo previsto; quando cair na conta, é só confirmar.`;
      } else {
        confirmationText =
          finalStatus === 'PREVISTA'
            ? `✓ **Pagamento agendado!**\n\n**${brl(pending.amount)}** (${pending.rawTitle}) será pago com **${option.label}** em **${whenLabel}**.\n\n• **Categoria:** ${finalCategory}\n• Já considerei no saldo previsto; quando pagar, é só confirmar.`
            : `✓ **Pagamento registrado!**\n\n**${brl(pending.amount)}** (${pending.rawTitle}) pago com **${option.label}**.\n\n• **Categoria:** ${finalCategory}\n• O saldo de hoje já foi atualizado.`;
      }

      const botConfirmMsg: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: confirmationText,
        timestamp: 'Agora',
        actionBadge: 'LANÇAMENTO REGISTRADO',
        suggestedFollowUps: ['Quanto ainda posso gastar este mês?', isIncome ? CHIP_RECEBER : CHIP_PAGAR, CHIP_DUVIDA],
      };

      setChatHistory((prev) => [...prev, botConfirmMsg]);
    }, 300);
  };

  // Conciliar Cupom / Nota Fiscal com Mapeamento de Gastos Fixos e Aprendizado Contínuo

  const reconcileReceiptData = (messageId: string, data: ReceiptReconciliationData) => {
    if (forsetiBlockedInShared('lanço cupons nem altero os mapeamentos', undefined, ['LANCAR_DESPESAS', 'EDITAR_NATUREZAS'])) return;
    logForsetiActivity({
      kind: 'CUPOM',
      request: `Cupom fiscal de ${data.store}`,
      result: `${brl(data.totalAmount)} · ${data.items.length} itens conciliados com os mapeamentos`,
    });
    // 1. Registrar a movimentação determinística no fluxo de caixa
    const isCredit = data.paymentMethod === 'CARTAO';
    const finalBank = data.paymentMethod === 'DINHEIRO' ? 'Dinheiro' : (data.paymentMethod === 'CARTAO' ? 'Nubank' : 'Inter');

    addMovement({
      title: `${data.store}`,
      type: isCredit ? 'CARTAO' : 'PAGAR',
      amount: data.totalAmount,
      dueDate: isCredit ? '2026-10-06' : data.date,
      bank: finalBank,
      status: isCredit ? 'PREVISTA' : 'REALIZADA',
      category: 'Alimentação & Mercado',
      notes: `Conciliação de cupom fiscal com ${data.items.length} itens do ${data.store}.`,
    });

    // 2. Atualizar os itens de mapeamento em ExpenseNature e adicionar novos itens com quantidade 0
    let newlyMappedCount = 0;
    const allocatedByRoutine: Record<string, number> = {};

    setNatures((prevNatures) => {
      let modifiedNatId: string | undefined;
      let updatedMappingsToSave: FixedExpenseMapping[] = [];

      const next = prevNatures.map((nat) => {
        const isAlimentacao =
          nat.id === 'nat_alimentacao' ||
          nat.name.toLowerCase().includes('aliment') ||
          nat.name.toLowerCase().includes('mercado');

        if (!isAlimentacao) return nat;

        modifiedNatId = nat.id;
        const updatedMappings = nat.mappings.map((mapping) => {
          const updatedItems = mapping.items.map((mItem) => {
            const matchedReceiptItems = data.items.filter((rItem) => rItem.matchedMappingItemId === mItem.id);
            if (matchedReceiptItems.length > 0) {
              const addedSum = matchedReceiptItems.reduce((acc, curr) => acc + curr.price, 0);
              allocatedByRoutine[mapping.name] = (allocatedByRoutine[mapping.name] || 0) + addedSum;

              // Memorizar associação para os próximos cupons
              matchedReceiptItems.forEach((rItem) => {
                learnReceiptItemAssociation(rItem.rawName, mItem.id, mapping.id, nat.id);
              });

              const lastPrice = matchedReceiptItems[matchedReceiptItems.length - 1].price;
              return {
                ...mItem,
                realizedValue: (mItem.realizedValue || 0) + addedSum,
                price: lastPrice, // Reflete o preço mais recente praticado na compra
              };
            }
            return mItem;
          });

          // Adicionar novos itens sugeridos com quantidade 0 (conforme solicitado pelo usuário!)
          const itemsToAddToThisMapping = data.items.filter(
            (rItem) => rItem.isNewSuggestedItem && (rItem.targetMappingId === mapping.id || (!rItem.targetMappingId && (mapping.id === 'map_mercado_mensal' || mapping.id.includes('mercado'))))
          );

          if (itemsToAddToThisMapping.length > 0) {
            itemsToAddToThisMapping.forEach((rItem) => {
              newlyMappedCount++;
              allocatedByRoutine[mapping.name] = (allocatedByRoutine[mapping.name] || 0) + rItem.price;
              const newItemId = `item_new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

              learnReceiptItemAssociation(rItem.rawName, newItemId, mapping.id, nat.id);

              updatedItems.push({
                id: newItemId,
                description: rItem.detectedName,
                quantity: 0, // Solicitado: mapear no sistema com quantidade 0
                price: rItem.price,
                multiplierWeeks: 1,
                totalValue: 0,
                realizedValue: rItem.price,
                isFulfilled: true,
                paymentMethod: isCredit ? 'CARTAO' : 'PIX',
              });
            });
          }

          return { ...mapping, items: updatedItems };
        });

        updatedMappingsToSave = updatedMappings;
        return { ...nat, mappings: updatedMappings };
      });

      if (modifiedNatId) {
        saveNaturesData(next, modifiedNatId, { mappings: updatedMappingsToSave });
      } else {
        saveNaturesData(next);
      }
      return next;
    });

    // 3. Atualizar o histórico do chat com confirmação e aprendizado
    const userFeedbackMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `✓ Conciliei a compra do ${data.store} (${data.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
      timestamp: 'Agora',
    };

    const routineBreakdown = Object.entries(allocatedByRoutine)
      .map(([rName, rVal]) => `• **${rName}:** +${rVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
      .join('\n');

    const assistantConfirmMsg: CopilotMessage = {
      id: `ast_${Date.now()}`,
      role: 'assistant',
      content: `✓ Compra de **${data.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** lançada${routineBreakdown ? `:\n${routineBreakdown}` : '.'}${newlyMappedCount > 0 ? `\n${newlyMappedCount} novos itens mapeados (qtd 0).` : ''}`,
      timestamp: 'Agora',
      actionBadge: 'CUPOM CONCILIADO',
    };

    setChatHistory((prev) =>
      prev
        .map((m) =>
          m.id === messageId
            ? {
                ...m,
                pendingConfirmation: undefined,
                receiptReconciliation: { ...data, isReconciled: true },
              }
            : m
        )
        .concat(userFeedbackMsg, assistantConfirmMsg)
    );
  };

  // Exportar dados para CSV estruturado

  return {
    updatePaymentWizard, cancelPaymentWizard, confirmPaymentWizard, registerForsetiNavigator,
    confirmForsetiAction, respondToCopilotOption, reconcileReceiptData,
  };
}
