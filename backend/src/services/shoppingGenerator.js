const InventoryItem = require('../models/InventoryItem');
const Recipe = require('../models/Recipe');
const { suggestMeals } = require('./mealSuggester');
const User = require('../models/User');

// ── Tabela de preços por keyword: [min, max] em euros ─────────────────────────
const PRICE_LOOKUP = [
  { keywords: ['frango', 'chicken'],                       min: 3.5,  max: 6.0  },
  { keywords: ['carne', 'novilho', 'vaca', 'bife'],        min: 5.0,  max: 12.0 },
  { keywords: ['peixe', 'salmao', 'bacalhau', 'pescada'],  min: 4.0,  max: 10.0 },
  { keywords: ['atum'],                                    min: 1.2,  max: 2.5  },
  { keywords: ['massa', 'esparguete', 'penne', 'fusilli'], min: 0.6,  max: 1.8  },
  { keywords: ['arroz'],                                   min: 0.9,  max: 2.0  },
  { keywords: ['ovos', 'ovo'],                             min: 1.5,  max: 3.5  },
  { keywords: ['leite'],                                   min: 0.7,  max: 1.5  },
  { keywords: ['iogurte'],                                 min: 1.0,  max: 2.5  },
  { keywords: ['queijo'],                                  min: 2.0,  max: 5.0  },
  { keywords: ['manteiga'],                                min: 1.5,  max: 3.0  },
  { keywords: ['azeite', 'oleo'],                          min: 2.5,  max: 7.0  },
  { keywords: ['tomate'],                                  min: 0.8,  max: 2.0  },
  { keywords: ['cebola'],                                  min: 0.5,  max: 1.5  },
  { keywords: ['alho'],                                    min: 0.4,  max: 1.2  },
  { keywords: ['batata'],                                  min: 0.8,  max: 2.0  },
  { keywords: ['cenoura'],                                 min: 0.5,  max: 1.5  },
  { keywords: ['alface', 'salada'],                        min: 0.6,  max: 1.5  },
  { keywords: ['banana'],                                  min: 0.6,  max: 1.5  },
  { keywords: ['maca'],                                    min: 0.8,  max: 2.0  },
  { keywords: ['laranja'],                                 min: 0.8,  max: 2.0  },
  { keywords: ['pao', 'baguete'],                          min: 0.3,  max: 1.5  },
  { keywords: ['cafe'],                                    min: 2.0,  max: 5.0  },
  { keywords: ['cha'],                                     min: 1.0,  max: 3.0  },
  { keywords: ['sumo'],                                    min: 1.0,  max: 3.0  },
  { keywords: ['agua'],                                    min: 0.3,  max: 1.0  },
  { keywords: ['sal'],                                     min: 0.3,  max: 1.0  },
  { keywords: ['acucar'],                                  min: 0.8,  max: 2.0  },
  { keywords: ['farinha'],                                 min: 0.5,  max: 1.5  },
  { keywords: ['natas'],                                   min: 0.8,  max: 2.0  },
  { keywords: ['cogumelo'],                                min: 1.5,  max: 3.0  },
  { keywords: ['brocolo'],                                 min: 0.8,  max: 2.0  },
  { keywords: ['espinafre'],                               min: 0.8,  max: 2.0  },
  { keywords: ['grao'],                                    min: 0.8,  max: 1.8  },
  { keywords: ['feijao'],                                  min: 0.7,  max: 1.6  },
  { keywords: ['salmao'],                                  min: 4.5,  max: 9.0  },
];

