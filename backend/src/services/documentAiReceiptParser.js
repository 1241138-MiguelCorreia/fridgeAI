/**
 * documentAiReceiptParser.js
 * Processa recibos de supermercado com Google Cloud Document AI.
 * Extrai produtos alimentares com quantidades, ignorando tudo o resto.
 */

const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');

const PROJECT_ID   = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION     = process.env.GOOGLE_CLOUD_LOCATION || 'eu';
const PROCESSOR_ID = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
const PROCESSOR_NAME = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

function loadCredentials() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;
  try { return JSON.parse(fs.readFileSync(credPath, 'utf8')); }
  catch (_) { return null; }
}

// ── Abreviaturas comuns em recibos portugueses ────────────────────────────────
const ABBREVIATIONS = {
  'FETTUCCINE CONT': 'Fettuccine',
  'MASSA PENNE':     'Massa Penne',
  'AMIDO MILHO':     'Amido de Milho',
  'COG':   'Cogumelos',  'COG.':  'Cogumelos',
  'TOM':   'Tomate',     'TOM.':  'Tomate',
  'BAT':   'Batata',     'BAT.':  'Batata',
  'CEN':   'Cenoura',    'CEN.':  'Cenoura',
  'ALF':   'Alface',     'ALF.':  'Alface',
  'PEP':   'Pepino',     'PEP.':  'Pepino',
  'ESP':   'Espinafres', 'ESP.':  'Espinafres',
  'ESPINAF': 'Espinafres',
  'FR':    'Frango',     'FR.':   'Frango',     'FRG': 'Frango',
  'VIT':   'Vitela',     'VIT.':  'Vitela',
  'BOV':   'Bovino',     'BOV.':  'Bovino',
  'PRC':   'Porco',      'PRC.':  'Porco',
  'LT':    'Leite',      'LT.':   'Leite',
  'MG':    'Meio Gordo', 'GRD':   'Gordo',      'MGR': 'Meio Gordo',
  'NAT':   'Natural',    'NAT.':  'Natural',
  'INT':   'Integral',   'INT.':  'Integral',
  'BIO':   'Biológico',  'ECO':   'Ecológico',
  'S/L':   'Sem Lactose','S/G':   'Sem Glúten',
  'IND':   'Individual', 'IND.':  'Individual',
  'FAM':   'Familiar',   'FAM.':  'Familiar',
  'TRAD':  'Tradicional','TRAD.': 'Tradicional',
  'CX':    'Caixa',      'CX.':   'Caixa',
  'PCT':   'Pacote',     'PCT.':  'Pacote',
  'KG':    'kg',         'GR':    'g',
  'ML':    'ml',         'UN':    'un',
  'MOL':   'Molho',                             // "MOL ALHO E ERVAS" → "Molho Alho E Ervas"
  'CURG':  'Curgete',    'CURG.': 'Curgete',   // curgete (abobrinha)
  'CODEA': 'Côdea',                             // "C/CODEA" → "Com Côdea"
  'VRM':   '',           'CH':    '',           // siglas sem significado útil
  'M':     '',           // tamanho de tomate médio (TOM M → Tomate)
};

// ── Linhas que significam "parar de ler produtos" ────────────────────────────
const STOP_PATTERNS = [
  /^TOTAL\b/i,
  /^SUBTOTAL\b/i,
  /^Numerario/i,
  /^DESCONTO\b/i,
  /^Saldo\s*do\s*Cart/i,
  /^IVA\s*TOTAL/i,
];

// ── Linhas a ignorar sempre ──────────────────────────────────────────────────
const SKIP_PATTERNS = [
  /^\s*$/,
  /^Desconto\s*(Cart|Art)/i,           // "Desconto Cartao", "Desconto Artigo"
  /^SUPER\s*PREC/i,                    // "SUPER PRECO"
  /^-?\s*\d+[,\.]\d{2}\s*$/,          // linha só com preço
  /^\d+[,\.]\d+\s*[xX]\s*/,           // linha de quantidade (tratada separadamente)
  /^€\s*\d/,                           // linha começa com €
  /^\d+[,\.]\d{2}\s*[-–]\s*/,         // "€12,04 - ..." (voucher)
];

// ── Cabeçalhos de secção (ex: "Talho:", "Casa-Cozinha/Lavand:", "Take Away:") ──
// Aceita letras, espaços, hífens, barras e o ponto final de abreviatura antes de ":"
const SECTION_HEADER = /^[A-Za-zÀ-úÇç\s\-\/\.]{2,50}:\s*$/;

