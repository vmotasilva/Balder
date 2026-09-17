import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Calculator,
  Info,
  FileText,
  Check,
  CheckCircle2,
  CreditCard,
  Edit2,
  Save,
  X,
} from 'lucide-react';

interface NaturezasPageProps {
  embedded?: boolean;
}

export const NaturezasPage: React.FC<NaturezasPageProps> = ({ embedded = false }) => {
  const {
    natures,
    addNature,
    deleteNature,
    addMappingToNature,
    deleteMapping,
    addItemToMapping,
    updateMappingItem,
    deleteMappingItem,
    toggleItemFulfilled,
    saveCeilingJustification,
    getNatureCeiling,
    getNatureSpent,
    getNatureMissingItems,
  } = useFinancial();

  // Selected Natureza
  const [selectedNatureId, setSelectedNatureId] = useState<string>(
    natures[0]?.id || 'nat_alimentacao'
  );
  const [justificationText, setJustificationText] = useState('');

  // Inline Quick Add Items per Mapping
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemQty, setNewItemQty] = useState<Record<string, number>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<string, number>>({});
  const [newItemMult, setNewItemMult] = useState<Record<string, number>>({});

  // Inline Editing of existing items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editPrice, setEditPrice] = useState(0);
  const [editMult, setEditMult] = useState(1);

  // Modais de Criação
  const [isNewNatureModalOpen, setIsNewNatureModalOpen] = useState(false);
  const [newNatureName, setNewNatureName] = useState('');
  const [newNatureIcon, setNewNatureIcon] = useState('🏷️');
  const [newNatureColor, setNewNatureColor] = useState('#10B981');
  const [newNatureType, setNewNatureType] = useState<'ESSENCIAL' | 'FIXA' | 'VARIAVEL'>('ESSENCIAL');
  const [newNatureDesc, setNewNatureDesc] = useState('');

  const [isNewMappingModalOpen, setIsNewMappingModalOpen] = useState(false);
  const [newMappingName, setNewMappingName] = useState('');

  // Active Nature data
  const selectedNature = natures.find((n) => n.id === selectedNatureId) || natures[0];
  const natureCeiling = selectedNature ? getNatureCeiling(selectedNature) : 0;
  const natureSpent = selectedNature ? getNatureSpent(selectedNature) : 0;
  const ceilingPercentUsed =
    natureCeiling > 0 ? Math.round((natureSpent / natureCeiling) * 100) : 0;
  const isCeilingOver = natureCeiling > 0 && natureSpent > natureCeiling;
  const isCeilingFar = natureCeiling > 0 && !isCeilingOver && natureSpent < natureCeiling * 0.75;
  const missingItems = selectedNature ? getNatureMissingItems(selectedNature) : [];

  // Total ceiling of all natures combined
  const totalAllCeilings = natures.reduce((acc, nat) => acc + getNatureCeiling(nat), 0);
  const totalAllSpent = natures.reduce((acc, nat) => acc + getNatureSpent(nat), 0);

  const startEditingItem = (item: {
    id: string;
    description: string;
    quantity: number;
    price: number;
    multiplierWeeks: number;
  }) => {
    setEditingItemId(item.id);
    setEditDesc(item.description);
    setEditQty(item.quantity);
    setEditPrice(item.price);
    setEditMult(item.multiplierWeeks || 1);
  };

  const handleSaveItemEdit = (mappingId: string, itemId: string) => {
    if (!selectedNature) return;
    updateMappingItem(selectedNature.id, mappingId, itemId, {
      description: editDesc,
      quantity: Math.max(1, editQty),
      price: Math.max(0, editPrice),
      multiplierWeeks: Math.max(1, editMult),
    });
    setEditingItemId(null);
  };

  return (
    <div className={`naturezas-page-container animate-fade-in ${embedded ? 'embedded' : 'page-container'}`}>
      {/* Page Header (if not embedded in Profile) */}
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="kicker-badge">
              <Layers size={13} className="mr-1" />
              <span>PLANEJAMENTO ORÇAMENTÁRIO & TETOS</span>
            </div>
            <h1 className="page-title">Controle de Naturezas</h1>
            <p className="page-subtitle">
              Ajuste os tetos orçamentários, estruture mapeamentos matemáticos e componha os itens de gastos fixos
            </p>
          </div>
          <div className="page-header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsNewNatureModalOpen(true)}
              id="btn-nova-natureza"
            >
              <Plus size={16} />
              <span>Nova Natureza</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Ceilings Summary Bar */}
      {!embedded && (
        <div className="glass-card mb-4 p-4 flex items-center justify-between flex-wrap gap-4 border border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgba(245,158,11,0.15)] text-amber-500 font-bold text-lg">
              🎯
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Teto Global das Naturezas
              </span>
              <strong className="text-xl font-black text-[var(--text-primary)]">
                {totalAllCeilings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[var(--text-muted)] block">Realizado no Mês</span>
              <strong className={`text-base font-bold ${totalAllSpent > totalAllCeilings ? 'text-rose-500' : 'text-emerald-500'}`}>
                {totalAllSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            <div>
              <span className="text-xs text-[var(--text-muted)] block">Naturezas Cadastradas</span>
              <strong className="text-base font-bold text-[var(--text-primary)]">
                {natures.length} naturezas
              </strong>
            </div>

            <div>
              <span className="text-xs text-[var(--text-muted)] block">Consumo Geral</span>
              <span className="badge badge-cyan font-bold">
                {totalAllCeilings > 0 ? Math.round((totalAllSpent / totalAllCeilings) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="naturezas-subtab">
        {embedded && (
          <div className="naturezas-header-row">
            <div>
              <h3>Naturezas & Mapeamento de Gastos Fixos</h3>
              <p className="subtab-desc">
                Cadastre suas naturezas orçamentárias e estruture mapeamentos matemáticos de gastos fixos para justificar cada Teto.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsNewNatureModalOpen(true)}>
              <Plus size={16} />
              <span>Nova Natureza</span>
            </button>
          </div>
        )}

        {/* Seletor de Naturezas em Abas/Pills com Resumo de Teto */}
        <div className="naturezas-tabs-nav">
          {natures.map((nat) => {
            const ceil = getNatureCeiling(nat);
            const spent = getNatureSpent(nat);
            const isOver = ceil > 0 && spent > ceil;
            const isFar = ceil > 0 && spent < ceil * 0.75;
            const isSelected = selectedNature?.id === nat.id;

            return (
              <button
                key={nat.id}
                className={`natureza-tab-item ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedNatureId(nat.id)}
                style={{ borderLeftColor: nat.color }}
              >
                <div className="natureza-tab-top">
                  <span className="natureza-tab-icon">{nat.icon}</span>
                  <strong className="natureza-tab-name">{nat.name}</strong>
                </div>
                <div className="natureza-tab-meta">
                  <span className="natureza-tab-ceiling">
                    Teto: {ceil.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {isOver ? (
                    <span className="badge badge-rose text-xs">TETO EXCEDIDO</span>
                  ) : isFar ? (
                    <span className="badge badge-cyan text-xs">LONGE DO TETO</span>
                  ) : (
                    <span className="badge badge-emerald text-xs">NO LIMITE</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedNature ? (
          <div className="natureza-selected-detail">
            {/* Card Resumo do Teto Matemático da Natureza */}
            <div className="natureza-kpi-banner glass-card">
              <div className="natureza-info-left">
                <div className="natureza-badge-title">
                  <span className="natureza-large-icon">{selectedNature.icon}</span>
                  <div className="flex-1">
                    <div className="natureza-title-meta">
                      <h4>{selectedNature.name}</h4>
                      <span className="badge badge-cyan">{selectedNature.type}</span>
                      {natures.length > 1 && (
                        <button
                          className="btn btn-ghost btn-xs text-rose ml-auto"
                          title="Excluir esta Natureza"
                          onClick={() => {
                            if (
                              confirm(
                                `Deseja realmente excluir a natureza "${selectedNature.name}" e todos os seus mapeamentos?`
                              )
                            ) {
                              deleteNature(selectedNature.id);
                              const next = natures.find((n) => n.id !== selectedNature.id);
                              if (next) setSelectedNatureId(next.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Excluir Natureza</span>
                        </button>
                      )}
                    </div>
                    <p className="natureza-desc-text">
                      {selectedNature.description ||
                        'Mapeamentos matemáticos definem a fundamentação do teto de gastos desta natureza. Ajuste os itens abaixo para recalcular o teto.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="natureza-kpis-grid">
                <div className="nat-kpi-box">
                  <span className="nat-kpi-label">
                    <Calculator size={14} className="text-cyan" />
                    Teto Calculado
                  </span>
                  <strong className="nat-kpi-val text-cyan">
                    {natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                  <span className="nat-kpi-sub">
                    Soma de {selectedNature.mappings.length} mapeamento(s)
                  </span>
                </div>

                <div className="nat-kpi-box">
                  <span className="nat-kpi-label">
                    <CreditCard size={14} className="text-emerald" />
                    Gasto Real no Mês
                  </span>
                  <strong
                    className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-emerald'}`}
                  >
                    {natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                  <span className="nat-kpi-sub">{ceilingPercentUsed}% do teto consumido</span>
                </div>

                <div className="nat-kpi-box">
                  <span className="nat-kpi-label">
                    {isCeilingOver ? (
                      <AlertTriangle size={14} className="text-rose" />
                    ) : (
                      <CheckCircle2 size={14} className="text-cyan" />
                    )}
                    Margem Orçamentária
                  </span>
                  <strong
                    className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-white'}`}
                  >
                    {isCeilingOver
                      ? `+${(natureSpent - natureCeiling).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}`
                      : (natureCeiling - natureSpent).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                  </strong>
                  <span className="nat-kpi-sub">
                    {isCeilingOver ? 'Acima do Teto' : 'Disponível até o Teto'}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso do Teto */}
              <div className="natureza-progress-container mt-4">
                <div className="natureza-progress-labels">
                  <span>Consumo do Teto Orçamentário</span>
                  <span>{ceilingPercentUsed}%</span>
                </div>
                <div className="natureza-progress-track">
                  <div
                    className={`natureza-progress-fill ${
                      isCeilingOver ? 'bg-rose' : ceilingPercentUsed < 75 ? 'bg-cyan' : 'bg-amber'
                    }`}
                    style={{ width: `${Math.min(ceilingPercentUsed, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* BLOCO INTELIGENTE 1: TETO ULTRAPASSADO -> JUSTIFICATIVA OU AJUSTE */}
            {isCeilingOver && (
              <div className="ceiling-alert-box alert-over-ceiling glass-card animate-fade-in mt-4">
                <div className="ceiling-alert-header">
                  <AlertTriangle size={24} className="text-rose" />
                  <div>
                    <h4 className="text-rose">
                      Teto de Gastos Ultrapassado em{' '}
                      {(natureSpent - natureCeiling).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </h4>
                    <p>
                      A despesa acumulada nesta natureza superou o teto estipulado pelos mapeamentos.
                      Registre uma justificativa contábil para auditoria ou reajuste os valores dos itens abaixo.
                    </p>
                  </div>
                </div>

                <div className="justification-form-box mt-3">
                  <label>Justificativa do Desvio Orçamentário:</label>
                  <div className="justification-input-row">
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder="Ex: Compra extraordinária para evento em casa e aumento de preços..."
                      value={justificationText}
                      onChange={(e) => setJustificationText(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        if (!justificationText.trim()) return;
                        saveCeilingJustification(selectedNature.id, justificationText);
                        setJustificationText('');
                        alert('Justificativa contábil registrada com sucesso!');
                      }}
                    >
                      <FileText size={16} />
                      <span>Gravar Justificativa</span>
                    </button>
                  </div>

                  {selectedNature.justificationHistory &&
                    selectedNature.justificationHistory.length > 0 && (
                      <div className="justification-history mt-3">
                        <span className="justification-history-title">
                          Histórico de Justificativas Registradas:
                        </span>
                        <div className="justification-history-list">
                          {selectedNature.justificationHistory.map((just) => (
                            <div key={just.id} className="just-item">
                              <div className="just-item-meta">
                                <strong>
                                  {just.date} ({just.month})
                                </strong>
                                <span className="text-rose">
                                  Excedente: +
                                  {(just.spentAmount - just.ceilingAmount).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              </div>
                              <p className="just-item-reason">"{just.reason}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* BLOCO INTELIGENTE 2: LONGE DO TETO -> DIAGNÓSTICO PRECISO DE ITENS EM FALTA */}
            {isCeilingFar && (
              <div className="ceiling-alert-box alert-far-ceiling glass-card animate-fade-in mt-4">
                <div className="ceiling-alert-header">
                  <Info size={24} className="text-cyan" />
                  <div>
                    <h4 className="text-cyan">Diagnóstico Orçamentário: Por que o Teto está distante?</h4>
                    <p>
                      Você realizou{' '}
                      <strong>
                        {natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>{' '}
                      de um teto estipulado de{' '}
                      <strong>
                        {natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>{' '}
                      (restando{' '}
                      <strong>
                        {(natureCeiling - natureSpent).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </strong>
                      ). O BALDER identificou os seguintes{' '}
                      <strong>itens do mapeamento que ainda estão em falta / pendentes de compra</strong> no mês:
                    </p>
                  </div>
                </div>

                {missingItems.length > 0 ? (
                  <div className="missing-items-table-box mt-3">
                    <table className="natureza-items-table">
                      <thead>
                        <tr>
                          <th>Item Mapeado</th>
                          <th>Mapeamento Origem</th>
                          <th>Qtd × Preço × Semanas</th>
                          <th>Valor Previsto</th>
                          <th>Falta Realizar</th>
                          <th>Ação Rápida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingItems.map(({ item, mappingName, missingAmount }) => (
                          <tr key={item.id} className="missing-item-row">
                            <td>
                              <strong>{item.description}</strong>
                            </td>
                            <td>
                              <span className="badge badge-cyan text-xs">{mappingName}</span>
                            </td>
                            <td>
                              {item.quantity} un ×{' '}
                              {item.price.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}{' '}
                              × {item.multiplierWeeks}{' '}
                              {item.multiplierWeeks > 1 ? 'semanas' : 'sem'}
                            </td>
                            <td>
                              {item.totalValue.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="text-cyan font-bold">
                              {missingAmount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline btn-xs"
                                title="Marcar item como comprado/liquidado no mês"
                                onClick={() => {
                                  const parentMap = selectedNature.mappings.find((m) =>
                                    m.items.some((it) => it.id === item.id)
                                  );
                                  if (parentMap) {
                                    toggleItemFulfilled(selectedNature.id, parentMap.id, item.id);
                                  }
                                }}
                              >
                                <Check size={12} className="text-emerald" />
                                <span>Marcar Comprado</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="subtab-desc mt-2">Todos os itens mapeados já foram marcados como realizados.</p>
                )}
              </div>
            )}

            {/* SEÇÃO DE MAPEAMENTOS DE GASTOS FIXOS */}
            <div className="natureza-mappings-section mt-4">
              <div className="mappings-section-header">
                <div>
                  <h4>Mapeamentos de Gastos Fixos ({selectedNature.mappings.length})</h4>
                  <p className="subtab-desc">
                    Ajuste os itens, quantidades e valores abaixo para redefinir e compor com precisão o teto orçamentário.
                  </p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsNewMappingModalOpen(true)}
                >
                  <Plus size={14} />
                  <span>Novo Mapeamento</span>
                </button>
              </div>

              {selectedNature.mappings.length === 0 ? (
                <div className="empty-mappings-box glass-card mt-3">
                  <Layers size={32} className="text-muted" />
                  <p>Nenhum mapeamento de gastos cadastrado para esta natureza.</p>
                  <button
                    className="btn btn-primary btn-sm mt-2"
                    onClick={() => setIsNewMappingModalOpen(true)}
                  >
                    Criar Primeiro Mapeamento
                  </button>
                </div>
              ) : (
                <div className="mappings-list-container">
                  {selectedNature.mappings.map((mapping) => {
                    const mappingTotal = (mapping.items || []).reduce(
                      (acc, it) => acc + it.totalValue,
                      0
                    );

                    return (
                      <div key={mapping.id} className="mapping-card glass-card mt-4">
                        <div className="mapping-card-header">
                          <div className="mapping-header-info">
                            <h5>{mapping.name}</h5>
                            <span className="badge badge-cyan">
                              Subtotal: {mappingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="badge badge-emerald">
                              {mapping.items.length}{' '}
                              {mapping.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                          <div className="mapping-header-actions">
                            <button
                              className="btn btn-ghost btn-xs text-rose"
                              title="Excluir Mapeamento"
                              onClick={() => {
                                if (confirm(`Deseja remover o mapeamento "${mapping.name}"?`)) {
                                  deleteMapping(selectedNature.id, mapping.id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Excluir Mapeamento</span>
                            </button>
                          </div>
                        </div>

                        {/* TABELA DE ITENS DO MAPEAMENTO COM EDIÇÃO INLINE */}
                        <div className="mapping-items-table-wrapper mt-3">
                          <table className="natureza-items-table">
                            <thead>
                              <tr>
                                <th style={{ width: '28%' }}>Descrição / Item</th>
                                <th style={{ width: '12%' }}>Quantidade</th>
                                <th style={{ width: '15%' }}>Preço Unitário</th>
                                <th style={{ width: '18%' }}>Multiplicador (Semanas)</th>
                                <th style={{ width: '15%' }}>Valor Total (Teto)</th>
                                <th style={{ width: '12%' }}>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mapping.items.map((item) => {
                                const isEditing = editingItemId === item.id;

                                if (isEditing) {
                                  const previewTotal = Math.round(editQty * editPrice * editMult * 100) / 100;

                                  return (
                                    <tr key={item.id} className="item-row-editing bg-[rgba(2,132,199,0.08)]">
                                      <td>
                                        <input
                                          type="text"
                                          className="form-input form-input-sm"
                                          value={editDesc}
                                          onChange={(e) => setEditDesc(e.target.value)}
                                          autoFocus
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          min="1"
                                          className="form-input form-input-sm text-center"
                                          value={editQty}
                                          onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="form-input form-input-sm"
                                          value={editPrice}
                                          onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                        />
                                      </td>
                                      <td>
                                        <select
                                          className="form-input form-input-sm"
                                          value={editMult}
                                          onChange={(e) => setEditMult(parseInt(e.target.value) || 1)}
                                        >
                                          <option value={1}>1x (Pontual / Mensal)</option>
                                          <option value={2}>2x (Quinzenal)</option>
                                          <option value={4}>4x (Semanal - 4 sem)</option>
                                          <option value={5}>5x (Semanal longo - 5 sem)</option>
                                        </select>
                                      </td>
                                      <td>
                                        <strong className="text-emerald-500 font-bold">
                                          {previewTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </strong>
                                      </td>
                                      <td>
                                        <div className="flex items-center gap-1">
                                          <button
                                            className="btn btn-primary btn-xs"
                                            title="Salvar Alterações"
                                            onClick={() => handleSaveItemEdit(mapping.id, item.id)}
                                          >
                                            <Save size={13} />
                                          </button>
                                          <button
                                            className="btn btn-ghost btn-xs text-muted"
                                            title="Cancelar"
                                            onClick={() => setEditingItemId(null)}
                                          >
                                            <X size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr
                                    key={item.id}
                                    className={item.isFulfilled ? 'item-row-fulfilled' : ''}
                                  >
                                    <td>
                                      <div className="item-desc-cell">
                                        <button
                                          className={`item-check-circle ${
                                            item.isFulfilled ? 'checked' : ''
                                          }`}
                                          title={
                                            item.isFulfilled
                                              ? 'Realizado no mês'
                                              : 'Pendente de compra'
                                          }
                                          onClick={() =>
                                            toggleItemFulfilled(
                                              selectedNature.id,
                                              mapping.id,
                                              item.id
                                            )
                                          }
                                        >
                                          {item.isFulfilled ? '✓' : ''}
                                        </button>
                                        <span
                                          className={
                                            item.isFulfilled
                                              ? 'line-through text-muted'
                                              : 'font-semibold'
                                          }
                                        >
                                          {item.description}
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="item-val-pill">{item.quantity}</span>
                                    </td>
                                    <td>
                                      {item.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </td>
                                    <td>
                                      <span className="badge badge-cyan">
                                        {item.multiplierWeeks}x{' '}
                                        {item.multiplierWeeks === 1
                                          ? 'semana/mês'
                                          : 'semanas'}
                                      </span>
                                    </td>
                                    <td>
                                      <strong className="text-glow-cyan">
                                        {item.totalValue.toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </strong>
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-1">
                                        <button
                                          className="btn btn-ghost btn-xs text-cyan"
                                          title="Ajustar item / teto"
                                          onClick={() => startEditingItem(item)}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-xs text-rose"
                                          title="Excluir item"
                                          onClick={() =>
                                            deleteMappingItem(
                                              selectedNature.id,
                                              mapping.id,
                                              item.id
                                            )
                                          }
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Linha de Cadastro Rápido de Novo Item no Mapeamento */}
                              <tr className="quick-add-item-row">
                                <td>
                                  <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="Ex: Frutas Frescas, Açougue..."
                                    value={newItemDesc[mapping.id] || ''}
                                    onChange={(e) =>
                                      setNewItemDesc((prev) => ({
                                        ...prev,
                                        [mapping.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    className="form-input form-input-sm text-center"
                                    placeholder="Qtd"
                                    value={
                                      newItemQty[mapping.id] !== undefined
                                        ? newItemQty[mapping.id]
                                        : 1
                                    }
                                    onChange={(e) =>
                                      setNewItemQty((prev) => ({
                                        ...prev,
                                        [mapping.id]: Math.max(
                                          1,
                                          parseInt(e.target.value) || 1
                                        ),
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input form-input-sm"
                                    placeholder="R$ 0,00"
                                    value={
                                      newItemPrice[mapping.id] !== undefined
                                        ? newItemPrice[mapping.id]
                                        : ''
                                    }
                                    onChange={(e) =>
                                      setNewItemPrice((prev) => ({
                                        ...prev,
                                        [mapping.id]: parseFloat(e.target.value) || 0,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <select
                                    className="form-input form-input-sm"
                                    value={
                                      newItemMult[mapping.id] !== undefined
                                        ? newItemMult[mapping.id]
                                        : 4
                                    }
                                    onChange={(e) =>
                                      setNewItemMult((prev) => ({
                                        ...prev,
                                        [mapping.id]: parseInt(e.target.value) || 1,
                                      }))
                                    }
                                  >
                                    <option value={1}>1x (Pontual / Mensal)</option>
                                    <option value={2}>2x (Quinzenal)</option>
                                    <option value={4}>4x (Semanal - 4 sem)</option>
                                    <option value={5}>5x (Semanal longo - 5 sem)</option>
                                  </select>
                                </td>
                                <td>
                                  <span className="text-xs text-muted">
                                    {(
                                      (newItemQty[mapping.id] || 1) *
                                      (newItemPrice[mapping.id] || 0) *
                                      (newItemMult[mapping.id] !== undefined
                                        ? newItemMult[mapping.id]
                                        : 4)
                                    ).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary btn-xs"
                                    title="Adicionar item ao mapeamento"
                                    onClick={() => {
                                      const desc = newItemDesc[mapping.id]?.trim();
                                      const qty = newItemQty[mapping.id] || 1;
                                      const prc = newItemPrice[mapping.id] || 0;
                                      const mult =
                                        newItemMult[mapping.id] !== undefined
                                          ? newItemMult[mapping.id]
                                          : 4;

                                      if (!desc) {
                                        alert('Informe a descrição do item.');
                                        return;
                                      }
                                      if (prc <= 0) {
                                        alert('Informe o preço unitário do item.');
                                        return;
                                      }

                                      addItemToMapping(selectedNature.id, mapping.id, {
                                        description: desc,
                                        quantity: qty,
                                        price: prc,
                                        multiplierWeeks: mult,
                                        realizedValue: 0,
                                        isFulfilled: false,
                                      });

                                      // Limpar campos
                                      setNewItemDesc((prev) => ({ ...prev, [mapping.id]: '' }));
                                      setNewItemPrice((prev) => ({
                                        ...prev,
                                        [mapping.id]: 0,
                                      }));
                                      setNewItemQty((prev) => ({ ...prev, [mapping.id]: 1 }));
                                    }}
                                  >
                                    <Plus size={14} />
                                    <span>Adicionar</span>
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state glass-card p-8 text-center mt-4">
            <Layers size={48} className="mx-auto text-muted mb-2" />
            <p>Selecione ou crie uma natureza orçamentária para gerenciar seus tetos.</p>
          </div>
        )}
      </div>

      {/* Modal de Nova Natureza */}
      {isNewNatureModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewNatureModalOpen(false)}>
          <div
            className="modal-container glass-card animate-fade-in"
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Nova Natureza de Gastos</h3>
                <p className="modal-subtitle">
                  Defina o agrupamento para compor tetos orçamentários
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsNewNatureModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group mb-3">
                <label>Nome da Natureza</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Supermercado, Habitação, Lazer..."
                  value={newNatureName}
                  onChange={(e) => setNewNatureName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="form-group">
                  <label>Ícone (Emoji)</label>
                  <input
                    type="text"
                    className="form-input text-center text-lg"
                    placeholder="🏷️"
                    value={newNatureIcon}
                    onChange={(e) => setNewNatureIcon(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo Orçamentário</label>
                  <select
                    className="form-input"
                    value={newNatureType}
                    onChange={(e) => setNewNatureType(e.target.value as any)}
                  >
                    <option value="ESSENCIAL">Essencial (Sobrevivência)</option>
                    <option value="FIXA">Fixa (Compromisso)</option>
                    <option value="VARIAVEL">Variável (Estilo de Vida)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Cor de Destaque</label>
                  <div className="nature-color-picker-row">
                    {['#10B981', '#38BDF8', '#A855F7', '#F43F5E', '#F59E0B', '#6366F1'].map(
                      (c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-dot-btn ${newNatureColor === c ? 'active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewNatureColor(c)}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label>Descrição / Finalidade</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Finalidade orçamentária dos gastos desta natureza..."
                  value={newNatureDesc}
                  onChange={(e) => setNewNatureDesc(e.target.value)}
                />
              </div>

              <div className="modal-footer-actions mt-4">
                <button
                  className="btn btn-outline"
                  onClick={() => setIsNewNatureModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newNatureName.trim()) {
                      alert('Informe o nome da natureza.');
                      return;
                    }
                    addNature({
                      name: newNatureName.trim(),
                      icon: newNatureIcon || '🏷️',
                      color: newNatureColor,
                      type: newNatureType,
                      description: newNatureDesc,
                      overCeilingJustification: '',
                      justificationHistory: [],
                    });
                    setNewNatureName('');
                    setNewNatureDesc('');
                    setIsNewNatureModalOpen(false);
                  }}
                >
                  <Plus size={16} />
                  <span>Cadastrar Natureza</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Mapeamento de Gastos Fixos */}
      {isNewMappingModalOpen && selectedNature && (
        <div className="modal-backdrop" onClick={() => setIsNewMappingModalOpen(false)}>
          <div
            className="modal-container glass-card animate-fade-in"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Novo Mapeamento de Gastos</h3>
                <p className="modal-subtitle">
                  Adicionar mapeamento à natureza: <strong>{selectedNature.name}</strong>
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsNewMappingModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group mb-3">
                <label>Nome do Mapeamento</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Feira Semanal de Bairro, Compras em Atacado, etc."
                  value={newMappingName}
                  onChange={(e) => setNewMappingName(e.target.value)}
                />
                <span className="text-xs text-muted mt-1 block">
                  Você poderá cadastrar múltiplos itens com quantidades, preços e multiplicadores
                  semanais para compor o teto.
                </span>
              </div>

              <div className="modal-footer-actions mt-4">
                <button
                  className="btn btn-outline"
                  onClick={() => setIsNewMappingModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newMappingName.trim()) {
                      alert('Informe o nome do mapeamento.');
                      return;
                    }
                    addMappingToNature(selectedNature.id, newMappingName.trim());
                    setNewMappingName('');
                    setIsNewMappingModalOpen(false);
                  }}
                >
                  <Plus size={16} />
                  <span>Criar Mapeamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
