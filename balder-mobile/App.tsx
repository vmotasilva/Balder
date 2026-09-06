import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // 1. Tela de Splash / Carregamento durante verificação da sessão
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <Text style={styles.loadingTitle}>BALDER</Text>
        <Text style={styles.loadingSubtitle}>Verificando sessão segura...</Text>
        <ActivityIndicator size="large" color="#38BDF8" style={styles.spinner} />
      </View>
    );
  }

  // 2. Se não houver usuário autenticado, renderiza a tela de login
  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }

  // 3. Se autenticado, renderiza o fluxo principal com o TabNavigator
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: '#0A0F1D',
          card: '#0F172A',
          text: '#F8FAFC',
          border: '#1E293B',
          primary: '#38BDF8',
        },
      }}
    >
      <StatusBar style="light" />
      <TabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#131D33',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 30,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
  },
  spinner: {
    marginTop: 24,
  },
});
