import React, { useState, useEffect } from 'react';
import type { ExpenseNature, ReceiptItemLine } from '../types';
import { X, Plus, Check, ShoppingBag, Layers, Tag, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receiptItem: ReceiptItemLine | null;
  natures: ExpenseNature[];
  onSaveAndAssociate: (
    receiptItemId: string,
    natureId: string,
    mappingId: string,
    itemData: {
      description: string;
      quantity: number;
      price: number;
      unit: string;
      multiplierWeeks: number;
    }
  ) => void;
  onAddNewRoutine?: (natureId: string, routineName: string) => string;
}

export const QuickCreateMappingItemModal: React.FC<Props> = ({
  isOpen,
  onClose,
  receiptItem,
  natures,
  onSaveAndAssociate,
  onAddNewRoutine,
}) => {
  if (!isOpen || !receiptItem) return null;

  // Natureza padrão: Alimentos se existir, ou a primeira
  const defaultNature =
    natures.find((n) => n.id === receiptItem.natureId) ||
    natures.find((n) => n.id === 'nat_alimentacao') ||
    natures[0];

  const [selectedNatureId, setSelectedNatureId] = useState<string>(defaultNature?.id || '');
  const currentNature = natures.find((n) => n.id === selectedNatureId) || defaultNature;

  // Rotina padrão: a sugerida ou a primeira do mapeamento
  const defaultMapping =
    currentNature?.mappings.find((m) => m.id === receiptItem.targetMappingId) ||
    currentNature?.mappings[0];

  const [selectedMappingId, setSelectedMappingId] = useState<string>(defaultMapping?.id || '');
  const [description, setDescription] = useState<string>(receiptItem.detectedName || '');
  const [quantity, setQuantity] = useState<number | string>(receiptItem.quantity || 1);

  const [price, setPrice] = useState<number | string>(
    receiptItem.quantity && receiptItem.quantity > 0
      ? Math.round((receiptItem.price / receiptItem.quantity) * 1000) / 1000
      : receiptItem.price
  );
  const [unit, setUnit] = useState<string>('un');
  const [multiplierWeeks, setMultiplierWeeks] = useState<number>(1);

  // Criar nova rotina na hora
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');

  // Sincronizar quando receiptItem mudar
  useEffect(() => {
    if (receiptItem) {
      setDescription(receiptItem.detectedName || '');
      const unitPrice =
        receiptItem.quantity && receiptItem.quantity > 0
          ? Math.round((receiptItem.price / receiptItem.quantity) * 1000) / 1000
          : receiptItem.price;
      setPrice(unitPrice);
      setQuantity(receiptItem.quantity || 1);
      setUnit(receiptItem.unit || 'un');

      const nat =
        natures.find((n) => n.id === receiptItem.natureId) ||
        natures.find((n) => n.id === 'nat_alimentacao') ||
        natures[0];

      if (nat) {
        setSelectedNatureId(nat.id);
        const map =
          nat.mappings.find((m) => m.id === receiptItem.targetMappingId) || nat.mappings[0];
        if (map) setSelectedMappingId(map.id);
      }
    }
  }, [receiptItem, natures]);

  // Atualizar mapping selecionado quando trocar a Natureza
  const handleNatureChange = (newNatId: string) => {
    setSelectedNatureId(newNatId);
    const nat = natures.find((n) => n.id === newNatId);
    if (nat && nat.mappings.length > 0) {
      setSelectedMappingId(nat.mappings[0].id);
    } else {
      setSelectedMappingId('');
    }
  };

  const handleCreateNewRoutine = () => {
    if (!newRoutineName.trim() || !selectedNatureId || !onAddNewRoutine) return;
    const newId = onAddNewRoutine(selectedNatureId, newRoutineName.trim());
    setSelectedMappingId(newId);
    setIsCreatingRoutine(false);
    setNewRoutineName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !selectedNatureId || !selectedMappingId) {
      alert('Por favor, preencha o nome do item e selecione a natureza e rotina.');
      return;
    }

    const parsedQty =
      typeof quantity === 'number'
        ? quantity
        : parseFloat(String(quantity || '0').replace(',', '.')) || 0;
    const parsedPrice =
      typeof price === 'number'
        ? price
        : parseFloat(String(price || '0').replace(',', '.')) || 0;

    onSaveAndAssociate(receiptItem.id, selectedNatureId, selectedMappingId, {
      description: description.trim(),
      quantity: Math.round(parsedQty * 1000) / 1000,
      price: Math.round(parsedPrice * 1000) / 1000,
      unit: unit.trim() || 'un',
      multiplierWeeks: Number(multiplierWeeks) || 1,
    });

    onClose();
  };

  return (
    <div className="modal-overlay quick-mapping-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-content quick-mapping-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="quick-mapping-modal-header">
          <div className="qm-header-title-row">
            <div className="qm-icon-wrap">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="qm-title">Cadastrar Novo Item no Mapeamento</h3>
              <p className="qm-subtitle">
                Crie o item na rotina com <strong>quantidade 0</strong> para permitir associação e reconhecimento futuro sem inflar o teto base.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Informações do Item Detectado no Cupom */}
        <div className="qm-receipt-item-info">
          <div className="qm-info-pill">
            <Tag size={13} className="text-cyan" />
            <span>Detectado no Cupom:</span>
            <strong>{receiptItem.detectedName}</strong>
          </div>
          <div className="qm-info-pill">
            <span>Valor Pago nesta compra:</span>
            <strong className="text-emerald">
              {receiptItem.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        </div>

        {/* Formulário de Criação e Associação */}
        <form onSubmit={handleSubmit} className="qm-form">
          <div className="qm-form-grid">
            {/* Natureza */}
            <div className="qm-field">
              <label className="qm-label">
                <ShoppingBag size={13} className="text-cyan" />
                <span>Natureza Orçamentária</span>
              </label>
              <select
                className="qm-select"
                value={selectedNatureId}
                onChange={(e) => handleNatureChange(e.target.value)}
                required
              >
                {natures.map((nat) => (
                  <option key={nat.id} value={nat.id}>
                    {nat.name} ({nat.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Rotina / Mapeamento */}
            <div className="qm-field">
              <div className="qm-label-with-action">
                <label className="qm-label">
                  <Layers size={13} className="text-cyan" />
                  <span>Rotina de Gastos Fixos</span>
                </label>
                {onAddNewRoutine && (
                  <button
                    type="button"
                    className="qm-text-btn"
                    onClick={() => setIsCreatingRoutine(!isCreatingRoutine)}
                  >
                    {isCreatingRoutine ? 'Cancelar' : '+ Nova Rotina'}
                  </button>
                )}
              </div>

              {isCreatingRoutine ? (
                <div className="qm-new-routine-box">
                  <input
                    type="text"
                    placeholder="Nome da Nova Rotina (ex: Merendas & Lanches)"
                    className="qm-input"
                    value={newRoutineName}
                    onChange={(e) => setNewRoutineName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleCreateNewRoutine}
                  >
                    Salvar Rotina
                  </button>
                </div>
              ) : (
                <select
                  className="qm-select"
                  value={selectedMappingId}
                  onChange={(e) => setSelectedMappingId(e.target.value)}
                  required
                >
                  {currentNature?.mappings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.items.length} itens cadastrados)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Descrição do Item */}
            <div className="qm-field qm-field-full">
              <label className="qm-label">
                <span>Nome / Descrição do Item no Mapeamento</span>
              </label>
              <input
                type="text"
                className="qm-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Snack Equilibri Panetini"
                required
              />
            </div>

            {/* Quantidade Prevista (Padrão 0) */}
            <div className="qm-field">
              <div className="qm-label-with-action">
                <label className="qm-label">
                  <span>Quantidade Prevista</span>
                </label>
                <span className="badge badge-cyan qm-zero-badge">Sugerido: 0 (Teto Neutro)</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className="qm-input"
                placeholder="0 ou 0.350"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <span className="qm-field-hint">
                Quantidade 0 não aumenta o seu teto base de compromissos fixos.
              </span>
            </div>

            {/* Preço de Referência */}
            <div className="qm-field">
              <label className="qm-label">
                <span>Preço Unitário de Referência (R$)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="qm-input"
                placeholder="R$ 0,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <span className="qm-field-hint">
                Preços variam a cada compra. Este valor servirá como base contábil inicial.
              </span>
            </div>

            {/* Unidade de Medida */}
            <div className="qm-field">
              <label className="qm-label">
                <span>Unidade de Medida</span>
              </label>
              <select
                className="qm-select"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="un">un (Unidade)</option>
                <option value="kg">kg (Quilo)</option>
                <option value="pct">pct (Pacote)</option>
                <option value="lt">lt (Litro)</option>
                <option value="cx">cx (Caixa)</option>
                <option value="dz">dz (Dúzia)</option>
              </select>
            </div>

            {/* Frequência Semanal */}
            <div className="qm-field">
              <label className="qm-label">
                <span>Multiplicador de Semanas</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="5"
                className="qm-input"
                value={multiplierWeeks}
                onChange={(e) => setMultiplierWeeks(Number(e.target.value))}
              />
              <span className="qm-field-hint">1 = compra semanal / avulsa no mês</span>
            </div>
          </div>

          {/* Aviso sobre Aprendizado Contínuo */}
          <div className="qm-learning-notice">
            <Sparkles size={16} className="text-cyan" />
            <span>
              Ao criar este item, o <strong>Forseti aprenderá a associação imediatamente</strong> e já preencherá esta rotina automaticamente nas próximas compras!
            </span>
          </div>

          {/* Ações do Modal */}
          <div className="qm-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary qm-submit-btn">
              <Check size={16} />
              <span>Criar Item no Mapeamento & Associar Imediatamente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
