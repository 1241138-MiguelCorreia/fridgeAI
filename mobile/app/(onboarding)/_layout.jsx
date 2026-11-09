import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="mode-selection" />
      <Stack.Screen name="restrictions" />
      <Stack.Screen name="describe-inventory" />
    </Stack>
  );
}
