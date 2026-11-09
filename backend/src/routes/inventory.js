const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const { protect } = require('../middleware/auth');
const { parseInventoryDescription, estimateExpiry, normalizeProductName } = require('../services/inventoryParser');
const { parseReceiptWithDocumentAI } = require('../services/documentAiReceiptParser');
const { classifyReceiptItems } = require('../services/receiptClassifier');
const User = require('../models/User');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(protect);

// Helper: calcular prioridade
function calcPriority(expiryDays) {
  if (!expiryDays) return 'pode_esperar';
  if (expiryDays <= 1) return 'usar_hoje';
  if (expiryDays <= 4) return 'usar_breve';
  if (expiryDays <= 30) return 'pode_esperar';
  return 'stock';
}

// ─── POST /inventory/parse ────────────────────────────────────────────────────
// Mock IA: recebe descrição e devolve JSON estruturado
router.post('/parse', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Descreve melhor o que tens em casa. Mínimo 10 caracteres.',
      });
    }

    if (description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Descrição demasiado longa. Máximo 1000 caracteres.',
      });
    }

    // Verificar se a descrição é demasiado vaga
    const vaguePatterns = /^(tenho comida|tenho coisas|tenho tudo|tenho nada)$/i;
    if (vaguePatterns.test(description.trim())) {
      return res.status(422).json({
        success: false,
        message: 'A descrição está muito vaga. Tenta mencionar produtos específicos, como leite, frango, arroz…',
        code: 'DESCRIPTION_TOO_VAGUE',
      });
    }

    const result = parseInventoryDescription(description);

    if (result.totalItems === 0) {
      return res.status(422).json({
        success: false,
        message: 'Não consegui identificar produtos. Tenta ser mais específico, por exemplo: "tenho leite, ovos, frango congelado e arroz".',
        code: 'NO_ITEMS_FOUND',
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro no parse:', error);
    res.status(500).json({ success: false, message: 'Erro ao processar descrição.' });
  }
});

// ─── POST /inventory/scan-receipt ────────────────────────────────────────────
// 1. Document AI extrai produtos do recibo
// 2. Claude classifica cada produto (ingrediente / snack / refeicao_pre_feita / ignorar)
router.post('/scan-receipt', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Imagem em base64 é obrigatória.' });
    }

    const productNames = await parseReceiptWithDocumentAI(image, mimeType || 'image/jpeg');

    if (!productNames || productNames.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Não detetámos produtos neste recibo. O recibo está legível?',
        code: 'NO_PRODUCTS_FOUND',
      });
    }

    const items = await classifyReceiptItems(productNames);

    res.json({ success: true, items });
  } catch (error) {
    console.error('[scan-receipt] Erro:', error.message);
    res.status(500).json({
      success: false,
      message: 'Não foi possível ler o recibo. Tenta novamente.',
      code: 'DOCUMENT_AI_ERROR',
    });
  }
});

// ─── POST /inventory/bulk ─────────────────────────────────────────────────────
// Guardar vários items de uma vez (após parse da IA)
router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Lista de items inválida.' });
    }

    const userId = req.user._id;
    const toInsert = items.map((item) => ({ ...item, userId }));
    const created = await InventoryItem.insertMany(toInsert);

    // Marcar utilizador como tendo inventário
    await User.findByIdAndUpdate(userId, { hasInventory: true, hasCompletedOnboarding: true });

    res.status(201).json({ success: true, items: created, totalItems: created.length });
  } catch (error) {
    console.error('Erro no bulk insert:', error);
    res.status(500).json({ success: false, message: 'Erro ao guardar inventário.' });
  }
});