// ── Padrão de produto em recibos PT (IVA%|IVAx CÓDIGO NOME [PREÇO]) ──────────
// Ex: "8% 5601312064497 FETTUCCINE CONT 0,92"
// Ex: "6X 8000139910340 MASSA PENNE"   ← OCR lê % como X
const PRODUCT_LINE = /^\d{1,2}[%X]\s+\d{6,14}\s+(.+?)(?:\s+\d+[,\.]\d{2})?\s*$/i;

// ── Padrão de quantidade pesada ───────────────────────────────────────────────
// Completo: "0,455 x 3,89"  |  Partido pelo OCR: "0,455 x"
const QTY_LINE_FULL    = /^(\d+[,\.]\d+)\s*[xX]\s*\d+[,\.]\d+\s*$/;
const QTY_LINE_PARTIAL = /^(\d+[,\.]\d{3})\s*[xX]\s*$/;  // "0,455 x" (3 casas decimais = kg)

// ── Normalizar nome de produto ────────────────────────────────────────────────
function normalizeProductName(raw) {
  let name = raw.trim().toUpperCase();

  // Remover prefixo de classe IVA: "(A) ", "(B) ", "<C> " — OCR pode ler () como <>
  name = name.replace(/^[(<][A-Z][>)]\s+/, '');

  // Expandir "S/XYZ" → "Sem XYZ" e "C/XYZ" → "Com XYZ" (antes das abreviaturas)
  name = name.replace(/\bS\/([A-Z])/g, 'SEM $1');
  name = name.replace(/\bC\/([A-Z])/g, 'COM $1');
  name = name.replace(/\bP\/([A-Z])/g, 'PARA $1');

  // Aplicar abreviaturas (frases completas primeiro, depois palavras)
  for (const [abbr, expanded] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    name = name.replace(regex, expanded);
  }

  // Remover marca da loja (Continente / CNT no final ou como palavra isolada)
  name = name.replace(/\s+CONTINENTE\s*$/, '');
  name = name.replace(/\bCNT\b/g, '');

  // Remover peso/volume no fim do nome: "500G", "520G", "1,5KG", "800ML", "1L", etc.
  name = name.replace(/\s+\d+[,.]?\d*\s*(G|KG|ML|CL|L|UN)\s*$/i, '');

  // Remover código numérico no fim (ex: "Molho Alho E Ervas 285" → "Molho Alho E Ervas")
  name = name.replace(/\s+\d{2,4}\s*$/, '');

  // Remover tokens que ficaram vazios ou são só símbolos
  name = name.replace(/\s{2,}/g, ' ').trim();

  // Remover percentagens soltas
  name = name.replace(/\b\d+[,\.]\d*\s*%/g, '');

  // Capitalizar correctamente
  name = name.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase()).trim();

  return name;
}

// ── Extrair produtos do texto completo ───────────────────────────────────────
function extractFromFullText(fullText) {
  const lines = fullText.split('\n').map(l => l.trim());
  const products = [];
  let lastProduct = null;
  let passedHeader = false; // ignorar cabeçalho da loja (primeiras linhas sem produtos)

  for (const line of lines) {
    if (!line) continue;

    // Parar quando chegarmos ao TOTAL
    if (STOP_PATTERNS.some(p => p.test(line))) break;

    // Cabeçalho de secção → ignorar mas marcar que já passámos o cabeçalho da loja
    if (SECTION_HEADER.test(line)) {
      passedHeader = true;
      lastProduct = null;
      continue;
    }

    // Linha de quantidade → associar ao produto anterior
    const qtyFull = line.match(QTY_LINE_FULL);
    const qtyPartial = line.match(QTY_LINE_PARTIAL);
    if ((qtyFull || qtyPartial) && lastProduct) {
      const match = qtyFull || qtyPartial;
      const kg = parseFloat(match[1].replace(',', '.'));
      lastProduct.quantity = `${kg.toFixed(3).replace('.', ',')} kg`;
      continue;
    }

    // Linha a ignorar
    if (SKIP_PATTERNS.some(p => p.test(line))) {
      lastProduct = null;
      continue;
    }

    // Tentar padrão PT (IVA% CÓDIGO PRODUTO)
    const productMatch = line.match(PRODUCT_LINE);
    if (productMatch) {
      passedHeader = true;
      const rawName = productMatch[1].trim();
      const name = normalizeProductName(rawName);
      if (name.length >= 2) {
        lastProduct = { name, rawName, quantity: null };
        products.push(lastProduct);
      }
      continue;
    }

    // Fallback heurístico: linha com texto alfabético, fora do cabeçalho da loja
    if (passedHeader) {
      const hasAlpha = /[a-zA-ZÀ-ú]{3,}/.test(line);
      const onlyNumbers = /^[\d\s,.\-€%×xX]+$/.test(line);
      if (hasAlpha && !onlyNumbers && line.length >= 4) {
        const name = normalizeProductName(line);
        if (name.length >= 3) {
          lastProduct = { name, rawName: line, quantity: null };
          products.push(lastProduct);
        }
      } else {
        lastProduct = null;
      }
    } else {
      lastProduct = null;
    }
  }

  return products;
}

