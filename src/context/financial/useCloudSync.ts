import {
  DEMO_ACCOUNTS, DEMO_BANKS, DEMO_CARDS, DEMO_GOALS, DEMO_MOVEMENTS, DEMO_NATURES,
  DEMO_PAYMENT_METHODS,
} from '../../utils/demoData';
import { SupabaseService, msSinceProfileSave } from '../../services/supabaseService';
import { TABLES, isSupabaseConfigured, supabase } from '../../lib/supabase';
import { deduplicateCards } from '../../utils/cardUtils';
import { isBaseCategoryName, natureCoveringCategory } from '../../utils/baseNatures';
import {
  isLegacyOnboardingSalary, isUuid, movementFormatCategory, survivesFormat,
} from './helpers';
import {
  type BankAccount, type BankInstitution, type CreditCardItem, type ExpenseNature,
  type FinancialCheckpoint, type Movement, type PaymentMethodItem,
} from '../../types';
import { useEffect } from 'react';
import { withoutDemoPartner, withoutDemoSettlements } from './sharedAccess';
import type { useCoreData } from './useCoreData';
import type { useCheckpoints } from './useCheckpoints';
import type { useSharedPlanning } from './useSharedPlanning';
import type { usePreferences } from './usePreferences';
import type { useMovementsAndGoals } from './useMovementsAndGoals';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'lastLocalNatureMutationRef' | 'setAccounts' | 'setBanks' | 'setCards' | 'setGoals' |
    'setIsDataReady' | 'setMovements' | 'setNatures' | 'setPaymentMethods' | 'user' | 'viewing'
  > &
  Pick<ReturnType<typeof useCheckpoints>,
    'setCheckpoints' | 'setMonthlyClosings'
  > &
  Pick<ReturnType<typeof useSharedPlanning>,
    'setDefaultTrackingScopeState' | 'setSharedScenario' | 'setSharedSettlements'
  > &
  Pick<ReturnType<typeof usePreferences>,
    'setArchivedLoanGroups' | 'setCheckpointCashInHandState' | 'setNatureDetailModes' |
    'setProjectionHorizonState' | 'setViewPreferencesState'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'setGoalStatusesState'
  >;

