const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    name: { type: String, required: true, trim: true },

    // Quantidade que a receita precisa
    neededAmount: { type: String, default: '' },
    // Quantidade normal de compra no supermercado (ex: 1kg mesmo que a receita precise 150g)
    purchaseAmount: { type: String, default: '' },
    // Quantidade usada para calcular o preço (normalmente igual a purchaseAmount)
    unitPriceAmount: { type: String, default: '' },

    // Preço estimado da embalagem normal comprada
    estimatedPrice: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },

    reason: { type: String, default: '' },
    category: {
      type: String,
      enum: ['essenciais', 'reposição', 'sugestões', 'manual'],
      required: true,
    },
    checked: { type: Boolean, default: false },
    hasInStock: { type: Boolean, default: false },
    inventoryItemId: { type: String, default: null },

    // Ligação à refeição que originou este item
    linkedMealId: { type: String, default: null },
    linkedMealName: { type: String, default: null },
  },
  { _id: false }
);

const shoppingListSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [shoppingItemSchema],
    lastGeneratedAt: { type: Date, default: null },
    lastRegeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShoppingList', shoppingListSchema);
