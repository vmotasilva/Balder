import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabNavigator } from './MainTabNavigator';
import { NaturezasScreen } from '../screens/NaturezasScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { LoansScreen } from '../screens/LoansScreen';
import { SalaryContractsScreen } from '../screens/SalaryContractsScreen';
import { AccountsScreen } from '../screens/AccountsScreen';
import { CheckpointsScreen } from '../screens/CheckpointsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { CopilotScreen } from '../screens/CopilotScreen';
import { MovementsScreen } from '../screens/MovementsScreen';
import { theme } from '../theme';

export type RootStackParamList = {
  MainTabs: undefined;
  Naturezas: undefined;
  Invoices: undefined;
  Loans: undefined;
  SalaryContracts: undefined;
  Accounts: undefined;
  Checkpoints: undefined;
  Goals: undefined;
  Copilot: undefined;
  Movements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Naturezas" component={NaturezasScreen} />
      <Stack.Screen name="Invoices" component={InvoicesScreen} />
      <Stack.Screen name="Loans" component={LoansScreen} />
      <Stack.Screen name="SalaryContracts" component={SalaryContractsScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Checkpoints" component={CheckpointsScreen} />
      <Stack.Screen name="Goals" component={GoalsScreen} />
      <Stack.Screen name="Copilot" component={CopilotScreen} />
      <Stack.Screen name="Movements" component={MovementsScreen} />
    </Stack.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <ShieldCheck size={36} color={theme.colors.primary} />
        </View>
        <Text style={styles.appName}>BALDER</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
        <Text style={styles.loadingText}>Conectando ao cofre financeiro...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    color: theme.colors.textPrimary,
  },
  spinner: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});
