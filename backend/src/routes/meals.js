const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const MealHistory = require('../models/MealHistory');
const FitnessProfile = require('../models/FitnessProfile');
const DailyNutritionLog = require('../models/DailyNutritionLog');
const FitnessStreak = require('../models/FitnessStreak');
const { protect } = require('../middleware/auth');
const { suggestMeals } = require('../services/mealSuggester');
const { estimateExpiry } = require('../services/inventoryParser');

function todayStr() { return new Date().toISOString().split('T')[0]; }

async function updateStreak(userId) {
  const today = todayStr();
  let streak = await FitnessStreak.findOne({ userId });
  if (!streak) streak = new FitnessStreak({ userId });
  if (streak.lastActiveDate === today) return streak;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  streak.currentStreak = streak.lastActiveDate === yStr ? streak.currentStreak + 1 : 1;
  if (streak.currentStreak > streak.bestStreak) streak.bestStreak = streak.currentStreak;
  streak.lastActiveDate = today;
  await streak.save();
  return streak;
}

function recalcLogTotals(log) {
  log.caloriesConsumed = log.entries.reduce((s, e) => s + (e.calories || 0), 0);
  log.macrosConsumed.protein = log.entries.reduce((s, e) => s + ((e.macros && e.macros.protein) || 0), 0);
  log.macrosConsumed.carbs   = log.entries.reduce((s, e) => s + ((e.macros && e.macros.carbs)   || 0), 0);
  log.macrosConsumed.fat     = log.entries.reduce((s, e) => s + ((e.macros && e.macros.fat)     || 0), 0);
}

const router = express.Router();
router.use(protect);

const VALID_MEAL_TYPES = ['pequeno-almoco', 'almoco', 'jantar', 'snack', 'rapida', 'breakfast', 'lunch_dinner'];

function calcPriority(expiryDays) {
  if (!expiryDays) return 'pode_esperar';
  if (expiryDays <= 1) return 'usar_hoje';
  if (expiryDays <= 4) return 'usar_breve';
  if (expiryDays <= 30) return 'pode_esperar';
  return 'stock';
}

// ─── PATCH /meals/servings ────────────────────────────────────────────────────
router.patch('/servings', async (req, res) => {
  try {
    const { servings } = req.body;
    const n = parseInt(servings);
    if (!n || n < 1 || n > 20) {
      return res.status(400).json({ success: false, message: 'Número de pessoas inválido (1-20).' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { mealServings: n }, { new: true });
    res.json({ success: true, mealServings: user.mealServings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao guardar configuração.' });
  }
});

// ─── PATCH /meals/mealtype ────────────────────────────────────────────────────
router.patch('/mealtype', async (req, res) => {
  try {
    const { mealType } = req.body;
    if (!VALID_MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ success: false, message: 'Tipo de refeição inválido.' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { mealType }, { new: true });
    res.json({ success: true, mealType: user.mealType });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao guardar tipo de refeição.' });
  }
});

// ─── GET /meals/suggestions ───────────────────────────────────────────────────
router.get('/suggestions', async (req, res) => {
  try {
    const user = req.user;
    const servings = user.mealServings || 2;
    // Se o frontend enviou o parâmetro (mesmo vazio = "Todos"), usa-o diretamente.
    // Só recorre à preferência guardada se o parâmetro estiver totalmente ausente.
    const mealType = ('mealType' in req.query)
      ? (req.query.mealType || null)
      : (user.mealType || null);

    const [inventoryItems, userRecipes, fitnessProfile, dailyLog] = await Promise.all([
      InventoryItem.find({ userId: user._id, isActive: true }),
      Recipe.find({ userId: user._id, isActive: true }),
      user.mode === 'fitness' ? FitnessProfile.findOne({ userId: user._id }) : null,
      user.mode === 'fitness' ? DailyNutritionLog.findOne({ userId: user._id, date: todayStr() }) : null,
    ]);

    if (inventoryItems.length < 3) {
      return res.json({
        success: true,
        meals: [],
        tooFewItems: true,
        message: 'Adiciona pelo menos 3 produtos ao inventário para receber sugestões.',
      });
    }

    const meals = suggestMeals({
      inventoryItems,
      restrictions: user.restrictions || [],
      allergies: user.allergies || '',
      servings,
      userRecipes,
      mealType,
      fitnessProfile: fitnessProfile || null,
      dailyNutritionLog: dailyLog || null,
    });

    const hasUrgent = inventoryItems.some((i) => ['usar_hoje', 'usar_breve'].includes(i.priority));

    res.json({
      success: true,
      meals,
      servings,
      mealType,
      subtitle: hasUrgent
        ? 'Tens produtos a expirar em breve'
        : 'Sugestões baseadas no teu inventário',
      fitnessProfile: fitnessProfile || null,
      dailyNutritionLog: dailyLog || null,
    });
  } catch (err) {
    console.error('Erro em /meals/suggestions:', err);
    res.status(500).json({ success: false, message: 'Erro ao gerar sugestões.' });
  }
});

// ─── GET /meals/history ───────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const history = await MealHistory.find({ userId: req.user._id })
      .sort({ completedAt: -1 })
      .limit(100);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao carregar histórico.' });
  }
});

// ─── GET /meals/recipes ───────────────────────────────────────────────────────
router.get('/recipes', async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, recipes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao carregar receitas.' });
  }
});

