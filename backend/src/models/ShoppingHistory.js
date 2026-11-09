const mongoose = require('mongoose');

const historyItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    neededAmount: { type: String, default: '' },
    purchaseAmount: { type: String, default: '' },
    estimatedPrice: { type: Number, default: null }, // média para histórico
    checked: { type: Boolean, default: false },
    category: { type: String, default: 'manual' },
    linkedMealName: { type: String, default: null },
  },
  { _id: false }
);

const shoppingHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [historyItemSchema],
    checkedCount: { type: Number, default: 0 },
    totalEstimate: { type: Number, default: 0 },
    confirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShoppingHistory', shoppingHistorySchema);
