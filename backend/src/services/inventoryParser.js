/**
 * Parser de inventário em linguagem natural
 * Converte descrições livres em itens estruturados
 */

// Tabela de palavras numéricas em português
const NUM_WORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};
const NUM_WORD_PATTERN = 'um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez';

function wordToNum(word) {
  const k = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return NUM_WORDS[k] || 1;
}

// ── Pré-processar: normalizar unidades escritas por extenso ──────────────────
// Deve correr ANTES de qualquer extracção — converte "300 gramas" → "300g",
// "2 latas" → "2un.", "meia dúzia" → "6un.", etc.
function normalizeUnits(text) {
  // Normalizar para NFC para garantir que acentos compostos são tratados corretamente
  let s = text.normalize('NFC');

  // "à dois dias" / "há dois dias" / "à 2 dias" → "há 2 dias"
  // (à = coloquial para há em português europeu)
  // Nota: "à" não é \w, por isso usamos (?<!\w) em vez de \b
  const numWordPat = NUM_WORD_PATTERN;
  s = s.replace(
    new RegExp(`(?<!\\w)[àá]\\s+(${numWordPat})\\s+dias?`, 'gi'),
    (_, word) => `há ${wordToNum(word)} dias`,
  );
  s = s.replace(/(?<!\w)[àá]\s+(\d+)\s+dias?/gi, (_, n) => `há ${n} dias`);
  // "há dois dias" (já com 'h' → é uma \w boundary normal)
  s = s.replace(
    new RegExp(`\\bh[aá]\\s+(${numWordPat})\\s+dias?\\b`, 'gi'),
    (_, word) => `há ${wordToNum(word)} dias`,
  );

  // Frações especiais
  s = s.replace(/\bmeia\s+d[úu]zia\b/gi, '6un.');
  s = s.replace(/\buma?\s+d[úu]zia\b/gi, '12un.');
  s = s.replace(/(\d+)\s+d[úu]zias?\b/gi, (_, n) => `${parseInt(n, 10) * 12}un.`);

  // Pesos (mais específico primeiro)
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*quilogramas?\b/gi, (_, n) => `${n.replace(',', '.')}kg`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*quilos?\b/gi, (_, n) => `${n.replace(',', '.')}kg`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*kilos?\b/gi, (_, n) => `${n.replace(',', '.')}kg`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*gramas?\b/gi, (_, n) => `${n.replace(',', '.')}g`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*\bgr\b/gi, (_, n) => `${n.replace(',', '.')}g`);

  // Volumes
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*mililitros?\b/gi, (_, n) => `${n.replace(',', '.')}ml`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*centilitros?\b/gi,
    (_, n) => `${Math.round(parseFloat(n.replace(',', '.')) * 10)}ml`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*decilitros?\b/gi,
    (_, n) => `${Math.round(parseFloat(n.replace(',', '.')) * 100)}ml`);
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*litros?\b/gi, (_, n) => `${n.replace(',', '.')}L`);

  // Contentores → un.
  s = s.replace(/(\d+)\s*latas?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*pacotes?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*caixas?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*garrafas?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*sacos?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*frascos?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*unidades?\b/gi, '$1un.');
  s = s.replace(/(\d+)\s*uns?\b(?!\.)/gi, '$1un.');

  return s;
}

// ── Extrair quantidade do texto já normalizado ────────────────────────────────
function extractQuantity(normalizedText) {
  const patterns = [
    /\d+(?:\.\d+)?\s*kg/i,
    /\d+(?:\.\d+)?\s*ml/i,
    // 'L' só se não for seguido de letra (evitar 'Leite', 'Laranja')
    /\d+(?:\.\d+)?\s*L(?![A-Za-zÀ-ÿ])/,
    // 'g' só se não for seguido de letra (evitar resíduos de "gramas" não convertidos)
    /\d+(?:\.\d+)?\s*g(?![A-Za-zÀ-ÿ])/,
    /\d+(?:\.\d+)?\s*un\.?/i,
  ];
  for (const p of patterns) {
    const m = normalizedText.match(p);
    if (m) return m[0].replace(/\s+/g, '');
  }
  return null;
}