// ─── POST /meals/recipes ──────────────────────────────────────────────────────
router.post('/recipes', async (req, res) => {
  try {
    const { name, ingredients, time, difficulty, instructions, notes } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome da receita inválido.' });
    }
    if (!Array.isArray(ingredients) || ingredients.length < 2) {
      return res.status(400).json({ success: false, message: 'É necessário pelo menos 2 ingredientes.' });
    }

    const recipe = await Recipe.create({
      userId: req.user._id,
      name: name.trim(),
      ingredients: ingredients.map((i) => ({ name: i.name?.trim(), amount: i.amount?.trim() || '' })),
      time: time?.trim() || '',
      difficulty: difficulty || 'fácil',
      instructions: Array.isArray(instructions) ? instructions.filter(Boolean) : [],
      notes: notes?.trim() || '',
    });

    res.status(201).json({ success: true, recipe });
  } catch (err) {
    console.error('Erro ao criar receita:', err);
    res.status(500).json({ success: false, message: 'Erro ao guardar receita.' });
  }
});

// ─── PATCH /meals/recipes/:id ─────────────────────────────────────────────────
router.patch('/recipes/:id', async (req, res) => {
  try {
    const { name, ingredients, time, difficulty, instructions, notes } = req.body;

    const recipe = await Recipe.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!recipe) return res.status(404).json({ success: false, message: 'Receita não encontrada.' });

    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Nome da receita inválido.' });
      }
      recipe.name = name.trim();
    }
    if (Array.isArray(ingredients)) {
      if (ingredients.length < 2) {
        return res.status(400).json({ success: false, message: 'É necessário pelo menos 2 ingredientes.' });
      }
      recipe.ingredients = ingredients.map((i) => ({ name: i.name?.trim(), amount: i.amount?.trim() || '' }));
    }
    if (time !== undefined) recipe.time = time?.trim() || '';
    if (difficulty !== undefined) recipe.difficulty = difficulty || 'fácil';
    if (Array.isArray(instructions)) recipe.instructions = instructions.filter(Boolean);
    if (notes !== undefined) recipe.notes = notes?.trim() || '';

    await recipe.save();
    res.json({ success: true, recipe });
  } catch (err) {
    console.error('Erro ao editar receita:', err);
    res.status(500).json({ success: false, message: 'Erro ao guardar alterações.' });
  }
});

// ─── DELETE /meals/recipes/:id ────────────────────────────────────────────────
router.delete('/recipes/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, userId: req.user._id });
    if (!recipe) return res.status(404).json({ success: false, message: 'Receita não encontrada.' });
    recipe.isActive = false;
    await recipe.save();
    res.json({ success: true, message: 'Receita removida.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover receita.' });
  }
});

// ─── Helper: subtrair quantidade ─────────────────────────────────────────────
const WEIGHT_FACTORS = { g: 1, gr: 1, grama: 1, gramas: 1, kg: 1000, kilo: 1000 };
const VOLUME_FACTORS = { ml: 1, cl: 10, dl: 100, l: 1000 };

function parseQty(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zçãé]*)/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;
  return { value, unit: m[2].trim() };
}

function subtractQuantity(currentStr, usedStr) {
  const curr = parseQty(currentStr);
  const used = parseQty(usedStr);
  if (!curr || !used) return { depleted: false, newQuantity: currentStr };

  let remaining;

  if (curr.unit === used.unit) {
    remaining = curr.value - used.value;
  } else if (WEIGHT_FACTORS[curr.unit] && WEIGHT_FACTORS[used.unit]) {
    const remBase = curr.value * WEIGHT_FACTORS[curr.unit] - used.value * WEIGHT_FACTORS[used.unit];
    remaining = remBase / WEIGHT_FACTORS[curr.unit];
  } else if (VOLUME_FACTORS[curr.unit] && VOLUME_FACTORS[used.unit]) {
    const remBase = curr.value * VOLUME_FACTORS[curr.unit] - used.value * VOLUME_FACTORS[used.unit];
    remaining = remBase / VOLUME_FACTORS[curr.unit];
  } else {
    return { depleted: false, newQuantity: currentStr };
  }

  if (remaining <= 0) return { depleted: true };
  const rounded = Math.round(remaining * 10) / 10;
  const display = Number.isInteger(rounded) ? `${rounded}${curr.unit}` : `${rounded}${curr.unit}`;
  return { depleted: false, newQuantity: display };
}

