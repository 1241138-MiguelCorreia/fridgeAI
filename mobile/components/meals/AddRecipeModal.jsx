import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView,
} from 'react-native';
import { mealsAPI } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Colors } from '../../constants/colors';

const DIFFICULTY_OPTIONS = ['fácil', 'médio', 'difícil'];

function OptionPicker({ label, options, value, onChange }) {
  return (
    <View style={styles.pickerWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerOpt, value === opt && styles.pickerOptSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.pickerOptText, value === opt && styles.pickerOptTextSelected]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function AddRecipeModal({ visible, onClose, onAdded, editRecipe = null }) {
  const isEdit = !!editRecipe;

  const getInitialIngredients = () => {
    if (editRecipe?.ingredients?.length >= 2) return editRecipe.ingredients.map((i) => ({ name: i.name || '', amount: i.amount || '' }));
    return [{ name: '', amount: '' }, { name: '', amount: '' }];
  };

  const [name, setName] = useState(editRecipe?.name || '');
  const [ingredients, setIngredients] = useState(getInitialIngredients);
  const [time, setTime] = useState(editRecipe?.time || '');
  const [difficulty, setDifficulty] = useState(editRecipe?.difficulty || 'fácil');
  const [instructions, setInstructions] = useState(editRecipe?.instructions?.length ? editRecipe.instructions : ['']);
  const [notes, setNotes] = useState(editRecipe?.notes || '');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  React.useEffect(() => {
    if (visible && editRecipe) {
      setName(editRecipe.name || '');
      setIngredients(editRecipe.ingredients?.length >= 2
        ? editRecipe.ingredients.map((i) => ({ name: i.name || '', amount: i.amount || '' }))
        : [{ name: '', amount: '' }, { name: '', amount: '' }]);
      setTime(editRecipe.time || '');
      setDifficulty(editRecipe.difficulty || 'fácil');
      setInstructions(editRecipe.instructions?.length ? editRecipe.instructions : ['']);
      setNotes(editRecipe.notes || '');
      setNameError('');
    } else if (visible && !editRecipe) {
      reset();
    }
  }, [visible, editRecipe]);

  const reset = () => {
    setName(''); setIngredients([{ name: '', amount: '' }, { name: '', amount: '' }]);
    setTime(''); setDifficulty('fácil'); setInstructions(['']); setNotes(''); setNameError('');
  };

  const handleClose = () => { if (!isEdit) reset(); onClose(); };

  const updateIngredient = (index, field, value) => {
    setIngredients((prev) => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
  };

  const addIngredient = () => {
    if (ingredients.length < 15) setIngredients((prev) => [...prev, { name: '', amount: '' }]);
  };

  const removeIngredient = (index) => {
    if (ingredients.length > 2) setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInstruction = (index, value) => {
    setInstructions((prev) => prev.map((s, i) => i === index ? value : s));
  };

  const addInstruction = () => {
    if (instructions.length < 20) setInstructions((prev) => [...prev, '']);
  };

  const removeInstruction = (index) => {
    if (instructions.length > 1) setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError('Introduz o nome da receita.');
      return;
    }
    const validIngredients = ingredients.filter((i) => i.name.trim().length >= 2);
    if (validIngredients.length < 2) {
      Alert.alert('Atenção', 'Adiciona pelo menos 2 ingredientes.');
      return;
    }

    const payload = {
      name: name.trim(),
      ingredients: validIngredients,
      time: time.trim(),
      difficulty,
      instructions: instructions.filter((s) => s.trim()),
      notes: notes.trim(),
    };

    setLoading(true);
    try {
      let res;
      if (isEdit) {
        res = await mealsAPI.updateRecipe(editRecipe._id || editRecipe.id, payload);
      } else {
        res = await mealsAPI.createRecipe(payload);
      }
      onAdded?.(res.data.recipe);
      if (!isEdit) reset();
      onClose();
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível guardar a receita.');
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
          <Text style={styles.headerTitle}>{isEdit ? 'Editar receita' : 'Nova receita'}</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Nome */}
          <Input
            label="Nome da receita *"
            placeholder="Ex: Massa com atum"
            value={name}
            onChangeText={(t) => { setName(t); setNameError(''); }}
            autoCapitalize="sentences"
            error={nameError}
          />

          {/* Ingredientes */}
          <Text style={styles.sectionLabel}>Ingredientes *</Text>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingRow}>
              <View style={styles.ingName}>
                <Input
                  placeholder={`Ingrediente ${i + 1}`}
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(i, 'name', v)}
                  autoCapitalize="sentences"
                />
              </View>
              <View style={styles.ingAmount}>
                <Input
                  placeholder="Qtd."
                  value={ing.amount}
                  onChangeText={(v) => updateIngredient(i, 'amount', v)}
                />
              </View>
              {ingredients.length > 2 && (
                <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addIngredient} style={styles.addIngBtn}>
            <Text style={styles.addIngText}>+ Adicionar ingrediente</Text>
          </TouchableOpacity>

          {/* Tempo e dificuldade */}
          <Input
            label="Tempo de preparação (opcional)"
            placeholder="Ex: 25 min"
            value={time}
            onChangeText={setTime}
          />
          <OptionPicker label="Dificuldade" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />

          {/* Instruções */}
          <Text style={styles.sectionLabel}>Instruções (opcional)</Text>
          {instructions.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={styles.stepInput}>
                <Input
                  placeholder={`Passo ${i + 1}`}
                  value={step}
                  onChangeText={(v) => updateInstruction(i, v)}
                  multiline
                />
              </View>
              {instructions.length > 1 && (
                <TouchableOpacity onPress={() => removeInstruction(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addInstruction} style={styles.addIngBtn}>
            <Text style={styles.addIngText}>+ Adicionar passo</Text>
          </TouchableOpacity>

          {/* Notas */}
          <Input
            label="Notas (opcional)"
            placeholder="Ex: Receita da avó, variação com camarão…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={300}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button title={isEdit ? 'Guardar alterações' : 'Guardar receita'} onPress={handleSave} loading={loading} />
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
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, marginTop: 4 },
  ingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  ingName: { flex: 2 },
  ingAmount: { flex: 1 },
  removeBtn: {
    width: 32, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 0,
  },
  removeBtnText: { color: Colors.textMuted, fontSize: 16 },
  addIngBtn: { paddingVertical: 10, marginBottom: 16 },
  addIngText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  stepNumText: { color: Colors.primaryDark, fontWeight: '700', fontSize: 13 },
  stepInput: { flex: 1 },
  pickerWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOpt: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  pickerOptSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pickerOptText: { fontSize: 14, color: Colors.textSecondary },
  pickerOptTextSelected: { color: Colors.primaryDark, fontWeight: '600' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
});
