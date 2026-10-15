/**
 * Contas já conectadas neste aparelho, para alternar entre e-mails sem digitar tudo de novo.
 * Guarda a sessão do Supabase de cada conta (o mesmo que o Supabase já mantém no localStorage para a conta ativa).
 */

export interface SavedAccount {
  id: string;
  email: string;
  name: string;
  access_token: string;
  refresh_token: string;
  savedAt: number;
}

const KEY = 'balder_saved_accounts_v1';

export function listSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.id && a.refresh_token) : [];
  } catch {
    return [];
  }
}

function write(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    /* sem armazenamento: a alternância simplesmente não lembra a conta */
  }
}

/** Insere ou atualiza a conta (os tokens mudam a cada renovação de sessão). */
export function upsertSavedAccount(account: Omit<SavedAccount, 'savedAt'>): SavedAccount[] {
  const rest = listSavedAccounts().filter((a) => a.id !== account.id);
  const next = [...rest, { ...account, savedAt: Date.now() }];
  write(next);
  return next;
}

export function removeSavedAccount(id: string): SavedAccount[] {
  const next = listSavedAccounts().filter((a) => a.id !== id);
  write(next);
  return next;
}
