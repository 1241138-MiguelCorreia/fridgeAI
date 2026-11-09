const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['meal', 'snack', 'premade'], required: true },
    name: { type: String, required: true },
    calories: { type: Number, default: 0 },
    macros: {
      protein: { type: Number, default: 0 },
      carbs:   { type: Number, default: 0 },
      fat:     { type: Number, default: 0 },
    },
    mealType: { type: String, default: null },
    loggedAt: { type: Date, default: Date.now },
    sourceId: { type: String, default: null }, // meal id, snack id, etc.
  },
  { _id: true }
);

const dailyNutritionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    caloriesConsumed: { type: Number, default: 0 },
    macrosConsumed: {
      protein: { type: Number, default: 0 },
      carbs:   { type: Number, default: 0 },
      fat:     { type: Number, default: 0 },
    },
    entries: [entrySchema],
  },
  { timestamps: true }
);

// Índice composto para garantir um log por utilizador por dia
dailyNutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyNutritionLog', dailyNutritionLogSchema);
