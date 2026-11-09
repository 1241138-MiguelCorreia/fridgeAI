import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { mealsAPI } from '../../services/api';
import { Colors } from '../../constants/colors';

const MEAL_TYPE_LABELS = {
  'pequeno-almoco': '🌅 Pequeno-almoço',
  'almoco':         '☀️ Almoço',
  'jantar':         '🌙 Jantar',
  'snack':          '🍎 Snack',
  'rapida':         '⚡ Rápida',
  'breakfast':      '🌅 Pequeno-almoço',
  'lunch_dinner':   '🍽 Almoço/Jantar',
};

const SOURCE_LABELS = {
  user:      '👤 Tua receita',
  suggested: '✨ Sugerida',
  web:       '🌐 Web',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return `${date} às ${time}`;
}

function HistoryCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={2}>{item.mealName}</Text>
        {item.usedUrgentItems && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>⚠️ Urgente</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        {item.mealType && MEAL_TYPE_LABELS[item.mealType] ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{MEAL_TYPE_LABELS[item.mealType]}</Text>
          </View>
        ) : null}
        {item.source && SOURCE_LABELS[item.source] ? (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{SOURCE_LABELS[item.source]}</Text>
          </View>
        ) : null}
        {item.servings ? (
          <Text style={styles.metaText}>👥 {item.servings} p.</Text>
        ) : null}
      </View>

      <Text style={styles.dateText}>{formatDate(item.completedAt)}</Text>

      {item.ingredientsUsed && item.ingredientsUsed.length > 0 && (
        <View style={styles.ingRow}>
          {item.ingredientsUsed.slice(0, 5).map((ing, i) => (
            <View
              key={i}
              style={[styles.ingChip, ing.urgent && styles.ingChipUrgent]}
            >
              <Text style={[styles.ingText, ing.urgent && styles.ingTextUrgent]}>
                {ing.name}
              </Text>
            </View>
          ))}
          {item.ingredientsUsed.length > 5 && (
            <Text style={styles.moreText}>+{item.ingredientsUsed.length - 5}</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function MealHistoryModal({ visible, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    mealsAPI.getHistory()
      .then((res) => setHistory(res.data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={{ width: 64 }} />
          <Text style={styles.headerTitle}>Refeições feitas</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>A carregar histórico…</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🍽</Text>
            <Text style={styles.emptyTitle}>Histórico vazio</Text>
            <Text style={styles.emptyText}>
              Ainda não fizeste nenhuma refeição pela app.{'\n'}Marca uma receita como feita para começar o teu historial.
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <HistoryCard item={item} />}
            ListHeaderComponent={
              <Text style={styles.countText}>{history.length} refeição{history.length !== 1 ? 'ões' : ''} registada{history.length !== 1 ? 's' : ''}</Text>
            }
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { width: 64, alignItems: 'flex-end' },
  closeText: { fontSize: 15, color: Colors.textSecondary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textMuted },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  list: { padding: 16 },
  countText: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },

  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  urgentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: Colors.warnYellowLight, flexShrink: 0 },
  urgentText: { fontSize: 11, fontWeight: '600', color: Colors.warnYellow },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: Colors.primaryLight },
  typeText: { fontSize: 11, fontWeight: '600', color: Colors.primaryDark },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: Colors.stockBlueLight },
  sourceText: { fontSize: 11, fontWeight: '600', color: Colors.stockBlue },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  dateText: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },

  ingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  ingChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: Colors.borderLight },
  ingChipUrgent: { backgroundColor: Colors.warnYellowLight },
  ingText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  ingTextUrgent: { color: Colors.warnYellow },
  moreText: { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
});
