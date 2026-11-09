import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, Alert,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { inventoryAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import { Colors } from '../../constants/colors';

const SECTIONS = [
  { key: 'frigorifico', label: 'Frigorífico', icon: '🧊', loc: 'frigorífico' },
  { key: 'despensa',    label: 'Despensa',    icon: '🍞', loc: 'despensa'    },
  { key: 'congelador',  label: 'Congelador',  icon: '❄️', loc: 'congelador'  },
];

const UNIT_OPTIONS = [
  { key: 'g',   label: 'g'   },
  { key: 'kg',  label: 'kg'  },
  { key: 'ml',  label: 'ml'  },
  { key: 'L',   label: 'L'   },
  { key: 'un.', label: 'un.' },
  { key: '—',   label: '—'   },
];

function filterNumeric(v) {
  const clean = v.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

function buildQuantityString(value, unit) {
  if (unit === '—' || !value || !value.trim()) return '';
  return `${value.trim()}${unit}`;
}

let _counter = 0;
function newProduct() {
  return {
    id: String(++_counter),
    name: '', state: 'fechado', openedDaysAgo: '', qtyValue: '', qtyUnit: 'un.',
  };
}

// ── Linha de produto ──────────────────────────────────────────────────────────

function ProductCard({ product, onUpdate, onRemove, isFreezer }) {
  return (
    <View style={styles.card}>
      {/* Nome */}
      <View style={styles.cardHeader}>
        <TextInput
          style={styles.nameInput}
          value={product.name}
          onChangeText={(v) => onUpdate('name', v)}
          placeholder="Nome do produto…"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.removeBtnText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Estado — só para frigo e despensa */}
      {!isFreezer && (
        <View style={styles.stateRow}>
          {['fechado', 'aberto'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.stateChip, product.state === s && styles.stateChipActive]}
              onPress={() => onUpdate('state', s)}
            >
              <Text style={[styles.stateChipText, product.state === s && styles.stateChipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          {product.state === 'aberto' && (
            <View style={styles.daysRow}>
              <Text style={styles.daysLabel}>Aberto há</Text>
              <TextInput
                style={styles.daysInput}
                value={product.openedDaysAgo}
                onChangeText={(v) => onUpdate('openedDaysAgo', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="?"
                placeholderTextColor={Colors.textMuted}
                maxLength={2}
              />
              <Text style={styles.daysLabel}>dias</Text>
            </View>
          )}
        </View>
      )}

      {/* Quantidade */}
      <View style={styles.qtySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.unitRow}
          keyboardShouldPersistTaps="handled"
        >
          {UNIT_OPTIONS.map((u) => (
            <TouchableOpacity
              key={u.key}
              style={[styles.unitChip, product.qtyUnit === u.key && styles.unitChipActive]}
              onPress={() => { onUpdate('qtyUnit', u.key); onUpdate('qtyValue', ''); }}
            >
              <Text style={[styles.unitChipText, product.qtyUnit === u.key && styles.unitChipTextActive]}>
                {u.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {product.qtyUnit === '—' ? (
          <Text style={styles.noQuantHint}>Sem quantidade rastreável (sal, especiarias…)</Text>
        ) : (
          <View style={styles.valueRow}>
            <TextInput
              style={styles.valueInput}
              value={product.qtyValue}
              onChangeText={(v) => onUpdate('qtyValue', filterNumeric(v))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.unitLabel}>{product.qtyUnit}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Ecrã principal ────────────────────────────────────────────────────────────

export default function DescribeInventoryScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('frigorifico');
  const [products, setProducts] = useState({ frigorifico: [], despensa: [], congelador: [] });
  const [loading, setLoading] = useState(false);

  const addProduct = (loc) =>
    setProducts((prev) => ({ ...prev, [loc]: [...prev[loc], newProduct()] }));

  const removeProduct = (loc, id) =>
    setProducts((prev) => ({ ...prev, [loc]: prev[loc].filter((p) => p.id !== id) }));

  const updateProduct = (loc, id, field, value) =>
    setProducts((prev) => ({
      ...prev,
      [loc]: prev[loc].map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));

  const validProducts = Object.entries(products).flatMap(([loc, arr]) =>
    arr.filter((p) => p.name.trim().length >= 2).map((p) => ({ ...p, locKey: loc }))
  );
  const totalCount = validProducts.length;

  const handleCreate = async () => {
    if (totalCount === 0) {
      Alert.alert('Atenção', 'Adiciona pelo menos 1 produto antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      for (const p of validProducts) {
        const section = SECTIONS.find((s) => s.key === p.locKey);
        const quantity = buildQuantityString(p.qtyValue, p.qtyUnit);
        const isFreezer = p.locKey === 'congelador';
        const state = isFreezer ? 'congelado' : p.state;
        const daysAgo = isFreezer ? 0 : (parseInt(p.openedDaysAgo) || 0);

        await inventoryAPI.create({
          name: p.name.trim(),
          location: section.loc,
          state,
          quantity,
          openedDaysAgo: daysAgo,
          notes: daysAgo > 0 ? `Aberto há ${daysAgo} dia${daysAgo === 1 ? '' : 's'}` : '',
        });
      }
      await updateUser({ hasInventory: true, hasCompletedOnboarding: true });
      router.replace('/(app)/inventory');
    } catch (err) {
      Alert.alert('Erro', err.message || 'Ocorreu um erro. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  const currentProducts = products[activeTab];
  const section = SECTIONS.find((s) => s.key === activeTab);
  const isFreezer = activeTab === 'congelador';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>O que tens em casa?</Text>
          <Text style={styles.subtitle}>Adiciona os teus produtos por local.</Text>
        </View>

        {/* Tabs por local */}
        <View style={styles.tabs}>
          {SECTIONS.map((s) => {
            const count = products[s.key].filter((p) => p.name.trim().length >= 2).length;
            const isActive = activeTab === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(s.key)}
              >
                <Text style={styles.tabIcon}>{s.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{s.label}</Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={styles.tabBadgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Lista de produtos da tab ativa */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentProducts.length === 0 && (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabIcon}>{section.icon}</Text>
              <Text style={styles.emptyTabText}>
                Sem produtos no {section.label.toLowerCase()} ainda.
              </Text>
            </View>
          )}

          {currentProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isFreezer={isFreezer}
              onUpdate={(field, value) => updateProduct(activeTab, p.id, field, value)}
              onRemove={() => removeProduct(activeTab, p.id)}
            />
          ))}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => addProduct(activeTab)}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>
              + Adicionar produto ao {section.label.toLowerCase()}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Rodapé */}
        <View style={styles.footer}>
          <Button
            title={
              totalCount > 0
                ? `Criar inventário (${totalCount} produto${totalCount !== 1 ? 's' : ''})`
                : 'Criar inventário'
            }
            onPress={handleCreate}
            loading={loading}
            disabled={totalCount === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
    position: 'relative',
  },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  tabLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  tabLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
  tabBadge: {
    position: 'absolute', top: 5, right: 7,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeActive: { backgroundColor: Colors.primary },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyTab: { alignItems: 'center', paddingVertical: 32 },
  emptyTabIcon: { fontSize: 36, marginBottom: 8 },
  emptyTabText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  // ── Product card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 14, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  nameInput: {
    flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
    paddingVertical: 6, paddingHorizontal: 2,
  },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 22, color: Colors.textMuted, lineHeight: 22 },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stateChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  stateChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  stateChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  stateChipTextActive: { color: Colors.primaryDark, fontWeight: '700' },

  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  daysLabel: { fontSize: 13, color: Colors.textSecondary },
  daysInput: {
    width: 38, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, paddingVertical: 4,
  },

  // ── Quantity ──────────────────────────────────────────────────────────────
  qtySection: {},
  unitRow: { flexDirection: 'row', gap: 6, paddingBottom: 10 },
  unitChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  unitChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  unitChipTextActive: { color: Colors.primaryDark },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 2, backgroundColor: Colors.background,
  },
  valueInput: {
    flex: 1, fontSize: 18, fontWeight: '700', color: Colors.textPrimary, paddingVertical: 8,
  },
  unitLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  noQuantHint: {
    fontSize: 12, color: Colors.textMuted, fontStyle: 'italic',
    paddingHorizontal: 2, lineHeight: 16,
  },

  addBtn: {
    alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    backgroundColor: Colors.primaryLight,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primaryDark },

  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
});
