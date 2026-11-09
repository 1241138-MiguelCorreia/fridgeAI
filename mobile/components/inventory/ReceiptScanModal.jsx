import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { inventoryAPI } from '../../services/api';
import { Colors } from '../../constants/colors';
import Button from '../ui/Button';

// ── Opções de classificação ───────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'ingrediente',        label: 'Ingrediente', emoji: '🥦', color: Colors.primary,   bg: Colors.primaryLight  },
  { key: 'snack',              label: 'Snack',        emoji: '🍫', color: '#7C3AED',         bg: '#EDE9FE'            },
  { key: 'refeicao_pre_feita', label: 'Refeição',     emoji: '🍱', color: '#2563EB',         bg: '#DBEAFE'            },
  { key: 'ignorar',            label: 'Ignorar',      emoji: '🗑️', color: Colors.textMuted,  bg: Colors.background   },
];

const LOCATIONS = [
  { key: 'frigorífico', label: 'Frigorífico', emoji: '🧊' },
  { key: 'despensa',    label: 'Despensa',    emoji: '🚪' },
  { key: 'congelador',  label: 'Congelador',  emoji: '❄️' },
];

// Estado removido do UI — default sempre 'fechado' (produto recém-comprado)

// ── Quantidades sugeridas por produto ─────────────────────────────────────────
function getQuantityOptions(item) {
  const name = (item.name || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const loc  = item.location || '';
  const ai   = item.suggestedQuantity || null;   // ex: "1L", "500g"
  const rcpt = item.receiptQuantity   || null;   // ex: "0,455 kg"

  let options;
  if (name.includes('leite'))                                           options = ['500ml','1L','2L'];
  else if (name.includes('ovo'))                                        options = ['6 un','12 un'];
  else if (name.includes('iogurte'))                                    options = ['1 un','4 un','8 un'];
  else if (name.includes('queijo') || name.includes('requeijao'))       options = ['100g','200g','400g'];
  else if (name.includes('manteiga'))                                   options = ['125g','250g','500g'];
  else if (name.includes('natas'))                                      options = ['200ml','500ml'];
  else if (name.includes('azeite') || name.includes('oleo'))            options = ['250ml','500ml','750ml'];
  else if (name.includes('molho') || name.includes('vinagre') ||
           name.includes('ketchup') || name.includes('mostarda') ||
           name.includes('maionese') || name.includes('shoyu') ||
           name.includes('tabasco') || name.includes('pesto'))          options = ['100ml','250ml','500ml'];
  else if (name.includes('arroz') || name.includes('massa') ||
           name.includes('esparguete') || name.includes('fettuc') ||
           name.includes('penne') || name.includes('macarr'))           options = ['250g','500g','1 kg'];
  else if (name.includes('farinha') || name.includes('acucar') ||
           name.includes('sal ') || name.includes('amido'))             options = ['500g','1 kg','2 kg'];
  else if (name.includes('frango') || name.includes('bovino') ||
           name.includes('vitela') || name.includes('porco') ||
           name.includes('carne') || name.includes('cachaco') ||
           name.includes('costeleta') || name.includes('bifana'))       options = rcpt ? [rcpt,'500g','1 kg']    : ['250g','500g','1 kg'];
  else if (name.includes('peixe') || name.includes('salmao') ||
           name.includes('bacalhau') || name.includes('atum') ||
           name.includes('camarao'))                                    options = rcpt ? [rcpt,'200g','500g']    : ['200g','400g','500g'];
  else if (name.includes('tomate') || name.includes('cenoura') ||
           name.includes('batata') || name.includes('cebola') ||
           name.includes('alface') || name.includes('pepino') ||
           name.includes('espinafre') || name.includes('cogumelo'))     options = rcpt ? [rcpt,'500g','1 kg']    : ['250g','500g','1 kg'];
  else if (name.includes('banana') || name.includes('maca') ||
           name.includes('laranja') || name.includes('pera'))           options = rcpt ? [rcpt,'500g','1 kg']    : ['3 un','6 un','1 kg'];
  else if (loc === 'congelador')                                        options = ['250g','500g','1 kg'];
  else if (loc === 'frigorifico' || loc === 'frigorífico')              options = ['100g','250g','500g'];
  else                                                                   options = ['100g','250g','500g','1 kg'];

  // Juntar a sugestão da IA e deduplicate, mantendo a ordem
  const all = ai && !options.includes(ai) ? [ai, ...options] : [...options];
  return [...new Set(all)].slice(0, 5);
}

const SECTIONS_META = [
  { key: 'review',             title: 'Rever manualmente', emoji: '⚠️', isReview: true  },
  { key: 'ingrediente',        title: 'Ingredientes',       emoji: '🥦', isReview: false },
  { key: 'snack',              title: 'Snacks',             emoji: '🍫', isReview: false },
  { key: 'refeicao_pre_feita', title: 'Refeições pré-feitas', emoji: '🍱', isReview: false },
  { key: 'ignorar',            title: 'Ignorados',          emoji: '🗑️', isReview: false },
];

// ── Seletor de quantidade inteligente ─────────────────────────────────────────
function QuantitySelector({ item, onUpdate }) {
  const [custom, setCustom] = useState('');
  const options = getQuantityOptions(item);
  const current = item.quantity || '';

  const handleChip = (val) => {
    setCustom('');
    onUpdate(item.id, { quantity: val });
  };

  const handleCustomChange = (text) => {
    setCustom(text);
    if (text.trim()) onUpdate(item.id, { quantity: text.trim() });
  };

  const isCustomActive = !!current && !options.includes(current);

  return (
    <View style={styles.qtyWrapper}>
      <Text style={styles.qtyLabel}>📦 Quantidade</Text>
      <View style={styles.qtyChips}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.qtyChip, current === opt && styles.qtyChipActive]}
            onPress={() => handleChip(opt)}
          >
            <Text style={[styles.qtyChipText, current === opt && styles.qtyChipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Campo livre */}
        <TextInput
          style={[styles.qtyCustom, isCustomActive && styles.qtyChipActive]}
          placeholder="outro…"
          placeholderTextColor={Colors.textMuted}
          value={custom || (isCustomActive ? current : '')}
          onChangeText={handleCustomChange}
          onFocus={() => { if (!isCustomActive) setCustom(''); }}
        />
      </View>
    </View>
  );
}

