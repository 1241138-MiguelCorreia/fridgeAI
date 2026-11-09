import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  SafeAreaView, Alert, TextInput, Modal, Animated, PanResponder,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { shoppingAPI } from '../../../services/api';
import { Colors } from '../../../constants/colors';
import StoresModal from '../../../components/shopping/StoresModal';

// ─── Price helpers ─────────────────────────────────────────────────────────────
function avgPrice(item) {
  const p = item?.estimatedPrice;
  if (!p) return 0;
  return ((p.min || 0) + (p.max || 0)) / 2;
}

function formatPrice(item) {
  const p = item?.estimatedPrice;
  if (!p || (!p.min && !p.max)) return '';
  if (!p.min || !p.max || p.min === p.max) {
    return `~${((p.min || p.max)).toFixed(2)}€`;
  }
  return `~${p.min.toFixed(2)}–${p.max.toFixed(2)}€`;
}

// ─── Quantity parsing para escalar preço ──────────────────────────────────────
const WEIGHT_CONV = { g: 1, gr: 1, kg: 1000 };
const VOLUME_CONV = { ml: 1, cl: 10, dl: 100, l: 1000 };

function parseQtyStr(str) {
  if (!str) return null;
  const m = str.trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*([a-z.]*)/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value) || value <= 0) return null;
  return { value, unit: m[2].replace(/\.$/, '').trim() };
}

function calcPriceRatio(oldStr, newStr) {
  const oldQ = parseQtyStr(oldStr);
  const newQ = parseQtyStr(newStr);
  if (!oldQ || !newQ || oldQ.value === 0) return 1;

  // Mesma unidade — ratio direto
  if (oldQ.unit === newQ.unit) return newQ.value / oldQ.value;

  // Converter para base comum (peso)
  if (WEIGHT_CONV[oldQ.unit] != null && WEIGHT_CONV[newQ.unit] != null) {
    return (newQ.value * WEIGHT_CONV[newQ.unit]) / (oldQ.value * WEIGHT_CONV[oldQ.unit]);
  }
  // Converter para base comum (volume)
  if (VOLUME_CONV[oldQ.unit] != null && VOLUME_CONV[newQ.unit] != null) {
    return (newQ.value * VOLUME_CONV[newQ.unit]) / (oldQ.value * VOLUME_CONV[oldQ.unit]);
  }
  // Unidades incompatíveis — não escalar
  return 1;
}

// ─── SwipeRow ─────────────────────────────────────────────────────────────────
function SwipeRow({ children, onDelete, label = '🗑', color = Colors.error }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swiped = useRef(false);
  const done = useRef(false);
  const THRESHOLD = -72;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (done.current) return;
        translateX.setValue(Math.max(-72, Math.min(0, g.dx + (swiped.current ? THRESHOLD : 0))));
      },
      onPanResponderRelease: (_, g) => {
        if (done.current) return;
        const cur = g.dx + (swiped.current ? THRESHOLD : 0);
        if (cur < THRESHOLD / 2) {
          Animated.spring(translateX, { toValue: THRESHOLD, useNativeDriver: true }).start();
          swiped.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          swiped.current = false;
        }
      },
    })
  ).current;

  const trigger = () => {
    done.current = true;
    Animated.timing(translateX, { toValue: -400, duration: 220, useNativeDriver: true }).start(onDelete);
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={[swipeStyles.bg, { backgroundColor: color }]}>
        <TouchableOpacity onPress={trigger} style={swipeStyles.bgBtn}>
          <Text style={swipeStyles.bgLabel}>{label}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
const swipeStyles = StyleSheet.create({
  bg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, alignItems: 'center', justifyContent: 'center' },
  bgBtn: { flex: 1, width: 72, alignItems: 'center', justifyContent: 'center' },
  bgLabel: { fontSize: 20 },
});

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, visible, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[toastSt.wrap, { opacity }]}>
      <Text style={toastSt.text}>{message}</Text>
    </Animated.View>
  );
}
const toastSt = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 108, left: 24, right: 24,
    backgroundColor: Colors.textPrimary, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', zIndex: 999,
  },
  text: { color: Colors.white, fontSize: 14, fontWeight: '500' },
});

