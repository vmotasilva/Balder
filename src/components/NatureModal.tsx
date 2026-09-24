import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { ExpenseNature } from '../types';
import { Check, Plus, Sparkles, Search, X } from 'lucide-react';

interface NatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  natureToEdit?: ExpenseNature | null;
  onSuccess?: (natureId: string) => void;
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'populares',
    name: 'Populares',
    icon: '⭐',
    emojis: [
      '🛒', '🥗', '🍖', '🍕', '☕', '🏠', '💡', '💧', '🚗', '⛽',
      '💊', '🏥', '🎬', '🎮', '🏖️', '📚', '💻', '💼', '👶', '🐾',
      '💰', '💳', '🏦', '🏷️', '💎', '🎯', '🛡️', '🧾', '🪙', '🎁',
    ],
  },
  {
    id: 'alimentacao',
    name: 'Alimentação & Bebidas',
    icon: '🛒',
    emojis: [
      '🛒', '🥗', '🍖', '🥩', '🍗', '🍕', '🍔', '🍟', '🥪', '🍞',
      '🥖', '🧀', '🍳', '☕', '🍵', '🧃', '🥤', '🍷', '🍺', '🍻',
      '🍎', '🍌', '🍇', '🍓', '🥑', '🥦', '🥕', '🌽', '🍣', '🍜',
      '🍝', '🍦', '🍩', '🍫', '🎂', '🍿', '🧁', '🍪', '🧂', '🥢',
    ],
  },
  {
    id: 'moradia',
    name: 'Moradia & Contas',
    icon: '🏠',
    emojis: [
      '🏠', '🏡', '🏢', '🛋️', '🛏️', '🚪', '🪟', '💡', '🔦', '💧',
      '🔌', '⚡', '🧹', '🧽', '🧺', '🚿', '🛁', '🔑', '📦', '🪴',
      '🔧', '🔨', '🛠️', '🧰', '🧱', '🪜', '🪑', '📡', '📶', '🔥',
    ],
  },
  {
    id: 'transporte',
    name: 'Transporte & Carro',
    icon: '🚗',
    emojis: [
      '🚗', '🚙', '🏎️', '⛽', '🛞', '🅿️', '🚌', '🚎', '🚇', '🚆',
      '🚅', '🚲', '🛴', '🛵', '🏍️', '🚕', '✈️', '🛫', '🛳️', '🚢',
      '🚁', '🚦', '🛑', '🛣️', '🎫', '🧰', '🔧', '🧽', '🏎️', '🚊',
    ],
  },
  {
    id: 'saude',
    name: 'Saúde & Cuidados',
    icon: '💊',
    emojis: [
      '💊', '💉', '🩹', '🩺', '🏥', '🚑', '🦷', '👓', '🧘', '🏋️',
      '🏃', '🚴', '🏊', '💆', '💈', '🧴', '🧼', '💄', '💅', '🌸',
      '🍏', '🧬', '🔬', '🌡️', '🧠', '❤️', '🩺', '🛡️', '🧖', '🩻',
    ],
  },
  {
    id: 'lazer',
    name: 'Lazer & Cultura',
    icon: '🎬',
    emojis: [
      '🎬', '🎮', '🕹️', '🏖️', '🏝️', '🎸', '🎹', '🎧', '🎤', '🎟️',
      '🎫', '⚽', '🏀', '🎾', '🏐', '🎳', '🏕️', '⛺', '🎣', '🎨',
      '🖌️', '📸', '📹', '🍿', '🎪', '🎡', '🎢', '🎲', '🧩', '🃏',
      '🏊', '🏄', '🛹', '🗺️', '✈️', '🧳', '🍹', '🎈', '🎆', '🔮',
    ],
  },
  {
    id: 'educacao',
    name: 'Educação & Trabalho',
    icon: '📚',
    emojis: [
      '📚', '📖', '🎓', '🎒', '💻', '🖥️', '💼', '📁', '📂', '📝',
      '📋', '🖋️', '✏️', '📌', '📎', '📊', '📈', '📉', '🖨️', '📱',
      '⌨️', '🖱️', '🧠', '💡', '⚖️', '📐', '🔬', '🌐', '📡', '📜',
    ],
  },
  {
    id: 'familia',
    name: 'Família, Pets & Pessoal',
    icon: '👶',
    emojis: [
      '👶', '🧒', '👧', '👦', '👪', '🍼', '🧸', '🚼', '🐶', '🐕',
      '🐱', '🐈', '🐾', '🦜', '🐠', '🐹', '🐰', '🦴', '🎁', '🎂',
      '🎉', '💍', '👗', '👕', '👔', '👠', '👟', '🕶️', '👜', '🎒',
    ],
  },
  {
    id: 'financas',
    name: 'Finanças & Metas',
    icon: '💰',
    emojis: [
      '💰', '💵', '💳', '🏦', '🪙', '💎', '🏷️', '🎯', '🛡️', '🧾',
      '⚖️', '🔒', '🔑', '📊', '📈', '💹', '💸', '🤑', '🤝', '⭐',
    ],
  },
];

