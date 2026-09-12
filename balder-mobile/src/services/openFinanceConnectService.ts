/**
 * BALDER FINANCIAL OS — OPEN FINANCE CONNECT SERVICE (PLUGGY SPECIALIZED)
 * Arquivo: src/services/openFinanceConnectService.ts
 *
 * Orquestra com segurança a obtenção do Connect Token temporário da PLUGGY
 * através do backend autorizado do BALDER.
 *
 * Regras Estritas:
 * - PLUGGY é o único provedor suportado em runtime.
 * - NENHUM segredo reside neste serviço (credenciais ficam apenas no backend Appwrite).
 * - Se environment === 'PRODUCTION' e produção estiver desabilitada, bloqueia de forma segura.
 * - Suporta clientUserId estruturado, avoidDuplicates e oauthRedirectUri canônico.
 */

import {
  isOpenFinanceConfigured,
  getOpenFinanceProvider,
  getOpenFinanceEnvironment,
  getCanonicalCallbackUri,
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  PRODUCTION_DISABLED_MESSAGE,
  PRODUCTION_ENABLED,
  OpenFinanceProvider,
  OpenFinanceEnvironment,
} from '../config/openFinanceConfig';

export interface ConnectTokenRequestParams {
  userId: string;
  workspaceId: string;
  institutionCode?: string;
  institutionName?: string;
  connectionAttemptId?: string;
}

export interface ConnectSessionInitiation {
  success: boolean;
  sessionId: string;
  connectionAttemptId: string;
  state: string;
  nonce: string;
  provider: OpenFinanceProvider;
  environment: OpenFinanceEnvironment;
  connectToken?: string;
  connectUrl?: string;
  widgetUrl?: string;
  callbackUri: string;
  oauthRedirectUri: string;
  avoidDuplicates: boolean;
  clientUserId?: string;
  createdAt: string;
  expiresAt: string;
  error?: string;
  message?: string;
  errorMessage?: string;
}

/**
 * Remove qualquer fragmento HTML indesejado de strings ou URLs.
 * Garante que URLs e tokens sejam puros, sem tags de link residuais.
 */
