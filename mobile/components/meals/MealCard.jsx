import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';

const SOURCE_LABELS = {
  user: 'Tua receita',
  suggested: 'Recomendada',
  web: 'Da web',
};

const SOURCE_COLORS = {
  user: { bg: Colors.primaryLight, text: Colors.primaryDark },
  suggested: { bg: Colors.stockBlueLight, text: Colors.stockBlue },
  web: { bg: Colors.secondaryLight, text: Colors.secondary },
};

const MEAL_TYPE_LABELS = {
  'breakfast':      '🌅 Peq.-almoço',
  'lunch_dinner':   '🍽 Almoço/Jantar',
  'pequeno-almoco': '🌅 Peq.-almoço',
  'almoco':         '☀️ Almoço',
  'jantar':         '🌙 Jantar',
  'snack':          '🍎 Snack',
  'rapida':         '⚡ Rápida',
};

const DIFFICULTY_EMOJI = { 'fácil': '🟢', 'médio': '🟡', 'difícil': '🔴' };

const COOKING_METHOD_LABELS = {
  airfryer: '🔥 Airfryer',
  oven: '♨️ Forno',
  stove: '🫕 Fogão',
  microwave: '📡 Micro-ondas',
  no_cook: '🥗 Sem cozinhar',
};

function AvailabilityBadge({ badge }) {
  const isAll = badge === 'Tens tudo';
  const isEssential = badge === 'Tens o essencial';
  const isMissing = badge?.includes('Falta');

  let bg, textColor;
  if (isAll) {
    bg = Colors.okGreenLight;
    textColor = Colors.okGreen;
  } else if (isEssential) {
    bg = Colors.primaryLight;
    textColor = Colors.primaryDark;
  } else if (isMissing) {
    bg = Colors.warnYellowLight;
    textColor = Colors.warnYellow;
  } else {
    bg = Colors.urgentRedLight;
    textColor = Colors.urgentRed;
  }

  return (
    <View style={[styles.availBadge, { backgroundColor: bg }]}>
      <Text style={[styles.availText, { color: textColor }]}>{badge}</Text>
    </View>
  );
}

export default function MealCard({ meal, onPress }) {
  const { user } = useAuth();
  const isFitness = user?.mode === 'fitness';
  const sourceColor = SOURCE_COLORS[meal.source] || SOURCE_COLORS.suggested;
  const showIncompleteBadge = meal.mealType === 'lunch_dinner' && meal.isCompleteMeal === false;
  const mealTypeLabel = MEAL_TYPE_LABELS[meal.mealType];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header badges */}
      <View style={styles.topRow}>
        <View style={[styles.sourceBadge, { backgroundColor: sourceColor.bg }]}>
          <Text style={[styles.sourceText, { color: sourceColor.text }]}>
            {SOURCE_LABELS[meal.source] || 'Recomendada'}
          </Text>
        </View>
        {mealTypeLabel && (
          <View style={styles.mealTypeBadge}>
            <Text style={styles.mealTypeText}>{mealTypeLabel}</Text>
          </View>
        )}
        {meal.usesUrgentItems && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>⚠️ Produto urgente</Text>
          </View>
        )}
        {meal.mealType === 'lunch_dinner' && meal.isCompleteMeal && (
          <View style={styles.completeBadge}>
            <Text style={styles.completeText}>✓ Completa</Text>
          </View>
        )}
      </View>

      {/* Nome */}
      <Text style={styles.name}>{meal.name}</Text>

      {/* Meta */}
      <View style={styles.metaRow}>
        {meal.time ? <Text style={styles.meta}>⏱ {meal.time}</Text> : null}
        {meal.difficulty ? (
          <Text style={styles.meta}>
            {DIFFICULTY_EMOJI[meal.difficulty] || '🟡'} {meal.difficulty}
          </Text>
        ) : null}
        {meal.servings ? <Text style={styles.meta}>👥 {meal.servings} p.</Text> : null}
        {meal.cookingMethod && COOKING_METHOD_LABELS[meal.cookingMethod] ? (
          <Text style={styles.meta}>{COOKING_METHOD_LABELS[meal.cookingMethod]}</Text>
        ) : null}
      </View>

      {/* Badge dietético (o mais restritivo que se aplica) */}
      {meal.dietaryTags && (() => {
        const { hasMeat, hasFish, hasLactose } = meal.dietaryTags;
        if (hasMeat === undefined) return null;
        let label = null;
        if (!hasMeat && !hasFish && !hasLactose) label = '🌱 Vegano';
        else if (!hasMeat && !hasFish) label = '🥦 Vegetariano';
        if (!label) return null;
        return (
          <View style={styles.dietRow}>
            <View style={styles.dietBadge}>
              <Text style={styles.dietText}>{label}</Text>
            </View>
          </View>
        );
      })()}

      {/* Disponibilidade */}
      {meal.availabilityBadge ? <AvailabilityBadge badge={meal.availabilityBadge} /> : null}

      {showIncompleteBadge && (
        <View style={styles.incompleteBadge}>
          <Text style={styles.incompleteText}>⚠️ Pode precisar de acompanhamento</Text>
        </View>
      )}

      {/* Fitness: calorias + proteína — só visível em modo fitness */}
      {isFitness && meal.calories > 0 && (
        <View style={styles.fitnessRow}>
          <Text style={styles.fitnessCal}>🔥 {meal.calories} kcal</Text>
          {meal.macros && (
            <Text style={styles.fitnessMacro}>P {meal.macros.protein}g</Text>
          )}
        </View>
      )}

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  topRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  sourceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourceText: { fontSize: 12, fontWeight: '600' },
  mealTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.borderLight },
  mealTypeText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.warnYellowLight },
  urgentText: { fontSize: 12, fontWeight: '600', color: Colors.warnYellow },
  completeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.okGreenLight },
  completeText: { fontSize: 12, fontWeight: '600', color: Colors.okGreen },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 8, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: Colors.textSecondary },
  dietRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 8 },
  dietBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: Colors.okGreenLight },
  dietText: { fontSize: 11, fontWeight: '500', color: Colors.okGreen },
  availBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  availText: { fontSize: 12, fontWeight: '600' },
  incompleteBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 8, backgroundColor: Colors.warnYellowLight,
  },
  incompleteText: { fontSize: 12, fontWeight: '500', color: Colors.warnYellow },
  ingredientsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  ingText: { fontSize: 12, fontWeight: '500' },
  moreText: { fontSize: 12, color: Colors.textMuted, alignSelf: 'center' },
  fitnessRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  fitnessCal: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  fitnessMacro: { fontSize: 12, color: Colors.textSecondary },
  fitnessBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fitnessBadgeText: { fontSize: 11, fontWeight: '700' },
});
