import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  SafeAreaView, Alert, SectionList, Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { inventoryAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import ProductCard from '../../../components/inventory/ProductCard';
import ProductDetailModal from '../../../components/inventory/ProductDetailModal';
import AddProductModal from '../../../components/inventory/AddProductModal';
import ReceiptScanModal from '../../../components/inventory/ReceiptScanModal';
import { Colors, LocationColors } from '../../../constants/colors';
import { scheduleExpiryNotifications } from '../../../services/notifications';

const LOCATION_ORDER = ['frigorífico', 'despensa', 'congelador'];

export default function InventoryScreen() {
  const { user, logout, setMode } = useAuth();
  const [items, setItems] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [urgentItems, setUrgentItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [toast, setToast] = useState(null); // { message: string }
  const [expandedSections, setExpandedSections] = useState(new Set(LOCATION_ORDER));
  const [expandUrgent, setExpandUrgent] = useState(false);

  const fetchInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await inventoryAPI.getAll();
      const { items: allItems, grouped: g, urgentItems: urgent, totalItems: total } = res.data;
      setItems(allItems);
      setGrouped(g || {});
      setUrgentItems(urgent || []);
      setTotalItems(total || 0);
    } catch (err) {
      if (!silent) Alert.alert('Erro', 'Não foi possível carregar o inventário.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchInventory();
    // Atualizar notificações sempre que o utilizador abre o inventário
    scheduleExpiryNotifications();
  }, []));

  const onRefresh = () => { setRefreshing(true); fetchInventory(true); };

  const toggleSection = (location) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(location) ? next.delete(location) : next.add(location);
      return next;
    });
  };

  const handleItemUpdated = (updated) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
    setSelectedItem(updated);
    fetchInventory(true);
  };

  const handleItemDeleted = (id) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
    fetchInventory(true);
  };

  const handleItemAdded = (item) => {
    fetchInventory(true);
  };

  const handleSetMode = async (mode) => {
    try {
      await setMode(mode);
      Alert.alert('Modo alterado', `Estás agora no modo ${mode === 'fitness' ? 'Fitness' : 'Normal'}.`);
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o modo.');
    }
  };

  const handleReceiptAdded = (count) => {
    fetchInventory(true);
    setToast({ message: `${count} produto${count !== 1 ? 's' : ''} adicionado${count !== 1 ? 's' : ''} ao inventário` });
    setTimeout(() => setToast(null), 3000);
  };

  const getLocationItems = (loc) => {
    const key = loc === 'frigorífico' ? 'frigorifico' : loc;
    return grouped[key] || [];
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventário</Text>
          <Text style={styles.subtitle}>{totalItems} produto{totalItems !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const isFitness = user?.mode === 'fitness';
            Alert.alert(
              'Definições',
              `Modo atual: ${isFitness ? 'Fitness' : 'Normal'}`,
              [
                {
                  text: isFitness ? 'Mudar para modo Normal' : 'Mudar para modo Fitness',
                  onPress: () => handleSetMode(isFitness ? 'normal' : 'fitness'),
                },
                { text: 'Terminar sessão', style: 'destructive', onPress: logout },
                { text: 'Cancelar', style: 'cancel' },
              ]
            );
          }}
          style={styles.settingsBtn}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={LOCATION_ORDER}
        keyExtractor={(item) => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <>
            {/* Alerta de urgência */}
            {urgentItems.length > 0 && (
              <TouchableOpacity
                style={styles.urgentCard}
                onPress={() => setExpandUrgent(!expandUrgent)}
                activeOpacity={0.85}
              >
                <View style={styles.urgentHeader}>
                  <View style={styles.urgentLeft}>
                    <Text style={styles.urgentEmoji}>⚠️</Text>
                    <Text style={styles.urgentTitle}>Usar em breve</Text>
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>{urgentItems.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.urgentChevron}>{expandUrgent ? '▲' : '▼'}</Text>
                </View>
                {expandUrgent && (
                  <View style={styles.urgentList}>
                    {urgentItems.map((item) => (
                      <TouchableOpacity
                        key={item._id}
                        style={styles.urgentItem}
                        onPress={() => setSelectedItem(item)}
                      >
                        <Text style={styles.urgentItemName}>{item.name}</Text>
                        <Text style={styles.urgentItemExpiry}>
                          {item.estimatedExpiryDays <= 1 ? 'Hoje!' : `${item.estimatedExpiryDays} dias`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>A carregar…</Text>
            </View>
          ) : null
        }
        renderItem={({ item: location }) => {
          const locationItems = getLocationItems(location);
          const isExpanded = expandedSections.has(location);
          const locColor = LocationColors[location] || {};

          return (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(location)}
                activeOpacity={0.8}
              >
                <View style={[styles.sectionIconWrap, { backgroundColor: locColor.bg }]}>
                  <Text style={styles.sectionIcon}>{locColor.icon}</Text>
                </View>
                <Text style={styles.sectionTitle}>
                  {location.charAt(0).toUpperCase() + location.slice(1)}
                </Text>
                <Text style={styles.sectionCount}>{locationItems.length}</Text>
                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                locationItems.length === 0 ? (
                  <Text style={styles.emptySection}>Sem produtos nesta secção.</Text>
                ) : (
                  locationItems.map((item) => (
                    <ProductCard
                      key={item._id}
                      item={item}
                      onPress={(i) => setSelectedItem(i)}
                    />
                  ))
                )
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          items.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>Ainda não tens produtos.</Text>
            </View>
          ) : null
        }
      />

      {/* FABs */}
      <TouchableOpacity style={styles.fabScan} onPress={() => setShowReceiptModal(true)}>
        <Text style={styles.fabScanText}>📷</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✅  {toast.message}</Text>
        </View>
      )}

      {/* Modais */}
      <ProductDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={handleItemUpdated}
        onDeleted={handleItemDeleted}
      />
      <AddProductModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleItemAdded}
      />
      <ReceiptScanModal
        visible={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onAdded={handleReceiptAdded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 22 },
  listContent: { padding: 16, paddingBottom: 100 },

  // Secção urgente
  urgentCard: {
    backgroundColor: Colors.urgentRedLight, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#FECACA',
  },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urgentEmoji: { fontSize: 18 },
  urgentTitle: { fontSize: 15, fontWeight: '700', color: Colors.urgentRed },
  urgentBadge: {
    backgroundColor: Colors.urgentRed, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  urgentBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  urgentChevron: { fontSize: 12, color: Colors.urgentRed },
  urgentList: { marginTop: 12, gap: 8 },
  urgentItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  urgentItemName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  urgentItemExpiry: { fontSize: 13, color: Colors.urgentRed, fontWeight: '600' },

  // Secção por local
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8,
  },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sectionCount: {
    fontSize: 13, color: Colors.textSecondary,
    backgroundColor: Colors.borderLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  chevron: { fontSize: 12, color: Colors.textMuted },
  emptySection: { fontSize: 13, color: Colors.textMuted, paddingLeft: 8, paddingBottom: 8 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

  // FABs
  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: Colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  fabScan: {
    position: 'absolute', bottom: 90, right: 86,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,
    elevation: 5,
  },
  fabScanText: { fontSize: 24 },

  // Toast
  toast: {
    position: 'absolute', bottom: 160, left: 20, right: 20,
    backgroundColor: Colors.textPrimary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8,
  },
  toastText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
});
