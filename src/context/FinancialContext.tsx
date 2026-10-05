import React, { createContext, useContext, useEffect, useRef } from 'react';

import type { Movement } from '../types';
import { isExcludedState, resolveMappingItemState } from '../utils/mappingItemState';

import type { FinancialContextType, FulfilledItemInput } from './financial/types';
import { buildSuggestedMappingsForNature } from './financial/suggestedMappings';
import { restrictForSharedAccess } from './financial/sharedAccess';
import { useCoreData } from './financial/useCoreData';
import { useCheckpoints } from './financial/useCheckpoints';
import { usePreferences } from './financial/usePreferences';
import { useSharedPlanning } from './financial/useSharedPlanning';
import { useMovementsAndGoals } from './financial/useMovementsAndGoals';
import { useBankEntities } from './financial/useBankEntities';
import { useFinancialMetrics } from './financial/useFinancialMetrics';
import { useSimulations } from './financial/useSimulations';
import { useNatures } from './financial/useNatures';
import { useForsetiActivity } from './financial/useForsetiActivity';
import { useCloudSync } from './financial/useCloudSync';
import { useForsetiChat } from './financial/useForsetiChat';
import { useForsetiActions } from './financial/useForsetiActions';
import { useFormatUserData } from './financial/useFormatUserData';

