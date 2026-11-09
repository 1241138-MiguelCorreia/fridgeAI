import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors } from '../../constants/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = 'Introduz o teu nome.';
    if (!email.trim()) newErrors.email = 'Introduz um email válido.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Introduz um email válido.';
    if (!password) newErrors.password = 'Introduz a tua palavra-passe.';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'As palavras-passe não coincidem.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, confirmPassword);
      // Redirecionamento para mode-selection tratado pelo _layout.jsx
    } catch (err) {
      if (err.code === 'NETWORK_ERROR') {
        setErrors({ general: 'Sem ligação à internet. Tenta novamente.' });
      } else if (err.status === 409) {
        setErrors({ email: 'Este email já está registado.' });
      } else {
        setErrors({ general: err.message || 'Erro ao criar conta. Tenta novamente.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors((e) => ({ ...e, [field]: null, general: null }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo-transparente.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Começa a gerir o teu inventário hoje</Text>

        {errors.general && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        <Input
          label="Nome"
          placeholder="O teu nome"
          value={name}
          onChangeText={(t) => { setName(t); clearError('name'); }}
          autoCapitalize="words"
          autoComplete="name"
          error={errors.name}
        />

        <Input
          label="Email"
          placeholder="o.teu@email.com"
          value={email}
          onChangeText={(t) => { setEmail(t); clearError('email'); }}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />

        <Input
          label="Palavra-passe"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChangeText={(t) => { setPassword(t); clearError('password'); }}
          secureTextEntry
          error={errors.password}
        />

        <Input
          label="Confirmar palavra-passe"
          placeholder="Repete a palavra-passe"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
          secureTextEntry
          error={errors.confirmPassword}
        />

        <Button title="Criar conta" onPress={handleRegister} loading={loading} style={styles.button} />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Já tens conta? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.link}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 56 },
  back: { marginBottom: 16 },
  backText: { color: Colors.primary, fontSize: 16 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 180, height: 64 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28 },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: Colors.error, fontSize: 14, textAlign: 'center' },
  button: { marginTop: 8 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
