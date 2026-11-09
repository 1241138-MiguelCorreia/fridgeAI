const mongoose = require('mongoose');

const snackItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: String, default: '1 unidade' },
    caloriesPerUnit: { type: Number, default: 0 },
    macrosPerUnit: {
      protein: { type: Number, default: 0 },
      carbs:   { type: Number, default: 0 },
      fat:     { type: Number, default: 0 },
    },
    source: {
      type: String,
      enum: ['manual', 'receipt', 'quick'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SnackItem', snackItemSchema);
