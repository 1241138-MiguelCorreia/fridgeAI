/**
 * Serviço de notificações — alerta para comida a expirar no inventário
 */

import * as Notifications from 'expo-notifications';
import { inventoryAPI } from './api';

// ── Configuração global do handler ────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Cooldown: evita disparar mais do que uma vez por minuto
let _lastExpiryCheck = 0;
const EXPIRY_COOLDOWN_MS = 60 * 1000;

// ── Pedir permissões ──────────────────────────────────────────────────────────
export async function requestNotificationPermissions() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Notificações de expiração ─────────────────────────────────────────────────
export async function scheduleExpiryNotifications() {
  const checkTime = Date.now();
  if (checkTime - _lastExpiryCheck < EXPIRY_COOLDOWN_MS) return;
  _lastExpiryCheck = checkTime;

  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // Cancelar notificações anteriores de inventário
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter((n) => n.content.data?.type === 'expiry');
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    // Buscar inventário atual
    const res = await inventoryAPI.getAll();
    const items = res.data.items || [];

    // Produtos a expirar em ≤ 2 dias — notificação imediata
    const urgentes = items.filter(
      (i) => i.estimatedExpiryDays != null && i.estimatedExpiryDays <= 2
    );

    // Produtos a expirar em 3-5 dias — aviso antecipado
    const breve = items.filter(
      (i) => i.estimatedExpiryDays != null && i.estimatedExpiryDays > 2 && i.estimatedExpiryDays <= 5
    );

    if (urgentes.length > 0) {
      const nomes = urgentes.slice(0, 3).map((i) => i.name).join(', ');
      const extra = urgentes.length > 3 ? ` e mais ${urgentes.length - 3}` : '';
      const temHoje = urgentes.some((i) => i.estimatedExpiryDays <= 1);
      const title = temHoje ? '⚠️ Usar hoje!' : '⏰ Usar nos próximos 2 dias';

      // Notificação imediata (trigger: null)
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: `${nomes}${extra} ${urgentes.length === 1 ? 'está' : 'estão'} a expirar em breve.`,
          data: { type: 'expiry', urgency: 'urgent' },
        },
        trigger: null,
      });

      // Lembrete amanhã às 09:00 — formato correto para v0.32
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 1);
      followUp.setHours(9, 0, 0, 0);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Ainda tens comida a expirar',
          body: `${nomes}${extra} ainda ${urgentes.length === 1 ? 'está' : 'estão'} no inventário. Usa antes que estrague!`,
          data: { type: 'expiry', urgency: 'followup' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: followUp,
        },
      });
    }

    // Aviso antecipado para 3-5 dias — amanhã às 09:00
    if (breve.length > 0) {
      const triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + 1);
      triggerDate.setHours(9, 0, 0, 0);

      const nomes = breve.slice(0, 3).map((i) => i.name).join(', ');
      const extra = breve.length > 3 ? ` e mais ${breve.length - 3}` : '';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🕐 A expirar esta semana',
          body: `${nomes}${extra} ${breve.length === 1 ? 'expira' : 'expiram'} nos próximos dias. Planeia uma refeição!`,
          data: { type: 'expiry', urgency: 'soon' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    }
  } catch (err) {
    console.warn('Erro ao agendar notificações de expiração:', err?.message || err);
  }
}

// ── Lembrete diário às 08:00 ──────────────────────────────────────────────────
export async function scheduleDailyReminder(isFitness = false) {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // Cancelar lembrete diário anterior
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter((n) => n.content.data?.type === 'daily_reminder');
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    // Modo normal: sem lembrete diário
    if (!isFitness) return;

    // Modo fitness: streak às 08:00 — formato correto para v0.32
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Não percas a tua streak!',
        body: 'Regista as refeições de hoje para manteres os dias seguidos.',
        data: { type: 'daily_reminder', subtype: 'streak' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  } catch (err) {
    console.warn('Erro ao agendar lembrete diário:', err?.message || err);
  }
}
