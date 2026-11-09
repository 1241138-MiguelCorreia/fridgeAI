import { Tabs } from 'expo-router';
import { Image, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { scheduleDailyReminder } from '../../services/notifications';

// Definir sources fora do componente para Metro bundlar corretamente
const IMG_MEALS    = require('../../assets/refeicao.png');
const IMG_FITNESS  = require('../../assets/fitness.png');
const IMG_LIST     = require('../../assets/lista.png');
const IMG_INVENTORY = require('../../assets/inventorio.png');

export default function AppLayout() {
  const { user } = useAuth();
  const isFitness = user?.mode === 'fitness';

  useEffect(() => {
    if (!user) return;
    scheduleDailyReminder(isFitness);
  }, [user?._id, isFitness]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* O nome tem de corresponder ao caminho real: pasta/index */}
      <Tabs.Screen
        name="meals/index"
        options={{
          tabBarLabel: 'Refeições',
          tabBarIcon: ({ focused }) => (
            <Image
              source={IMG_MEALS}
              style={[styles.icon, { opacity: focused ? 1 : 0.4 }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="fitness/index"
        options={{
          tabBarLabel: 'Fitness',
          href: isFitness ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <Image
              source={IMG_FITNESS}
              style={[styles.icon, { opacity: focused ? 1 : 0.4 }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          tabBarLabel: 'Inventário',
          tabBarIcon: ({ focused }) => (
            <Image
              source={IMG_INVENTORY}
              style={[styles.icon, { opacity: focused ? 1 : 0.4 }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping/index"
        options={{
          tabBarLabel: 'Compras',
          tabBarIcon: ({ focused }) => (
            <Image
              source={IMG_LIST}
              style={[styles.icon, { opacity: focused ? 1 : 0.4 }]}
              resizeMode="contain"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 6,
  },
  icon: {
    width: 26,
    height: 26,
  },
  tabLabel: {
    fontSize: 11,
  },
});