// ─── Helper: processar atualizações de inventário ────────────────────────────
async function processInventoryUpdates(userId, ingredientsUsed) {
  const changes = [];
  for (const usage of ingredientsUsed) {
    const { inventoryItemId, amountUsed } = usage;
    if (!inventoryItemId) continue;

    const item = await InventoryItem.findOne({ _id: inventoryItemId, userId, isActive: true });
    if (!item) continue;

    const before = { name: item.name, state: item.state, quantity: item.quantity };
    const wasClosed = item.state === 'fechado';

    const { depleted, newQuantity } = subtractQuantity(item.quantity, amountUsed);

    if (depleted) {
      item.isActive = false;
      await item.save();
      changes.push({ ...before, action: 'removed' });
    } else {
      if (newQuantity !== undefined && newQuantity !== item.quantity) {
        item.quantity = newQuantity;
      }
      if (wasClosed) {
        item.state = 'aberto';
        item.openedAt = new Date();
        const newExpiry = estimateExpiry(item.normalizedName, item.location, 'aberto');
        item.estimatedExpiryDays = newExpiry;
        item.expiresAt = new Date(Date.now() + newExpiry * 24 * 60 * 60 * 1000);
        item.priority = calcPriority(newExpiry);
      }
      await item.save();
      changes.push({ ...before, action: 'updated', after: { state: item.state, quantity: item.quantity } });
    }
  }
  return changes;
}

// ─── POST /meals/complete ─────────────────────────────────────────────────────
// Marca refeição como feita, atualiza inventário e guarda no histórico
router.post('/complete', async (req, res) => {
  try {
    const {
      mealId, mealName, mealType, source, servings,
      ingredientsUsed, usedUrgentItems, urgentItemsUsed,
      calories, macros, // fitness fields
    } = req.body;

    if (!mealName) {
      return res.status(400).json({ success: false, message: 'Nome da refeição é obrigatório.' });
    }
    if (!Array.isArray(ingredientsUsed)) {
      return res.status(400).json({ success: false, message: 'Lista de ingredientes inválida.' });
    }

    const changes = await processInventoryUpdates(req.user._id, ingredientsUsed);

    const usedIngNames = ingredientsUsed
      .filter((u) => u.name)
      .map((u) => ({ name: u.name, amount: u.amount || '', urgent: !!u.urgent }));

    await MealHistory.create({
      userId: req.user._id,
      mealId: mealId || null,
      mealName,
      mealType: mealType || null,
      source: source || 'suggested',
      servings: servings || req.user.mealServings || 1,
      ingredientsUsed: usedIngNames,
      usedUrgentItems: !!(usedUrgentItems || (urgentItemsUsed && urgentItemsUsed.length > 0)),
      completedAt: new Date(),
    });

    const count = await InventoryItem.countDocuments({ userId: req.user._id, isActive: true });
    if (count === 0) {
      await User.findByIdAndUpdate(req.user._id, { hasInventory: false });
    }

    // ── Modo Fitness: registar no daily log ──
    let dailyLog = null;
    let streak = null;
    if (req.user.mode === 'fitness' && calories) {
      const today = todayStr();
      let log = await DailyNutritionLog.findOne({ userId: req.user._id, date: today });
      if (!log) log = new DailyNutritionLog({ userId: req.user._id, date: today });
      log.entries.push({
        type: 'meal', name: mealName,
        calories: calories || 0,
        macros: macros || { protein: 0, carbs: 0, fat: 0 },
        mealType: mealType || null,
        loggedAt: new Date(),
        sourceId: mealId || null,
      });
      recalcLogTotals(log);
      await log.save();
      dailyLog = log;
      streak = await updateStreak(req.user._id);
    }

    res.json({
      success: true,
      message: 'Refeição registada no histórico. Inventário atualizado.',
      changes,
      dailyLog: dailyLog || undefined,
      streak: streak || undefined,
    });
  } catch (err) {
    console.error('Erro em /meals/complete:', err);
    res.status(500).json({ success: false, message: 'Erro ao registar refeição.' });
  }
});

// ─── POST /meals/done ─────────────────────────────────────────────────────────
// Compatibilidade retroativa — também guarda no histórico
router.post('/done', async (req, res) => {
  try {
    const { mealName, mealId, mealType, source, servings, ingredientsUsed, usedUrgentItems } = req.body;

    if (!mealName) {
      return res.status(400).json({ success: false, message: 'Nome da refeição é obrigatório.' });
    }
    if (!Array.isArray(ingredientsUsed) || ingredientsUsed.length === 0) {
      return res.status(400).json({ success: false, message: 'Lista de ingredientes inválida.' });
    }

    const changes = await processInventoryUpdates(req.user._id, ingredientsUsed);

    await MealHistory.create({
      userId: req.user._id,
      mealId: mealId || null,
      mealName,
      mealType: mealType || null,
      source: source || 'suggested',
      servings: servings || req.user.mealServings || 1,
      ingredientsUsed: [],
      usedUrgentItems: !!usedUrgentItems,
      completedAt: new Date(),
    });

    const count = await InventoryItem.countDocuments({ userId: req.user._id, isActive: true });
    if (count === 0) {
      await User.findByIdAndUpdate(req.user._id, { hasInventory: false });
    }

    res.json({
      success: true,
      message: 'Refeição registada. Inventário atualizado.',
      changes,
    });
  } catch (err) {
    console.error('Erro em /meals/done:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar inventário.' });
  }
});

module.exports = router;
