import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlans, scopedUserId } from '../context/PlanScopeContext';
import type { OnboardingStepAudit } from './onboardingProgress';
import type { SetupTopic } from './setupCatalog';

type StepId = OnboardingStepAudit['id'];

/** Assunto da conversa de configuração → pilar da auditoria que ele conclui. */
const STEP_OF_TOPIC: Partial<Record<SetupTopic, StepId>> = {
  INICIO: 'checkpoint',
  CARTOES: 'invoices',
  NATUREZAS: 'natures',
  MAPEAMENTOS: 'ai_mappings',
};

const EVENT = 'balder-setup-acknowledged';
const keyOf = (scope: string) => `balder_setup_acknowledged_${scope}`;

function read(scope: string): StepId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyOf(scope)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function useScope(): string {
  const { user } = useAuth();
  const { activePlanId } = usePlans();
  return user && !user.isGuest ? scopedUserId(user.$id, activePlanId) : 'guest';
}

/**
 * Pilares que a pessoa deu por concluídos na conversa de configuração (por exemplo, por já ter montado tudo
 * à mão): deixam de aparecer como pendência mesmo que os dados não cumpram todos os critérios da auditoria.
 */
export function useAcknowledgedSteps() {
  const scope = useScope();
  const [acknowledged, setAcknowledged] = useState<StepId[]>(() => read(scope));

  useEffect(() => {
    const sync = () => setAcknowledged(read(scope));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [scope]);

  const acknowledgeTopic = useCallback(
    (topic: SetupTopic) => {
      const step = STEP_OF_TOPIC[topic];
      if (!step) return;
      const current = read(scope);
      if (current.includes(step)) return;
      try {
        localStorage.setItem(keyOf(scope), JSON.stringify([...current, step]));
      } catch {
        /* sem armazenamento: vale só até fechar a conversa */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [scope]
  );

  return { acknowledged, acknowledgeTopic };
}
