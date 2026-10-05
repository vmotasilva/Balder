import { SupabaseService } from '../../services/supabaseService';
import { buildSuggestedMappingsForNature } from './suggestedMappings';
import {
  getItemOccurrences, isExcludedState, mappingItemBaseValue, registerItemPayment,
  removeItemPayment, resolveMappingItemState,
} from '../../utils/mappingItemState';
import {
  type CeilingJustificationRecord, type ExpenseNature, type FixedExpenseMapping, type MappingItem,
} from '../../types';
import { type FulfilledItemInput } from './types';
import type { useCoreData } from './useCoreData';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'lastLocalNatureMutationRef' | 'movements' | 'natures' | 'setMovements' | 'setNatures' |
    'user'
  >;

/** Naturezas de gasto, mapeamentos, itens e teto/gasto por natureza. */
export function useNatures({
  lastLocalNatureMutationRef, movements, natures, setMovements, setNatures, user,
}: Deps) {
  const saveNaturesData = (
    updatedNatures: ExpenseNature[],
    modifiedNatureId?: string,
    fieldsToSync?: Partial<ExpenseNature>
  ) => {
    lastLocalNatureMutationRef.current = Date.now();
    try {
      const storageKey = user && !user.isGuest ? `balder_natures_${user.$id}` : 'balder_natures_guest';
      localStorage.setItem(storageKey, JSON.stringify(updatedNatures));
    } catch (e) {
      console.warn('Erro ao salvar naturezas no localStorage:', e);
    }

    if (user && !user.isGuest && modifiedNatureId) {
      const targetNat = updatedNatures.find((n) => n.id === modifiedNatureId);
      if (targetNat) {
        const payload: Partial<ExpenseNature> = fieldsToSync || {
          mappings: targetNat.mappings,
          overCeilingJustification: targetNat.overCeilingJustification,
          justificationHistory: targetNat.justificationHistory,
          keywords: targetNat.keywords,
        };
        SupabaseService.updateNature(targetNat.id, payload)
          .then(() => {
            lastLocalNatureMutationRef.current = Date.now();
          })
          .catch((err) =>
            console.error(`Erro ao sincronizar natureza ${targetNat.id} no Supabase:`, err)
          );
      }
    }
  };

  // Adicionar Nova Natureza

  const addNature = (natureData: Omit<ExpenseNature, 'id' | 'mappings'> & { mappings?: FixedExpenseMapping[] }): string => {
    const tempId = `nat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newNature: ExpenseNature = {
      name: natureData.name,
      color: natureData.color,
      icon: natureData.icon,
      type: natureData.type,
      description: natureData.description,
      id: tempId,
      mappings: natureData.mappings || [],
      overCeilingJustification: '',
      justificationHistory: [],
      keywords: natureData.keywords || [],
    };
    setNatures((prev) => {
      const next = [...prev, newNature];
      saveNaturesData(next);
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.addNature(newNature)
        .then((created) => {
          if (created) {
            setNatures((prev) => {
              const next = prev.map((nat) => {
                if (nat.id === tempId) {
                  const updated = { ...nat, id: created.id };
                  if (updated.mappings && updated.mappings.length > 0) {
                    SupabaseService.updateNature(created.id, { mappings: updated.mappings }).catch(console.error);
                  }
                  return updated;
                }
                return nat;
              });
              saveNaturesData(next);
              return next;
            });
          }
        })
        .catch((err) => console.error('Erro ao criar natureza no Supabase:', err));
    }
    return tempId;
  };

  // Atualizar Natureza

  const updateNature = (id: string, updates: Partial<ExpenseNature>) => {
    setNatures((prev) => {
      const oldNat = prev.find((n) => n.id === id);
      const next = prev.map((nat) => (nat.id === id ? { ...nat, ...updates } : nat));
      saveNaturesData(next, id, updates);

      if (oldNat && updates.name && updates.name !== oldNat.name) {
        setMovements((prevMovs) =>
          prevMovs.map((m) => (m.category === oldNat.name ? { ...m, category: updates.name! } : m))
        );
      }

      return next;
    });
  };

  // Excluir Natureza

  const deleteNature = (id: string) => {
    setNatures((prev) => {
      const next = prev.filter((nat) => nat.id !== id);
      saveNaturesData(next);
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deleteNature(id).catch((err) =>
        console.error('Erro ao excluir natureza no Supabase:', err)
      );
    }
  };

  // Adicionar Mapeamento a uma Natureza

  const addMappingToNature = (
    natureId: string,
    name: string,
    applicableMonths?: number[],
    dayOfMonth?: number,
    icon?: string,
    keywords?: string[]
  ): string => {
    const newMappingId = `map_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newMapping: FixedExpenseMapping = {
      id: newMappingId,
      natureId,
      name,
      icon: icon || '📋',
      applicableMonths: applicableMonths || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      items: [],
      dayOfMonth: dayOfMonth ? Math.min(31, Math.max(1, dayOfMonth)) : undefined,
      keywords: keywords || [],
    };

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = [...nat.mappings, newMapping];
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });

    return newMappingId;
  };

  // Atualizar Mapeamento

  const updateMapping = (
    natureId: string,
    mappingId: string,
    updates: Partial<FixedExpenseMapping>
  ) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return { ...m, ...updates };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Excluir Mapeamento

  const deleteMapping = (natureId: string, mappingId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.filter((m) => m.id !== mappingId);
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Adicionar Item ao Mapeamento

  const addItemToMapping = (
    natureId: string,
    mappingId: string,
    itemData: Omit<MappingItem, 'id' | 'totalValue'>,
    customId?: string
  ): string => {
    const mult = itemData.multiplierWeeks > 0 ? itemData.multiplierWeeks : 1;
    const rawQty = Math.round((Number(itemData.quantity) || 0) * 1000) / 1000;
    const rawPrice = Math.round((Number(itemData.price) || 0) * 1000) / 1000;
    const totalValue = Math.round(rawQty * rawPrice * mult * 1000) / 1000;

    const newItemId = customId || `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newItem: MappingItem = {
      ...itemData,
      quantity: rawQty,
      price: rawPrice,
      id: newItemId,
      multiplierWeeks: mult,
      totalValue,
      realizedValue: itemData.realizedValue || 0,
      isFulfilled: itemData.isFulfilled || false,
    };

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: [...m.items, newItem],
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });

    return newItemId;
  };

  // Atualizar Item de Mapeamento

  const updateMappingItem = (
    natureId: string,
    mappingId: string,
    itemId: string,
    updates: Partial<MappingItem>
  ) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.map((item) => {
                  if (item.id === itemId) {
                    const updated = { ...item, ...updates };
                    const mult = updated.multiplierWeeks > 0 ? updated.multiplierWeeks : 1;
                    const rawQty = Math.round((Number(updated.quantity) || 0) * 1000) / 1000;
                    const rawPrice = Math.round((Number(updated.price) || 0) * 1000) / 1000;
                    updated.quantity = rawQty;
                    updated.price = rawPrice;
                    updated.multiplierWeeks = mult;
                    updated.totalValue = Math.round(rawQty * rawPrice * mult * 1000) / 1000;
                    return updated;
                  }
                  return item;
                }),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Situação e pagamentos do item por competência (realizado, quem pagou, pagamentos, reajustes);
  // grava o patch como veio, sem recalcular valores

  const updateMappingItemState = (
    natureId: string,
    mappingId: string,
    itemId: string,
    state: Partial<MappingItem>
  ) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id !== natureId) return nat;
        updatedMappings = nat.mappings.map((m) =>
          m.id !== mappingId
            ? m
            : { ...m, items: m.items.map((item) => (item.id === itemId ? { ...item, ...state } : item)) }
        );
        return { ...nat, mappings: updatedMappings };
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Excluir Item de Mapeamento

  const deleteMappingItem = (natureId: string, mappingId: string, itemId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.filter((item) => item.id !== itemId),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Mover Item de Mapeamento para outro Mapeamento (na mesma Natureza ou entre Naturezas)

  const moveMappingItem = (
    fromNatureId: string,
    fromMappingId: string,
    toNatureId: string,
    toMappingId: string,
    itemId: string
  ): boolean => {
    let movedItem: MappingItem | null = null;

    setNatures((prev) => {
      // 1. Localizar o item a ser movido
      for (const nat of prev) {
        if (nat.id === fromNatureId) {
          const m = nat.mappings.find((x) => x.id === fromMappingId);
          if (m) {
            const it = m.items.find((x) => x.id === itemId);
            if (it) {
              movedItem = it;
              break;
            }
          }
        }
      }

      if (!movedItem) return prev;

      let updatedFromMappings: FixedExpenseMapping[] = [];
      let updatedToMappings: FixedExpenseMapping[] = [];

      const next = prev.map((nat) => {
        // Se a movimentação for dentro da mesma natureza
        if (fromNatureId === toNatureId && nat.id === fromNatureId) {
          const newMappings = nat.mappings.map((m) => {
            if (m.id === fromMappingId && m.id === toMappingId) {
              return m; // sem alteração se o destino for o mesmo
            }
            if (m.id === fromMappingId) {
              return { ...m, items: m.items.filter((x) => x.id !== itemId) };
            }
            if (m.id === toMappingId) {
              return { ...m, items: [...m.items, movedItem!] };
            }
            return m;
          });
          updatedFromMappings = newMappings;
          return { ...nat, mappings: newMappings };
        }

        // Movimentação entre naturezas distintas
        if (nat.id === fromNatureId) {
          const newMappings = nat.mappings.map((m) => {
            if (m.id === fromMappingId) {
              return { ...m, items: m.items.filter((x) => x.id !== itemId) };
            }
            return m;
          });
          updatedFromMappings = newMappings;
          return { ...nat, mappings: newMappings };
        }

        if (nat.id === toNatureId) {
          const newMappings = nat.mappings.map((m) => {
            if (m.id === toMappingId) {
              return { ...m, items: [...m.items, movedItem!] };
            }
            return m;
          });
          updatedToMappings = newMappings;
          return { ...nat, mappings: newMappings };
        }

        return nat;
      });

      if (fromNatureId === toNatureId) {
        saveNaturesData(next, fromNatureId, { mappings: updatedFromMappings });
      } else {
        saveNaturesData(next, fromNatureId, { mappings: updatedFromMappings });
        saveNaturesData(next, toNatureId, { mappings: updatedToMappings });
      }

      return next;
    });

    return !!movedItem;
  };

  // Mover posição do Mapeamento (para cima ou para baixo)

  const moveMappingOrder = (natureId: string, mappingId: string, direction: 'UP' | 'DOWN') => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          const list = [...nat.mappings];
          const idx = list.findIndex((m) => m.id === mappingId);
          if (idx === -1) return nat;
          const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= list.length) return nat;
          const [removed] = list.splice(idx, 1);
          list.splice(targetIdx, 0, removed);
          updatedMappings = list;
          return { ...nat, mappings: list };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Reordenar todos os mapeamentos de uma natureza

  const reorderMappings = (natureId: string, newMappings: FixedExpenseMapping[]) => {
    setNatures((prev) => {
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          return { ...nat, mappings: newMappings };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: newMappings });
      return next;
    });
  };

  // Alternar realização de item (marcar como cumprido no mês)

  const toggleItemFulfilled = (natureId: string, mappingId: string, itemId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.map((item) => {
                  if (item.id === itemId) {
                    const willBeFulfilled = !item.isFulfilled;
                    return {
                      ...item,
                      isFulfilled: willBeFulfilled,
                      realizedValue: willBeFulfilled ? item.totalValue : 0,
                    };
                  }
                  return item;
                }),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Marcar múltiplos itens de mapeamento como realizados em lote (ex: conciliação de fatura aberta)

  const markMappingItemsFulfilled = (itemsToFulfill: FulfilledItemInput[]) => {
    if (!itemsToFulfill || itemsToFulfill.length === 0) return;
    setNatures((prev) => {
      const next = prev.map((nat) => {
        const matchingForNat = itemsToFulfill.filter((it) => it.natureId === nat.id);
        if (matchingForNat.length === 0) return nat;

        const updatedMappings = nat.mappings.map((m) => {
          const matchingForMap = matchingForNat.filter((it) => it.mappingId === m.id);
          if (matchingForMap.length === 0) return m;

          return {
            ...m,
            items: m.items.map((item) => {
              const matched = matchingForMap.find((it) => it.itemId === item.id);
              if (matched) {
                const fulfilled = {
                  ...item,
                  isFulfilled: true,
                  realizedValue: matched.realizedValue !== undefined ? matched.realizedValue : item.totalValue,
                };
                const amount = matched.realizedValue ?? 0;
                if (!matched.monthKey || amount <= 0) return fulfilled;

                // O "Real" do mês vem dos pagamentos do item: lança (ou substitui) o desta movimentação
                let base: MappingItem = fulfilled;
                const own = (base.payments?.[matched.monthKey] || []).find(
                  (p) =>
                    (matched.movementId && p.movementId === matched.movementId) ||
                    (matched.movementId && !p.movementId && matched.previousAmount !== undefined && Math.abs(p.amount - matched.previousAmount) < 0.01)
                );
                if (own) base = { ...base, ...removeItemPayment(base, matched.monthKey, own.id) };
                const covered = new Set((base.payments?.[matched.monthKey] || []).flatMap((p) => p.coveredDates));
                const paidAt = matched.paidAt || `${matched.monthKey}-01`;
                const open = getItemOccurrences(base, matched.monthKey).filter((o) => !covered.has(o.date));
                const target = paidAt.slice(0, 7) === matched.monthKey ? paidAt : `${matched.monthKey}-01`;
                const day = open.length
                  ? open.reduce((best, o) => (Math.abs(Date.parse(o.date) - Date.parse(target)) < Math.abs(Date.parse(best.date) - Date.parse(target)) ? o : best)).date
                  : target;
                const patch = registerItemPayment(base, matched.monthKey, { paidAt, amount, coveredDates: [day] });
                if (!patch.payments) return { ...base };
                const list = [...(patch.payments[matched.monthKey] || [])];
                if (list.length > 0 && matched.movementId) list[list.length - 1] = { ...list[list.length - 1], movementId: matched.movementId };
                return { ...base, payments: { ...patch.payments, [matched.monthKey]: list } };
              }
              return item;
            }),
          };
        });

        return {
          ...nat,
          mappings: updatedMappings,
        };
      });

      // Grava no navegador e na nuvem (sem isso o pagamento some quando as naturezas são recarregadas)
      const touched = [...new Set(itemsToFulfill.map((it) => it.natureId))];
      touched.forEach((natureId) => {
        const nat = next.find((n) => n.id === natureId);
        if (!nat) return;
        saveNaturesData(next, natureId, { mappings: nat.mappings });
      });

      return next;
    });
  };

  // Despesa realizada ligada a um item de natureza sem pagamento lançado nele (ex.: criada pelo Forseti,
  // que não conhece o id definitivo da movimentação): lança o pagamento para o valor entrar no "Real" do mês.
  // Compara por item/mês/valor (quantas movimentações x quantos pagamentos), então não duplica nem depende do id.

  const saveCeilingJustification = (natureId: string, reason: string) => {
    const targetNature = natures.find((n) => n.id === natureId);
    if (!targetNature) return;

    const ceiling = getNatureCeiling(targetNature);
    const spent = getNatureSpent(targetNature);

    const newRecord: CeilingJustificationRecord = {
      id: `just_${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      month: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      ceilingAmount: ceiling,
      spentAmount: spent,
      reason,
    };

    setNatures((prev) => {
      let updatedJustHistory: CeilingJustificationRecord[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedJustHistory = [newRecord, ...(nat.justificationHistory || [])];
          return {
            ...nat,
            overCeilingJustification: reason,
            justificationHistory: updatedJustHistory,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, {
        overCeilingJustification: reason,
        justificationHistory: updatedJustHistory,
      });
      return next;
    });
  };

  // Carregar Mapeamentos Sugeridos para uma Natureza (ex: modelos de Mercado/Feira para Alimentação)

  const loadSuggestedMappingsForNature = (natureId: string) => {
    const targetNat = natures.find((n) => n.id === natureId);
    if (!targetNat) return;

    const suggestedMappings = buildSuggestedMappingsForNature(natureId, targetNat.name, targetNat.icon);

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = [...nat.mappings, ...suggestedMappings];
          return { ...nat, mappings: updatedMappings };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Cálculo Matemático Rigoroso do Teto da Natureza (Soma de todos os itens dos mapeamentos vigentes no mês)

  const getNatureCeiling = (nature: ExpenseNature, month?: number | string): number => {
    if (!nature || !nature.mappings) return 0;

    let targetMonthNum: number | undefined;
    if (typeof month === 'number') {
      targetMonthNum = month;
    } else if (typeof month === 'string') {
      const parts = month.split('-');
      if (parts.length >= 2) {
        targetMonthNum = parseInt(parts[1], 10);
      } else if (!isNaN(Number(month))) {
        targetMonthNum = parseInt(month, 10);
      }
    }

    const total = nature.mappings.reduce((accMap, map) => {
      if (
        targetMonthNum !== undefined &&
        map.applicableMonths &&
        map.applicableMonths.length > 0 &&
        !map.applicableMonths.includes(targetMonthNum)
      ) {
        return accMap;
      }
      // Com a competência completa (YYYY-MM), itens pagos por terceiros saem do teto do mês
      const monthKey = typeof month === 'string' && /^\d{4}-\d{2}/.test(month) ? month.slice(0, 7) : undefined;
      const mapTotal = (map.items || []).reduce(
        (accItem, it) =>
          accItem +
          (monthKey
            ? isExcludedState(resolveMappingItemState(it, monthKey))
              ? 0
              : mappingItemBaseValue(it, monthKey)
            : it.totalValue || 0),
        0
      );
      return accMap + mapTotal;
    }, 0);
    return Math.round(total * 1000) / 1000;
  };

  // Cálculo de Gasto Real da Natureza no Mês Atual

  const getNatureSpent = (nature: ExpenseNature): number => {
    if (!nature) return 0;

    // 1. Soma dos itens marcados com realizedValue dentro dos mapeamentos
    const itemRealizedSum = (nature.mappings || []).reduce((accMap, map) => {
      return accMap + (map.items || []).reduce((accItem, it) => accItem + (it.realizedValue || 0), 0);
    }, 0);

    // 2. Soma das movimentações registradas vinculadas a esta categoria/natureza
    const normalizedNatureName = nature.name.toLowerCase();
    const movementsSum = movements
      .filter((m) => {
        if (m.type !== 'PAGAR' && m.type !== 'CARTAO') return false;
        const normCat = (m.category || '').toLowerCase();
        return (
          normCat.includes(normalizedNatureName) ||
          normalizedNatureName.includes(normCat) ||
          (normCat.includes('alimentação') && normalizedNatureName.includes('alimentação')) ||
          (normCat.includes('moradia') && normalizedNatureName.includes('moradia')) ||
          (normCat.includes('educação') && normalizedNatureName.includes('educação')) ||
          (normCat.includes('saúde') && normalizedNatureName.includes('saúde'))
        );
      })
      .reduce((acc, cur) => acc + cur.amount, 0);

    return Math.max(itemRealizedSum, movementsSum);
  };

  // Apuração de Itens em Falta (para responder com precisão qual item falta quando estiver longe do teto)

  const getNatureMissingItems = (
    nature: ExpenseNature
  ): Array<{ item: MappingItem; mappingName: string; missingAmount: number }> => {
    if (!nature || !nature.mappings) return [];

    const missingList: Array<{ item: MappingItem; mappingName: string; missingAmount: number }> = [];

    nature.mappings.forEach((mapping) => {
      (mapping.items || []).forEach((item) => {
        const realized = item.realizedValue || 0;
        const missing = item.totalValue - realized;
        if (!item.isFulfilled && missing > 0) {
          missingList.push({
            item,
            mappingName: mapping.name,
            missingAmount: Math.round(missing * 100) / 100,
          });
        }
      });
    });

    // Ordenar pelos que mais faltam em valor
    return missingList.sort((a: any, b: any) => b.missingAmount - a.missingAmount);
  };

  // ── Formatar Dados ─────────────────────────────────────────────────────────
  // Apaga definitivamente os grupos selecionados: estado em memória, todas as variantes de cache
  // local (usuário, convidado, backup, legado) e as linhas na nuvem. Registra `formattedAt` no perfil
  // para que caches antigos (outro navegador/aba) não restaurem o que foi apagado.

  return {
    saveNaturesData, addNature, updateNature, deleteNature, addMappingToNature, updateMapping,
    deleteMapping, addItemToMapping, updateMappingItem, updateMappingItemState, deleteMappingItem,
    moveMappingItem, moveMappingOrder, reorderMappings, toggleItemFulfilled,
    markMappingItemsFulfilled, saveCeilingJustification, loadSuggestedMappingsForNature,
    getNatureCeiling, getNatureSpent, getNatureMissingItems,
  };
}
