const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    password: {
      type: String,
      required: [true, 'Palavra-passe é obrigatória'],
      minlength: [6, 'Mínimo 6 caracteres'],
      select: false,
    },
    mode: {
      type: String,
      enum: ['normal', 'fitness'],
      default: null,
    },
    restrictions: {
      type: [String],
      enum: ['vegetariano', 'vegano', 'sem_lactose', 'sem_gluten', 'alergias', 'nenhuma'],
      default: [],
    },
    allergies: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },
    hasInventory: {
      type: Boolean,
      default: false,
    },
    mealServings: {
      type: Number,
      default: null,
      min: 1,
      max: 20,
    },
    mealType: {
      type: String,
      enum: ['pequeno-almoco', 'almoco', 'jantar', 'snack', 'rapida', 'breakfast', 'lunch_dinner', null],
      default: null,
    },
    fitnessModeEnabledAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// Hash da palavra-passe antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Comparar palavra-passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