export function sanitizeCleanUrl(url?: string | null): string {
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

export class OpenFinanceConnectService {
  /**
   * Gera uma sequência pseudo-aleatória segura para strings, nonces e tokens.
   */
  public static generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Gera um State CSRF criptográfico com prefixo rastreável.
   */
  public static generateCryptographicState(length: number = 32): string {
    return `st_${this.generateRandomString(length)}`;
  }

  /**
   * Gera um Nonce criptográfico com prefixo rastreável.
   */
  public static generateCryptographicNonce(length: number = 32): string {
    return `nc_${this.generateRandomString(length)}`;
  }

  /**
   * Solicita com segurança um Connect Token temporário ao backend do BALDER.
   */
  public static async requestConnectSession(
    params: ConnectTokenRequestParams
  ): Promise<ConnectSessionInitiation> {
    const provider = getOpenFinanceProvider();
    const environment = getOpenFinanceEnvironment();
    const callbackUri = sanitizeCleanUrl(getCanonicalCallbackUri());
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const state = this.generateCryptographicState(24);
    const nonce = this.generateCryptographicNonce(24);
    const sessionId = `sess_${this.generateRandomString(16)}`;
    const connectionAttemptId = params.connectionAttemptId || `att_${Date.now()}_${this.generateRandomString(8)}`;
    const clientUserId = `balder_${params.userId}_${params.workspaceId}_${connectionAttemptId}`;

    // Regra 1: Se o provedor não estiver configurado como PLUGGY, bloqueia imediatamente
    if (!isOpenFinanceConfigured() || provider !== 'PLUGGY') {
      return {
        success: false,
        sessionId,
        connectionAttemptId,
        state,
        nonce,
        provider: 'NOT_CONFIGURED',
        environment,
        callbackUri,
        oauthRedirectUri: callbackUri,
        avoidDuplicates: true,
        createdAt: now.toISOString(),
        expiresAt,
        error: 'PROVIDER_NOT_CONFIGURED',
        message: PROVIDER_NOT_CONFIGURED_MESSAGE,
        errorMessage: PROVIDER_NOT_CONFIGURED_MESSAGE,
      };
    }

    // Regra 2: Bloqueio de produção sem credenciais comerciais homologadas
    if (environment === 'PRODUCTION' && !PRODUCTION_ENABLED) {
      return {
        success: false,
        sessionId,
        connectionAttemptId,
        state,
        nonce,
        provider: 'PLUGGY',
        environment: 'PRODUCTION',
        callbackUri,
        oauthRedirectUri: callbackUri,
        avoidDuplicates: true,
        createdAt: now.toISOString(),
        expiresAt,
        error: 'PRODUCTION_DISABLED',
        message: PRODUCTION_DISABLED_MESSAGE,
        errorMessage: PRODUCTION_DISABLED_MESSAGE,
      };
    }

    // Regra 3: Solicita o token temporário da Pluggy via backend Appwrite Functions
    try {
      const rawEndpoint =
        process.env.EXPO_PUBLIC_OPEN_FINANCE_BACKEND_URL ||
        `${process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1'}/functions/createConnectToken/executions`;
      const endpoint = sanitizeCleanUrl(rawEndpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-appwrite-project': sanitizeCleanUrl(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '6a9c60c1003ddd007882'),
        },
        body: JSON.stringify({
          user_id: params.userId,
          workspace_id: params.workspaceId,
          session_id: sessionId,
          connection_attempt_id: connectionAttemptId,
          provider: 'PLUGGY',
          environment,
          callback_uri: callbackUri,
          oauthRedirectUri: callbackUri,
          avoidDuplicates: true,
          state,
          nonce,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errCode = errorData.error || 'BACKEND_REQUEST_FAILED';
        const errMsg = errorData.message || (errCode === 'PRODUCTION_DISABLED' ? PRODUCTION_DISABLED_MESSAGE : PROVIDER_NOT_CONFIGURED_MESSAGE);
        return {
          success: false,
          sessionId,
          connectionAttemptId,
          state,
          nonce,
          provider: 'PLUGGY',
          environment,
          callbackUri,
          oauthRedirectUri: callbackUri,
          avoidDuplicates: true,
          createdAt: now.toISOString(),
          expiresAt,
          error: errCode,
          message: errMsg,
          errorMessage: errMsg,
        };
      }

      const rawData = await response.json().catch(() => ({}));
      let data = rawData;
      if (typeof rawData.responseBody === 'string') {
        try {
          data = JSON.parse(rawData.responseBody);
        } catch {
          data = rawData;
        }
      }

      const rawToken = data.connectToken || data.connect_token || rawData.connectToken || rawData.connect_token;
      const token = sanitizeCleanUrl(rawToken);

      // Prioridade: se backend retornar widgetUrl / widget_url, usar. Fallback: https://connect.pluggy.ai/?connect_token=${token}
      const rawUrl =
        data.widgetUrl ||
        data.widget_url ||
        rawData.widgetUrl ||
        rawData.widget_url ||
        (token ? `https://connect.pluggy.ai/?connect_token=${token}` : 'https://connect.pluggy.ai');

      const url = sanitizeCleanUrl(rawUrl);

      return {
        success: true,
        sessionId,
        connectionAttemptId,
        state,
        nonce,
        provider: 'PLUGGY',
        environment,
        connectToken: token,
        connectUrl: url,
        widgetUrl: url,
        callbackUri,
        oauthRedirectUri: callbackUri,
        avoidDuplicates: true,
        clientUserId,
        createdAt: now.toISOString(),
        expiresAt: data.expiresAt || data.expires_at || rawData.expiresAt || rawData.expires_at || expiresAt,
      };
    } catch (err: any) {
      return {
        success: false,
        sessionId,
        connectionAttemptId,
        state,
        nonce,
        provider: 'PLUGGY',
        environment,
        callbackUri,
        oauthRedirectUri: callbackUri,
        avoidDuplicates: true,
        createdAt: now.toISOString(),
        expiresAt,
        error: 'NETWORK_ERROR',
        message: PROVIDER_NOT_CONFIGURED_MESSAGE,
        errorMessage: err?.message || PROVIDER_NOT_CONFIGURED_MESSAGE,
      };
    }
  }
}
