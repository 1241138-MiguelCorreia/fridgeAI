import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { Colors } from '../../constants/colors';
import Button from '../ui/Button';

const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 'Outro'];

export default function ServingsSetup({ onConfirm, onAddRecipe, initialServings = null }) {
  const getInitialSelected = () => {
    if (!initialServings) return null;
    if (initialServings > 5) return 'Outro';
    return initialServings;
  };

  const [selected, setSelected] = useState(getInitialSelected());
  const [customValue, setCustomValue] = useState(initialServings > 5 ? String(initialServings) : '');
  const [step, setStep] = useState('servings'); // 'servings' | 'recipes'

  const getServingsValue = () =>
    selected === 'Outro' ? parseInt(customValue) : selected;

  const isServingsValid =
    selected !== null &&
    (selected !== 'Outro' || (
      customValue !== '' &&
      !isNaN(parseInt(customValue)) &&
      parseInt(customValue) >= 1 &&
      parseInt(customValue) <= 20
    ));

  const handleServingsNext = () => {
    if (!isServingsValid) return;
    setStep('recipes');
  };

  const handleConfirm = () => {
    onConfirm(getServingsValue());
  };

  // ── Step: adicionar receitas ──────────────────────────────────────────────
  if (step === 'recipes') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.emoji}>📖</Text>
        <Text style={styles.title}>Tens receitas que costumas fazer?</Text>
        <Text style={styles.subtitle}>
          Adiciona as tuas receitas para as receberes como sugestão com base no teu inventário.
        </Text>
        <Button title="Adicionar receitas" onPress={onAddRecipe} style={styles.btn} />
        <Button title="Começar a explorar" variant="ghost" onPress={handleConfirm} style={styles.btn} />
      </ScrollView>
    );
  }

  // ── Step: número de pessoas ───────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.emoji}>🍽️</Text>
      <Text style={styles.title}>Para quantas pessoas vais cozinhar?</Text>
      <Text style={styles.subtitle}>
        As quantidades das receitas adaptam-se ao número escolhido.
      </Text>

      <View style={styles.optionsGrid}>
        {SERVINGS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={String(opt)}
            style={[styles.optionTile, selected === opt && styles.optionTileSelected]}
            onPress={() => { setSelected(opt); if (opt !== 'Outro') setCustomValue(''); }}
          >
            <Text style={[styles.optionTileText, selected === opt && styles.optionTileTextSelected]}>
              {opt === 'Outro' ? 'Outro' : String(opt)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected === 'Outro' && (
        <View style={styles.customWrap}>
          <Text style={styles.customLabel}>Quantas pessoas? (1–20)</Text>
          <TextInput
            style={styles.customInput}
            keyboardType="number-pad"
            value={customValue}
            onChangeText={(v) => {
              const clean = v.replace(/[^0-9]/g, '');
              setCustomValue(clean);
            }}
            placeholder="Ex: 8"
            maxLength={2}
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          {customValue !== '' && (parseInt(customValue) < 1 || parseInt(customValue) > 20) && (
            <Text style={styles.customError}>Introduz um número entre 1 e 20.</Text>
          )}
        </View>
      )}

      <Button title="Continuar" onPress={handleServingsNext} disabled={!isServingsValid} style={styles.btn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 40, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  optionsGrid: {
    width: '100%', flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 24, justifyContent: 'center',
  },
  optionTile: {
    width: '30%', paddingVertical: 20, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center',
  },
  optionTileSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optionTileText: { fontSize: 22, fontWeight: '600', color: Colors.textSecondary },
  optionTileTextSelected: { color: Colors.primaryDark, fontWeight: '700' },
  customWrap: { width: '100%', marginBottom: 20 },
  customLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  customInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  customError: { fontSize: 13, color: Colors.urgentRed, marginTop: 6 },
  btn: { width: '100%', marginBottom: 10 },
});
