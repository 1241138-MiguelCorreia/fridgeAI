import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, PriorityColors } from '../../constants/colors';

const PRIORITY_LABELS = {
  usar_hoje: 'Usar hoje',
  usar_breve: 'Usar breve',
  pode_esperar: 'Pode esperar',
  stock: 'Stock',
};

const STATE_LABELS = {
  aberto: 'Aberto',
  fechado: 'Fechado',
  fresco: 'Fresco',
  congelado: 'Congelado',
  parcialmente_usado: 'Parcial',
};


function formatExpiry(item) {
  const days = item.estimatedExpiryDays;
  if (!days) return '—';
  if (days <= 0) return 'Expirado';
  if (days === 1) return 'Expira amanhã';
  if (days <= 7) return `Expira em ${days} dias`;
  if (days <= 30) return `${days} dias`;
  return 'Longa duração';
}

export default function ProductCard({ item, onPress, onSwipeDelete }) {
  const priorityColor = PriorityColors[item.priority] || PriorityColors.pode_esperar;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.8}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor.dot }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor.bg }]}>
            <Text style={[styles.priorityText, { color: priorityColor.text }]}>
              {PRIORITY_LABELS[item.priority]}
            </Text>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{STATE_LABELS[item.state] || item.state}</Text>
          {item.quantity ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{item.quantity}</Text>
            </>
          ) : null}
          <Text style={styles.metaDot}>·</Text>
          <Text style={[styles.metaText, item.estimatedExpiryDays <= 3 && styles.urgentText]}>
            {formatExpiry(item)}
          </Text>
        </View>
        {item.notes ? (
          <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  priorityBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  priorityText: { fontSize: 11, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textSecondary },
  metaDot: { fontSize: 13, color: Colors.textMuted },
  urgentText: { color: Colors.urgentRed, fontWeight: '600' },
  notes: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});
