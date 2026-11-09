require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const mealsRoutes = require('./routes/meals');
const shoppingRoutes = require('./routes/shopping');
const placesRoutes = require('./routes/places');
const fitnessRoutes = require('./routes/fitness');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/meals', mealsRoutes);
app.use('/shopping', shoppingRoutes);
app.use('/places', placesRoutes);
app.use('/fitness', fitnessRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Rota não encontrada.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
});

// ── Conectar ao MongoDB e iniciar servidor ────────────────────────────────────
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/typeshitcode';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado ao MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor a correr em http://0.0.0.0:${PORT} (acessível em toda a rede)`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar ao MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
