/** Indicação: o link ?ref=CODIGO leva quem chega a ficar ligado a quem compartilhou o Balder. */

const PENDING_KEY = 'balder_pending_referral';
const CODE_RE = /^[a-z0-9]{6,16}$/;

export const normalizeReferralCode = (v: string | null | undefined) => {
  const c = (v || '').trim().toLowerCase();
  return CODE_RE.test(c) ? c : '';
};

/** Guarda o código do link (?ref=) para quando a pessoa criar a conta ou entrar. */
export function capturePendingReferral(search: string = window.location.search): void {
  try {
    const code = normalizeReferralCode(new URLSearchParams(search).get('ref'));
    if (code) localStorage.setItem(PENDING_KEY, code);
  } catch {
    // sem armazenamento: a indicação não é registrada
  }
}

export const readPendingReferral = (): string => {
  try {
    return normalizeReferralCode(localStorage.getItem(PENDING_KEY));
  } catch {
    return '';
  }
};

export const clearPendingReferral = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // nada a limpar
  }
};

export const referralLink = (code: string, origin: string = window.location.origin) => `${origin}/?ref=${code}`;

export const REFERRAL_MESSAGE =
  'Estou usando o Balder para organizar meu dinheiro, com uma assistente de IA (a Forseti) que registra gastos e responde dúvidas. Experimenta:';
