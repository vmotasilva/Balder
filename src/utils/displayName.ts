import type { ViewPreferences } from '../types';

/** Como chamar a pessoa: o apelido escolhido ou, sem ele, o primeiro nome. */
export function displayName(fullName: string | undefined, prefs: ViewPreferences): string {
  const nickname = prefs.nickname?.trim();
  if (nickname) return nickname;
  return (fullName || '').trim().split(/\s+/)[0] || '';
}
