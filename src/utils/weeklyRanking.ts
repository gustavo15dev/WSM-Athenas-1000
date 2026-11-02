/**
 * Weekly Ranking & Sunday 18:00 BRT Cycle Manager
 * WSM Athenas Educational Platform
 */

import { supabase } from '../supabase';

export interface WeeklyCycleInfo {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  startDateISO: string;
  endDateISO: string;
  formattedRange: string;
  secondsUntilReset: number;
  formattedCountdown: string;
  isClosed: boolean;
}

export interface WeeklyWinnerRecord {
  cycleId: string;
  cycleStartISO: string;
  cycleEndISO: string;
  formattedRange: string;
  rank1: { email: string; name: string; turma: string; cidade: string; xp: number } | null;
  rank2: { email: string; name: string; turma: string; cidade: string; xp: number } | null;
  rank3: { email: string; name: string; turma: string; cidade: string; xp: number } | null;
  closedAtISO: string;
}

export interface StudentCertificateItem {
  id: string;
  cycleId: string;
  place: 'gold' | 'silver' | 'bronze';
  rankNumber: 1 | 2 | 3;
  studentName: string;
  studentEmail: string;
  turma: string;
  cidade: string;
  weeklyXp: number;
  cycleRangeText: string;
  issueDateFormatted: string;
  authCode: string;
}

/**
 * Get current time converted to Brasilia Time (BRT / UTC-3)
 */
export function getBrasiliaNow(): Date {
  const now = new Date();
  // Convert to UTC time ms, then subtract 3 hours for BRT (UTC-3)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs - 3 * 3600000);
}

/**
 * Calculate the Sunday 18:00 BRT cycle for any given date in BRT
 */
export function getWeeklyCycleInfo(referenceDate?: Date): WeeklyCycleInfo {
  const brtNow = referenceDate || getBrasiliaNow();

  // Find the current or most recent Sunday 18:00 BRT
  const dayOfWeek = brtNow.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = brtNow.getHours();

  let cycleStart = new Date(brtNow);
  cycleStart.setHours(18, 0, 0, 0);

  if (dayOfWeek === 0) {
    // It's Sunday
    if (hours < 18) {
      // Before 18:00 Sunday -> Cycle started previous Sunday 18:00
      cycleStart.setDate(cycleStart.getDate() - 7);
    }
  } else {
    // Monday to Saturday -> Cycle started last Sunday 18:00
    cycleStart.setDate(cycleStart.getDate() - dayOfWeek);
  }

  // Cycle ends next Sunday 18:00 BRT
  let cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 7);

  const secondsUntilReset = Math.max(0, Math.floor((cycleEnd.getTime() - brtNow.getTime()) / 1000));

  // Format countdown string
  const days = Math.floor(secondsUntilReset / 86400);
  const hoursRem = Math.floor((secondsUntilReset % 86400) / 3600);
  const minsRem = Math.floor((secondsUntilReset % 3600) / 60);

  let countdownStr = '';
  if (days > 0) countdownStr += `${days}d `;
  countdownStr += `${hoursRem}h ${minsRem}min`;

  // Cycle ID format: YYYY-MM-DD
  const yyyy = cycleStart.getFullYear();
  const mm = String(cycleStart.getMonth() + 1).padStart(2, '0');
  const dd = String(cycleStart.getDate()).padStart(2, '0');
  const cycleId = `${yyyy}-${mm}-${dd}`;

  // Formatted date range text
  const startFmt = cycleStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const endFmt = cycleEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedRange = `Semana de ${startFmt} a ${endFmt}`;

  return {
    cycleId,
    startDate: cycleStart,
    endDate: cycleEnd,
    startDateISO: cycleStart.toISOString(),
    endDateISO: cycleEnd.toISOString(),
    formattedRange,
    secondsUntilReset,
    formattedCountdown: countdownStr,
    isClosed: secondsUntilReset <= 0
  };
}

/**
 * Calculate weekly XP earned strictly between cycleStart and cycleEnd
 */
export function calculateStudentWeeklyXP(
  studentEmail: string,
  submissions: any[] = [],
  activeSeconds: number = 0,
  chatQueriesCount: number = 0,
  notebookStats: { count: number; pagesCount: number; stampedCount: number } = { count: 0, pagesCount: 0, stampedCount: 0 },
  cycleStartISO: string,
  cycleEndISO: string
): number {
  if (!studentEmail) return 0;

  const cStart = new Date(cycleStartISO).getTime();
  const cEnd = new Date(cycleEndISO).getTime();

  let weeklyXp = 0;

  // Filter submissions submitted within the weekly cycle
  submissions.forEach((s: any) => {
    if (s.submitted_at) {
      const subTime = new Date(s.submitted_at).getTime();
      if (subTime >= cStart && subTime <= cEnd) {
        weeklyXp += 100; // Base completion
        weeklyXp += (Number(s.correct_count) || 0) * 20; // 20 XP per correct question
        if (Number(s.score) >= 10) weeklyXp += 150; // Perfect score bonus
        const sw = Number(s.telemetry?.tabSwitches) || Number(s.telemetry?.tab_switch_count) || 0;
        if (sw === 0) weeklyXp += 50; // Integrity bonus
      }
    }
  });

  // Calculate proportional active study time XP for this weekly cycle
  const weeklyActiveSeconds = Math.min(activeSeconds, 36000); // capped for week
  weeklyXp += Math.floor(weeklyActiveSeconds / 900) * 10;

  // Notebooks and chat queries
  weeklyXp += Math.min(notebookStats.pagesCount, 20) * 25;
  weeklyXp += Math.min(chatQueriesCount, 30) * 15;

  return Math.max(120, weeklyXp); // Default minimum base participation for active accounts
}

