const express = require('express');
const { protect } = require('../middleware/auth');
const FitnessProfile = require('../models/FitnessProfile');
const DailyNutritionLog = require('../models/DailyNutritionLog');
const SnackItem = require('../models/SnackItem');
const FitnessStreak = require('../models/FitnessStreak');
const BodyProgress = require('../models/BodyProgress');
const { calculateFitnessTargets } = require('../services/fitnessCalculator');

const router = express.Router();
router.use(protect);

// ── Helper: data de hoje em YYYY-MM-DD ────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Helper: atualizar totais do log ──────────────────────────────────────────
function recalcTotals(log) {
  log.caloriesConsumed = log.entries.reduce((s, e) => s + (e.calories || 0), 0);
  log.macrosConsumed.protein = log.entries.reduce((s, e) => s + ((e.macros && e.macros.protein) || 0), 0);
  log.macrosConsumed.carbs   = log.entries.reduce((s, e) => s + ((e.macros && e.macros.carbs)   || 0), 0);
  log.macrosConsumed.fat     = log.entries.reduce((s, e) => s + ((e.macros && e.macros.fat)     || 0), 0);
}

// ── Helper: atualizar streak ─────────────────────────────────────────────────
async function updateStreak(userId) {
  const today = todayStr();
  let streak = await FitnessStreak.findOne({ userId });
  if (!streak) streak = new FitnessStreak({ userId });

  if (streak.lastActiveDate === today) return streak; // já contou hoje

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (streak.lastActiveDate === yesterdayStr) {
    streak.currentStreak += 1;
  } else {
    streak.currentStreak = 1; // quebrou ou primeiro dia
  }
  if (streak.currentStreak > streak.bestStreak) streak.bestStreak = streak.currentStreak;
  streak.lastActiveDate = today;
  await streak.save();
  return streak;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFIL FITNESS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /fitness/profile
router.get('/profile', async (req, res) => {
  try {
    const profile = await FitnessProfile.findOne({ userId: req.user._id });
    if (!profile) return res.json({ success: true, profile: null });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao obter perfil fitness.' });
  }
});

// POST /fitness/profile — criar ou substituir
router.post('/profile', async (req, res) => {
  try {
    const { age, sex, heightCm, currentWeightKg, activityLevel, goal } = req.body;

    // Validações
    if (!age || !sex || !heightCm || !currentWeightKg || !activityLevel || !goal) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    if (age < 13 || age > 100)             return res.status(400).json({ success: false, message: 'Idade inválida (13–100).' });
    if (heightCm < 100 || heightCm > 250)  return res.status(400).json({ success: false, message: 'Altura inválida (100–250 cm).' });
    if (currentWeightKg < 30 || currentWeightKg > 250) return res.status(400).json({ success: false, message: 'Peso inválido (30–250 kg).' });

    const targets = calculateFitnessTargets({ age, sex, heightCm, currentWeightKg, activityLevel, goal });

    const profile = await FitnessProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id, age, sex, heightCm, currentWeightKg, activityLevel, goal,
        dailyCaloriesTarget: targets.dailyCaloriesTarget,
        macrosTarget: targets.macros,
        manualTargets: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, profile, targets });
  } catch (err) {
    console.error('Erro ao criar perfil fitness:', err);
    res.status(500).json({ success: false, message: 'Erro ao guardar perfil.' });
  }
});

// PATCH /fitness/profile
router.patch('/profile', async (req, res) => {
  try {
    const allowed = ['age', 'sex', 'heightCm', 'currentWeightKg', 'activityLevel', 'goal'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const profile = await FitnessProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true }
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado.' });

    // Recalcular metas se não forem manuais
    if (!profile.manualTargets) {
      const targets = calculateFitnessTargets({
        age: profile.age, sex: profile.sex,
        heightCm: profile.heightCm, currentWeightKg: profile.currentWeightKg,
        activityLevel: profile.activityLevel, goal: profile.goal,
      });
      if (targets) {
        profile.dailyCaloriesTarget = targets.dailyCaloriesTarget;
        profile.macrosTarget = targets.macros;
        await profile.save();
      }
    }

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar perfil.' });
  }
});

