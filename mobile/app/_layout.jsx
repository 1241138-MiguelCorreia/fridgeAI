import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inAppGroup = segments[0] === '(app)';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Utilizador autenticado — verificar para onde redirecionar
    if (!user?.mode) {
      if (!inOnboardingGroup) router.replace('/(onboarding)/mode-selection');
      return;
    }

    if (!user?.hasInventory) {
      if (!inOnboardingGroup) router.replace('/(onboarding)/describe-inventory');
      return;
    }

    if (inAuthGroup || inOnboardingGroup) {
      router.replace('/(app)/inventory');

    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      // Ionicons usa o nome 'ionicons' (minúsculas) internamente
      ionicons: require('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
    })
      .then(() => setFontsReady(true))
      .catch(() => setFontsReady(true)); // mesmo com erro, renderizar para não bloquear a app
  }, []);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
