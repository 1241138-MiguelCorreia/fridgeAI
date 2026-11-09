const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Gerar JWT
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validações
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nome, email e palavra-passe são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'As palavras-passe não coincidem.' });
    }

    // Verificar email duplicado
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Este email já está registado.' });
    }

    const user = await User.create({ name, email, password });
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isAuthenticated: true,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        hasInventory: user.hasInventory,
        mode: user.mode,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ success: false, message: 'Erro interno. Tenta novamente.' });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email e palavra-passe são obrigatórios.' });
    }

    // Buscar utilizador com password (select:false por defeito)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Email ou palavra-passe incorretos.' });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isAuthenticated: true,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        hasInventory: user.hasInventory,
        mode: user.mode,
        restrictions: user.restrictions,
        allergies: user.allergies,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, message: 'Erro interno. Tenta novamente.' });
  }
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
    }

    // Resposta genérica por segurança (não revelar se email existe)
    await User.findOne({ email: email.toLowerCase() });

    res.json({
      success: true,
      message: 'Se este email estiver registado, vais receber instruções para recuperar a palavra-passe.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro interno. Tenta novamente.' });
  }
});

// ─── PATCH /auth/mode ─────────────────────────────────────────────────────────
router.patch('/mode', protect, async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['normal', 'fitness'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Modo inválido.' });
    }

    req.user.mode = mode;
    if (mode === 'fitness' && !req.user.fitnessModeEnabledAt) {
      req.user.fitnessModeEnabledAt = new Date();
    }
    await req.user.save({ validateBeforeSave: false });

    res.json({ success: true, mode: req.user.mode, fitnessModeEnabledAt: req.user.fitnessModeEnabledAt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao guardar modo.' });
  }
});

// ─── PATCH /auth/restrictions ─────────────────────────────────────────────────
router.patch('/restrictions', protect, async (req, res) => {
  try {
    const { restrictions, allergies } = req.body;

    if (restrictions !== undefined) req.user.restrictions = restrictions;
    if (allergies !== undefined) req.user.allergies = allergies;

    // Marcar onboarding como completo após definir restrições
    req.user.hasCompletedOnboarding = true;
    await req.user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      restrictions: req.user.restrictions,
      allergies: req.user.allergies,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao guardar restrições.' });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isAuthenticated: true,
      hasCompletedOnboarding: req.user.hasCompletedOnboarding,
      hasInventory: req.user.hasInventory,
      mode: req.user.mode,
      restrictions: req.user.restrictions,
      allergies: req.user.allergies,
      createdAt: req.user.createdAt,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
});

module.exports = router;
