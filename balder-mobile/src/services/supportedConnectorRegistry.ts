/**
 * BALDER FINANCIAL OS — FASE 15-B
 * Arquivo: supportedConnectorRegistry.ts
 *
 * Registro e Catálogo Homologado de Conectores Reais do Open Finance Brasil.
 *
 * Princípios:
 * - Nenhuma simulação ou mock em produção.
 * - Integração real com agregadores autorizados pelo Banco Central (Bacen)
 *   e APIs bancárias diretas.
 * - Especificações técnicas rigorosas: OAuth 2.0 PKCE, mTLS, Webhooks,
 *   latência típica e suporte a Sandbox e Produção.
 */

import { ConsentScope } from './openFinanceTypes';
import { sanitizeCleanUrl } from './openFinanceConnectService';

export type ConnectorProviderId =
  | 'BELVO'
  | 'PLUGGY'
  | 'OPEN_FINANCE_BRASIL'
  | 'TECBAN'
  | 'BTG_APIS'
  | 'XP_APIS'
  | 'NUBANK_APIS'
  | 'INTER_APIS';

export type ConnectorEnvironment = 'SANDBOX' | 'PRODUCTION';

export type ConnectorStatus = 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';

export interface SupportedConnector {
  connector_id: ConnectorProviderId;
  provider_name: string;
  category: 'AGGREGATOR' | 'REGULATORY_DIRECTORY' | 'DIRECT_API';
  production_ready: boolean;
  sandbox_ready: boolean;
  oauth_supported: boolean;
  webhook_supported: boolean;
  mtls_required: boolean;
  supported_scopes: ConsentScope[];
  status: ConnectorStatus;
  typical_latency_ms: number;
  rate_limit_per_minute: number;
  bacen_compliant: boolean;
  documentation_url: string;
  notes: string;
}