// ── Quantidades normais de compra no supermercado ─────────────────────────────
const PURCHASE_AMOUNTS = [
  { keywords: ['arroz'],                                default: '1kg',      options: ['500g', '1kg', '2kg']         },
  { keywords: ['massa', 'esparguete', 'penne','fusilli'], default: '500g',   options: ['500g', '1kg']                 },
  { keywords: ['leite'],                                default: '1L',       options: ['1L', '1.5L', '2L']            },
  { keywords: ['ovos', 'ovo'],                          default: '6 un.',    options: ['6 un.', '12 un.']              },
  { keywords: ['farinha'],                              default: '1kg',      options: ['1kg', '2kg']                  },
  { keywords: ['acucar'],                               default: '1kg',      options: ['1kg', '2kg']                  },
  { keywords: ['natas'],                                default: '200ml',    options: ['200ml', '400ml']              },
  { keywords: ['queijo'],                               default: '200g',     options: ['150g', '200g', '400g']        },
  { keywords: ['frango'],                               default: '1kg',      options: ['500g', '1kg', '1.5kg']        },
  { keywords: ['carne', 'picada', 'novilho', 'vaca'],   default: '500g',    options: ['500g', '1kg']                 },
  { keywords: ['salmao', 'salmon'],                     default: '400g',     options: ['400g', '500g']                },
  { keywords: ['atum'],                                 default: '1 lata',   options: ['1 lata', '2 latas', '3 latas'] },
  { keywords: ['bacalhau'],                             default: '500g',     options: ['400g', '500g', '1kg']         },
  { keywords: ['tomate'],                               default: '500g',     options: ['400g', '500g', '1kg']         },
  { keywords: ['banana'],                               default: '1kg',      options: ['1 un.', '500g', '1kg']        },
  { keywords: ['maca'],                                 default: '1kg',      options: ['1 un.', '500g', '1kg']        },
  { keywords: ['laranja'],                              default: '1kg',      options: ['1 un.', '500g', '1kg']        },
  { keywords: ['iogurte'],                              default: '4 un.',    options: ['1 un.', '4 un.', '8 un.']     },
  { keywords: ['azeite'],                               default: '750ml',    options: ['500ml', '750ml', '1L']        },
  { keywords: ['oleo'],                                 default: '1L',       options: ['750ml', '1L']                 },
  { keywords: ['manteiga'],                             default: '250g',     options: ['250g', '500g']                },
  { keywords: ['sal'],                                  default: '1kg',      options: ['500g', '1kg']                 },
  { keywords: ['pao'],                                  default: '1 un.',    options: ['1 un.', '2 un.']              },
  { keywords: ['batata'],                               default: '1kg',      options: ['500g', '1kg', '2kg']          },
  { keywords: ['cenoura'],                              default: '500g',     options: ['500g', '1kg']                 },
  { keywords: ['cebola'],                               default: '1kg',      options: ['500g', '1kg', '2kg']          },
  { keywords: ['alho'],                                 default: '1 cabeça', options: ['1 cabeça', '2 cabeças']       },
  { keywords: ['cogumelo'],                             default: '200g',     options: ['200g', '400g']                },
  { keywords: ['espinafre'],                            default: '200g',     options: ['200g', '400g']                },
  { keywords: ['brocolo'],                              default: '1 un.',    options: ['1 un.', '500g']               },
  { keywords: ['grao', 'feijao', 'lentilha'],           default: '400g',     options: ['400g', '800g']                },
];

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Devolve { min, max } em euros para a embalagem standard do produto
function estimatePriceRange(name) {
  if (!name) return { min: 1.0, max: 2.0 };
  const n = normalize(name);
  for (const entry of PRICE_LOOKUP) {
    for (const kw of entry.keywords) {
      if (n.includes(kw)) return { min: entry.min, max: entry.max };
    }
  }
  return { min: 1.0, max: 2.0 };
}

// Devolve a quantidade padrão de compra (ex: 1kg) dado o nome do produto
function getDefaultPurchaseAmount(name) {
  if (!name) return '1 un.';
  const n = normalize(name);
  for (const entry of PURCHASE_AMOUNTS) {
    for (const kw of entry.keywords) {
      if (n.includes(kw)) return entry.default;
    }
  }
  return '1 un.';
}

// Devolve as opções comuns de quantidade para um produto (usado no frontend)
function getCommonPurchaseOptions(name) {
  if (!name) return ['1 un.', '500g', '1kg'];
  const n = normalize(name);
  for (const entry of PURCHASE_AMOUNTS) {
    for (const kw of entry.keywords) {
      if (n.includes(kw)) return entry.options;
    }
  }
  return ['1 un.', '500g', '1kg'];
}

function guessLocation(normalizedName) {
  const n = (normalizedName || '').toLowerCase();
  const fridge  = ['leite', 'iogurte', 'queijo', 'manteiga', 'ovos', 'ovo', 'natas', 'fiambre', 'chourico', 'tomate', 'alface', 'cenoura', 'aipo', 'couve', 'pepino', 'pimento', 'limao', 'laranja', 'maca', 'sumo'];
  const freezer = ['frango', 'carne', 'peixe', 'salmao', 'bacalhau', 'pescada', 'gelado', 'congelado'];
  if (fridge.some((kw) => n.includes(kw))) return 'frigorífico';
  if (freezer.some((kw) => n.includes(kw))) return 'congelador';
  return 'despensa';
}

const STAPLES = [
  { name: 'Azeite',   purchaseAmount: '750ml', reason: 'Essencial na cozinha' },
  { name: 'Sal',      purchaseAmount: '1kg',   reason: 'Essencial na cozinha' },
  { name: 'Arroz',    purchaseAmount: '1kg',   reason: 'Cereal base' },
  { name: 'Massa',    purchaseAmount: '500g',  reason: 'Cereal base' },
  { name: 'Cebola',   purchaseAmount: '1kg',   reason: 'Base de cozinha' },
  { name: 'Alho',     purchaseAmount: '1 cabeça', reason: 'Tempero essencial' },
  { name: 'Ovos',     purchaseAmount: '6 un.', reason: 'Proteína versátil' },
  { name: 'Leite',    purchaseAmount: '1L',    reason: 'Lácteo base' },
  { name: 'Tomate',   purchaseAmount: '500g',  reason: 'Vegetal polivalente' },
  { name: 'Cenoura',  purchaseAmount: '500g',  reason: 'Vegetal polivalente' },
];

