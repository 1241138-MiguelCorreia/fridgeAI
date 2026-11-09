import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors } from '../../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Introduz um email válido.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Introduz um email válido.';
    if (!password) newErrors.password = 'Introduz a tua palavra-passe.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // Redirecionamento tratado pelo _layout.jsx
    } catch (err) {
      if (err.code === 'NETWORK_ERROR') {
        setErrors({ general: 'Sem ligação à internet. Tenta novamente.' });
      } else {
        setErrors({ general: 'Email ou palavra-passe incorretos.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo-transparente.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Entrar na tua conta</Text>

        {errors.general && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        <Input
          label="Email"
          placeholder="o.teu@email.com"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: null, general: null })); }}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />

        <Input
          label="Palavra-passe"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: null, general: null })); }}
          secureTextEntry
          error={errors.password}
        />

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
          <Text style={styles.link}>Esqueci-me da palavra-passe</Text>
        </TouchableOpacity>

        <Button title="Entrar" onPress={handleLogin} loading={loading} style={styles.loginButton} />

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Não tens conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.link, styles.linkBold]}>Criar conta</Text>
          </TouchableOpacity>
        </View>

        {/* Google (futuro) */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>
        <Button
          title="Continuar com Google"
          variant="secondary"
          onPress={() => Alert.alert('Em breve', 'Login com Google ainda não está disponível.')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 200,
    height: 80,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginTop: -8,
  },
  link: { color: Colors.primary, fontSize: 14 },
  linkBold: { fontWeight: '700' },
  loginButton: { marginTop: 8 },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: { color: Colors.textSecondary, fontSize: 14 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, color: Colors.textMuted, fontSize: 13 },
});
