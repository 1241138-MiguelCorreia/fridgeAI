import axios from 'axios';
import storage from './storage';

// URL do backend — mudar para IP da máquina em desenvolvimento
// Em produção substituir pelo URL real
// Em desenvolvimento: usa o IP do teu Mac (mesmo WiFi) ou URL do ngrok (4G)
// Exemplo WiFi:  'http://192.168.1.X:3000'
// Exemplo ngrok: 'https://abc123.ngrok-free.app'
const BASE_URL = __DEV__ ? 'http://172.20.10.4:3000' : 'https://api.typeshitcode.com';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true',
  },
});

// ── Interceptor de request: adicionar token ───────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('auth_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (_) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de response: tratar erros globais ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      // Sem internet ou timeout
      return Promise.reject({
        message: 'Sem ligação à internet. Tenta novamente.',
        code: 'NETWORK_ERROR',
      });
    }

    const { status, data } = error.response;

    if (status === 401 && data?.code === 'TOKEN_EXPIRED') {
      // Token expirado — limpar e redirecionar para login
      await storage.deleteItem('auth_token');
      return Promise.reject({ message: data.message, code: 'TOKEN_EXPIRED' });
    }

    return Promise.reject({
      message: data?.message || 'Ocorreu um erro. Tenta novamente.',
      code: data?.code || `HTTP_${status}`,
      status,
    });
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password, confirmPassword) =>
    api.post('/auth/register', { name, email, password, confirmPassword }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  me: () => api.get('/auth/me'),
  setMode: (mode) => api.patch('/auth/mode', { mode }),
  setRestrictions: (restrictions, allergies) =>
    api.patch('/auth/restrictions', { restrictions, allergies }),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getById: (id) => api.get(`/inventory/${id}`),
  parseDescription: (description) => api.post('/inventory/parse', { description }),
  bulkCreate: (items) => api.post('/inventory/bulk', { items }),
  create: (item) => api.post('/inventory', item),
  update: (id, updates) => api.patch(`/inventory/${id}`, updates),
  remove: (id) => api.delete(`/inventory/${id}`),
  // Timeout mais longo para o scan: DocumentAI + Gemini podem demorar até 40s
  scanReceipt: (base64Image, mimeType = 'image/jpeg') =>
    api.post('/inventory/scan-receipt', { image: base64Image, mimeType }, { timeout: 75000 }),
};

// ── Meals ──────────────────────────────────────────────────────────────────────
export const mealsAPI = {
  getSuggestions: (mealType) =>
    api.get('/meals/suggestions', { params: { mealType: mealType ?? '' } }),
  setServings: (servings) => api.patch('/meals/servings', { servings }),
  setMealType: (mealType) => api.patch('/meals/mealtype', { mealType }),
  getRecipes: () => api.get('/meals/recipes'),
  createRecipe: (data) => api.post('/meals/recipes', data),
  updateRecipe: (id, data) => api.patch(`/meals/recipes/${id}`, data),
  deleteRecipe: (id) => api.delete(`/meals/recipes/${id}`),
  markDone: (data) => api.post('/meals/done', data),
  completeMeal: (data) => api.post('/meals/complete', data),
  getHistory: () => api.get('/meals/history'),
};

// ── Shopping ──────────────────────────────────────────────────────────────────
export const shoppingAPI = {
  getList: () => api.get('/shopping/list'),
  regenerate: () => api.post('/shopping/list/regenerate'),
  addItem: (name, neededAmount) => api.post('/shopping/list/items', { name, neededAmount }),
  updateItem: (itemId, updates) => api.patch(`/shopping/list/items/${itemId}`, updates),
  deleteItem: (itemId) => api.delete(`/shopping/list/items/${itemId}`),
  confirm: () => api.post('/shopping/confirm'),
  getHistory: () => api.get('/shopping/history'),
  getLowStock: () => api.get('/shopping/low-stock'),
  addLowStockItem: (inventoryItemId) => api.post('/shopping/low-stock/add', { inventoryItemId }),
};

// ── Places ────────────────────────────────────────────────────────────────────
export const placesAPI = {
  getNearby: (lat, lng, radius = 2000) =>
    api.get('/places/nearby', { params: { lat, lng, radius } }),
};

// ── Fitness ───────────────────────────────────────────────────────────────────
export const fitnessAPI = {
  // Perfil
  getProfile:         ()        => api.get('/fitness/profile'),
  createProfile:      (data)    => api.post('/fitness/profile', data),
  updateProfile:      (data)    => api.patch('/fitness/profile', data),
  recalculateTargets: ()        => api.post('/fitness/recalculate-targets'),
  updateTargets:      (data)    => api.patch('/fitness/targets', data),

  // Daily log
  getDailyLog:        (date)    => api.get('/fitness/daily-log', { params: date ? { date } : {} }),
  addEntry:           (entry)   => api.post('/fitness/daily-log/entry', entry),
  updateEntry:        (id, data, date) => api.patch(`/fitness/daily-log/entry/${id}`, data, { params: date ? { date } : {} }),
  deleteEntry:        (id, date)       => api.delete(`/fitness/daily-log/entry/${id}`, { params: date ? { date } : {} }),

  // Snacks
  getSnacks:          ()        => api.get('/fitness/snacks'),
  createSnack:        (data)    => api.post('/fitness/snacks', data),
  updateSnack:        (id, d)   => api.patch(`/fitness/snacks/${id}`, d),
  deleteSnack:        (id)      => api.delete(`/fitness/snacks/${id}`),
  logSnack:           (data)    => api.post('/fitness/snacks/log', data),

  // Streak
  getStreak:          ()        => api.get('/fitness/streak'),

  // Progresso corporal
  getProgress:        ()        => api.get('/fitness/progress'),
  addProgress:        (data)    => api.post('/fitness/progress', data),
  deleteProgress:     (id)      => api.delete(`/fitness/progress/${id}`),
};

export default api;
