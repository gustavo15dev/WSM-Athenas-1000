/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabase';

export interface AuditLogPayload {
  userEmail: string;
  userName?: string;
  role: 'student' | 'teacher' | 'admin';
  action: string;
  details: string;
  metadata?: any;
}

/**
 * Triggers an audit log insert in public.wsm_system_logs.
 * Gracefully catches errors to never disrupt the client application flow.
 */
export async function logSystemAction({
  userEmail,
  userName = 'Usuário',
  role,
  action,
  details,
  metadata = {}
}: AuditLogPayload) {
  try {
    // Collect user agent info and mock structured location
    const browserInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Background';
    const finalMetadata = {
      ...metadata,
      browser: browserInfo,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString()
    };

    // Determine readable device browser info instead of geolocated cities
    let deviceStr = 'Navegador Web';
    try {
      const uAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
      if (uAgent.includes('firefox')) {
        deviceStr = 'Firefox';
      } else if (uAgent.includes('chrome')) {
        deviceStr = 'Chrome';
      } else if (uAgent.includes('safari')) {
        deviceStr = 'Safari';
      } else if (uAgent.includes('edge')) {
        deviceStr = 'Edge';
      }
      
      if (uAgent.includes('windows')) {
        deviceStr += ' (Windows)';
      } else if (uAgent.includes('macintosh') || uAgent.includes('mac os')) {
        deviceStr += ' (macOS)';
      } else if (uAgent.includes('linux')) {
        deviceStr += ' (Linux)';
      } else if (uAgent.includes('android')) {
        deviceStr += ' (Android)';
      } else if (uAgent.includes('iphone') || uAgent.includes('ipad')) {
        deviceStr += ' (iOS)';
      }
    } catch (_) {
      // ignore
    }

    const { error } = await supabase
      .from('wsm_system_logs')
      .insert({
        user_email: userEmail.toLowerCase(),
        user_name: userName,
        role,
        action,
        details,
        metadata: finalMetadata,
        location_info: deviceStr
      });

    if (error) {
       console.warn('Could not insert audit log:', error.message);
    }
  } catch (err) {
    console.warn('Logging function threw exception:', err);
  }
}