// ─── GET /inventory ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const items = await InventoryItem.find({
      userId: req.user._id,
      isActive: true,
    }).sort({ priority: 1, expiresAt: 1 });

    // Agrupar por local
    const grouped = {
      frigorifico: [],
      despensa: [],
      congelador: [],
    };

    const urgentItems = [];
    const nowMs = Date.now();

    // Recalcular dias restantes reais a partir de expiresAt
    // estimatedExpiryDays é guardado na criação — fica desatualizado com o tempo
    const itemsWithRealExpiry = items.map((item) => {
      const obj = item.toObject();
      if (obj.expiresAt) {
        const msLeft = new Date(obj.expiresAt).getTime() - nowMs;
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        obj.estimatedExpiryDays = daysLeft;
        obj.priority = calcPriority(daysLeft);
      }
      return obj;
    });

    for (const item of itemsWithRealExpiry) {
      const loc = item.location === 'frigorífico' ? 'frigorifico' : item.location;
      if (grouped[loc]) grouped[loc].push(item);
      if (['usar_hoje', 'usar_breve'].includes(item.priority)) urgentItems.push(item);
    }

    // Ordenar cada grupo por prioridade
    const priorityOrder = { usar_hoje: 0, usar_breve: 1, pode_esperar: 2, stock: 3 };
    for (const loc of Object.keys(grouped)) {
      grouped[loc].sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
    }

    res.json({
      success: true,
      items: itemsWithRealExpiry,
      grouped,
      urgentItems,
      totalItems: itemsWithRealExpiry.length,
    });
  } catch (error) {
    console.error('Erro ao buscar inventário:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar inventário.' });
  }
});

// ─── POST /inventory ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, location, state, quantity, notes } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome do produto inválido.' });
    }
    if (!location) {
      return res.status(400).json({ success: false, message: 'Local é obrigatório.' });
    }

    // Verificar produto semelhante
    const normalizedName = normalizeProductName(name);
    const existing = await InventoryItem.findOne({
      userId: req.user._id,
      normalizedName,
      isActive: true,
    });

    // Estimar validade com localização e estado corretos
    const effectiveState = state || (location === 'congelador' ? 'congelado' : 'fechado');
    const daysAgo = Math.max(0, parseInt(req.body.openedDaysAgo) || 0);
    let expiryDays = estimateExpiry(normalizedName, location, effectiveState, daysAgo);

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const priority = calcPriority(expiryDays);

    const capitalizeFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    const item = await InventoryItem.create({
      userId: req.user._id,
      name: capitalizeFirst(name.trim()),
      normalizedName,
      location,
      state: effectiveState,
      quantity: quantity || '',
      estimatedExpiryDays: expiryDays,
      expiresAt,
      priority,
      notes: notes || '',
      source: 'manual',
    });

    await User.findByIdAndUpdate(req.user._id, { hasInventory: true });

    res.status(201).json({
      success: true,
      item,
      warning: existing ? `Já tens "${existing.name}" no inventário.` : null,
    });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ success: false, message: 'Erro ao adicionar produto.' });
  }
});

// ─── GET /inventory/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao carregar produto.' });
  }
});

// ─── PATCH /inventory/:id ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { name, location, state, quantity, notes } = req.body;
    const item = await InventoryItem.findOne({ _id: req.params.id, userId: req.user._id });

    if (!item) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

    const locationChanged = location && location !== item.location;
    const stateChanged = state && state !== item.state;

    if (name) {
      item.name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      item.normalizedName = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    }
    if (location) item.location = location;
    if (state) {
      item.state = state;
      if (state === 'aberto' && !item.openedAt) item.openedAt = new Date();
    }
    if (quantity) item.quantity = quantity;
    if (notes !== undefined) item.notes = notes;

    // Recalcular validade se local ou estado mudou
    if (locationChanged || stateChanged) {
      const newExpiry = estimateExpiry(item.normalizedName, item.location, item.state);
      item.estimatedExpiryDays = newExpiry;
      item.expiresAt = new Date(Date.now() + newExpiry * 24 * 60 * 60 * 1000);
      item.priority = calcPriority(newExpiry);
    }

    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar produto.' });
  }
});

// ─── DELETE /inventory/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

    item.isActive = false;
    await item.save();

    // Verificar se ainda há items
    const count = await InventoryItem.countDocuments({ userId: req.user._id, isActive: true });
    if (count === 0) {
      await User.findByIdAndUpdate(req.user._id, { hasInventory: false });
    }

    res.json({ success: true, message: 'Produto removido.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao remover produto.' });
  }
});

module.exports = router;