// ── Remover quantidade e metadados do texto ───────────────────────────────────
function stripQuantityAndMeta(text) {
  return text
    .replace(/\d+(?:[.,]\d+)?\s*kg\b/gi, '')
    .replace(/\d+(?:[.,]\d+)?\s*ml\b/gi, '')
    .replace(/\d+(?:[.,]\d+)?\s*L(?![A-Za-zÀ-ÿ])/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*g(?![A-Za-zÀ-ÿ])/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*un\.?/gi, '')
    .replace(/\d+/g, '');
}

// ── Base de validades ─────────────────────────────────────────────────────────
// Formato: { local_estado: dias } com margem de segurança (extremo inferior)
// "congelador" usa uma só chave independente do estado
const PRODUCT_EXPIRY_DB = {

  // ── Conservas e enlatados ─────────────────────────────────────────────────
  // Fechados: mesma validade em despensa ou frigorífico (lata intacta)
  atum: {
    despensa_fechado: 730, frigorifico_fechado: 730,
    frigorifico_aberto: 1,  // tirar da lata → 1-2 dias
    congelador: 90,
  },
  sardinha: {
    despensa_fechado: 730, frigorifico_fechado: 730,
    frigorifico_aberto: 1,
    congelador: 90,
  },
  'atum lata': {
    despensa_fechado: 730, frigorifico_fechado: 730,
    frigorifico_aberto: 1, congelador: 90,
  },
  milho: {
    despensa_fechado: 1095, frigorifico_fechado: 1095,
    frigorifico_aberto: 3, congelador: 60,
  },
  feijao_conserva: {
    despensa_fechado: 1095, frigorifico_fechado: 1095,
    frigorifico_aberto: 3, congelador: 60,
  },
  grao_conserva: {
    despensa_fechado: 1095, frigorifico_fechado: 1095,
    frigorifico_aberto: 3, congelador: 60,
  },
  'tomate pelado': {
    despensa_fechado: 365, frigorifico_fechado: 365,
    frigorifico_aberto: 5, congelador: 90,
  },
  'polpa de tomate': {
    despensa_fechado: 365, frigorifico_fechado: 365,
    frigorifico_aberto: 5, congelador: 90,
  },
  conserva: {
    despensa_fechado: 730, frigorifico_fechado: 730,
    frigorifico_aberto: 3,
  },

  // ── Condimentos e molhos ──────────────────────────────────────────────────
  maionese: {
    despensa_fechado: 270, frigorifico_fechado: 270,
    frigorifico_aberto: 60,
  },
  ketchup: {
    despensa_fechado: 365, frigorifico_fechado: 365,
    frigorifico_aberto: 180,
  },
  mostarda: {
    despensa_fechado: 365, frigorifico_fechado: 365,
    frigorifico_aberto: 180,
  },
  compota: {
    despensa_fechado: 365, frigorifico_aberto: 180,
  },
  geleia: {
    despensa_fechado: 365, frigorifico_aberto: 180,
  },
  mel: {
    despensa_fechado: 3650, despensa_aberto: 3650,
  },
  azeite: {
    despensa_fechado: 365, despensa_aberto: 120,
  },
  oleo: {
    despensa_fechado: 365, despensa_aberto: 120,
  },
  vinagre: {
    despensa_fechado: 1825, despensa_aberto: 1825,
  },
  molho: {
    despensa_fechado: 365, frigorifico_aberto: 30,
  },
  'molho de soja': {
    despensa_fechado: 730, frigorifico_aberto: 90,
  },

  // ── Laticínios ────────────────────────────────────────────────────────────
  'leite uht': {
    despensa_fechado: 90, frigorifico_aberto: 3, congelador: 90,
  },
  'leite meio gordo': {
    despensa_fechado: 90, frigorifico_fechado: 10,
    frigorifico_aberto: 2, congelador: 45,
  },
  'leite gordo': {
    despensa_fechado: 90, frigorifico_fechado: 10,
    frigorifico_aberto: 2, congelador: 45,
  },
  'leite magro': {
    despensa_fechado: 90, frigorifico_fechado: 10,
    frigorifico_aberto: 2, congelador: 45,
  },
  'leite fresco': {
    frigorifico_fechado: 7, frigorifico_aberto: 2, congelador: 45,
  },
  leite: {
    despensa_fechado: 90, frigorifico_fechado: 7,
    frigorifico_aberto: 2, congelador: 45,
  },
  iogurte: {
    frigorifico_fechado: 14, frigorifico_aberto: 1, congelador: 30,
  },

  // Queijos (do mais fresco ao mais curado)
  'queijo fresco':   { frigorifico_fechado: 5,   frigorifico_aberto: 1 },
  requeijao:         { frigorifico_fechado: 5,   frigorifico_aberto: 1 },
  'queijo creme':    { frigorifico_fechado: 14,  frigorifico_aberto: 5 },
  'queijo flamengo': { frigorifico_fechado: 14,  frigorifico_aberto: 5,  congelador: 180 },
  'queijo fatiado':  { frigorifico_fechado: 14,  frigorifico_aberto: 5,  congelador: 180 },
  'queijo ralado':   { frigorifico_fechado: 21,  frigorifico_aberto: 5,  congelador: 90  },
  'queijo curado':   { frigorifico_fechado: 120, frigorifico_aberto: 21, congelador: 180 },
  'queijo duro':     { frigorifico_fechado: 120, frigorifico_aberto: 21, congelador: 180 },
  parmesao:          { frigorifico_fechado: 120, frigorifico_aberto: 21, congelador: 180 },
  // Queijo genérico → conservador (assume fatiado/suave)
  queijo: {
    frigorifico_fechado: 21, frigorifico_aberto: 5, congelador: 180,
  },

  manteiga: {
    frigorifico_fechado: 60, frigorifico_aberto: 14,
    despensa_fechado: 14, congelador: 180,
  },
  natas: {
    frigorifico_fechado: 14, frigorifico_aberto: 2,
  },

  // ── Ovos ─────────────────────────────────────────────────────────────────
  ovos: {
    frigorifico_fechado: 21, frigorifico_fresco: 21,
    despensa_fresco: 14, congelador: 365,
  },
  ovo: {
    frigorifico_fechado: 21, frigorifico_fresco: 21,
    despensa_fresco: 14, congelador: 365,
  },

  // ── Carnes ───────────────────────────────────────────────────────────────
  frango: {
    frigorifico_fresco: 1, frigorifico_aberto: 1,
    congelador: 270,
  },
  'peito de frango': {
    frigorifico_fresco: 1, congelador: 270,
  },
  peru: {
    frigorifico_fresco: 1, congelador: 270,
  },
  'carne picada': {
    frigorifico_fresco: 1, frigorifico_aberto: 1, congelador: 90,
  },
  carne: {
    frigorifico_fresco: 3, frigorifico_aberto: 2, congelador: 180,
  },
  vaca: {
    frigorifico_fresco: 3, frigorifico_aberto: 2, congelador: 240,
  },
  porco: {
    frigorifico_fresco: 3, frigorifico_aberto: 2, congelador: 180,
  },
  vitela: {
    frigorifico_fresco: 3, frigorifico_aberto: 2, congelador: 120,
  },
  borrego: {
    frigorifico_fresco: 3, frigorifico_aberto: 2, congelador: 120,
  },
  fiambre: {
    frigorifico_fechado: 14, frigorifico_aberto: 3, congelador: 30,
  },
  presunto: {
    frigorifico_fechado: 21, frigorifico_aberto: 7, despensa_fechado: 90,
  },
  chourico: {
    despensa_fechado: 30, frigorifico_aberto: 21, congelador: 180,
  },
  salpicao: {
    despensa_fechado: 30, frigorifico_aberto: 21, congelador: 180,
  },
  bacon: {
    frigorifico_fechado: 14, frigorifico_aberto: 5, congelador: 60,
  },
  salsicha: {
    frigorifico_fechado: 14, frigorifico_aberto: 3, congelador: 60,
  },
  'sobras carne': {
    frigorifico_aberto: 3, congelador: 60,
  },
  'sobras peixe': {
    frigorifico_aberto: 2, congelador: 60,
  },

  // ── Peixe e marisco ───────────────────────────────────────────────────────
  salmao: {
    frigorifico_fresco: 1, frigorifico_aberto: 1, congelador: 90,
  },
  salmon: {
    frigorifico_fresco: 1, frigorifico_aberto: 1, congelador: 90,
  },
  bacalhau: {
    frigorifico_fresco: 2, despensa_fechado: 365, congelador: 180,
  },
  camarao: {
    frigorifico_fresco: 1, frigorifico_aberto: 1, congelador: 90,
  },
  peixe: {
    frigorifico_fresco: 1, frigorifico_aberto: 1, congelador: 60,
  },

  // ── Vegetais e frutas ─────────────────────────────────────────────────────
  alface:     { frigorifico_fresco: 3,  frigorifico_aberto: 2 },
  espinafres: { frigorifico_fresco: 3,  congelador: 365 },
  brocolo:    { frigorifico_fresco: 3,  congelador: 365 },
  brocolis:   { frigorifico_fresco: 3,  congelador: 365 },
  ervilhas:   { frigorifico_fresco: 5,  despensa_fechado: 730, congelador: 365 },
  feijao_verde: { frigorifico_fresco: 5, congelador: 365 },
  tomate:     { frigorifico_fresco: 5,  despensa_fresco: 4 },
  cenoura:    { frigorifico_fresco: 21, despensa_fresco: 4, congelador: 365 },
  cebola:     { despensa_fresco: 30,    frigorifico_fresco: 14 },
  alho:       { despensa_fresco: 90,    frigorifico_fresco: 14, despensa_aberto: 7 },
  batata:     { despensa_fresco: 30,    frigorifico_fresco: 14 },
  'batata doce': { despensa_fresco: 21, frigorifico_fresco: 14 },
  banana:     { despensa_fresco: 3,     congelador: 60 },
  maca:       { despensa_fresco: 7,     frigorifico_fresco: 30 },
  pera:       { despensa_fresco: 4,     frigorifico_fresco: 14 },
  laranja:    { despensa_fresco: 7,     frigorifico_fresco: 21 },
  limao:      { despensa_fresco: 7,     frigorifico_fresco: 21 },
  morango:    { frigorifico_fresco: 3 },
  mirtilo:    { frigorifico_fresco: 5 },
  cogumelo:   { frigorifico_fresco: 5 },

  // ── Secos e despensa ──────────────────────────────────────────────────────
  arroz:        { despensa_fechado: 730, despensa_aberto: 365 },
  'arroz integral': { despensa_fechado: 180, despensa_aberto: 120, frigorifico_fechado: 365 },
  massa:        { despensa_fechado: 730, despensa_aberto: 365 },
  esparguete:   { despensa_fechado: 730, despensa_aberto: 365 },
  aveia:        { despensa_fechado: 365, despensa_aberto: 180 },
  farinha:      { despensa_fechado: 365, despensa_aberto: 180, congelador: 730 },
  acucar:       { despensa_fechado: 1825, despensa_aberto: 730 },
  sal:          { despensa_fechado: 3650, despensa_aberto: 3650 },
  cafe:         { despensa_fechado: 365, despensa_aberto: 45, congelador: 365 },
  cha:          { despensa_fechado: 365, despensa_aberto: 90 },

  // ── Leguminosas secas ─────────────────────────────────────────────────────
  feijao: {
    despensa_fechado: 730, despensa_aberto: 365,
    frigorifico_aberto: 3, congelador: 90,
  },
  grao: {
    despensa_fechado: 730, despensa_aberto: 365,
    frigorifico_aberto: 3, congelador: 90,
  },
  lentilhas: {
    despensa_fechado: 730, despensa_aberto: 365, frigorifico_aberto: 3,
  },

  // ── Pão e padaria ─────────────────────────────────────────────────────────
  'pao de forma': { despensa_fechado: 5, despensa_aberto: 4, frigorifico_fechado: 10, congelador: 90 },
  pao:  { despensa_fresco: 2, frigorifico_fresco: 5, congelador: 90 },
  bolo: { despensa_fresco: 2, frigorifico_fresco: 5, congelador: 90 },

  // ── Bebidas ───────────────────────────────────────────────────────────────
  sumo:  { despensa_fechado: 365, frigorifico_aberto: 5 },
  agua:  { despensa_fechado: 365 },
  vinho: { despensa_fechado: 730, frigorifico_aberto: 3 },
  cerveja: { despensa_fechado: 180 },

  // ── Snacks e doces ────────────────────────────────────────────────────────
  bolachas:  { despensa_fechado: 180, despensa_aberto: 30 },
  biscoito:  { despensa_fechado: 180, despensa_aberto: 30 },
  chocolate: { despensa_fechado: 365, despensa_aberto: 30 },

  // ── Fallback genérico ──────────────────────────────────────────────────────
  default: { frigorifico: 5, despensa: 60, congelador: 365 },
};

