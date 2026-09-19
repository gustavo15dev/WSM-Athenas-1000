export type ExamMode = 'normal' | 'controlled';

export interface MockExamSettings {
  mode?: ExamMode; // Explicit enum: 'normal' (Ritmo Livre) | 'controlled' (Anticola)
  duration_minutes?: number;
  student_extra_time?: Record<string, number>; // student_email -> extra minutes
  is_controlled?: boolean; // Maintained for backwards compatibility
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  is_draft?: boolean;
}

export function parseExamSettings(description: string): { cleanDescription: string; settings: MockExamSettings } {
  if (!description) {
    return { cleanDescription: '', settings: { mode: 'normal', is_controlled: false } };
  }
  const marker = "---ATHENAS_SETTINGS---";
  const idx = description.indexOf(marker);
  let cleanDescription = '';
  let settings: MockExamSettings = {};

  if (idx !== -1) {
    cleanDescription = description.substring(0, idx).trim();
    const settingsStr = description.substring(idx + marker.length).trim();
    try {
      settings = JSON.parse(settingsStr);
    } catch (e) {
      console.error("Error parsing exam settings metadata", e);
    }
  } else {
    cleanDescription = description.trim();
  }

  // Explicit normalization of mode enum:
  // If mode is explicitly provided, use it. If only is_controlled is provided, map true -> 'controlled', false/undefined -> 'normal'.
  // Default to 'normal' (Ritmo Livre) so that unconfigured or normal exams NEVER behave as controlled.
  const resolvedMode: ExamMode = settings.mode 
    ? settings.mode 
    : (settings.is_controlled === true ? 'controlled' : 'normal');

  settings.mode = resolvedMode;
  settings.is_controlled = resolvedMode === 'controlled';

  // Handle case where duration number got glued to the end of cleanDescription (e.g. "Não saia da tela.5")
  if (settings.duration_minutes && cleanDescription) {
    const durStr = String(settings.duration_minutes);
    if (cleanDescription.endsWith(durStr)) {
      const regex = new RegExp(`\\.?${durStr}$`);
      cleanDescription = cleanDescription.replace(regex, '').trim();
      if (!cleanDescription.endsWith('.')) {
        cleanDescription += '.';
      }
      cleanDescription += ` Tempo limite: ${settings.duration_minutes} minutos.`;
    }
  }

  return { cleanDescription, settings };
}

export function serializeExamDescription(cleanDescription: string, settings: MockExamSettings): string {
  // Ensure both mode and is_controlled are synchronized before persisting
  const resolvedMode: ExamMode = settings.mode || (settings.is_controlled ? 'controlled' : 'normal');
  const payload: MockExamSettings = {
    ...settings,
    mode: resolvedMode,
    is_controlled: resolvedMode === 'controlled'
  };
  return `${cleanDescription}\n\n---ATHENAS_SETTINGS---\n${JSON.stringify(payload)}`;
}

/**
 * Strips redundant prefixes like "Conteúdo:", "Conteúdo cobrado:", "Conteudo: " from exam content strings.
 */
export function cleanExamContent(raw: string | undefined | null): string {
  if (!raw) return '';
  const text = String(raw).trim();
  return text.replace(/^(\s*conte[úu]do(\s+cobrado)?\s*:\s*)+/i, '').trim();
}

/**
 * Normalizes notification text, eliminating duplicate "Conteúdo: Conteúdo:" sequences.
 */
export function cleanNotificationMessage(msg: string | undefined | null): string {
  if (!msg) return '';
  return msg
    .replace(/(conte[úu]do\s*:\s*[\r\n]*\s*)+conte[úu]do\s*:\s*/gi, 'Conteúdo:\n')
    .replace(/(conte[úu]do\s*:\s*)+conte[úu]do\s*:\s*/gi, 'Conteúdo: ');
}

/**
 * Strips hidden metadata tags like [HORÁRIO: 14:30] from observations for clean UI presentation.
 */
export function cleanExamObservations(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\[\s*HOR[ÁA]RIO\s*:\s*[^\]]+\]/gi, '')
    .replace(/\[\s*HORA\s*:\s*[^\]]+\]/gi, '')
    .replace(/\[\s*TIME\s*:\s*[^\]]+\]/gi, '')
    .trim();
}

/**
 * Serializes exam observations with an embedded [HORÁRIO: HH:mm] tag for persistence
 * even when the database column type is pure DATE.
 */
export function serializeExamObservations(rawObservations: string | undefined | null, examTime?: string): string {
  const clean = cleanExamObservations(rawObservations);
  if (!examTime || !examTime.trim()) return clean;
  const timeFormatted = examTime.trim().substring(0, 5);
  return clean ? `${clean}\n\n[HORÁRIO: ${timeFormatted}]` : `[HORÁRIO: ${timeFormatted}]`;
}

/**
 * Extract time string (HH:mm) from any exam structure, observations, content, or matched notification.
 */
