import {
  DEMO_ACCOUNTS, DEMO_BANKS, DEMO_CARDS, DEMO_GOALS, DEMO_MOVEMENTS, DEMO_NATURES,
  DEMO_PAYMENT_METHODS,
} from '../../utils/demoData';
import { deduplicateCards } from '../../utils/cardUtils';
import { scopedUserId, usePlans } from '../PlanScopeContext';
import {
  type BankAccount, type BankInstitution, type CreditCardItem, type ExpenseNature, type Goal,
  type Movement, type PaymentMethodItem,
} from '../../types';
import { useAccountScope } from '../AccountScopeContext';
import { useAuth } from '../AuthContext';
import { useMemo, useRef, useState } from 'react';

/** Identidade, escopo da conta e estado base (contas, cartões, meios de pagamento, bancos, lançamentos, metas e naturezas). */
export function useCoreData() {
  const { user: authUser } = useAuth();

  const { viewing } = useAccountScope();

  const { activePlanId } = usePlans();
  // Conta em uso: ao abrir uma conta compartilhada, os dados e os caches locais passam a ser os do dono
  // Só a troca de conta recarrega os dados (papel, permissões e conta principal não)

  const viewingOwnerId = viewing?.ownerId;

  const viewingOwnerName = viewing?.ownerName;
  // Planejamento próprio extra: os caches locais passam a ser os dele (`usuário__plano`); no servidor o user_id
  // continua sendo o do usuário e o plano é filtrado pelo supabaseService.

  const user = useMemo(() => {
    if (authUser && viewingOwnerId) return { ...authUser, $id: viewingOwnerId, name: viewingOwnerName || authUser.name };
    if (authUser && !authUser.isGuest && activePlanId) return { ...authUser, $id: scopedUserId(authUser.$id, activePlanId) };
    return authUser;
  }, [authUser, viewingOwnerId, viewingOwnerName, activePlanId]);

  // Se o usuário está autenticado na nuvem via Supabase, a fonte de verdade é a sua conta real

  const isCloudUser = !!user && !user.isGuest;

  // Flag que indica se os dados já foram carregados da nuvem.
  // Enquanto false, o dashboard não deve renderizar valores (evita flash de DEMO).

  const [isDataReady, setIsDataReady] = useState(!isCloudUser); // guest = já pronto

  // Contas Bancárias (armazenadas por usuário)

  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_accounts_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_ACCOUNTS;
  });

  // Cartões de Crédito (armazenados por usuário)

  const [cards, setCards] = useState<CreditCardItem[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_cards_${user.$id}`);
        return saved ? deduplicateCards(JSON.parse(saved)) : [];
      } catch {
        return [];
      }
    }
    return deduplicateCards(DEMO_CARDS);
  });

  // Formas de Pagamento (armazenadas por usuário)

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_payment_methods_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_PAYMENT_METHODS;
  });

  // Bancos / Instituições (armazenados por usuário)

  const [banks, setBanks] = useState<BankInstitution[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_banks_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_BANKS;
  });

  // Marcos de Acompanhamento Financeiro

  const [movements, setMovements] = useState<Movement[]>(() => (isCloudUser ? [] : DEMO_MOVEMENTS));

  // Metas Financeiras

  const [goals, setGoals] = useState<Goal[]>(() => (isCloudUser ? [] : DEMO_GOALS));

  // Naturezas Orçamentárias

  const [natures, setNatures] = useState<ExpenseNature[]>(() => {
    if (!isCloudUser) {
      try {
        const guestNatures = localStorage.getItem('balder_natures_guest');
        if (guestNatures) return JSON.parse(guestNatures);
      } catch {}
      return DEMO_NATURES;
    }
    if (user && !user.isGuest) {
      try {
        const userNatures = localStorage.getItem(`balder_natures_${user.$id}`);
        if (userNatures) return JSON.parse(userNatures);
        const backupNatures =
          localStorage.getItem(`balder_natures_backup_${user.$id}`) ||
          localStorage.getItem('balder_natures');
        if (backupNatures) return JSON.parse(backupNatures);
      } catch {}
    }
    return [];
  });

  // Timestamp da última mutação local em naturezas (protege contra race condition com leituras atrasadas do Supabase)

  const lastLocalNatureMutationRef = useRef<number>(0);

  // Gestão de Contas Bancárias

  return {
    authUser, viewing, user, isDataReady, setIsDataReady, accounts, setAccounts, cards, setCards,
    paymentMethods, setPaymentMethods, banks, setBanks, movements, setMovements, goals, setGoals,
    natures, setNatures, lastLocalNatureMutationRef,
  };
}
