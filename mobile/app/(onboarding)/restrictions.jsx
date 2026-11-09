import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors } from '../../constants/colors';

const OPTIONS = [
  { id: 'vegetariano', label: 'Vegetariano', icon: '🥦' },
  { id: 'vegano', label: 'Vegano', icon: '🌱' },
  { id: 'sem_lactose', label: 'Sem lactose', icon: '🥛' },
  { id: 'sem_gluten', label: 'Sem glúten', icon: '🌾' },
  { id: 'alergias', label: 'Alergias', icon: '⚠️' },
  { id: 'nenhuma', label: 'Nenhuma', icon: '✅' },
];

export default function RestrictionsScreen() {
  const router = useRouter();
  const { setRestrictions } = useAuth();

  const [selected, setSelected] = useState([]);
  const [allergiesText, setAllergiesText] = useState('');
  const [allergiesError, setAllergiesError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggle = (id) => {
    setSelected((prev) => {
      if (id === 'nenhuma') return prev.includes('nenhuma') ? [] : ['nenhuma'];
      // Se selecionar vegano, também selecionar vegetariano
      let next = prev.filter((r) => r !== 'nenhuma');
      if (next.includes(id)) {
        next = next.filter((r) => r !== id);
        if (id === 'vegano') next = next.filter((r) => r !== 'vegetariano');
      } else {
        next = [...next, id];
        if (id === 'vegano' && !next.includes('vegetariano')) next = [...next, 'vegetariano'];
      }
      return next;
    });
    setAllergiesError('');
  };

  const handleContinue = async () => {
    if (selected.includes('alergias') && !allergiesText.trim()) {
      setAllergiesError('Descreve a(s) tua(s) alergia(s).');
      return;
    }
    setLoading(true);
    try {
      await setRestrictions(selected, allergiesText.trim());
      router.push('/(onboarding)/describe-inventory');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível guardar. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await setRestrictions([], '');
      router.push('/(onboarding)/describe-inventory');
    } catch (_) {
      router.push('/(onboarding)/describe-inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🍽️</Text>
        <Text style={styles.title}>Tens alguma restrição alimentar?</Text>
        <Text style={styles.subtitle}>Seleciona todas as que se aplicam.</Text>

        <View style={styles.grid}>
          {OPTIONS.map((option) => {
            const isSelected = selected.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggle(option.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {isSelected && <Text style={styles.optionCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {selected.includes('alergias') && (
          <Input
            label="Quais as tuas alergias?"
            placeholder="Ex: amendoins, marisco, frutos secos…"
            value={allergiesText}
            onChangeText={(t) => { setAllergiesText(t); setAllergiesError(''); }}
            multiline
            maxLength={200}
            showCharCount
            error={allergiesError}
            style={styles.allergiesInput}
          />
        )}

        <Button title="Continuar" onPress={handleContinue} loading={loading} style={styles.button} />
        <Button title="Saltar este passo" variant="ghost" onPress={handleSkip} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 48 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 8,
    minWidth: '45%',
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionIcon: { fontSize: 18 },
  optionLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, flex: 1 },
  optionLabelSelected: { color: Colors.primaryDark },
  optionCheck: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  allergiesInput: { marginBottom: 8 },
  button: { marginBottom: 12 },
});
