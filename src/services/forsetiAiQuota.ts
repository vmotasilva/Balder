import { useSyncExternalStore } from 'react';

/**
 * Quanto resta do limite por hora de pedidos à IA da Forseti (api/forseti-intent). O servidor informa em cada resposta;
 * o aplicativo guarda o último valor para avisar a pessoa antes de acabar. Vale por uma hora: depois disso o limite já voltou.
 */

export interface AiQuota {
  remaining: number;
  limit: number;
  /** Quando foi medido (ms). */
  at: number;
}

export const QUOTA_VALID_MS = 3600_000;
/** A partir daqui o aplicativo mostra quanto resta. */
export const QUOTA_WARN_AT = 10;

let current: AiQuota | null = null;
const listeners = new Set<() => void>();

let expiry: ReturnType<typeof setTimeout> | undefined;

export function setAiQuota(quota: AiQuota | null): void {
  current = quota;
  if (expiry) clearTimeout(expiry);
  // Passada uma hora o limite já voltou: o aviso some sozinho
  if (quota) {
    expiry = setTimeout(() => {
      if (current === quota) setAiQuota(null);
    }, QUOTA_VALID_MS);
    (expiry as { unref?: () => void }).unref?.();
  }
  listeners.forEach((l) => l());
}

/** Lê os cabeçalhos da resposta e guarda o saldo; ignora respostas sem eles ou com valores estranhos. */
export function readAiQuota(headers: Pick<Headers, 'get'>, now: number = Date.now()): void {
  const rawRemaining = headers.get('X-Forseti-Ai-Remaining');
  const rawLimit = headers.get('X-Forseti-Ai-Limit');
  // Só números inteiros: um cabeçalho vazio ou com lixo não pode virar "saldo zero"
  if (rawRemaining === null || rawLimit === null || !/^\d+$/.test(rawRemaining.trim()) || !/^\d+$/.test(rawLimit.trim())) return;
  const remaining = Number(rawRemaining);
  const limit = Number(rawLimit);
  if (limit <= 0 || remaining > limit) return;
  setAiQuota({ remaining, limit, at: now });
}

/** O último saldo medido, ou null se não há ou se já passou uma hora. */
export function currentAiQuota(now: number = Date.now()): AiQuota | null {
  return current && now - current.at < QUOTA_VALID_MS ? current : null;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** O saldo da IA na tela. */
export function useAiQuota(): AiQuota | null {
  return useSyncExternalStore(subscribe, () => current);
}

/** Texto curto do saldo, só quando já vale avisar (poucos pedidos sobrando ou nenhum). */
export function quotaNotice(quota: AiQuota | null): string | null {
  if (!quota || quota.remaining > QUOTA_WARN_AT) return null;
  return quota.remaining === 0
    ? 'IA: limite desta hora atingido'
    : `IA: ${quota.remaining} ${quota.remaining === 1 ? 'pedido restante' : 'pedidos restantes'} nesta hora`;
}
