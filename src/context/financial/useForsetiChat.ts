import { CASH_IN_HAND } from '../../utils/cashInHand';
import { PERMISSION_LABEL } from './sharedAccess';
import { buildMonthlyProjectionGrid } from '../../utils/projectionMath';
import { canonicalBankName, listPaymentInstitutions } from '../../utils/paymentInstitutions';
import { classifyIntent } from '../../services/forsetiIntentService';
import { defaultClosingDay } from '../../utils/setupCatalog';
import { getBankBranding } from '../../utils/bankBranding';
import { matchNatureForTransaction } from '../../services/invoiceFileParser';
import { recognizeImageOCR } from '../../services/ocrService';
import { resolveMovementNatureId } from '../../utils/movementNature';
import {
  type BankInvoiceInfo, CHIP_DUVIDA, CHIP_PAGAR, CHIP_RECEBER, type DoubtId,
  EXPENSE_CATEGORY_CHIPS, FALLBACK_REPLY, type ForsetiData, type ForsetiReply, MAIN_CHIPS,
  NEW_CARD_DUE_CHIPS, OPTION_OTHER_PAYMENT, OPTION_REGISTER_CARD, RECEIVE_DATE_CHIPS, TOPIC_TTL_MS,
  answerDoubt, brl, categoryFromChip, describeAction, detectAction, detectAmbiguity, detectDoubt,
  inferExpenseCategory, isPastReceive, isScheduledPayment, mentionedCard, parseAmount, parseDate,
  parseInstallments, paymentOptions, pickPaymentOptions, registrationKind, resolveFollowUp,
  spendPeriodFrom, titleFrom,
} from '../../utils/forsetiAssistant';
import {
  type CopilotAttachment, type CopilotMessage, type CreditCardItem, type PaymentWizardState,
  type ReceiptItemLine, type ReceiptReconciliationData,
} from '../../types';
import { type SharePermissionKey, hasPermission } from '../../services/sharingService';
import { type SpendPeriod } from '../../utils/forsetiIntents';
import { userNatures } from '../../utils/baseNatures';
import type { useCoreData } from './useCoreData';
import type { useCheckpoints } from './useCheckpoints';
import type { usePreferences } from './usePreferences';
import type { useBankEntities } from './useBankEntities';
import type { useFinancialMetrics } from './useFinancialMetrics';
import type { useForsetiActivity } from './useForsetiActivity';
import type { useMovementsAndGoals } from './useMovementsAndGoals';
import type { useSimulations } from './useSimulations';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'accounts' | 'banks' | 'cards' | 'goals' | 'movements' | 'natures' | 'viewing'
  > &
  Pick<ReturnType<typeof useCheckpoints>,
    'activeCheckpoint' | 'monthlyClosings'
  > &
  Pick<ReturnType<typeof usePreferences>,
    'projectionHorizonMonths'
  > &
  Pick<ReturnType<typeof useBankEntities>,
    'addCard'
  > &
  Pick<ReturnType<typeof useFinancialMetrics>,
    'availableBalance' | 'emergencyReserveAmount' | 'emergencyReserveMonths' | 'forecast30d' |
    'forecasts' | 'monthlyFreeCashflow' | 'nextCriticalEvent'
  > &
  Pick<ReturnType<typeof useForsetiActivity>,
    'forsetiFlowRef' | 'lastTopicRef' | 'logForsetiActivity' | 'requestTrailRef' |
    'setChatHistory'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'associateReceiptItemsToInvoice'
  > &
  Pick<ReturnType<typeof useSimulations>,
    'runSimulation'
  >;

