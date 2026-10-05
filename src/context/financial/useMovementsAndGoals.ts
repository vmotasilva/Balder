import { SupabaseService } from '../../services/supabaseService';
import { denySharedAction } from './sharedAccess';
import { isUuid } from './helpers';
import { learnReceiptItemAssociation } from '../../services/receiptMemoryService';
import { matchNatureForTransaction } from '../../services/invoiceFileParser';
import {
  type Goal, type GoalStatusInfo, type InvoiceNatureItemBreakdown, type Movement,
  type MovementStatus,
} from '../../types';
import { useState } from 'react';
import type { useCoreData } from './useCoreData';
import type { useSharedPlanning } from './useSharedPlanning';
import type { usePreferences } from './usePreferences';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'authUser' | 'movements' | 'natures' | 'setGoals' | 'setMovements' | 'setNatures' | 'user' |
    'viewing'
  > &
  Pick<ReturnType<typeof useSharedPlanning>,
    'sharedScenario'
  > &
  Pick<ReturnType<typeof usePreferences>,
    'archivedLoanGroups' | 'setLoanGroupArchived'
  >;

/** Lançamentos (criar, alterar, baixar, antecipar parcelas) e metas. */
export function useMovementsAndGoals({
  archivedLoanGroups, authUser, movements, natures, setGoals, setLoanGroupArchived, setMovements,
  setNatures, sharedScenario, user, viewing,
}: Deps) {
  const addMovement = (item: Omit<Movement, 'id'>) => {
    // Guarda Anti-Duplicação: Impede clonagem de faturas idênticas (mesmo banco, vencimento e valor)
    if (item.type === 'CARTAO' && item.status === 'PREVISTA') {
      const existingExact = movements.find(
        (m) =>
          m.type === 'CARTAO' &&
          m.status === 'PREVISTA' &&
          (m.bank || '').trim().toLowerCase() === (item.bank || '').trim().toLowerCase() &&
          m.dueDate === item.dueDate &&
          Math.abs(m.amount - item.amount) < 0.01
      );
      if (existingExact) {
        console.warn(
          `[Anti-Duplicação] Fatura idêntica já existente: ${item.title} (${item.bank} - ${item.dueDate} - R$ ${item.amount}). Inserção duplicada prevenida.`
        );
        return;
      }
    }

    const tempId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newMovement: Movement = {
      ...item,
      id: tempId,
    };
    setMovements((prev) => {
      const next = [newMovement, ...prev];
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.addMovement(item)
        .then((created) => {
          if (created) {
            setMovements((prev) => {
              const updated = prev.map((m) => (m.id === tempId ? { ...m, id: created.id } : m));
              try {
                localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        })
        .catch((err) => console.error('Erro ao persistir no Supabase:', err));
    }
  };

  // Adicionar Múltiplas Movimentações (ex: Parcelamentos)

  const addMultipleMovements = (items: Omit<Movement, 'id'>[]) => {
    const baseTime = Date.now();
    const newItems: Movement[] = items.map((item, idx) => ({
      ...item,
      id: `mov_${baseTime}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
    }));
    setMovements((prev) => {
      const next = [...newItems, ...prev];
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest) {
      Promise.all(
        items.map((item, idx) =>
          SupabaseService.addMovement(item).then((created) => ({
            tempId: newItems[idx].id,
            realId: created?.id,
          }))
        )
      )
        .then((results) => {
          const map = new Map(results.filter((r) => r.realId).map((r) => [r.tempId, r.realId!]));
          if (map.size > 0) {
            setMovements((prev) => {
              const updated = prev.map((m) => {
                const real = map.get(m.id);
                return real ? { ...m, id: real } : m;
              });
              try {
                localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        })
        .catch((err) => console.error('Erro ao salvar item parcelado no Supabase:', err));
    }
  };

  // Atualizar Movimentação (Ajuste de valor real, vencimento, status, observações)
  // Receita com responsável: só quem recebe confirma (ou desfaz) o recebimento, inclusive o dono da conta

  const incomeConfirmBlocked = (id: string, nextStatus?: MovementStatus): boolean => {
    const m = movements.find((x) => x.id === id);
    if (!m || m.type !== 'RECEBER' || !authUser || authUser.isGuest) return false;
    if (nextStatus !== undefined && nextStatus === m.status) return false;
    const confirmer = m.responsibleId || viewing?.ownerId || authUser.$id;
    if (confirmer === authUser.$id) return false;
    const name =
      sharedScenario?.members?.find((p) => p.id === confirmer)?.name ||
      (confirmer === viewing?.ownerId ? viewing?.ownerName : undefined) ||
      'a pessoa que recebe';
    denySharedAction(`Só ${name} pode confirmar esta receita.`);
    return true;
  };

  const updateMovement = (id: string, updates: Partial<Movement>) => {
    if (updates.status !== undefined && incomeConfirmBlocked(id, updates.status)) return;
    setMovements((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && isUuid(id)) {
      SupabaseService.updateMovement(id, updates).catch((err) =>
        console.error('Erro ao atualizar movimentação no Supabase:', err)
      );
    }
  };

  // Excluir Movimentação

  const deleteMovement = (id: string) => {
    setMovements((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && isUuid(id)) {
      SupabaseService.deleteMovement(id).catch((err) =>
        console.error('Erro ao excluir no Supabase:', err)
      );
    }
  };

  // Exclui um contrato de empréstimo inteiro: parcelas (pagas ou não) e a captação do mesmo grupo

  const deleteLoanContract = (groupId: string, movementIds: string[]) => {
    const ids = new Set(movementIds);
    movements.forEach((m) => {
      if (m.installmentGroupId && m.installmentGroupId === groupId) ids.add(m.id);
    });
    ids.forEach((id) => deleteMovement(id));
    if (archivedLoanGroups.includes(groupId)) setLoanGroupArchived(groupId, false);
  };

  // Alternar Status Prevista / Realizada

  const toggleMovementStatus = (id: string) => {
    if (incomeConfirmBlocked(id)) return;
    let nextStatus: MovementStatus = 'REALIZADA';
    setMovements((prev) => {
      const next = prev.map((m) => {
        if (m.id === id) {
          nextStatus = m.status === 'PREVISTA' ? 'REALIZADA' : 'PREVISTA';
          return {
            ...m,
            status: nextStatus,
          };
        }
        return m;
      });
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && isUuid(id)) {
      SupabaseService.updateMovement(id, { status: nextStatus }).catch((err) =>
        console.error('Erro ao atualizar status no Supabase:', err)
      );
    }
  };

  // Liquidar / Antecipar Parcelas de Empréstimo com Desconto a Valor Presente

  const prepayInstallments = (
    movementIds: string[],
    discountedAmounts: Record<string, number>,
    paymentDate: string
  ) => {
    setMovements((prev) =>
      prev.map((m) => {
        if (movementIds.includes(m.id)) {
          const actualPaid = discountedAmounts[m.id] !== undefined ? discountedAmounts[m.id] : m.amount;
          const originalAmount = m.amount;
          const economy = Math.max(0, originalAmount - actualPaid);
          return {
            ...m,
            status: 'REALIZADA' as const,
            amount: actualPaid,
            dueDate: paymentDate,
            notes: `${m.notes ? m.notes + ' • ' : ''}Liquidado antecipadamente em ${paymentDate} com deságio de juros de ${economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          };
        }
        return m;
      })
    );
  };

  // Associar itens reconhecidos (via foto/OCR ou conciliação) diretamente ao valor não mapeado de uma fatura de cartão

  const associateReceiptItemsToInvoice = (
    invoiceMovementId: string,
    items: Array<{
      id?: string;
      detectedName?: string;
      rawName?: string;
      description?: string;
      price?: number;
      amount?: number;
      natureId?: string;
      natureName?: string;
      quantity?: number;
      unit?: string;
    }>
  ) => {
    const targetInvoice = movements.find((m) => m.id === invoiceMovementId && m.type === 'CARTAO');
    if (!targetInvoice) {
      return {
        success: false,
        allocatedAmount: 0,
        newUnanalyzed: 0,
        itemsCount: 0,
        invoiceTitle: '',
      };
    }

    const currentBreakdown = targetInvoice.invoiceBreakdown || [];

    const newBreakdownItems: InvoiceNatureItemBreakdown[] = items.map((it, idx) => {
      const itemAmount =
        typeof it.price === 'number' && !isNaN(it.price)
          ? it.price
          : typeof it.amount === 'number' && !isNaN(it.amount)
          ? it.amount
          : 0;

      const itemDesc = it.detectedName || it.description || it.rawName || `Item ${idx + 1}`;

      // Determinar a natureza correta
      let assignedNatId = it.natureId;
      let assignedNatName = it.natureName;

      if (!assignedNatId || !assignedNatName) {
        const match = matchNatureForTransaction(itemDesc, undefined, natures);
        assignedNatId = match.natureId;
        assignedNatName = match.natureName;
      } else {
        const found = natures.find(
          (n) => n.id === assignedNatId || n.name.toLowerCase() === assignedNatName?.toLowerCase()
        );
        if (found) {
          assignedNatId = found.id;
          assignedNatName = found.name;
        }
      }

      return {
        id: `breakdown_photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        natureId: assignedNatId || 'OUTROS',
        natureName: assignedNatName || 'Outros',
        description: itemDesc,
        amount: Math.round(itemAmount * 100) / 100,
        isAnalyzed: true,
        installments: 1,
        currentInstallment: 1,
      };
    });

    const updatedBreakdown = [...currentBreakdown, ...newBreakdownItems];
    const newTotalAllocated = updatedBreakdown.reduce((sum, row) => sum + row.amount, 0);
    const newUnanalyzed = Math.max(0, Math.round((targetInvoice.amount - newTotalAllocated) * 100) / 100);
    const allocatedAmount = Math.round(newBreakdownItems.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;

    // Treinar e associar palavras-chave automaticamente aos itens de mapeamento das naturezas
    items.forEach((it) => {
      const detected = (it.detectedName || it.description || it.rawName || '').trim();
      if (!detected || detected.length < 2) return;

      let matchedItemRef: { natId: string; mapId: string; itemId: string } | null = null;
      for (const nat of natures) {
        for (const map of nat.mappings) {
          for (const mItem of map.items) {
            const descNorm = mItem.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const detNorm = detected.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (
              detNorm.includes(descNorm) ||
              descNorm.includes(detNorm) ||
              mItem.keywords?.some((k) => detNorm.includes(k.toLowerCase()))
            ) {
              matchedItemRef = { natId: nat.id, mapId: map.id, itemId: mItem.id };
              break;
            }
          }
          if (matchedItemRef) break;
        }
        if (matchedItemRef) break;
      }

      if (matchedItemRef) {
        const cleanKw = detected.toLowerCase().replace(/[^\w\sÀ-ÿ]/g, '').trim();
        if (cleanKw) {
          learnReceiptItemAssociation(cleanKw, matchedItemRef.itemId, matchedItemRef.mapId, matchedItemRef.natId);
          setNatures((prevNats) =>
            prevNats.map((nat) => {
              if (nat.id !== matchedItemRef?.natId) return nat;
              return {
                ...nat,
                mappings: nat.mappings.map((m) => {
                  if (m.id !== matchedItemRef?.mapId) return m;
                  return {
                    ...m,
                    items: m.items.map((i) => {
                      if (i.id !== matchedItemRef?.itemId) return i;
                      const kws = i.keywords || [];
                      if (kws.includes(cleanKw)) return i;
                      return { ...i, keywords: [...kws, cleanKw] };
                    }),
                  };
                }),
              };
            })
          );
        }
      }
    });

    updateMovement(targetInvoice.id, {
      invoiceBreakdown: updatedBreakdown,
      unanalyzedAmount: newUnanalyzed,
      category: newUnanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
    });

    return {
      success: true,
      allocatedAmount,
      newUnanalyzed,
      itemsCount: newBreakdownItems.length,
      invoiceTitle: targetInvoice.title || `${targetInvoice.bank} - Fatura`,
    };
  };

  // Metas

  const addGoal = (item: Omit<Goal, 'id'>) => {
    const tempId = `goal_${Date.now()}`;
    setGoals((prev) => [...prev, { ...item, id: tempId }]);
    if (user && !user.isGuest) {
      SupabaseService.addGoal(item)
        .then((created) => {
          if (created) {
            setGoals((prev) => prev.map((g) => (g.id === tempId ? { ...g, id: created.id } : g)));
          }
        })
        .catch((err) => console.error('Erro ao adicionar meta no Supabase:', err));
    }
  };

  // Situação das metas (arquivada / cancelada com justificativa), guardada no perfil

  const goalStatusesKey = user && !user.isGuest ? `balder_goal_statuses_${user.$id}` : 'balder_goal_statuses_guest';

  const [goalStatuses, setGoalStatusesState] = useState<Record<string, GoalStatusInfo>>(() => {
    try {
      const saved = localStorage.getItem(goalStatusesKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const persistGoalStatuses = (next: Record<string, GoalStatusInfo>) => {
    try {
      localStorage.setItem(goalStatusesKey, JSON.stringify(next));
    } catch {}
    if (user && !user.isGuest) {
      SupabaseService.saveUserProfileSettings({ goalStatuses: next }).catch(console.error);
    }
  };

  const setGoalStatus = (goalId: string, info: GoalStatusInfo | null) => {
    setGoalStatusesState((prev) => {
      const next = { ...prev };
      if (info) next[goalId] = info;
      else delete next[goalId];
      persistGoalStatuses(next);
      return next;
    });
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (goalStatuses[id]) setGoalStatus(id, null);
    if (user && !user.isGuest) {
      SupabaseService.deleteGoal(id).catch((err) => console.error('Erro ao excluir meta no Supabase:', err));
    }
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    if (user && !user.isGuest) {
      SupabaseService.updateGoal(id, updates).catch((err) =>
        console.error('Erro ao atualizar meta no Supabase:', err)
      );
    }
  };

  // Motor de Simulações

  return {
    addMovement, addMultipleMovements, updateMovement, deleteMovement, deleteLoanContract,
    toggleMovementStatus, prepayInstallments, associateReceiptItemsToInvoice, addGoal,
    goalStatuses, setGoalStatusesState, setGoalStatus, deleteGoal, updateGoal,
  };
}
