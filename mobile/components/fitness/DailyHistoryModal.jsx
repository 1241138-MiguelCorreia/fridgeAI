import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { fitnessAPI } from '../../services/api';
import { Colors } from '../../constants/colors';

const TYPE_LABEL = { meal: 'Refeição', snack: 'Snack', premade: 'Pré-feita' };
const TYPE_EMOJI = { meal: '🍽️', snack: '🍌', premade: '📦' };

export default function DailyHistoryModal({ visible, onClose, onChanged }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fitnessAPI.getDailyLog()
        .then((r) => setLog(r.data.log))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleDelete = (entryId) => {
    Alert.alert(
      'Remover entrada',
      'As calorias desta refeição/snack serão removidas do teu total de hoje.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fitnessAPI.deleteEntry(entryId);
              setLog(res.data.log);
              onChanged?.();
            } catch (_) {}
          },
        },
      ]
    );
  };

  const fTime = (d) => new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  const entries = log?.entries || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <SafeAreaView style={st.sheet}>
          <View style={st.header}>
            <Text style={st.title}>Histórico de hoje</Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.stockBlue} style={{ margin: 32 }} />
          ) : entries.length === 0 ? (
            <Text style={st.empty}>Ainda não registaste nenhuma refeição hoje.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Totais */}
              <View style={st.totalsRow}>
                <View style={st.totalItem}>
                  <Text style={st.totalValue}>{log?.caloriesConsumed || 0}</Text>
                  <Text style={st.totalLabel}>kcal</Text>
                </View>
                <View style={st.totalItem}>
                  <Text style={st.totalValue}>{log?.macrosConsumed?.protein || 0}g</Text>
                  <Text style={st.totalLabel}>proteína</Text>
                </View>
                <View style={st.totalItem}>
                  <Text style={st.totalValue}>{log?.macrosConsumed?.carbs || 0}g</Text>
                  <Text style={st.totalLabel}>hidratos</Text>
                </View>
                <View style={st.totalItem}>
                  <Text style={st.totalValue}>{log?.macrosConsumed?.fat || 0}g</Text>
                  <Text style={st.totalLabel}>gordura</Text>
                </View>
              </View>

              {entries.map((entry) => (
                <View key={entry._id} style={st.entryRow}>
                  <Text style={st.entryEmoji}>{TYPE_EMOJI[entry.type] || '🍽️'}</Text>
                  <View style={st.entryInfo}>
                    <Text style={st.entryName}>{entry.name}</Text>
                    <Text style={st.entryMeta}>
                      {fTime(entry.loggedAt)} · {entry.calories} kcal
                      {entry.macros?.protein ? ` · P ${entry.macros.protein}g` : ''}
                    </Text>
                    <View style={st.typeBadge}>
                      <Text style={st.typeBadgeText}>{TYPE_LABEL[entry.type] || entry.type}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={st.deleteBtn} onPress={() => handleDelete(entry._id)}>
                    <Text style={st.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: Colors.textMuted },
  empty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 40, paddingHorizontal: 24 },

  totalsRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 4,
  },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 18, fontWeight: '700', color: Colors.stockBlue },
  totalLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  entryEmoji: { fontSize: 24, marginRight: 12 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  entryMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.stockBlueLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  typeBadgeText: { fontSize: 10, color: Colors.stockBlue, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 16, color: Colors.textMuted },
});
