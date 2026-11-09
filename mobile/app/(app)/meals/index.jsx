import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { mealsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import MealCard from '../../../components/meals/MealCard';
import ServingsSetup from '../../../components/meals/ServingsSetup';
import AddRecipeModal from '../../../components/meals/AddRecipeModal';
import MealDetailModal from '../../../components/meals/MealDetailModal';
import MealHistoryModal from '../../../components/meals/MealHistoryModal';
import { Colors } from '../../../constants/colors';

// ── Tipos de refeição ─────────────────────────────────────────────────────────

const MEAL_TYPES = [
  { key: null,             label: 'Todos' },
  { key: 'pequeno-almoco', label: '🌅 Pequeno-almoço' },
  { key: 'lunch_dinner',   label: '🍽 Almoço/Jantar' },
  { key: 'snack',          label: '🍎 Snack' },
];

// ── Filtros diretos ───────────────────────────────────────────────────────────

const DIRECT_FILTERS = [
  { key: 'tudo',      label: 'Tudo' },
  { key: 'tens_tudo', label: 'Tenho tudo' },
  { key: 'urgentes',  label: '⚠️ Urgentes' },
  { key: 'rapidas',   label: '⏱ Rápidas' },
  { key: 'minhas',    label: '👤 Minhas' },
];

const REGIME_OPTIONS = [
  { key: 'carne',       label: '🥩 Com carne',    shortLabel: 'Carne' },
  { key: 'peixe',       label: '🐟 Com peixe',    shortLabel: 'Peixe' },
  { key: 'vegetariano', label: '🥦 Vegetariano',  shortLabel: 'Veg.' },
  { key: 'vegano',      label: '🌱 Vegano',        shortLabel: 'Vegano' },
  { key: 'sem_lactose', label: '🥛 Sem lactose',  shortLabel: 'S/Lact.' },
  { key: 'sem_gluten',  label: '🌾 Sem glúten',   shortLabel: 'S/Glút.' },
];

const APARELHOS_OPTIONS = [
  { key: 'airfryer',  label: '🔥 Airfryer',      shortLabel: 'Airfryer' },
  { key: 'oven',      label: '♨️ Forno',          shortLabel: 'Forno' },
  { key: 'stove',     label: '🫕 Fogão',          shortLabel: 'Fogão' },
  { key: 'microwave', label: '📡 Micro-ondas',    shortLabel: 'Micro' },
  { key: 'no_cook',   label: '🥗 Sem cozinhar',  shortLabel: 'S/cozinhar' },
];

const REGIME_KEYS    = new Set(REGIME_OPTIONS.map((o) => o.key));
const APARELHOS_KEYS = new Set(APARELHOS_OPTIONS.map((o) => o.key));

// ── Barra de filtros ──────────────────────────────────────────────────────────

function FilterBar({ activeFilter, openSubmenu, onFilterChange, onSubmenuChange }) {
  const isRegimeActive    = REGIME_KEYS.has(activeFilter);
  const isAparelhosActive = APARELHOS_KEYS.has(activeFilter);

  const regimeShort    = REGIME_OPTIONS.find((o) => o.key === activeFilter)?.shortLabel;
  const aparelhosShort = APARELHOS_OPTIONS.find((o) => o.key === activeFilter)?.shortLabel;

  const handleDirect = (key) => {
    onSubmenuChange(null);
    onFilterChange((prev) => (prev === key ? 'tudo' : key));
  };

  const handleMenuToggle = (menu) => {
    onSubmenuChange((prev) => (prev === menu ? null : menu));
  };

  const handleSubOption = (key) => {
    onFilterChange((prev) => (prev === key ? 'tudo' : key));
    onSubmenuChange(null);
  };

  const submenuOptions = openSubmenu === 'regime' ? REGIME_OPTIONS
                       : openSubmenu === 'aparelhos' ? APARELHOS_OPTIONS
                       : [];

  return (
    <View style={styles.filterWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {DIRECT_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, activeFilter === f.key && styles.chipActive]}
            onPress={() => handleDirect(f.key)}
          >
            <Text style={[styles.chipLabel, activeFilter === f.key && styles.chipLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.chip, styles.chipMenu,
            (isRegimeActive || openSubmenu === 'regime') && styles.chipActive,
          ]}
          onPress={() => handleMenuToggle('regime')}
        >
          <Text style={[
            styles.chipLabel,
            (isRegimeActive || openSubmenu === 'regime') && styles.chipLabelActive,
          ]}>
            {isRegimeActive ? `Regime: ${regimeShort}` : 'Regime'}{' '}
            <Text style={styles.chevron}>{openSubmenu === 'regime' ? '▴' : '▾'}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.chip, styles.chipMenu,
            (isAparelhosActive || openSubmenu === 'aparelhos') && styles.chipActive,
          ]}
          onPress={() => handleMenuToggle('aparelhos')}
        >
          <Text style={[
            styles.chipLabel,
            (isAparelhosActive || openSubmenu === 'aparelhos') && styles.chipLabelActive,
          ]}>
            {isAparelhosActive ? `Aparelhos: ${aparelhosShort}` : 'Aparelhos'}{' '}
            <Text style={styles.chevron}>{openSubmenu === 'aparelhos' ? '▴' : '▾'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {openSubmenu && (
        <View style={styles.submenuPanel}>
          <View style={styles.submenuChips}>
            {submenuOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.submenuChip, activeFilter === opt.key && styles.submenuChipActive]}
                onPress={() => handleSubOption(opt.key)}
              >
                <Text style={[
                  styles.submenuChipLabel,
                  activeFilter === opt.key && styles.submenuChipLabelActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Seletor de tipo de refeição ───────────────────────────────────────────────

function MealTypeSelector({ selected, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.mealTypeRow}
    >
      {MEAL_TYPES.map((t) => (
        <TouchableOpacity
          key={String(t.key)}
          style={[styles.mealTypeChip, selected === t.key && styles.mealTypeChipActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[styles.mealTypeLabel, selected === t.key && styles.mealTypeLabelActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Lógica de filtragem ───────────────────────────────────────────────────────

const REFRESH_COOLDOWN = 30000;

function applyFilter(meals, filter) {
  if (filter === 'tudo') return meals;
  if (filter === 'tens_tudo') return meals.filter((m) =>
    m.availabilityBadge === 'Tens tudo' || m.availabilityBadge === 'Tens o essencial'
  );
  if (filter === 'urgentes') return meals.filter((m) => m.usesUrgentItems);
  if (filter === 'rapidas')  return meals.filter((m) => { const min = parseInt(m.time); return !isNaN(min) && min <= 20; });
  if (filter === 'minhas')   return meals.filter((m) => m.source === 'user');
  if (filter === 'carne')       return meals.filter((m) => m.dietaryTags?.hasMeat   || m.tags?.includes('carne'));
  if (filter === 'peixe')       return meals.filter((m) => m.dietaryTags?.hasFish   || m.tags?.includes('peixe'));
  if (filter === 'vegetariano') return meals.filter((m) => !m.dietaryTags?.hasMeat);
  if (filter === 'vegano')      return meals.filter((m) => !m.dietaryTags?.hasMeat && !m.dietaryTags?.hasFish && !m.dietaryTags?.hasLactose);
  if (filter === 'sem_lactose') return meals.filter((m) => !m.dietaryTags?.hasLactose);
  if (filter === 'sem_gluten')  return meals.filter((m) => !m.dietaryTags?.hasGluten);
  if (filter === 'airfryer')  return meals.filter((m) => m.cookingMethod === 'airfryer');
  if (filter === 'oven')      return meals.filter((m) => m.cookingMethod === 'oven');
  if (filter === 'stove')     return meals.filter((m) => m.cookingMethod === 'stove');
  if (filter === 'microwave') return meals.filter((m) => m.cookingMethod === 'microwave');
  if (filter === 'no_cook')   return meals.filter((m) => m.cookingMethod === 'no_cook');
  return meals;
}

// ── Ecrã principal ────────────────────────────────────────────────────────────

export default function MealsScreen() {
  const { user, updateUser } = useAuth();
  const [meals, setMeals]               = useState([]);
  const [subtitle, setSubtitle]         = useState('');
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [tooFewItems, setTooFewItems]   = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showAddRecipe, setShowAddRecipe]   = useState(false);
  const [showHistory, setShowHistory]       = useState(false);
  const lastRefreshRef = useRef(0);

  const [setupDone, setSetupDone]       = useState(false);
  const [activeFilter, setActiveFilter] = useState('tudo');
  const [openSubmenu, setOpenSubmenu]   = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(user?.mealType || null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [fitnessTargets, setFitnessTargets]   = useState(null);
  const [dailyLog, setDailyLog]               = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (silent = false, mealTypeOverride) => {
    if (!silent) setLoading(true);
    const typeToFetch = mealTypeOverride !== undefined ? mealTypeOverride : selectedMealType;
    try {
      const res = await mealsAPI.getSuggestions(typeToFetch);
      setMeals(res.data.meals || []);
      setSubtitle(res.data.subtitle || '');
      setTooFewItems(res.data.tooFewItems || false);
      if (res.data.fitnessProfile) setFitnessTargets(res.data.fitnessProfile);
      if (res.data.dailyNutritionLog) setDailyLog(res.data.dailyNutritionLog);
    } catch (err) {
      if (!silent) Alert.alert('Erro', 'Não foi possível carregar sugestões.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMealType]);

  // Manter referência à função de fetch para evitar deps desatualizadas no useFocusEffect
  const fetchRef = useRef(fetchSuggestions);
  useEffect(() => { fetchRef.current = fetchSuggestions; }, [fetchSuggestions]);

  useFocusEffect(
    useCallback(() => {
      setActiveFilter('tudo');
      setOpenSubmenu(null);
      if (user?.mealServings) {
        // Configuração já feita — saltar setup e atualizar sugestões silenciosamente
        setSetupDone(true);
        fetchRef.current(true);
      } else {
        setSetupDone(false);
        setLoading(false);
      }
      return () => {};
    }, [user?.mealServings])
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleServingsSet = async (servings) => {
    try {
      await mealsAPI.setServings(servings);
      await updateUser({ mealServings: servings });
      setSetupDone(true);
      setActiveFilter('tudo');
      fetchSuggestions(false, selectedMealType);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível guardar a configuração.');
    }
  };

  const handleMealTypeChange = async (type) => {
    setSelectedMealType(type);
    setMeals([]);
    setLoading(true);
    // Guardar preferência no backend (assíncrono, sem bloquear UI)
    if (type) {
      mealsAPI.setMealType(type).catch(() => {});
    }
    try {
      const res = await mealsAPI.getSuggestions(type);
      setMeals(res.data.meals || []);
      setSubtitle(res.data.subtitle || '');
      setTooFewItems(res.data.tooFewItems || false);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar sugestões.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_COOLDOWN) {
      const remaining = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshRef.current)) / 1000);
      Alert.alert('Aguarda', `Podes atualizar novamente em ${remaining} segundos.`);
      return;
    }
    lastRefreshRef.current = now;
    setRefreshing(true);
    fetchSuggestions(true);
  };

  const handleMealDone = () => {
    setSelectedMeal(null);
    fetchSuggestions(true);
  };

  const filtered = applyFilter(meals, activeFilter);

  // ── Setup ──────────────────────────────────────────────────────────────────

  if (!setupDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Refeições</Text>
        </View>
        <ServingsSetup
          initialServings={user?.mealServings || null}
          onConfirm={handleServingsSet}
          onAddRecipe={() => setShowAddRecipe(true)}
        />
        <AddRecipeModal
          visible={showAddRecipe}
          onClose={() => setShowAddRecipe(false)}
          onAdded={() => setShowAddRecipe(false)}
        />
      </SafeAreaView>
    );
  }

  // ── Sugestões ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>O que cozinhar?</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowAddRecipe(true)} style={styles.headerBtn}>
            <Text style={styles.headerBtnIcon}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.headerBtn}>
            <Text style={styles.headerBtnIcon}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn}>
            <Text style={styles.headerBtnIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor de tipo de refeição */}
      <View style={styles.mealTypeWrapper}>
        <MealTypeSelector selected={selectedMealType} onChange={handleMealTypeChange} />
      </View>

      {/* Barra de filtros */}
      <FilterBar
        activeFilter={activeFilter}
        openSubmenu={openSubmenu}
        onFilterChange={setActiveFilter}
        onSubmenuChange={setOpenSubmenu}
      />

      {/* Lista */}
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onScrollBeginDrag={() => setOpenSubmenu(null)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <MealCard meal={item} onPress={() => { setOpenSubmenu(null); setSelectedMeal(item); }} />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍳</Text>
              <Text style={styles.emptyText}>A procurar as melhores receitas…</Text>
            </View>
          ) : tooFewItems ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>Poucos produtos no inventário</Text>
              <Text style={styles.emptyText}>Adiciona pelo menos 3 produtos para receber sugestões.</Text>
            </View>
          ) : filtered.length === 0 && meals.length > 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nenhuma receita encontrada</Text>
              <Text style={styles.emptyText}>com este filtro.</Text>
              <TouchableOpacity
                onPress={() => { setActiveFilter('tudo'); setOpenSubmenu(null); }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>Ver todas</Text>
              </TouchableOpacity>
            </View>
          ) : meals.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍽</Text>
              <Text style={styles.emptyTitle}>Nenhuma sugestão disponível</Text>
              <Text style={styles.emptyText}>
                Não encontrámos receitas adequadas ao tipo de refeição e às tuas restrições com o inventário atual.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <MealDetailModal
        visible={!!selectedMeal}
        meal={selectedMeal}
        servings={user?.mealServings || 2}
        onClose={() => setSelectedMeal(null)}
        onDone={handleMealDone}
        onEditRecipe={(meal) => { setSelectedMeal(null); setEditingRecipe(meal); }}
        dailyLog={dailyLog}
        targets={fitnessTargets}
      />
      <AddRecipeModal
        visible={showAddRecipe || !!editingRecipe}
        editRecipe={editingRecipe}
        onClose={() => { setShowAddRecipe(false); setEditingRecipe(null); }}
        onAdded={() => { setShowAddRecipe(false); setEditingRecipe(null); fetchSuggestions(true); }}
      />
      <MealHistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn: { padding: 8 },
  headerBtnIcon: { fontSize: 20 },

  // Seletor de tipo de refeição
  mealTypeWrapper: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  mealTypeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  mealTypeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  mealTypeChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  mealTypeLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  mealTypeLabelActive: { color: Colors.primaryDark, fontWeight: '700' },

  // Filter bar
  filterWrapper: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  chipsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipMenu: { paddingHorizontal: 12 },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
  chevron: { fontSize: 10 },

  submenuPanel: {
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  submenuChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submenuChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  submenuChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  submenuChipLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  submenuChipLabelActive: { color: Colors.primaryDark, fontWeight: '700' },

  list: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  resetBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 20 },
  resetBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
});
