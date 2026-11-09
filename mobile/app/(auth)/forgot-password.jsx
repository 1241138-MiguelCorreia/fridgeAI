import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors } from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setEmailError('Introduz o teu email.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setEmailError('Introduz um email válido.'); return; }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (_) {
      // Mostrar mensagem genérica mesmo em erro
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recuperar palavra-passe</Text>
        <Text style={styles.subtitle}>Introduz o email da tua conta.</Text>

        {submitted ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✉️</Text>
            <Text style={styles.successTitle}>Email enviado!</Text>
            <Text style={styles.successText}>
              Se este email estiver registado, vais receber instruções para recuperar a palavra-passe.
            </Text>
            <Button title="Voltar ao login" onPress={() => router.replace('/(auth)/login')} style={styles.button} />
          </View>
        ) : (
          <>
            <Input
              label="Email"
              placeholder="o.teu@email.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(''); }}
              keyboardType="email-address"
              autoComplete="email"
              error={emailError}
            />
            <Button title="Enviar instruções" onPress={handleSubmit} loading={loading} style={styles.button} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24, paddingTop: 56 },
  back: { marginBottom: 24 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28 },
  button: { marginTop: 8 },
  successBox: { alignItems: 'center', paddingTop: 32 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  successText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
});
