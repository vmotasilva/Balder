/**
 * BALDER FINANCIAL OS — OPEN FINANCE TECHNICAL DIAGNOSTICS (PLUGGY)
 * Arquivo: src/screens/OpenFinanceDiagnosticsScreen.tsx
 *
 * Tela de diagnóstico técnico (disponível apenas em modo desenvolvimento / administração).
 * Exibe metadados de configuração e saúde de integração da Pluggy sem expor segredos.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import {
  OPEN_FINANCE_CONFIG,
  isOpenFinanceConfigured,
  CANONICAL_CALLBACK_URI,
  CANONICAL_SCHEME,
  isSandboxEnvironment,
} from '../config/openFinanceConfig';
import { OpenFinanceConnectService, sanitizeCleanUrl } from '../services/openFinanceConnectService';

interface DiagnosticData {
  provider: string;
  environment: string;
  productionEnabled: boolean;
  includeSandbox: boolean;
  callbackUri: string;
  scheme: string;
  buildVersion: string;
  runtimeVersion: string;
  backendStatus: 'ONLINE' | 'OFFLINE' | 'UNCONFIGURED' | 'CHECKING';
  backendAuth: 'SUCCESS' | 'FAILED' | 'CHECKING';
  apiKeyActive: boolean;
  widgetStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  tokenRequested: boolean;
  widgetOpened: boolean;
  deepLinkReceived: boolean;
  onSuccessReceived: boolean;
  itemIdReceived: boolean;
  itemValidated: boolean;
  webhookReceived: boolean;
  syncInitiated: boolean;
  syncCompleted: boolean;
  dataPersisted: boolean;
  lastAttemptTimestamp: string | null;
  lastErrorCode: string | null;
  lastError: string | null;
  requestId: string | null;
  connectionAttemptId: string | null;
}

export default function OpenFinanceDiagnosticsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiagnosticData>({
    provider: 'PLUGGY',
    environment: OPEN_FINANCE_CONFIG.environment,
    productionEnabled: OPEN_FINANCE_CONFIG.productionEnabled,
    includeSandbox: OPEN_FINANCE_CONFIG.includeSandbox,
    callbackUri: sanitizeCleanUrl(CANONICAL_CALLBACK_URI),
    scheme: sanitizeCleanUrl(CANONICAL_SCHEME),
    buildVersion: '1.0.0-alpha.12 (EAS Build)',
    runtimeVersion: '1.0.0',
    backendStatus: 'CHECKING',
    backendAuth: 'CHECKING',
    apiKeyActive: false,
    widgetStatus: isOpenFinanceConfigured() ? 'AVAILABLE' : 'NOT_CONFIGURED',
    tokenRequested: false,
    widgetOpened: false,
    deepLinkReceived: false,
    onSuccessReceived: false,
    itemIdReceived: false,
    itemValidated: false,
    webhookReceived: false,
    syncInitiated: false,
    syncCompleted: false,
    dataPersisted: false,
    lastAttemptTimestamp: null,
    lastErrorCode: null,
    lastError: null,
    requestId: null,
    connectionAttemptId: null,
  });

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      if (!isOpenFinanceConfigured()) {
        setData((prev) => ({
          ...prev,
          backendStatus: 'UNCONFIGURED',
          widgetStatus: 'NOT_CONFIGURED',
        }));
        setLoading(false);
        return;
      }

      // Tenta ping no endpoint backend do token Pluggy
      const session = await OpenFinanceConnectService.requestConnectSession({
        userId: 'diag_admin',
        workspaceId: 'diag_ws',
      });

      setData((prev) => ({
        ...prev,
        backendStatus: session.success ? 'ONLINE' : 'OFFLINE',
        widgetStatus: session.success ? 'AVAILABLE' : 'UNAVAILABLE',
        tokenRequested: true,
        requestId: session.sessionId || null,
        connectionAttemptId: session.connectionAttemptId || null,
        lastErrorCode: session.error || null,
        lastError: session.errorMessage || null,
        lastAttemptTimestamp: new Date().toISOString(),
      }));
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        backendStatus: 'OFFLINE',
        widgetStatus: 'UNAVAILABLE',
        lastErrorCode: 'HEALTH_CHECK_FAILED',
        lastError: err?.message || 'Erro inesperado na verificação de saúde.',
        lastAttemptTimestamp: new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const handleShareDiagnostics = async () => {
    try {
      const summary = `BALDER Open Finance Diagnostics (PLUGGY)\n` +
        `Provedor: ${data.provider}\n` +
        `Ambiente: ${data.environment}\n` +
        `Produção Habilitada: ${data.productionEnabled ? 'Sim' : 'Não'}\n` +
        `Sandbox Habilitado: ${data.includeSandbox ? 'Sim' : 'Não'}\n` +
        `Callback URI: ${data.callbackUri}\n` +
        `Scheme: ${data.scheme}://\n` +
        `Build: ${data.buildVersion}\n` +
        `Runtime: ${data.runtimeVersion}\n` +
        `Backend: ${data.backendStatus}\n` +
        `Widget: ${data.widgetStatus}\n` +
        `Token Solicitado: ${data.tokenRequested ? 'Sim' : 'Não'}\n` +
        `Widget Aberto: ${data.widgetOpened ? 'Sim' : 'Não'}\n` +
        `Item ID Recebido: ${data.itemIdReceived ? 'Sim' : 'Não'}\n` +
        `Item Validado: ${data.itemValidated ? 'Sim' : 'Não'}\n` +
        `Webhook Recebido: ${data.webhookReceived ? 'Sim' : 'Não'}\n` +
        `Sync Iniciado: ${data.syncInitiated ? 'Sim' : 'Não'}\n` +
        `Sync Concluído: ${data.syncCompleted ? 'Sim' : 'Não'}\n` +
        `Request ID: ${data.requestId || 'N/A'}\n` +
        `Attempt ID: ${data.connectionAttemptId || 'N/A'}\n` +
        `Último Código: ${data.lastErrorCode || 'Nenhum'}\n` +
        `Último Erro: ${data.lastError || 'Nenhum'}`;
      await Share.share({ message: summary });
    } catch {}
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.title}>Diagnóstico Pluggy Open Finance</Text>
        <Text style={styles.subtitle}>
          Inspeção técnica do pipeline OAuth 2.0 e Provedor (sem exposição de segredos).
        </Text>
      </View>

      {/* Cartão de Configuração Ativa */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Configuração do Provedor</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Provedor Ativo:</Text>
          <View style={[styles.badge, styles.badgeOk]}>
            <Text style={styles.badgeText}>{data.provider}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Ambiente:</Text>
          <View style={[styles.badge, isSandboxEnvironment() ? styles.badgeWarn : styles.badgeOk]}>
            <Text style={styles.badgeText}>{data.environment}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Produção Habilitada:</Text>
          <Text style={[styles.value, { color: data.productionEnabled ? '#34D399' : '#94A3B8' }]}>
            {data.productionEnabled ? 'Sim' : 'Não (Bloqueada)'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Sandbox de Testes:</Text>
          <Text style={[styles.value, { color: data.includeSandbox ? '#38BDF8' : '#94A3B8' }]}>
            {data.includeSandbox ? 'Ativo (is_test_data = true)' : 'Inativo'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Callback URI:</Text>
          <Text style={styles.codeText}>{data.callbackUri}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Deep Link Scheme:</Text>
          <Text style={styles.codeText}>{data.scheme}://</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Versão da Build:</Text>
          <Text style={styles.value}>{data.buildVersion}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Runtime Version:</Text>
          <Text style={styles.value}>{data.runtimeVersion}</Text>
        </View>
      </View>

      {/* Cartão de Conectividade e Saúde */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pipeline de Integração</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Status do Backend:</Text>
          <Text style={[styles.value, { color: data.backendStatus === 'ONLINE' ? '#34D399' : '#F87171' }]}>
            {data.backendStatus}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Autenticação Backend Pluggy:</Text>
          <Text style={[styles.value, { color: data.backendAuth === 'SUCCESS' ? '#34D399' : '#F87171' }]}>
            {data.backendAuth === 'SUCCESS' ? 'Sucesso' : data.backendAuth === 'FAILED' ? 'Falha' : 'Verificando'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>API Key Ativa (Servidor):</Text>
          <Text style={styles.value}>{data.apiKeyActive ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Status Pluggy Connect:</Text>
          <Text style={[styles.value, { color: data.widgetStatus === 'AVAILABLE' ? '#34D399' : '#F87171' }]}>
            {data.widgetStatus}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Connect Token Solicitado:</Text>
          <Text style={styles.value}>{data.tokenRequested ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Widget Aberto:</Text>
          <Text style={styles.value}>{data.widgetOpened ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Deep Link Recebido:</Text>
          <Text style={styles.value}>{data.deepLinkReceived ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>onSuccess Recebido:</Text>
          <Text style={styles.value}>{data.onSuccessReceived ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Item ID Recebido:</Text>
          <Text style={styles.value}>{data.itemIdReceived ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Item Validado (Backend):</Text>
          <Text style={styles.value}>{data.itemValidated ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Webhook Recebido:</Text>
          <Text style={styles.value}>{data.webhookReceived ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Sincronização Iniciada:</Text>
          <Text style={styles.value}>{data.syncInitiated ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Sincronização Concluída:</Text>
          <Text style={styles.value}>{data.syncCompleted ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Dados Persistidos:</Text>
          <Text style={styles.value}>{data.dataPersisted ? 'Sim' : 'Não'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Request ID:</Text>
          <Text style={styles.codeText}>{data.requestId || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Attempt ID:</Text>
          <Text style={styles.codeText}>{data.connectionAttemptId || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Última Tentativa:</Text>
          <Text style={styles.value}>
            {data.lastAttemptTimestamp ? new Date(data.lastAttemptTimestamp).toLocaleTimeString() : 'Nenhuma'}
          </Text>
        </View>

        {data.lastErrorCode && (
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>Último Código de Erro: {data.lastErrorCode}</Text>
            {data.lastError && <Text style={styles.errorContent}>{data.lastError}</Text>}
          </View>
        )}
      </View>

      {/* Diretiva de Segurança Zero-Trust */}
      <View style={styles.securityBox}>
        <Text style={styles.securityTitle}>🔒 Diretiva de Segurança Regulatória</Text>
        <Text style={styles.securityText}>
          Credenciais privadas e chaves de API residem estritamente no backend e nunca trafegam para a aplicação móvel nem são expostas em relatórios.
        </Text>
      </View>

      {/* Ações */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={runHealthCheck}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0A0F1D" />
          ) : (
            <Text style={styles.refreshButtonText}>Atualizar Diagnóstico</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareDiagnostics}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>Exportar Relatório</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A14',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#38BDF8',
    backgroundColor: '#131D33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOk: {
    backgroundColor: '#065F4640',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  badgeWarn: {
    backgroundColor: '#78350F40',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  errorBox: {
    backgroundColor: '#7F1D1D20',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF444440',
    marginTop: 6,
    gap: 4,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
  errorContent: {
    fontSize: 12,
    color: '#FCA5A5',
    fontFamily: 'monospace',
  },
  securityBox: {
    backgroundColor: '#0A1224',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    marginBottom: 20,
    gap: 6,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#60A5FA',
  },
  securityText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  actions: {
    gap: 10,
  },
  refreshButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  shareButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
