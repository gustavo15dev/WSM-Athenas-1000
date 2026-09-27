import { supabase } from '../supabase';

export function normalizeTurmaToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([0-9]+)\s*[oº°ª](?=\s|ano|serie|grau|$)/gi, '$1')
    .replace(/[º°ª\-_.\s]+/g, '')
    .trim();
}

export function extractCohortKey(str: string): string | null {
  const cleaned = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª\-_.\s]+/g, '')
    .replace(/ano|serie|grau/g, '');
  
  const match = cleaned.match(/([0-9]+[a-z]?)/i);
  return match ? match[1].toLowerCase() : null;
}

export function areClassNamesDuplicate(name1: string | null | undefined, name2: string | null | undefined): boolean {
  if (!name1 || !name2) return false;
  const n1 = normalizeTurmaToken(name1);
  const n2 = normalizeTurmaToken(name2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

export function areTurmasMatching(t1: string | null | undefined, t2: string | null | undefined): boolean {
  if (!t1 || !t2) return false;
  const n1 = normalizeTurmaToken(t1);
  const n2 = normalizeTurmaToken(t2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  const c1 = extractCohortKey(t1);
  const c2 = extractCohortKey(t2);

  // If both define a cohort letter/number (e.g. 9a vs 9b) and they don't match, they CANNOT match!
  if (c1 && c2 && c1 !== c2) return false;

  if (n1.includes(n2) || n2.includes(n1)) return true;
  if (c1 && c2 && c1 === c2) return true;

  return false;
}

export interface UserProfilePayload {
  id?: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  nome_completo?: string | null;
  turma?: string | null;
  numero_chamada?: number | null;
  anos_lecionados?: string[] | string | null;
  materia?: string | null;
  escola?: string | null;
  notification_gmail?: string | null;
  welcome_modal_dismissed?: boolean | null;
}

export async function safeUpsertUserProfile(payload: UserProfilePayload) {
  const cleanEmail = payload.email.toLowerCase().trim();
  
  // Cache local fallbacks immediately so UI is always consistent
  if (payload.escola !== undefined && payload.escola !== null) {
    try {
      localStorage.setItem(`wsm_profile_escola_${cleanEmail}`, payload.escola);
    } catch {}
  }
  if (payload.notification_gmail) {
    try {
      localStorage.setItem(`wsm_gmail_fallback_${cleanEmail}`, payload.notification_gmail);
    } catch {}
  }
  if (payload.nome_completo) {
    try {
      localStorage.setItem(`wsm_profile_nome_${cleanEmail}`, payload.nome_completo);
    } catch {}
  }
  if (payload.turma) {
    try {
      localStorage.setItem(`wsm_profile_turma_${cleanEmail}`, payload.turma);
    } catch {}
  }
  if (payload.numero_chamada !== undefined && payload.numero_chamada !== null) {
    try {
      localStorage.setItem(`wsm_profile_chamada_${cleanEmail}`, String(payload.numero_chamada));
    } catch {}
  }
  if (payload.materia) {
    try {
      localStorage.setItem(`wsm_profile_materia_${cleanEmail}`, payload.materia);
    } catch {}
  }

  // Core payload with known schema columns (avoiding schema-mismatch columns like 'escola' and 'notification_gmail')
  const corePayload: any = {
    ...(payload.id ? { id: payload.id } : {}),
    email: cleanEmail,
    role: payload.role,
    nome_completo: payload.nome_completo || null,
    turma: payload.turma || null,
    numero_chamada: payload.numero_chamada !== undefined && payload.numero_chamada !== null && !isNaN(payload.numero_chamada) ? payload.numero_chamada : null,
    anos_lecionados: payload.anos_lecionados || null,
    materia: payload.materia || null,
    ...(payload.welcome_modal_dismissed !== undefined ? { welcome_modal_dismissed: payload.welcome_modal_dismissed } : {}),
  };

  const localEscola = payload.escola || localStorage.getItem(`wsm_profile_escola_${cleanEmail}`) || '';
  const localGmail = payload.notification_gmail || localStorage.getItem(`wsm_gmail_fallback_${cleanEmail}`) || null;

  // 1. Try upserting core payload
  let { data, error } = await supabase
    .from('wsm_user_profiles')
    .upsert(corePayload, { onConflict: 'email' })
    .select()
    .maybeSingle();

  if (!error) {
    return { 
      data: {
        ...(data || corePayload),
        escola: (data && data.escola) || localEscola,
        notification_gmail: (data && data.notification_gmail) || localGmail,
      }, 
      error: null 
    };
  }

  console.warn('[safeUpsertUserProfile] Core upsert failed, retrying with minimal columns:', error.message);

  // 2. Fallback to minimal payload if core payload fails on column mismatches
  const minimalPayload: any = {
    ...(payload.id ? { id: payload.id } : {}),
    email: cleanEmail,
    role: payload.role,
    nome_completo: payload.nome_completo || null,
    turma: payload.turma || null,
    numero_chamada: payload.numero_chamada !== undefined && payload.numero_chamada !== null && !isNaN(payload.numero_chamada) ? payload.numero_chamada : null,
  };

  const { data: minData, error: minError } = await supabase
    .from('wsm_user_profiles')
    .upsert(minimalPayload, { onConflict: 'email' })
    .select()
    .maybeSingle();

  if (!minError) {
    return {
      data: {
        ...(minData || minimalPayload),
        materia: payload.materia || 'Biologia',
        anos_lecionados: payload.anos_lecionados || null,
        escola: localEscola,
        notification_gmail: localGmail,
      },
      error: null,
    };
  }

  return { data: null, error: minError || error };
}

export async function safeFetchUserProfile(email: string) {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return null;

  let profileData: any = null;

  // 1. Try core select matching DB schema with welcome_modal_dismissed
  try {
    const { data, error } = await supabase
      .from('wsm_user_profiles')
      .select('id, nome_completo, turma, numero_chamada, email, role, anos_lecionados, materia, notification_gmail, welcome_modal_dismissed')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data) {
      profileData = data;
    }
  } catch (err) {
    console.warn('[safeFetchUserProfile] Select with welcome_modal_dismissed failed:', err);
  }

  // 2. Fallback select if welcome_modal_dismissed or notification_gmail is missing
  if (!profileData) {
    try {
      const { data, error } = await supabase
        .from('wsm_user_profiles')
        .select('id, nome_completo, turma, numero_chamada, email, role, anos_lecionados, materia')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (!error && data) {
        profileData = data;
      }
    } catch (err) {
      console.warn('[safeFetchUserProfile] Core select failed:', err);
    }
  }

  if (profileData) {
    // Enrich with cached fallbacks
    const localEscola = localStorage.getItem(`wsm_profile_escola_${cleanEmail}`);
    const localGmail = localStorage.getItem(`wsm_gmail_fallback_${cleanEmail}`);
    const localChamadaRaw = localStorage.getItem(`wsm_profile_chamada_${cleanEmail}`);
    const localChamada = localChamadaRaw ? parseInt(localChamadaRaw, 10) : NaN;
    const localDismissed = localStorage.getItem(`wsm_dismissed_welcome_modal_${cleanEmail}`) === 'true';

    const resolvedChamada = (profileData.numero_chamada !== undefined && profileData.numero_chamada !== null)
      ? Number(profileData.numero_chamada)
      : (!isNaN(localChamada) ? localChamada : profileData.numero_chamada);

    const resolvedDismissed = profileData.welcome_modal_dismissed === true || localDismissed;

    return {
      ...profileData,
      numero_chamada: resolvedChamada,
      escola: profileData.escola || localEscola || '',
      notification_gmail: profileData.notification_gmail || localGmail || null,
      welcome_modal_dismissed: resolvedDismissed,
    };
  }

  return null;
}

export async function setWelcomeModalDismissedInDb(email: string, profileId?: string) {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return;

  // 1. Cache locally immediately for instant feedback
  try {
    localStorage.setItem(`wsm_dismissed_welcome_modal_${cleanEmail}`, 'true');
  } catch {}

  // 2. Persist to auth user_metadata (works on all devices and requires no DB schema migrations)
  try {
    await supabase.auth.updateUser({
      data: { welcome_modal_dismissed: true }
    });
  } catch (err) {
    console.warn('Notice: Error updating auth metadata for welcome modal:', err);
  }

  // 3. Persist to wsm_user_profiles table in Supabase
  try {
    let query = supabase.from('wsm_user_profiles').update({ welcome_modal_dismissed: true });
    if (profileId) {
      query = query.eq('id', profileId);
    } else {
      query = query.ilike('email', cleanEmail);
    }
    const { error } = await query;
    if (error) {
      console.warn('Notice: wsm_user_profiles welcome_modal_dismissed update notice:', error.message);
    }
  } catch (err) {
    console.warn('Notice: Error updating wsm_user_profiles for welcome modal:', err);
  }
}

export async function isWelcomeModalDismissedInDb(email: string): Promise<boolean> {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return false;

  // 1. Check local cache first
  try {
    if (localStorage.getItem(`wsm_dismissed_welcome_modal_${cleanEmail}`) === 'true') {
      return true;
    }
  } catch {}

  // 2. Check auth metadata (persists across all devices)
  try {
    const { data: authUserData } = await supabase.auth.getUser();
    if (authUserData?.user?.user_metadata?.welcome_modal_dismissed === true) {
      try {
        localStorage.setItem(`wsm_dismissed_welcome_modal_${cleanEmail}`, 'true');
      } catch {}
      return true;
    }
  } catch (err) {
    console.warn('Notice: Error checking auth metadata for welcome modal:', err);
  }

  // 3. Check wsm_user_profiles in Supabase
  try {
    const { data, error } = await supabase
      .from('wsm_user_profiles')
      .select('welcome_modal_dismissed')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data && data.welcome_modal_dismissed === true) {
      try {
        localStorage.setItem(`wsm_dismissed_welcome_modal_${cleanEmail}`, 'true');
      } catch {}
      return true;
    }
  } catch (err) {
    // Column might not exist yet
  }

  return false;
}

export async function getStudentVirtualClasses(studentEmail: string, studentTurma?: string | null) {
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  try {
    const { data: allVClasses, error } = await supabase
      .from('wsm_virtual_classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !allVClasses) return [];

    return allVClasses.filter((vc: any) => {
      let emails: string[] = [];
      if (Array.isArray(vc.student_emails)) {
        emails = vc.student_emails;
      } else if (typeof vc.student_emails === 'string') {
        try {
          emails = JSON.parse(vc.student_emails);
        } catch {
          emails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      const inStudentEmails = emails.some((e: any) => e && String(e).toLowerCase().trim() === cleanEmail);
      const matchesCohort = studentTurma ? areTurmasMatching(vc.name, studentTurma) : false;

      return inStudentEmails || matchesCohort;
    });
  } catch (err) {
    console.warn('[getStudentVirtualClasses] Error querying virtual classes:', err);
    return [];
  }
}
