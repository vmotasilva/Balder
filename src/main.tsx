import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Permite que clicar em qualquer parte de um campo de data ou mês abra o picker/calendário nativo
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target instanceof HTMLInputElement && (target.type === 'date' || target.type === 'month')) {
      try {
        target.showPicker();
      } catch {
        // Fallback silencioso caso não suportado
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
