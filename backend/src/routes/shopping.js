const express = require('express');
const { protect } = require('../middleware/auth');
const ShoppingList = require('../models/ShoppingList');
const ShoppingHistory = require('../models/ShoppingHistory');
const InventoryItem = require('../models/InventoryItem');
const User = require('../models/User');
const { generateList, estimatePriceRange, getDefaultPurchaseAmount, guessLocation } = require('../services/shoppingGenerator');
const { normalizeProductName, estimateExpiry } = require('../services/inventoryParser');

const router = express.Router();
router.use(protect);

const REGEN_COOLDOWN_MS = 60 * 1000;

function calcPriority(expiryDays) {
  if (!expiryDays) return 'pode_esperar';
  if (expiryDays <= 1) return 'usar_hoje';
  if (expiryDays <= 4) return 'usar_breve';
  if (expiryDays <= 30) return 'pode_esperar';
  return 'stock';
}

function avgPrice(estimatedPrice) {
  if (!estimatedPrice) return 0;
  const { min = 0, max = 0 } = estimatedPrice;
  return (min + max) / 2;
}

// ─── GET /shopping/list ───────────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    let list = await ShoppingList.findOne({ userId: req.user._id });

    if (!list) {
      const { essenciais, reposicao, sugestoes } = await generateList(req.user._id);
      list = await ShoppingList.create({
        userId: req.user._id,
        items: [...essenciais, ...reposicao, ...sugestoes],
        lastGeneratedAt: new Date(),
        lastRegeneratedAt: null,
      });
    }

    const cooldownRemaining = list.lastRegeneratedAt
      ? Math.max(0, REGEN_COOLDOWN_MS - (Date.now() - new Date(list.lastRegeneratedAt).getTime()))
      : 0;

    res.json({
      success: true,
      items: list.items,
      lastGeneratedAt: list.lastGeneratedAt,
      lastRegeneratedAt: list.lastRegeneratedAt,
      cooldownRemaining,
    });
  } catch (error) {
    console.error('Erro ao buscar lista:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar lista de compras.' });
  }
});

// ─── POST /shopping/list/regenerate ──────────────────────────────────────────
router.post('/list/regenerate', async (req, res) => {
  try {
    const list = await ShoppingList.findOne({ userId: req.user._id });

    if (list?.lastRegeneratedAt) {
      const elapsed = Date.now() - new Date(list.lastRegeneratedAt).getTime();
      if (elapsed < REGEN_COOLDOWN_MS) {
        const remaining = Math.ceil((REGEN_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          message: `Aguarda ${remaining} segundos antes de regenerar novamente.`,
          cooldownRemaining: REGEN_COOLDOWN_MS - elapsed,
        });
      }
    }

    const { essenciais, reposicao, sugestoes } = await generateList(req.user._id);
    const manualItems = list ? list.items.filter((i) => i.category === 'manual') : [];

    const updatedList = await ShoppingList.findOneAndUpdate(
      { userId: req.user._id },
      {
        items: [...essenciais, ...reposicao, ...sugestoes, ...manualItems],
        lastGeneratedAt: list?.lastGeneratedAt || new Date(),
        lastRegeneratedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      items: updatedList.items,
      lastGeneratedAt: updatedList.lastGeneratedAt,
      lastRegeneratedAt: updatedList.lastRegeneratedAt,
      cooldownRemaining: REGEN_COOLDOWN_MS,
    });
  } catch (error) {
    console.error('Erro ao regenerar lista:', error);
    res.status(500).json({ success: false, message: 'Erro ao regenerar lista.' });
  }
});

// ─── POST /shopping/list/items ────────────────────────────────────────────────
router.post('/list/items', async (req, res) => {
  try {
    const { name, neededAmount } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome inválido.' });
    }

    const normalizedSearch = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const invItem = await InventoryItem.findOne({
      userId: req.user._id,
      normalizedName: normalizedSearch,
      isActive: true,
    });

    const purchaseAmount = getDefaultPurchaseAmount(name);
    const estimatedPrice = estimatePriceRange(normalizedSearch);

    const newItem = {
      itemId: `manual_${Date.now()}`,
      name: name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase(),
      neededAmount: neededAmount || purchaseAmount,
      purchaseAmount,
      unitPriceAmount: purchaseAmount,
      estimatedPrice,
      reason: 'Adicionado manualmente',
      category: 'manual',
      checked: false,
      hasInStock: !!invItem,
      inventoryItemId: invItem ? String(invItem._id) : null,
      linkedMealId: null,
      linkedMealName: null,
    };

    const list = await ShoppingList.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { items: newItem } },
      { new: true, upsert: true }
    );

    res.status(201).json({ success: true, item: newItem, items: list.items });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ success: false, message: 'Erro ao adicionar item.' });
  }
});

// ─── PATCH /shopping/list/items/:itemId ──────────────────────────────────────
router.patch('/list/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { checked, name, purchaseAmount, neededAmount } = req.body;

    const list = await ShoppingList.findOne({ userId: req.user._id });
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada.' });

    const item = list.items.find((i) => i.itemId === itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado.' });

    if (checked !== undefined) item.checked = checked;
    if (name !== undefined) item.name = name;
    if (neededAmount !== undefined) item.neededAmount = neededAmount;
    if (purchaseAmount !== undefined) {
      item.purchaseAmount = purchaseAmount;
      item.unitPriceAmount = purchaseAmount;
      const normalized = (item.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      item.estimatedPrice = estimatePriceRange(normalized);
    }

    await list.save();
    res.json({ success: true, item, items: list.items });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar item.' });
  }
});

