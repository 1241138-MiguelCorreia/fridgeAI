/**
 * receiptClassifier.js
 * Classifica produtos extraídos de um recibo via Google Gemini AI (gratuito).
 * Fallback baseado em keywords se a API não estiver disponível.
 */

const axios = require('axios');

const SYSTEM_PROMPT = `Tu és um assistente que classifica produtos de supermercado para uma app de gestão alimentar portuguesa chamada Armazena.

Recebes uma lista de textos extraídos de um recibo. Para cada item deves:

1. EXPANDIR ABREVIATURAS: Interpreta abreviaturas comuns em recibos portugueses.
   Exemplos: "COG" → "Cogumelos", "FR." → "Frango", "LT MG" → "Leite Meio Gordo", "TOM" → "Tomate", "BAT" → "Batata", "CEN" → "Cenoura", "ALF" → "Alface", "VIT" → "Vitela", "BOV" → "Bovino".
   Usa o contexto para inferir. O campo "name" deve conter o nome limpo e expandido.

2. LIMPAR O NOME: Remove do nome tudo que não é o nome do produto:
   - Códigos numéricos (ex: "AB1234", "123456")
   - Percentagens (ex: "3,5%", "20%")
   - Referências de categoria IVA (A, B, C no final)
   - Pesos/medidas que já fazem parte do código (ex: "1L", "500G" se fizer parte de um código)

3. CLASSIFICAR em uma destas categorias:
   - "ingrediente": alimentos usados para cozinhar (leite, ovos, arroz, massa, frango, queijo, legumes, peixe, azeite, etc.)
   - "snack": consumido diretamente como lanche (bolachas, chocolates, batatas fritas, gomas, barras de cereais, etc.)
   - "refeicao_pre_feita": refeição pronta (pizza congelada, lasanha, sopa pronta, nuggets, hambúrguer pronto, etc.)
   - "ignorar": TUDO que não é alimento, incluindo:
     * Produtos de higiene: shampoo, gel de banho, desodorizante, pasta de dentes, escova, perfume
     * Produtos de limpeza: detergente, limpador, sabão, amaciador, pastilhas
     * Papel e descartáveis: papel higiénico, papel de cozinha, guardanapos, sacos do lixo, fraldas
     * Outros não-alimentares: revistas, pilhas, talheres, artigos de escritório
     * Linhas ilegíveis, códigos, referências, endereços, secções do supermercado

Regras adicionais:
- Se um produto pode ser ingrediente ou snack (ex: banana, iogurte natural), escolhe "ingrediente" e marca needsReview: true
- Se não tens confiança no que é o produto (confidence < 0.75), marca needsReview: true
- suggestedLocation: "frigorífico" (laticínios, carnes, peixes, frescos), "congelador" (congelados), "despensa" (resto) — null para snack/ignorar
- suggestedState: "fechado", "fresco" ou "congelado" — null para snack/ignorar
- suggestedQuantity: quantidade típica deste produto em unidades reais. Exemplos:
    leite → "1L", ovos → "6 un", frango → "1 kg", massa → "500g", atum em lata → "1 un",
    natas → "200ml", arroz → "1 kg", azeite → "750ml", queijo → "200g", iogurte → "4 un",
    carne a granel → usa a quantidade do recibo se disponível (ex: "0,455 kg"), null para snack/ignorar
- Devolve APENAS JSON válido, sem texto extra, sem markdown, sem blocos de código`;

const VALID_CLASSIFICATIONS = ['ingrediente', 'snack', 'refeicao_pre_feita', 'ignorar'];
const VALID_LOCATIONS = ['frigorífico', 'despensa', 'congelador'];
const VALID_STATES = ['fechado', 'fresco', 'congelado'];
// suggestedQuantity é agora texto livre ("1L", "500g", "6 un", …)
// não há lista fechada — só validamos que é string não-vazia