// ── Linha de produto ──────────────────────────────────────────────────────────
function ItemRow({ item, onUpdate }) {
  const showDetails = item.classification !== 'ignorar';

  const isIgnored = item.classification === 'ignorar';

  return (
    <View style={[
      styles.itemRow,
      item.needsReview && styles.itemRowReview,
    ]}>
      {/* Conteúdo com opacidade reduzida quando ignorado */}
      <View style={isIgnored && { opacity: 0.4 }}>
        {/* Texto original do OCR */}
        {item.originalText && item.originalText.toLowerCase() !== item.name.toLowerCase() && (
          <Text style={styles.originalText}>{item.originalText}</Text>
        )}

        {/* Nome editável */}
        <View style={styles.nameRow}>
          <TextInput
            style={[
              styles.nameInput,
              isIgnored && { textDecorationLine: 'line-through', color: Colors.textMuted },
            ]}
            value={item.name}
            onChangeText={(text) => onUpdate(item.id, { name: text })}
            selectTextOnFocus
            editable={!isIgnored}
          />
        </View>

        {/* Quantidade lida do recibo */}
        {item.receiptQuantity && (
          <View style={styles.receiptQtyRow}>
            <Text style={styles.receiptQtyLabel}>⚖️ Quantidade no recibo: </Text>
            <Text style={styles.receiptQtyValue}>{item.receiptQuantity}</Text>
          </View>
        )}
      </View>

      {/* Seletor de categoria — sempre visível e interactivo */}
      <View style={styles.catRow}>
        {CATEGORIES.map((cat) => {
          const active = item.classification === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catPill, active && { borderColor: cat.color, backgroundColor: cat.bg }]}
              onPress={() => onUpdate(item.id, { classification: cat.key, needsReview: false })}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catLabel, active && { color: cat.color, fontWeight: '700' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Localização (só para ingrediente / refeição pré-feita) */}
      {showDetails && (
        <View style={styles.subRow}>
          {LOCATIONS.map((loc) => {
            const active = item.location === loc.key;
            return (
              <TouchableOpacity
                key={loc.key}
                style={[styles.subPill, active && styles.subPillActive]}
                onPress={() => onUpdate(item.id, { location: loc.key })}
              >
                <Text style={styles.subEmoji}>{loc.emoji}</Text>
                <Text style={[styles.subLabel, active && styles.subLabelActive]}>{loc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Quantidade inteligente — snacks também têm quantidade */}
      {item.classification !== 'ignorar' && <QuantitySelector item={item} onUpdate={onUpdate} />}
    </View>
  );
}

// ── Cabeçalho de secção ───────────────────────────────────────────────────────
function SectionHeader({ emoji, title, count, isReview }) {
  return (
    <View style={[styles.sectionHeader, isReview && styles.sectionHeaderReview]}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={[styles.sectionTitle, isReview && { color: '#92400E' }]}>{title}</Text>
      <View style={[styles.sectionBadge, isReview && { backgroundColor: '#FDE68A' }]}>
        <Text style={[styles.sectionBadgeText, isReview && { color: '#92400E' }]}>{count}</Text>
      </View>
    </View>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ReceiptScanModal({ visible, onClose, onAdded }) {
  const [step, setStep] = useState('capture'); // 'capture' | 'loading' | 'error' | 'review'
  const [errorMsg, setErrorMsg] = useState('');
  const [items, setItems] = useState([]);

  const handleClose = () => {
    setStep('capture');
    setErrorMsg('');
    setItems([]);
    onClose();
  };

  const handleItemUpdate = useCallback((id, changes) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  // Agrupar itens por secção
  const sections = useMemo(() => {
    const groups = {};
    for (const meta of SECTIONS_META) {
      groups[meta.key] = meta.isReview
        ? items.filter((i) => i.needsReview)
        : items.filter((i) => !i.needsReview && i.classification === meta.key);
    }
    return SECTIONS_META
      .filter((m) => groups[m.key].length > 0)
      .map((m) => ({ ...m, data: groups[m.key] }));
  }, [items]);

  const countToSave = useMemo(
    () => items.filter((i) => i.classification !== 'ignorar').length,
    [items]
  );

  // ── Processar imagem ────────────────────────────────────────────────────────
  const processImage = useCallback(async (pickerResult) => {
    if (pickerResult.canceled) return;
    const asset = pickerResult.assets?.[0];
    if (!asset) return;

    setStep('loading');
    try {
      let base64 = asset.base64;
      if (!base64) {
        // FileReader não existe em React Native — usar expo-file-system
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const res = await inventoryAPI.scanReceipt(base64, mimeType);
      const rawItems = res.data?.items || [];

      if (rawItems.length === 0) {
        setErrorMsg('Não detetámos produtos neste recibo. O recibo está legível?');
        setStep('error');
        return;
      }

      setItems(
        rawItems.map((item, i) => ({
          id: i,
          originalText: item.originalText || item.name || '',
          name: item.name || '',
          classification: item.classification || 'ingrediente',
          confidence: item.confidence ?? 0.7,
          needsReview: !!item.needsReview,
          location: item.suggestedLocation || 'despensa',
          state: item.suggestedState || 'fechado',
          suggestedQuantity: item.suggestedQuantity || null,
          quantity: item.suggestedQuantity || item.receiptQuantity || '',
          receiptQuantity: item.receiptQuantity || null,
        }))
      );
      setStep('review');
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
      const isNetwork = code === 'NETWORK_ERROR' || !err?.response;
      console.error('[ReceiptScan] Erro:', err?.response?.data || err?.message || err);
      setErrorMsg(
        code === 'NO_PRODUCTS_FOUND'
          ? 'Não detetámos produtos neste recibo. O recibo está legível?'
          : isTimeout
          ? 'O servidor demorou demasiado a responder. Tenta novamente.'
          : isNetwork
          ? 'Sem ligação ao servidor. Verifica que estás na mesma rede.'
          : 'Não foi possível ler o recibo. Tenta novamente.'
      );
      setStep('error');
    }
  }, []);

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera. Ativa nas definições do dispositivo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    processImage(result);
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria. Ativa nas definições do dispositivo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    processImage(result);
  };

  // Marcar todos os itens rever como ingrediente
  const handleResolveAll = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.needsReview ? { ...i, needsReview: false, classification: 'ingrediente' } : i
      )
    );
  };

  // ── Confirmar e guardar ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const toSave = items.filter(
      (i) => i.classification !== 'ignorar' && i.name.trim().length > 0
    );
    if (toSave.length === 0) {
      Alert.alert('Nenhum produto para guardar', 'Altera a categoria dos produtos que queres guardar no inventário.');
      return;
    }

    setStep('loading');
    try {
      const inventoryItems = toSave.map((i) => ({
        name: i.name.trim().charAt(0).toUpperCase() + i.name.trim().slice(1),
        location: i.location || 'despensa',
        state: i.state || 'fechado',
        quantity: i.quantity || '',
        source: 'receipt',
      }));
      await inventoryAPI.bulkCreate(inventoryItems);
      if (onAdded) onAdded(toSave.length);
      handleClose();
    } catch {
      setStep('review');
      Alert.alert('Erro', 'Não foi possível guardar os produtos. Tenta novamente.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── Captura ──────────────────────────────────────────────────── */}
          {step === 'capture' && (
            <SafeAreaView style={styles.inner}>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.sheetEmoji}>🧾</Text>
              <Text style={styles.sheetTitle}>Digitalizar recibo</Text>
              <Text style={styles.sheetSubtitle}>
                Tira uma foto ao recibo do supermercado e a IA vai classificar os produtos automaticamente.
              </Text>
              <View style={styles.captureButtons}>
                <TouchableOpacity style={styles.captureBtn} onPress={handleCamera}>
                  <Text style={styles.captureBtnEmoji}>📷</Text>
                  <Text style={styles.captureBtnLabel}>Tirar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureBtn} onPress={handleGallery}>
                  <Text style={styles.captureBtnEmoji}>🖼️</Text>
                  <Text style={styles.captureBtnLabel}>Escolher da galeria</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {step === 'loading' && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>A analisar o recibo…</Text>
              <Text style={styles.loadingSubtext}>A IA está a classificar os produtos</Text>
            </View>
          )}

          {/* ── Erro ─────────────────────────────────────────────────────── */}
          {step === 'error' && (
            <SafeAreaView style={styles.inner}>
              <Text style={styles.sheetEmoji}>😕</Text>
              <Text style={styles.sheetTitle}>Não foi possível ler</Text>
              <Text style={styles.sheetSubtitle}>{errorMsg}</Text>
              <Button title="Tentar novamente" onPress={() => setStep('capture')} style={styles.fullBtn} />
              <Button title="Cancelar" variant="ghost" onPress={handleClose} style={styles.fullBtn} />
            </SafeAreaView>
          )}

          {/* ── Revisão ──────────────────────────────────────────────────── */}
          {step === 'review' && (
            <SafeAreaView style={{ flex: 1 }}>
              {/* Cabeçalho */}
              <View style={styles.reviewHeader}>
                <TouchableOpacity onPress={handleClose} style={styles.reviewClose}>
                  <Text style={styles.reviewCloseText}>✕</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle}>Confirmar produtos do recibo</Text>
                  <Text style={styles.reviewSubtitle}>{items.length} produto{items.length !== 1 ? 's' : ''} detetado{items.length !== 1 ? 's' : ''}</Text>
                </View>
                {items.some((i) => i.needsReview) && (
                  <TouchableOpacity onPress={handleResolveAll} style={styles.resolveBtn}>
                    <Text style={styles.resolveBtnText}>Aceitar todos</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista com secções */}
              <ScrollView
                style={styles.reviewList}
                contentContainerStyle={styles.reviewContent}
                keyboardShouldPersistTaps="handled"
              >
                {sections.map((section) => (
                  <View key={section.key}>
                    <SectionHeader
                      emoji={section.emoji}
                      title={section.title}
                      count={section.data.length}
                      isReview={section.isReview}
                    />
                    {section.data.map((item) => (
                      <ItemRow key={item.id} item={item} onUpdate={handleItemUpdate} />
                    ))}
                  </View>
                ))}
                <View style={{ height: 16 }} />
              </ScrollView>

              {/* Barra de confirmação */}
              <View style={styles.confirmBar}>
                  <Button
                  title={
                    countToSave > 0
                      ? `Guardar ${countToSave} produto${countToSave !== 1 ? 's' : ''} no inventário`
                      : 'Nenhum produto para guardar'
                  }
                  onPress={handleConfirm}
                  disabled={countToSave === 0}
                  style={styles.confirmBtn}
                />
              </View>
            </SafeAreaView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    minHeight: 320,
    flex: 1,
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // ── Capture / Error ─────────────────────────────────────────────────────────
  inner: { alignItems: 'center', padding: 28, paddingTop: 8 },
  closeBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  closeBtnText: { fontSize: 18, color: Colors.textMuted },
  sheetEmoji: { fontSize: 56, marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  sheetSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  captureButtons: { flexDirection: 'row', gap: 14, width: '100%' },
  captureBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background, gap: 8,
  },
  captureBtnEmoji: { fontSize: 32 },
  captureBtnLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  fullBtn: { width: '100%', marginBottom: 10 },

  // ── Loading ─────────────────────────────────────────────────────────────────
  loadingWrap: { alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 },
  loadingText: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  loadingSubtext: { fontSize: 13, color: Colors.textMuted },

  // ── Review header ───────────────────────────────────────────────────────────
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  reviewClose: { padding: 6 },
  reviewCloseText: { fontSize: 18, color: Colors.textMuted },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  reviewSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  resolveBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#FEF3C7', borderRadius: 8,
  },
  resolveBtnText: { fontSize: 11, fontWeight: '600', color: '#92400E' },

  // ── Review list ─────────────────────────────────────────────────────────────
  reviewList: { flex: 1 },
  reviewContent: { paddingHorizontal: 14, paddingTop: 8 },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 2, marginTop: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    marginBottom: 6,
  },
  sectionHeaderReview: { backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0, marginBottom: 8 },
  sectionEmoji: { fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, flex: 1 },
  sectionBadge: {
    backgroundColor: Colors.borderLight, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  // ── Item row ────────────────────────────────────────────────────────────────
  itemRow: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    padding: 12, marginBottom: 8, gap: 8,
  },
  itemRowReview: {
    borderColor: '#F59E0B', backgroundColor: '#FFFBEB',
  },
  originalText: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    paddingBottom: 4, paddingHorizontal: 2,
  },
  confBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#FEF3C7', borderRadius: 6,
  },
  confText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  receiptQtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  receiptQtyLabel: { fontSize: 11, color: Colors.textMuted },
  receiptQtyValue: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  // Category pills
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.borderLight, backgroundColor: Colors.background,
  },
  catEmoji: { fontSize: 12 },
  catLabel: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },

  // Sub-option pills (location / state / quantity)
  subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  subPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.background,
  },
  subPillActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondaryLight },
  subEmoji: { fontSize: 11 },
  subLabel: { fontSize: 11, color: Colors.textSecondary },
  subLabelActive: { color: Colors.secondary, fontWeight: '600' },

  // ── Quantity selector ───────────────────────────────────────────────────────
  qtyWrapper: { gap: 6 },
  qtyLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  qtyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  qtyChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.borderLight, backgroundColor: Colors.background,
  },
  qtyChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  qtyChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  qtyChipTextActive: { color: Colors.primary, fontWeight: '700' },
  qtyCustom: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.borderLight, backgroundColor: Colors.background,
    fontSize: 12, color: Colors.textPrimary, minWidth: 64,
  },

  // ── Confirm bar ─────────────────────────────────────────────────────────────
  confirmBar: {
    padding: 14, paddingBottom: Platform.OS === 'ios' ? 8 : 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.white, gap: 6,
  },
  confirmBtn: { width: '100%' },
  snackNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
});
