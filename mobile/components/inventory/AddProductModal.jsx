import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, TextInput,
} from 'react-native';
import { inventoryAPI } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Colors } from '../../constants/colors';

const LOCATION_OPTIONS = ['frigorífico', 'despensa', 'congelador'];
const STATE_OPTIONS    = ['fechado', 'aberto'];

const UNIT_OPTIONS = [
  { key: 'g',   label: 'g',   hint: 'Gramas' },
  { key: 'kg',  label: 'kg',  hint: 'Quilos' },
  { key: 'ml',  label: 'ml',  hint: 'Mililitros' },
  { key: 'L',   label: 'L',   hint: 'Litros' },
  { key: 'un.', label: 'un.', hint: 'Unidades' },
  { key: '—',   label: '—',   hint: 'Sem quantidade (sal, especiarias…)' },
];

function filterNumeric(v) {
  const clean = v.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

function buildQuantityString(value, unit) {
  if (unit === '—' || !value.trim()) return '';
  return `${value.trim()}${unit}`;
}

function OptionPicker({ label, options, value, onChange, required }) {
  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
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

function QuantityField({ value, unit, onValueChange, onUnitChange }) {
  return (
    <View style={styles.qtyWrap}>
      <Text style={styles.pickerLabel}>Quantidade</Text>

      {/* Unit chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitRow}>
        {UNIT_OPTIONS.map((u) => (
          <TouchableOpacity
            key={u.key}
            style={[styles.unitChip, unit === u.key && styles.unitChipActive]}
            onPress={() => onUnitChange(u.key)}
          >
            <Text style={[styles.unitChipText, unit === u.key && styles.unitChipTextActive]}>{u.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {unit === '—' ? (
        <Text style={styles.noQuantHint}>
          Ingrediente não mensurável (sal, especiarias, azeite…). A quantidade não será rastreada.
        </Text>
      ) : (
        <View style={styles.valueRow}>
          <TextInput
            style={styles.valueInput}
            value={value}
            onChangeText={(v) => onValueChange(filterNumeric(v))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.unitLabel}>{unit}</Text>
        </View>
      )}
    </View>
  );
}

export default function AddProductModal({ visible, onClose, onAdded }) {
  const [name, setName]         = useState('');
  const [location, setLocation] = useState('frigorífico');
  const [state, setState]       = useState('fechado');
  const [qtyValue, setQtyValue] = useState('');
  const [qtyUnit, setQtyUnit]   = useState('un.');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [nameError, setNameError] = useState('');

  const reset = () => {
    setName(''); setLocation('frigorífico'); setState('fechado');
    setQtyValue(''); setQtyUnit('un.'); setNotes(''); setNameError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleAdd = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError('Introduz o nome do produto (mínimo 2 caracteres).');
      return;
    }
    setLoading(true);
    try {
      const quantity = buildQuantityString(qtyValue, qtyUnit);
      const res = await inventoryAPI.create({ name: name.trim(), location, state, quantity, notes: notes.trim() });
      const { item, warning } = res.data;
      if (warning) Alert.alert('Atenção', warning);
      onAdded?.(item);
      reset();
      onClose();
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível adicionar o produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Adicionar produto</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Nome *"
            placeholder="Ex: Leite, ovos, tomate…"
            value={name}
            onChangeText={(t) => { setName(t); setNameError(''); }}
            autoCapitalize="sentences"
            error={nameError}
          />
          <OptionPicker label="Local" options={LOCATION_OPTIONS} value={location} onChange={setLocation} required />
          <OptionPicker label="Estado" options={STATE_OPTIONS} value={state} onChange={setState} />
          <QuantityField
            value={qtyValue}
            unit={qtyUnit}
            onValueChange={setQtyValue}
            onUnitChange={(u) => { setQtyUnit(u); setQtyValue(''); }}
          />
          <Input
            label="Notas (opcional)"
            placeholder="Ex: Comprado hoje, aberto ontem…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Adicionar" onPress={handleAdd} loading={loading} />
        </View>
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
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 16 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  required: { color: Colors.urgentRed },
  pickerContainer: { marginBottom: 20 },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  pickerOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pickerOptionText: { fontSize: 14, color: Colors.textSecondary },
  pickerOptionTextSelected: { color: Colors.primaryDark, fontWeight: '600' },
  // ── Quantity ─────────────────────────────────────────────────────────────────
  qtyWrap: { marginBottom: 20 },
  unitRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
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
  valueInput: {
    flex: 1, fontSize: 20, fontWeight: '700', color: Colors.textPrimary,
    paddingVertical: 10,
  },
  unitLabel: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  noQuantHint: {
    fontSize: 13, color: Colors.textMuted, fontStyle: 'italic',
    paddingHorizontal: 4, lineHeight: 18,
  },
});
