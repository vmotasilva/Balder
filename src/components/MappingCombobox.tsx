import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, Plus, Circle, Check } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
  isSpecial?: boolean; // for NEW_ITEM / UNMAPPED_AVULSO
  isMatched?: boolean; // auto-matched by Forseti
}

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const MappingCombobox: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar mapeamento...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive display label from value
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? '';

  const normalise = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          normalise(o.label).includes(normalise(query)) ||
          normalise(o.sublabel ?? '').includes(normalise(query))
      )
    : options;

  // Group the filtered options
  const grouped: Record<string, ComboboxOption[]> = {};
  filtered.forEach((opt) => {
    const g = opt.group ?? 'Outros';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(opt);
  });

  const handleOpen = () => {
    setIsOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setQuery('');
  };

  // Close on outside click
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, handleOutsideClick]);

  // Icon based on type
  const iconFor = (opt: ComboboxOption) => {
    if (opt.value === 'NEW_ITEM_ZERO_QTY') return <Plus size={13} className="combo-opt-icon icon-plus" />;
    if (opt.value === 'UNMAPPED_AVULSO') return <Circle size={13} className="combo-opt-icon icon-muted" />;
    if (opt.isMatched) return <Check size={13} className="combo-opt-icon icon-emerald" />;
    return <span className="combo-opt-dot" />;
  };

  return (
    <div className="mapping-combobox" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`combo-trigger ${isOpen ? 'is-open' : ''} ${selectedOption?.isSpecial ? 'is-special' : ''} ${selectedOption?.isMatched ? 'is-matched' : ''}`}
        onClick={handleOpen}
      >
        <span className="combo-trigger-label">{displayLabel || <span className="combo-placeholder">{placeholder}</span>}</span>
        <ChevronDown size={14} className={`combo-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="combo-dropdown animate-slide-down">
          {/* Search input */}
          <div className="combo-search-wrap">
            <Search size={13} className="combo-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="combo-search-input"
              placeholder="Filtrar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setIsOpen(false); setQuery(''); }
                if (e.key === 'Enter' && filtered.length === 1) {
                  handleSelect(filtered[0].value);
                }
              }}
            />
          </div>

          {/* Options list */}
          <div className="combo-options-list">
            {Object.keys(grouped).length === 0 && (
              <div className="combo-empty">Nenhum resultado para "{query}"</div>
            )}
            {Object.entries(grouped).map(([group, opts]) => (
              <div key={group} className="combo-group">
                <div className="combo-group-label">{group}</div>
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`combo-option ${opt.value === value ? 'is-selected' : ''} ${opt.isSpecial ? 'is-special' : ''} ${opt.isMatched ? 'is-matched' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {iconFor(opt)}
                    <div className="combo-opt-text">
                      <span className="combo-opt-main">{opt.label}</span>
                      {opt.sublabel && <span className="combo-opt-sub">{opt.sublabel}</span>}
                    </div>
                    {opt.value === value && <Check size={12} className="combo-check-active" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
