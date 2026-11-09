import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Linking, Platform, RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { placesAPI } from '../../services/api';
import { Colors } from '../../constants/colors';

// ── Constantes ────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',          label: 'Todos' },
  { key: 'Supermercado', label: 'Supermercado' },
  { key: 'Hipermercado', label: 'Hipermercado' },
  { key: 'Mercado',      label: 'Mercado' },
  { key: 'Minimercado',  label: 'Minimercado' },
  { key: 'open',         label: 'Aberto agora' },
];

// ── Store Card ────────────────────────────────────────────────────────────────
function StoreCard({ store, listCount, listEstimate }) {
  const handleDirections = () => {
    const label = encodeURIComponent(store.name);
    const { lat, lng } = store;
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${label}`,
    });
    const fallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${store.placeId}`;
    Linking.canOpenURL(url)
      .then((ok) => Linking.openURL(ok ? url : fallback))
      .catch(() => Linking.openURL(fallback));
  };

  const typeColors = {
    Supermercado: { bg: Colors.primaryLight,    text: Colors.primaryDark },
    Hipermercado: { bg: Colors.stockBlueLight,  text: Colors.stockBlue },
    Mercado:      { bg: Colors.secondaryLight,  text: Colors.secondary },
    Minimercado:  { bg: Colors.warnYellowLight, text: Colors.warnYellow },
  };
  const typeColor = typeColors[store.type] || typeColors.Supermercado;

  return (
    <View style={cardSt.card}>
      {/* Linha superior: nome + distância */}
      <View style={cardSt.topRow}>
        <View style={cardSt.nameWrap}>
          <Text style={cardSt.name} numberOfLines={1}>{store.name}</Text>
          <View style={[cardSt.typeBadge, { backgroundColor: typeColor.bg }]}>
            <Text style={[cardSt.typeText, { color: typeColor.text }]}>{store.type}</Text>
          </View>
        </View>
        {store.distance && (
          <Text style={cardSt.distance}>{store.distance}</Text>
        )}
      </View>

      {/* Endereço */}
      {store.address ? (
        <Text style={cardSt.address} numberOfLines={1}>{store.address}</Text>
      ) : null}

      {/* Linha do meio: horário + rating */}
      <View style={cardSt.midRow}>
        {store.hoursLabel && (
          <Text style={[cardSt.hours, store.isOpen ? cardSt.hoursOpen : cardSt.hoursClosed]}>
            {store.isOpen ? '● ' : '○ '}{store.hoursLabel}
          </Text>
        )}
        {store.rating && (
          <Text style={cardSt.rating}>⭐ {store.rating.toFixed(1)}</Text>
        )}
      </View>

      {/* Badge lista de compras */}
      {listCount > 0 && (
        <View style={cardSt.listBadge}>
          <Text style={cardSt.listBadgeText}>
            🛒 A tua lista tem {listCount} produto{listCount !== 1 ? 's' : ''}
            {listEstimate ? `  ·  ~${listEstimate}€` : ''}
          </Text>
        </View>
      )}

      {/* Botão direções */}
      <TouchableOpacity style={cardSt.dirBtn} onPress={handleDirections} activeOpacity={0.8}>
        <Text style={cardSt.dirBtnText}>🗺  Como chegar</Text>
      </TouchableOpacity>
    </View>
  );
}

const cardSt = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  nameWrap: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11, fontWeight: '600' },
  distance: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginLeft: 12, marginTop: 2 },
  address: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  midRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  hours: { fontSize: 13, fontWeight: '500', flex: 1 },
  hoursOpen: { color: Colors.okGreen },
  hoursClosed: { color: Colors.textMuted },
  rating: { fontSize: 13, color: Colors.textSecondary },
  listBadge: {
    backgroundColor: Colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
  },
  listBadgeText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '500' },
  dirBtn: {
    backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 10, alignItems: 'center',
  },
  dirBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
});

