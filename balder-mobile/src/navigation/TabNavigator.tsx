import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';

// Tab Navigator Type Definitions
export type RootTabParamList = {
  Dashboard: undefined;
  Transações: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// -----------------------------------------------------------------------------
// Bottom Tab Navigator Component
// -----------------------------------------------------------------------------
export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Transações"
        component={TransactionsScreen}
        options={{
          tabBarLabel: 'Transações',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💳</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
