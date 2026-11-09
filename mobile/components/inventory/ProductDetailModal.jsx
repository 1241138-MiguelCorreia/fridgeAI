import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, TextInput,
} from 'react-native';
import { inventoryAPI } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Colors, PriorityColors, LocationColors } from '../../constants/colors';

const UNIT_OPTIONS = [
  { key: 'g',   label: 'g' },
  { key: 'kg',  label: 'kg' },
  { key: 'ml',  label: 'ml' },
  { key: 'L',   label: 'L' },
  { key: 'un.', label: 'un.' },
  { key: '—',   label: '—' },
];

function filterNumeric(v) {
  const clean = v.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

function parseQuantity(str) {
  if (!str) return { value: '', unit: '—' };
  const m = str.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
  if (m && m[1]) return { value: m[1], unit: m[2].trim() || 'un.' };
  return { value: '', unit: '—' };
}

function buildQuantityString(value, unit) {
  if (unit === '—' || !value.trim()) return '';
  return `${value.trim()}${unit}`;
}

const LOCATION_OPTIONS = ['frigorífico', 'despensa', 'congelador'];
const STATE_OPTIONS = ['aberto', 'fechado'];

const PRIORITY_LABELS = {
  usar_hoje: 'Usar hoje',
  usar_breve: 'Usar breve',
  pode_esperar: 'Pode esperar',
  stock: 'Stock',
};

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatExpiryFull(item) {
  if (!item.expiresAt) return '—';
  const days = item.estimatedExpiryDays;
  const dateStr = formatDate(item.expiresAt);
  if (days <= 0) return `Expirado (${dateStr})`;
  if (days === 1) return `Amanhã (${dateStr})`;
  return `Daqui a ${days} dias (${dateStr})`;
}

function OptionPicker({ label, options, value, onChange }) {
  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerOption, value === opt && styles.pickerOptionSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.pickerOptionText, value === opt && styles.pickerOptionTextSelected]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function ProductDetailModal({ visible, item, onClose, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName]         = useState('');
  const [location, setLocation] = useState('');
  const [state, setState]       = useState('');
  const [qtyValue, setQtyValue] = useState('');
  const [qtyUnit, setQtyUnit]   = useState('un.');
  const [notes, setNotes]       = useState('');

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setLocation(item.location || 'frigorífico');
      setState(item.state || 'fechado');
      const parsed = parseQuantity(item.quantity);
      setQtyValue(parsed.value);
      setQtyUnit(parsed.unit);
      setNotes(item.notes || '');
      setEditing(false);
    }
  }, [item]);

  if (!item) return null;

  const priorityColor = PriorityColors[item.priority] || PriorityColors.pode_esperar;
  const locationColor = LocationColors[item.location] || {};

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Erro', 'Nome inválido.');
      return;
    }
    setLoading(true);
    try {
      const quantity = buildQuantityString(qtyValue, qtyUnit);
      const res = await inventoryAPI.update(item._id, { name: name.trim(), location, state, quantity, notes });
      onUpdated?.(res.data.item);
      setEditing(false);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível atualizar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      `Remover ${item.name}?`,
      'Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, remover', style: 'destructive', onPress: async () => {
            setLoading(true);
            try {
              await inventoryAPI.remove(item._id);
              onDeleted?.(item._id);
              onClose();
            } catch (err) {
              Alert.alert('Erro', err.message || 'Não foi possível remover.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkUsed = async () => {
    setLoading(true);
    try {
      await inventoryAPI.remove(item._id);
      onDeleted?.(item._id);
      onClose();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível marcar como acabado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editing ? 'Editar produto' : 'Detalhes'}</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Text style={styles.editText}>Editar</Text>
            </TouchableOpacity>
          )}
          {editing && <View style={{ width: 56 }} />}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {!editing ? (
            // ── Vista de detalhe ──────────────────────────────────────────────
            <>
              <View style={styles.heroRow}>
                <Text style={styles.heroName}>{item.name}</Text>
                <View style={[styles.locationBadge, { backgroundColor: locationColor.bg }]}>
                  <Text style={styles.locationEmoji}>{locationColor.icon}</Text>
                  <Text style={[styles.locationText, { color: locationColor.text }]}>{item.location}</Text>
                </View>
              </View>

              <View style={[styles.priorityBanner, { backgroundColor: priorityColor.bg }]}>
                <Text style={[styles.priorityBannerText, { color: priorityColor.text }]}>
                  {PRIORITY_LABELS[item.priority]}
                </Text>
              </View>

              <View style={styles.infoGrid}>
                <InfoRow label="Estado" value={item.state} />
                <InfoRow label="Quantidade" value={item.quantity} />
                <InfoRow label="Validade" value={formatExpiryFull(item)} highlight={item.estimatedExpiryDays <= 3} />
                <InfoRow label="Adicionado em" value={formatDate(item.createdAt)} />
                {item.openedAt && <InfoRow label="Aberto em" value={formatDate(item.openedAt)} />}
                {item.notes ? <InfoRow label="Notas" value={item.notes} /> : null}
              </View>
            </>
          ) : (
            // ── Formulário de edição ──────────────────────────────────────────
            <>
              <Input label="Nome" value={name} onChangeText={setName} autoCapitalize="sentences" />
              <OptionPicker label="Local" options={LOCATION_OPTIONS} value={location} onChange={setLocation} />
              <OptionPicker label="Estado" options={STATE_OPTIONS} value={state} onChange={setState} />
              {/* Quantidade estruturada */}
              <View style={styles.qtyWrap}>
                <Text style={styles.pickerLabel}>Quantidade</Text>
                <View style={styles.unitRow}>
                  {UNIT_OPTIONS.map((u) => (
                    <TouchableOpacity
                      key={u.key}
                      style={[styles.unitChip, qtyUnit === u.key && styles.unitChipActive]}
                      onPress={() => { setQtyUnit(u.key); setQtyValue(''); }}
                    >
                      <Text style={[styles.unitChipText, qtyUnit === u.key && styles.unitChipTextActive]}>{u.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {qtyUnit === '—' ? (
                  <Text style={styles.noQuantHint}>Sem quantidade rastreável (sal, especiarias…)</Text>
                ) : (
                  <View style={styles.valueRow}>
                    <TextInput
                      style={styles.valueInput}
                      value={qtyValue}
                      onChangeText={(v) => setQtyValue(filterNumeric(v))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Text style={styles.unitLabel}>{qtyUnit}</Text>
                  </View>
                )}
              </View>
              <Input
                label="Notas (opcional)"
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={500}
                placeholder="Ex: Comprado hoje, aberto ontem…"
              />
              <Button title="Guardar" onPress={handleSave} loading={loading} />
              <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} />
            </>
          )}
        </ScrollView>

        {!editing && (
          <View style={styles.actions}>
            <Button title="Marcar como acabou" variant="secondary" onPress={handleMarkUsed} loading={loading} />
            <Button title="Remover" variant="danger" onPress={handleDelete} loading={loading} style={styles.deleteBtn} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueUrgent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  closeBtn: { width: 56 },
  closeText: { color: Colors.textSecondary, fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  editBtn: { width: 56, alignItems: 'flex-end' },
  editText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heroName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 12 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  locationEmoji: { fontSize: 14 },
  locationText: { fontSize: 13, fontWeight: '600' },
  priorityBanner: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginBottom: 20, alignItems: 'center' },
  priorityBannerText: { fontWeight: '700', fontSize: 15 },
  infoGrid: { backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  infoValueUrgent: { color: Colors.urgentRed },
  actions: { padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  deleteBtn: { backgroundColor: Colors.errorLight, },
  pickerContainer: { marginBottom: 16 },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  pickerOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pickerOptionText: { fontSize: 14, color: Colors.textSecondary },
  pickerOptionTextSelected: { color: Colors.primaryDark, fontWeight: '600' },
  qtyWrap: { marginBottom: 16 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  unitChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  unitChipText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  unitChipTextActive: { color: Colors.primaryDark },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 4, backgroundColor: Colors.white,
  },
  valueInput: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.textPrimary, paddingVertical: 10 },
  unitLabel: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  noQuantHint: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', paddingHorizontal: 4, lineHeight: 18 },
});