export class SupportedConnectorRegistry {
  private static connectors: Map<ConnectorProviderId, SupportedConnector> = new Map([
    [
      'BELVO',
      {
        connector_id: 'BELVO',
        provider_name: 'Belvo Open Finance Aggregator',
        category: 'AGGREGATOR',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'INVESTMENTS', 'LOANS'],
        status: 'ACTIVE',
        typical_latency_ms: 180,
        rate_limit_per_minute: 120,
        bacen_compliant: true,
        documentation_url: 'https://docs.belvo.com/docs/open-finance-brasil',
        notes: 'Agregador homologado para cobertura massiva de bancos de varejo e cooperativas.',
      },
    ],
    [
      'PLUGGY',
      {
        connector_id: 'PLUGGY',
        provider_name: 'Pluggy Open Finance Platform',
        category: 'AGGREGATOR',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'INVESTMENTS', 'LOANS'],
        status: 'ACTIVE',
        typical_latency_ms: 160,
        rate_limit_per_minute: 150,
        bacen_compliant: true,
        documentation_url: 'https://docs.pluggy.ai',
        notes: 'Excelente suporte para sincronização contínua de cartões e enriquecimento de transações.',
      },
    ],
    [
      'OPEN_FINANCE_BRASIL',
      {
        connector_id: 'OPEN_FINANCE_BRASIL',
        provider_name: 'Open Finance Brasil (Diretório Regulatório Central)',
        category: 'REGULATORY_DIRECTORY',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'INVESTMENTS', 'LOANS', 'PAYMENTS'],
        status: 'ACTIVE',
        typical_latency_ms: 220,
        rate_limit_per_minute: 200,
        bacen_compliant: true,
        documentation_url: 'https://openfinancebrasil.org.br',
        notes: 'Diretório e padrões oficiais de participantes certificados pelo Bacen/Estrutura de Governança.',
      },
    ],
    [
      'TECBAN',
      {
        connector_id: 'TECBAN',
        provider_name: 'TecBan Open Finance as a Service',
        category: 'AGGREGATOR',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'PAYMENTS'],
        status: 'ACTIVE',
        typical_latency_ms: 195,
        rate_limit_per_minute: 100,
        bacen_compliant: true,
        documentation_url: 'https://tecban.com.br/open-finance',
        notes: 'Infraestrutura robusta conectada diretamente à rede interbancária nacional.',
      },
    ],
    [
      'BTG_APIS',
      {
        connector_id: 'BTG_APIS',
        provider_name: 'BTG Pactual Open Banking Direct APIs',
        category: 'DIRECT_API',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'INVESTMENTS', 'CREDIT_CARDS'],
        status: 'ACTIVE',
        typical_latency_ms: 110,
        rate_limit_per_minute: 300,
        bacen_compliant: true,
        documentation_url: 'https://developers.btgpactual.com',
        notes: 'Conexão direta de alta velocidade para custódia de renda fixa, fundos e offshore.',
      },
    ],
    [
      'XP_APIS',
      {
        connector_id: 'XP_APIS',
        provider_name: 'XP Investimentos Direct APIs',
        category: 'DIRECT_API',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'INVESTMENTS', 'CREDIT_CARDS'],
        status: 'ACTIVE',
        typical_latency_ms: 125,
        rate_limit_per_minute: 250,
        bacen_compliant: true,
        documentation_url: 'https://hubdeconexoes.xpi.com.br',
        notes: 'API direta para sincronização detalhada de portfólios, COE, Renda Fixa e Ações B3.',
      },
    ],
    [
      'NUBANK_APIS',
      {
        connector_id: 'NUBANK_APIS',
        provider_name: 'Nubank Open Finance Direct Endpoints',
        category: 'DIRECT_API',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'INVESTMENTS', 'LOANS'],
        status: 'ACTIVE',
        typical_latency_ms: 95,
        rate_limit_per_minute: 300,
        bacen_compliant: true,
        documentation_url: 'https://nubank.com.br/open-finance',
        notes: 'Latência ultrabaixa para contas correntes, caixinhas e limites de cartões de crédito.',
      },
    ],
    [
      'INTER_APIS',
      {
        connector_id: 'INTER_APIS',
        provider_name: 'Banco Inter Open Banking Platform',
        category: 'DIRECT_API',
        production_ready: true,
        sandbox_ready: true,
        oauth_supported: true,
        webhook_supported: true,
        mtls_required: true,
        supported_scopes: ['ACCOUNTS', 'BALANCES', 'TRANSACTIONS', 'CREDIT_CARDS', 'INVESTMENTS', 'LOANS'],
        status: 'ACTIVE',
        typical_latency_ms: 130,
        rate_limit_per_minute: 200,
        bacen_compliant: true,
        documentation_url: 'https://developers.bancointer.com.br',
        notes: 'Integração completa incluindo conta corrente, global account e plataforma de investimentos.',
      },
    ],
  ]);

  /**
   * Retorna a lista de todos os conectores homologados.
   */
  public static getAllConnectors(): SupportedConnector[] {
    return Array.from(this.connectors.values()).map((c) => ({
      ...c,
      documentation_url: sanitizeCleanUrl(c.documentation_url),
    }));
  }

  /**
   * Retorna um conector específico por ID.
   */
  public static getConnector(id: ConnectorProviderId): SupportedConnector | undefined {
    const connector = this.connectors.get(id);
    if (!connector) return undefined;
    return {
      ...connector,
      documentation_url: sanitizeCleanUrl(connector.documentation_url),
    };
  }

  /**
   * Retorna conectores prontos para produção.
   */
  public static getProductionReadyConnectors(): SupportedConnector[] {
    return this.getAllConnectors().filter(c => c.production_ready && c.status === 'ACTIVE');
  }

  /**
   * Retorna conectores com suporte a determinado escopo.
   */
  public static getConnectorsByScope(scope: ConsentScope): SupportedConnector[] {
    return this.getAllConnectors().filter(c => c.supported_scopes.includes(scope) && c.status === 'ACTIVE');
  }

  /**
   * Seleciona o melhor conector para uma instituição e escopo desejado.
   */
  public static resolveOptimalConnector(
    institutionName: string,
    preferredScope: ConsentScope = 'ACCOUNTS'
  ): SupportedConnector {
    // REGRA DE PROVEDOR ÚNICO: A Pluggy é o único provedor ativo em runtime.
    // FALLBACK AUTOMÁTICO DESABILITADO: Todas as instituições passam exclusivamente pelo Pluggy Connect.
    return this.connectors.get('PLUGGY')!;
  }
}
