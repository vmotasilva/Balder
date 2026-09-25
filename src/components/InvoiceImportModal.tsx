import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { InvoiceNatureItemBreakdown } from '../types';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Loader2,
  Trash2,
  Tag,
  Clipboard,
  Check,
} from 'lucide-react';
import {
  parseInvoiceFile,
  parseRawTextInvoice,
  convertToBreakdownItems,
  type ParsedInvoiceItem,
  type InvoiceImportResult,
} from '../services/invoiceFileParser';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (items: InvoiceNatureItemBreakdown[], totalAmount: number, shouldUpdateInvoiceAmount: boolean) => void;
  currentInvoiceAmount?: number;
}

export const InvoiceImportModal: React.FC<InvoiceImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  currentInvoiceAmount = 0,
  const { natures, updateNature, updateMapping } = useFinancial();

  // Estados de navegação interna
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Texto colado
  const [pastedText, setPastedText] = useState('');

  // Itens detectados para revisão
  const [parsedResult, setParsedResult] = useState<InvoiceImportResult | null>(null);
  const [reviewedItems, setReviewedItems] = useState<ParsedInvoiceItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [shouldUpdateInvoiceAmount, setShouldUpdateInvoiceAmount] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resetar estados
  const handleReset = () => {
    setParsedResult(null);
    setReviewedItems([]);
    setSelectedItemIds(new Set());
    setErrorMsg('');
    setPastedText('');
    setIsProcessing(false);
  };

  // Processamento do Arquivo
  const handleFileSelected = async (file: File) => {
    setErrorMsg('');
    setIsProcessing(true);
    setProcessingStatus('Lendo arquivo da fatura...');
    setProcessingProgress(20);

    try {
      const result = await parseInvoiceFile(file, natures, (progress, status) => {
        setProcessingProgress(progress);
        setProcessingStatus(status);
      });

      if (result.items.length === 0) {
        setErrorMsg('Nenhuma despesa válida foi detectada no arquivo. Verifique o formato ou tente colar o texto da fatura.');
        setIsProcessing(false);
        return;
      }

      setParsedResult(result);
      setReviewedItems(result.items);
      setSelectedItemIds(new Set(result.items.map((i) => i.id)));
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Erro na importação da fatura:', err);
      setErrorMsg(`Falha ao ler o arquivo: ${err?.message || 'Formato não reconhecido.'}`);
      setIsProcessing(false);
    }
  };

  // Processamento do Texto Colado
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Cole o texto dos lançamentos da sua fatura no campo abaixo.');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    setProcessingStatus('Analisando linhas e interpretando naturezas...');

    try {
      const result = parseRawTextInvoice(pastedText, natures);

      if (result.items.length === 0) {
        setErrorMsg('Não foi possível identificar lançamentos com valor monetário no texto informado. Certifique-se de incluir a descrição e o valor de cada despesa.');
        setIsProcessing(false);
        return;
      }

      setParsedResult(result);
      setReviewedItems(result.items);
      setSelectedItemIds(new Set(result.items.map((i) => i.id)));
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Erro no processamento do texto:', err);
      setErrorMsg('Falha ao processar texto.');
      setIsProcessing(false);
    }
  };

  // Alterar natureza de um item na revisão
  const handleNatureChange = (itemId: string, newNatureId: string) => {
    setReviewedItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const matchedNat = natures.find((n) => n.id === newNatureId);
          return {
            ...item,
            natureId: newNatureId,
            natureName: newNatureId === 'OUTROS' ? 'Outros' : matchedNat?.name || 'Natureza',
            confidence: 1.0,
            mappingId: 'OUTROS',
          };
        }
        return item;
      })
    );
  };

  const handleMappingChange = (itemId: string, newMappingId: string) => {
    setReviewedItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            mappingId: newMappingId,
          };
        }
        return item;
      })
    );
  };

  // Alterar descrição ou parcela
  const handleDescriptionChange = (itemId: string, newDesc: string) => {
    setReviewedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, description: newDesc } : item))
    );
  };

  // Toggle seleção de item
  const handleToggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === reviewedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(reviewedItems.map((i) => i.id)));
    }
  };

  // Excluir item da lista de revisão
  const handleRemoveItem = (itemId: string) => {
    setReviewedItems((prev) => prev.filter((i) => i.id !== itemId));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  // Total selecionado
  const activeSelectedItems = reviewedItems.filter((i) => selectedItemIds.has(i.id));
  const activeTotalAmount = activeSelectedItems.reduce((acc, i) => acc + i.amount, 0);

  // Submeter importação
  const handleConfirm = () => {
    if (activeSelectedItems.length === 0) {
      setErrorMsg('Selecione pelo menos um item para importar.');
      return;
    }

    // Auto-associação de palavras-chave
    activeSelectedItems.forEach(item => {
      if (item.natureId && item.natureId !== 'OUTROS') {
        const cleanDesc = item.description.toLowerCase().trim();
        const nat = natures.find(n => n.id === item.natureId);
        
        if (nat) {
          // Atualiza a palavra-chave na Natureza
          if (!nat.keywords?.includes(cleanDesc)) {
            updateNature(nat.id, { keywords: [...(nat.keywords || []), cleanDesc] });
          }
          
          // Atualiza a palavra-chave no Mapeamento
          if (item.mappingId && item.mappingId !== 'OUTROS') {
            const map = nat.mappings?.find(m => m.id === item.mappingId);
            if (map && !map.keywords?.includes(cleanDesc)) {
              updateMapping(nat.id, map.id, { keywords: [...(map.keywords || []), cleanDesc] });
            }
          }
        }
      }
    });

    const breakdownItems = convertToBreakdownItems(activeSelectedItems);
    onConfirmImport(breakdownItems, activeTotalAmount, shouldUpdateInvoiceAmount);
    handleReset();
    onClose();
  };

  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Importar & Interpretar Fatura de Cartão"
      subtitle="Faça upload do extrato (OFX, CSV, TXT ou Imagem) para leitura e classificação automática nas suas Naturezas e Mapeamentos"
      maxWidth="860px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ETAPA 1: SELETOR DE ENTRADA (SE NENHUM ARQUIVO FOI PROCESSADO AINDA) */}
        {!parsedResult && !isProcessing && (
          <div>
            {/* Tabs de Escolha */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`btn ${activeTab === 'FILE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '13px', gap: '8px' }}
                onClick={() => setActiveTab('FILE')}
              >
                <Upload size={16} />
                <span>Upload de Arquivo (OFX, CSV, Imagem)</span>
              </button>

              <button
                type="button"
                className={`btn ${activeTab === 'PASTE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '13px', gap: '8px' }}
                onClick={() => setActiveTab('PASTE')}
              >
                <Clipboard size={16} />
                <span>Colar Texto da Fatura</span>
              </button>
            </div>

            {/* TAB: ARQUIVO */}
            {activeTab === 'FILE' && (
              <div
                style={{
                  border: '2px dashed var(--border-default)',
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelected(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.ox,.csv,.tsv,.txt,image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: 'var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <Upload size={28} />
                </div>

                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Arraste o arquivo ou clique para selecionar
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Compatível com extratos <strong>OFX</strong>, planilhas <strong>CSV</strong> (Nubank, Itaú, Santander, etc.), e fotos ou prints de fatura (<strong>PNG, JPG</strong> via OCR).
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <FileSpreadsheet size={12} /> CSV / Excel
                  </span>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <FileText size={12} /> OFX Bancário
                  </span>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <ImageIcon size={12} /> Print / Foto da Fatura
                  </span>
                </div>
              </div>
            )}

            {/* TAB: COLAR TEXTO */}
            {activeTab === 'PASTE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Copie a lista de despesas do site ou aplicativo do seu banco e cole abaixo:
                </p>
                <textarea
                  className="form-input"
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                  placeholder={`Exemplo de linhas:\n10/09 IFOOD *RESTAURANTE R$ 64,90\n12/09 UBER *TRIP R$ 28,50\n15/09 DROGASIL FARMACIA R$ 142,00\n18/09 ZARA BRASIL (01/03) R$ 120,00`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-end', fontSize: '13px' }}
                  onClick={handleProcessPastedText}
                >
                  <Sparkles size={15} />
                  <span>Interpretar Despesas</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOADING PROGRESS BAR */}
        {isProcessing && (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--accent-cyan)' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {processingStatus}
            </h4>
            <div style={{ width: '280px', height: '6px', borderRadius: '3px', background: 'var(--bg-card-elevated)', margin: '0 auto', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${processingProgress}%`,
                  height: '100%',
                  background: 'var(--accent-cyan)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Cruzando descrições com as Naturezas cadastradas no seu Balder...
            </p>
          </div>
        )}

        {/* ETAPA 2: REVISÃO INTERATIVA DOS ITENS DETECTADOS */}
        {parsedResult && !isProcessing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Banner de Resumo da Leitura */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)' }}>
                    Leitura Automática Concluída ({parsedResult.detectedFormat})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                      {reviewedItems.length} despesas detectadas
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
                    <strong style={{ fontSize: '15px', color: '#38BDF8' }}>
                      Total: {fmtBRL(activeTotalAmount)}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={handleReset}
                >
                  Importar Outro Arquivo
                </button>
              </div>
            </div>

            {/* Tabela de Revisão dos Itens e Naturezas */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
              <table className="invoice-items-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.size === reviewedItems.length && reviewedItems.length > 0}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: 'pointer' }}
                        title="Marcar / Desmarcar todos"
                      />
                    </th>
                    <th>Descrição da Despesa</th>
                    <th style={{ width: '160px' }}>Natureza</th>
                    <th style={{ width: '160px' }}>Mapeamento</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Parcela</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Valor (R$)</th>
                    <th style={{ width: '36px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedItems.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    const isOutros = item.natureId === 'OUTROS';

                    return (
                      <tr
                        key={item.id}
                        style={{
                          opacity: isSelected ? 1 : 0.45,
                          background: isSelected ? undefined : 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectItem(item.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '4px 8px', fontWeight: 600 }}
                            value={item.description}
                            onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                          />
                          {item.matchedKeyword && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginTop: '3px',
                              }}
                            >
                              <Tag size={10} style={{ color: 'var(--accent-cyan)' }} />
                              Detectado via: <strong>{item.matchedKeyword}</strong>
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              fontWeight: 700,
                              borderColor: isOutros ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)',
                              color: isOutros ? '#FBBF24' : '#38BDF8',
                            }}
                            value={item.natureId}
                            onChange={(e) => handleNatureChange(item.id, e.target.value)}
                          >
                            <option value="OUTROS">Outros (Despesas Gerais)</option>
                            {natures.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              fontWeight: 700,
                              borderColor: (!item.mappingId || item.mappingId === 'OUTROS') ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)',
                              color: (!item.mappingId || item.mappingId === 'OUTROS') ? '#FBBF24' : '#38BDF8',
                            }}
                            value={item.mappingId || 'OUTROS'}
                            onChange={(e) => handleMappingChange(item.id, e.target.value)}
                          >
                            <option value="OUTROS">Outros</option>
                            {natures.find(n => n.id === item.natureId)?.mappings?.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {item.installments > 1 ? `${item.currentInstallment}/${item.installments}` : '1x'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {fmtBRL(item.amount)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remover da lista"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Opções e Confirmação */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '8px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={shouldUpdateInvoiceAmount}
                  onChange={(e) => setShouldUpdateInvoiceAmount(e.target.checked)}
                />
                <span>
                  Ajustar valor total da fatura para bater exatamente com a soma dos itens (<strong>{fmtBRL(activeTotalAmount)}</strong>)
                  {currentInvoiceAmount > 0 && (
                    <span style={{ opacity: 0.8, marginLeft: '6px' }}>
                      (Fatura atual: {fmtBRL(currentInvoiceAmount)})
                    </span>
                  )}
                </span>
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  style={{ gap: '6px' }}
                >
                  <Check size={16} />
                  <span>Importar {activeSelectedItems.length} Itens ({fmtBRL(activeTotalAmount)})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
