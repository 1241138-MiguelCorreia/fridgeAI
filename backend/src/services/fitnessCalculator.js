/**
 * Fitness Calculator — calcula TDEE e macros com base no perfil do utilizador
 * Fórmula: Mifflin-St Jeor para BMR + multiplicador de atividade
 */

// ── Multiplicadores de atividade ─────────────────────────────────────────────
const ACTIVITY_MULTIPLIERS = {
  sedentario:             1.2,
  pouco_ativo:            1.375,
  moderadamente_ativo:    1.55,
  muito_ativo:            1.725,
  atleta:                 1.9,
};

// ── Calcular BMR (Mifflin-St Jeor) ───────────────────────────────────────────
function calculateBMR(sex, weightKg, heightCm, age) {
  // Homem: 10 × peso(kg) + 6.25 × altura(cm) − 5 × idade + 5
  // Mulher: 10 × peso(kg) + 6.25 × altura(cm) − 5 × idade − 161
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'masculino') return Math.round(base + 5);
  if (sex === 'feminino')  return Math.round(base - 161);
  // prefiro_nao_dizer: média
  return Math.round(base - 78);
}

// ── Calcular TDEE ─────────────────────────────────────────────────────────────
function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  return Math.round(bmr * multiplier);
}

// ── Ajuste calórico por objetivo ─────────────────────────────────────────────
function adjustCaloriesForGoal(tdee, goal) {
  switch (goal) {
    case 'perder_peso':            return Math.round(tdee * 0.85);  // défice ~15%
    case 'manter_peso':            return tdee;
    case 'ganhar_massa_muscular':  return Math.round(tdee * 1.10);  // excedente ~10%
    case 'mais_proteina':          return tdee;
    case 'melhorar_habitos':       return tdee;
    default:                       return tdee;
  }
}

// ── Calcular macros com base nas calorias e objetivo ─────────────────────────
function calculateMacros(calories, goal, weightKg) {
  let proteinRatio, carbRatio, fatRatio;

  switch (goal) {
    case 'perder_peso':
      // Maior proteína para preservar massa magra
      proteinRatio = 0.35;
      carbRatio    = 0.40;
      fatRatio     = 0.25;
      break;
    case 'ganhar_massa_muscular':
    case 'mais_proteina':
      // Foco em proteína
      proteinRatio = 0.30;
      carbRatio    = 0.47;
      fatRatio     = 0.23;
      break;
    case 'manter_peso':
    case 'melhorar_habitos':
    default:
      // Distribuição equilibrada
      proteinRatio = 0.25;
      carbRatio    = 0.50;
      fatRatio     = 0.25;
      break;
  }

  // Proteína mínima: 1.6g por kg de peso corporal (para fitness)
  const minProteinG = Math.round(weightKg * 1.6);
  const proteinFromRatio = Math.round((calories * proteinRatio) / 4);
  const proteinG = Math.max(minProteinG, proteinFromRatio);

  const proteinCalories = proteinG * 4;
  const remainingCalories = calories - proteinCalories;

  // Dividir calorias restantes entre hidratos e gordura
  const carbsFraction = carbRatio / (carbRatio + fatRatio);
  const carbsG = Math.round((remainingCalories * carbsFraction) / 4);
  const fatG   = Math.round((remainingCalories * (1 - carbsFraction)) / 9);

  return { protein: proteinG, carbs: carbsG, fat: fatG };
}

// ── Função principal ──────────────────────────────────────────────────────────
function calculateFitnessTargets({ age, sex, heightCm, currentWeightKg, activityLevel, goal }) {
  if (!age || !sex || !heightCm || !currentWeightKg || !activityLevel || !goal) {
    return null;
  }

  const bmr = calculateBMR(sex, currentWeightKg, heightCm, age);
  const tdee = calculateTDEE(bmr, activityLevel);
  const dailyCaloriesTarget = adjustCaloriesForGoal(tdee, goal);
  const macros = calculateMacros(dailyCaloriesTarget, goal, currentWeightKg);

  return {
    bmr,
    tdee,
    dailyCaloriesTarget,
    macros,
  };
}

// ── fitnessScore para sugestões de refeições ─────────────────────────────────
// Avalia quão bem uma refeição serve o objetivo do dia
function computeFitnessScore({ meal, fitnessProfile, caloriesConsumed, macrosConsumed }) {
  if (!fitnessProfile || !fitnessProfile.dailyCaloriesTarget) return 50;

  const caloriesTarget = fitnessProfile.dailyCaloriesTarget;
  const macrosTarget   = fitnessProfile.macrosTarget || {};

  const caloriesRemaining = caloriesTarget - (caloriesConsumed || 0);
  const proteinRemaining  = (macrosTarget.protein || 150) - ((macrosConsumed || {}).protein || 0);

  const mealCalories = meal.calories || 0;
  const mealProtein  = (meal.macros || {}).protein || 0;

  let score = 50;

  // Encaixa nas calorias restantes?
  if (mealCalories > 0 && caloriesRemaining > 0) {
    const caloriesFit = mealCalories / caloriesRemaining;
    if (caloriesFit >= 0.2 && caloriesFit <= 1.0) score += 20;
    else if (caloriesFit > 1.0) score -= 15; // ultrapassa meta
    else score += 5;
  }

  // Contribui para proteína?
  if (mealProtein > 0 && proteinRemaining > 0) {
    const proteinFit = mealProtein / proteinRemaining;
    if (proteinFit >= 0.2) score += 20;
    else score += 5;
  }

  // Bonus por objetivo
  const goal = fitnessProfile.goal;
  if ((goal === 'ganhar_massa_muscular' || goal === 'mais_proteina') && mealProtein >= 20) score += 10;
  if (goal === 'perder_peso' && mealCalories > 0 && mealCalories <= 500) score += 10;

  return Math.min(100, Math.max(0, score));
}

module.exports = { calculateFitnessTargets, computeFitnessScore };