// POST /fitness/recalculate-targets
router.post('/recalculate-targets', async (req, res) => {
  try {
    const profile = await FitnessProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado.' });

    const targets = calculateFitnessTargets({
      age: profile.age, sex: profile.sex,
      heightCm: profile.heightCm, currentWeightKg: profile.currentWeightKg,
      activityLevel: profile.activityLevel, goal: profile.goal,
    });
    if (!targets) return res.status(400).json({ success: false, message: 'Dados insuficientes para calcular.' });

    profile.dailyCaloriesTarget = targets.dailyCaloriesTarget;
    profile.macrosTarget = targets.macros;
    profile.manualTargets = false;
    await profile.save();

    res.json({ success: true, targets, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao recalcular metas.' });
  }
});

// PATCH /fitness/targets — editar metas manualmente
router.patch('/targets', async (req, res) => {
  try {
    const { dailyCaloriesTarget, protein, carbs, fat } = req.body;
    const profile = await FitnessProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado.' });

    if (dailyCaloriesTarget !== undefined) profile.dailyCaloriesTarget = dailyCaloriesTarget;
    if (protein !== undefined) profile.macrosTarget.protein = protein;
    if (carbs   !== undefined) profile.macrosTarget.carbs   = carbs;
    if (fat     !== undefined) profile.macrosTarget.fat     = fat;
    profile.manualTargets = true;
    await profile.save();

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar metas.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LOG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /fitness/daily-log?date=YYYY-MM-DD
router.get('/daily-log', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const log = await DailyNutritionLog.findOne({ userId: req.user._id, date });

    const profile = await FitnessProfile.findOne({ userId: req.user._id });
    const streak  = await FitnessStreak.findOne({ userId: req.user._id });

    res.json({
      success: true,
      log: log || { date, caloriesConsumed: 0, macrosConsumed: { protein: 0, carbs: 0, fat: 0 }, entries: [] },
      targets: profile ? { calories: profile.dailyCaloriesTarget, macros: profile.macrosTarget } : null,
      streak: streak || { currentStreak: 0, bestStreak: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao obter log diário.' });
  }
});

// POST /fitness/daily-log/entry — adicionar entrada (refeição ou snack)
router.post('/daily-log/entry', async (req, res) => {
  try {
    const { type, name, calories, macros, mealType, loggedAt, sourceId } = req.body;
    if (!type || !name) return res.status(400).json({ success: false, message: 'type e name são obrigatórios.' });

    const date = (loggedAt || todayStr()).toString().split('T')[0];

    let log = await DailyNutritionLog.findOne({ userId: req.user._id, date });
    if (!log) {
      log = new DailyNutritionLog({ userId: req.user._id, date });
    }

    const entry = { type, name, calories: calories || 0, macros: macros || { protein: 0, carbs: 0, fat: 0 }, mealType, loggedAt: loggedAt ? new Date(loggedAt) : new Date(), sourceId };
    log.entries.push(entry);
    recalcTotals(log);
    await log.save();

    // Atualizar streak
    const streak = await updateStreak(req.user._id);

    res.status(201).json({ success: true, log, streak });
  } catch (err) {
    console.error('Erro ao adicionar entrada:', err);
    res.status(500).json({ success: false, message: 'Erro ao registar entrada.' });
  }
});

// PATCH /fitness/daily-log/entry/:entryId
router.patch('/daily-log/entry/:entryId', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const log = await DailyNutritionLog.findOne({ userId: req.user._id, date });
    if (!log) return res.status(404).json({ success: false, message: 'Log não encontrado.' });

    const entry = log.entries.id(req.params.entryId);
    if (!entry) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });

    const { name, calories, macros, mealType } = req.body;
    if (name     !== undefined) entry.name     = name;
    if (calories !== undefined) entry.calories = calories;
    if (macros   !== undefined) entry.macros   = { ...entry.macros.toObject(), ...macros };
    if (mealType !== undefined) entry.mealType = mealType;

    recalcTotals(log);
    await log.save();
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao editar entrada.' });
  }
});

// DELETE /fitness/daily-log/entry/:entryId
router.delete('/daily-log/entry/:entryId', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const log = await DailyNutritionLog.findOne({ userId: req.user._id, date });
    if (!log) return res.status(404).json({ success: false, message: 'Log não encontrado.' });

    log.entries = log.entries.filter((e) => e._id.toString() !== req.params.entryId);
    recalcTotals(log);
    await log.save();
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover entrada.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SNACKS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /fitness/snacks
router.get('/snacks', async (req, res) => {
  try {
    const snacks = await SnackItem.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, snacks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao obter snacks.' });
  }
});

// POST /fitness/snacks
router.post('/snacks', async (req, res) => {
  try {
    const { name, quantity, caloriesPerUnit, macrosPerUnit, source } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });

    const snack = await SnackItem.create({
      userId: req.user._id, name, quantity, caloriesPerUnit, macrosPerUnit, source: source || 'manual',
    });
    res.status(201).json({ success: true, snack });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao criar snack.' });
  }
});

// PATCH /fitness/snacks/:id
router.patch('/snacks/:id', async (req, res) => {
  try {
    const snack = await SnackItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    );
    if (!snack) return res.status(404).json({ success: false, message: 'Snack não encontrado.' });
    res.json({ success: true, snack });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar snack.' });
  }
});

