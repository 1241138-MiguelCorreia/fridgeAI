const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
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
    ingredients: {
      type: [ingredientSchema],
      validate: {
        validator: (v) => v.length >= 2,
        message: 'É necessário pelo menos 2 ingredientes.',
      },
    },
    time: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['fácil', 'médio', 'difícil'],
      default: 'fácil',
    },
    instructions: { type: [String], default: [] },
    notes: { type: String, default: '', trim: true },
    source: { type: String, enum: ['user'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', recipeSchema);