export function extractExamTime(examOrDate: any, notifications?: any[]): string | null {
  if (!examOrDate) return null;

  // 1. Direct object properties
  if (typeof examOrDate === 'object') {
    const directTime = examOrDate.time || examOrDate.exam_time || examOrDate.horario || examOrDate.hora || examOrDate.examTime;
    if (directTime && typeof directTime === 'string') {
      const clean = directTime.trim().substring(0, 5);
      if (/^\d{1,2}:\d{2}$/.test(clean)) {
        const [h, m] = clean.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
    }
  }

  // 2. ISO/datetime string with time part
  let rawDateStr = '';
  if (typeof examOrDate === 'string') {
    rawDateStr = examOrDate;
  } else if (typeof examOrDate === 'object') {
    rawDateStr = String(examOrDate.exam_date || examOrDate.date || examOrDate.data_prova || examOrDate.deadline || examOrDate.due_date || '');
  }

  if (rawDateStr) {
    if (rawDateStr.includes('T')) {
      const timePart = rawDateStr.split('T')[1]?.substring(0, 5);
      if (timePart && /^\d{1,2}:\d{2}$/.test(timePart) && timePart !== '00:00') {
        const [h, m] = timePart.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
    } else if (rawDateStr.includes(' ')) {
      const timePart = rawDateStr.split(' ')[1]?.substring(0, 5);
      if (timePart && /^\d{1,2}:\d{2}$/.test(timePart) && timePart !== '00:00') {
        const [h, m] = timePart.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
    }
  }

  // 3. Observations embedded tag or mention (e.g. "[HORÁRIO: 14:30]" or "às 14:30")
  if (typeof examOrDate === 'object' && examOrDate.observations) {
    const obs = String(examOrDate.observations);
    const tagMatch = obs.match(/\[\s*(?:HOR[ÁA]RIO|HORA|TIME)\s*:\s*(\d{1,2}[:h]\d{2})\s*\]/i);
    if (tagMatch && tagMatch[1]) {
      const clean = tagMatch[1].replace('h', ':').trim();
      const [h, m] = clean.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    const asMatch = obs.match(/(?:às|as|hor[áa]rio:?|hora:?)\s*(\d{1,2}[:h]\d{2})/i);
    if (asMatch && asMatch[1]) {
      const clean = asMatch[1].replace('h', ':').trim();
      const [h, m] = clean.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
  }

  // 4. Content tag or mention
  if (typeof examOrDate === 'object' && examOrDate.content) {
    const cont = String(examOrDate.content);
    const tagMatch = cont.match(/\[\s*(?:HOR[ÁA]RIO|HORA|TIME)\s*:\s*(\d{1,2}[:h]\d{2})\s*\]/i);
    if (tagMatch && tagMatch[1]) {
      const clean = tagMatch[1].replace('h', ':').trim();
      const [h, m] = clean.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    const asMatch = cont.match(/(?:às|as|hor[áa]rio:?|hora:?)\s*(\d{1,2}[:h]\d{2})/i);
    if (asMatch && asMatch[1]) {
      const clean = asMatch[1].replace('h', ':').trim();
      const [h, m] = clean.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
  }

  // 5. Title mention
  if (typeof examOrDate === 'object' && examOrDate.title) {
    const titleStr = String(examOrDate.title);
    const asMatch = titleStr.match(/(?:às|as)\s*(\d{1,2}[:h]\d{2})/i);
    if (asMatch && asMatch[1]) {
      const clean = asMatch[1].replace('h', ':').trim();
      const [h, m] = clean.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
  }

  // 6. Cross-reference with notifications
  if (notifications && Array.isArray(notifications) && typeof examOrDate === 'object') {
    const examTitle = String(examOrDate.title || '').toLowerCase().trim();
    const examMateria = String(examOrDate.materia || '').toLowerCase().trim();
    const examDateVal = String(examOrDate.exam_date || examOrDate.date || '');

    // Format date in DD/MM/YYYY for matching
    let brDateStr = '';
    if (examDateVal.includes('-')) {
      const [y, m, d] = examDateVal.split('T')[0].split('-').map(s => s.trim());
      if (y && m && d) brDateStr = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    for (const notif of notifications) {
      if (!notif || !notif.message) continue;
      const msg = String(notif.message);
      const msgLower = msg.toLowerCase();
      const notifTitleLower = String(notif.title || '').toLowerCase();

      // Check if notification matches this exam
      const matchesTitle = examTitle && (msgLower.includes(examTitle) || notifTitleLower.includes(examTitle));
      const matchesDate = brDateStr && msgLower.includes(brDateStr);
      const matchesMateria = examMateria && notifTitleLower.includes(examMateria);

      if (matchesTitle || (matchesDate && (matchesMateria || notifTitleLower.includes('prova')))) {
        // Extract time from notification e.g. "para o dia 20/09/2026 às 14:30" or "às 14:30"
        const timeMatch = msg.match(/(?:às|as)\s*(\d{1,2}[:h]\d{2})/i) || msg.match(/(?:hor[áa]rio:?|hora:?)\s*(\d{1,2}[:h]\d{2})/i);
        if (timeMatch && timeMatch[1]) {
          const clean = timeMatch[1].replace('h', ':').trim();
          const [h, m] = clean.split(':');
          return `${h.padStart(2, '0')}:${m}`;
        }
      }
    }
  }

  return null;
}

/**
 * Formats exam date and time into standardized Brazilian format.
 * Returns:
 * - dateFormatted: '20/09/2026'
 * - timeFormatted: '14:30' (or null if no time specified)
 * - fullFormatted: '20/09/2026 às 14:30' (or '20/09/2026')
 */
export function formatExamDateDisplay(
  examOrDate: any,
  fallbackTime?: string,
  notifications?: any[]
): {
  dateFormatted: string;
  timeFormatted: string | null;
  fullFormatted: string;
} {
  if (!examOrDate) {
    return { dateFormatted: '', timeFormatted: null, fullFormatted: '' };
  }

  let rawDate = '';
  let rawTime = fallbackTime || extractExamTime(examOrDate, notifications) || '';

  if (typeof examOrDate === 'string') {
    rawDate = examOrDate.trim();
  } else if (examOrDate instanceof Date) {
    if (isNaN(examOrDate.getTime())) {
      return { dateFormatted: '', timeFormatted: null, fullFormatted: '' };
    }
    const y = examOrDate.getFullYear();
    const m = String(examOrDate.getMonth() + 1).padStart(2, '0');
    const d = String(examOrDate.getDate()).padStart(2, '0');
    const hh = String(examOrDate.getHours()).padStart(2, '0');
    const mm = String(examOrDate.getMinutes()).padStart(2, '0');
    const dateFormatted = `${d}/${m}/${y}`;
    const timeFormatted = rawTime || ((hh === '00' && mm === '00' && !fallbackTime) ? null : `${hh}:${mm}`);
    return {
      dateFormatted,
      timeFormatted,
      fullFormatted: timeFormatted ? `${dateFormatted} às ${timeFormatted}` : dateFormatted,
    };
  } else if (typeof examOrDate === 'object') {
    rawDate = String(
      examOrDate.exam_date ||
      examOrDate.date ||
      examOrDate.data_prova ||
      examOrDate.data ||
      examOrDate.deadline ||
      examOrDate.due_date ||
      ''
    ).trim();
  }

  if (!rawDate) {
    return { dateFormatted: '', timeFormatted: null, fullFormatted: '' };
  }

  let datePart = '';
  let timePart = rawTime;

  if (rawDate.includes('T')) {
    const parts = rawDate.split('T');
    datePart = parts[0];
    if (!timePart && parts[1]) {
      const extracted = parts[1].substring(0, 5);
      if (extracted !== '00:00') {
        timePart = extracted;
      }
    }
  } else if (rawDate.includes(' ')) {
    const parts = rawDate.split(' ');
    datePart = parts[0];
    if (!timePart && parts[1]) {
      const extracted = parts[1].substring(0, 5);
      if (extracted !== '00:00') {
        timePart = extracted;
      }
    }
  } else {
    datePart = rawDate;
  }

  // Format datePart (expected format: YYYY-MM-DD or DD/MM/YYYY)
  let dateFormatted = '';
  if (datePart.includes('-')) {
    const [y, m, d] = datePart.split('-').map(s => s.trim());
    if (y && m && d) {
      if (y.length === 4) {
        dateFormatted = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      } else {
        dateFormatted = `${y.padStart(2, '0')}/${m.padStart(2, '0')}/${d}`;
      }
    }
  } else if (datePart.includes('/')) {
    dateFormatted = datePart;
  }

  if (!dateFormatted) {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      dateFormatted = parsed.toLocaleDateString('pt-BR');
      if (!timePart && rawDate.includes(':')) {
        const hh = String(parsed.getHours()).padStart(2, '0');
        const mm = String(parsed.getMinutes()).padStart(2, '0');
        if (hh !== '00' || mm !== '00') {
          timePart = `${hh}:${mm}`;
        }
      }
    } else {
      dateFormatted = datePart;
    }
  }

  let timeFormatted: string | null = null;
  if (timePart) {
    const cleanTime = timePart.trim().substring(0, 5).replace('h', ':');
    if (/^\d{1,2}:\d{2}$/.test(cleanTime)) {
      const [h, min] = cleanTime.split(':');
      timeFormatted = `${h.padStart(2, '0')}:${min}`;
    }
  }

  const fullFormatted = timeFormatted
    ? `${dateFormatted} às ${timeFormatted}`
    : dateFormatted;

  return {
    dateFormatted,
    timeFormatted,
    fullFormatted,
  };
}