export { buildSuggestedMappingsForNature };
export type { FulfilledItemInput };

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    authUser, viewing, user, isDataReady, setIsDataReady, accounts, setAccounts, cards, setCards,
    paymentMethods, setPaymentMethods, banks, setBanks, movements, setMovements, goals, setGoals,
    natures, setNatures, lastLocalNatureMutationRef,
  } = useCoreData();

  const {
    checkpoints, setCheckpoints, activeCheckpoint, addCheckpoint, activateCheckpoint,
    updateCheckpoint, archiveCheckpoint, unarchiveCheckpoint, deleteCheckpoint,
    duplicateCheckpointAsSimulation, monthlyClosings, setMonthlyClosings, closeMonth, reopenMonth,
    getMonthlyClosing,
  } = useCheckpoints({
    user,
  });

  const {
    natureDetailModesKey, natureDetailModes, setNatureDetailModes, setNatureDetailMode,
    checkpointCashInHand, setCheckpointCashInHandState, setCheckpointCashInHand,
    projectionHorizonMonths, setProjectionHorizonState, setProjectionHorizonMonths,
    viewPreferences, setViewPreferencesState, setViewPreferences, archivedLoanGroups,
    setArchivedLoanGroups, setLoanGroupArchived,
  } = usePreferences({
    user,
  });

  const {
    defaultTrackingScope, setDefaultTrackingScopeState, activeTrackingScope,
    setActiveTrackingScope, setDefaultTrackingScope, sharedScenario, setSharedScenario,
    sharedSettlements, setSharedSettlements, updateSharedScenario, setSharedSplitRules,
    addSharedSettlement, toggleSharedSettlementStatus, settleAllSharedDebts,
  } = useSharedPlanning({
    user,
  });

  const {
    addMovement, addMultipleMovements, updateMovement, deleteMovement, deleteLoanContract,
    toggleMovementStatus, prepayInstallments, associateReceiptItemsToInvoice, addGoal,
    goalStatuses, setGoalStatusesState, setGoalStatus, deleteGoal, updateGoal,
  } = useMovementsAndGoals({
    archivedLoanGroups, authUser, movements, natures, setGoals, setLoanGroupArchived, setMovements,
    setNatures, sharedScenario, user, viewing,
  });

  const {
    addAccount, updateAccount, deleteAccount, addCard, mergeAndCleanDuplicateCards, updateCard,
    deleteCard, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, addBank, updateBank,
    setBankInvoiceTerms, setBankCreditUsed, applyBankDueDayToOpenInvoices,
    consolidateCardNamedInvoices, deleteBank,
  } = useBankEntities({
    banks, cards, deleteMovement, movements, setAccounts, setBanks, setCards, setPaymentMethods,
    updateMovement, user,
  });

  const {
    criticalEvents, nextCriticalEvent, availableBalance, cashInHandBalance, accountBalance,
    totalNetWorth, emergencyReserveAmount, forecasts, forecast30d, monthlyFreeCashflow,
    emergencyReserveMonths,
  } = useFinancialMetrics({
    accounts, activeCheckpoint, checkpointCashInHand, movements, natureDetailModes, natures,
  });

  const {
    runSimulation, simulateCustomFutureScenario, applyScenarioToBudget,
  } = useSimulations({
    addMovement, availableBalance, emergencyReserveMonths, monthlyFreeCashflow,
  });

  const {
    saveNaturesData, addNature, updateNature, deleteNature, addMappingToNature, updateMapping,
    deleteMapping, addItemToMapping, updateMappingItem, updateMappingItemState, deleteMappingItem,
    moveMappingItem, moveMappingOrder, reorderMappings, toggleItemFulfilled,
    markMappingItemsFulfilled, saveCeilingJustification, loadSuggestedMappingsForNature,
    getNatureCeiling, getNatureSpent, getNatureMissingItems,
  } = useNatures({
    lastLocalNatureMutationRef, movements, natures, setMovements, setNatures, user,
  });

  const {
    chatHistory, setChatHistory, forsetiFlowRef, requestTrailRef, forsetiActivity, lastTopicRef,
    logForsetiActivity, rateForsetiActivity, undoForsetiActivity,
  } = useForsetiActivity({
    authUser, cards, deleteCard, deleteMovement, movements, viewing,
  });

  useCloudSync({
    lastLocalNatureMutationRef, setAccounts, setArchivedLoanGroups, setBanks, setCards,
    setCheckpointCashInHandState, setCheckpoints, setDefaultTrackingScopeState,
    setGoalStatusesState, setGoals, setIsDataReady, setMonthlyClosings, setMovements,
    setNatureDetailModes, setNatures, setPaymentMethods, setProjectionHorizonState,
    setSharedScenario, setSharedSettlements, setViewPreferencesState, user, viewing,
  });

  const {
    forsetiBlockedInShared, sendMessageToCopilot,
  } = useForsetiChat({
    accounts, activeCheckpoint, addCard, associateReceiptItemsToInvoice, availableBalance, banks,
    cards, emergencyReserveAmount, emergencyReserveMonths, forecast30d, forecasts, forsetiFlowRef,
    goals, lastTopicRef, logForsetiActivity, monthlyClosings, monthlyFreeCashflow, movements,
    natures, nextCriticalEvent, projectionHorizonMonths, requestTrailRef, runSimulation,
    setChatHistory, viewing,
  });

  const {
    updatePaymentWizard, cancelPaymentWizard, confirmPaymentWizard, registerForsetiNavigator,
    confirmForsetiAction, respondToCopilotOption, reconcileReceiptData,
  } = useForsetiActions({
    accounts, addMappingToNature, addMovement, addMultipleMovements, addNature,
    applyBankDueDayToOpenInvoices, associateReceiptItemsToInvoice, authUser, banks, cards,
    chatHistory, forsetiBlockedInShared, forsetiFlowRef, logForsetiActivity, movements, natures,
    requestTrailRef, saveNaturesData, setBankInvoiceTerms, setChatHistory, setNatures,
    updateMovement, viewing,
  });

  const reconciledMovementsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isDataReady || viewing || natures.length === 0) return;
    const groups = new Map<string, { mv: Movement; amount: number; paidAt: string; count: number }>();
    for (const mv of movements) {
      if (mv.type !== 'PAGAR' || mv.status !== 'REALIZADA' || !mv.natureId || !mv.mappingItemId) continue;
      const amount = mv.actualAmount ?? mv.amount;
      const paidAt = mv.paymentDate || mv.dueDate;
      if (!(amount > 0) || !paidAt) continue;
      const key = `${mv.natureId}|${mv.mappingItemId}|${paidAt.slice(0, 7)}|${amount.toFixed(2)}`;
      const g = groups.get(key);
      if (g) g.count += 1;
      else groups.set(key, { mv, amount, paidAt, count: 1 });
    }
    const toFulfill: FulfilledItemInput[] = [];
    groups.forEach((g, key) => {
      const nat = natures.find((n) => n.id === g.mv.natureId);
      const mapping = nat?.mappings.find((m) => (m.items || []).some((it) => it.id === g.mv.mappingItemId));
      const item = mapping?.items.find((it) => it.id === g.mv.mappingItemId);
      if (!nat || !mapping || !item) return;
      const monthKey = g.paidAt.slice(0, 7);
      if (isExcludedState(resolveMappingItemState(item, monthKey))) return;
      const have = (item.payments?.[monthKey] || []).filter((p) => Math.abs(p.amount - g.amount) < 0.01).length;
      if (have >= g.count) return;
      // Uma tentativa por situação (evita repetir se o pagamento não puder ser lançado)
      const attemptKey = `${key}|${g.count}|${have}`;
      // Até 3 tentativas por situação (se as naturezas forem recarregadas da nuvem, lança de novo; sem loop infinito)
      const attempts = reconciledMovementsRef.current.get(attemptKey) || 0;
      if (attempts >= 3) return;
      reconciledMovementsRef.current.set(attemptKey, attempts + 1);
      toFulfill.push({ natureId: nat.id, mappingId: mapping.id, itemId: item.id, realizedValue: g.amount, monthKey, paidAt: g.paidAt });
    });
    if (toFulfill.length > 0) markMappingItemsFulfilled(toFulfill);
  });

  // Registrar Justificativa Contábil de Estouro de Teto

  const exportToCSV = () => {
    const headers = ['ID', 'Titulo', 'Tipo', 'Valor', 'Vencimento', 'Banco', 'Status', 'Categoria', 'Notas'];
    const rows = movements.map((m) => [
      m.id,
      `"${m.title}"`,
      m.type,
      m.amount.toFixed(2),
      m.dueDate,
      m.bank,
      m.status,
      `"${m.category}"`,
      `"${m.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BALDER_MOVIMENTACOES_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // NATUREZAS & MAPEAMENTOS DE GASTOS FIXOS
  // ==========================================

  // Sincronização centralizada de Naturezas (Supabase Cloud + localStorage)

  const {
    formatUserData,
  } = useFormatUserData({
    lastLocalNatureMutationRef, natureDetailModesKey, setAccounts, setBanks, setCards,
    setCheckpoints, setGoals, setMonthlyClosings, setMovements, setNatureDetailModes, setNatures,
    setPaymentMethods, setSharedScenario, setSharedSettlements, user,
  });

  const clearAllCheckpoints = () => formatUserData(['MARCOS']);

  // Duplicar Marco como Cenário de Simulação Alternativo

  return (
    <FinancialContext.Provider
      value={restrictForSharedAccess({
        isDataReady,
        accounts,
        cards,
        paymentMethods,
        banks,
        movements,
        goals,
        criticalEvents,
        chatHistory,
        natures,
        checkpoints,
        activeCheckpoint,
        addCheckpoint,
        updateCheckpoint,
        activateCheckpoint,
        archiveCheckpoint,
        unarchiveCheckpoint,
        deleteCheckpoint,
        clearAllCheckpoints,
        formatUserData,
        duplicateCheckpointAsSimulation,
        monthlyClosings,
        closeMonth,
        reopenMonth,
        getMonthlyClosing,
        totalNetWorth,

        availableBalance,
        accountBalance,
        cashInHandBalance,
        checkpointCashInHand,
        setCheckpointCashInHand,

        monthlyFreeCashflow,
        emergencyReserveMonths,
        emergencyReserveAmount,
        forecast30d,
        forecasts,
        nextCriticalEvent,
        addAccount,
        updateAccount,
        deleteAccount,
        addCard,
        updateCard,
        deleteCard,
        mergeAndCleanDuplicateCards,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        addBank,
        updateBank,
        setBankInvoiceTerms,
        setBankCreditUsed,
        applyBankDueDayToOpenInvoices,
        consolidateCardNamedInvoices,
        deleteBank,
        addMovement,
        addMultipleMovements,
        updateMovement,
        deleteMovement,
        toggleMovementStatus,
        prepayInstallments,
        addGoal,
        updateGoal,
        deleteGoal,
        goalStatuses,
        setGoalStatus,
        runSimulation,
        simulateCustomFutureScenario,
        applyScenarioToBudget,
        sendMessageToCopilot,
        associateReceiptItemsToInvoice,
        respondToCopilotOption,
        confirmForsetiAction,
        registerForsetiNavigator,
        updatePaymentWizard,
        confirmPaymentWizard,
        cancelPaymentWizard,
        forsetiActivity,
        rateForsetiActivity,
        undoForsetiActivity,
        exportToCSV,
        addNature,
        updateNature,
        deleteNature,
        addMappingToNature,
        updateMapping,
        deleteMapping,
        addItemToMapping,
        updateMappingItem,
        updateMappingItemState,
        deleteMappingItem,
        moveMappingItem,
        moveMappingOrder,
        reorderMappings,
        toggleItemFulfilled,
        markMappingItemsFulfilled,
        saveCeilingJustification,
        getNatureCeiling,
        getNatureSpent,
        getNatureMissingItems,
        reconcileReceiptData,
        loadSuggestedMappingsForNature,
        activeTrackingScope,
        defaultTrackingScope,
        setActiveTrackingScope,
        setDefaultTrackingScope,
        sharedScenario,
        updateSharedScenario,
        setSharedSplitRules,
        sharedSettlements,
        natureDetailModes,
        setNatureDetailMode,
        archivedLoanGroups,
        setLoanGroupArchived,
        projectionHorizonMonths,
        setProjectionHorizonMonths,
        viewPreferences,
        setViewPreferences,
        deleteLoanContract,
        addSharedSettlement,
        toggleSharedSettlementStatus,
        settleAllSharedDebts,
      }, viewing, authUser?.$id)}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial deve ser utilizado dentro de um FinancialProvider');
  }
  return context;
};

