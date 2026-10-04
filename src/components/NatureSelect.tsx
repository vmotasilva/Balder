import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Search } from 'lucide-react';

export interface NatureSelectOption {
  id: string;
  title: string;
  amount: number;
  /** Alerta da natureza: acima do teto ou valor atípico. */
  attention?: 'OVER_CEILING' | 'ATYPICAL';
  /** Texto extra que a busca também procura (categoria, banco, itens). */
  searchText?: string;
}

interface Props {
  options: NatureSelectOption[];
  /** 'ALL' = todas as naturezas. */
  value: string;
  allLabel: string;
  allAmount: number;
  /** Resumo da visão geral (ex.: "12 datas · 30 itens"). */
  allHint?: string;
  onChange: (id: string) => void;
  formatAmount: (v: number) => string;
}

/** Filtro de natureza: um seletor com busca, no lugar de uma fila de abas com rolagem. */
export const NatureSelect: React.FC<Props> = ({ options, value, allLabel, allAmount, allHint, onChange, formatAmount }) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const sorted = useMemo(() => [...options].sort((a, b) => b.amount - a.amount), [options]);
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return sorted;
    return sorted.filter((o) => `${o.title} ${o.searchText || ''}`.toLowerCase().includes(t));
  }, [sorted, term]);

  const selected = options.find((o) => o.id === value);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setTerm('');
  };

  return (
    <div className="nature-select" ref={rootRef}>
      <button type="button" className="nature-select-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="nature-select-label">Natureza</span>
        <strong className="truncate">{selected ? selected.title : allLabel}</strong>
        <span className="nature-select-amount">{formatAmount(selected ? selected.amount : allAmount)}</span>
        <ChevronDown size={15} className={open ? 'is-open' : ''} aria-hidden="true" />
      </button>
      {open && (
        <div className="nature-select-menu" role="listbox">
          <div className="nature-select-search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus type="text" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar natureza ou item..." />
          </div>
          <div className="nature-select-list">
            {!term.trim() && (
              <button type="button" role="option" aria-selected={value === 'ALL'} className={`nature-select-option ${value === 'ALL' ? 'active' : ''}`} onClick={() => pick('ALL')}>
                <span className="nature-select-option-main">
                  <strong>{allLabel}</strong>
                  {allHint && <small>{allHint}</small>}
                </span>
                <span className="nature-select-amount">{formatAmount(allAmount)}</span>
              </button>
            )}
            {shown.map((o) => (
              <button type="button" key={o.id} role="option" aria-selected={value === o.id} className={`nature-select-option ${value === o.id ? 'active' : ''}`} onClick={() => pick(o.id)}>
                <span className="nature-select-option-main">
                  <strong>{o.title}</strong>
                  {o.attention && (
                    <small className={o.attention === 'OVER_CEILING' ? 'rose' : 'amber'}>
                      <AlertTriangle size={10} aria-hidden="true" /> {o.attention === 'OVER_CEILING' ? 'Estouro' : 'Atípico'}
                    </small>
                  )}
                </span>
                <span className="nature-select-amount">{formatAmount(o.amount)}</span>
              </button>
            ))}
            {shown.length === 0 && <div className="nature-select-empty">Nenhuma natureza encontrada para "{term}"</div>}
          </div>
        </div>
      )}
    </div>
  );
};
