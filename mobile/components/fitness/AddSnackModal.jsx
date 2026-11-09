import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { fitnessAPI } from '../../services/api';
import { Colors } from '../../constants/colors';

const QUICK_SNACKS = [
  { name: 'Banana',               calories: 89,  protein: 1,  carbs: 23, fat: 0  },
  { name: 'Iogurte grego',        calories: 100, protein: 10, carbs: 6,  fat: 4  },
  { name: 'Barra proteica',       calories: 210, protein: 20, carbs: 18, fat: 7  },
  { name: 'Frutos secos (30g)',   calories: 180, protein: 5,  carbs: 6,  fat: 16 },
  { name: 'Aveia com leite',      calories: 300, protein: 12, carbs: 48, fat: 6  },
  { name: 'Pão c/ manteiga amendoim', calories: 250, protein: 8, carbs: 28, fat: 12 },
  { name: 'Maçã',                 calories: 72,  protein: 0,  carbs: 19, fat: 0  },
  { name: 'Ovo cozido',           calories: 78,  protein: 6,  carbs: 1,  fat: 5  },
];

export default function AddSnackModal({ visible, onClose, onSaved }) {
  const [mode, setMode] = useState('quick'); // 'quick' | 'manual'
  const [loading, setLoading] = useState(false);

  // Campos manuais
  const [name, setName]       = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs]     = useState('');
  const [fat, setFat]         = useState('');

  const reset = () => {
    setMode('quick');
    setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
  };

  const handleClose = () => { reset(); onClose(); };

  const logQuickSnack = async (snack) => {
    setLoading(true);
    try {
      await fitnessAPI.logSnack({
        name: snack.name, calories: snack.calories,
        macros: { protein: snack.protein, carbs: snack.carbs, fat: snack.fat },
      });
      reset(); onSaved();
    } catch (_) {}
    finally { setLoading(false); }
  };

  const logManualSnack = async () => {
    if (!name.trim() || !calories) return;
    setLoading(true);
    try {
      await fitnessAPI.logSnack({
        name: name.trim(),
        calories: parseInt(calories) || 0,
        macros: {
          protein: parseInt(protein) || 0,
          carbs:   parseInt(carbs)   || 0,
          fat:     parseInt(fat)     || 0,
        },
      });
      reset(); onSaved();
    } catch (_) {}
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={st.overlay}>
        <SafeAreaView style={st.sheet}>
          <View style={st.header}>
            <Text style={st.title}>Registar snack</Text>
            <TouchableOpacity onPress={handleClose} style={st.closeBtn}>
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Toggle quick / manual */}
          <View style={st.toggleRow}>
            <TouchableOpacity style={[st.toggle, mode === 'quick' && st.toggleActive]} onPress={() => setMode('quick')}>
              <Text style={[st.toggleText, mode === 'quick' && st.toggleTextActive]}>Rápido</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.toggle, mode === 'manual' && st.toggleActive]} onPress={() => setMode('manual')}>
              <Text style={[st.toggleText, mode === 'manual' && st.toggleTextActive]}>Manual</Text>
            </TouchableOpacity>
          </View>

          {mode === 'quick' ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {QUICK_SNACKS.map((s) => (
                <TouchableOpacity key={s.name} style={st.quickRow} onPress={() => logQuickSnack(s)} activeOpacity={0.8} disabled={loading}>
                  <View style={st.quickInfo}>
                    <Text style={st.quickName}>{s.name}</Text>
                    <Text style={st.quickMacros}>{s.calories} kcal · P {s.protein}g · C {s.carbs}g · G {s.fat}g</Text>
                  </View>
                  {loading ? <ActivityIndicator size="small" color={Colors.stockBlue} /> : <Text style={st.quickAdd}>+</Text>}
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={st.fieldLabel}>Nome *</Text>
              <TextInput style={st.input} value={name} onChangeText={setName} placeholder="Ex: Barra proteica" placeholderTextColor={Colors.textMuted} />
              <Text style={st.fieldLabel}>Calorias *</Text>
              <TextInput style={st.input} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="Ex: 210" placeholderTextColor={Colors.textMuted} />
              <Text style={st.fieldLabel}>Proteína (g)</Text>
              <TextInput style={st.input} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="Ex: 20" placeholderTextColor={Colors.textMuted} />
              <Text style={st.fieldLabel}>Hidratos (g)</Text>
              <TextInput style={st.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="Ex: 18" placeholderTextColor={Colors.textMuted} />
              <Text style={st.fieldLabel}>Gordura (g)</Text>
              <TextInput style={st.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="Ex: 7" placeholderTextColor={Colors.textMuted} />

              <TouchableOpacity
                style={[st.saveBtn, (!name.trim() || !calories) && st.saveBtnDisabled]}
                onPress={logManualSnack}
                disabled={!name.trim() || !calories || loading}
              >
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={st.saveBtnText}>Registar</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: Colors.textMuted },

  toggleRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.background, borderRadius: 10, padding: 4 },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  toggleTextActive: { color: Colors.stockBlue, fontWeight: '700' },

  quickRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  quickInfo: { flex: 1 },
  quickName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  quickMacros: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  quickAdd: { fontSize: 24, color: Colors.stockBlue, fontWeight: '400', width: 32, textAlign: 'center' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  input: {
    marginHorizontal: 20, backgroundColor: Colors.background, borderRadius: 10, padding: 12,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
  },
  saveBtn: { marginHorizontal: 20, marginTop: 20, backgroundColor: Colors.stockBlue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