// ── Palavras-chave para localização ──────────────────────────────────────────
const LOCATION_KEYWORDS = {
  frigorifico: 'frigorífico', 'frigorífico': 'frigorífico', frig: 'frigorífico',
  despensa: 'despensa', armario: 'despensa', 'armário': 'despensa', prateleira: 'despensa',
  congelador: 'congelador', congelado: 'congelador', congelada: 'congelador',
  congelados: 'congelador', congeladas: 'congelador',
};

// ── Palavras-chave para estado ────────────────────────────────────────────────
const STATE_KEYWORDS = {
  aberto: 'aberto', aberta: 'aberto', abertos: 'aberto', abertas: 'aberto',
  fechado: 'fechado', fechada: 'fechado', fechados: 'fechado', fechadas: 'fechado',
  fresco: 'fresco', fresca: 'fresco', frescos: 'fresco', frescas: 'fresco',
  congelado: 'congelado', congelada: 'congelado', congelados: 'congelado', congeladas: 'congelado',
};

// Palavras temporais/contextuais que não fazem parte do nome do produto
const TEMPORAL_WORDS = /\b(hoje|ontem|amanha|amanhã|agora|esta\s+semana|nesta\s+semana|recentemente|h[aá]\s+\d+\s+dias?)\b/gi;

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectLocation(text) {
  const lower = normalize(text);
  for (const [keyword, location] of Object.entries(LOCATION_KEYWORDS)) {
    if (lower.includes(normalize(keyword))) return location;
  }
  return null;
}

