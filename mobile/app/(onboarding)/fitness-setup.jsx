import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fitnessAPI, authAPI } from '../../services/api';
import { Colors } from '../../constants/colors';

// ── Opções de seleção ──────────────────────────────────────────────────────────
const SEX_OPTIONS = [
  { id: 'masculino',       label: 'Masculino', icon: '♂️' },
  { id: 'feminino',        label: 'Feminino',  icon: '♀️' },
  { id: 'prefiro_nao_dizer', label: 'Prefiro não dizer', icon: '○' },
];

const ACTIVITY_OPTIONS = [
  { id: 'sedentario',           label: 'Sedentário',            desc: 'Pouco ou nenhum exercício' },
  { id: 'pouco_ativo',          label: 'Pouco ativo',           desc: 'Exercício leve 1–3 dias/semana' },
  { id: 'moderadamente_ativo',  label: 'Moderadamente ativo',   desc: 'Exercício moderado 3–5 dias/semana' },
  { id: 'muito_ativo',          label: 'Muito ativo',           desc: 'Exercício intenso 6–7 dias/semana' },
  { id: 'atleta',               label: 'Atleta / Treino intenso', desc: 'Treino muito intenso ou trabalho físico' },
];

const GOAL_OPTIONS = [
  { id: 'perder_peso',             label: 'Perder peso',              icon: '📉' },
  { id: 'manter_peso',             label: 'Manter peso',              icon: '⚖️' },
  { id: 'ganhar_massa_muscular',   label: 'Ganhar massa muscular',    icon: '💪' },
  { id: 'mais_proteina',           label: 'Comer mais proteína',      icon: '🥩' },
  { id: 'melhorar_habitos',        label: 'Melhorar hábitos',         icon: '🥗' },
];

