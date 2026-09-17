import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { EMOJI_CATEGORIES } from './NatureModal';
import type { FixedExpenseMapping } from '../types';
import { Check, Plus, Sparkles, Search, Calendar } from 'lucide-react';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  natureId: string;
  natureName: string;
  natureColor?: string;
  mappingToEdit?: FixedExpenseMapping | null;
  onSuccess?: (mappingId: string) => void;
}

export const MappingModal: React.FC<MappingModalProps> = ({
  isOpen,
  onClose,
  natureId,
  natureName,
  natureColor = '#06B6D4',
  mappingToEdit,
  onSuccess,
}) => {
  const { addMappingToNature, updateMapping } = useFinancial();

  const isEditing = !!mappingToEdit;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📋');
  const [dayOfMonth, setDayOfMonth] = useState<number | ''>('');

  const [activeCategory, setActiveCategory] = useState<string>('populares');
  const [searchFilter, setSearchFilter] = useState('');

  // Sincronizar estado quando abrir ou alterar mappingToEdit
  useEffect(() => {
    if (isOpen) {
      if (mappingToEdit) {
        setName(mappingToEdit.name || '');
        setIcon(mappingToEdit.icon || '📋');
        setDayOfMonth(mappingToEdit.dayOfMonth || '');
      } else {
        setName('');
        setIcon('📋');
        setDayOfMonth('');
      }
      setSearchFilter('');
    }
  }, [isOpen, mappingToEdit]);

  // Lista filtrada de emojis
  const displayedEmojis = useMemo(() => {
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      const all: string[] = [];
      EMOJI_CATEGORIES.forEach((cat) => {
        cat.emojis.forEach((e) => {
          if (!all.includes(e)) all.push(e);
        });
      });
      return all.filter((e) => e.includes(q) || q.includes(e));
    }

    const currentCat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return currentCat ? currentCat.emojis : EMOJI_CATEGORIES[0].emojis;
  }, [activeCategory, searchFilter]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Por favor, informe o nome do mapeamento.');
      return;
    }

    const chosenIcon = icon.trim() || '📋';
    const effectiveDay = dayOfMonth !== '' ? Number(dayOfMonth) : undefined;

    if (isEditing && mappingToEdit) {
      updateMapping(natureId, mappingToEdit.id, {
        name: trimmedName,
        icon: chosenIcon,
        dayOfMonth: effectiveDay,
      });
      if (onSuccess) onSuccess(mappingToEdit.id);
    } else {
      const newId = addMappingToNature(
        natureId,
        trimmedName,
        undefined,
        effectiveDay,
        chosenIcon
      );
      if (onSuccess) onSuccess(newId);
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Mapeamento de Gastos' : 'Novo Mapeamento de Gastos'}
      subtitle={`Natureza: ${natureName}`}
      maxWidth="600px"
    >
      <form onSubmit={handleSubmit} className="mapping-modal-form">
        {/* Card de Pré-visualização Dinâmica */}
        <div
          className="mapping-preview-card mb-4"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: `1px solid ${natureColor}40`,
            borderLeft: `5px solid ${natureColor}`,
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${natureColor}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: `0 0 14px ${natureColor}22`,
              flexShrink: 0,
            }}
          >
            {icon || '📋'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                {name.trim() || 'Nome do Mapeamento'}
              </span>
              {dayOfMonth ? (
                <span className="badge badge-amber text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={11} />
                  <span>Vence Dia {dayOfMonth}</span>
                </span>
              ) : (
                <span className="badge badge-cyan text-xs">Sem Vencimento Fixo</span>
              )}
            </div>
            <p
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
                margin: '2px 0 0',
              }}
            >
              Rotina vinculada à natureza {natureName}
            </p>
          </div>
        </div>

        {/* Linha 1: Nome do Mapeamento */}
        <div className="form-group mb-3">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nome do Mapeamento *</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Ex: Feira Semanal, Supermercado Mensal, Açougue
            </span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ex: Açougue & Carnes, Feira Livre, Energia Elétrica..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Linha 2: Dia Fixo de Vencimento no Mês */}
        <div className="form-group mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Calendar size={14} className="text-amber-400" />
            <span>Dia Fixo de Vencimento no Mês (Opcional)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min="1"
              max="31"
              className="form-input"
              style={{ width: '160px' }}
              placeholder="Ex: 10"
              value={dayOfMonth}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setDayOfMonth(isNaN(val) ? '' : Math.min(31, Math.max(1, val)));
              }}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm text-xs"
              onClick={() => setDayOfMonth(31)}
              title="Definir para o último dia do mês"
            >
              Fim do Mês (31)
            </button>
            {dayOfMonth !== '' && (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-muted"
                onClick={() => setDayOfMonth('')}
                title="Limpar dia de vencimento"
              >
                Limpar
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            O BALDER alertará com antecedência quando esta data estiver próxima para registrar a realização do pagamento.
          </span>
        </div>

        {/* Linha 3: Seletor Rico de Ícones (Emoji) do Mapeamento */}
        <div className="form-group mb-4">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              gap: '8px',
            }}
          >
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} className="text-cyan" />
              <span>Ícone / Emoji do Mapeamento</span>
            </label>

            {/* Input manual de emoji */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Selecionado:</span>
              <input
                type="text"
                className="form-input text-center"
                style={{
                  width: '54px',
                  height: '32px',
                  fontSize: '1.25rem',
                  padding: '2px',
                  fontWeight: 'bold',
                }}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                title="Você pode digitar ou colar qualquer emoji aqui (Win + .)"
              />
            </div>
          </div>

          {/* Abas de Categorias de Emoji */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              overflowX: 'auto',
              paddingBottom: '6px',
              marginBottom: '8px',
            }}
          >
            {EMOJI_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id && !searchFilter;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchFilter('');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '7px',
                    fontSize: '0.74rem',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: isActive ? '1px solid rgba(6, 182, 212, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: isActive ? '#38BDF8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Campo de Busca de Emojis */}
          <div
            style={{
              position: 'relative',
              marginBottom: '8px',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '32px' }}
              placeholder="Pesquisar emoji para este mapeamento..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          {/* Grade de Emojis */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))',
              gap: '6px',
              maxHeight: '160px',
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
            }}
          >
            {displayedEmojis.map((emojiChar, idx) => {
              const isSelected = icon === emojiChar;
              return (
                <button
                  key={`${emojiChar}_${idx}`}
                  type="button"
                  onClick={() => setIcon(emojiChar)}
                  style={{
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    borderRadius: '8px',
                    border: isSelected
                      ? '2px solid #06B6D4'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.25)'
                      : 'rgba(255, 255, 255, 0.03)',
                    boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1.18)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                  title={`Selecionar ${emojiChar}`}
                >
                  {emojiChar}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Escolha um emoji representativo para esta rotina (ex: 🥩 Açougue, 🥦 Feira, 🛒 Mercado, 💡 Luz, ⛽ Combustível).
          </span>
        </div>

        {/* Rodapé de Ações */}
        <div
          className="modal-footer-actions mt-4"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            borderTop: '1px solid var(--border-default)',
            paddingTop: '14px',
          }}
        >
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isEditing ? <Check size={16} /> : <Plus size={16} />}
            <span>{isEditing ? 'Salvar Alterações' : 'Criar Mapeamento'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