/** Conversa com a Forseti: interpreta o pedido, responde e propõe ações. */
export function useForsetiChat({
  accounts, activeCheckpoint, addCard, associateReceiptItemsToInvoice, availableBalance, banks,
  cards, emergencyReserveAmount, emergencyReserveMonths, forecast30d, forecasts, forsetiFlowRef,
  goals, lastTopicRef, logForsetiActivity, monthlyClosings, monthlyFreeCashflow, movements,
  natures, nextCriticalEvent, projectionHorizonMonths, requestTrailRef, runSimulation,
  setChatHistory, viewing,
}: Deps) {
  /**
   * Forseti numa conta compartilhada: diz em qual planejamento está e não grava o que o papel não permite
   * (visualizador só consulta; colaborador só registra pagamentos do que já está previsto).
   * Devolve true quando bloqueou, já explicando na conversa.
   */

  const forsetiBlockedInShared = (what: string, userLine?: string, allowedBy: SharePermissionKey[] = []): boolean => {
    if (!viewing) return false;
    const isCollaborator = viewing.role === 'COLABORADOR';
    const missing = allowedBy.filter((k) => !hasPermission(viewing.permissions, k));
    if (isCollaborator && allowedBy.length > 0 && missing.length === 0) return false;
    const roleText = !isCollaborator
      ? 'como visualizador(a), você só consulta'
      : missing.length > 0
      ? `você não tem a permissão ${missing.map((k) => `"${PERMISSION_LABEL[k]}"`).join(' e ')}`
      : 'como colaborador(a), isso só pode ser feito por quem compartilhou';
    const reply: CopilotMessage = {
      id: `ast_shared_${Date.now()}`,
      role: 'assistant',
      content: `📍 Estou atuando no planejamento de **${viewing.ownerName}**, e ${roleText}. Por isso não ${what} aqui.\n\nPeça a ${viewing.ownerName} para lançar, ou troque para o seu planejamento no seletor do topo e fale comigo por lá.`,
      timestamp: 'Agora',
      actionBadge: 'PLANEJAMENTO COMPARTILHADO',
    };
    const userMsg: CopilotMessage[] = userLine
      ? [{ id: `usr_${Date.now()}`, role: 'user', content: userLine, timestamp: 'Agora' }]
      : [];
    setChatHistory((prev) => [
      ...prev.map((m) => (m.pendingConfirmation ? { ...m, pendingConfirmation: undefined } : m)),
      ...userMsg,
      reply,
    ]);
    return true;
  };

  const sendMessageToCopilot = (
    query: string,
    attachment?:
      | CopilotAttachment
      | CopilotAttachment[]
      | { url: string; name: string; size?: string; revoke?: () => void }
  ) => {
    const trimmed = query.trim();
    const attachmentsList: CopilotAttachment[] = Array.isArray(attachment)
      ? attachment
      : attachment
      ? [attachment]
      : [];

    if (!trimmed && attachmentsList.length === 0) return;

    // O assunto só continua se esta mensagem for uma continuação: tudo o mais (registro, ação, foto, "não entendi")
    // o apaga, e só uma resposta de assunto o grava de novo. Assim a Forseti não segue um assunto que já mudou.
    const topicBefore = lastTopicRef.current && Date.now() - lastTopicRef.current.at <= TOPIC_TTL_MS ? lastTopicRef.current : null;
    lastTopicRef.current = null;

    const userMessage: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content:
        trimmed ||
        (attachmentsList.length === 1
          ? `Comprovante anexado: ${attachmentsList[0].name}`
          : `${attachmentsList.length} fotos anexadas para conciliação`),
      timestamp: 'Agora',
      attachmentUrl: attachmentsList[0]?.url,
      attachmentName:
        attachmentsList.length === 1
          ? attachmentsList[0].name
          : `${attachmentsList.length} fotos anexadas`,
      attachmentSize: attachmentsList.length === 1 ? attachmentsList[0].size : undefined,
      attachments: attachmentsList,
      isEphemeralPurged: false,
    };

    // Comprovantes viram lançamentos e vínculos em faturas: não na conta de outra pessoa
    if (attachmentsList.length > 0 && forsetiBlockedInShared('leio comprovantes para lançar', userMessage.content)) {
      attachmentsList.forEach((att) => (att.revoke ? att.revoke() : att.url.startsWith('blob:') && URL.revokeObjectURL(att.url)));
      return;
    }

    // 0. Processamento de Imagens Anexadas (Visão Computacional / OCR com Forseti em Espaço Temporário)
    if (attachmentsList.length > 0) {
      const loadingId = `ast_loading_${Date.now()}`;
      const loadingMessage: CopilotMessage = {
        id: loadingId,
        role: 'assistant',
        content: `🔍 **Forseti OCR em execução...** Processando ${
          attachmentsList.length > 1 ? `${attachmentsList.length} fotos` : 'a foto'
        } em buffer temporário, decodificando itens e valores fiscais...`,
        timestamp: 'Agora',
        actionBadge: 'VISÃO COMPUTACIONAL OCR',
      };

      setChatHistory((prev) => [...prev, userMessage, loadingMessage]);

      // Execução paralela do pipeline de OCR para todas as fotos enviadas
      Promise.all(attachmentsList.map((att) => recognizeImageOCR(att.url, trimmed)))
        .then((ocrResults) => {
          // Imediatamente libera os arquivos do espaço temporário (memória / blob) para evitar vazamento
          attachmentsList.forEach((att) => {
            if (att.revoke) {
              att.revoke();
            } else if (att.url.startsWith('blob:')) {
              URL.revokeObjectURL(att.url);
            }
          });

          // Atualiza a mensagem do usuário no histórico para liberar memória efêmera
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === userMessage.id
                ? {
                    ...msg,
                    attachmentUrl: undefined,
                    attachments: msg.attachments?.map((a: any) => ({ ...a, url: '', isEphemeralPurged: true })),
                    isEphemeralPurged: true,
                  }
                : msg
            )
          );

          // Consolidar todos os itens e informações extraídas de todas as fotos
          const allDetectedItems: ReceiptItemLine[] = [];
          let totalDetectedAmount = 0;
          let detectedStore = '';
          let detectedDate = '';
          let suggestedPaymentMethod: 'CARTAO' | 'DEBITO' | 'DINHEIRO' | 'PIX' = 'CARTAO';
          let cashPaid: number | undefined;
          let changeAmount: number | undefined;

          // Se o usuário disse do que se trata ("almoço", "refeição"...), isso vale mais que o aprendizado por item
          const hintNorm = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const mealHint = /almoc|jantar|refeic|restaurante|lanche|marmita|cafe da manha/.test(hintNorm);
          let hintedNature = matchNatureForTransaction(trimmed, undefined, natures);
          if (hintedNature.natureId === 'OUTROS' && mealHint) {
            const mealNature = natures.find((n) =>
              /refei|restaurante|almoc|lanch|comer fora|alimentacao fora/.test(
                n.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              )
            );
            if (mealNature) hintedNature = { ...hintedNature, natureId: mealNature.id, natureName: mealNature.name };
          }
          const hasHint = hintedNature.natureId !== 'OUTROS' && (hintedNature.confidence >= 0.9 || mealHint);

          ocrResults.forEach((res, rIdx) => {
            if (!detectedStore && res.detectedStore) detectedStore = res.detectedStore;
            if (!detectedDate && res.detectedDate) detectedDate = res.detectedDate;
            if (res.suggestedPaymentMethod) suggestedPaymentMethod = res.suggestedPaymentMethod;
            if (res.cashPaid !== undefined) cashPaid = res.cashPaid;
            if (res.changeAmount !== undefined) changeAmount = res.changeAmount;

            res.receiptItemLines.forEach((item, iIdx) => {
              const match = matchNatureForTransaction(item.detectedName, undefined, natures);
              allDetectedItems.push({
                ...item,
                id: `item_rec_${rIdx}_${iIdx}_${Date.now()}`,
                ...(hasHint
                  ? {
                      natureId: hintedNature.natureId,
                      newCategoryName: hintedNature.natureName,
                      matchedMappingItemId: undefined,
                      targetMappingId: undefined,
                      isNewSuggestedItem: false,
                    }
                  : {
                      natureId: item.natureId || match.natureId,
                      newCategoryName: item.newCategoryName || match.natureName,
                    }),
              });
            });
            totalDetectedAmount += res.detectedAmount;
          });

          totalDetectedAmount = Math.round(totalDetectedAmount * 100) / 100;

          // Nada legível: avisa em vez de montar um lançamento zerado
          if (totalDetectedAmount <= 0 && allDetectedItems.length === 0) {
            setChatHistory((prev) =>
              prev.filter((m) => m.id !== loadingId).concat({
                id: `ast_${Date.now()}`,
                role: 'assistant',
                content:
                  '⚠️ Não consegui ler valores nesta foto. Tente de novo com o cupom aberto, bem iluminado e sem reflexo (de preferência de frente, sem inclinar), ou me diga o valor e o local por texto.',
                timestamp: 'Agora',
                actionBadge: 'VISÃO COMPUTACIONAL OCR',
              })
            );
            return;
          }

          // Análise de Intenção do Usuário
          const lower = (trimmed + ' ' + (userMessage.content || '')).toLowerCase();
          const isInvoiceIntent =
            lower.includes('fatura') ||
            lower.includes('cartao') ||
            lower.includes('cartão') ||
            lower.includes('nao mapead') ||
            lower.includes('não mapead') ||
            lower.includes('nao analisad') ||
            lower.includes('não analisad') ||
            lower.includes('abater') ||
            lower.includes('abata') ||
            lower.includes('consumir') ||
            lower.includes('vincular a fatura') ||
            lower.includes('vincular à fatura');

          const cardInvoices = movements.filter((m) => m.type === 'CARTAO');
          const matchedInvoiceByBank = cardInvoices.find(
            (inv) =>
              (inv.bank && lower.includes(inv.bank.toLowerCase())) ||
              (inv.title && lower.includes(inv.title.toLowerCase()))
          );
          const targetInvoice =
            matchedInvoiceByBank ||
            cardInvoices.find((inv) => (inv.unanalyzedAmount || 0) > 0.01) ||
            cardInvoices[0];

          // 1. Caso com Intenção Expressa de Abater da Fatura de Cartão e fatura existente
          if (isInvoiceIntent && targetInvoice) {
            const assocResult = associateReceiptItemsToInvoice(targetInvoice.id, allDetectedItems);

            const assistantMsg: CopilotMessage = {
              id: `ast_${Date.now()}`,
              role: 'assistant',
              content: `💳 **${assocResult.itemsCount} itens** de ${detectedStore || 'cupom'} (${assocResult.allocatedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) abatidos da fatura **${targetInvoice.bank}**. Não mapeado restante: **${assocResult.newUnanalyzed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**.`,
              timestamp: 'Agora',
              actionBadge: 'FATURA CONCILIADA',
              receiptReconciliation: {
                id: `rec_${Date.now()}`,
                store: detectedStore || 'Comprovantes Fiscais',
                date: detectedDate || new Date().toISOString().split('T')[0],
                totalAmount: totalDetectedAmount,
                paymentMethod: 'CARTAO',
                items: allDetectedItems,
                isReconciled: true,
              },
            };

            setChatHistory((prev) => prev.filter((m) => m.id !== loadingId).concat(assistantMsg));
            return;
          }

          // 2. Fluxo regular: uma mensagem curta + o card de conciliação (forma de pagamento e fatura ficam nele)
          const brlTotal = totalDetectedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const itemsLabel = allDetectedItems.length === 1 ? '1 item' : `${allDetectedItems.length} itens`;
          const ocrText = `📄 **${detectedStore || 'Cupom'}** · ${(detectedDate || '').split('-').reverse().join('/')} · **${brlTotal}** · ${itemsLabel}\n\nConfira e confirme abaixo.`;

          const receiptReconciliation: ReceiptReconciliationData = {
            id: `rec_${Date.now()}`,
            store: detectedStore || 'Cupom Fiscal',
            date: detectedDate || new Date().toISOString().split('T')[0],
            totalAmount: totalDetectedAmount,
            paymentMethod: suggestedPaymentMethod,
            cashPaid,
            changeAmount,
            items: allDetectedItems,
            isReconciled: false,
          };

          const assistantMessage: CopilotMessage = {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            content: ocrText,
            timestamp: 'Agora',
            actionBadge: 'VISÃO COMPUTACIONAL OCR',
            receiptReconciliation,
          };

          setChatHistory((prev) => prev.filter((m) => m.id !== loadingId).concat(assistantMessage));
        })
        .catch((err) => {
          console.error('Erro no processamento de fotos OCR:', err);
          setChatHistory((prev) =>
            prev.filter((m) => m.id !== loadingId).concat({
              id: `ast_${Date.now()}`,
              role: 'assistant',
              content:
                '⚠️ Não foi possível decodificar os pixels das imagens enviadas. Por favor, tente enviar fotos com iluminação mais clara.',
              timestamp: 'Agora',
            })
          );
        });

      return;
    }

    setChatHistory((prev) => [...prev, userMessage]);

    // Análise Cognitiva da Pergunta / Comando
    setTimeout(() => {
      let responseText = '';
      let actionBadge = '';
      let suggestedFollowUps: string[] = [];
      const lower = trimmed.toLowerCase();

      const reply = (r: ForsetiReply, extra?: Partial<CopilotMessage>) => {
        logForsetiActivity({ kind: 'CONVERSA', request: trimmed, result: r.text.replace(/\{(?:ok|bad)\|([^}]*)\}/g, '$1') });
        setChatHistory((prev) => [
          ...(r.pendingAction ? prev.map((m) => (m.pendingAction ? { ...m, pendingAction: undefined } : m)) : prev),
          {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            content: r.text,
            timestamp: 'Agora',
            actionBadge: r.badge,
            suggestedFollowUps: r.chips,
            ...(r.choices ? { choices: r.choices } : {}),
            ...(r.pendingAction ? { pendingAction: r.pendingAction } : {}),
            ...extra,
          },
        ]);
      };

      const todayIso = parseDate('hoje') as string;
      const dateLabel = (iso: string) =>
        iso === todayIso ? 'hoje' : iso === parseDate('amanhã') ? 'amanhã' : `em ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

      // ── Registro guiado: cada passo pergunta só o que falta ──
      const askReceiveAccount = (title: string, amount: number, date: string, status: 'PREVISTA' | 'REALIZADA') => {
        forsetiFlowRef.current = null;
        const done = status === 'REALIZADA';
        reply(
          {
            text: `Certo: **${brl(amount)}**${title ? ` (${title})` : ''} ${done ? 'recebido' : 'entrando'} **${dateLabel(date)}**.\n\n**Em qual conta esse dinheiro ${done ? 'entrou' : 'vai entrar'}?**`,
            badge: 'SELEÇÃO DE CONTA',
            chips: [],
          },
          {
            pendingConfirmation: {
              step: 'ACCOUNT',
              pendingData: {
                rawTitle: title || 'Recebimento',
                amount,
                dueDate: date,
                type: 'RECEBER',
                category: 'Receita Operacional',
                status,
                request: requestTrailRef.current.join(' → '),
              },
              question: 'Em qual conta?',
              options: [],
              wizard: { step: 'WHERE', installments: 1 },
            },
          }
        );
      };
      // hint: frase original, onde pode estar a forma de pagamento ("no cartão Inter", "no Pix")
      type PayContext = { installments?: number; hint?: string; date?: string; scheduled?: boolean };
      const askPaymentMethod = (title: string, amount: number, category: string, ctx: PayContext = {}) => {
        // Pagamento agendado sem data na frase: pergunta para quando é, antes da forma de pagamento
        if (ctx.scheduled && !ctx.date) {
          forsetiFlowRef.current = {
            kind: 'PAGAR',
            step: 'DATA',
            title,
            amount,
            category: { title, category },
            installments: ctx.installments,
            hint: ctx.hint,
            scheduled: true,
          };
          reply({
            text: `**${brl(amount)}**${title ? ` (${title})` : ''}. **Para quando está agendado?**\n\nEscolha uma opção ou escreva a data (ex.: *dia 12* ou *15/10*).`,
            badge: 'DATA DO PAGAMENTO',
            chips: RECEIVE_DATE_CHIPS,
          });
          return;
        }
        forsetiFlowRef.current = null;
        const installments = ctx.installments && ctx.installments >= 2 ? ctx.installments : undefined;
        const plan = installments ? { count: installments, total: amount } : undefined;
        const pick = pickPaymentOptions(ctx.hint || '', accounts, cards, category, plan);
        const parcelas = plan ? ` em **${plan.count}x de ${brl(Math.round((amount / plan.count) * 100) / 100)}**` : '';
        // Cartão citado e não cadastrado: segue o cadastro na conversa; senão, o registro em etapas
        const needsRegister = pick.options.some((o) => o.payload.action === OPTION_REGISTER_CARD);
        let wizard: PaymentWizardState | undefined;
        if (!needsRegister) {
          wizard = { step: 'WHERE', installments: plan?.count ?? 1 };
          // A forma de pagamento já estava clara na frase: vai direto ao resumo, para conferir
          const real = pick.options.filter((o) => o.payload.action !== OPTION_OTHER_PAYMENT);
          if (real.length === 1 && pick.question.startsWith('Confirma')) {
            const insts = listPaymentInstitutions(accounts, cards, banks);
            const o = real[0];
            const byCard = insts.find((i) => i.card && o.id === `opt_pay_card_${i.card.id}`);
            const byAccount = insts.find((i) => i.account && o.id === `opt_pay_${i.account.id}`);
            if (byCard) wizard = { step: 'SUMMARY', where: 'BANK', institution: byCard.name, method: 'CREDITO', installments: plan?.count ?? 1 };
            else if (byAccount) wizard = { step: 'SUMMARY', where: 'BANK', institution: byAccount.name, method: 'DEBITO', installments: 1 };
            else if (o.payload.bank === CASH_IN_HAND) wizard = { step: 'SUMMARY', where: 'CASH', installments: 1 };
          }
        }
        reply(
          {
            text: `Anotado: **${brl(amount)}** em **${title}**${parcelas}${ctx.scheduled && ctx.date ? `, agendado para **${ctx.date.slice(8, 10)}/${ctx.date.slice(5, 7)}**` : ''}.${needsRegister ? `${pick.note ? ` ${pick.note}` : ''}\n\n**${pick.question}**` : ''}`,
            badge: 'FORMA DE PAGAMENTO',
            chips: [],
          },
          {
            pendingConfirmation: {
              step: 'PAYMENT_METHOD',
              pendingData: {
                rawTitle: title,
                amount,
                dueDate: ctx.scheduled && ctx.date ? ctx.date : todayIso,
                type: 'PAGAR',
                category,
                installments,
                ...(ctx.scheduled && ctx.date ? { status: 'PREVISTA' as const } : {}),
                request: requestTrailRef.current.join(' → '),
              },
              question: pick.question,
              options: wizard ? [] : pick.options,
              wizard,
            },
          }
        );
      };
      const continueReceive = (title: string, amount: number, date: string | null, status: 'PREVISTA' | 'REALIZADA') => {
        if (date) return askReceiveAccount(title, amount, date, status);
        forsetiFlowRef.current = { kind: 'RECEBER', step: 'DATA', title, amount, status };
        reply({
          text: `**${brl(amount)}**${title ? ` (${title})` : ''}. **E quando esse valor entra?**\n\nEscolha uma opção ou escreva a data (ex.: *dia 12* ou *15/10*).`,
          badge: 'DATA DO RECEBIMENTO',
          chips: RECEIVE_DATE_CHIPS,
        });
      };
      const continuePay = (title: string, amount: number, cat: { title: string; category: string } | null, ctx: PayContext = {}) => {
        if (cat) return askPaymentMethod(title || cat.title, amount, cat.category, ctx);
        if (title) return askPaymentMethod(title, amount, 'Outros', ctx);
        forsetiFlowRef.current = { kind: 'PAGAR', step: 'CATEGORIA', amount, ...ctx };
        // Sugestões = naturezas cadastradas pelo usuário; sem nenhuma, vale a lista padrão
        const ownNames = userNatures(natures).map((n) => n.name);
        reply({
          text: `**${brl(amount)}**. **Com o que foi esse gasto?**`,
          badge: 'CATEGORIA DO GASTO',
          chips: ownNames.length > 0 ? [...ownNames.slice(0, 10), 'Outro'] : EXPENSE_CATEGORY_CHIPS,
        });
      };
      // "em 6x de 295,87" sem o total: o total é parcela × vezes
      const readPurchase = (text: string) => {
        const inst = parseInstallments(text);
        const base = inst ? inst.rest : text;
        const amount = parseAmount(base) ?? (inst?.perInstallment ? Math.round(inst.perInstallment * inst.count * 100) / 100 : null);
        return { base, amount, installments: inst?.count };
      };
      const startRegistration = (kind: 'RECEBER' | 'PAGAR', text: string) => {
        requestTrailRef.current = [trimmed];
        const amount = parseAmount(text);
        const title = titleFrom(text);
        if (kind === 'RECEBER') {
          const past = isPastReceive(text);
          const status = past ? 'REALIZADA' : 'PREVISTA';
          const date = parseDate(text) || (past ? todayIso : null);
          if (amount === null) {
            forsetiFlowRef.current = { kind, step: 'VALOR', title, date: date || undefined, status };
            reply({
              text: `${past ? 'Que bom! ' : 'Vamos registrar. '}**Qual é o valor ${past ? 'que você recebeu' : 'que você vai receber'}?**\n\nPode escrever só o número (ex.: *1.500*) ou com a origem (ex.: *1.500 do freela*).`,
              badge: 'VALOR DO RECEBIMENTO',
              chips: [],
            });
            return;
          }
          continueReceive(title, amount, date, status);
          return;
        }
        const purchase = readPurchase(text);
        const payTitle = titleFrom(purchase.base);
        const cat = inferExpenseCategory(purchase.base);
        const scheduled = isScheduledPayment(text);
        const ctx: PayContext = { installments: purchase.installments, hint: text, scheduled, date: scheduled ? parseDate(text) || undefined : undefined };
        if (purchase.amount === null) {
          forsetiFlowRef.current = { kind, step: 'VALOR', title: payTitle, category: cat || undefined, ...ctx };
          reply({
            text: `Vamos registrar. **Qual foi o valor ${purchase.installments && purchase.installments >= 2 ? 'total da compra' : 'pago'}?**\n\nPode escrever só o número (ex.: *85,90*) ou com o que foi (ex.: *85,90 na farmácia*).`,
            badge: 'VALOR DO PAGAMENTO',
            chips: [],
          });
          return;
        }
        continuePay(payTitle, purchase.amount, cat, ctx);
      };

      // Resposta a uma pergunta do registro em andamento (sair dele é só mudar de assunto)
      const flow = forsetiFlowRef.current;
      if (/^(cancela|cancelar|esquece|deixa|nao quero|não quero)/i.test(trimmed)) {
        forsetiFlowRef.current = null;
        reply({
          text: flow ? 'Tudo bem, cancelei. Se precisar, é só chamar.' : 'Tudo bem! Não há nada em andamento. Se precisar, é só chamar.',
          badge: 'CANCELADO',
          chips: MAIN_CHIPS,
        });
        return;
      }
      if (flow) {
        // No cadastro do cartão, "vence dia 10" é resposta, não a dúvida "o que vence"
        const cardStep = flow.step.startsWith('CARTAO_');
        const changedSubject =
          MAIN_CHIPS.includes(trimmed) ||
          !!registrationKind(trimmed) ||
          !!detectAction(trimmed, natures) ||
          (!cardStep && !!detectDoubt(trimmed) && parseAmount(trimmed) === null);
        if (!changedSubject) requestTrailRef.current.push(trimmed);
        if (changedSubject) {
          forsetiFlowRef.current = null;
        } else if (flow.step === 'CARTAO_NOME' || flow.step === 'CARTAO_VENCIMENTO' || flow.step === 'CARTAO_FECHAMENTO') {
          const newCard = flow.newCard || { name: '' };
          if (flow.step === 'CARTAO_NOME') {
            const name =
              mentionedCard(`cartão ${trimmed}`)?.label ||
              trimmed.replace(/^(?:(?:o|a|meu|minha)\s+)?(?:cart[aã]o\s+)?(?:de\s+cr[eé]dito\s+)?(?:d[oa]\s+)?/i, '').trim();
            if (!name) {
              reply({ text: 'Qual é o nome ou o banco do cartão? (ex.: *Itaú*, *Renner*)', badge: 'NOVO CARTÃO', chips: [] });
              return;
            }
            forsetiFlowRef.current = { ...flow, step: 'CARTAO_VENCIMENTO', newCard: { name } };
            reply({ text: `Cartão **${name}**. **Em que dia vence a fatura?**`, badge: 'NOVO CARTÃO', chips: NEW_CARD_DUE_CHIPS });
            return;
          }
          const dayMatch = trimmed.match(/\b(\d{1,2})\b/);
          const day = dayMatch ? Number(dayMatch[1]) : 0;
          const validDay = day >= 1 && day <= 31;
          if (flow.step === 'CARTAO_VENCIMENTO') {
            if (!validDay) {
              reply({ text: 'Não entendi o dia. Escreva só o número do vencimento, por exemplo **10**.', badge: 'NOVO CARTÃO', chips: NEW_CARD_DUE_CHIPS });
              return;
            }
            const suggested = defaultClosingDay(day);
            forsetiFlowRef.current = { ...flow, step: 'CARTAO_FECHAMENTO', newCard: { ...newCard, dueDay: day } };
            reply({
              text: `Vence dia **${day}**. **E em que dia a fatura fecha?** Compras depois do fechamento vão para a fatura seguinte.\n\nSe não souber, costuma ser uma semana antes: **dia ${suggested}**.`,
              badge: 'NOVO CARTÃO',
              chips: [`Dia ${suggested}`, 'Não sei'],
            });
            return;
          }
          const dueDay = newCard.dueDay || 10;
          const unknown = /n[aã]o sei|semana antes/i.test(trimmed);
          if (!unknown && !validDay) {
            reply({ text: 'Não entendi o dia. Escreva só o número do fechamento, por exemplo **3** (ou *não sei*).', badge: 'NOVO CARTÃO', chips: [`Dia ${defaultClosingDay(dueDay)}`, 'Não sei'] });
            return;
          }
          const closingDay = unknown ? defaultClosingDay(dueDay) : day;
          forsetiFlowRef.current = null;
          const purchase = flow.purchase;
          const cardData: Omit<CreditCardItem, 'id'> = {
            name: newCard.name,
            bank: newCard.name,
            brand: 'OUTRA',
            // Limite ainda desconhecido: pelo menos o valor da compra (ajustável em Cartões)
            limitTotal: Math.max(1000, Math.ceil(purchase?.amount || 0)),
            closingDay,
            dueDay,
            color: getBankBranding(newCard.name).primaryColor,
          };
          addCard(cardData);
          logForsetiActivity({
            kind: 'CARTAO',
            request: requestTrailRef.current.join(' → '),
            result: `Cartão ${newCard.name} cadastrado · fecha dia ${closingDay}, vence dia ${dueDay}`,
            cardName: newCard.name,
          });
          const saved = `✓ Cartão **${newCard.name}** cadastrado: fecha dia **${closingDay}**${unknown ? ' *(estimado)*' : ''} e vence dia **${dueDay}**. ${unknown ? 'Confira o fechamento real no app do banco e ajuste em **Cartões**: ele define em qual fatura cada compra cai. ' : ''}O limite você ajusta em **Cartões**.`;
          if (!purchase) {
            reply({ text: saved, badge: 'CARTÃO CADASTRADO', chips: MAIN_CHIPS });
            return;
          }
          const plan = purchase.installments && purchase.installments >= 2 ? { count: purchase.installments, total: purchase.amount } : undefined;
          const cardOption = paymentOptions([], [{ ...cardData, id: `novo_${Date.now()}` }], purchase.category || 'Outros', plan).filter(
            (o) => o.payload.type === 'CARTAO'
          );
          const parcelas = plan ? ` em **${plan.count}x de ${brl(Math.round((plan.total / plan.count) * 100) / 100)}**` : '';
          reply(
            {
              text: `${saved}\n\nAgora a compra: **${brl(purchase.amount)}** em **${purchase.rawTitle}**${parcelas}.\n\n**Confirma neste cartão?**`,
              badge: 'CARTÃO CADASTRADO',
              chips: [],
            },
            {
              pendingConfirmation: {
                step: 'PAYMENT_METHOD',
                pendingData: purchase,
                question: 'Confirma a compra neste cartão?',
                options: [
                  ...cardOption,
                  { id: 'opt_pay_other', label: 'Outra forma de pagamento', icon: '↔️', description: 'Ver todas as contas e cartões', payload: { action: OPTION_OTHER_PAYMENT } },
                ],
              },
            }
          );
          return;
        } else if (flow.step === 'VALOR') {
          const purchase = flow.kind === 'PAGAR' ? readPurchase(trimmed) : null;
          const amount = purchase ? purchase.amount : parseAmount(trimmed);
          if (amount === null) {
            reply({
              text: 'Não consegui entender o valor 🤔. Digite só o número, por exemplo **150** ou **1.250,90** (ou *cancelar* para desistir).',
              badge: 'VALOR',
              chips: [],
            });
            return;
          }
          const title = titleFrom(purchase ? purchase.base : trimmed) || flow.title || '';
          if (flow.kind === 'RECEBER') continueReceive(title, amount, parseDate(trimmed) || flow.date || null, flow.status || 'PREVISTA');
          else
            continuePay(title, amount, inferExpenseCategory(purchase!.base) || flow.category || null, {
              installments: purchase!.installments || flow.installments,
              hint: `${flow.hint || ''} ${trimmed}`,
              scheduled: flow.scheduled,
              date: (flow.scheduled ? parseDate(trimmed) : null) || flow.date,
            });
          return;
        } else if (flow.step === 'DATA') {
          const date = parseDate(trimmed, true);
          if (!date) {
            reply({
              text: 'Não entendi a data. Escolha uma opção ou escreva, por exemplo, **dia 12** ou **15/10**.',
              badge: 'DATA',
              chips: RECEIVE_DATE_CHIPS,
            });
            return;
          }
          if (flow.kind === 'PAGAR') {
            askPaymentMethod(flow.title || flow.category?.title || '', flow.amount || 0, flow.category?.category || 'Outros', {
              installments: flow.installments,
              hint: flow.hint,
              scheduled: true,
              date,
            });
            return;
          }
          askReceiveAccount(flow.title || '', flow.amount || 0, date, flow.status || 'PREVISTA');
          return;
        } else if (flow.step === 'CATEGORIA') {
          if (trimmed === 'Outro') {
            forsetiFlowRef.current = { ...flow, step: 'DESCRICAO' };
            reply({ text: 'O que foi? Escreva uma descrição curta (ex.: *presente*, *barbeiro*).', badge: 'DESCRIÇÃO', chips: [] });
            return;
          }
          const ownNature = userNatures(natures).find((n) => n.name.trim().toLowerCase() === trimmed.toLowerCase());
          const cat = ownNature
            ? { title: ownNature.name, category: ownNature.name }
            : categoryFromChip(trimmed) || inferExpenseCategory(trimmed);
          askPaymentMethod(cat ? cat.title : trimmed, flow.amount || 0, cat ? cat.category : 'Outros', flow);
          return;
        } else {
          askPaymentMethod(trimmed, flow.amount || 0, inferExpenseCategory(trimmed)?.category || 'Outros', flow);
          return;
        }
      }

      if (trimmed === CHIP_RECEBER || trimmed === CHIP_PAGAR) {
        startRegistration(trimmed === CHIP_RECEBER ? 'RECEBER' : 'PAGAR', '');
        return;
      }

      const isNewLoan = /novo empr[eé]stimo|pegar empr[eé]stimo|tomar empr[eé]stimo/i.test(trimmed);
      const isScreenAnalysis = /analis|auditar|diagn[oó]stico|esta tela|tela de/i.test(trimmed);
      if (!isNewLoan && !isScreenAnalysis) {
        // 0. Ações (abrir tela, criar natureza ou mapeamento): a Forseti propõe e só faz depois do "Confirmar"
        const bankInvoiceInfo: BankInvoiceInfo[] = listPaymentInstitutions(accounts, cards, banks)
          .filter((i) => i.card || banks.some((b) => b.name === i.name))
          .map((i) => ({
            name: i.name,
            closingDay: i.terms?.closingDay,
            dueDay: i.terms?.dueDay,
            openInvoices: movements.filter(
              (m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && canonicalBankName(m.bank, banks, cards).toLowerCase() === i.name.toLowerCase()
            ).length,
          }));
        const action = detectAction(trimmed, natures, bankInvoiceInfo);
        if (action) {
          if (action.kind === 'NEED_INFO') {
            reply(action.reply);
            return;
          }
          if (action.kind === 'SET_BANK_INVOICE') {
            if (forsetiBlockedInShared('ajusto as datas da fatura', undefined, ['REGISTRAR_PAGAMENTOS'])) return;
          } else if (action.kind !== 'NAVIGATE' && forsetiBlockedInShared('crio naturezas nem mapeamentos')) return;
          const { title, details } = describeAction(action);
          const pendingAction = { ...action, request: trimmed, title, details };
          logForsetiActivity({ kind: 'CONVERSA', request: trimmed, result: title.replace(/\*\*/g, '') });
          setChatHistory((prev) => [
            ...prev.map((m) => (m.pendingAction ? { ...m, pendingAction: undefined } : m)),
            {
              id: `ast_${Date.now()}`,
              role: 'assistant',
              content: `${title}${details.length > 0 ? `\n\n${details.map((d) => `• ${d}`).join('\n')}` : ''}`,
              timestamp: 'Agora',
              actionBadge: 'CONFIRMAR AÇÃO',
              pendingAction,
            },
          ]);
          return;
        }

        // 1. Registro em linguagem natural ("paguei 50 no mercado", "vou receber 1.200 dia 10")
        const kind = registrationKind(trimmed);
        if (kind) {
          startRegistration(kind, trimmed);
          return;
        }

        // 2. Dúvidas respondidas com os números do planejamento
        const answerIntent = (doubt: DoubtId, period?: SpendPeriod, note?: string) => {
          const withMonth = doubt === 'GASTEI';
          const key = todayIso.slice(0, 7);
          const opts = { startDate: activeCheckpoint?.startDate, horizonMonths: projectionHorizonMonths };
          const init = activeCheckpoint ? activeCheckpoint.initialBalance : 0;
          const monthRow = (mode: 'PROJETADO' | 'REALIZADO') =>
            buildMonthlyProjectionGrid(movements, natures, init, monthlyClosings, mode, opts).find((r) => r.monthKey === key);
          // Sem natureza: sugere a natureza provável de cada despesa (palavras-chave e nomes, como nas faturas)
          const natureSuggestions: Record<string, { natureId: string; natureName: string }> = {};
          if (doubt === 'SEM_NATUREZA') {
            movements
              .filter((m) => m.type === 'PAGAR' && !resolveMovementNatureId(m, natures))
              .forEach((m) => {
                const match = matchNatureForTransaction(m.title, m.category, natures);
                if (match.natureId && match.natureId.toLowerCase() !== 'outros' && match.confidence >= 0.8) {
                  natureSuggestions[m.id] = { natureId: match.natureId, natureName: match.natureName };
                }
              });
          }
          const data: ForsetiData = {
            natureSuggestions,
            natures,
            availableBalance,
            forecasts,
            monthProjected: withMonth ? monthRow('PROJETADO') : undefined,
            monthRealized: withMonth ? monthRow('REALIZADO') : undefined,
            goals,
            movements,
            emergencyReserveAmount,
            emergencyReserveMonths,
            monthlyFreeCashflow,
          };
          const answer = answerDoubt(doubt, trimmed, data, { period });
          lastTopicRef.current = { intent: doubt, period: period ?? spendPeriodFrom(trimmed) ?? undefined, text: trimmed, at: Date.now() };
          reply(note ? { ...answer, text: `${note}\n\n${answer.text}` } : answer);
        };

        const doubt = detectDoubt(trimmed);
        if (doubt) {
          answerIntent(doubt);
          return;
        }

        // 2b. Continuação do assunto anterior ("me mostre os dessa semana" depois de "gastos por natureza")
        const follow = resolveFollowUp(trimmed, topicBefore);
        if (follow) {
          answerIntent(follow.intent, follow.period, follow.note);
          return;
        }

        // 3. Frase que as regras não entenderam: a IA só escolhe a intenção (sem enviar seus dados);
        // sem chave, offline ou sem certeza, segue para a pergunta de confirmação / resposta padrão
        const wordCount = trimmed.split(/\s+/).length;
        if (wordCount >= 3) {
          classifyIntent(trimmed, topicBefore ? { intent: topicBefore.intent, period: topicBefore.period, previous: topicBefore.text } : undefined).then((found) => {
            if (found) answerIntent(found.intent, found.period);
            else reply(detectAmbiguity(trimmed) || FALLBACK_REPLY);
          });
          return;
        }

        // 4. Palavra solta que pode querer dizer mais de uma coisa: pergunta qual (A, B ou C)
        reply(detectAmbiguity(trimmed) || FALLBACK_REPLY);
        return;
      }

      if (isNewLoan) {
        const sim = runSimulation('NOVO_EMPRESTIMO');
        responseText = `Simulação de Novo Empréstimo: ${sim.verdict === 'COM_RESTRICAO' ? '⚠️ Viável com Restrições' : 'Simulação Concluída'}.\n\n${sim.explanation}\n\nRecomendações:\n• ${sim.actionRecommendations.join('\n• ')}`;
        actionBadge = 'SIMULAÇÃO DE CRÉDITO';
      } else {
        let screenAnalysis = '';
        if (lower.includes('fatura') || lower.includes('cartao') || lower.includes('cartão')) {
          screenAnalysis = `💳 **Auditoria da Tela de Faturas & Cartões:**\n\n• **Cartão Nubank Mastercard Black:** Fatura aberta de R$ 3.850,00 com vencimento em 06/10.\n• **Uso de Limite:** 32% utilizado (nível seguro < 40%).\n• **Recomendação:** Seu fluxo previsto no dia 05 cobrirá integralmente a fatura sem necessidade de crédito rotativo.`;
        } else if (lower.includes('emprestimo') || lower.includes('empréstimo') || lower.includes('divida') || lower.includes('dívida')) {
          screenAnalysis = `🏛️ **Auditoria da Tela de Empréstimos & Dívidas (PRICE):**\n\n• **Contrato Ativo:** Consignado Operacional com parcela de R$ 1.458,51/mês.\n• **Direito BACEN nº 3.516:** Você tem direito à amortização com deságio integral dos juros futuros.\n• **Recomendação:** Aportar parte do fluxo livre mensal reduzirá em até 8 meses o término da dívida.`;
        } else if (lower.includes('natureza') || lower.includes('teto') || lower.includes('orcamento') || lower.includes('orçamento')) {
          screenAnalysis = `🏷️ **Auditoria da Tela de Naturezas & Tetos:**\n\n• **Status Global:** ${natures.length} naturezas orçamentárias monitoradas.\n• **Consumo Médio:** 68% do teto mensal consumido até o momento.\n• **Atenção:** Mantenha atenção nas rotinas semanais de alimentação para evitar estouro na última semana do mês.`;
        } else if (lower.includes('meta')) {
          screenAnalysis = `🎯 **Auditoria da Tela de Metas Financeiras:**\n\n• **Metas Ativas:** ${goals.length} cadastradas.\n• **Viabilidade:** Com seu fluxo livre atual (+R$ ${monthlyFreeCashflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês), todas as metas projetadas estão com ritmo de aceleração positivo.`;
        } else if (lower.includes('moviment') || lower.includes('lancamento') || lower.includes('lançamento')) {
          screenAnalysis = `📝 **Auditoria da Tela de Lançamentos & Movimentações:**\n\n• **Volume de Registros:** Movimentações operacionais registradas e conciliadas.\n• **Fluxo do Ciclo:** Saldo operacional positivo em conta corrente.\n• **Dica:** Utilize o OCR com comprovantes fiscais para automatizar lançamentos recorrentes.`;
        } else {
          // Dashboard / Visão Geral
          screenAnalysis = `📊 **Auditoria da Tela Aberta (Meu Dinheiro / Dashboard):**\n\n• **Saldo Disponível em Caixa:** R$ ${availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Previsão 30 Dias:** Receitas de +R$ ${forecast30d.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs Despesas de -R$ ${forecast30d.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Resultado Projetado:** ${forecast30d.net >= 0 ? '+' : ''}R$ ${forecast30d.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gerando saldo final de R$ ${forecast30d.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Reserva de Emergência:** ${emergencyReserveMonths} meses de runway seguro.\n• **Diagnóstico:** ${nextCriticalEvent ? `Atenção ao evento crítico '${nextCriticalEvent.title}' em ${nextCriticalEvent.daysRemaining} dias.` : 'Fluxo de caixa perfeitamente equilibrado e sem riscos imediatos.'}`;
        }
        responseText = screenAnalysis;
        actionBadge = 'AUDITORIA DE TELA EM TEMPO REAL';
        suggestedFollowUps = ['Por que meu saldo previsto caiu?', 'O que vence nos próximos dias?', CHIP_DUVIDA];
      }

      const assistantMessage: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: 'Agora',
        actionBadge,
        suggestedFollowUps,
      };

      logForsetiActivity({ kind: 'CONVERSA', request: trimmed, result: responseText });
      setChatHistory((prev) => [...prev, assistantMessage]);
    }, 400);
  };

  // Responder a uma opção interativa do Copilot

  return { forsetiBlockedInShared, sendMessageToCopilot };
}
