/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabase';

export interface ActiveUserPresence {
  id: string;
  email: string;
  name: string;
  role: string;
  turma?: string;
  currentScreen?: string;
  onlineSince: string;
  lastActive: string;
  browser?: string;
  platform?: string;
}

// Generate persistent client instance ID
const CLIENT_SESSION_ID =
  typeof window !== 'undefined'
    ? window.sessionStorage.getItem('wsm_session_client_id') ||
      (() => {
        const id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
        window.sessionStorage.setItem('wsm_session_client_id', id);
        return id;
      })()
    : 'server';

let presenceChannel: any = null;

function getClientBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'Desconhecido';
  const ua = navigator.userAgent;
  let browser = 'Navegador Web';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return `${browser} (${isMobile ? 'Mobile' : 'Desktop'})`;
}

/**
 * Initializes and updates user presence in Supabase Realtime
 */
export function registerUserPresence(payload: {
  email?: string;
  name?: string;
  role?: string;
  turma?: string;
  currentScreen?: string;
}) {
  if (typeof window === 'undefined') return;

  try {
    if (!presenceChannel) {
      presenceChannel = supabase.channel('athenas-realtime-presence', {
        config: {
          presence: {
            key: CLIENT_SESSION_ID
          }
        }
      });

      presenceChannel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            id: CLIENT_SESSION_ID,
            email: payload.email || 'visitante@athenas.edu',
            name: payload.name || 'Visitante',
            role: payload.role || 'guest',
            turma: payload.turma || '',
            currentScreen: payload.currentScreen || 'Portal Home',
            onlineSince: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            browser: getClientBrowserInfo(),
            platform: navigator.platform || 'Web'
          });
        }
      });
    } else {
      // Update track if already connected
      presenceChannel.track({
        id: CLIENT_SESSION_ID,
        email: payload.email || 'visitante@athenas.edu',
        name: payload.name || 'Visitante',
        role: payload.role || 'guest',
        turma: payload.turma || '',
        currentScreen: payload.currentScreen || 'Portal Home',
        onlineSince: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        browser: getClientBrowserInfo(),
        platform: navigator.platform || 'Web'
      });
    }
  } catch (err) {
    console.warn('Presence tracking notice:', err);
  }
}

/**
 * Hook to listen to all active presences across the entire school platform
 */
export function subscribeToAllActivePresences(
  onPresencesChange: (activeUsers: ActiveUserPresence[]) => void
) {
  const channel = supabase.channel('athenas-admin-presence-listener');

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const list: ActiveUserPresence[] = [];

      Object.values(state).forEach((presences: any) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            list.push(p as ActiveUserPresence);
          });
        }
      });

      onPresencesChange(list);
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (e) {}
  };
}
