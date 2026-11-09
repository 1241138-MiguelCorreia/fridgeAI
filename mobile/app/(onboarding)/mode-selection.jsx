import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import { Colors } from '../../constants/colors';

const MODES = [
  {
    id: 'normal',
    title: 'Modo Normal',
    description: 'Gestão de refeições, compras e inventário para o dia a dia',
    icon: '🥗',
    badge: 'Recomendado',
    badgeColor: Colors.primary,
    enabled: true,
  },
  {
    id: 'fitness',
    title: 'Modo Fitness',
    description: 'Controlo de calorias, macros, refeições e snacks com base nos teus objetivos',
    icon: '💪',
    badge: 'Fitness',
    badgeColor: Colors.stockBlue,
    enabled: true,
  },
];

export default function ModeSelectionScreen() {
  const router = useRouter();
  const { setMode, user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = (mode) => {
    setSelected(mode.id);
  };

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await setMode(selected);
      if (selected === 'fitness') {
        router.push('/(onboarding)/fitness-setup');
      } else {
        router.push('/(onboarding)/restrictions');
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível guardar o modo. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.emoji}>✨</Text>
        <Text style={styles.title}>Como queres usar a app?</Text>
        <Text style={styles.subtitle}>Podes alterar isto mais tarde nas definições.</Text>

        <View style={styles.cards}>
          {MODES.map((mode) => {
            const isSelected = selected === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.card,
                  isSelected && styles.cardSelected,
                  !mode.enabled && styles.cardDisabled,
                ]}
                onPress={() => handleSelect(mode)}
                activeOpacity={mode.enabled ? 0.8 : 1}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>{mode.icon}</Text>
                  <View style={[styles.badge, { backgroundColor: mode.id === 'fitness' ? Colors.stockBlueLight : Colors.primaryLight }]}>
                    <Text style={[styles.badgeText, { color: mode.badgeColor }]}>{mode.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.cardTitle, !mode.enabled && styles.textMuted]}>{mode.title}</Text>
                <Text style={[styles.cardDesc, !mode.enabled && styles.textMuted]}>{mode.description}</Text>
                {isSelected && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title="Continuar"
          onPress={handleContinue}
          disabled={!selected}
          loading={loading}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24, paddingTop: 48 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 36 },
  cards: { gap: 16, marginBottom: 32 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardIcon: { fontSize: 32 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  textMuted: { color: Colors.textMuted },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  button: { marginTop: 'auto' },
});