// ── Extrair das entidades estruturadas do Document AI ────────────────────────
function extractFromEntities(entities) {
  const products = [];
  for (const entity of entities) {
    const type = (entity.type || '').toLowerCase();
    if (type.includes('line_item') || type.includes('item') || type === 'receipt_item' || type === 'product') {
      let name = '';
      let quantity = null;
      if (entity.properties?.length > 0) {
        for (const prop of entity.properties) {
          const pt = (prop.type || '').toLowerCase();
          const text = prop.mentionText || prop.normalizedValue?.text || '';
          if (pt.includes('description') || pt.includes('name') || pt.includes('product')) name = text;
          if (pt.includes('quantity') || pt.includes('qty')) quantity = text;
        }
      } else {
        name = entity.mentionText || entity.normalizedValue?.text || '';
      }
      if (name) products.push({ name: normalizeProductName(name), rawName: name, quantity });
    }
  }
  return products;
}

// ── Função principal ──────────────────────────────────────────────────────────
async function parseReceiptWithDocumentAI(base64Image, mimeType = 'image/jpeg') {
  if (!PROJECT_ID || !PROCESSOR_ID) {
    throw new Error('Variáveis de ambiente Google Cloud não configuradas.');
  }

  const clientOptions = {};
  if (LOCATION !== 'us') clientOptions.apiEndpoint = `${LOCATION}-documentai.googleapis.com`;
  const credentials = loadCredentials();
  if (credentials) clientOptions.credentials = credentials;

  const client = new DocumentProcessorServiceClient(clientOptions);
  let document;
  try {
    const [result] = await client.processDocument({
      name: PROCESSOR_NAME,
      rawDocument: { content: base64Image, mimeType },
    });
    document = result.document;
  } catch (err) {
    console.error('[DocumentAI] Erro:', err.message);
    throw new Error('Falha ao contactar Google Cloud Document AI.');
  }

  if (!document) throw new Error('Document AI não devolveu documento.');

  const fullText = document.text || '';
  const entities = document.entities || [];

  // Tentar entidades estruturadas primeiro
  let entityProducts = [];
  if (entities.length > 0) entityProducts = extractFromEntities(entities);

  // Sempre correr também o parser de texto completo
  const textProducts = extractFromFullText(fullText);

  console.log(`[DocumentAI] Entidades: ${entities.length} → ${entityProducts.length} produtos | Texto: ${textProducts.length} produtos`);
  // DEBUG: mostrar tipos de entidades e primeiros 800 chars do texto OCR
  if (entities.length > 0) {
    console.log('[DocumentAI] Tipos de entidades:', entities.map(e => e.type).join(', '));
  }
  console.log('[DocumentAI] Texto OCR (primeiros 800 chars):\n' + fullText.slice(0, 800));

  // Usar o que der mais resultados; se igual, preferir texto (mais completo)
  let rawProducts = textProducts.length >= entityProducts.length ? textProducts : entityProducts;

  // Desduplicar
  const seen = new Set();
  const products = [];
  const SKIP_NAMES = ['desconto', 'total', 'iva', 'saldo', 'taxa', 'troco', 'embalagem', 'numerario', 'super preco'];

  for (const p of rawProducts) {
    if (!p.name || p.name.length < 2) continue;
    const lower = p.name.toLowerCase();
    if (SKIP_NAMES.some(s => lower.startsWith(s))) continue;
    const key = lower.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({ name: p.name, quantity: p.quantity || null });
  }

  return products;
}

module.exports = { parseReceiptWithDocumentAI };