/**
 * Get or Save Weekly Ranking History Winners
 */
export async function getWeeklyRankingHistory(): Promise<WeeklyWinnerRecord[]> {
  try {
    const { data } = await supabase
      .from('wsm_weekly_ranking_history')
      .select('*')
      .order('cycle_start', { ascending: false });

    if (data && data.length > 0) {
      return data.map((d: any) => ({
        cycleId: d.cycle_id,
        cycleStartISO: d.cycle_start,
        cycleEndISO: d.cycle_end,
        formattedRange: d.formatted_range || `Semana de ${new Date(d.cycle_start).toLocaleDateString('pt-BR')}`,
        rank1: d.rank_1,
        rank2: d.rank_2,
        rank3: d.rank_3,
        closedAtISO: d.closed_at
      }));
    }
  } catch {}

  // Fallback to LocalStorage
  try {
    const raw = localStorage.getItem('wsm_weekly_ranking_winners_history');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  return [];
}

/**
 * Save closed weekly cycle winners
 */
export async function saveWeeklyCycleWinners(record: WeeklyWinnerRecord): Promise<void> {
  // Save to LocalStorage
  try {
    const history = await getWeeklyRankingHistory();
    const filtered = history.filter((h) => h.cycleId !== record.cycleId);
    const updated = [record, ...filtered];
    localStorage.setItem('wsm_weekly_ranking_winners_history', JSON.stringify(updated));
  } catch {}

  // Save to Supabase
  try {
    await supabase.from('wsm_weekly_ranking_history').upsert({
      cycle_id: record.cycleId,
      cycle_start: record.cycleStartISO,
      cycle_end: record.cycleEndISO,
      formatted_range: record.formattedRange,
      rank_1: record.rank1,
      rank_2: record.rank2,
      rank_3: record.rank3,
      closed_at: record.closedAtISO || new Date().toISOString()
    }, { onConflict: 'cycle_id' });
  } catch (err) {
    console.warn('Could not save weekly cycle winners to Supabase:', err);
  }
}

/**
 * Check if a student is a winner (1st, 2nd, 3rd place) in any closed weekly cycle
 */
export async function getStudentCertificates(studentEmail: string): Promise<StudentCertificateItem[]> {
  if (!studentEmail) return [];

  const cleanEmail = studentEmail.toLowerCase().trim();
  const history = await getWeeklyRankingHistory();
  const certs: StudentCertificateItem[] = [];

  history.forEach((h) => {
    let place: 'gold' | 'silver' | 'bronze' | null = null;
    let rankNumber: 1 | 2 | 3 = 1;
    let winnerData: any = null;

    if (h.rank1 && h.rank1.email.toLowerCase().trim() === cleanEmail) {
      place = 'gold';
      rankNumber = 1;
      winnerData = h.rank1;
    } else if (h.rank2 && h.rank2.email.toLowerCase().trim() === cleanEmail) {
      place = 'silver';
      rankNumber = 2;
      winnerData = h.rank2;
    } else if (h.rank3 && h.rank3.email.toLowerCase().trim() === cleanEmail) {
      place = 'bronze';
      rankNumber = 3;
      winnerData = h.rank3;
    }

    if (place && winnerData) {
      const authHex = Math.abs(cleanEmail.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + h.cycleId.length * 99).toString(16).toUpperCase();
      certs.push({
        id: `cert_${h.cycleId}_${cleanEmail}`,
        cycleId: h.cycleId,
        place,
        rankNumber,
        studentName: winnerData.name || cleanEmail.split('@')[0],
        studentEmail: cleanEmail,
        turma: winnerData.turma || '8º Ano',
        cidade: winnerData.cidade || 'São Paulo - SP',
        weeklyXp: winnerData.xp || 0,
        cycleRangeText: h.formattedRange || `Semana de ${h.cycleId}`,
        issueDateFormatted: new Date(h.closedAtISO || h.cycleEndISO).toLocaleDateString('pt-BR'),
        authCode: `ATH-${h.cycleId}-${authHex}`
      });
    }
  });

  return certs;
}

