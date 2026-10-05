import { SupabaseService } from '../../services/supabaseService';
import { TABLES } from '../../lib/supabase';
import {
  type DataFormatCategory, type Movement, type MovementType, type UserProfileSettings,
} from '../../types';
import type { useCoreData } from './useCoreData';
import type { useCheckpoints } from './useCheckpoints';
import type { useSharedPlanning } from './useSharedPlanning';
import type { usePreferences } from './usePreferences';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'lastLocalNatureMutationRef' | 'setAccounts' | 'setBanks' | 'setCards' | 'setGoals' |
    'setMovements' | 'setNatures' | 'setPaymentMethods' | 'user'
  > &
  Pick<ReturnType<typeof useCheckpoints>,
    'setCheckpoints' | 'setMonthlyClosings'
  > &
  Pick<ReturnType<typeof useSharedPlanning>,
    'setSharedScenario' | 'setSharedSettlements'
  > &
  Pick<ReturnType<typeof usePreferences>,
    'natureDetailModesKey' | 'setNatureDetailModes'
  >;

/** Formatar dados: apaga estado, caches locais e nuvem dos grupos escolhidos. */
export function useFormatUserData({
  lastLocalNatureMutationRef, natureDetailModesKey, setAccounts, setBanks, setCards,
  setCheckpoints, setGoals, setMonthlyClosings, setMovements, setNatureDetailModes, setNatures,
  setPaymentMethods, setSharedScenario, setSharedSettlements, user,
}: Deps) {
  const formatUserData = async (categories: DataFormatCategory[]): Promise<boolean> => {
    if (categories.length === 0) return true;
    const has = (c: DataFormatCategory) => categories.includes(c);
    const uid = user?.$id;
    const isCloud = !!user && !user.isGuest;
    const userKey = (prefix: string) => (uid ? `${prefix}_${uid}` : null);

    const removeKeys = (...keys: (string | null)[]) => {
      keys.forEach((k) => {
        if (!k) return;
        try {
          localStorage.removeItem(k);
        } catch {}
      });
    };
    const writeKey = (key: string | null, value: unknown) => {
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    };

    // Exclusões na nuvem são adiadas (thunks) para rodar só depois de gravar o perfil
    const cloudOps: (() => Promise<boolean>)[] = [];
    const profilePatch: Partial<UserProfileSettings> = {};

    // Movimentações: a pagar/receber, faturas de cartão e empréstimos
    const movementTypes: MovementType[] = [
      ...(has('MOVIMENTACOES') ? (['PAGAR', 'RECEBER'] as MovementType[]) : []),
      ...(has('FATURAS') ? (['CARTAO'] as MovementType[]) : []),
      ...(has('EMPRESTIMOS') ? (['EMPRESTIMO'] as MovementType[]) : []),
    ];
    if (movementTypes.length > 0) {
      const keep = (m: Movement) => !movementTypes.includes(m.type);
      setMovements((prev) => prev.filter(keep));
      [userKey('balder_movements'), 'balder_movements_guest'].forEach((key) => {
        if (!key) return;
        try {
          const cached = localStorage.getItem(key);
          if (cached) writeKey(key, (JSON.parse(cached) as Movement[]).filter(keep));
        } catch {}
      });
      if (isCloud) cloudOps.push(() => SupabaseService.deleteMovementsByTypes(movementTypes));
    }

    if (has('MARCOS')) {
      setCheckpoints([]);
      removeKeys(userKey('balder_checkpoints'), 'balder_checkpoints_guest');
      if (isCloud) {
        cloudOps.push(() => SupabaseService.deleteAllUserRows(TABLES.CHECKPOINTS));
        profilePatch.checkpoints = [];
      }
    }

    if (has('FECHAMENTOS')) {
      setMonthlyClosings([]);
      removeKeys(userKey('balder_monthly_closings'), 'balder_monthly_closings_guest');
      if (isCloud) profilePatch.monthlyClosings = [];
    }

    if (has('NATUREZAS')) {
      lastLocalNatureMutationRef.current = Date.now();
      setNatures([]);
      setNatureDetailModes({});
      removeKeys(natureDetailModesKey);
      if (isCloud) profilePatch.natureDetailModes = {};
      removeKeys(
        userKey('balder_natures_backup'),
        userKey('balder_deleted_natures'),
        'balder_natures',
        'balder_natures_guest',
        'balder_deleted_natures_guest'
      );
      // Grava lista vazia explícita (sem ela, o estado inicial recorreria aos backups)
      writeKey(userKey('balder_natures'), []);
      if (isCloud) cloudOps.push(() => SupabaseService.deleteAllUserRows(TABLES.NATURES));
    }

    if (has('CONTAS')) {
      setAccounts([]);
      setPaymentMethods([]);
      removeKeys(
        userKey('balder_accounts'),
        'balder_accounts_guest',
        userKey('balder_payment_methods'),
        'balder_payment_methods_guest'
      );
      if (isCloud) {
        cloudOps.push(() => SupabaseService.deleteAllUserRows(TABLES.ACCOUNTS));
        cloudOps.push(() => SupabaseService.deleteAllUserRows(TABLES.PAYMENT_METHODS));
      }
    }

    if (has('CARTOES')) {
      setCards([]);
      removeKeys(userKey('balder_cards'), 'balder_cards_guest');
      if (isCloud) profilePatch.cards = [];
    }

    if (has('BANCOS')) {
      setBanks([]);
      removeKeys(userKey('balder_banks'), 'balder_banks_guest');
      if (isCloud) profilePatch.banks = [];
    }

    if (has('METAS')) {
      setGoals([]);
      if (isCloud) cloudOps.push(() => SupabaseService.deleteAllUserRows(TABLES.GOALS));
    }

    if (has('COMPARTILHADO')) {
      setSharedScenario(null);
      setSharedSettlements([]);
      // Valores vazios explícitos: sem eles o estado inicial recria o cenário de demonstração
      writeKey(isCloud ? userKey('balder_shared_scenario') : 'balder_shared_scenario', null);
      writeKey(isCloud ? userKey('balder_shared_settlements') : 'balder_shared_settlements', []);
      if (isCloud) {
        profilePatch.sharedScenario = null;
        profilePatch.sharedSettlements = [];
      }
    }

    if (!isCloud) return true;

    // 1º o perfil (listas vazias + formattedAt): as exclusões abaixo disparam o realtime/silentRefetch,
    // que não pode encontrar no perfil as cópias antigas e restaurá-las.
    let profileSaved = false;
    try {
      const current = await SupabaseService.getUserProfileSettings();
      const now = new Date().toISOString();
      profilePatch.formattedAt = {
        ...(current?.formattedAt || {}),
        ...Object.fromEntries(categories.map((c) => [c, now])),
      };
      profileSaved = await SupabaseService.saveUserProfileSettings(profilePatch);
    } catch (e) {
      console.error('[Formatar Dados] Erro ao salvar perfil:', e);
    }

    // 2º as linhas nas tabelas
    const results = await Promise.all(cloudOps.map((run) => run()));
    return profileSaved && results.every(Boolean);
  };

  return { formatUserData };
}
