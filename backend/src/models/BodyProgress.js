const mongoose = require('mongoose');

const bodyProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    weightKg: { type: Number, required: true, min: 30, max: 250 },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    notes: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

bodyProgressSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('BodyProgress', bodyProgressSchema);
