import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { EMOJI_CATEGORIES } from './NatureModal';
import type { FixedExpenseMapping } from '../types';
import { Check, Plus, Search, X, ChevronDown } from 'lucide-react';
import { InfoButton } from './InfoButton';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  natureId: string;
  natureName: string;
  natureColor?: string;
  mappingToEdit?: FixedExpenseMapping | null;
  onSuccess?: (mappingId: string) => void;
}

export const MONTH_LABELS = [
  { num: 1, short: 'Jan', full: 'Janeiro' },
  { num: 2, short: 'Fev', full: 'Fevereiro' },
  { num: 3, short: 'Mar', full: 'Março' },
  { num: 4, short: 'Abr', full: 'Abril' },
  { num: 5, short: 'Mai', full: 'Maio' },
  { num: 6, short: 'Jun', full: 'Junho' },
  { num: 7, short: 'Jul', full: 'Julho' },
  { num: 8, short: 'Ago', full: 'Agosto' },
  { num: 9, short: 'Set', full: 'Setembro' },
  { num: 10, short: 'Out', full: 'Outubro' },
  { num: 11, short: 'Nov', full: 'Novembro' },
  { num: 12, short: 'Dez', full: 'Dezembro' },
];

export const MappingModal: React.FC<MappingModalProps> = ({
  isOpen,
  onClose,
  natureId,
  natureName,
  mappingToEdit,
  onSuccess,
}) => {
  const { addMappingToNature, updateMapping } = useFinancial();

  const isEditing = !!mappingToEdit;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📋');
  const [dayOfMonth, setDayOfMonth] = useState<number | ''>('');
  const [applicableMonths, setApplicableMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  // Meses: "Ano todo" é o padrão; a grade só aparece para quem escolhe meses específicos
  const [pickMonths, setPickMonths] = useState(false);
  // Palavras-chave e ícone ficam recolhidos em "Mais opções"
  const [moreOpen, setMoreOpen] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>('populares');
  const [searchFilter, setSearchFilter] = useState('');

  // Sincronizar estado quando abrir ou alterar mappingToEdit
  useEffect(() => {
    if (isOpen) {
      if (mappingToEdit) {
        setName(mappingToEdit.name || '');
        setIcon(mappingToEdit.icon || '📋');
        setDayOfMonth(mappingToEdit.dayOfMonth || '');
        setKeywords(mappingToEdit.keywords || []);
        setApplicableMonths(
          mappingToEdit.applicableMonths && mappingToEdit.applicableMonths.length > 0
            ? mappingToEdit.applicableMonths
            : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        );
      } else {
        setName('');
        setIcon('📋');
        setDayOfMonth('');
        setKeywords([]);
        setApplicableMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
      const months = mappingToEdit?.applicableMonths || [];
      setPickMonths(months.length > 0 && months.length < 12);
      setMoreOpen(false);
      setKeywordInput('');
      setSearchFilter('');
    }
  }, [isOpen, mappingToEdit]);

  const toggleMonth = (mNum: number) => {
    setApplicableMonths((prev) => {
      if (prev.includes(mNum)) {
        return prev.filter((n) => n !== mNum);
      } else {
        return [...prev, mNum].sort((a, b) => a - b);
      }
    });
  };

  const setPresetMonths = (preset: 'ALL' | 'SEM1' | 'SEM2' | 'EARLY' | 'LATE' | 'CLEAR') => {
    switch (preset) {
      case 'ALL':
        setApplicableMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        break;
      case 'SEM1':
        setApplicableMonths([1, 2, 3, 4, 5, 6]);
        break;
      case 'SEM2':
        setApplicableMonths([7, 8, 9, 10, 11, 12]);
        break;
      case 'EARLY':
        setApplicableMonths([1, 2, 3]);
        break;
      case 'LATE':
        setApplicableMonths([11, 12]);
        break;
      case 'CLEAR':
        setApplicableMonths([]);
        break;
    }
  };

  // Manipulação de palavras-chave da rotina
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

  // Sugestões inteligentes de palavras-chave para a rotina
  const suggestedPresetKeywords = useMemo(() => {
    const n = (name + ' ' + natureName).toLowerCase();
    const suggestions: string[] = [];

    if (n.includes('feira')) {
      ['feira', 'hortifruti', 'legumes', 'frutas', 'verduras', 'pastel'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('acougue') || n.includes('açougue') || n.includes('carne')) {
      ['acougue', 'carnes', 'bife', 'frango', 'costela', 'picanha', 'swift'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('mercado') || n.includes('supermercado')) {
      ['mercado', 'supermercado', 'carrefour', 'pao de acucar', 'atacadao', 'assai'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('padaria') || n.includes('pão') || n.includes('pao') || n.includes('cafe')) {
      ['padaria', 'panificadora', 'cafe', 'pao', 'lanche'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('farmacia') || n.includes('farmácia') || n.includes('drogaria') || n.includes('remedio')) {
      ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'remedio', 'panvel'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('combustivel') || n.includes('combustível') || n.includes('posto') || n.includes('gasolina')) {
      ['posto', 'gasolina', 'etanol', 'combustivel', 'ipiranga', 'shell'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('luz') || n.includes('energia')) {
      ['luz', 'enel', 'cpfl', 'cemig', 'energia', 'eletricidade'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('agua') || n.includes('água') || n.includes('sanep')) {
      ['agua', 'sabesp', 'sanepar', 'copasa', 'saneamento'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('internet') || n.includes('wifi') || n.includes('fibra')) {
      ['internet', 'fibra', 'claro', 'vivo', 'tim', 'provedor'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('aluguel') || n.includes('condominio') || n.includes('condomínio')) {
      ['aluguel', 'condominio', 'locacao', 'imobiliaria', 'quintoandar'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('pet') || n.includes('veterinario') || n.includes('racao')) {
      ['pet', 'racao', 'veterinario', 'petz', 'cobasi', 'banho'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    } else if (n.includes('streaming') || n.includes('assinatura')) {
      ['netflix', 'spotify', 'amazon prime', 'disney', 'youtube', 'hbo'].forEach((k) => {
        if (!keywords.includes(k)) suggestions.push(k);
      });
    }

    return suggestions.slice(0, 6);
  }, [name, natureName, keywords]);

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

    const effectiveMonths =
      applicableMonths.length === 0
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [...applicableMonths].sort((a, b) => a - b);

    if (isEditing && mappingToEdit) {
      updateMapping(natureId, mappingToEdit.id, {
        name: trimmedName,
        icon: chosenIcon,
        dayOfMonth: effectiveDay,
        keywords,
        applicableMonths: effectiveMonths,
      });
      if (onSuccess) onSuccess(mappingToEdit.id);
    } else {
      const newId = addMappingToNature(
        natureId,
        trimmedName,
        effectiveMonths,
        effectiveDay,
        chosenIcon,
        keywords
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
        {/* Linha 1: Nome do Mapeamento */}
        <div className="form-group mb-3">
          <label className="label-with-info">
            <span>Nome do mapeamento *</span>
            <InfoButton title="O que é um mapeamento">
              <p>
                Um mapeamento é uma rotina concreta de gasto dentro da natureza <strong>{natureName}</strong>, como Feira
                semanal, Mercado do mês ou Açougue.
              </p>
              <p>
                Depois de criar, você adiciona os itens com valor e frequência. O Balder multiplica os semanais por 4 e os
                quinzenais por 2, e a soma dos mapeamentos vira o teto da natureza, sem chute.
              </p>
            </InfoButton>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ex.: Feira semanal, Mercado do mês, Açougue"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Linha 2: Dia Fixo de Vencimento no Mês */}
        <div className="form-group mb-4">
          <label className="label-with-info">
            <span>Dia do vencimento (opcional)</span>
            <InfoButton title="Dia do vencimento">
              <p>Use para contas com data certa, como aluguel ou energia.</p>
              <p>O Balder avisa com antecedência quando a data estiver perto, para você registrar o pagamento.</p>
            </InfoButton>
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
        </div>

        {/* Linha 3: Meses de Manifestação na Projeção */}
        <div className="form-group mb-4">
          <label className="label-with-info">
            <span>Em quais meses acontece?</span>
            <InfoButton title="Meses do mapeamento">
              <p>Por padrão o mapeamento entra em todos os meses da projeção.</p>
              <p>
                Escolha meses específicos para gastos sazonais ou pontuais, como IPVA, IPTU, rematrícula, seguro ou compras de
                datas comemorativas.
              </p>
            </InfoButton>
          </label>
          <div className="pill-selector mapping-months-toggle">
            <button
              type="button"
              className={`pill-btn ${!pickMonths ? 'active' : ''}`}
              onClick={() => {
                setPickMonths(false);
                setPresetMonths('ALL');
              }}
            >
              Ano todo
            </button>
            <button type="button" className={`pill-btn ${pickMonths ? 'active' : ''}`} onClick={() => setPickMonths(true)}>
              Só alguns meses
            </button>
          </div>

          {pickMonths && (
          <div className="mapping-months-picker">
          {/* Atalhos Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Atalhos:</span>
            <button
              type="button"
              className={`btn btn-xs ${applicableMonths.length === 12 ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              onClick={() => setPresetMonths('ALL')}
            >
              Ano Todo (12m)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              onClick={() => setPresetMonths('SEM1')}
            >
              1º Semestre (Jan-Jun)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              onClick={() => setPresetMonths('SEM2')}
            >
              2º Semestre (Jul-Dez)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              onClick={() => setPresetMonths('EARLY')}
            >
              Início de Ano (Jan-Mar)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              onClick={() => setPresetMonths('LATE')}
            >
              Fim de Ano (Nov-Dez)
            </button>
            {applicableMonths.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-muted"
                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                onClick={() => setPresetMonths('CLEAR')}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Grid dos 12 Meses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '6px',
              padding: '10px',
              borderRadius: '10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
            }}
          >
            {MONTH_LABELS.map((m) => {
              const isSelected = applicableMonths.includes(m.num);
              return (
                <button
                  key={m.num}
                  type="button"
                  onClick={() => toggleMonth(m.num)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    border: isSelected
                      ? '1px solid rgba(6, 182, 212, 0.8)'
                      : '1px solid var(--border-default)',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.2)'
                      : 'var(--bg-card)',
                    color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.25)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`${m.full}: clique para ${isSelected ? 'remover' : 'incluir'}`}
                >
                  <span style={{ fontSize: '0.66rem', opacity: 0.7 }}>{String(m.num).padStart(2, '0')}</span>
                  <span>{m.short}</span>
                </button>
              );
            })}
          </div>

          </div>
          )}

          {applicableMonths.length === 0 && (
            <span className="text-xs text-rose" style={{ display: 'block', marginTop: '6px' }}>
              Nenhum mês escolhido: o mapeamento não entra na projeção.
            </span>
          )}
        </div>

        {/* Mais opções: palavras-chave para a Forseti e ícone */}
        <button type="button" className="mapping-more-toggle" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <span>Mais opções</span>
          <small>
            {keywords.length > 0 ? `${keywords.length} palavra${keywords.length > 1 ? 's' : ''}-chave` : 'palavras-chave'} · ícone {icon}
          </small>
          <ChevronDown size={16} className={moreOpen ? 'is-open' : ''} />
        </button>

        {moreOpen && (
        <>
        {/* Linha: Palavras-chave para Reconhecimento da IA (Forseti) */}
        <div className="form-group mb-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="label-with-info" style={{ margin: 0 }}>
              <span>Palavras-chave para a Forseti</span>
              <InfoButton title="Palavras-chave">
                <p>Ajudam a Forseti a reconhecer as compras desta rotina.</p>
                <p>
                  Quando você manda a foto de uma nota ou importa uma fatura, os itens com essas palavras vão direto para este
                  mapeamento.
                </p>
              </InfoButton>
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {keywords.length} cadastrada(s)
            </span>
          </div>


          {/* Input para adicionar nova palavra-chave */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="text"
              className="form-input flex-1"
              placeholder="Ex: feira, legumes, hortifruti, pastel (Enter para adicionar)..."
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
                    color: 'var(--accent-cyan)',
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
            null
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
                    background: 'var(--bg-card)',
                    border: '1px dashed var(--border-default)',
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
            <label style={{ margin: 0 }}>Ícone</label>

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

          {/* Categorias de emoji em uma lista (as abas roladas eram difíceis de mover no celular) */}
          <select
            className="form-select"
            style={{ marginBottom: '8px' }}
            value={searchFilter ? '' : activeCategory}
            onChange={(e) => {
              setActiveCategory(e.target.value);
              setSearchFilter('');
            }}
            aria-label="Categoria de emoji"
          >
            {searchFilter && <option value="">Resultado da busca</option>}
            {EMOJI_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>

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
              background: 'var(--bg-input)',
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
                      : '1px solid var(--border-default)',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.25)'
                      : 'var(--bg-card)',
                    boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1.18)';
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = 'var(--bg-card)';
                    }
                  }}
                  title={`Selecionar ${emojiChar}`}
                >
                  {emojiChar}
                </button>
              );
            })}
          </div>
        </div>

        </>
        )}

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
