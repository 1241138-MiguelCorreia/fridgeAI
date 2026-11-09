const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// Mapear tipos Google Places para labels da app
function mapType(types = []) {
  if (types.includes('supermarket') || types.includes('grocery_or_supermarket')) {
    if (types.includes('department_store') || types.includes('shopping_mall')) return 'Hipermercado';
    return 'Supermercado';
  }
  if (types.includes('convenience_store')) return 'Minimercado';
  if (types.includes('market') || types.includes('food')) return 'Mercado';
  return 'Supermercado';
}

// Calcular distância em metros entre dois pontos (Haversine)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Formatar horário de abertura/fecho
function formatHours(openingHours) {
  if (!openingHours) return null;
  const isOpen = openingHours.open_now;
  if (!openingHours.periods) return { isOpen, label: isOpen ? 'Aberto agora' : 'Fechado' };

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg...
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (isOpen) {
    // Encontrar hora de fecho de hoje
    const todayClose = openingHours.periods.find(
      (p) => p.open?.day === dayOfWeek && p.close
    );
    if (todayClose?.close) {
      const closeH = Math.floor(todayClose.close.time / 100);
      const closeM = todayClose.close.time % 100;
      return { isOpen: true, label: `Aberto agora · Fecha às ${closeH}h${closeM > 0 ? closeM : ''}` };
    }
    return { isOpen: true, label: 'Aberto agora' };
  } else {
    // Encontrar próxima abertura
    const tomorrow = (dayOfWeek + 1) % 7;
    const nextOpen = openingHours.periods.find((p) => p.open?.day === tomorrow);
    if (nextOpen?.open) {
      const openH = Math.floor(nextOpen.open.time / 100);
      const openM = nextOpen.open.time % 100;
      return { isOpen: false, label: `Fechado · Abre amanhã às ${openH}h${openM > 0 ? openM : ''}` };
    }
    const todayOpen = openingHours.periods.find((p) => p.open?.day === dayOfWeek);
    if (todayOpen?.open) {
      const openH = Math.floor(todayOpen.open.time / 100);
      return { isOpen: false, label: `Fechado · Abre às ${openH}h` };
    }
    return { isOpen: false, label: 'Fechado' };
  }
}

// Normalizar resultado da Places API
function normalizePlace(place, userLat, userLng) {
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;
  const distanceM = lat && lng ? haversineDistance(userLat, userLng, lat, lng) : null;
  const hours = formatHours(place.opening_hours);

  return {
    placeId: place.place_id,
    name: place.name,
    type: mapType(place.types || []),
    address: place.vicinity || '',
    distanceM,
    distance: distanceM != null ? formatDistance(distanceM) : null,
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    isOpen: hours?.isOpen ?? null,
    hoursLabel: hours?.label ?? null,
    lat,
    lng,
  };
}

// ─── GET /places/nearby ────────────────────────────────────────────────────────
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 2000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Localização (lat, lng) é obrigatória.' });
    }
    if (!PLACES_API_KEY) {
      return res.status(500).json({ success: false, message: 'Google Places API não configurada.' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = Math.min(parseInt(radius), 5000);

    // Fazer dois pedidos em paralelo: supermercados e mercados
    const [superRes, marketRes] = await Promise.allSettled([
      axios.get(NEARBY_URL, {
        params: {
          location: `${userLat},${userLng}`,
          radius: searchRadius,
          type: 'supermarket',
          key: PLACES_API_KEY,
          language: 'pt-PT',
        },
      }),
      axios.get(NEARBY_URL, {
        params: {
          location: `${userLat},${userLng}`,
          radius: searchRadius,
          keyword: 'mercado',
          type: 'grocery_or_supermarket',
          key: PLACES_API_KEY,
          language: 'pt-PT',
        },
      }),
    ]);

    const superPlaces = superRes.status === 'fulfilled' ? (superRes.value.data.results || []) : [];
    const marketPlaces = marketRes.status === 'fulfilled' ? (marketRes.value.data.results || []) : [];

    // Juntar e desduplicar por place_id
    const seen = new Set();
    const combined = [...superPlaces, ...marketPlaces].filter((p) => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    // Normalizar e ordenar por distância
    const places = combined
      .map((p) => normalizePlace(p, userLat, userLng))
      .filter((p) => p.distanceM != null)
      .sort((a, b) => a.distanceM - b.distanceM);

    res.json({ success: true, places, total: places.length, radius: searchRadius });
  } catch (error) {
    console.error('[places/nearby] Erro:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao pesquisar lojas.' });
  }
});

module.exports = router;
