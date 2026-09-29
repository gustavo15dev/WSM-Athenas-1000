import { supabase } from '../supabase';

export interface EnrolledTeacher {
  id: string;
  email: string;
  nome_completo: string;
  materia?: string;
  role?: string;
  anos_lecionados?: string[] | string;
}

export function parseStudentEmails(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
    } catch {
      // split by commas
    }
    return raw.split(',').map((e) => e.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}

/**
 * Retorna estritamente os professores das turmas em que o aluno está matriculado (BUG-04).
 * Se o aluno não estiver matriculado em nenhuma sala, retorna [] imediatamente.
 */
export async function getStudentTeachers(studentEmail: string, userTurma?: string): Promise<EnrolledTeacher[]> {
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  if (!cleanEmail) return [];

  // 1. Tentar Edge Function Supabase caso tenha sido feito o deploy
  try {
    const { data, error } = await supabase.functions.invoke('get-student-teachers', {
      body: { email: cleanEmail }
    });
    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch {
    // Edge function fallback
  }

  // 2. Tentar endpoint da API interna do servidor
  try {
    const res = await fetch(`/api/get-student-teachers?email=${encodeURIComponent(cleanEmail)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // API endpoint fallback
  }

  // 3. Fallback no cliente via Supabase:
  // Primeiro, busca as salas virtuais em que o aluno está matriculado
  try {
    const { data: vClasses } = await supabase
      .from('wsm_virtual_classes')
      .select('id, name, teacher_email, teacher_id, student_emails');

    const enrolledClasses = (vClasses || []).filter((vc: any) => {
      if (!vc) return false;
      const emails = parseStudentEmails(vc.student_emails);
      return emails.includes(cleanEmail);
    });

    if (enrolledClasses.length === 0) {
      // Se o aluno não está matriculado em nenhuma sala, NÃO lista nenhum professor!
      return [];
    }

    const teacherEmails = Array.from(new Set(
      enrolledClasses
        .map((vc: any) => (vc.teacher_email || '').toLowerCase().trim())
        .filter(Boolean)
    ));

    if (teacherEmails.length === 0) {
      return [];
    }

    // Consulta os dados dos professores utilizando .in('email', teacherEmails)
    // NOTA: sem a coluna 'escola' para evitar erro 400 Bad Request
    const { data: teachers, error } = await supabase
      .from('wsm_user_profiles')
      .select('id, email, nome_completo, materia, role, anos_lecionados')
      .in('email', teacherEmails);

    if (error || !teachers) {
      return [];
    }

    return teachers.filter((t: any) => {
      const em = (t.email || '').toLowerCase().trim();
      return teacherEmails.includes(em) && !em.endsWith('@example.com') && !em.endsWith('@atenas.com');
    });
  } catch (err) {
    console.error('Erro ao buscar professores do aluno:', err);
    return [];
  }
}
