import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
  Platform,
  Text,
  TouchableOpacity,
  Linking,
  Image,
  AppState,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const APP_URL = 'https://balder-one.vercel.app';

// Custom User Agent avoiding '; wv)' to enable Google OAuth sign-in seamlessly
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Hardware Back Button handling on Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const { url } = request;

    // Allow internal app domain and authentication providers
    if (
      url.startsWith('https://balder-one.vercel.app') ||
      url.includes('supabase.co') ||
      url.includes('accounts.google.com') ||
      url.includes('appleid.apple.com') ||
      url.includes('login.microsoftonline.com') ||
      url.startsWith('about:blank') ||
      url.startsWith('blob:')
    ) {
      return true;
    }

    // Handle deep links or external protocols
    if (
      url.startsWith('whatsapp:') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('intent:')
    ) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    return true;
  };

  const reloadApp = () => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" backgroundColor="#070B16" />

        {hasError ? (
          <View style={styles.errorContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require('./assets/icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.errorTitle}>Balder Financeiro</Text>
            <Text style={styles.errorSubtitle}>
              Não foi possível carregar a conexão no momento. Verifique sua internet.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={reloadApp} activeOpacity={0.8}>
              <Text style={styles.retryText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webViewWrapper}>
            <WebView
              ref={webViewRef}
              source={{ uri: APP_URL }}
              style={styles.webView}
              userAgent={CHROME_USER_AGENT}
              onNavigationStateChange={handleNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onLoadStart={() => setHasError(false)}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              databaseEnabled={true}
              allowFileAccess={true}
              allowFileAccessFromFileURLs={true}
              allowUniversalAccessFromFileURLs={true}
              mixedContentMode="always"
              originWhitelist={['*']}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              scalesPageToFit={true}
              cacheEnabled={true}
              cacheMode="LOAD_DEFAULT"
              pullToRefreshEnabled={true}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              applicationNameForUserAgent="BalderApp/1.0"
            />

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <Image
                  source={require('./assets/icon.png')}
                  style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 8 }}
                  resizeMode="cover"
                />
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={styles.loadingText}>Carregando Balder...</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B16',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: '#070B16',
  },
  webView: {
    flex: 1,
    backgroundColor: '#070B16',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070B16',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 99,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
  },
  retryText: {
    color: '#070B16',
    fontSize: 14,
    fontWeight: '700',
  },
});