// ── Modal principal ───────────────────────────────────────────────────────────
export default function StoresModal({ visible, onClose, listCount = 0, listEstimate = null }) {
  const [step, setStep] = useState('loading'); // 'loading' | 'permission' | 'list' | 'error'
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [filter, setFilter] = useState('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [radius, setRadius] = useState(2000);
  const [refreshing, setRefreshing] = useState(false);

  const loadStores = useCallback(async (searchRadius = 2000, silent = false) => {
    if (!silent) setStep('loading');

    // Verificar permissão de localização
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      setStep('permission');
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const res = await placesAPI.getNearby(latitude, longitude, searchRadius);
      const places = res.data?.places || [];

      setStores(places);
      setRadius(searchRadius);
      setStep(places.length === 0 ? 'empty' : 'list');
    } catch (err) {
      const msg = err?.code === 'NETWORK_ERROR'
        ? 'Sem ligação. Não é possível carregar lojas.'
        : 'Não foi possível carregar as lojas. Tenta novamente.';
      setErrorMsg(msg);
      setStep('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      loadStores(radius);
    } else {
      setStep('permission');
    }
  };

  // Carregar ao abrir
  useEffect(() => {
    if (visible) {
      setFilter('all');
      setRadius(2000);
      loadStores(2000);
    }
  }, [visible]);

  // Aplicar filtro
  useEffect(() => {
    if (filter === 'all') {
      setFilteredStores(stores);
    } else if (filter === 'open') {
      setFilteredStores(stores.filter((s) => s.isOpen === true));
    } else {
      setFilteredStores(stores.filter((s) => s.type === filter));
    }
  }, [filter, stores]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStores(radius, true);
  };

  const handleClose = () => {
    setStep('loading');
    setStores([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={st.safe}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={handleClose} style={st.closeBtn}>
            <Text style={st.closeIcon}>←</Text>
          </TouchableOpacity>
          <Text style={st.title}>Lojas perto de mim</Text>
          <View style={st.closeBtn} />
        </View>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <View style={st.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={st.loadingText}>A localizar lojas…</Text>
          </View>
        )}

        {/* ── Sem permissão ────────────────────────────────────────────────── */}
        {step === 'permission' && (
          <View style={st.center}>
            <Text style={st.permEmoji}>📍</Text>
            <Text style={st.permTitle}>Localização necessária</Text>
            <Text style={st.permSub}>
              Precisamos da tua localização para encontrar lojas perto de ti.
            </Text>
            <TouchableOpacity style={st.permBtn} onPress={requestPermission}>
              <Text style={st.permBtnText}>Ativar localização</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Erro ─────────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <View style={st.center}>
            <Text style={st.permEmoji}>😕</Text>
            <Text style={st.permTitle}>Não foi possível carregar</Text>
            <Text style={st.permSub}>{errorMsg}</Text>
            <TouchableOpacity style={st.permBtn} onPress={() => loadStores(radius)}>
              <Text style={st.permBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sem resultados ───────────────────────────────────────────────── */}
        {step === 'empty' && (
          <View style={st.center}>
            <Text style={st.permEmoji}>🏪</Text>
            <Text style={st.permTitle}>Nenhuma loja encontrada</Text>
            <Text style={st.permSub}>
              Não encontrámos lojas num raio de {radius / 1000}km.
            </Text>
            {radius < 5000 && (
              <TouchableOpacity style={st.permBtn} onPress={() => loadStores(5000)}>
                <Text style={st.permBtnText}>Alargar para 5km</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Lista ────────────────────────────────────────────────────────── */}
        {step === 'list' && (
          <>
            {/* Filtros */}
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={st.filtersScroll} contentContainerStyle={st.filtersContent}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[st.filterChip, filter === f.key && st.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[st.filterText, filter === f.key && st.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Contagem */}
            <Text style={st.countText}>
              {filteredStores.length} loja{filteredStores.length !== 1 ? 's' : ''} · raio {radius / 1000}km
            </Text>

            <ScrollView
              style={st.list}
              contentContainerStyle={st.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
              }
            >
              {filteredStores.length === 0 ? (
                <Text style={st.emptyFilter}>Nenhuma loja com este filtro.</Text>
              ) : (
                filteredStores.map((store) => (
                  <StoreCard
                    key={store.placeId}
                    store={store}
                    listCount={listCount}
                    listEstimate={listEstimate}
                  />
                ))
              )}
              {radius < 5000 && filteredStores.length > 0 && (
                <TouchableOpacity style={st.expandBtn} onPress={() => loadStores(5000)}>
                  <Text style={st.expandText}>Mostrar num raio maior (5km)</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 40 },
  closeIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  // Centro (loading/permission/error/empty)
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 8 },
  permEmoji: { fontSize: 52, marginBottom: 4 },
  permTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  permBtn: {
    marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  permBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Filtros
  filtersScroll: { maxHeight: 52, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filtersContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  filterText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  filterTextActive: { color: Colors.primaryDark, fontWeight: '700' },

  // Contagem
  countText: {
    fontSize: 12, color: Colors.textMuted, paddingHorizontal: 16,
    paddingVertical: 8, backgroundColor: Colors.background,
  },

  // Lista
  list: { flex: 1 },
  listContent: { padding: 14 },
  emptyFilter: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 32 },

  expandBtn: {
    alignItems: 'center', paddingVertical: 14,
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4,
  },
  expandText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
