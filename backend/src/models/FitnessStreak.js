const mongoose = require('mongoose');

const fitnessStreakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentStreak: { type: Number, default: 0 },
    bestStreak:    { type: Number, default: 0 },
    lastActiveDate: { type: String, default: null }, // 'YYYY-MM-DD'
  },
  { timestamps: true }
);

module.exports = mongoose.model('FitnessStreak', fitnessStreakSchema);
