import { Redirect } from 'expo-router';

// Ponto de entrada — o _layout.jsx trata do redirecionamento
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