// ─── Section Header ───────────────────────────────────────────────────────────
// Mapeamento de ícone Ionicons por secção
const SECTION_ICONS = {
  essenciais: 'cart',
  reposição:  'reload-circle',
  sugestões:  'bulb',
  manual:     'pencil',
};

function SectionHeader({ title, count, total, collapsed, onToggle, color, iconKey }) {
  const iconName = SECTION_ICONS[iconKey] || 'list';
  return (
    <TouchableOpacity style={[secSt.header, { borderLeftColor: color }]} onPress={onToggle} activeOpacity={0.8}>
      <Ionicons name={iconName} size={20} color={color} style={secSt.icon} />
      <Text style={secSt.title}>{title}</Text>
      <View style={secSt.right}>
        <View style={[secSt.badge, { backgroundColor: color + '22' }]}>
          <Text style={[secSt.badgeText, { color }]}>{count}</Text>
        </View>
        {total > 0 && <Text style={secSt.total}>~{total.toFixed(2)}€</Text>}
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={14}
          color={Colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}
const secSt = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, paddingVertical: 12, paddingHorizontal: 16,
    borderLeftWidth: 4, marginTop: 8,
  },
  icon: { /* espaço gerido pelo gap */ },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  total: { fontSize: 12, color: Colors.textSecondary },
});

// ─── Suggestion Row ────────────────────────────────────────────────────────────
function SuggestionRow({ item, onAdd, onDelete, onEditQty }) {
  const showNeeded = item.neededAmount && item.neededAmount !== item.purchaseAmount;
  const priceStr = formatPrice(item);
  return (
    <SwipeRow onDelete={() => onDelete(item.itemId)}>
      <View style={sugSt.row}>
        <View style={sugSt.info}>
          <View style={sugSt.nameRow}>
            <Text style={sugSt.name}>{item.name}</Text>
            {item.hasInStock && (
              <View style={sugSt.stockBadge}>
                <Text style={sugSt.stockText}>Em stock</Text>
              </View>
            )}
          </View>
          {showNeeded && (
            <Text style={sugSt.needed}>Precisas: {item.neededAmount}</Text>
          )}
          <TouchableOpacity onPress={() => onEditQty(item)} activeOpacity={0.7} style={sugSt.purchaseRow}>
            <Text style={sugSt.purchase}>Comprar: {item.purchaseAmount || '1 un.'}</Text>
            <Text style={sugSt.editHint}> ✏️</Text>
          </TouchableOpacity>
          {item.reason ? <Text style={sugSt.reason}>{item.reason}</Text> : null}
        </View>
        {priceStr ? <Text style={sugSt.price}>{priceStr}</Text> : null}
        <TouchableOpacity style={sugSt.addBtn} onPress={() => onAdd(item.itemId)} activeOpacity={0.7}>
          <Text style={sugSt.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </SwipeRow>
  );
}
const sugSt = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  needed: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  purchase: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  editHint: { fontSize: 11 },
  reason: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  price: { fontSize: 12, color: Colors.textSecondary, marginRight: 4 },
  stockBadge: { backgroundColor: Colors.warnYellowLight, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  stockText: { fontSize: 10, color: Colors.warnYellow, fontWeight: '600' },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 20, color: Colors.primary, fontWeight: '400', lineHeight: 24 },
});

// ─── List Item Row ─────────────────────────────────────────────────────────────
function ListItemRow({ item, onRemove, onEditQty }) {
  const showNeeded = item.neededAmount && item.neededAmount !== item.purchaseAmount;
  const priceStr = formatPrice(item);
  return (
    <SwipeRow onDelete={() => onRemove(item.itemId)} label='←' color={Colors.warnYellow}>
      <View style={listSt.row}>
        <View style={listSt.dot} />
        <TouchableOpacity style={listSt.info} onPress={() => onEditQty(item)} activeOpacity={0.7}>
          <Text style={listSt.name}>{item.name}</Text>
          {showNeeded && <Text style={listSt.needed}>Precisas: {item.neededAmount}</Text>}
          <Text style={listSt.purchase}>{item.purchaseAmount || '1 un.'} ✏️</Text>
        </TouchableOpacity>
        {priceStr ? <Text style={listSt.price}>{priceStr}</Text> : null}
      </View>
    </SwipeRow>
  );
}
const listSt = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  needed: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  purchase: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 2 },
  price: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
});

