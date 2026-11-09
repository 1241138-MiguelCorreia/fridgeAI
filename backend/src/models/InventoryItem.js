const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
    },
    normalizedName: {
      type: String,
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      enum: ['frigorífico', 'despensa', 'congelador'],
      required: [true, 'Local é obrigatório'],
    },
    state: {
      type: String,
      enum: ['aberto', 'fechado', 'fresco', 'congelado', 'parcialmente_usado'],
      default: 'fechado',
    },
    quantity: {
      type: String,
      trim: true,
      default: '',
    },
    estimatedExpiryDays: {
      type: Number,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['usar_hoje', 'usar_breve', 'pode_esperar', 'stock'],
      default: 'pode_esperar',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    openedAt: {
      type: Date,
      default: null,
    },
    // Quantidade real comprada como string (ex: "1kg", "6 un.")
    quantityAmount: { type: String, trim: true, default: '' },
    // Guardado para histórico — igual a quantityAmount no momento da compra
    originalPurchaseAmount: { type: String, trim: true, default: '' },

    // Ligação opcional à refeição que originou a compra
    linkedMealId: { type: String, default: null },
    linkedMealName: { type: String, default: null },
    neededAmountForMeal: { type: String, default: null },

    source: {
      type: String,
      enum: ['ia', 'manual', 'receipt', 'shopping'],
      default: 'manual',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Índice para queries comuns
inventoryItemSchema.index({ userId: 1, location: 1, priority: 1 });
inventoryItemSchema.index({ userId: 1, isActive: 1 });

// Calcular prioridade automaticamente
inventoryItemSchema.methods.calculatePriority = function () {
  if (!this.estimatedExpiryDays) return 'pode_esperar';
  if (this.estimatedExpiryDays <= 1) return 'usar_hoje';
  if (this.estimatedExpiryDays <= 4) return 'usar_breve';
  if (this.estimatedExpiryDays <= 30) return 'pode_esperar';
  return 'stock';
};

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
