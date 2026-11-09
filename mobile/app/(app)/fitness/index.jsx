import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fitnessAPI } from '../../../services/api';
import { Colors } from '../../../constants/colors';
import AddSnackModal from '../../../components/fitness/AddSnackModal';
import DailyHistoryModal from '../../../components/fitness/DailyHistoryModal';

// ── Barra de progresso ────────────────────────────────────────────────────────
function MacroBar({ label, consumed, target, color }) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const over = consumed > target;
  return (
    <View style={barSt.wrap}>
      <View style={barSt.labelRow}>
        <Text style={barSt.label}>{label}</Text>
        <Text style={[barSt.value, over && { color: Colors.urgentRed }]}>
          {consumed}g <Text style={barSt.target}>/ {target}g</Text>
        </Text>
      </View>
      <View style={barSt.track}>
        <View style={[barSt.fill, { width: `${pct * 100}%`, backgroundColor: over ? Colors.urgentRed : color }]} />
      </View>
    </View>
  );
}
const barSt = StyleSheet.create({
  wrap: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  value: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  target: { fontWeight: '400', color: Colors.textMuted },
  track: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});

// ── Helper: mensagem de estado ────────────────────────────────────────────────
function statusMessage(consumed, target, proteinConsumed, proteinTarget) {
  if (consumed === 0) return { msg: 'Ainda não registaste refeições hoje.', color: Colors.textMuted };
  const ratio = consumed / target;
  if (ratio >= 1.05) return { msg: 'Passaste a meta estimada de hoje.', color: Colors.urgentRed };
  if (ratio >= 0.9)  return { msg: 'Estás perto do teu objetivo diário!', color: Colors.warnYellow };
  if (proteinConsumed < proteinTarget * 0.5) return { msg: 'Ainda falta proteína para o teu objetivo.', color: Colors.stockBlue };
  return { msg: 'Ainda tens calorias disponíveis hoje.', color: Colors.okGreen };
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FitnessScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [log, setLog] = useState(null);
  const [targets, setTargets] = useState(null);
  const [streak, setStreak] = useState(null);
  const [showAddSnack, setShowAddSnack] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fitnessAPI.getDailyLog();
      setLog(res.data.log);
      setTargets(res.data.targets);
      setStreak(res.data.streak);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };

  const calories    = log?.caloriesConsumed || 0;
  const calTarget   = targets?.calories || 2000;
  const protein     = log?.macrosConsumed?.protein || 0;
  const carbs       = log?.macrosConsumed?.carbs   || 0;
  const fat         = log?.macrosConsumed?.fat     || 0;
  const proTarget   = targets?.macros?.protein || 150;
  const carbsTarget = targets?.macros?.carbs   || 250;
  const fatTarget   = targets?.macros?.fat     || 70;

  const calPct = calTarget > 0 ? Math.min(1, calories / calTarget) : 0;
  const calOver = calories > calTarget;
  const status = statusMessage(calories, calTarget, protein, proTarget);

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.center}><ActivityIndicator size="large" color={Colors.stockBlue} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.title}>Fitness</Text>
        <TouchableOpacity style={st.historyBtn} onPress={() => setShowHistory(true)}>
          <Text style={st.historyBtnText}>📋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.stockBlue} />}
      >
        {/* Calorias principais */}
        <View style={st.caloriesCard}>
          <Text style={st.caloriesLabel}>Hoje</Text>
          <View style={st.caloriesRow}>
            <Text style={[st.caloriesConsumed, calOver && { color: Colors.urgentRed }]}>{calories}</Text>
            <Text style={st.caloriesSlash}> / </Text>
            <Text style={st.caloriesTarget}>{calTarget} kcal</Text>
          </View>
          {/* Barra de calorias */}
          <View style={st.calBar}>
            <View style={[st.calBarFill, { width: `${calPct * 100}%`, backgroundColor: calOver ? Colors.urgentRed : Colors.stockBlue }]} />
          </View>
          <Text style={[st.statusMsg, { color: status.color }]}>{status.msg}</Text>
        </View>

        {/* Macros */}
        <View style={st.macrosCard}>
          <Text style={st.sectionTitle}>Macros</Text>
          <MacroBar label="Proteína" consumed={protein} target={proTarget}   color={Colors.stockBlue} />
          <MacroBar label="Hidratos" consumed={carbs}   target={carbsTarget} color={Colors.warnYellow} />
          <MacroBar label="Gordura"  consumed={fat}      target={fatTarget}   color={Colors.secondary} />
        </View>

        {/* Streak */}
        {streak && (
          <View style={st.streakCard}>
            <Text style={st.streakEmoji}>🔥</Text>
            <View style={st.streakInfo}>
              <Text style={st.streakValue}>{streak.currentStreak} dia{streak.currentStreak !== 1 ? 's' : ''} seguidos</Text>
              <Text style={st.streakBest}>Melhor: {streak.bestStreak} dias</Text>
            </View>
          </View>
        )}

        {/* Snack rápido */}
        <TouchableOpacity style={st.addSnackBtn} onPress={() => setShowAddSnack(true)} activeOpacity={0.85}>
          <Text style={st.addSnackIcon}>🍌</Text>
          <Text style={st.addSnackText}>Registar snack</Text>
          <Text style={st.addSnackArrow}>→</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      <AddSnackModal
        visible={showAddSnack}
        onClose={() => setShowAddSnack(false)}
        onSaved={() => { setShowAddSnack(false); load(true); }}
      />
      <DailyHistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onChanged={() => load(true)}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  historyBtn: { padding: 4 },
  historyBtnText: { fontSize: 22 },

  // Calorias
  caloriesCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  caloriesLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  caloriesRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  caloriesConsumed: { fontSize: 42, fontWeight: '800', color: Colors.stockBlue },
  caloriesSlash: { fontSize: 24, color: Colors.textMuted },
  caloriesTarget: { fontSize: 18, color: Colors.textSecondary, fontWeight: '500' },
  calBar: { height: 10, backgroundColor: Colors.borderLight, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  calBarFill: { height: 10, borderRadius: 5 },
  statusMsg: { fontSize: 13, fontWeight: '500' },

  // Macros
  macrosCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },

  // Streak
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  streakEmoji: { fontSize: 32 },
  streakInfo: { flex: 1 },
  streakValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  streakBest: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Add snack
  addSnackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.stockBlueLight, borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: Colors.stockBlue + '44',
  },
  addSnackIcon: { fontSize: 24 },
  addSnackText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.stockBlue },
  addSnackArrow: { fontSize: 18, color: Colors.stockBlue },
});
