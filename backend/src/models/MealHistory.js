const mongoose = require('mongoose');

const mealHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mealId: { type: String, default: null },
    mealName: { type: String, required: true, trim: true },
    mealType: { type: String, default: null },
    source: {
      type: String,
      enum: ['user', 'web', 'suggested'],
      default: 'suggested',
    },
    servings: { type: Number, default: 1 },
    ingredientsUsed: [
      {
        name: { type: String },
        amount: { type: String, default: '' },
        urgent: { type: Boolean, default: false },
      },
    ],
    usedUrgentItems: { type: Boolean, default: false },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MealHistory', mealHistorySchema);
