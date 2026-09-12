/**
 * BALDER FINANCIAL OS — OPEN FINANCE CONFIGURATION
 * Arquivo: src/config/openFinanceConfig.ts
 *
 * Configuração canônica de Provedor, Ambiente e Callbacks do Open Finance.
 *
 * REGRAS OPERACIONAIS ESTRITAS (FASE 2 & 4):
 * - PLUGGY é o ÚNICO provedor ativo em runtime.
 * - BELVO e OTHER estão permanentemente DESABILITADOS em runtime.
 * - Fallback automático entre provedores está BLOQUEADO.
 * - Ambiente padrão: SANDBOX (com is_test_data = true).
 * - Produção BLOQUEADA (productionEnabled = false) até validação com credenciais comerciais.
 * - Segredos NUNCA são expostos no bundle cliente (sem EXPO_PUBLIC_ para segredos).
 */

export type OpenFinanceProvider = 'PLUGGY' | 'BELVO' | 'OTHER' | 'NOT_CONFIGURED';
export type OpenFinanceEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface OpenFinanceRuntimeConfig {
  provider: OpenFinanceProvider;
  environment: OpenFinanceEnvironment;
  backendBaseUrl: string;
  connectTokenEndpoint: string;
  oauthRedirectUri: string;
  canonicalCallbackUri: string;
  webhookUrl: string;
  enabledProducts: string[];
  includeSandbox: boolean;
  productionEnabled: boolean;
  isProductionBlocked: boolean;
  is_test_data: boolean;
  diagnosticsEnabled: boolean;
  isConfigured: boolean;
}

export interface DataProvenance {
  source_type: string;
  provider: OpenFinanceProvider;
  environment: OpenFinanceEnvironment;
  item_id?: string;
  connector_id?: string | number;
  provider_item_id?: string;
  provider_link_id?: string;
  provider_record_id?: string;
  institution_id?: string;
  workspace_id: string;
  user_id: string;
  source_id?: string;
  source_timestamp: string;
  synced_at?: string;
  is_test_data: boolean;
}

// Resolução de variáveis de ambiente públicas (seguras)
const RAW_PROVIDER = (process.env.EXPO_PUBLIC_OPEN_FINANCE_PROVIDER || 'PLUGGY').toUpperCase();
const RAW_MODE = (process.env.EXPO_PUBLIC_OPEN_FINANCE_ENVIRONMENT || 'SANDBOX').toUpperCase();

/**
 * Provedor canônico ativo em runtime.
 * Somente PLUGGY pode estar ativa em runtime no BALDER.
 */
export const ACTIVE_RUNTIME_PROVIDER: OpenFinanceProvider = 'PLUGGY';

export function resolveOpenFinanceProvider(raw: string = RAW_PROVIDER): OpenFinanceProvider {
  switch (raw) {
    case 'PLUGGY':
      return 'PLUGGY';
    case 'BELVO':
      // BELVO: DISABLED em runtime
      return 'NOT_CONFIGURED';
    case 'OTHER':
      // OTHER: DISABLED em runtime
      return 'NOT_CONFIGURED';
    case 'NOT_CONFIGURED':
    default:
      return 'NOT_CONFIGURED';
  }
}

export function resolveOpenFinanceEnvironment(raw: string = RAW_MODE): OpenFinanceEnvironment {
  return raw === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
}

// REGRA INEGOCIÁVEL: Somente PLUGGY é aceita como provedor ativo em runtime
// Se vier BELVO ou OTHER, o runtime desativa imediatamente
export const OPEN_FINANCE_PROVIDER: OpenFinanceProvider = resolveOpenFinanceProvider(RAW_PROVIDER);

export const OPEN_FINANCE_ENVIRONMENT: OpenFinanceEnvironment = resolveOpenFinanceEnvironment(RAW_MODE);

// Status de provedores em runtime
export const RUNTIME_PROVIDER_STATUS: Record<OpenFinanceProvider, 'ACTIVE' | 'DISABLED'> = {
  PLUGGY: OPEN_FINANCE_PROVIDER === 'PLUGGY' ? 'ACTIVE' : 'DISABLED',
  BELVO: 'DISABLED',
  OTHER: 'DISABLED',
  NOT_CONFIGURED: 'DISABLED',
};

// Regras de ambiente
export const IS_SANDBOX = OPEN_FINANCE_ENVIRONMENT === 'SANDBOX';
export const INCLUDE_SANDBOX = IS_SANDBOX;

// Produção: Bloqueada por padrão (safe-fail) até confirmação explícita
export const PRODUCTION_ENABLED =
  OPEN_FINANCE_ENVIRONMENT === 'PRODUCTION' &&
  process.env.EXPO_PUBLIC_OPEN_FINANCE_PRODUCTION_ENABLED === 'true';

/**
 * Remove qualquer fragmento HTML indesejado de URLs de configuração.
 */
