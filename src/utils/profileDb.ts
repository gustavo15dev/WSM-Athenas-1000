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
  role: 'student' | 'teacher' | 'admin' | 'parent';
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
  if (payload.role) {
    try {
      localStorage.setItem(`wsm_profile_role_${cleanEmail}`, payload.role);
    } catch {}
  }

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

  // If role is parent, do not block user if Supabase check constraint is pending SQL update
  if (payload.role === 'parent') {
    console.warn('[safeUpsertUserProfile] Cadastro de responsável aceito com persistência local resiliente:', (minError || error)?.message);
    return {
      data: {
        id: payload.id,
        email: cleanEmail,
        role: 'parent',
        nome_completo: payload.nome_completo || 'Responsável',
        escola: 'Responsável',
        turma: null,
        numero_chamada: null,
        materia: null,
        anos_lecionados: null,
        notification_gmail: localGmail,
        welcome_modal_dismissed: true,
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

  // Fallback for parent profile when DB schema update is pending
  const localRole = localStorage.getItem(`wsm_profile_role_${cleanEmail}`);
  if (localRole === 'parent') {
    return {
      id: undefined,
      email: cleanEmail,
      role: 'parent' as const,
      nome_completo: localStorage.getItem(`wsm_profile_nome_${cleanEmail}`) || 'Responsável',
      escola: 'Responsável',
      turma: null,
      numero_chamada: null,
      materia: null,
      anos_lecionados: null,
      notification_gmail: localStorage.getItem(`wsm_gmail_fallback_${cleanEmail}`) || null,
      welcome_modal_dismissed: true,
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
      .select('id, name, teacher_email, student_emails, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

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

/**
 * Persiste a confirmação do termo de consentimento do chat no Supabase (auth metadata e perfil) e cache local
 */
export async function setChatConsentDismissedInDb(email: string): Promise<boolean> {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return false;

  try {
    localStorage.setItem(`wsm_chat_consent_dismissed_${cleanEmail}`, 'true');
  } catch {}

  // 1. Atualiza metadados do usuário autenticado no Supabase Auth
  try {
    await supabase.auth.updateUser({
      data: {
        chat_consent_dismissed: true,
        chat_consent_accepted_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.warn('Notice: Error updating auth metadata for chat consent:', err);
  }

  // 2. Atualiza na tabela wsm_user_profiles
  try {
    await supabase
      .from('wsm_user_profiles')
      .update({ chat_consent_dismissed: true })
      .ilike('email', cleanEmail);
  } catch (err) {
    // Coluna pode não existir
  }

  return true;
}

/**
 * Verifica no Supabase (auth metadata e perfil) e cache se o aluno já marcou "Não mostrar novamente"
 */
export async function checkChatConsentDismissedInDb(email: string): Promise<boolean> {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return false;

  // 1. Cache ultrarrápido no localStorage
  try {
    const cached = localStorage.getItem(`wsm_chat_consent_dismissed_${cleanEmail}`);
    if (cached === 'true') return true;
  } catch {}

  // 2. Consulta metadados de autenticação do usuário
  try {
    const { data: authUserData } = await supabase.auth.getUser();
    if (authUserData?.user?.user_metadata?.chat_consent_dismissed === true) {
      try {
        localStorage.setItem(`wsm_chat_consent_dismissed_${cleanEmail}`, 'true');
      } catch {}
      return true;
    }
  } catch (err) {}

  // 3. Consulta na tabela wsm_user_profiles
  try {
    const { data, error } = await supabase
      .from('wsm_user_profiles')
      .select('chat_consent_dismissed')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data && (data as any).chat_consent_dismissed === true) {
      try {
        localStorage.setItem(`wsm_chat_consent_dismissed_${cleanEmail}`, 'true');
      } catch {}
      return true;
    }
  } catch (err) {}

  return false;
}

/**
 * Funções para gerenciamento do Vínculo Aluno <-> Pais (Parent Portal)
 */

export function generateRandom4DigitCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Caracteres nítidos sem confusão (sem 0/O, 1/I)
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Aluno gera um código de 4 dígitos para passar aos pais (máximo 5 vínculos ativos)
 */
export async function generateParentLinkCode(studentEmail: string, studentName?: string): Promise<{ success: boolean; code?: string; error?: string }> {
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  if (!cleanEmail) return { success: false, error: 'E-mail do aluno inválido.' };

  try {
    // 1. Verifica quantos vínculos ativos o aluno já possui
    const { data: existingLinks, error: countErr } = await supabase
      .from('wsm_student_parent_links')
      .select('id, status')
      .eq('student_email', cleanEmail)
      .eq('status', 'active');

    if (countErr) {
      console.warn('Erro ao consultar vínculos existentes:', countErr);
    }

    if (existingLinks && existingLinks.length >= 5) {
      return { 
        success: false, 
        error: 'Você já atingiu o limite máximo de 5 responsáveis vinculados à sua conta.' 
      };
    }

    // 2. Remove códigos pendentes antigos não utilizados desse aluno para não acumular
    await supabase
      .from('wsm_student_parent_links')
      .delete()
      .eq('student_email', cleanEmail)
      .eq('status', 'pending');

    // 3. Gera novo código exclusivo
    const newCode = generateRandom4DigitCode();

    const { error: insertErr } = await supabase
      .from('wsm_student_parent_links')
      .insert({
        student_email: cleanEmail,
        student_name: studentName || 'Aluno(a)',
        link_code: newCode,
        status: 'pending'
      });

    if (insertErr) {
      console.error('Erro ao salvar código de vínculo:', insertErr);
      return { success: false, error: 'Não foi possível gerar o código no momento. Tente novamente.' };
    }

    return { success: true, code: newCode };
  } catch (err: any) {
    console.error('Erro em generateParentLinkCode:', err);
    return { success: false, error: err.message || 'Erro inesperado ao gerar código.' };
  }
}

/**
 * Consulta todos os vínculos (ativos e pendentes) de um aluno
 */
export async function fetchStudentParentLinks(studentEmail: string) {
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  if (!cleanEmail) return { active: [], pendingCode: null };

  try {
    const { data, error } = await supabase
      .from('wsm_student_parent_links')
      .select('*')
      .eq('student_email', cleanEmail)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const active = (data || []).filter((item: any) => item.status === 'active');
    const pending = (data || []).find((item: any) => item.status === 'pending');

    return { active, pendingCode: pending?.link_code || null };
  } catch (err) {
    console.warn('Erro ao buscar vínculos do aluno:', err);
    return { active: [], pendingCode: null };
  }
}

/**
 * Remove um vínculo existente (aluno desvincula responsável ou pai desvincula)
 */
export async function removeStudentParentLink(linkId: string): Promise<boolean> {
  if (!linkId) return false;
  try {
    const { error } = await supabase
      .from('wsm_student_parent_links')
      .delete()
      .eq('id', linkId);

    return !error;
  } catch (err) {
    console.error('Erro ao remover vínculo:', err);
    return false;
  }
}

/**
 * Pai vincula a conta inserindo o código de 4 dígitos
 */
export async function linkParentWithCode(
  parentEmail: string, 
  rawCode: string
): Promise<{ success: boolean; studentName?: string; studentEmail?: string; error?: string }> {
  const cleanParentEmail = (parentEmail || '').toLowerCase().trim();
  const cleanCode = (rawCode || '').toUpperCase().trim();

  if (!cleanParentEmail) return { success: false, error: 'E-mail do responsável inválido.' };
  if (!cleanCode || cleanCode.length !== 4) return { success: false, error: 'O código deve conter exatamente 4 dígitos.' };

  try {
    // 1. Busca link pendente com este código
    const { data: linkRecord, error: searchErr } = await supabase
      .from('wsm_student_parent_links')
      .select('*')
      .eq('link_code', cleanCode)
      .eq('status', 'pending')
      .maybeSingle();

    if (searchErr || !linkRecord) {
      return { 
        success: false, 
        error: 'Código inválido ou expirado. Peça ao seu filho para gerar um novo código nos Ajustes.' 
      };
    }

    const studentEmail = (linkRecord.student_email || '').toLowerCase().trim();

    // 2. Verifica se o aluno já atingiu o limite de 5 vínculos ativos
    const { data: activeLinks } = await supabase
      .from('wsm_student_parent_links')
      .select('id, parent_email')
      .eq('student_email', studentEmail)
      .eq('status', 'active');

    if (activeLinks && activeLinks.length >= 5) {
      return {
        success: false,
        error: 'Este aluno já atingiu o limite máximo de 5 responsáveis vinculados.'
      };
    }

    // 3. Verifica se este pai já está vinculado a este mesmo aluno
    const alreadyLinked = (activeLinks || []).some(
      (l: any) => (l.parent_email || '').toLowerCase().trim() === cleanParentEmail
    );
    if (alreadyLinked) {
      return {
        success: false,
        error: 'Você já possui vínculo ativo com este aluno.'
      };
    }

    // 4. Ativa o vínculo
    const { error: updateErr } = await supabase
      .from('wsm_student_parent_links')
      .update({
        parent_email: cleanParentEmail,
        status: 'active',
        linked_at: new Date().toISOString()
      })
      .eq('id', linkRecord.id);

    if (updateErr) {
      return { success: false, error: 'Erro ao ativar o vínculo. Tente novamente.' };
    }

    return { 
      success: true, 
      studentName: linkRecord.student_name, 
      studentEmail: linkRecord.student_email 
    };
  } catch (err: any) {
    console.error('Erro ao vincular pai e aluno:', err);
    return { success: false, error: err.message || 'Erro inesperado ao vincular.' };
  }
}

/**
 * Busca todos os alunos vinculados a uma conta de pai/mãe
 */
export async function fetchParentLinkedStudents(parentEmail: string) {
  const cleanEmail = (parentEmail || '').toLowerCase().trim();
  if (!cleanEmail) return [];

  try {
    const { data: links, error } = await supabase
      .from('wsm_student_parent_links')
      .select('*')
      .eq('parent_email', cleanEmail)
      .eq('status', 'active')
      .order('linked_at', { ascending: false });

    if (error || !links || links.length === 0) return [];

    // Busca os perfis acadêmicos dos alunos vinculados para ter turma, RA, nome completo atualizado
    const studentEmails = links.map((l: any) => l.student_email.toLowerCase().trim());
    const { data: profiles } = await supabase
      .from('wsm_user_profiles')
      .select('*')
      .in('email', studentEmails);

    const profileMap = new Map();
    (profiles || []).forEach((p: any) => {
      profileMap.set((p.email || '').toLowerCase().trim(), p);
    });

    return links.map((link: any) => {
      const email = (link.student_email || '').toLowerCase().trim();
      const prof = profileMap.get(email);
      return {
        linkId: link.id,
        email: email,
        name: prof?.nome_completo || link.student_name || 'Aluno(a)',
        turma: prof?.turma || 'Turma não informada',
        numero_chamada: prof?.numero_chamada,
        escola: prof?.escola,
        linked_at: link.linked_at || link.created_at
      };
    });
  } catch (err) {
    console.warn('Erro ao carregar alunos vinculados ao responsável:', err);
    return [];
  }
}
