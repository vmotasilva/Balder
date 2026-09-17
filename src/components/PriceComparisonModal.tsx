import React from 'react';
import { X, TrendingDown, TrendingUp, Store, Award, Sparkles } from 'lucide-react';
import { compareItemPrices, type StorePriceComparison } from '../services/priceComparisonService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentPrice?: number;
  currentStore?: string;
}

export const PriceComparisonModal: React.FC<Props> = ({
  isOpen,
  onClose,
  itemName,
  currentPrice,
  currentStore,
}) => {
  if (!isOpen || !itemName) return null;

  const comparison: StorePriceComparison | null = compareItemPrices(
    itemName,
    currentPrice,
    currentStore
  );

  return (
    <div className="modal-overlay price-compare-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-content price-compare-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="price-compare-modal-header">
          <div className="pcm-header-left">
            <div className="pcm-icon-badge">
              <Store size={20} />
            </div>
            <div>
              <h3 className="pcm-title">Comparador de Preços por Estabelecimento</h3>
              <p className="pcm-subtitle">
                Onde é melhor comprar: <strong>{itemName}</strong>
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Comparador */}
        <div className="pcm-body">
          {comparison ? (
            <>
              {/* Recomendação de Melhor Compra */}
              <div className="pcm-recommendation-card">
                <div className="pcm-rec-icon">
                  <Award size={24} className="text-amber" />
                </div>
                <div className="pcm-rec-content">
                  <span className="pcm-rec-kicker">INTELIGÊNCIA DE MERCADO BALDER</span>
                  <p className="pcm-rec-text">{comparison.recommendation}</p>
                </div>
              </div>

              {/* Grid com Menor vs Maior Preço */}
              <div className="pcm-stats-grid">
                {comparison.cheapest && (
                  <div className="pcm-stat-card highlight-cheapest">
                    <div className="pcm-stat-label">
                      <TrendingDown size={14} className="text-emerald" />
                      <span>Menor Preço Encontrado</span>
                    </div>
                    <span className="pcm-stat-price text-emerald">
                      {comparison.cheapest.unitPrice.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                    <span className="pcm-stat-store">
                      {comparison.cheapest.store} ({comparison.cheapest.date})
                    </span>
                  </div>
                )}

                {comparison.mostExpensive && (
                  <div className="pcm-stat-card highlight-expensive">
                    <div className="pcm-stat-label">
                      <TrendingUp size={14} className="text-rose" />
                      <span>Maior Preço Registrado</span>
                    </div>
                    <span className="pcm-stat-price text-rose">
                      {comparison.mostExpensive.unitPrice.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                    <span className="pcm-stat-store">
                      {comparison.mostExpensive.store} ({comparison.mostExpensive.date})
                    </span>
                  </div>
                )}

                <div className="pcm-stat-card">
                  <div className="pcm-stat-label">
                    <Sparkles size={14} className="text-cyan" />
                    <span>Diferença de Mercado</span>
                  </div>
                  <span className="pcm-stat-price text-cyan">
                    {comparison.priceSpreadPercent}%
                  </span>
                  <span className="pcm-stat-store">
                    {comparison.savingsVsCheapest > 0
                      ? `Economia de até R$ ${comparison.savingsVsCheapest.toFixed(2)} / un`
                      : 'Melhor preço atingido nesta compra'}
                  </span>
                </div>
              </div>

              {/* Tabela com Histórico de Preços por Mercado */}
              <div className="pcm-history-section">
                <h4 className="pcm-history-title">Histórico de Preços por Estabelecimento</h4>
                <div className="pcm-history-table-wrap">
                  <table className="pcm-table">
                    <thead>
                      <tr>
                        <th>Estabelecimento</th>
                        <th>Data</th>
                        <th style={{ textAlign: 'right' }}>Preço Unitário</th>
                        <th style={{ textAlign: 'center' }}>Veredito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.observations
                        .slice()
                        .sort((a, b) => a.unitPrice - b.unitPrice)
                        .map((obs, idx) => {
                          const isBest = idx === 0;
                          const isWorst = idx === comparison.observations.length - 1 && comparison.observations.length > 1;

                          return (
                            <tr key={obs.id || idx} className={isBest ? 'row-best-price' : ''}>
                              <td>
                                <div className="store-name-cell">
                                  <Store size={13} className={isBest ? 'text-emerald' : 'text-slate'} />
                                  <strong className={isBest ? 'text-emerald' : 'text-slate'}>
                                    {obs.store}
                                  </strong>
                                </div>
                              </td>
                              <td className="text-muted">{obs.date}</td>
                              <td style={{ textAlign: 'right' }}>
                                <strong className={isBest ? 'text-emerald' : 'text-white'}>
                                  {obs.unitPrice.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </strong>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isBest ? (
                                  <span className="badge badge-emerald">
                                    <Award size={10} /> Melhor Opção
                                  </span>
                                ) : isWorst ? (
                                  <span className="badge badge-rose">Mais Caro</span>
                                ) : (
                                  <span className="badge badge-slate">Intermediário</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="pcm-empty-state">
              <Store size={36} className="text-muted" />
              <p>
                Ainda não há outros preços registrados para este item em diferentes mercados.
              </p>
              <span>
                Conforme você lança cupons de outros estabelecimentos (ex: Assaí, Atacadão, Feira Livre), o Balder cruzará automaticamente os preços!
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="price-compare-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