async function generateList(userId) {
  const [user, inventoryItems, userRecipes] = await Promise.all([
    User.findById(userId),
    InventoryItem.find({ userId, isActive: true }),
    Recipe.find({ userId, isActive: true }).catch(() => []),
  ]);

  const inventoryMap = new Map();
  for (const item of inventoryItems) {
    inventoryMap.set(normalize(item.normalizedName || item.name), item);
  }

  const essenciais = [];
  const reposicao  = [];
  const sugestoes  = [];
  const seenNames  = new Set();

  // ─── Essenciais: ingredientes em falta para as refeições sugeridas ────────────
  try {
    const suggestions = suggestMeals({
      inventoryItems,
      restrictions: user?.restrictions || [],
      allergies:    user?.allergies || '',
      servings:     user?.servings || 2,
      userRecipes:  userRecipes || [],
      mealType:     null,
    });

    // Mapa: normalizedName → primeiro item encontrado em falta
    const missingMap = new Map();

    for (const meal of suggestions) {
      const allIng = [...(meal.ingredients || []), ...(meal.optionalIngredients || [])];
      for (const ing of allIng) {
        if (!ing.hasIt || ing.insufficientQty) {
          const key = normalize(ing.name);
          if (!missingMap.has(key)) {
            missingMap.set(key, {
              name:          ing.name.charAt(0).toUpperCase() + ing.name.slice(1),
              neededAmount:  ing.amount || '',
              reason:        `Para: ${meal.name}`,
              linkedMealId:  meal.id || null,
              linkedMealName: meal.name,
            });
          }
        }
      }
    }

    let idx = 0;
    for (const [key, data] of missingMap) {
      const invItem = inventoryMap.get(key);
      const hasInStock = !!invItem;
      seenNames.add(key);

      const purchaseAmount = getDefaultPurchaseAmount(data.name);
      const price = estimatePriceRange(key);

      essenciais.push({
        itemId:          `ess_${idx++}`,
        name:            data.name,
        neededAmount:    data.neededAmount,
        purchaseAmount,
        unitPriceAmount: purchaseAmount,
        estimatedPrice:  price,
        reason:          data.reason,
        category:        'essenciais',
        checked:         false,
        hasInStock,
        inventoryItemId: invItem ? String(invItem._id) : null,
        linkedMealId:    data.linkedMealId,
        linkedMealName:  data.linkedMealName,
      });
    }
  } catch (_) {}

  // ─── Reposição: itens urgentes/a acabar no inventário ───────────────────────
  const urgentItems = inventoryItems.filter(
    (i) => i.priority === 'usar_hoje' || i.priority === 'usar_breve'
  );
  for (const item of urgentItems) {
    const key = normalize(item.normalizedName || item.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const purchaseAmount = getDefaultPurchaseAmount(item.name);
    const price = estimatePriceRange(key);

    reposicao.push({
      itemId:          `rep_${item._id}`,
      name:            item.name,
      neededAmount:    item.quantity || purchaseAmount,
      purchaseAmount,
      unitPriceAmount: purchaseAmount,
      estimatedPrice:  price,
      reason:          item.priority === 'usar_hoje' ? 'Expira hoje — repor' : 'Expira em breve — repor',
      category:        'reposição',
      checked:         false,
      hasInStock:      true,
      inventoryItemId: String(item._id),
      linkedMealId:    null,
      linkedMealName:  null,
    });
  }

  // ─── Sugestões: staples em falta ─────────────────────────────────────────────
  for (const staple of STAPLES) {
    const key = normalize(staple.name);
    if (seenNames.has(key)) continue;
    const invItem = inventoryMap.get(key);
    if (invItem) continue;
    seenNames.add(key);

    const price = estimatePriceRange(key);

    sugestoes.push({
      itemId:          `sug_${key}`,
      name:            staple.name,
      neededAmount:    staple.purchaseAmount,
      purchaseAmount:  staple.purchaseAmount,
      unitPriceAmount: staple.purchaseAmount,
      estimatedPrice:  price,
      reason:          staple.reason,
      category:        'sugestões',
      checked:         false,
      hasInStock:      false,
      inventoryItemId: null,
      linkedMealId:    null,
      linkedMealName:  null,
    });
  }

  return { essenciais, reposicao, sugestoes };
}

module.exports = { generateList, estimatePriceRange, getDefaultPurchaseAmount, getCommonPurchaseOptions, guessLocation };