export function sanitizeCleanConfigUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url;
  const matchHref = cleaned.match(/href=["']?([^"'>\s]+)/i);
  if (matchHref) {
    cleaned = matchHref[1];
  }
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  return cleaned.trim();
}

// Callbacks e Schemes Canônicos
export const CANONICAL_SCHEME = 'balder';
export const CANONICAL_CALLBACK_SCHEME = 'balder';
export const CANONICAL_CALLBACK_PATH = 'open-finance/callback';
export const CANONICAL_CALLBACK_URI = sanitizeCleanConfigUrl('balder://open-finance/callback');
export const OAUTH_REDIRECT_URI = CANONICAL_CALLBACK_URI;

// Endpoints de Backend
export const BACKEND_BASE_URL = sanitizeCleanConfigUrl(
  process.env.EXPO_PUBLIC_OPEN_FINANCE_BACKEND_URL ||
  `${sanitizeCleanConfigUrl(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT) || 'https://sfo.cloud.appwrite.io/v1'}/functions`
);

export const BACKEND_CONNECT_TOKEN_ENDPOINT = `${BACKEND_BASE_URL}/createConnectToken/executions`;
export const BACKEND_WEBHOOK_URL = `${BACKEND_BASE_URL}/openFinanceWebhook/executions`;

// Produtos financeiros habilitados no Open Finance Brasil
export const ENABLED_PRODUCTS = [
  'ACCOUNTS',
  'TRANSACTIONS',
  'CREDIT_CARDS',
  'INVESTMENTS',
  'LOANS',
  'IDENTITY',
];

export const OPEN_FINANCE_CONFIG: OpenFinanceRuntimeConfig = {
  provider: OPEN_FINANCE_PROVIDER,
  environment: OPEN_FINANCE_ENVIRONMENT,
  backendBaseUrl: BACKEND_BASE_URL,
  connectTokenEndpoint: BACKEND_CONNECT_TOKEN_ENDPOINT,
  oauthRedirectUri: OAUTH_REDIRECT_URI,
  canonicalCallbackUri: CANONICAL_CALLBACK_URI,
  webhookUrl: BACKEND_WEBHOOK_URL,
  enabledProducts: ENABLED_PRODUCTS,
  includeSandbox: INCLUDE_SANDBOX,
  productionEnabled: PRODUCTION_ENABLED,
  isProductionBlocked: !PRODUCTION_ENABLED,
  is_test_data: true,
  diagnosticsEnabled: true,
  isConfigured: OPEN_FINANCE_PROVIDER === 'PLUGGY',
};

/**
 * Retorna true se a Pluggy estiver devidamente ativa.
 */
export function isOpenFinanceConfigured(): boolean {
  return OPEN_FINANCE_PROVIDER === 'PLUGGY';
}

/**
 * Retorna se um provedor específico está habilitado em runtime.
 */
export function isProviderEnabled(provider: OpenFinanceProvider): boolean {
  return provider === 'PLUGGY' && OPEN_FINANCE_PROVIDER === 'PLUGGY';
}

/**
 * Retorna o provedor ativo em runtime (sempre PLUGGY ou NOT_CONFIGURED).
 */
export function getOpenFinanceProvider(): OpenFinanceProvider {
  return OPEN_FINANCE_PROVIDER;
}

/**
 * Retorna o ambiente ativo (SANDBOX ou PRODUCTION).
 */
export function getOpenFinanceEnvironment(): OpenFinanceEnvironment {
  return OPEN_FINANCE_ENVIRONMENT;
}

/**
 * Retorna se o ambiente atual é Sandbox de testes.
 */
export function isSandboxEnvironment(): boolean {
  return OPEN_FINANCE_ENVIRONMENT === 'SANDBOX';
}

/**
 * Retorna a flag de dados de teste (is_test_data).
 * Sempre true para Sandbox, false para Produção.
 */
export function isTestData(environment: OpenFinanceEnvironment = OPEN_FINANCE_ENVIRONMENT): boolean {
  return environment !== 'PRODUCTION';
}

/**
 * Retorna o URI canônico de redirecionamento para autorização OAuth.
 */
export function getCanonicalCallbackUri(): string {
  return CANONICAL_CALLBACK_URI;
}

/**
 * Retorna o nome amigável para exibição do provedor.
 */
export function getProviderDisplayName(provider: OpenFinanceProvider = OPEN_FINANCE_PROVIDER): string {
  switch (provider) {
    case 'PLUGGY':
      return 'Pluggy Open Finance Platform';
    case 'BELVO':
      return 'Belvo Open Finance Brasil (Desativado)';
    case 'OTHER':
      return 'Provedor Bacen (Desativado)';
    case 'NOT_CONFIGURED':
    default:
      return 'Nenhum Provedor Configurado';
  }
}

/**
 * Mensagens padronizadas regulatórias
 */
export const PROVIDER_NOT_CONFIGURED_MESSAGE =
  'Conexão bancária indisponível.\n\nO provedor Open Finance ainda não está configurado para este ambiente.';

export const PRODUCTION_DISABLED_MESSAGE =
  'Open Finance em produção ainda não está habilitado.';

export const SANDBOX_BADGE_LABEL = 'Ambiente de teste Pluggy';

export const SANDBOX_DISCLAIMER_MESSAGE =
  'Os dados apresentados nesta conexão são simulados e servem exclusivamente para validar a integração.';