// DELETE /fitness/snacks/:id
router.delete('/snacks/:id', async (req, res) => {
  try {
    await SnackItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao apagar snack.' });
  }
});

// POST /fitness/snacks/log — registar consumo de snack no daily log
router.post('/snacks/log', async (req, res) => {
  try {
    const { snackId, calories, macros, name } = req.body;
    const today = todayStr();

    let log = await DailyNutritionLog.findOne({ userId: req.user._id, date: today });
    if (!log) log = new DailyNutritionLog({ userId: req.user._id, date: today });

    const entryName = name || (snackId ? (await SnackItem.findById(snackId))?.name : 'Snack');
    log.entries.push({
      type: 'snack', name: entryName || 'Snack',
      calories: calories || 0, macros: macros || { protein: 0, carbs: 0, fat: 0 },
      mealType: 'snack', loggedAt: new Date(), sourceId: snackId || null,
    });
    recalcTotals(log);
    await log.save();

    const streak = await updateStreak(req.user._id);
    res.status(201).json({ success: true, log, streak });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao registar snack.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STREAK
// ═══════════════════════════════════════════════════════════════════════════════

// GET /fitness/streak
router.get('/streak', async (req, res) => {
  try {
    const streak = await FitnessStreak.findOne({ userId: req.user._id });
    res.json({ success: true, streak: streak || { currentStreak: 0, bestStreak: 0, lastActiveDate: null } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao obter streak.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESSO CORPORAL
// ═══════════════════════════════════════════════════════════════════════════════

// GET /fitness/progress
router.get('/progress', async (req, res) => {
  try {
    const entries = await BodyProgress.find({ userId: req.user._id }).sort({ date: 1 });
    const profile = await FitnessProfile.findOne({ userId: req.user._id });
    res.json({ success: true, entries, initialWeight: profile?.currentWeightKg || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao obter progresso.' });
  }
});

// POST /fitness/progress
router.post('/progress', async (req, res) => {
  try {
    const { weightKg, notes } = req.body;
    if (!weightKg || weightKg < 30 || weightKg > 250) {
      return res.status(400).json({ success: false, message: 'Peso inválido (30–250 kg).' });
    }
    const date = todayStr();

    // Verificar se já existe registo hoje
    const existing = await BodyProgress.findOne({ userId: req.user._id, date });
    if (existing) {
      existing.weightKg = weightKg;
      existing.notes = notes || existing.notes;
      await existing.save();
      return res.json({ success: true, entry: existing, updated: true });
    }

    const entry = await BodyProgress.create({ userId: req.user._id, weightKg, date, notes: notes || '' });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao guardar peso.' });
  }
});

// DELETE /fitness/progress/:id
router.delete('/progress/:id', async (req, res) => {
  try {
    await BodyProgress.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao apagar registo.' });
  }
});

module.exports = router;