// ─── DELETE /shopping/list/items/:itemId ──────────────────────────────────────
router.delete('/list/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const list = await ShoppingList.findOneAndUpdate(
      { userId: req.user._id },
      { $pull: { items: { itemId } } },
      { new: true }
    );

    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada.' });

    res.json({ success: true, items: list.items });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover item.' });
  }
});

// ─── POST /shopping/confirm ───────────────────────────────────────────────────
router.post('/confirm', async (req, res) => {
  try {
    const list = await ShoppingList.findOne({ userId: req.user._id });
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada.' });

    const checkedItems = list.items.filter((i) => i.checked);
    if (checkedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Não há items selecionados.' });
    }

    const totalEstimate = checkedItems.reduce((sum, i) => sum + avgPrice(i.estimatedPrice), 0);

    await ShoppingHistory.create({
      userId: req.user._id,
      items: checkedItems.map((i) => ({
        name: i.name,
        neededAmount: i.neededAmount || '',
        purchaseAmount: i.purchaseAmount || '',
        estimatedPrice: parseFloat(avgPrice(i.estimatedPrice).toFixed(2)),
        checked: true,
        category: i.category,
        linkedMealName: i.linkedMealName || null,
      })),
      checkedCount: checkedItems.length,
      totalEstimate: parseFloat(totalEstimate.toFixed(2)),
    });

    const toInsert = checkedItems.map((item) => {
      const normalized = normalizeProductName(item.name);
      const location = guessLocation(normalized);
      const state = location === 'congelador' ? 'congelado' : 'fechado';
      const expiryDays = estimateExpiry(normalized, location, state, 0);
      return {
        userId: req.user._id,
        name: item.name,
        normalizedName: normalized,
        location,
        state,
        quantity: item.purchaseAmount || item.neededAmount || '',
        quantityAmount: item.purchaseAmount || '',
        originalPurchaseAmount: item.purchaseAmount || '',
        estimatedExpiryDays: expiryDays,
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        priority: calcPriority(expiryDays),
        linkedMealId: item.linkedMealId || null,
        linkedMealName: item.linkedMealName || null,
        neededAmountForMeal: item.neededAmount || null,
        source: 'shopping',
        isActive: true,
      };
    });

    if (toInsert.length > 0) {
      await InventoryItem.insertMany(toInsert);
      await User.findByIdAndUpdate(req.user._id, { hasInventory: true });
    }

    list.items = list.items.filter((i) => !i.checked);
    await list.save();

    res.json({
      success: true,
      addedToInventory: toInsert.length,
      totalEstimate: parseFloat(totalEstimate.toFixed(2)),
      remainingItems: list.items,
    });
  } catch (error) {
    console.error('Erro ao confirmar compras:', error);
    res.status(500).json({ success: false, message: 'Erro ao confirmar compras.' });
  }
});

// ─── GET /shopping/history ────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const history = await ShoppingHistory.find({ userId: req.user._id })
      .sort({ confirmedAt: -1 })
      .limit(20);

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao carregar histórico.' });
  }
});

// ─── GET /shopping/low-stock ──────────────────────────────────────────────────
router.get('/low-stock', async (req, res) => {
  try {
    const items = await InventoryItem.find({
      userId: req.user._id,
      isActive: true,
      priority: { $in: ['usar_hoje', 'usar_breve'] },
    }).sort({ priority: 1, expiresAt: 1 });

    res.json({ success: true, items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao carregar itens em falta.' });
  }
});

// ─── POST /shopping/low-stock/add ────────────────────────────────────────────
router.post('/low-stock/add', async (req, res) => {
  try {
    const { inventoryItemId } = req.body;
    if (!inventoryItemId) {
      return res.status(400).json({ success: false, message: 'inventoryItemId obrigatório.' });
    }

    const invItem = await InventoryItem.findOne({ _id: inventoryItemId, userId: req.user._id });
    if (!invItem) return res.status(404).json({ success: false, message: 'Item não encontrado.' });

    const purchaseAmount = getDefaultPurchaseAmount(invItem.name);
    const estimatedPrice = estimatePriceRange(invItem.normalizedName || invItem.name);

    const newItem = {
      itemId: `ls_${invItem._id}_${Date.now()}`,
      name: invItem.name,
      neededAmount: invItem.quantity || purchaseAmount,
      purchaseAmount,
      unitPriceAmount: purchaseAmount,
      estimatedPrice,
      reason: 'Repor — a acabar',
      category: 'reposição',
      checked: false,
      hasInStock: true,
      inventoryItemId: String(invItem._id),
      linkedMealId: null,
      linkedMealName: null,
    };

    const list = await ShoppingList.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { items: newItem } },
      { new: true, upsert: true }
    );

    res.status(201).json({ success: true, item: newItem, items: list.items });
  } catch (error) {
    console.error('Erro ao adicionar item de reposição:', error);
    res.status(500).json({ success: false, message: 'Erro ao adicionar item.' });
  }
});

module.exports = router;
