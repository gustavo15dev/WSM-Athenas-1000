import { areTurmasMatching } from './profileDb';

export interface TargetParsed {
  classes: string[];
  students: string[];
}

export function parseExamTargets(rawTarget: string | null | undefined): TargetParsed {
  if (!rawTarget || !rawTarget.trim()) {
    return { classes: [], students: [] };
  }

  const str = rawTarget.trim();

  // If JSON format
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        const classes: string[] = [];
        const students: string[] = [];
        parsed.forEach((item: string) => {
          if (item && typeof item === 'string') {
            if (item.includes('@')) students.push(item.toLowerCase().trim());
            else classes.push(item.trim());
          }
        });
        return { classes, students };
      } else if (typeof parsed === 'object' && parsed !== null) {
        return {
          classes: Array.isArray(parsed.classes) ? parsed.classes : [],
          students: Array.isArray(parsed.students) ? parsed.students.map((s: string) => String(s).toLowerCase().trim()) : []
        };
      }
    } catch {
      // Fallback
    }
  }

  // Comma-separated or single string
  const items = str.split(',').map(s => s.trim()).filter(Boolean);
  const classes: string[] = [];
  const students: string[] = [];

  items.forEach(item => {
    if (item.includes('@')) {
      students.push(item.toLowerCase());
    } else {
      classes.push(item);
    }
  });

  return { classes, students };
}

export function matchesStudentTarget(
  rawTarget: string | null | undefined,
  studentEmail: string,
  studentCohort?: string,
  virtualClassIdsOrNames: string[] = []
): boolean {
  if (!rawTarget) return false;
  const rawClean = rawTarget.trim().toLowerCase();
  if (['geral', 'todas', 'toda a escola', 'todos'].includes(rawClean)) {
    return true;
  }

  const { classes, students } = parseExamTargets(rawTarget);
  const emailLower = (studentEmail || '').toLowerCase();

  // 1. Check if student's email is explicitly targeted
  if (students.some(s => s.toLowerCase() === emailLower)) {
    return true;
  }

  // Fallback for single string email target
  if (rawTarget.toLowerCase().trim() === emailLower) {
    return true;
  }

  // 2. Check official student cohort
  if (studentCohort && classes.some(c => areTurmasMatching(c, studentCohort) || c.toLowerCase() === studentCohort.toLowerCase())) {
    return true;
  }

  // 3. Check student's virtual classes
  const matchesVC = virtualClassIdsOrNames.some(vcIdentifier => {
    if (!vcIdentifier) return false;
    const vcLower = vcIdentifier.toLowerCase();
    return classes.some(c => areTurmasMatching(c, vcIdentifier) || c.toLowerCase() === vcLower);
  });

  if (matchesVC) return true;

  // Single string match fallback
  if (classes.length === 0 && students.length === 0) {
    if (studentCohort && areTurmasMatching(rawTarget, studentCohort)) return true;
    if (virtualClassIdsOrNames.some(v => areTurmasMatching(rawTarget, v))) return true;
  }

  return false;
}

export function formatTargetDisplayName(rawTarget: string | null | undefined, virtualClasses: any[] = []): string {
  if (!rawTarget || !rawTarget.trim()) return 'Toda a Escola';

  const { classes, students } = parseExamTargets(rawTarget);
  const formattedItems: string[] = [];

  for (const c of classes) {
    if (!c) continue;
    const foundVc = virtualClasses.find(vc => 
      vc && (vc.id === c || vc.access_code === c || (vc.name && vc.name.toLowerCase() === c.toLowerCase()))
    );
    if (foundVc) {
      formattedItems.push(foundVc.name || 'Sala Virtual');
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) {
      formattedItems.push('Sala Virtual');
    } else {
      formattedItems.push(c);
    }
  }

  if (students.length > 0) {
    if (students.length === 1) {
      formattedItems.push(`Aluno (${students[0]})`);
    } else {
      formattedItems.push(`${students.length} aluno(s) específico(s)`);
    }
  }

  if (formattedItems.length === 0) return 'Geral / Toda a Escola';
  return formattedItems.join(', ');
}

export function getStudentVirtualClassIdentifiers(studentEmail: string, virtualClasses: any[] = []): string[] {
  if (!studentEmail) return [];
  const emailLower = studentEmail.toLowerCase();
  const ids: string[] = [];
  virtualClasses.forEach(vc => {
    if (!vc) return;
    let emails: string[] = [];
    if (Array.isArray(vc.student_emails)) {
      emails = vc.student_emails.map((e: string) => String(e).toLowerCase());
    } else if (typeof vc.student_emails === 'string') {
      try {
        const parsed = JSON.parse(vc.student_emails);
        if (Array.isArray(parsed)) emails = parsed.map((e: string) => String(e).toLowerCase());
      } catch {
        emails = [vc.student_emails.toLowerCase()];
      }
    }
    if (emails.includes(emailLower)) {
      if (vc.id) ids.push(vc.id);
      if (vc.name) ids.push(vc.name);
      if (vc.access_code) ids.push(vc.access_code);
    }
  });
  return ids;
}