/** Carga inicial dos dados da nuvem (Supabase) e persistência local. */
export function useCloudSync({
  lastLocalNatureMutationRef, setAccounts, setArchivedLoanGroups, setBanks, setCards,
  setCheckpointCashInHandState, setCheckpoints, setDefaultTrackingScopeState, setGoalStatusesState,
  setGoals, setIsDataReady, setMonthlyClosings, setMovements, setNatureDetailModes, setNatures,
  setPaymentMethods, setProjectionHorizonState, setSharedScenario, setSharedSettlements,
  setViewPreferencesState, user, viewing,
}: Deps) {
  useEffect(() => {
    if (!user || user.isGuest) {
      setAccounts(DEMO_ACCOUNTS);
      setCards(DEMO_CARDS);
      setPaymentMethods(DEMO_PAYMENT_METHODS);
      setBanks(DEMO_BANKS);
      setMovements(DEMO_MOVEMENTS);
      setGoals(DEMO_GOALS);
      setNatures(DEMO_NATURES);
      setIsDataReady(true);
      return;
    }

    let isMounted = true;
    async function loadCloudData() {
      // Própria conta: mantém atualizados os espelhos lidos por quem tem acesso compartilhado
      if (!viewing) void SupabaseService.syncProfileMirror();
      try {
        const [
          cloudMovements,
          cloudNatures,
          cloudGoals,
          cloudAccounts,
          cloudCheckpoints,
          cloudPaymentMethods,
          cloudProfileSettings,
        ] = await Promise.all([
          SupabaseService.getMovements(),
          SupabaseService.getNatures(),
          SupabaseService.getGoals(),
          SupabaseService.getAccounts(),
          SupabaseService.getCheckpoints(),
          SupabaseService.getPaymentMethods(),
          SupabaseService.getUserProfileSettings(),
        ]);

        if (isMounted) {
          // Grupos apagados em "Formatar Dados": caches locais só restauram itens criados depois
          const formattedAt = cloudProfileSettings?.formattedAt || {};

          // 1. Naturezas: mescla NÃO-DESTRUTIVA entre nuvem, cache local, backups e recuperação de órfãs
          let finalNatures: ExpenseNature[] = [...(cloudNatures || [])];
          try {
            const cacheKey = user ? `balder_natures_${user.$id}` : 'balder_natures_guest';
            const deletedKey = user ? `balder_deleted_natures_${user.$id}` : 'balder_deleted_natures_guest';
            const deletedIds: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');

            // Fontes candidatas para garantir que nenhuma natureza criada localmente seja perdida
            const candidateLists: ExpenseNature[][] = [];

            const primaryStr = localStorage.getItem(cacheKey);
            if (primaryStr) {
              try { candidateLists.push(JSON.parse(primaryStr)); } catch {}
            }
            if (user && !user.isGuest) {
              const backupStr = localStorage.getItem(`balder_natures_backup_${user.$id}`);
              if (backupStr) {
                try { candidateLists.push(JSON.parse(backupStr)); } catch {}
              }
              const legacyStr = localStorage.getItem('balder_natures');
              if (legacyStr) {
                try { candidateLists.push(JSON.parse(legacyStr)); } catch {}
              }
            }

            // Consolidar todas as naturezas locais únicas não deletadas
            const localNaturesPool: ExpenseNature[] = [];
            const seenIds = new Set<string>();
            const seenNames = new Set<string>();

            for (const list of candidateLists) {
              if (Array.isArray(list)) {
                for (const nat of list) {
                  if (!nat || !nat.name || deletedIds.includes(nat.id)) continue;
                  if (!survivesFormat(nat.id, formattedAt.NATUREZAS)) continue;
                  const normName = nat.name.trim().toLowerCase();
                  if (!seenIds.has(nat.id) && !seenNames.has(normName)) {
                    seenIds.add(nat.id);
                    seenNames.add(normName);
                    localNaturesPool.push(nat);
                  }
                }
              }
            }

            if (finalNatures.length === 0 && localNaturesPool.length > 0) {
              finalNatures = localNaturesPool;
              if (user && !user.isGuest) {
                localNaturesPool.forEach((nat) => {
                  SupabaseService.addNature(nat).catch(console.error);
                });
              }
            } else if (localNaturesPool.length > 0) {
              // Enriquece naturezas da nuvem com mapeamentos e keywords locais mais recentes
              finalNatures = finalNatures.map((cNat) => {
                const localNat = localNaturesPool.find(
                  (l) => l.id === cNat.id || l.name.trim().toLowerCase() === cNat.name.trim().toLowerCase()
                );
                if (localNat) {
                  const mergedMappings =
                    (!cNat.mappings || cNat.mappings.length === 0) && localNat.mappings && localNat.mappings.length > 0
                      ? localNat.mappings
                      : cNat.mappings;
                  const mergedKeywords =
                    (!cNat.keywords || cNat.keywords.length === 0) && localNat.keywords && localNat.keywords.length > 0
                      ? localNat.keywords
                      : cNat.keywords;
                  return { ...cNat, mappings: mergedMappings, keywords: mergedKeywords };
                }
                return cNat;
              });

              // PRESERVA QUALQUER NATUREZA LOCAL QUE NÃO ESTEJA NA NUVEM!
              const unpushedLocalNatures = localNaturesPool.filter(
                (l) =>
                  !finalNatures.some(
                    (c) => c.id === l.id || c.name.trim().toLowerCase() === l.name.trim().toLowerCase()
                  )
              );

              if (unpushedLocalNatures.length > 0) {
                console.log(
                  '[FinancialContext] Preservando e sincronizando naturezas locais não encontradas na nuvem:',
                  unpushedLocalNatures.map((n) => n.name)
                );
                finalNatures = [...finalNatures, ...unpushedLocalNatures];
                if (user && !user.isGuest) {
                  unpushedLocalNatures.forEach((nat) => {
                    SupabaseService.addNature(nat).catch(console.error);
                  });
                }
              }
            }

            // AUTO-RECUPERAÇÃO DE NATUREZAS ÓRFÃS:
            // Se existirem despesas cadastradas com uma categoria que não possui natureza correspondente, recria-a automaticamente!
            const existingNatureNames = new Set(finalNatures.map((n) => n.name.trim().toLowerCase()));
            const orphanCategories = new Set<string>();
            // Após formatar as naturezas, não recria naturezas a partir das categorias das despesas
            const movsToCheck = formattedAt.NATUREZAS ? [] : [...(cloudMovements || [])];
            for (const mov of movsToCheck) {
              const cat = mov.category?.trim();
              if (cat && !isBaseCategoryName(cat) && !existingNatureNames.has(cat.toLowerCase()) && !natureCoveringCategory(cat, finalNatures) && (mov.type === 'PAGAR' || mov.type === 'CARTAO')) {
                orphanCategories.add(cat);
              }
            }

            for (const orphanName of orphanCategories) {
              console.log('[FinancialContext] Recuperando natureza órfã detectada nas despesas:', orphanName);
              const recovered: ExpenseNature = {
                id: `nat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: orphanName,
                color: '#6366f1',
                icon: '🏷️',
                type: 'FIXA',
                description: `Natureza restaurada automaticamente para a categoria ${orphanName}`,
                mappings: [],
                overCeilingJustification: '',
                justificationHistory: [],
                keywords: [orphanName.toLowerCase()],
              };
              finalNatures.push(recovered);
              existingNatureNames.add(orphanName.toLowerCase());
              if (user && !user.isGuest) {
                SupabaseService.addNature(recovered).catch(console.error);
              }
            }
          } catch (e) {
            console.warn('Erro ao mesclar cache local de naturezas:', e);
          }

          if (Date.now() - lastLocalNatureMutationRef.current >= 6000) {
            setNatures(finalNatures);
            if (user && !user.isGuest) {
              localStorage.setItem(`balder_natures_${user.$id}`, JSON.stringify(finalNatures));
              localStorage.setItem(`balder_natures_backup_${user.$id}`, JSON.stringify(finalNatures));
            }
          }

          // 2. Metas Financeiras
          setGoals(cloudGoals || []);

          // 3. Contas Bancárias (Nuvem prioritária com migração de cache local)
          let finalAccounts = cloudAccounts || [];
          if (finalAccounts.length === 0 && user) {
            const savedAccStr = localStorage.getItem(`balder_accounts_${user.$id}`) || localStorage.getItem('balder_accounts_guest');
            if (savedAccStr) {
              try {
                const parsed = (JSON.parse(savedAccStr) as BankAccount[]).filter((a) =>
                  survivesFormat(a.id, formattedAt.CONTAS)
                );
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalAccounts = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((acc) => SupabaseService.upsertAccount(acc).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setAccounts(finalAccounts);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(finalAccounts));
          }

          // 4. Métodos de Pagamento
          let finalMethods = cloudPaymentMethods || [];
          if (finalMethods.length === 0 && user) {
            const savedPmStr = localStorage.getItem(`balder_payment_methods_${user.$id}`) || localStorage.getItem('balder_payment_methods_guest');
            if (savedPmStr) {
              try {
                const parsed = (JSON.parse(savedPmStr) as PaymentMethodItem[]).filter((pm) =>
                  survivesFormat(pm.id, formattedAt.CONTAS)
                );
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalMethods = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((pm) => SupabaseService.upsertPaymentMethod(pm).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setPaymentMethods(finalMethods);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(finalMethods));
          }

          // 6. Checkpoints de Partida (Crucial para saldo e métricas)
          let finalCheckpoints = cloudCheckpoints || [];
          if (finalCheckpoints.length === 0 && cloudProfileSettings?.checkpoints && cloudProfileSettings.checkpoints.length > 0) {
            finalCheckpoints = cloudProfileSettings.checkpoints.filter((cp) => survivesFormat(cp.id, formattedAt.MARCOS));
            if (user && !user.isGuest) {
              finalCheckpoints.forEach((cp) => SupabaseService.upsertCheckpoint(cp).catch(console.error));
            }
          }
          if (finalCheckpoints.length === 0 && user) {
            const savedCpStr = localStorage.getItem(`balder_checkpoints_${user.$id}`) || localStorage.getItem('balder_checkpoints_guest');
            if (savedCpStr) {
              try {
                const parsed = (JSON.parse(savedCpStr) as FinancialCheckpoint[]).filter((cp) =>
                  survivesFormat(cp.id, formattedAt.MARCOS)
                );
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalCheckpoints = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((cp) => SupabaseService.upsertCheckpoint(cp).catch(console.error));
                    SupabaseService.saveUserProfileSettings({ checkpoints: parsed }).catch(console.error);
                  }
                }
              } catch {}
            }
          }
          // Normalização e Anti-Duplicação de Checkpoints:
          // 1. Remove duplicatas perfeitas (mesma data de início, saldo e dívida)
          // 2. Garante que ESTRITAMENTE APENAS 1 marco seja isActive: true
          const seenCpKeys = new Set<string>();
          const dedupedCheckpoints: FinancialCheckpoint[] = [];
          for (const cp of finalCheckpoints) {
            const key = `${cp.startDate}_${cp.initialBalance}_${cp.creditCardDebt || 0}`;
            if (seenCpKeys.has(key)) {
              console.warn(`[Anti-Duplicação] Checkpoint duplicado detectado e purgado: ${cp.label || cp.id}`);
              if (user && !user.isGuest) {
                SupabaseService.deleteCheckpoint(cp.id).catch(console.error);
              }
              continue;
            }
            seenCpKeys.add(key);
            dedupedCheckpoints.push(cp);
          }

          // Garante que apenas 1 marco seja ativo:
          let hasActive = false;
          finalCheckpoints = dedupedCheckpoints.map((cp) => {
            if (cp.isActive && !hasActive && !cp.isArchived) {
              hasActive = true;
              return cp;
            }
            return { ...cp, isActive: false };
          });
          if (!hasActive && finalCheckpoints.length > 0) {
            const nonArchived = finalCheckpoints.filter((c) => !c.isArchived);
            if (nonArchived.length > 0) {
              nonArchived[0].isActive = true;
            } else {
              finalCheckpoints[0].isActive = true;
            }
          }

          setCheckpoints(finalCheckpoints);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_checkpoints_${user.$id}`, JSON.stringify(finalCheckpoints));
            SupabaseService.saveUserProfileSettings({ checkpoints: finalCheckpoints }).catch(console.error);
          }

          // 7. Cartões de Crédito (via Perfil Nuvem ou Cache)
          let finalCards = cloudProfileSettings?.cards || [];
          if (finalCards.length === 0 && user) {
            const savedCardsStr = localStorage.getItem(`balder_cards_${user.$id}`) || localStorage.getItem('balder_cards_guest');
            if (savedCardsStr) {
              try {
                const parsed = (JSON.parse(savedCardsStr) as CreditCardItem[]).filter((c) =>
                  survivesFormat(c.id, formattedAt.CARTOES)
                );
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalCards = parsed;
                }
              } catch {}
            }
          }
          const deduplicatedCards = deduplicateCards(finalCards);
          setCards(deduplicatedCards);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(deduplicatedCards));
            // Se encontrou cartões duplicados antigos salvos no Supabase, limpa imediatamente na nuvem
            if (deduplicatedCards.length !== finalCards.length) {
              console.log(`[FinancialContext] Limpeza automática de cartões duplicados: ${finalCards.length} -> ${deduplicatedCards.length}`);
              SupabaseService.saveUserProfileSettings({ cards: deduplicatedCards }).catch(console.error);
            }
          }

          // 8. Bancos / Instituições
          let finalBanks = cloudProfileSettings?.banks || [];
          if (finalBanks.length === 0 && user) {
            const savedBanksStr = localStorage.getItem(`balder_banks_${user.$id}`) || localStorage.getItem('balder_banks_guest');
            if (savedBanksStr) {
              try {
                const parsed = (JSON.parse(savedBanksStr) as BankInstitution[]).filter((b) =>
                  survivesFormat(b.id, formattedAt.BANCOS)
                );
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalBanks = parsed;
                }
              } catch {}
            }
          }
          setBanks(finalBanks);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(finalBanks));
          }

          // 9. Fechamentos Mensais de Competência
          let finalClosings = cloudProfileSettings?.monthlyClosings || [];
          if (finalClosings.length === 0 && user) {
            const savedClosingsStr = localStorage.getItem(`balder_monthly_closings_${user.$id}`) || localStorage.getItem('balder_monthly_closings_guest');
            if (savedClosingsStr) {
              try {
                // Fechamentos não têm timestamp no id: após formatar, o cache local não os restaura
                const parsed = formattedAt.FECHAMENTOS ? [] : JSON.parse(savedClosingsStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalClosings = parsed;
                }
              } catch {}
            }
          }
          setMonthlyClosings(finalClosings);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_monthly_closings_${user.$id}`, JSON.stringify(finalClosings));
          }

          // 10. Planejamento Compartilhado & Acertos Mútuos (sem os dados de exemplo)
          if (!cloudProfileSettings) {
            // Perfil indisponível: mantém o que há, só sem os dados de exemplo
            setSharedScenario((prev) => withoutDemoPartner(prev));
            setSharedSettlements((prev) => withoutDemoSettlements(prev));
          } else {
            const cloudScenario = withoutDemoPartner(cloudProfileSettings?.sharedScenario ?? null);
            const cloudSettlements = withoutDemoSettlements(cloudProfileSettings?.sharedSettlements ?? []);
            setSharedScenario(cloudScenario);
            setSharedSettlements(cloudSettlements);
            if (user) {
              if (cloudScenario) localStorage.setItem(`balder_shared_scenario_${user.$id}`, JSON.stringify(cloudScenario));
              else localStorage.removeItem(`balder_shared_scenario_${user.$id}`);
              localStorage.setItem(`balder_shared_settlements_${user.$id}`, JSON.stringify(cloudSettlements));
            }
          }
          if (cloudProfileSettings?.goalStatuses) {
            setGoalStatusesState(cloudProfileSettings.goalStatuses);
            if (user) {
              localStorage.setItem(`balder_goal_statuses_${user.$id}`, JSON.stringify(cloudProfileSettings.goalStatuses));
            }
          }
          if (cloudProfileSettings?.checkpointCashInHand) {
            setCheckpointCashInHandState(cloudProfileSettings.checkpointCashInHand);
            if (user) {
              localStorage.setItem(`balder_checkpoint_cash_${user.$id}`, JSON.stringify(cloudProfileSettings.checkpointCashInHand));
            }
          }
          if (cloudProfileSettings?.projectionHorizonMonths) {
            setProjectionHorizonState(cloudProfileSettings.projectionHorizonMonths);
            if (user) {
              localStorage.setItem(`balder_projection_horizon_${user.$id}`, String(cloudProfileSettings.projectionHorizonMonths));
            }
          }
          if (cloudProfileSettings?.viewPreferences) {
            setViewPreferencesState(cloudProfileSettings.viewPreferences);
            if (user) {
              localStorage.setItem(`balder_view_prefs_${user.$id}`, JSON.stringify(cloudProfileSettings.viewPreferences));
            }
          }
          if (cloudProfileSettings?.archivedLoanGroups) {
            setArchivedLoanGroups(cloudProfileSettings.archivedLoanGroups);
            if (user) {
              localStorage.setItem(`balder_archived_loans_${user.$id}`, JSON.stringify(cloudProfileSettings.archivedLoanGroups));
            }
          }
          if (cloudProfileSettings?.natureDetailModes) {
            setNatureDetailModes(cloudProfileSettings.natureDetailModes);
            if (user) {
              localStorage.setItem(`balder_nature_detail_modes_${user.$id}`, JSON.stringify(cloudProfileSettings.natureDetailModes));
            }
          }
          if (cloudProfileSettings?.defaultTrackingScope) {
            setDefaultTrackingScopeState(cloudProfileSettings.defaultTrackingScope);
            if (user) {
              localStorage.setItem(`balder_default_scope_${user.$id}`, cloudProfileSettings.defaultTrackingScope);
            }
          }
          if (cloudProfileSettings?.onboardingCompleted) {
            if (user) {
              localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
            }
          }

          // Se tivermos itens locais que ainda não estavam no perfil da nuvem, salva no Supabase
          if (user && !user.isGuest && (!cloudProfileSettings || Object.keys(cloudProfileSettings).length === 0)) {
            SupabaseService.saveUserProfileSettings({
              cards: finalCards,
              banks: finalBanks,
              monthlyClosings: finalClosings,
              checkpoints: finalCheckpoints,
              onboardingCompleted: localStorage.getItem(`balder_onboarding_completed_${user.$id}`) === 'true',
            }).catch(console.error);
          }

          // 11. Movimentações Financeiras (com migração de itens locais/guest para a nuvem)
          let finalMovements = cloudMovements || [];
          if (user) {
            const savedMovStr = localStorage.getItem(`balder_movements_${user.$id}`) || localStorage.getItem('balder_movements_guest');
            if (savedMovStr) {
              try {
                const localMovs: Movement[] = (JSON.parse(savedMovStr) as Movement[]).filter(
                  (lm) =>
                    !isLegacyOnboardingSalary(lm) &&
                    survivesFormat(lm.id, formattedAt[movementFormatCategory(lm.type)])
                );
                if (finalMovements.length === 0 && localMovs.length > 0) {
                  finalMovements = localMovs;
                  if (!user.isGuest) {
                    localMovs.forEach((m) => {
                      const { id, ...rest } = m;
                      SupabaseService.addMovement(rest).catch(console.error);
                    });
                  }
                } else if (localMovs.length > 0 && !user.isGuest) {
                  // Sobe movimentações geradas localmente que ainda não foram persistidas
                  const unsynced = localMovs.filter(
                    (lm) =>
                      lm.id.startsWith('mov_') &&
                      !finalMovements.some(
                        (fm) => fm.title === lm.title && fm.dueDate === lm.dueDate && fm.amount === lm.amount
                      )
                  );
                  if (unsynced.length > 0) {
                    unsynced.forEach((m) => {
                      const { id, ...rest } = m;
                      SupabaseService.addMovement(rest).then((created) => {
                        if (created) {
                          setMovements((prev) => prev.map((item) => (item.id === m.id ? created : item)));
                        }
                      }).catch(console.error);
                    });
                    finalMovements = [...unsynced, ...finalMovements];
                  }
                }
              } catch {}
            }
          }
          // Anti-Duplicação Proativa: Sanitiza faturas de cartão idênticas (mesmo banco, vencimento e valor)
          const seenCardInvoiceSignatures = new Set<string>();
          const sanitizedMovements: Movement[] = [];
          for (const m of finalMovements) {
            if (isLegacyOnboardingSalary(m)) {
              console.warn(`[Limpeza] Salário previsto automático do onboarding removido: ${m.title} (${m.id})`);
              if (user && !user.isGuest && isUuid(m.id)) {
                SupabaseService.deleteMovement(m.id).catch((e) =>
                  console.warn('Erro ao deletar salário automático no Supabase:', e)
                );
              }
              continue;
            }
            if (m.type === 'CARTAO' && m.status === 'PREVISTA') {
              const signature = `${(m.bank || '').trim().toLowerCase()}_${m.dueDate}_${m.amount.toFixed(2)}`;
              if (seenCardInvoiceSignatures.has(signature)) {
                console.warn(`[Anti-Duplicação] Fatura duplicada idêntica detectada e purgada: ${m.title} (${m.id})`);
                if (user && !user.isGuest && isUuid(m.id)) {
                  SupabaseService.deleteMovement(m.id).catch((e) =>
                    console.warn('Erro ao deletar duplicata no Supabase:', e)
                  );
                }
                continue;
              }
              seenCardInvoiceSignatures.add(signature);
            }
            sanitizedMovements.push(m);
          }
          finalMovements = sanitizedMovements;

          setMovements(finalMovements);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(finalMovements));
          }

          setIsDataReady(true);
        }
      } catch (err) {
        console.error('Erro ao sincronizar com Supabase:', err);
        // Mesmo em erro, libera o render para não travar a tela
        if (isMounted) setIsDataReady(true);
      }
    }
    loadCloudData();

    // Sincronização em tempo real & Revalidação ao retornar ao app no Mobile / APK
    let lastSilentRefetch = Date.now();
    let trailingRefetch: number | null = null;
    const silentRefetch = async () => {
      if (!isMounted || !user || user.isGuest) return;
      const now = Date.now();
      if (now - lastSilentRefetch < 4000) {
        // Cooldown anti-spam, sem perder a última mudança: relê quando o intervalo acabar
        if (trailingRefetch === null) {
          trailingRefetch = window.setTimeout(() => {
            trailingRefetch = null;
            void silentRefetch();
          }, 4000 - (now - lastSilentRefetch));
        }
        return;
      }
      lastSilentRefetch = now;
      try {
        const [
          cloudMovements,
          cloudCheckpoints,
          cloudAccounts,
          cloudProfileSettings,
          cloudNatures,
        ] = await Promise.all([
          SupabaseService.getMovements(),
          SupabaseService.getCheckpoints(),
          SupabaseService.getAccounts(),
          SupabaseService.getUserProfileSettings(),
          SupabaseService.getNatures(),
        ]);

        if (!isMounted) return;

        // Checkpoints (tabela ou profile_settings)
        let freshCheckpoints = cloudCheckpoints || [];
        if (freshCheckpoints.length === 0 && cloudProfileSettings?.checkpoints?.length) {
          freshCheckpoints = cloudProfileSettings.checkpoints.filter((cp) =>
            survivesFormat(cp.id, cloudProfileSettings.formattedAt?.MARCOS)
          );
        }
        if (freshCheckpoints.length > 0) {
          setCheckpoints(freshCheckpoints);
          localStorage.setItem(`balder_checkpoints_${user.$id}`, JSON.stringify(freshCheckpoints));
        }

        // Movimentações
        if (cloudMovements && cloudMovements.length > 0) {
          const cleanMovements = cloudMovements.filter((m) => !isLegacyOnboardingSalary(m));
          setMovements(cleanMovements);
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(cleanMovements));
        }

        // Contas
        if (cloudAccounts && cloudAccounts.length > 0) {
          setAccounts(cloudAccounts);
          localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(cloudAccounts));
        }

        // Naturezas (sincronização não-destrutiva — preserva naturezas locais não sincronizadas)
        if (cloudNatures && cloudNatures.length > 0) {
          if (Date.now() - lastLocalNatureMutationRef.current >= 6000) {
            setNatures((currentNatures) => {
              const deletedKey = user ? `balder_deleted_natures_${user.$id}` : 'balder_deleted_natures_guest';
              const deletedIds: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');

              let merged = cloudNatures.filter((c) => !deletedIds.includes(c.id));

              // Preserva naturezas locais que ainda não subiram para a nuvem
              const unpushed = currentNatures.filter(
                (loc) =>
                  !deletedIds.includes(loc.id) &&
                  !merged.some(
                    (c) => c.id === loc.id || c.name?.trim().toLowerCase() === loc.name?.trim().toLowerCase()
                  )
              );

              if (unpushed.length > 0) {
                console.log('[FinancialContext] silentRefetch preservando naturezas locais:', unpushed.map((u) => u.name));
                merged = [...merged, ...unpushed];
                if (user && !user.isGuest) {
                  unpushed.forEach((nat) => {
                    SupabaseService.addNature(nat).catch(console.error);
                  });
                }
              }

              try {
                localStorage.setItem(`balder_natures_${user.$id}`, JSON.stringify(merged));
                localStorage.setItem(`balder_natures_backup_${user.$id}`, JSON.stringify(merged));
              } catch {}

              return merged;
            });
          }
        }

        // Cartões e bancos (pilar 3 do Get Started)
        if (cloudProfileSettings?.cards?.length) {
          const cleanRefetchCards = deduplicateCards(cloudProfileSettings.cards);
          setCards(cleanRefetchCards);
          localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(cleanRefetchCards));
          if (user && !user.isGuest && cleanRefetchCards.length !== cloudProfileSettings.cards.length) {
            SupabaseService.saveUserProfileSettings({ cards: cleanRefetchCards }).catch(console.error);
          }
        }
        if (cloudProfileSettings?.banks?.length) {
          setBanks(cloudProfileSettings.banks);
          localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(cloudProfileSettings.banks));
        }
        if (cloudProfileSettings?.monthlyClosings?.length) {
          setMonthlyClosings(cloudProfileSettings.monthlyClosings);
          localStorage.setItem(`balder_monthly_closings_${user.$id}`, JSON.stringify(cloudProfileSettings.monthlyClosings));
        }

        // Demais configurações que mudam saldos, alertas e projeções: quem compartilhou e quem foi
        // convidado veem sempre os mesmos valores. Pula se houve gravação local há pouco (ainda em envio).
        if (cloudProfileSettings && msSinceProfileSave() >= 6000) {
          const s = cloudProfileSettings;
          const keep = (key: string, value: unknown) => {
            try {
              localStorage.setItem(`${key}_${user.$id}`, typeof value === 'string' ? value : JSON.stringify(value));
            } catch {}
          };
          const scenario = withoutDemoPartner(s.sharedScenario ?? null);
          setSharedScenario(scenario);
          if (scenario) keep('balder_shared_scenario', scenario);
          const settlements = withoutDemoSettlements(s.sharedSettlements ?? []);
          setSharedSettlements(settlements);
          keep('balder_shared_settlements', settlements);
          if (s.goalStatuses) {
            setGoalStatusesState(s.goalStatuses);
            keep('balder_goal_statuses', s.goalStatuses);
          }
          if (s.checkpointCashInHand) {
            setCheckpointCashInHandState(s.checkpointCashInHand);
            keep('balder_checkpoint_cash', s.checkpointCashInHand);
          }
          if (s.projectionHorizonMonths) {
            setProjectionHorizonState(s.projectionHorizonMonths);
            keep('balder_projection_horizon', String(s.projectionHorizonMonths));
          }
          // Preferências de exibição (ex.: semana/mês) são só a lente de quem olha: o convidado mantém a dele
          if (s.viewPreferences && !viewing) {
            setViewPreferencesState(s.viewPreferences);
            keep('balder_view_prefs', s.viewPreferences);
          }
          if (s.archivedLoanGroups) {
            setArchivedLoanGroups(s.archivedLoanGroups);
            keep('balder_archived_loans', s.archivedLoanGroups);
          }
          if (s.natureDetailModes) {
            setNatureDetailModes(s.natureDetailModes);
            keep('balder_nature_detail_modes', s.natureDetailModes);
          }
          if (s.defaultTrackingScope) {
            setDefaultTrackingScopeState(s.defaultTrackingScope);
            keep('balder_default_scope', s.defaultTrackingScope);
          }
        }
      } catch (e) {
        console.warn('[FinancialContext] Falha no silentRefetch:', e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentRefetch();
      }
    };
    const handleFocus = () => {
      silentRefetch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    let channel: any = null;
    if (user && !user.isGuest && isSupabaseConfigured) {
      channel = supabase
        .channel(`balder-sync-${user.$id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.MOVEMENTS }, () => silentRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.SALARY_CONTRACTS }, () => silentRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.CHECKPOINTS }, () => silentRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ACCOUNTS }, () => silentRefetch())
        // Pagamentos dos itens das naturezas e configurações/acertos da conta compartilhada
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NATURES }, () => silentRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'account_settings' }, () => silentRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_planning' }, () => silentRefetch())
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (trailingRefetch !== null) window.clearTimeout(trailingRefetch);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  // Adicionar Movimentação

  return {  };
}