async function classifyReceiptItems(products) {
  // Aceitar tanto strings simples como {name, quantity}
  const normalized = (products || []).map(p =>
    typeof p === 'string' ? { name: p, quantity: null } : p
  );
  if (normalized.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[receiptClassifier] GEMINI_API_KEY não definida — usando fallback por keywords');
    return fallbackClassify(normalized);
  }

  const userMessage = `Classifica estes produtos do recibo:\n${
    normalized.map((p, i) => `${i + 1}. ${p.name}${p.quantity ? ` (quantidade: ${p.quantity})` : ''}`).join('\n')
  }\n\nResponde APENAS em JSON:\n{"items":[{"originalText":"...","name":"...","normalizedName":"...","classification":"...","confidence":0.0,"needsReview":false,"suggestedLocation":"...","suggestedState":"...","suggestedQuantity":"...","notes":"..."}]}`;

  // Tentar modelos por ordem até um funcionar
  // gemini-1.5-* dão 404 na free tier — usar apenas 2.0+
  // gemini-2.5-flash-lite-preview tem quota separada dos 2.0
  const MODELS = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite-preview-06-17',
  ];
  for (const model of MODELS) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Resposta sem JSON válido');

      const parsed = JSON.parse(jsonMatch[0]);
      const raw = Array.isArray(parsed.items) ? parsed.items : [];
      console.log(`[receiptClassifier] Gemini (${model}) classificou ${raw.length} produtos`);

      return raw.map((item, i) => {
        const classification = VALID_CLASSIFICATIONS.includes(item.classification) ? item.classification : 'ingrediente';
        const confidence = typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.7;
        const isFood = classification !== 'ignorar' && classification !== 'snack';
        return {
          originalText: item.originalText || normalized[i]?.name || '',
          name: item.name || normalized[i]?.name || '',
          normalizedName: (item.normalizedName || item.name || '').toLowerCase(),
          classification, confidence,
          needsReview: !!item.needsReview || confidence < 0.75,
          suggestedLocation: isFood && VALID_LOCATIONS.includes(item.suggestedLocation) ? item.suggestedLocation : (isFood ? 'despensa' : null),
          suggestedState: isFood && VALID_STATES.includes(item.suggestedState) ? item.suggestedState : (isFood ? 'fechado' : null),
          suggestedQuantity: isFood && typeof item.suggestedQuantity === 'string' && item.suggestedQuantity ? item.suggestedQuantity : null,
          receiptQuantity: normalized[i]?.quantity || null,
          notes: item.notes || null,
        };
      });
    } catch (err) {
      const status = err.response?.status || err.message;
      console.warn(`[receiptClassifier] Modelo ${model} falhou (${status}), a tentar próximo...`);
      // Se foi rate limit (429), esperar 1 s antes de tentar o próximo modelo
      if (err.response?.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  console.error('[receiptClassifier] Todos os modelos Gemini falharam — usando fallback por keywords');
  return fallbackClassify(normalized);
}

function fallbackClassify(products) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const FRIDGE_KEYWORDS  = ['leite', 'queijo', 'iogurte', 'manteiga', 'natas', 'ovo', 'ovos', 'frango', 'carne', 'porco', 'vaca', 'vitela', 'borrego', 'peixe', 'atum', 'bacalhau', 'salmao', 'fiambre', 'requeijao', 'bacon', 'salsicha', 'presunto', 'chourico', 'bifanas', 'cachaco', 'entremead', 'costeleta'];
  const FREEZER_KEYWORDS = ['congelad', 'pizza', 'nugget', 'hamburguer', 'gelado', 'lasanha'];
  const SNACK_KEYWORDS   = ['bolacha', 'chocolate', 'barra', 'snack', 'chips', 'goma', 'rebucado', 'caramelo', 'cereais', 'granola', 'pipoca', 'amendoim', 'pacote bolachas'];
  const READY_KEYWORDS   = ['pizza', 'lasanha', 'nugget', 'hamburguer', 'sopa pronta', 'refeicao pronta', 'creme curg', 'espinaf', 'gratinado', 'take away', 'prato pronto'];
  const IGNORE_KEYWORDS  = ['deo', 'desodorizante', 'shampoo', 'gel banho', 'pasta dentes', 'escova', 'absorvente', 'fralda', 'detergente', 'limpador', 'sabao', 'sabonete', 'amaciador', 'saco lixo', 'saco plas', 'saco pl', 'papel higienico', 'guardanapo', 'pilha', 'revista', 'embalagem', 'sacos'];

  return products.map((p) => {
    const name = typeof p === 'string' ? p : p.name;
    const quantity = typeof p === 'string' ? null : p.quantity;
    const n = norm(name);
    let classification = 'ingrediente';
    let suggestedLocation = 'despensa';
    let suggestedState = 'fechado';
    let confident = false; // true quando a keyword é clara

    if (IGNORE_KEYWORDS.some((k) => n.includes(k))) {
      classification = 'ignorar';
      confident = true;
    } else if (READY_KEYWORDS.some((k) => n.includes(k))) {
      classification = 'refeicao_pre_feita';
      suggestedLocation = 'congelador';
      suggestedState = 'congelado';
      confident = true;
    } else if (SNACK_KEYWORDS.some((k) => n.includes(k))) {
      classification = 'snack';
      confident = true;
    } else if (FRIDGE_KEYWORDS.some((k) => n.includes(k))) {
      suggestedLocation = 'frigorífico';
      suggestedState = 'fresco';
      confident = true;
    } else if (FREEZER_KEYWORDS.some((k) => n.includes(k))) {
      suggestedLocation = 'congelador';
      suggestedState = 'congelado';
      confident = true;
    }
    // Se não correspondeu a nenhuma keyword → incerto, pede revisão

    const isFood = classification !== 'ignorar' && classification !== 'snack';
    return {
      originalText: name,
      name,
      normalizedName: n,
      classification,
      confidence: confident ? 0.8 : 0.5,
      needsReview: !confident,
      suggestedLocation: isFood ? suggestedLocation : null,
      suggestedState: isFood ? suggestedState : null,
      suggestedQuantity: null, // fallback: frontend usa heurística por nome
      receiptQuantity: quantity || null,
      notes: null,
    };
  });
}

module.exports = { classifyReceiptItems };
