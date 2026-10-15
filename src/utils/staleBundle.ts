const RELOAD_KEY = 'balder_stale_bundle_reload';
// Evita laço de recarregamentos se o erro persistir (ex.: sem internet)
const RELOAD_WINDOW_MS = 30_000;

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return CHUNK_ERROR.test(message);
}

/** Recarrega a página para buscar a versão nova do app. Devolve false se já recarregou há pouco. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim
  }
  window.location.reload();
  return true;
}

/** Aba aberta há muito tempo: depois de um deploy, os arquivos antigos deixam de existir. */
export function installStaleBundleRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
