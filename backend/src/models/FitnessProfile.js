const mongoose = require('mongoose');

const fitnessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    age: { type: Number, min: 13, max: 100 },
    sex: { type: String, enum: ['masculino', 'feminino', 'prefiro_nao_dizer'] },
    heightCm: { type: Number, min: 100, max: 250 },
    currentWeightKg: { type: Number, min: 30, max: 250 },
    activityLevel: {
      type: String,
      enum: ['sedentario', 'pouco_ativo', 'moderadamente_ativo', 'muito_ativo', 'atleta'],
    },
    goal: {
      type: String,
      enum: ['perder_peso', 'manter_peso', 'ganhar_massa_muscular', 'mais_proteina', 'melhorar_habitos'],
    },
    // Metas calculadas ou manuais
    dailyCaloriesTarget: { type: Number, default: null },
    macrosTarget: {
      protein: { type: Number, default: null },
      carbs:   { type: Number, default: null },
      fat:     { type: Number, default: null },
    },
    manualTargets: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FitnessProfile', fitnessProfileSchema);
