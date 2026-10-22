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
  if (!rawTarget || !rawTarget.trim()) return false;
  const rawClean = rawTarget.trim().toLowerCase();
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  const cleanTurma = (studentCohort || '').trim();

  const { classes, students } = parseExamTargets(rawTarget);

  // 1. If specific students are explicitly designated:
  // MUST ONLY show to those specific students. Other students in the class MUST NOT see it.
  if (students.length > 0) {
    return students.includes(cleanEmail);
  }

  // Fallback for single string rawTarget if it's an email address
  if (rawClean.includes('@')) {
    return rawClean === cleanEmail;
  }

  // 2. If student has no room/turma and no virtual classes, they must not receive class-wide exams
  const hasAnyRoomOrCohort = Boolean(cleanTurma) || virtualClassIdsOrNames.length > 0;
  if (['geral', 'todas', 'toda a escola', 'todos'].includes(rawClean)) {
    return hasAnyRoomOrCohort;
  }

  // 3. Check official student cohort match
  if (cleanTurma && classes.some(c => c && (areTurmasMatching(c, cleanTurma) || c.toLowerCase().trim() === cleanTurma.toLowerCase()))) {
    return true;
  }

  // 4. Check student's virtual classes match
  if (virtualClassIdsOrNames.length > 0) {
    const matchesVC = virtualClassIdsOrNames.some(vcIdentifier => {
      if (!vcIdentifier) return false;
      const vcLower = vcIdentifier.toLowerCase().trim();
      return classes.some(c => c && (areTurmasMatching(c, vcIdentifier) || c.toLowerCase().trim() === vcLower));
    });
    if (matchesVC) return true;
  }

  // 5. Fallback for rawTarget single string match if classes array was empty
  if (classes.length === 0) {
    if (cleanTurma && areTurmasMatching(rawTarget, cleanTurma)) return true;
    if (virtualClassIdsOrNames.some(v => areTurmasMatching(rawTarget, v))) return true;
  }

  return false;
}

export function matchesStudentExam(
  ex: any,
  studentEmail: string,
  studentCohort?: string,
  virtualClassIdsOrNames: string[] = []
): boolean {
  if (!ex) return false;
  const cleanEmail = (studentEmail || '').toLowerCase().trim();
  const cleanTurma = (studentCohort || '').trim();

  let allRawTargets: string[] = [];
  if (Array.isArray(ex.classes)) {
    allRawTargets.push(...ex.classes.map((c: any) => String(c).trim()).filter(Boolean));
  } else if (typeof ex.classes === 'string') {
    try {
      const parsed = JSON.parse(ex.classes);
      if (Array.isArray(parsed)) allRawTargets.push(...parsed.map(c => String(c).trim()).filter(Boolean));
      else allRawTargets.push(ex.classes.trim());
    } catch {
      allRawTargets.push(...ex.classes.split(',').map(s => s.trim()).filter(Boolean));
    }
  }

  if (ex.class_name) allRawTargets.push(String(ex.class_name).trim());
  if (ex.turma) allRawTargets.push(String(ex.turma).trim());
  if (ex.target) allRawTargets.push(String(ex.target).trim());

  if (allRawTargets.length === 0) {
    return false;
  }

  // Separate email targets vs class targets
  const classes: string[] = [];
  const students: string[] = [];

  allRawTargets.forEach(t => {
    const { classes: parsedC, students: parsedS } = parseExamTargets(t);
    classes.push(...parsedC);
    students.push(...parsedS);
  });

  const uniqueClasses = Array.from(new Set(classes.map(c => c.trim()).filter(Boolean)));
  const uniqueStudents = Array.from(new Set(students.map(s => s.toLowerCase().trim()).filter(Boolean)));

  // 1. If SPECIFIC STUDENTS are designated:
  // MUST ONLY show to those specific students. Other students MUST NOT see it!
  if (uniqueStudents.length > 0) {
    return uniqueStudents.includes(cleanEmail);
  }

  // 2. Official student turma match
  if (cleanTurma && uniqueClasses.some(c => areTurmasMatching(c, cleanTurma) || c.toLowerCase() === cleanTurma.toLowerCase())) {
    return true;
  }

  // 3. Virtual class match
  if (virtualClassIdsOrNames.length > 0) {
    const matchesVC = virtualClassIdsOrNames.some(vcId => {
      if (!vcId) return false;
      const vcLower = vcId.toLowerCase().trim();
      return uniqueClasses.some(c => areTurmasMatching(c, vcId) || c.toLowerCase() === vcLower);
    });
    if (matchesVC) return true;
  }

  // 4. General / school-wide match ONLY if student belongs to at least one class/room
  const hasAnyRoomOrCohort = Boolean(cleanTurma) || virtualClassIdsOrNames.length > 0;
  const isExplicitGeneral = uniqueClasses.some(c => ['geral', 'todas', 'toda a escola', 'todos'].includes(c.toLowerCase()));
  if (isExplicitGeneral && hasAnyRoomOrCohort) {
    return true;
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
  const emailLower = studentEmail.toLowerCase().trim();
  const ids: string[] = [];
  virtualClasses.forEach(vc => {
    if (!vc) return;
    let emails: string[] = [];
    if (Array.isArray(vc.student_emails)) {
      emails = vc.student_emails.map((e: string) => String(e).toLowerCase().trim());
    } else if (typeof vc.student_emails === 'string') {
      try {
        const parsed = JSON.parse(vc.student_emails);
        if (Array.isArray(parsed)) emails = parsed.map((e: string) => String(e).toLowerCase().trim());
      } catch {
        emails = vc.student_emails.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
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