export const COLOR_PALETTE = [
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#14B8A6', // Teal
  '#64748B', // Slate
  '#E2E8F0', // White/Light
];

export const NatureModal: React.FC<NatureModalProps> = ({
  isOpen,
  onClose,
  natureToEdit,
  onSuccess,
}) => {
  const { addNature, updateNature } = useFinancial();

  const isEditing = !!natureToEdit;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState('#10B981');
  const [type, setType] = useState<'ESSENCIAL' | 'FIXA' | 'VARIAVEL'>('ESSENCIAL');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  const [activeCategory, setActiveCategory] = useState<string>('populares');
  const [searchFilter, setSearchFilter] = useState('');

  // Sincronizar estado quando abrir ou mudar natureToEdit
  useEffect(() => {
    if (isOpen) {
      if (natureToEdit) {
        setName(natureToEdit.name || '');
        setIcon(natureToEdit.icon || '🏷️');
        setColor(natureToEdit.color || '#10B981');
        setType(natureToEdit.type || 'ESSENCIAL');
        setDescription(natureToEdit.description || '');
        setKeywords(natureToEdit.keywords || []);
      } else {
        setName('');
        setIcon('🏷️');
        setColor('#10B981');
        setType('ESSENCIAL');
        setDescription('');
        setKeywords([]);
      }
      setKeywordInput('');
      setSearchFilter('');
    }
  }, [isOpen, natureToEdit]);

  // Lista filtrada de emojis
  const displayedEmojis = useMemo(() => {
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      // Procura em todas as categorias
      const all: string[] = [];
      EMOJI_CATEGORIES.forEach((cat) => {
        cat.emojis.forEach((e) => {
          if (!all.includes(e)) all.push(e);
        });
      });
      // Se digitou diretamente um emoji ou texto, exibe
      return all.filter((e) => e.includes(q) || q.includes(e));
    }

    const currentCat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return currentCat ? currentCat.emojis : EMOJI_CATEGORIES[0].emojis;
  }, [activeCategory, searchFilter]);

  // Manipulação de palavras-chave
  const handleAddKeyword = (val?: string) => {
    const raw = (val !== undefined ? val : keywordInput).trim();
    if (!raw) return;

    const tokens = raw
      .split(/[,;\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2);

    setKeywords((prev) => {
      const next = [...prev];
      tokens.forEach((tok) => {
        if (!next.includes(tok)) {
          next.push(tok);
        }
      });
      return next;
    });

    setKeywordInput('');
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDownKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // Sugestões inteligentes rápidas baseadas no nome e tipo
  const suggestedPresetKeywords = useMemo(() => {
    const n = (name + ' ' + description).toLowerCase();
    const suggestions: string[] = [];

    if (n.includes('aliment') || n.includes('mercado') || n.includes('comida') || n.includes('feira')) {
      ['mercado', 'supermercado', 'ifood', 'hortifruti', 'feira', 'padaria', 'acougue', 'carrefour', 'assai', 'atacadao'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('transporte') || n.includes('carro') || n.includes('combustivel') || n.includes('veiculo')) {
      ['uber', '99', 'posto', 'gasolina', 'etanol', 'combustivel', 'pedagio', 'sem parar', 'estacionamento'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('saude') || n.includes('farmacia') || n.includes('medico') || n.includes('remedio')) {
      ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'consulta', 'exame', 'laboratorio', 'medico', 'remedio'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('moradia') || n.includes('casa') || n.includes('condominio') || n.includes('luz')) {
      ['aluguel', 'condominio', 'enel', 'luz', 'energia', 'sabesp', 'agua', 'gas', 'internet', 'claro', 'vivo'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('lazer') || n.includes('diversao') || n.includes('jogo') || n.includes('streaming')) {
      ['netflix', 'spotify', 'cinema', 'ingresso', 'steam', 'playstation', 'bar', 'restaurante', 'airbnb'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('educacao') || n.includes('curso') || n.includes('escola') || n.includes('livro')) {
      ['curso', 'escola', 'faculdade', 'livro', 'udemy', 'alura', 'idiomas', 'duolingo'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('pet') || n.includes('animal') || n.includes('veterinario')) {
      ['petz', 'cobasi', 'petshop', 'veterinario', 'racao'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    } else if (n.includes('vestuario') || n.includes('roupa') || n.includes('calcado')) {
      ['zara', 'renner', 'riachuelo', 'c&a', 'centauro', 'nike', 'adidas', 'shein'].forEach((kw) => {
        if (!keywords.includes(kw)) suggestions.push(kw);
      });
    }

    return suggestions.slice(0, 6);
  }, [name, description, keywords]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Por favor, informe o nome da natureza.');
      return;
    }

    const chosenIcon = icon.trim() || '🏷️';
    const chosenColor = color || '#10B981';

    if (isEditing && natureToEdit) {
      updateNature(natureToEdit.id, {
        name: trimmedName,
        icon: chosenIcon,
        color: chosenColor,
        type,
        description: description.trim(),
        keywords,
      });
      if (onSuccess) onSuccess(natureToEdit.id);
    } else {
      addNature({
        name: trimmedName,
        icon: chosenIcon,
        color: chosenColor,
        type,
        description: description.trim(),
        overCeilingJustification: '',
        justificationHistory: [],
        keywords,
      });
      if (onSuccess) onSuccess('');
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Natureza de Gastos' : 'Nova Natureza de Gastos'}
      subtitle={
        isEditing
          ? `Altere o nome, ícone (emoji), cor e configurações da natureza "${natureToEdit?.name}"`
          : 'Defina o agrupamento orçamentário para fundamentar tetos e gastos'
      }
      maxWidth="620px"
    >
      <form onSubmit={handleSubmit} className="nature-modal-form">
        {/* Card de Pré-visualização Dinâmica */}
        <div
          className="nature-preview-card mb-4"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: `1px solid ${color}40`,
            borderLeft: `5px solid ${color}`,
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: `${color}22`,
              border: `1px solid ${color}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.65rem',
              boxShadow: `0 0 16px ${color}33`,
              flexShrink: 0,
            }}
          >
            {icon || '🏷️'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {name.trim() || 'Nome da Natureza'}
              </span>
              <span
                className={`badge ${
                  type === 'ESSENCIAL' ? 'badge-cyan' : type === 'FIXA' ? 'badge-amber' : 'badge-emerald'
                }`}
                style={{ fontSize: '0.68rem', padding: '2px 8px' }}
              >
                {type}
              </span>
            </div>
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                margin: '2px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {description.trim() || 'Pré-visualização de como a natureza aparecerá nas abas e relatórios'}
            </p>
          </div>
        </div>

        {/* Linha 1: Nome da Natureza */}
        <div className="form-group mb-3">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Nome da Natureza *</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ex: Alimentação, Combustível, Educação</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ex: Alimentação, Mercado e Padaria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Linha 2: Tipo Orçamentário e Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label>Tipo Orçamentário</label>
            <select
              className="form-input"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="ESSENCIAL">Essencial (Sobrevivência / Base)</option>
              <option value="FIXA">Fixa (Compromissos Recorrentes)</option>
              <option value="VARIAVEL">Variável (Estilo de Vida / Lazer)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Finalidade / Descrição</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Gastos essenciais com mercado e alimentação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Linha 3: Cor de Destaque */}
        <div className="form-group mb-4">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Cor de Destaque</span>
            <span style={{ fontSize: '0.72rem', color: color, fontWeight: 600 }}>{color}</span>
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
            }}
          >
            {COLOR_PALETTE.map((c) => {
              const isSelected = color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  className={`color-dot-btn ${isSelected ? 'active' : ''}`}
                  style={{
                    backgroundColor: c,
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: isSelected ? '2px solid #FFFFFF' : '2px solid transparent',
                    boxShadow: isSelected ? `0 0 10px ${c}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setColor(c)}
                  title={`Selecionar cor ${c}`}
                />
              );
            })}

            {/* Custom Color Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: 'auto',
                padding: '2px 6px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              title="Escolher qualquer outra cor personalizada"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Personalizada</span>
            </div>
          </div>
        </div>

        {/* Linha: Palavras-chave para Reconhecimento da IA (Forseti) */}
        <div className="form-group mb-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} className="text-cyan" />
              <span>Palavras-chave para a IA (Forseti)</span>
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {keywords.length} cadastrada(s)
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
            Ajude a IA a reconhecer de qual natureza um item faz parte. Quando você enviar fotos de notas ou importar faturas, o Forseti usará estas palavras para classificar os itens de forma 100% automática.
          </p>

          {/* Input para adicionar nova palavra-chave */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="text"
              className="form-input flex-1"
              placeholder="Ex: mercado, ifood, hortifruti, padaria (Enter para adicionar)..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeyDownKeyword}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 12px', whiteSpace: 'nowrap' }}
              onClick={() => handleAddKeyword()}
              disabled={!keywordInput.trim()}
            >
              <Plus size={14} />
              <span>Adicionar</span>
            </button>
          </div>

          {/* Chips das palavras-chave cadastradas */}
          {keywords.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {keywords.map((kw, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#67E8F9',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <span>#{kw}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(idx)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remover palavra-chave"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>
              Nenhuma palavra-chave personalizada adicionada ainda.
            </div>
          )}

          {/* Sugestões inteligentes rápidas com um clique */}
          {suggestedPresetKeywords.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sugestões rápidas:</span>
              {suggestedPresetKeywords.map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleAddKeyword(sug)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                  title={`Adicionar "${sug}"`}
                >
                  + {sug}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Linha 4: Seletor Rico de Ícones (Emoji) */}
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
              <span>Escolha o Ícone (Emoji)</span>
            </label>

            {/* Input manual de emoji */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Emoji Selecionado:</span>
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
                title="Você pode colar ou digitar qualquer emoji aqui (Win + .)"
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
              placeholder="Pesquisar emoji ou colar diretamente..."
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
            Dica: você também pode digitar ou colar qualquer outro emoji que desejar no campo acima.
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
            <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Natureza'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
