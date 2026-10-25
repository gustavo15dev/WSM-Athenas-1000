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
export function registerUserPresence(_payload: {
  email?: string;
  name?: string;
  role?: string;
  turma?: string;
  currentScreen?: string;
}) {
  // Disabled presence tracking to conserve Supabase Realtime quota & DB resources
  return;
}

/**
 * Hook to listen to active presences across the platform (Disabled for DB economy)
 */
export function subscribeToAllActivePresences(
  onPresencesChange: (activeUsers: ActiveUserPresence[]) => void
) {
  onPresencesChange([]);
  return () => {};
}
