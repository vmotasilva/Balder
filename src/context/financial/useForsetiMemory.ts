import { useCallback, useEffect, useRef, useState } from 'react';
import { ForsetiMemoryService, newMemory } from '../../services/forsetiMemoryService';
import { type ForsetiMemory, type MemoryDraft, MEMORY_LIMIT, findDuplicateMemory, parseMemory } from '../../utils/forsetiMemory';
import type { useCoreData } from './useCoreData';

type Deps = Pick<ReturnType<typeof useCoreData>, 'authUser'>;

/** Resultado de guardar uma memória: o motivo quando não guardou. */
export type SaveMemoryResult = { ok: true; memory: ForsetiMemory } | { ok: false; reason: 'DUPLICADA' | 'LIMITE' | 'INVALIDA' };

/** Memória da Forseti: o que a pessoa pediu para lembrar. É de quem usa (não do dono do planejamento aberto). */
export function useForsetiMemory({ authUser }: Deps) {
  const userId = authUser?.$id;
  const isGuest = !authUser || !!authUser.isGuest;
  const [memories, setMemories] = useState<ForsetiMemory[]>([]);
  const [localOnly, setLocalOnly] = useState(false);
  // A lista mais recente, para quem decide (duplicada, limite) logo depois de outra gravação
  const latest = useRef<ForsetiMemory[]>([]);
  const update = useCallback((list: ForsetiMemory[]) => {
    latest.current = list;
    setMemories(list);
  }, []);

  useEffect(() => {
    if (!userId) {
      update([]);
      return;
    }
    let alive = true;
    ForsetiMemoryService.list(userId, isGuest).then((list) => {
      if (!alive) return;
      update(list);
      setLocalOnly(ForsetiMemoryService.isLocalOnly(isGuest));
    });
    return () => {
      alive = false;
    };
  }, [userId, isGuest, update]);

  const saveForsetiMemory = useCallback(
    (draft: MemoryDraft): SaveMemoryResult => {
      const valid = parseMemory(draft);
      if (!userId || !valid) return { ok: false, reason: 'INVALIDA' };
      if (findDuplicateMemory(latest.current, valid)) return { ok: false, reason: 'DUPLICADA' };
      if (latest.current.length >= MEMORY_LIMIT) return { ok: false, reason: 'LIMITE' };
      const memory = newMemory(valid);
      update([memory, ...latest.current]);
      void ForsetiMemoryService.save(userId, isGuest, memory);
      return { ok: true, memory };
    },
    [userId, isGuest, update]
  );

  const updateForsetiMemory = useCallback(
    (id: string, draft: MemoryDraft): boolean => {
      const valid = parseMemory(draft);
      const current = latest.current.find((m) => m.id === id);
      if (!userId || !valid || !current) return false;
      const memory = { ...current, ...valid, updatedAt: new Date().toISOString() };
      update([memory, ...latest.current.filter((m) => m.id !== id)]);
      void ForsetiMemoryService.save(userId, isGuest, memory);
      return true;
    },
    [userId, isGuest, update]
  );

  const removeForsetiMemory = useCallback(
    (id: string) => {
      if (!userId) return;
      update(latest.current.filter((m) => m.id !== id));
      void ForsetiMemoryService.remove(userId, isGuest, id);
    },
    [userId, isGuest, update]
  );

  const clearForsetiMemories = useCallback(() => {
    if (!userId) return;
    update([]);
    void ForsetiMemoryService.clear(userId, isGuest);
  }, [userId, isGuest, update]);

  return {
    forsetiMemories: memories,
    forsetiMemoryLocalOnly: localOnly,
    saveForsetiMemory,
    updateForsetiMemory,
    removeForsetiMemory,
    clearForsetiMemories,
  };
}
