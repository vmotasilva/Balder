import { SupabaseService } from '../../services/supabaseService';
import { canonicalBankName } from '../../utils/paymentInstitutions';
import { deduplicateCards, getCardIdentityKey } from '../../utils/cardUtils';
import { getBankBranding } from '../../utils/bankBranding';
import { monthDateKeepingDay } from '../../utils/cardPurchase';
import {
  type BankAccount, type BankInstitution, type CreditCardItem, type PaymentMethodItem,
} from '../../types';
import type { useCoreData } from './useCoreData';
import type { useMovementsAndGoals } from './useMovementsAndGoals';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'banks' | 'cards' | 'movements' | 'setAccounts' | 'setBanks' | 'setCards' |
    'setPaymentMethods' | 'user'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'deleteMovement' | 'updateMovement'
  >;

/** Contas, cartões, meios de pagamento e bancos. */
export function useBankEntities({
  banks, cards, deleteMovement, movements, setAccounts, setBanks, setCards, setPaymentMethods,
  updateMovement, user,
}: Deps) {
  const addAccount = (accountData: Omit<BankAccount, 'id'>) => {
    const newAcc: BankAccount = {
      ...accountData,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setAccounts((prev) => {
      const next = [...prev, newAcc];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.upsertAccount(newAcc).catch(console.error);
    }
  };

  const updateAccount = (id: string, updates: Partial<BankAccount>) => {
    let updatedAcc: BankAccount | null = null;
    setAccounts((prev) => {
      const next = prev.map((a: any) => {
        if (a.id === id) {
          updatedAcc = { ...a, ...updates };
          return updatedAcc;
        }
        return a;
      });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && updatedAcc) {
      SupabaseService.upsertAccount(updatedAcc).catch(console.error);
    }
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((a: any) => a.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deleteAccount(id).catch(console.error);
    }
  };

  // Gestão de Cartões de Crédito

  const addCard = (cardData: Omit<CreditCardItem, 'id'>) => {
    setCards((prev) => {
      const targetKey = getCardIdentityKey(cardData);
      const existingIndex = prev.findIndex((c) => getCardIdentityKey(c) === targetKey);

      let next: CreditCardItem[];
      if (existingIndex >= 0) {
        // Atualiza cartão existente mantendo o maior limite e saldo usado ao invés de duplicar
        next = [...prev];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          ...cardData,
          limitTotal: Math.max(existing.limitTotal || 0, cardData.limitTotal || 0),
          limitUsed: Math.max(existing.limitUsed || 0, cardData.limitUsed || 0),
        };
      } else {
        const newCard: CreditCardItem = {
          ...cardData,
          id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        };
        next = [...prev, newCard];
      }

      const deduplicated = deduplicateCards(next);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(deduplicated));
        SupabaseService.saveUserProfileSettings({ cards: deduplicated }).catch(console.error);
      }
      return deduplicated;
    });
  };

  const mergeAndCleanDuplicateCards = () => {
    setCards((prev) => {
      const cleaned = deduplicateCards(prev);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(cleaned));
        SupabaseService.saveUserProfileSettings({ cards: cleaned }).catch(console.error);
      }
      return cleaned;
    });
  };

  const updateCard = (id: string, updates: Partial<CreditCardItem>) => {
    setCards((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ cards: next }).catch(console.error);
      }
      return next;
    });
  };

  const deleteCard = (id: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ cards: next }).catch(console.error);
      }
      return next;
    });
  };

  // Gestão de Formas de Pagamento

  const addPaymentMethod = (methodData: Omit<PaymentMethodItem, 'id'>) => {
    const newMethod: PaymentMethodItem = {
      ...methodData,
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setPaymentMethods((prev) => {
      const next = [...prev, newMethod];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.upsertPaymentMethod(newMethod).catch(console.error);
    }
  };

  const updatePaymentMethod = (id: string, updates: Partial<PaymentMethodItem>) => {
    let updatedPm: PaymentMethodItem | null = null;
    setPaymentMethods((prev) => {
      const next = prev.map((pm) => {
        if (pm.id === id) {
          updatedPm = { ...pm, ...updates };
          return updatedPm;
        }
        return pm;
      });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && updatedPm) {
      SupabaseService.upsertPaymentMethod(updatedPm).catch(console.error);
    }
  };

  const deletePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => {
      const next = prev.filter((pm) => pm.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deletePaymentMethod(id).catch(console.error);
    }
  };

  // Gestão de Bancos / Instituições

  const addBank = (bankData: Omit<BankInstitution, 'id'>) => {
    const newBank: BankInstitution = {
      ...bankData,
      id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      syncedAt: bankData.syncedAt || 'Recém-adicionado',
    };
    setBanks((prev) => {
      const next = [...prev, newBank];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  const updateBank = (id: string, updates: Partial<BankInstitution>) => {
    setBanks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  const setBankInvoiceTerms = (bankName: string, terms: { closingDay?: number; dueDay?: number }) => {
    const name = bankName.trim();
    const existing = banks.find((b) => b.name.trim().toLowerCase() === name.toLowerCase());
    const patch: Partial<BankInstitution> = {
      ...(terms.closingDay ? { closingDay: terms.closingDay } : {}),
      ...(terms.dueDay ? { dueDay: terms.dueDay } : {}),
    };
    if (existing) updateBank(existing.id, patch);
    else addBank({ name, color: getBankBranding(name).primaryColor, icon: '🏦', status: 'MANUAL', ...patch });
  };

  const setBankCreditUsed = (bankName: string, used: boolean) => {
    const name = bankName.trim();
    const existing = banks.find((b) => b.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) updateBank(existing.id, { noCredit: !used });
    else addBank({ name, color: getBankBranding(name).primaryColor, icon: '🏦', status: 'MANUAL', noCredit: !used });
  };

  const applyBankDueDayToOpenInvoices = (bankName: string, dueDay: number): number => {
    let changed = 0;
    movements.forEach((m) => {
      if (m.type !== 'CARTAO' || m.status !== 'PREVISTA') return;
      if (canonicalBankName(m.bank, banks, cards).toLowerCase() !== bankName.trim().toLowerCase()) return;
      const [y, mo] = m.dueDate.split('-').map((n) => parseInt(n, 10));
      const next = monthDateKeepingDay(y, mo - 1, dueDay);
      if (next === m.dueDate) return;
      updateMovement(m.id, { dueDate: next });
      changed += 1;
    });
    return changed;
  };

  const consolidateCardNamedInvoices = (): number => {
    let fixed = 0;
    const absorbed = new Set<string>();
    movements.forEach((m) => {
      if (m.type !== 'CARTAO' || absorbed.has(m.id)) return;
      const canonical = canonicalBankName(m.bank, banks, cards);
      if (!canonical || canonical === m.bank) return;
      const target = movements.find(
        (t) =>
          t.id !== m.id &&
          !absorbed.has(t.id) &&
          t.type === 'CARTAO' &&
          t.status === m.status &&
          t.bank === canonical &&
          t.dueDate.slice(0, 7) === m.dueDate.slice(0, 7)
      );
      if (target) {
        updateMovement(target.id, {
          amount: Math.round((target.amount + m.amount) * 100) / 100,
          invoiceBreakdown: [...(target.invoiceBreakdown || []), ...(m.invoiceBreakdown || [])],
          unanalyzedAmount: Math.round(((target.unanalyzedAmount || 0) + (m.unanalyzedAmount || 0)) * 100) / 100,
        });
        absorbed.add(m.id);
        deleteMovement(m.id);
      } else {
        updateMovement(m.id, { bank: canonical, title: m.title.replace(m.bank || '', canonical) });
      }
      fixed += 1;
    });
    return fixed;
  };

  const deleteBank = (id: string) => {
    setBanks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  // Eventos Críticos Sentinela dinâmicos com base nas movimentações reais

  return {
    addAccount, updateAccount, deleteAccount, addCard, mergeAndCleanDuplicateCards, updateCard,
    deleteCard, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, addBank, updateBank,
    setBankInvoiceTerms, setBankCreditUsed, applyBankDueDayToOpenInvoices,
    consolidateCardNamedInvoices, deleteBank,
  };
}
