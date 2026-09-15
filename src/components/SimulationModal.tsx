import React, { useState } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { Car, CheckCircle2, AlertTriangle, XCircle, Home, CreditCard, Sparkles } from 'lucide-react';
import type { SimulationVerdict } from '../types';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPreset?: 'CARRO' | 'QUITAR_DIVIDA' | 'FINANCIAMENTO' | 'IMOVEL';
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  initialPreset = 'CARRO',
}) => {
  const { runSimulation } = useFinancial();
  const [selectedPreset, setSelectedPreset] = useState<'CARRO' | 'QUITAR_DIVIDA' | 'FINANCIAMENTO' | 'IMOVEL'>(initialPreset);

  const scenario = runSimulation(selectedPreset);

  const getVerdictBadge = (verdict: SimulationVerdict) => {
    switch (verdict) {
      case 'RECOMENDADO':
        return (
          <div className="verdict-badge verdict-success">
            <CheckCircle2 size={16} />
            <span>ALTAMENTE RECOMENDADO</span>
          </div>
        );
      case 'COM_RESTRICAO':
        return (
          <div className="verdict-badge verdict-warning">
            <AlertTriangle size={16} />
            <span>VIÁVEL COM RESTRIÇÕES</span>
          </div>
        );
      case 'NAO_RECOMENDADO':
        return (
          <div className="verdict-badge verdict-danger">
            <XCircle size={16} />
            <span>NÃO RECOMENDADO NO MOMENTO</span>
          </div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulador Rápido de Decisões"
      subtitle="Teste o impacto patrimonial e de liquidez antes de assumir compromissos"
      maxWidth="680px"
    >
      <div className="simulation-modal-content">
        {/* Presets Selector Grid */}
        <div className="simulation-presets-grid">
          <button
            className={`sim-preset-btn ${selectedPreset === 'CARRO' ? 'active' : ''}`}
            onClick={() => setSelectedPreset('CARRO')}
          >
            <Car size={20} />
            <span>Comprar Carro</span>
          </button>

          <button
            className={`sim-preset-btn ${selectedPreset === 'QUITAR_DIVIDA' ? 'active' : ''}`}
            onClick={() => setSelectedPreset('QUITAR_DIVIDA')}
          >
            <CheckCircle2 size={20} />
            <span>Quitar Dívida</span>
          </button>

          <button
            className={`sim-preset-btn ${selectedPreset === 'FINANCIAMENTO' ? 'active' : ''}`}
            onClick={() => setSelectedPreset('FINANCIAMENTO')}
          >
            <CreditCard size={20} />
            <span>Novo Financiamento</span>
          </button>

          <button
            className={`sim-preset-btn ${selectedPreset === 'IMOVEL' ? 'active' : ''}`}
            onClick={() => setSelectedPreset('IMOVEL')}
          >
            <Home size={20} />
            <span>Comprar Imóvel</span>
          </button>
        </div>

        {/* Verdict Box */}
        <div className="scenario-card glass-card">
          <div className="scenario-header">
            <div>
              <h4 className="scenario-title">{scenario.title}</h4>
              <p className="scenario-desc">{scenario.description}</p>
            </div>
            {getVerdictBadge(scenario.verdict)}
          </div>

          {/* Impact Metrics Grid */}
          <div className="scenario-metrics-grid">
            <div className="metric-box">
              <span className="metric-box-label">Desembolso Inicial</span>
              <span className="metric-box-value">
                {scenario.initialOutflow > 0
                  ? scenario.initialOutflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : 'R$ 0,00'}
              </span>
            </div>

            <div className="metric-box">
              <span className="metric-box-label">Impacto Mensal no Fluxo</span>
              <span className={`metric-box-value ${scenario.monthlyCost > 0 ? 'text-rose' : 'text-emerald'}`}>
                {scenario.monthlyCost > 0
                  ? `- ${scenario.monthlyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`
                  : `+ ${Math.abs(scenario.monthlyCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`}
              </span>
            </div>

            <div className="metric-box">
              <span className="metric-box-label">Reserva Runway</span>
              <span className="metric-box-value">
                {scenario.runwayBeforeMonths}m ➔ <strong className="text-cyan">{scenario.runwayAfterMonths}m</strong>
              </span>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="scenario-explanation">
            <h5>Diagnóstico do Motor Financeiro:</h5>
            <p>{scenario.explanation}</p>
          </div>

          {/* Action Recommendations */}
          <div className="scenario-recommendations">
            <h5>Recomendações Táticas:</h5>
            <ul>
              {scenario.actionRecommendations.map((rec, idx) => (
                <li key={idx}>
                  <Sparkles size={14} className="text-cyan" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-footer-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Salvar no Planejamento
          </button>
        </div>
      </div>
    </Modal>
  );
};