// ── Componente de opção pill ──────────────────────────────────────────────────
function OptionPill({ item, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[st.pill, selected && st.pillSelected]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.8}
    >
      {item.icon && <Text style={st.pillIcon}>{item.icon}</Text>}
      <View style={st.pillTextWrap}>
        <Text style={[st.pillLabel, selected && st.pillLabelSelected]}>{item.label}</Text>
        {item.desc && <Text style={st.pillDesc}>{item.desc}</Text>}
      </View>
      {selected && <Text style={st.pillCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

// ── Ecrã principal ────────────────────────────────────────────────────────────
const STEPS = ['dados', 'atividade', 'objetivo', 'resultado'];

export default function FitnessSetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // índice do STEPS
  const [loading, setLoading] = useState(false);

  // Dados do perfil
  const [age, setAge] = useState('');
  const [sex, setSex] = useState(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState(null);
  const [goal, setGoal] = useState(null);

  // Resultado calculado
  const [targets, setTargets] = useState(null);

  const canContinue = () => {
    if (step === 0) return age && sex && height && weight;
    if (step === 1) return !!activity;
    if (step === 2) return !!goal;
    return true;
  };

  const handleNext = async () => {
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    // step === 2 → submeter
    setLoading(true);
    try {
      const res = await fitnessAPI.createProfile({
        age: parseInt(age),
        sex,
        heightCm: parseInt(height),
        currentWeightKg: parseFloat(weight),
        activityLevel: activity,
        goal,
      });
      setTargets(res.data.targets);
      setStep(3);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível guardar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    router.replace('/(onboarding)/restrictions');
  };

  const GOAL_LABEL = {
    perder_peso: 'Perder peso',
    manter_peso: 'Manter peso',
    ganhar_massa_muscular: 'Ganhar massa muscular',
    mais_proteina: 'Comer mais proteína',
    melhorar_habitos: 'Melhorar hábitos',
  };

  return (
    <SafeAreaView style={st.safe}>
      {/* Progress bar */}
      <View style={st.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[st.progressDot, i <= step && st.progressDotActive]} />
        ))}
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Step 0: Dados físicos ── */}
        {step === 0 && (
          <View style={st.stepWrap}>
            <Text style={st.emoji}>🏋️</Text>
            <Text style={st.title}>Vamos configurar o teu perfil fitness</Text>
            <Text style={st.subtitle}>Os dados são apenas para estimar as tuas necessidades calóricas.</Text>

            <Text style={st.label}>Idade</Text>
            <TextInput
              style={st.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="Ex: 23"
              placeholderTextColor={Colors.textMuted}
              maxLength={3}
            />

            <Text style={st.label}>Sexo</Text>
            <View style={st.pillGroup}>
              {SEX_OPTIONS.map((o) => (
                <OptionPill key={o.id} item={o} selected={sex === o.id} onPress={setSex} />
              ))}
            </View>

            <Text style={st.label}>Altura (cm)</Text>
            <TextInput
              style={st.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholder="Ex: 178"
              placeholderTextColor={Colors.textMuted}
              maxLength={3}
            />

            <Text style={st.label}>Peso atual (kg)</Text>
            <TextInput
              style={st.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="Ex: 72"
              placeholderTextColor={Colors.textMuted}
              maxLength={5}
            />
          </View>
        )}

        {/* ── Step 1: Nível de atividade ── */}
        {step === 1 && (
          <View style={st.stepWrap}>
            <Text style={st.emoji}>🏃</Text>
            <Text style={st.title}>Qual é o teu nível de atividade?</Text>
            <Text style={st.subtitle}>Inclui exercício físico e atividade no trabalho.</Text>
            {ACTIVITY_OPTIONS.map((o) => (
              <OptionPill key={o.id} item={o} selected={activity === o.id} onPress={setActivity} />
            ))}
          </View>
        )}

        {/* ── Step 2: Objetivo ── */}
        {step === 2 && (
          <View style={st.stepWrap}>
            <Text style={st.emoji}>🎯</Text>
            <Text style={st.title}>Qual é o teu objetivo?</Text>
            <Text style={st.subtitle}>As sugestões serão adaptadas a este objetivo.</Text>
            {GOAL_OPTIONS.map((o) => (
              <OptionPill key={o.id} item={o} selected={goal === o.id} onPress={setGoal} />
            ))}
          </View>
        )}

        {/* ── Step 3: Resultado ── */}
        {step === 3 && targets && (
          <View style={st.stepWrap}>
            <Text style={st.emoji}>✅</Text>
            <Text style={st.title}>A tua meta diária estimada</Text>
            <Text style={st.subtitle}>Objetivo: {GOAL_LABEL[goal] || goal}</Text>

            <View style={st.caloriesCard}>
              <Text style={st.caloriesValue}>{targets.dailyCaloriesTarget}</Text>
              <Text style={st.caloriesUnit}>kcal / dia</Text>
            </View>

            <View style={st.macrosRow}>
              <View style={[st.macroCard, { borderColor: Colors.stockBlue }]}>
                <Text style={[st.macroValue, { color: Colors.stockBlue }]}>{targets.macros.protein}g</Text>
                <Text style={st.macroLabel}>Proteína</Text>
              </View>
              <View style={[st.macroCard, { borderColor: Colors.warnYellow }]}>
                <Text style={[st.macroValue, { color: Colors.warnYellow }]}>{targets.macros.carbs}g</Text>
                <Text style={st.macroLabel}>Hidratos</Text>
              </View>
              <View style={[st.macroCard, { borderColor: Colors.secondary }]}>
                <Text style={[st.macroValue, { color: Colors.secondary }]}>{targets.macros.fat}g</Text>
                <Text style={st.macroLabel}>Gordura</Text>
              </View>
            </View>

            <Text style={st.disclaimer}>
              ⚠️ Estes valores são estimativas e não substituem aconselhamento profissional.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={st.footer}>
        {step > 0 && step < 3 && (
          <TouchableOpacity style={st.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Text style={st.backBtnText}>← Voltar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[st.nextBtn, !canContinue() && st.nextBtnDisabled]}
          onPress={step === 3 ? handleFinish : handleNext}
          disabled={!canContinue() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={st.nextBtnText}>{step === 3 ? 'Continuar' : step === 2 ? 'Calcular metas' : 'Seguinte →'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 4 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.stockBlue },

  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 16 },
  stepWrap: { gap: 4 },

  emoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },

  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 14,
    fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
  },

  pillGroup: { gap: 8, marginBottom: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  pillSelected: { borderColor: Colors.stockBlue, backgroundColor: Colors.stockBlueLight },
  pillIcon: { fontSize: 20 },
  pillTextWrap: { flex: 1 },
  pillLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  pillLabelSelected: { color: Colors.stockBlue },
  pillDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pillCheck: { fontSize: 16, color: Colors.stockBlue, fontWeight: '700' },

  // Resultado
  caloriesCard: {
    backgroundColor: Colors.stockBlue, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  caloriesValue: { fontSize: 52, fontWeight: '800', color: Colors.white },
  caloriesUnit: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  macrosRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  macroCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 2,
  },
  macroValue: { fontSize: 22, fontWeight: '700' },
  macroLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  disclaimer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 8 },

  footer: { flexDirection: 'row', padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  backBtn: { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  backBtnText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  nextBtn: {
    flex: 1, backgroundColor: Colors.stockBlue, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
