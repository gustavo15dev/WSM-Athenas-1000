import { supabase } from '../supabase';
import { areTurmasMatching } from './profileDb';

const NOTIFIED_CACHE_KEY = 'athenas_notified_item_ids_v2';

// Utility to get cached notified IDs
function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_CACHE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

// Utility to save notified ID
function markAsNotified(id: string) {
  try {
    const set = getNotifiedIds();
    set.add(id);
    // Keep set bounded to last 200 items
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage errors
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service Worker registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await registerServiceWorker();
    }
    return perm;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'denied';
  }
}

export async function sendBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    url?: string;
  }
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notificationBody = options?.body || 'Nova atualização no Portal Athenas.';
  const tag = options?.tag || `notif-${Date.now()}`;
  const targetUrl = options?.url || window.location.href;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: notificationBody,
          tag,
          vibrate: [200, 100, 200],
          data: { url: targetUrl }
        } as any);
        return true;
      }
    }

    // Fallback to standard web Notification API
    const notif = new Notification(title, {
      body: notificationBody,
      tag,
    });

    notif.onclick = () => {
      window.focus();
      if (options?.url && options.url !== window.location.href) {
        window.location.href = options.url;
      }
      notif.close();
    };

    return true;
  } catch (e) {
    console.warn('Failed to send browser notification:', e);
    return false;
  }
}

/**
 * Subscribes to real-time additions (announcements, simulados, messages)
 * and dispatches browser pop-up notifications for unread/new items.
 */
export function startRealtimeNotificationListener(
  userRole: 'student' | 'teacher',
  userClass?: string,
  userEmail?: string
) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return () => {};
  }

  // Register service worker if not yet done
  registerServiceWorker();

  const notifiedSet = getNotifiedIds();

  // Helper to check and notify new announcement
  const checkNewAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from('wsm_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        data.forEach((ann) => {
          if (!ann.id) return;
          const isNotified = notifiedSet.has(ann.id);
          if (!isNotified) {
            // Check if matches class target
            const targetClass = ann.class_name || ann.target_class || 'all';
            const matchesClass =
              targetClass === 'all' ||
              ['geral', 'todas', 'toda a escola', 'todos'].includes(targetClass.toLowerCase().trim()) ||
              !userClass ||
              targetClass.toLowerCase() === userClass.toLowerCase() ||
              targetClass.includes(userClass) ||
              areTurmasMatching(targetClass, userClass);

            // Only notify if created within the last 24 hours to prevent spamming old items
            const createdTime = new Date(ann.created_at).getTime();
            const now = Date.now();
            const isRecent = (now - createdTime) < (24 * 60 * 60 * 1000);

            if (matchesClass && isRecent) {
              sendBrowserNotification(`📢 Novo Aviso: ${ann.title || 'Aviso da Escola'}`, {
                body: ann.message ? ann.message.substring(0, 120) + '...' : 'Acesse o portal para conferir a publicação na íntegra.',
                tag: `ann-${ann.id}`
              });
            }
            markAsNotified(ann.id);
            notifiedSet.add(ann.id);
          }
        });
    }
    } catch (e) {
      // Ignore polling errors
    }
  };

  // Helper to check new mock exams
  const checkNewSimulados = async () => {
    if (userRole !== 'student') return;
    try {
      const { data } = await supabase
        .from('wsm_mock_exams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (data && data.length > 0) {
        data.forEach((exam) => {
          if (!exam.id) return;
          const isNotified = notifiedSet.has(`sim-${exam.id}`);
          if (!isNotified) {
            const createdTime = new Date(exam.created_at || Date.now()).getTime();
            const isRecent = (Date.now() - createdTime) < (48 * 60 * 60 * 1000);

            if (isRecent) {
              sendBrowserNotification(`📝 Novo Simulado Disponível: ${exam.title}`, {
                body: `Matéria: ${exam.subject || 'Geral'}. Acesse para responder agora!`,
                tag: `exam-${exam.id}`
              });
            }
            markAsNotified(`sim-${exam.id}`);
            notifiedSet.add(`sim-${exam.id}`);
          }
        });
      }
    } catch (e) {
      // Ignore
    }
  };

  // Run initial check
  checkNewAnnouncements();
  checkNewSimulados();

  // Polling interval every 12 seconds for seamless background detection
  const interval = setInterval(() => {
    checkNewAnnouncements();
    checkNewSimulados();
  }, 12000);

  // Set up Supabase real-time channel
  const channel = supabase
    .channel('browser-push-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'wsm_announcements' },
      (payload) => {
        const ann = payload.new;
        if (ann && ann.id && !notifiedSet.has(ann.id)) {
          sendBrowserNotification(`📢 Novo Aviso Publicado: ${ann.title || 'Aviso da Escola'}`, {
            body: ann.message || 'Há uma nova notificação importante para sua turma.',
            tag: `ann-${ann.id}`
          });
          markAsNotified(ann.id);
          notifiedSet.add(ann.id);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'wsm_mock_exams' },
      (payload) => {
        if (userRole === 'student') {
          const exam = payload.new;
          if (exam && exam.id && !notifiedSet.has(`sim-${exam.id}`)) {
            sendBrowserNotification(`🚨 Novo Simulado Liberado: ${exam.title}`, {
              body: `Professor(a) ${exam.teacher_name || 'Docente'} acabou de publicar uma avaliação.`,
              tag: `exam-${exam.id}`
            });
            markAsNotified(`sim-${exam.id}`);
            notifiedSet.add(`sim-${exam.id}`);
          }
        }
      }
    )
    .subscribe();

  return () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
}