function detectState(text) {
  const lower = text.toLowerCase();
  for (const [keyword, state] of Object.entries(STATE_KEYWORDS)) {
    if (lower.includes(keyword)) return state;
  }
  return null;
}

function detectDaysFromText(text) {
  const m1 = text.match(/h[aá]\s+(\d+)\s+dias?/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = text.match(/vence\s+em\s+(\d+)\s+dias?/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function normalizeProductName(name) {
  return normalize(name).trim();
}

// ── Estimar validade ──────────────────────────────────────────────────────────
function estimateExpiry(normalizedName, location, state, daysOpenedAgo = 0) {
  const db = PRODUCT_EXPIRY_DB;
  const locKey   = location === 'frigorífico' ? 'frigorifico' : location;
  const stateKey = state || 'fechado';

  // 1. Procura exata
  let productData = db[normalizedName] || null;

  // 2. Procura parcial (mais específico primeiro → ordena por comprimento desc)
  if (!productData) {
    const sortedKeys = Object.keys(db)
      .filter((k) => k !== 'default')
      .sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const normKey = normalize(key);
      if (normalizedName.includes(normKey) || normKey.includes(normalizedName)) {
        productData = db[key];
        break;
      }
    }
  }

  if (!productData) productData = db.default;

  // Lookup: exacto → só local → fallback
  const lookupKey = `${locKey}_${stateKey}`;
  let days = productData[lookupKey]
    ?? productData[locKey]
    ?? { frigorifico: 5, despensa: 60, congelador: 365 }[locKey]
    ?? 7;

  if (daysOpenedAgo > 0 && days) {
    days = Math.max(1, days - daysOpenedAgo);
  }

  return days;
}

function calculatePriority(expiryDays) {
  if (!expiryDays) return 'pode_esperar';
  if (expiryDays <= 1)  return 'usar_hoje';
  if (expiryDays <= 4)  return 'usar_breve';
  if (expiryDays <= 30) return 'pode_esperar';
  return 'stock';
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Parse principal ───────────────────────────────────────────────────────────
function parseInventoryDescription(description) {
  let currentLocation = 'frigorífico';

  const segments = description
    .split(/,|;|\n|\.(?!\d)| e (?=[a-záàâãéèêíïóôõöúüç])/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const items = [];

  for (const rawSegment of segments) {
    // Normalizar unidades por extenso ANTES de tudo
    const segment = normalizeUnits(rawSegment);

    const locationOnly = detectLocation(segment);
    const stripped = segment
      .replace(/frigorifico|frigorífico|congelador|despensa|armário|armario/gi, '')
      .trim();
    const hasProductContent = stripped.length > 1;

    if (locationOnly && !hasProductContent) {
      currentLocation = locationOnly;
      continue;
    }
    if (locationOnly) currentLocation = locationOnly;

    const daysOpenedAgo = detectDaysFromText(segment);
    const state = detectState(segment)
      || (currentLocation === 'congelador' ? 'congelado' : 'fechado');

    // Quantidade (já normalizada pelo normalizeUnits)
    const quantityText = extractQuantity(segment);

    // Limpar segmento para isolar o nome do produto
    // Remover expressões temporais ANTES de stripQuantityAndMeta para que
    // "há 2 dias" seja removido antes de os dígitos serem apagados
    const preClean = segment
      .replace(/h[aá]\s+\d+\s+dias?/gi, '')
      .replace(TEMPORAL_WORDS, '')
      .replace(/frigorifico|frigorífico|congelador|despensa|armário|armario/gi, '')
      .replace(/aberto|aberta|fechado|fechada|fresco|fresca|congelado|congelada/gi, '')
      .replace(/\bde\b|\bdo\b|\bdos\b|\bdas\b|\bem\b|\bno\b|\bnos\b|\bnas\b|\buns?\b|\bumas?\b/gi, '')
      .replace(/[:,.\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanSegment = stripQuantityAndMeta(preClean)
      .replace(/\s+/g, ' ')
      .trim();

    // Extrai sequência de letras inicial (nome do produto)
    const nameMatch = cleanSegment.match(/^([a-záàâãéèêíïóôõöúüçñ][a-záàâãéèêíïóôõöúüçñ\s]*)/i);
    if (!nameMatch) continue;

    let productName = nameMatch[1]
      .replace(/^(o|a|os|as|um|uma)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (productName.length < 2) continue;

    const normalizedName = normalizeProductName(productName);
    const location       = currentLocation;
    const expiryDays     = estimateExpiry(normalizedName, location, state, daysOpenedAgo || 0);
    const expiresAt      = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
    const priority       = calculatePriority(expiryDays);
    const notes          = daysOpenedAgo ? `Aberto há ${daysOpenedAgo} dias` : '';

    items.push({
      name: capitalizeFirst(productName),
      normalizedName,
      location,
      state,
      quantity: quantityText || '',
      estimatedExpiryDays: expiryDays,
      expiresAt,
      priority,
      notes,
      source: 'ia',
    });
  }

  // Remover duplicados
  const seen   = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.normalizedName)) return false;
    seen.add(item.normalizedName);
    return true;
  });

  return { items: unique, totalItems: unique.length };
}

module.exports = { parseInventoryDescription, estimateExpiry, normalizeProductName };
