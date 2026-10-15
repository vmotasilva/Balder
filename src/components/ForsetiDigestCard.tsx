import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { Digest } from '../utils/forsetiDigest';

interface ForsetiDigestCardProps {
  digest: Digest;
  onDismiss: () => void;
  /** Abre o chat da Forseti para a pessoa seguir a conversa. */
  onOpenForseti: () => void;
}

/** Negrito (**texto**) dos tópicos do briefing, sem HTML cru. */
const renderBold = (line: string) =>
  line.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );

/** Briefing do dia no Início: aparece uma vez por dia e a pessoa dispensa com "Entendi". */
export const ForsetiDigestCard: React.FC<ForsetiDigestCardProps> = ({ digest, onDismiss, onOpenForseti }) => (
  <section className="home-digest" aria-label="Resumo do dia pela Forseti">
    <header className="home-digest-head">
      <Sparkles size={16} className="text-cyan" aria-hidden="true" />
      <strong>Resumo do dia</strong>
      <button type="button" className="home-digest-close" onClick={onDismiss} aria-label="Dispensar o resumo de hoje" title="Dispensar">
        <X size={16} />
      </button>
    </header>
    <ul className="home-digest-list">
      {digest.items.map((item, i) => (
        <li key={i} className={`is-${item.tone}`}>
          {renderBold(item.text)}
        </li>
      ))}
    </ul>
    <div className="home-digest-actions">
      <button type="button" className="btn btn-outline btn-sm" onClick={onOpenForseti}>
        Conversar com a Forseti
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onDismiss}>
        Entendi
      </button>
    </div>
  </section>
);
