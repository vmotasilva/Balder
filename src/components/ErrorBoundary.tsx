import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadForNewVersion } from '../utils/staleBundle';

interface State {
  error: Error | null;
}

/** Evita a tela escura: um erro ao desenhar a tela vira uma mensagem com opção de recarregar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Balder] Erro ao exibir a tela:', error, info.componentStack);
    if (isChunkLoadError(error)) reloadForNewVersion();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading-screen" role="alert" style={{ flexDirection: 'column', gap: 16, textAlign: 'center', padding: 24 }}>
        <span>Algo saiu do esperado ao abrir esta tela.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 0, background: '#f59e0b', color: '#030712', fontWeight: 700, cursor: 'pointer' }}
        >
          Recarregar o Balder
        </button>
      </div>
    );
  }
}
