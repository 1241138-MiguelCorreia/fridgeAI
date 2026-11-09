import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, TextInput,
} from 'react-native';
import { mealsAPI } from '../../services/api';
import Button from '../ui/Button';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';

// ── Helpers de quantidade ─────────────────────────────────────────────────────

function splitAmount(str) {
  if (!str || typeof str !== 'string') return { valueStr: '', unit: '' };
  const s = str.trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)/);
  if (m && m[1]) return { valueStr: m[1], unit: m[2].trim() };
  return { valueStr: '', unit: s };
}

// 'noquant' → sem número (sal, especiarias, vinho a gosto)
// 'unit'    → contável (ovos, batatas — unit vazia ou "un.")
// 'quant'   → mensurável (g, kg, ml, L, …)
function ingKind(amount) {
  const { valueStr, unit } = splitAmount(amount);
  if (!valueStr) return 'noquant';
  const u = unit.toLowerCase();
  if (!u || u === 'un.' || u === 'un' || u === 'unidade' || u === 'unidades') return 'unit';
  return 'quant';
}

function filterNumeric(v) {
  const clean = v.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

const WEIGHT_UNITS = new Set(['g', 'gr', 'grama', 'gramas', 'kg', 'kilo']);
const VOLUME_UNITS = new Set(['ml', 'cl', 'dl', 'l', 'litro', 'litros']);
const CONTAINER_UNITS = new Set(['lata', 'latas', 'pacote', 'pacotes', 'frasco', 'frascos', 'garrafa', 'garrafas', 'caixa', 'caixas', 'saqueta', 'saquetas']);

function unitCategory(unit) {
  const u = (unit || '').toLowerCase().trim();
  if (WEIGHT_UNITS.has(u)) return 'weight';
  if (VOLUME_UNITS.has(u)) return 'volume';
  if (CONTAINER_UNITS.has(u)) return 'container';
  return 'other';
}

function unitsCompatible(a, b) {
  const ca = unitCategory(a);
  const cb = unitCategory(b);
  if (ca === 'other' || cb === 'other') return true;
  return ca === cb;
}

// When recipe and inventory use incompatible units (e.g. "1 lata" vs "120g"),
// fall back to the inventory's own quantity so subtractQuantity can reconcile it.
function resolveAmountDisplay(ing) {
  const { unit: recipeUnit } = splitAmount(ing.amount || '');
  const { unit: invUnit } = splitAmount(ing.inventoryQuantity || '');
  if (ing.inventoryQuantity && invUnit && !unitsCompatible(recipeUnit, invUnit)) {
    return { effectiveAmount: ing.inventoryQuantity, useInventoryUnits: true };
  }
  return { effectiveAmount: ing.amount || '', useInventoryUnits: false };
}

const SOURCE_LABELS = { user: 'Tua receita', suggested: 'Recomendada', web: 'Da web' };
const DIFFICULTY_EMOJI = { 'fácil': '🟢', 'médio': '🟡', 'difícil': '🔴' };
const MEAL_TYPE_LABELS = {
  breakfast: '🌅 Pequeno-almoço',
  lunch_dinner: '🍽 Almoço/Jantar',
  'pequeno-almoco': '🌅 Pequeno-almoço',
  almoco: '☀️ Almoço',
  jantar: '🌙 Jantar',
  snack: '🍎 Snack',
  rapida: '⚡ Rápida',
};

// ── Linha de uso (marcar como feita) ─────────────────────────────────────────
function IngUsageRow({ ing, optional, included = true, onToggleInclude, valueStr, onChangeValue }) {
  const { effectiveAmount } = resolveAmountDisplay(ing);
  const { unit } = splitAmount(effectiveAmount);
  const kind = ingKind(effectiveAmount);
  const active = !optional || included;

  return (
    <View style={[styles.usageRow, !active && styles.usageRowExcluded]}>
      {/* Lado esquerdo: (toggle) + nome */}
      {optional ? (
        <TouchableOpacity style={styles.usageIngLeft} onPress={onToggleInclude} activeOpacity={0.7}>
          <Text style={[styles.optionalCheck, included && styles.optionalCheckActive]}>
            {included ? '✓' : '○'}
          </Text>
          <Text style={[styles.usageIngName, !included && styles.usageIngNameExcluded]} numberOfLines={1}>
            {ing.name}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.usageIngName} numberOfLines={1}>{ing.name}</Text>
      )}

      {/* Lado direito: input de quantidade */}
      {kind === 'noquant' ? (
        <View style={styles.aGostoBadge}>
          <Text style={styles.aGostoText}>A gosto</Text>
        </View>
      ) : (
        <View style={[styles.amountBox, !active && styles.amountBoxDisabled]}>
          <TextInput
            style={styles.amountInput}
            value={valueStr}
            onChangeText={onChangeValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            editable={active}
            selectTextOnFocus
          />
          {unit ? <Text style={styles.unitLabel}>{unit}</Text> : null}
        </View>
      )}
    </View>
  );
}

function IngredientRow({ ing }) {
  const hasIt      = ing.hasIt;
  const isInsuff   = !!ing.insufficientQty;
  const isUrgent   = ing.urgent;
  const isOpen     = ing.state === 'aberto';
  const willOpen   = hasIt && !isInsuff && ing.state === 'fechado';
  const isOptional = ing.optional || ing.required === false;

  let statusLabel, statusBg, statusColor;
  if (isInsuff) {
    statusLabel = isOptional ? 'Opcional — insuficiente' : 'Insuficiente';
    statusBg    = Colors.warnYellowLight;
    statusColor = Colors.warnYellow;
  } else if (isOptional) {
    statusLabel = hasIt ? 'Opcional — tens' : 'Opcional';
    statusBg    = hasIt ? Colors.primaryLight : Colors.borderLight;
    statusColor = hasIt ? Colors.primaryDark : Colors.textMuted;
  } else {
    statusLabel = hasIt ? 'Tens' : 'Falta';
    statusBg    = hasIt ? Colors.okGreenLight : Colors.urgentRedLight;
    statusColor = hasIt ? Colors.okGreen : Colors.urgentRed;
  }

  const icon = !hasIt ? (isOptional ? '○' : '❌') : isInsuff ? '⚠️' : (isOptional ? '◎' : '✅');

  return (
    <View style={[styles.ingRow, (isInsuff || !hasIt) && !isOptional && styles.ingRowMissing]}>
      <View style={styles.ingLeft}>
        <Text style={[styles.ingName, (isInsuff || !hasIt) && styles.ingNameMissing]}>
          {icon} {ing.name}
          {ing.amount ? ` — ${ing.amount}` : ''}
          {isInsuff && ing.inventoryQuantity ? ` (tens ${ing.inventoryQuantity})` : ''}
        </Text>
        <View style={styles.ingBadges}>
          <View style={[styles.badge, { backgroundColor: statusBg }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {isUrgent && (
            <View style={[styles.badge, { backgroundColor: Colors.warnYellowLight }]}>
              <Text style={[styles.badgeText, { color: Colors.warnYellow }]}>⚠️ Usar breve</Text>
            </View>
          )}
          {isOpen && (
            <View style={[styles.badge, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[styles.badgeText, { color: Colors.primaryDark }]}>Aberto</Text>
            </View>
          )}
          {willOpen && (
            <View style={[styles.badge, { backgroundColor: Colors.secondaryLight }]}>
              <Text style={[styles.badgeText, { color: Colors.secondary }]}>Ficará aberto</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function MealDetailModal({ visible, meal, servings, onClose, onDone, onEditRecipe, dailyLog, targets }) {
  const { user } = useAuth();
  const isFitness = user?.mode === 'fitness';
  const [view, setView]               = useState('detail'); // 'detail' | 'markdone'
  const [includedMap, setIncludedMap] = useState({});
  const [amountMap, setAmountMap]     = useState({});
  const [markLoading, setMarkLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setView('detail');
      setIncludedMap({});
      setAmountMap({});
    }
  }, [visible, meal?.id]);

  if (!meal) return null;

  const requiredIngredients = meal.ingredients?.filter((i) => i.required !== false) || meal.ingredients || [];
  const missingRequired     = requiredIngredients.filter((i) => !i.hasIt);
  const hasMissingRequired  = missingRequired.length > 0;

  const allIngredients    = meal.allIngredients || meal.ingredients || [];
  const requiredAvailable = allIngredients.filter((i) => i.hasIt && i.inventoryItemId && i.required !== false);
  const optionalAvailable = allIngredients.filter((i) => i.hasIt && i.inventoryItemId && i.required === false);
  const hasAny            = requiredAvailable.length > 0 || optionalAvailable.length > 0;

  // amountMap stores only the numeric part; unit comes from the recipe amount
  const getAmount = (id, numericFallback) =>
    amountMap[id] !== undefined ? amountMap[id] : (numericFallback || '');
  const setAmount = (id, val) => setAmountMap((p) => ({ ...p, [id]: filterNumeric(val) }));
  const isIncluded  = (id)           => includedMap[id] !== false;
  const toggleInclude = (id)         => setIncludedMap((p) => ({ ...p, [id]: p[id] === false ? true : false }));

  const handleClose = () => {
    if (view === 'markdone') { setView('detail'); return; }
    onClose();
  };

  const handleConfirmDone = async () => {
    setMarkLoading(true);
    try {
      const buildAmountUsed = (ing) => {
        const { effectiveAmount } = resolveAmountDisplay(ing);
        const { valueStr, unit } = splitAmount(effectiveAmount);
        const kind = ingKind(effectiveAmount);
        if (kind === 'noquant') return '';
        const num = getAmount(ing.inventoryItemId, valueStr);
        return num ? `${num}${unit}` : '';
      };

      const required = requiredAvailable.map((ing) => ({
        inventoryItemId: ing.inventoryItemId,
        amountUsed: buildAmountUsed(ing),
        name: ing.name,
        amount: ing.amount || '',
        urgent: ing.urgent || false,
      }));
      const optional = optionalAvailable
        .filter((ing) => isIncluded(ing.inventoryItemId))
        .map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          amountUsed: buildAmountUsed(ing),
          name: ing.name,
          amount: ing.amount || '',
          urgent: ing.urgent || false,
        }));

      await mealsAPI.completeMeal({
        mealId: meal.id || null,
        mealName: meal.name,
        mealType: meal.mealType || null,
        source: meal.source || 'suggested',
        servings: servings || meal.servings || 1,
        ingredientsUsed: [...required, ...optional],
        usedUrgentItems: meal.usesUrgentItems || false,
        urgentItemsUsed: meal.urgentItemsUsed || [],
        // Fitness: enviar calorias e macros se disponíveis
        calories: meal.calories || undefined,
        macros: meal.macros || undefined,
      });
      setView('detail');
      onDone?.();
      Alert.alert('✅ Refeição registada', 'Inventário atualizado automaticamente!');
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível atualizar o inventário.');
    } finally {
      setMarkLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerSideBtn}>
            <Text style={styles.cancelText}>{view === 'markdone' ? '← Voltar' : 'Fechar'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {view === 'markdone' ? 'Confirmar refeição' : meal.name}
          </Text>
          <View style={styles.headerSideBtn} />
        </View>

        {/* ── Vista: detalhe ── */}
        {view === 'detail' && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
              <View style={styles.hero}>
                <Text style={styles.heroEmoji}>🍳</Text>
              </View>

              <View style={styles.originRow}>
                <View style={[styles.sourceBadge, meal.source === 'user' && styles.sourceBadgeUser]}>
                  <Text style={[styles.sourceText, meal.source === 'user' && styles.sourceTextUser]}>
                    {SOURCE_LABELS[meal.source] || 'Recomendada'}
                  </Text>
                </View>
                {meal.mealType && MEAL_TYPE_LABELS[meal.mealType] && (
                  <View style={styles.mealTypeBadge}>
                    <Text style={styles.mealTypeText}>{MEAL_TYPE_LABELS[meal.mealType]}</Text>
                  </View>
                )}
                {meal.availabilityBadge && (
                  <Text style={styles.availText}>{meal.availabilityBadge}</Text>
                )}
              </View>

              {meal.mealType === 'lunch_dinner' && (
                <View style={[
                  styles.completenessBox,
                  meal.isCompleteMeal ? styles.completenessBoxOk : styles.completenessBoxWarn,
                ]}>
                  <Text style={[
                    styles.completenessText,
                    meal.isCompleteMeal ? styles.completenessTextOk : styles.completenessTextWarn,
                  ]}>
                    {meal.isCompleteMeal
                      ? `✓ Refeição completa — ${meal.mealCompletenessReason}`
                      : `⚠️ ${meal.mealCompletenessReason}`}
                  </Text>
                </View>
              )}

              <View style={styles.metaBox}>
                {meal.time ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaEmoji}>⏱</Text>
                    <Text style={styles.metaVal}>{meal.time}</Text>
                  </View>
                ) : null}
                {meal.difficulty ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaEmoji}>{DIFFICULTY_EMOJI[meal.difficulty] || '🟡'}</Text>
                    <Text style={styles.metaVal}>{meal.difficulty}</Text>
                  </View>
                ) : null}
                <View style={styles.metaItem}>
                  <Text style={styles.metaEmoji}>👥</Text>
                  <Text style={styles.metaVal}>{servings} pess.</Text>
                </View>
              </View>

              {/* ── Secção Fitness ── */}
              {isFitness && meal.calories != null && (
                <View style={styles.fitnessBox}>
                  <Text style={styles.fitnessSectionTitle}>Valores nutricionais</Text>
                  <View style={styles.fitnessRow}>
                    <View style={styles.fitnessMacroItem}>
                      <Text style={styles.fitnessMacroValue}>{meal.calories}</Text>
                      <Text style={styles.fitnessMacroLabel}>kcal</Text>
                    </View>
                    {meal.macros?.protein != null && (
                      <View style={styles.fitnessMacroItem}>
                        <Text style={[styles.fitnessMacroValue, { color: Colors.urgentRed }]}>{meal.macros.protein}g</Text>
                        <Text style={styles.fitnessMacroLabel}>proteína</Text>
                      </View>
                    )}
                    {meal.macros?.carbs != null && (
                      <View style={styles.fitnessMacroItem}>
                        <Text style={[styles.fitnessMacroValue, { color: Colors.warnYellow }]}>{meal.macros.carbs}g</Text>
                        <Text style={styles.fitnessMacroLabel}>hidratos</Text>
                      </View>
                    )}
                    {meal.macros?.fat != null && (
                      <View style={styles.fitnessMacroItem}>
                        <Text style={[styles.fitnessMacroValue, { color: Colors.stockBlue }]}>{meal.macros.fat}g</Text>
                        <Text style={styles.fitnessMacroLabel}>gordura</Text>
                      </View>
                    )}
                  </View>

                  {/* Impacto no dia */}
                  {targets?.dailyCaloriesTarget && dailyLog != null && (
                    <>
                      <Text style={[styles.fitnessSectionTitle, { marginTop: 12 }]}>Impacto no teu dia</Text>
                      {(() => {
                        const consumed  = dailyLog.caloriesConsumed || 0;
                        const target    = targets.dailyCaloriesTarget;
                        const after     = consumed + meal.calories;
                        const pAfter    = Math.min(1, after / target);
                        const overTarget = after > target;
                        const macros    = targets.macrosTarget || {};
                        const mcons     = dailyLog.macrosConsumed || {};
                        return (
                          <>
                            <View style={styles.fitnessImpactRow}>
                              <Text style={styles.fitnessImpactLabel}>Calorias</Text>
                              <Text style={[styles.fitnessImpactValue, overTarget && { color: Colors.urgentRed }]}>
                                {after} / {target} kcal
                              </Text>
                            </View>
                            <View style={styles.fitnessProgressBg}>
                              <View style={[styles.fitnessProgressFill, {
                                width: `${Math.round(pAfter * 100)}%`,
                                backgroundColor: overTarget ? Colors.urgentRed : Colors.primary,
                              }]} />
                            </View>
                            {meal.macros?.protein != null && macros.protein && (
                              <View style={[styles.fitnessImpactRow, { marginTop: 8 }]}>
                                <Text style={styles.fitnessImpactLabel}>Proteína</Text>
                                <Text style={styles.fitnessImpactValue}>
                                  {(mcons.protein || 0) + meal.macros.protein}g / {macros.protein}g
                                </Text>
                              </View>
                            )}
                            {meal.macros?.carbs != null && macros.carbs && (
                              <View style={styles.fitnessImpactRow}>
                                <Text style={styles.fitnessImpactLabel}>Hidratos</Text>
                                <Text style={styles.fitnessImpactValue}>
                                  {(mcons.carbs || 0) + meal.macros.carbs}g / {macros.carbs}g
                                </Text>
                              </View>
                            )}
                            {meal.macros?.fat != null && macros.fat && (
                              <View style={styles.fitnessImpactRow}>
                                <Text style={styles.fitnessImpactLabel}>Gordura</Text>
                                <Text style={styles.fitnessImpactValue}>
                                  {(mcons.fat || 0) + meal.macros.fat}g / {macros.fat}g
                                </Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </View>
              )}

              {meal.ingredients?.some((i) => i.hasIt && i.state === 'fechado') && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>
                    ⚠️ Alguns produtos fechados ficarão abertos — a validade será reduzida.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Obrigatórios</Text>
              {requiredIngredients.length > 0
                ? requiredIngredients.map((ing, i) => <IngredientRow key={i} ing={ing} />)
                : <Text style={styles.noIngText}>Sem ingredientes obrigatórios definidos.</Text>}

              {meal.optionalIngredients?.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Opcionais</Text>
                  {meal.optionalIngredients.map((ing, i) => (
                    <IngredientRow key={i} ing={{ ...ing, optional: true }} />
                  ))}
                </>
              )}

              {meal.urgentItemsUsed?.length > 0 && (
                <View style={styles.urgentBox}>
                  <Text style={styles.urgentBoxText}>
                    ⚠️ Esta receita usa: {meal.urgentItemsUsed.join(', ')} — que expiram em breve!
                  </Text>
                </View>
              )}

              {meal.instructions?.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Instruções</Text>
                  {meal.instructions.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{typeof step === 'object' ? step.step : i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>
                        {typeof step === 'object' ? step.text : step}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {meal.description ? <Text style={styles.description}>{meal.description}</Text> : null}
              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={styles.footer}>
              {meal.source === 'user' && (
                <TouchableOpacity style={styles.editBtn} onPress={() => onEditRecipe?.(meal)}>
                  <Text style={styles.editBtnText}>✏️ Editar receita</Text>
                </TouchableOpacity>
              )}
              {hasMissingRequired ? (
                <Button
                  title={`Faltam ${missingRequired.length} ingrediente${missingRequired.length > 1 ? 's' : ''} obrigatório${missingRequired.length > 1 ? 's' : ''}`}
                  variant="secondary"
                  onPress={() => Alert.alert(
                    'Ingredientes obrigatórios em falta',
                    missingRequired.map((i) => `• ${i.name}`).join('\n')
                  )}
                />
              ) : (
                <Button title="Marcar como feita ✓" onPress={() => setView('markdone')} />
              )}
            </View>
          </>
        )}

        {/* ── Vista: confirmar refeição ── */}
        {view === 'markdone' && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.doneSubtitle}>
                Ajusta as quantidades usadas. O inventário é atualizado automaticamente.
              </Text>

              {!hasAny ? (
                <Text style={styles.noIngText}>Nenhum ingrediente do inventário para atualizar.</Text>
              ) : (
                <>
                  {requiredAvailable.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>Obrigatórios</Text>
                      {requiredAvailable.map((ing) => (
                        <IngUsageRow
                          key={ing.inventoryItemId}
                          ing={ing}
                          valueStr={getAmount(ing.inventoryItemId, splitAmount(resolveAmountDisplay(ing).effectiveAmount).valueStr)}
                          onChangeValue={(v) => setAmount(ing.inventoryItemId, v)}
                        />
                      ))}
                    </>
                  )}

                  {optionalAvailable.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Opcionais — usaste?</Text>
                      <Text style={styles.sectionHint}>Toca no nome para incluir ou excluir.</Text>
                      {optionalAvailable.map((ing) => {
                        const included = isIncluded(ing.inventoryItemId);
                        return (
                          <IngUsageRow
                            key={ing.inventoryItemId}
                            ing={ing}
                            optional
                            included={included}
                            onToggleInclude={() => toggleInclude(ing.inventoryItemId)}
                            valueStr={getAmount(ing.inventoryItemId, splitAmount(resolveAmountDisplay(ing).effectiveAmount).valueStr)}
                            onChangeValue={(v) => setAmount(ing.inventoryItemId, v)}
                          />
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="Confirmar e atualizar inventário"
                onPress={handleConfirmDone}
                loading={markLoading}
              />
            </View>
          </>
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
  headerSideBtn: { width: 70 },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 8 },
  hero: {
    height: 140, backgroundColor: Colors.primaryLight, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroEmoji: { fontSize: 64 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  sourceBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.stockBlueLight },
  sourceBadgeUser: { backgroundColor: Colors.primaryLight },
  sourceText: { fontSize: 13, fontWeight: '600', color: Colors.stockBlue },
  sourceTextUser: { color: Colors.primaryDark },
  mealTypeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.borderLight },
  mealTypeText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  availText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  completenessBox: { borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1 },
  completenessBoxOk: { backgroundColor: Colors.okGreenLight, borderColor: Colors.okGreen },
  completenessBoxWarn: { backgroundColor: Colors.warnYellowLight, borderColor: Colors.warnYellow },
  completenessText: { fontSize: 13, lineHeight: 18 },
  completenessTextOk: { color: Colors.okGreen },
  completenessTextWarn: { color: Colors.warnYellow },
  metaBox: {
    flexDirection: 'row', gap: 20, backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  metaItem: { alignItems: 'center', gap: 2 },
  metaEmoji: { fontSize: 18 },
  metaVal: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  warnBox: {
    backgroundColor: Colors.warnYellowLight, borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.warnYellow,
  },
  warnText: { fontSize: 13, color: Colors.warnYellow, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  ingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  ingRowMissing: { opacity: 0.75 },
  ingLeft: { flex: 1 },
  ingName: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, marginBottom: 4 },
  ingNameMissing: { color: Colors.textMuted },
  ingBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  urgentBox: {
    backgroundColor: Colors.warnYellowLight, borderRadius: 10, padding: 12,
    marginVertical: 12, borderWidth: 1, borderColor: Colors.warnYellow,
  },
  urgentBoxText: { fontSize: 13, color: Colors.warnYellow, fontWeight: '500' },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNumText: { color: Colors.primaryDark, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  description: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 20 },
  noIngText: { fontSize: 14, color: Colors.textMuted, marginBottom: 8 },
  footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white, gap: 8 },
  editBtn: {
    alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  // ── MarkDone inline styles ────────────────────────────────────────────────────
  doneSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  sectionHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 10, marginTop: -4 },
  usageRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, gap: 8,
  },
  usageRowExcluded: { borderColor: Colors.borderLight, backgroundColor: Colors.background, opacity: 0.5 },
  usageIngLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  optionalCheck: { fontSize: 18, color: Colors.textMuted, width: 22 },
  optionalCheckActive: { color: Colors.primary },
  usageIngName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  usageIngNameExcluded: { color: Colors.textMuted, fontWeight: '400' },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.white,
  },
  amountBoxDisabled: { backgroundColor: Colors.background, borderColor: Colors.borderLight },
  amountInput: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    minWidth: 44, textAlign: 'right', paddingVertical: 6,
  },
  unitLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  aGostoBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.borderLight },
  aGostoText: { fontSize: 12, fontWeight: '500', color: Colors.textMuted },

  // ── Fitness section ───────────────────────────────────────────────────────────
  fitnessBox: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight,
  },
  fitnessSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  fitnessRow: { flexDirection: 'row', gap: 0, justifyContent: 'space-around' },
  fitnessMacroItem: { alignItems: 'center', flex: 1 },
  fitnessMacroValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  fitnessMacroLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  fitnessImpactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fitnessImpactLabel: { fontSize: 13, color: Colors.textSecondary },
  fitnessImpactValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  fitnessProgressBg: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  fitnessProgressFill: { height: 6, borderRadius: 3 },
});