// ─── Edit Quantity Modal ───────────────────────────────────────────────────────
const QTY_UNITS = [
  { key: 'un.', label: 'un.' },
  { key: 'g',   label: 'g' },
  { key: 'kg',  label: 'kg' },
  { key: 'ml',  label: 'ml' },
  { key: 'L',   label: 'L' },
];

function filterNumeric(v) {
  // Accept commas as decimal separator (Portuguese) and convert to dot
  const clean = v.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

function EditQuantityModal({ visible, item, onClose, onSave }) {
  const [numValue, setNumValue] = useState('');
  const [unit, setUnit] = useState('un.');

  useEffect(() => {
    if (visible && item) {
      // Parse existing value like "500g", "2 un.", "1.5L"
      const raw = item.purchaseAmount || '';
      const m = raw.replace(',', '.').match(/^([\d.]+)\s*(.*)$/);
      if (m) {
        setNumValue(m[1]);
        const parsedUnit = m[2].trim();
        setUnit(QTY_UNITS.some((u) => u.key === parsedUnit) ? parsedUnit : 'un.');
      } else {
        setNumValue('');
        setUnit('un.');
      }
    }
  }, [visible, item]);

  const submit = () => {
    if (!numValue.trim()) return;
    const combined = `${numValue.trim()}${unit}`;
    onSave(item.itemId, combined);
    onClose();
  };

  const isValid = numValue.trim().length > 0 && parseFloat(numValue) > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={eqSt.kavWrap}>
        <TouchableOpacity style={eqSt.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={eqSt.card}>
          <Text style={eqSt.title}>Quantidade a comprar</Text>
          {item?.name ? <Text style={eqSt.sub}>{item.name}</Text> : null}

          {/* Unit chips */}
          <View style={eqSt.unitRow}>
            {QTY_UNITS.map((u) => (
              <TouchableOpacity
                key={u.key}
                style={[eqSt.unitChip, unit === u.key && eqSt.unitChipActive]}
                onPress={() => setUnit(u.key)}
                activeOpacity={0.7}
              >
                <Text style={[eqSt.unitChipText, unit === u.key && eqSt.unitChipTextActive]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Numeric input */}
          <View style={eqSt.valueRow}>
            <TextInput
              style={eqSt.valueInput}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              value={numValue}
              onChangeText={(v) => setNumValue(filterNumeric(v))}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={submit}
              autoFocus
            />
            <Text style={eqSt.unitLabel}>{unit}</Text>
          </View>

          <View style={eqSt.btnRow}>
            <TouchableOpacity style={eqSt.cancel} onPress={onClose}>
              <Text style={eqSt.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[eqSt.save, !isValid && eqSt.saveDisabled]}
              onPress={submit}
              disabled={!isValid}
            >
              <Text style={eqSt.saveText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const eqSt = StyleSheet.create({
  kavWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '85%',
    gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 14, color: Colors.textSecondary, marginTop: -8 },
  unitRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  unitChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  unitChipText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  unitChipTextActive: { color: Colors.primary },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 4, backgroundColor: Colors.white,
  },
  valueInput: { flex: 1, fontSize: 28, fontWeight: '700', color: Colors.textPrimary, paddingVertical: 10 },
  unitLabel: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  save: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  saveDisabled: { backgroundColor: Colors.border },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function AddItemModal({ visible, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const submit = () => {
    if (!name.trim() || name.trim().length < 2) return;
    onAdd(name.trim(), amount.trim());
    setName(''); setAmount(''); onClose();
  };
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={addSt.kavWrap}>
        <TouchableOpacity style={addSt.backdrop} activeOpacity={1} onPress={() => { setName(''); setAmount(''); onClose(); }} />
        <View style={addSt.card}>
          <Text style={addSt.title}>Adicionar à lista</Text>
          <TextInput
            style={addSt.input} placeholder="Nome do produto"
            placeholderTextColor={Colors.textMuted} value={name}
            onChangeText={setName} autoFocus returnKeyType="next"
          />
          <TextInput
            style={addSt.input} placeholder="Quantidade (opcional, ex: 500g)"
            placeholderTextColor={Colors.textMuted} value={amount}
            onChangeText={setAmount} returnKeyType="done" onSubmitEditing={submit}
          />
          <View style={addSt.row}>
            <TouchableOpacity style={addSt.cancel} onPress={() => { setName(''); setAmount(''); onClose(); }}>
              <Text style={addSt.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[addSt.add, !name.trim() && addSt.addDisabled]} onPress={submit} disabled={!name.trim()}>
              <Text style={addSt.addText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const addSt = StyleSheet.create({
  kavWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '85%',
    gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  add: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  addDisabled: { backgroundColor: Colors.border },
  addText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ visible, items, onClose, onConfirm }) {
  const total = items.reduce((s, i) => s + avgPrice(i), 0);
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={confSt.overlay}>
        <View style={confSt.sheet}>
          <Text style={confSt.title}>Confirmar compras</Text>
          <Text style={confSt.sub}>{items.length} produto{items.length !== 1 ? 's' : ''} serão adicionados ao inventário.</Text>
          <Text style={confSt.total}>Total estimado: ~{total.toFixed(2)}€</Text>
          <View style={confSt.row}>
            <TouchableOpacity style={confSt.cancel} onPress={onClose}>
              <Text style={confSt.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={confSt.confirm} onPress={onConfirm}>
              <Text style={confSt.confirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const confSt = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, margin: 24, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 14, color: Colors.textSecondary },
  total: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirm: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});

// ─── History Modal ────────────────────────────────────────────────────────────
const CATEGORY_LABEL = { essenciais: 'Essenciais', 'reposição': 'Reposição', 'sugestões': 'Sugestões', manual: 'Manual' };

function HistoryModal({ visible, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      shoppingAPI.getHistory()
        .then((r) => setHistory(r.data.history || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else { setSelected(null); }
  }, [visible]);

  const fDate = (d) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const fTime = (d) => new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={histSt.overlay}>
        <View style={histSt.sheet}>
          <View style={histSt.header}>
            {selected ? (
              <TouchableOpacity onPress={() => setSelected(null)} style={histSt.back}>
                <Text style={histSt.backIcon}>←</Text>
              </TouchableOpacity>
            ) : <View style={histSt.back} />}
            <Text style={histSt.title}>{selected ? fDate(selected.confirmedAt) : 'Histórico de compras'}</Text>
            <TouchableOpacity onPress={selected ? () => setSelected(null) : onClose} style={histSt.closeBtn}>
              <Text style={histSt.closeText}>{selected ? '' : '✕'}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ margin: 32 }} />
          ) : selected ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={histSt.meta}>
                <Text style={histSt.metaTime}>{fTime(selected.confirmedAt)}</Text>
                <View style={histSt.metaRow}>
                  <Text style={histSt.metaLabel}>Total estimado</Text>
                  <Text style={histSt.metaValue}>~{(selected.totalEstimate || 0).toFixed(2)}€</Text>
                </View>
              </View>
              {selected.items.map((item, idx) => (
                <View key={idx} style={histSt.detailItem}>
                  <View style={histSt.detailLeft}>
                    <Text style={histSt.detailName}>{item.name}</Text>
                    {item.purchaseAmount ? (
                      <Text style={histSt.detailAmount}>{item.purchaseAmount}</Text>
                    ) : item.neededAmount ? (
                      <Text style={histSt.detailAmount}>{item.neededAmount}</Text>
                    ) : null}
                    {item.linkedMealName && (
                      <Text style={histSt.detailMeal}>Para: {item.linkedMealName}</Text>
                    )}
                  </View>
                  <View style={histSt.detailRight}>
                    {item.estimatedPrice != null && <Text style={histSt.detailPrice}>~{item.estimatedPrice.toFixed(2)}€</Text>}
                    {item.category && (
                      <View style={histSt.catBadge}>
                        <Text style={histSt.catBadgeText}>{CATEGORY_LABEL[item.category] || item.category}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
          ) : history.length === 0 ? (
            <Text style={histSt.empty}>Ainda não fizeste nenhuma compra.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {history.map((entry, idx) => (
                <TouchableOpacity key={idx} style={histSt.entry} onPress={() => setSelected(entry)} activeOpacity={0.7}>
                  <View style={histSt.entryLeft}>
                    <Text style={histSt.entryEmoji}>🛒</Text>
                    <View>
                      <Text style={histSt.entryDate}>{fDate(entry.confirmedAt)}</Text>
                      <Text style={histSt.entryCount}>{entry.checkedCount} produto{entry.checkedCount !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={histSt.entryRight}>
                    <Text style={histSt.entryTotal}>~{(entry.totalEstimate || 0).toFixed(2)}€</Text>
                    <Text style={histSt.entryChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
const histSt = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  back: { width: 36 },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  closeBtn: { width: 36, alignItems: 'flex-end' },
  closeText: { fontSize: 18, color: Colors.textMuted },
  empty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 32 },
  entry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  entryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryEmoji: { fontSize: 24 },
  entryDate: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  entryCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  entryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTotal: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  entryChevron: { fontSize: 20, color: Colors.textMuted, fontWeight: '300' },
  meta: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 },
  metaTime: { fontSize: 13, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 14, color: Colors.textSecondary },
  metaValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailLeft: { flex: 1, gap: 2 },
  detailName: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  detailAmount: { fontSize: 12, color: Colors.textSecondary },
  detailMeal: { fontSize: 11, color: Colors.textMuted },
  detailRight: { alignItems: 'flex-end', gap: 4 },
  detailPrice: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catBadge: { backgroundColor: Colors.borderLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
});

// ─── Sections config ──────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'essenciais', label: 'Essenciais',  color: Colors.urgentRed  },
  { key: 'reposição',  label: 'Reposição',   color: Colors.warnYellow },
  { key: 'sugestões',  label: 'Sugestões',   color: Colors.stockBlue  },
  { key: 'manual',     label: 'Adicionados', color: Colors.primary    },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ShoppingScreen() {
  const [view, setView] = useState('hub');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [regenLoading, setRegenLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set(['sugestões']));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStoresModal, setShowStoresModal] = useState(false);
  const [showEditQtyModal, setShowEditQtyModal] = useState(false);
  const [editQtyTarget, setEditQtyTarget] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const cooldownRef = useRef(null);

  const showToast = (msg) => setToast({ visible: true, message: msg });

  const fetchList = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await shoppingAPI.getList();
      setItems(res.data.items || []);
      setCooldown(Math.ceil((res.data.cooldownRemaining || 0) / 1000));
    } catch (_) {
      if (!silent) Alert.alert('Erro', 'Não foi possível carregar a lista.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchList(); }, []));

  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => { if (c <= 1) { clearInterval(cooldownRef.current); return 0; } return c - 1; });
      }, 1000);
    }
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  const onRefresh = () => { setRefreshing(true); fetchList(true); };

  const handleAddToList = async (itemId) => {
    setItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, checked: true } : i));
    try { await shoppingAPI.updateItem(itemId, { checked: true }); }
    catch (_) { setItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, checked: false } : i)); }
    showToast('Adicionado à lista!');
  };

  const handleRemoveFromList = async (itemId) => {
    setItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, checked: false } : i));
    try { await shoppingAPI.updateItem(itemId, { checked: false }); }
    catch (_) { setItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, checked: true } : i)); }
  };

  const handleDeleteSuggestion = async (itemId) => {
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));
    try { await shoppingAPI.deleteItem(itemId); }
    catch (_) { fetchList(true); }
  };

  const handleAdd = async (name, amount) => {
    try {
      const res = await shoppingAPI.addItem(name, amount);
      const newItem = (res.data.items || []).find((i) => i.itemId.startsWith('manual_') && i.name.toLowerCase() === name.toLowerCase());
      if (newItem) {
        await shoppingAPI.updateItem(newItem.itemId, { checked: true });
        setItems((res.data.items || []).map((i) => i.itemId === newItem.itemId ? { ...i, checked: true } : i));
      } else {
        setItems(res.data.items || []);
      }
      showToast(`"${name}" adicionado à lista!`);
      setView('list');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível adicionar o item.');
    }
  };

  const handleEditQty = (item) => {
    setEditQtyTarget(item);
    setShowEditQtyModal(true);
  };

  const handleSaveQty = async (itemId, purchaseAmount) => {
    setItems((prev) => prev.map((i) => {
      if (i.itemId !== itemId) return i;

      // Escalar o preço proporcionalmente à nova quantidade
      let estimatedPrice = i.estimatedPrice;
      if (estimatedPrice && i.purchaseAmount && purchaseAmount) {
        const ratio = calcPriceRatio(i.purchaseAmount, purchaseAmount);
        if (ratio !== 1) {
          estimatedPrice = {
            min: Math.round((estimatedPrice.min || 0) * ratio * 100) / 100,
            max: Math.round((estimatedPrice.max || 0) * ratio * 100) / 100,
          };
        }
      }

      return { ...i, purchaseAmount, estimatedPrice };
    }));
    try { await shoppingAPI.updateItem(itemId, { purchaseAmount }); }
    catch (_) { fetchList(true); }
    showToast('Quantidade atualizada!');
  };

  const handleRegenerate = async () => {
    if (cooldown > 0) return;
    setRegenLoading(true);
    try {
      const res = await shoppingAPI.regenerate();
      setItems(res.data.items || []);
      setCooldown(Math.ceil((res.data.cooldownRemaining || 0) / 1000));
      showToast('Sugestões atualizadas!');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível atualizar.');
    } finally { setRegenLoading(false); }
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    try {
      const res = await shoppingAPI.confirm();
      setItems(res.data.remainingItems || []);
      setView('hub');
      showToast(`${res.data.addedToInventory} produto${res.data.addedToInventory !== 1 ? 's' : ''} adicionado${res.data.addedToInventory !== 1 ? 's' : ''} ao inventário!`);
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível confirmar as compras.');
    }
  };

  const toggleSection = (key) => {
    setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const listItems = items.filter((i) => i.checked);
  const listTotal = listItems.reduce((s, i) => s + avgPrice(i), 0);

  const renderSuggestions = () => SECTIONS.map((sec) => {
    const sItems = items.filter((i) => i.category === sec.key && !i.checked);
    if (sItems.length === 0) return null;
    const isCollapsed = collapsed.has(sec.key);
    const secTotal = sItems.reduce((s, i) => s + avgPrice(i), 0);
    return (
      <View key={sec.key}>
        <SectionHeader
          title={sec.label} count={sItems.length} total={secTotal}
          collapsed={isCollapsed} onToggle={() => toggleSection(sec.key)}
          color={sec.color} iconKey={sec.key}
        />
        {!isCollapsed && sItems.map((item) => (
          <SuggestionRow
            key={item.itemId} item={item}
            onAdd={handleAddToList}
            onDelete={handleDeleteSuggestion}
            onEditQty={handleEditQty}
          />
        ))}
      </View>
    );
  });

  const sharedModals = (
    <>
      <EditQuantityModal
        visible={showEditQtyModal}
        item={editQtyTarget}
        onClose={() => setShowEditQtyModal(false)}
        onSave={handleSaveQty}
      />
      <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAdd} />
      <Toast visible={toast.visible} message={toast.message} onHide={() => setToast({ visible: false, message: '' })} />
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>A preparar as sugestões…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lista view ────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => setView('hub')} style={st.backBtn}>
            <Text style={st.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>Lista</Text>
          <View style={st.backBtn} />
        </View>

        {listItems.length > 0 && (
          <View style={st.listTotalBar}>
            <View>
              <Text style={st.listTotalLabel}>{listItems.length} produto{listItems.length !== 1 ? 's' : ''}</Text>
              <Text style={st.listTotalValue}>~{listTotal.toFixed(2)}€</Text>
            </View>
            <TouchableOpacity style={st.compreiBtn} onPress={() => setShowConfirmModal(true)}>
              <Text style={st.compreiText}>Comprei ✓</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={st.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {listItems.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyEmoji}>📋</Text>
              <Text style={st.emptyTitle}>Lista vazia</Text>
              <Text style={st.emptySub}>Adiciona produtos com o "+" nas sugestões ou com o botão abaixo.</Text>
              <TouchableOpacity style={st.emptyBack} onPress={() => setView('hub')}>
                <Text style={st.emptyBackText}>Ver sugestões</Text>
              </TouchableOpacity>
            </View>
          ) : (
            listItems.map((item) => (
              <ListItemRow key={item.itemId} item={item} onRemove={handleRemoveFromList} onEditQty={handleEditQty} />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity style={st.fab} onPress={() => setShowAddModal(true)}>
          <Text style={st.fabText}>+</Text>
        </TouchableOpacity>

        <ConfirmModal
          visible={showConfirmModal} items={listItems}
          onClose={() => setShowConfirmModal(false)} onConfirm={handleConfirm}
        />
        {sharedModals}
      </SafeAreaView>
    );
  }

  // ── Hub view ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <Text style={st.title}>Compras</Text>
        <View style={st.headerActions}>
          <TouchableOpacity style={st.storesBtn} onPress={() => setShowStoresModal(true)}>
            <Text style={st.storesBtnText}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.regenBtn, cooldown > 0 && st.regenDisabled]}
            onPress={handleRegenerate} disabled={cooldown > 0 || regenLoading}
          >
            {regenLoading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={st.regenText}>{cooldown > 0 ? `${cooldown}s` : '🔄'}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={st.menuGrid}>
          <TouchableOpacity style={st.menuCard} onPress={() => setView('list')} activeOpacity={0.8}>
            <Text style={st.menuCardEmoji}>📋</Text>
            <View style={st.menuCardInfo}>
              <Text style={st.menuCardTitle}>Lista</Text>
              <Text style={st.menuCardSub}>
                {listItems.length > 0 ? `${listItems.length} produto${listItems.length !== 1 ? 's' : ''}` : 'Vazia'}
              </Text>
            </View>
            {listItems.length > 0 && (
              <View style={st.menuCardBadge}>
                <Text style={st.menuCardBadgeText}>{listItems.length}</Text>
              </View>
            )}
            <Text style={st.menuCardChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={st.menuCard} onPress={() => setShowHistoryModal(true)} activeOpacity={0.8}>
            <Text style={st.menuCardEmoji}>🕓</Text>
            <View style={st.menuCardInfo}>
              <Text style={st.menuCardTitle}>Histórico</Text>
              <Text style={st.menuCardSub}>Compras anteriores</Text>
            </View>
            <Text style={st.menuCardChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={st.menuCard} onPress={() => setShowStoresModal(true)} activeOpacity={0.8}>
            <Text style={st.menuCardEmoji}>📍</Text>
            <View style={st.menuCardInfo}>
              <Text style={st.menuCardTitle}>Lojas perto de mim</Text>
              <Text style={st.menuCardSub}>Supermercados e mercados</Text>
            </View>
            <Text style={st.menuCardChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={st.suggestionsLabel}>Sugestões</Text>
        {items.filter((i) => !i.checked).length === 0 ? (
          <View style={st.emptySuggestions}>
            <Text style={st.emptySugText}>Sem sugestões de momento. Usa o 🔄 para atualizar.</Text>
          </View>
        ) : (
          renderSuggestions()
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={st.fab} onPress={() => setShowAddModal(true)}>
        <Text style={st.fabText}>+</Text>
      </TouchableOpacity>

      <HistoryModal visible={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
      <StoresModal
        visible={showStoresModal}
        onClose={() => setShowStoresModal(false)}
        listCount={listItems.length}
        listEstimate={listTotal > 0 ? listTotal : null}
      />
      {sharedModals}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: Colors.textSecondary },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  backBtn: { width: 40 },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storesBtn: {
    backgroundColor: Colors.background, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 40, alignItems: 'center',
  },
  storesBtnText: { fontSize: 16 },
  regenBtn: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 40, alignItems: 'center',
  },
  regenDisabled: { backgroundColor: Colors.border },
  regenText: { fontSize: 16, color: Colors.white, fontWeight: '700' },

  menuGrid: { padding: 16, gap: 10 },
  menuCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  menuCardEmoji: { fontSize: 26 },
  menuCardInfo: { flex: 1 },
  menuCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  menuCardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  menuCardBadge: {
    backgroundColor: Colors.primary, borderRadius: 12, minWidth: 24,
    paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center',
  },
  menuCardBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  menuCardChevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },

  suggestionsLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  emptySuggestions: { padding: 32, alignItems: 'center' },
  emptySugText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  listTotalBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  listTotalLabel: { fontSize: 12, color: Colors.textSecondary },
  listTotalValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  compreiBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  compreiText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBack: { marginTop: 20, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBackText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
