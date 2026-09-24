/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  Calendar, 
  BookOpen, 
  Bell, 
  CheckCircle, 
  Circle, 
  Sparkles, 
  TrendingUp, 
  LogOut, 
  Send,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Mail,
  Home,
  Bot,
  ClipboardList,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Settings,
  Eye,
  EyeOff,
  Clock,
  Activity,
  BrainCircuit,
  BarChart3,
  Trash2,
  Edit3,
  MessageSquare,
  Info,
  Moon,
  Sun,
  X,
  Headphones
} from 'lucide-react';
import { matchesStudentTarget, formatTargetDisplayName } from '../utils/targetMatcher';
import { parseExamSettings, cleanExamContent, cleanNotificationMessage, formatExamDateDisplay, cleanExamObservations, extractExamTime } from '../utils/examSettings';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts';
import { SubjectGrade, UpcomingClass, Announcement, Task, getUniqueRA } from '../types';
import WsmChat from './WsmChat';
import ClassChat from './ClassChat';
import StudentSimulados from './StudentSimulados';
import StudentVirtualClasses from './StudentVirtualClasses';
import StudentCalendar from './StudentCalendar';
import AcademicCalendar from './AcademicCalendar';
import StudentAnnouncements from './StudentAnnouncements';
import TabLoadingSkeleton from './TabLoadingSkeleton';
import BrowserNotificationPrompt from './BrowserNotificationPrompt';
import VirtualNotebook from './VirtualNotebook';
import { startRealtimeNotificationListener } from '../utils/browserNotifications';
import { supabase } from '../supabase';
import { safeUpsertUserProfile, areTurmasMatching } from '../utils/profileDb';

interface StudentDashboardProps {
  email: string;
  onLogout: () => void;
  grades: SubjectGrade[];
  announcements: Announcement[];
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
}

export default function StudentDashboard({ 
  email, 
  onLogout, 
  grades, 
  announcements, 
  tasks, 
  onToggleTask 
}: StudentDashboardProps) {
  
  const [activeTab, setActiveTab] = useState<'inicio' | 'mural' | 'calendario' | 'conversas' | 'caderno' | 'wsm_athenas' | 'simulados' | 'desempenho'>('inicio');
  const [isExamActive, setIsExamActive] = useState(false);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [hasUnsavedNotebook, setHasUnsavedNotebook] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTargetTab, setPendingTargetTab] = useState<'inicio' | 'mural' | 'calendario' | 'conversas' | 'caderno' | 'wsm_athenas' | 'simulados' | 'desempenho' | null>(null);

  // Explicit active class context for multi-room students
  const [activeTurma, setActiveTurma] = useState<string>(() => {
    return localStorage.getItem(`wsm_active_student_class_${email.toLowerCase().trim()}`) || '';
  });
  const [activeChamada, setActiveChamada] = useState<number | null>(null);

  const handleTabClick = (tab: typeof activeTab) => {
    if (isExamActive) {
      alert("⚠️ PROVA EM ANDAMENTO!\n\nVocê está realizando um simulado. Para navegar pelo site, você deve primeiro concluir e enviar a sua prova utilizando o botão 'Finalizar e Entregar Prova'.");
      return;
    }
    if (activeTab === 'caderno' && tab !== 'caderno' && hasUnsavedNotebook) {
      setPendingTargetTab(tab);
      setShowUnsavedModal(true);
      return;
    }
    if (tab !== activeTab) {
      setIsTabTransitioning(true);
      setActiveTab(tab);
      setTimeout(() => {
        setIsTabTransitioning(false);
      }, 300);
    }
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [studyExamTheme, setStudyExamTheme] = useState<string | undefined>(undefined);
  const [studyExamContent, setStudyExamContent] = useState<string | undefined>(undefined);

  const handleSelectActiveTurma = (newTurma: string) => {
    if (!newTurma) return;
    setActiveTurma(newTurma);
    localStorage.setItem(`wsm_active_student_class_${email.toLowerCase().trim()}`, newTurma);
  };

  // Settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [setMail, setSetMail] = useState(email);
  const [setName, setSetName] = useState('');
  const [setEscola, setSetEscola] = useState('');
  const [setChamada, setSetChamada] = useState(1);
  const [setPassword, setSetPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [themePreference, setThemePreference] = useState<'escuro' | 'claro'>('escuro');
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Gmail Notification states
  const [notificationGmailInput, setNotificationGmailInput] = useState('');
  const [savingGmail, setSavingGmail] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isEditingGmail, setIsEditingGmail] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'notifications'>('profile');
  const [isGmailCardDismissed, setIsGmailCardDismissed] = useState(() => {
    try {
      const clean = (email || '').toLowerCase().trim();
      return (
        (clean && localStorage.getItem(`wsm_dismissed_gmail_card_${clean}`) === 'true') ||
        localStorage.getItem('wsm_dismissed_gmail_card') === 'true'
      );
    } catch {
      return false;
    }
  });

  const handleDismissGmailCard = () => {
    setIsGmailCardDismissed(true);
    try {
      const clean = (email || '').toLowerCase().trim();
      if (clean) {
        localStorage.setItem(`wsm_dismissed_gmail_card_${clean}`, 'true');
      }
      localStorage.setItem('wsm_dismissed_gmail_card', 'true');
    } catch (e) {
      console.error('Failed to save Gmail notification card dismissal:', e);
    }
  };

  // Student analytics states
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsChartTab, setAnalyticsChartTab] = useState<'mensal' | 'semanal' | 'diario' | 'horarios'>('mensal');

  // Direct messages unread count for students
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  useEffect(() => {
    if (!email) return;
    const fetchUnreadChat = async () => {
      try {
        const { data } = await supabase
          .from('direct_messages')
          .select('id')
          .ilike('receiver_email', email.toLowerCase().trim())
          .eq('is_read', false);
        setUnreadChatCount(data?.length || 0);
      } catch {
        // ignore
      }
    };
    fetchUnreadChat();
    const interval = setInterval(fetchUnreadChat, 4000);

    const handleRead = () => {
      fetchUnreadChat();
    };
    window.addEventListener('wsm_direct_messages_read', handleRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener('wsm_direct_messages_read', handleRead);
    };
  }, [email]);

  const calculateStudentStats = (
    submissions: any[],
    sessions: any[],
    userMessages: any[],
    dbAnalytics: any,
    liveOpenTime?: number,
    liveActiveTime?: number,
    allMockExams?: any[]
  ) => {
    const openTimeSec = Math.max(liveOpenTime || 0, dbAnalytics?.hourly_distribution?.tempo_plataforma_aberta_s || 0);
    const activeTimeSec = Math.max(liveActiveTime || 0, dbAnalytics?.hourly_distribution?.tempo_ativo_mexendo_s || 0);

    const hasActivity = userMessages.length > 0 || submissions.length > 0 || openTimeSec > 0;

    const formatTrackingTime = (seconds: number) => {
      if (seconds <= 0) return "0 min";
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hrs > 0) {
        return `${hrs}h ${mins}min`;
      }
      if (mins > 0) {
        return `${mins}min ${secs}s`;
      }
      return `${secs}s`;
    };

    if (!hasActivity) {
      return {
        hasActivity: false,
        totalTimeText: "0 min",
        meses: [],
        semanas: [],
        dias: [],
        horarios: [],
        mostActiveDay: "Sem atividades registradas",
        preferredTimeOfDay: "Sem dados",
        avgSessionDuration: "0 min",
        weeklyFrequency: 0,
        consistency: "Instável",
        chatGeneralVsExam: "Sem registros",
        studyType: "Sem estudos",
        progressWeekToWeek: [
          { name: "Semana -3", tempo: 0 },
          { name: "Semana -2", tempo: 0 },
          { name: "S. Passada", tempo: 0 },
          { name: "S. Atual", tempo: 0 },
        ],
        openTimeSec: 0,
        activeTimeSec: 0,
        openTimeText: "0 min",
        activeTimeText: "0 min",
        simuladosCount: 0,
        avgScore: "0.0",
        examHistory: [],
      };
    }

    const activityDates = [
      ...userMessages.map((m) => new Date(m.created_at)),
      ...submissions.map((s) => new Date(s.submitted_at || s.created_at)),
    ].filter((d) => !isNaN(d.getTime()));

    // Calculate accurate assessment and active content time
    const getSubmissionMinutes = (s: any): number => {
      if (s.telemetry?.totalTimeSeconds && s.telemetry.totalTimeSeconds > 0) {
        return Math.max(1, Math.min(Math.round(s.telemetry.totalTimeSeconds / 60), 120));
      }
      if (s.submitted_at && s.created_at) {
        const diffMs = new Date(s.submitted_at).getTime() - new Date(s.created_at).getTime();
        if (diffMs > 0) {
          return Math.max(1, Math.min(Math.round(diffMs / 60000), 120));
        }
      }
      const qCount = s.total_questions || 5;
      return Math.max(1, Math.min(qCount * 1.5, 30));
    };

    // Realistic active message time (1.0 min per interaction burst)
    const getMessageMinutes = (): number => {
      return 1;
    };

    let totalAssessmentMinutes = 0;
    submissions.forEach(s => {
      totalAssessmentMinutes += getSubmissionMinutes(s);
    });

    let totalContentMinutes = 0;
    userMessages.forEach(() => {
      totalContentMinutes += getMessageMinutes();
    });

    const calculatedMinutes = Math.round(totalAssessmentMinutes + totalContentMinutes);
    const hrs = Math.floor(calculatedMinutes / 60);
    const mins = calculatedMinutes % 60;
    const totalTimeText = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;

    // Build real months grouping
    const monthsNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const monthlyMinutesMap: { [key: string]: number } = {};
    userMessages.forEach((m) => {
      const mName = monthsNames[new Date(m.created_at).getMonth()];
      monthlyMinutesMap[mName] = (monthlyMinutesMap[mName] || 0) + getMessageMinutes();
    });
    submissions.forEach((s) => {
      const mName =
        monthsNames[new Date(s.submitted_at || s.created_at).getMonth()];
      monthlyMinutesMap[mName] = (monthlyMinutesMap[mName] || 0) + getSubmissionMinutes(s);
    });
    const meses = Object.entries(monthlyMinutesMap).map(([name, tempo]) => ({
      name,
      tempo: Math.round(tempo),
    }));

    // Build real weeks grouping relative to current date
    const weeklyMinutesMap: { [key: string]: number } = {
      "Esta Semana": 0,
      "Semana Passada": 0,
      "Semana Retrasada": 0,
    };
    const getWeekCategory = (dateObj: Date) => {
      const today = new Date();
      const diffTime = today.getTime() - dateObj.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) return "Esta Semana";
      if (diffDays <= 14) return "Semana Passada";
      if (diffDays <= 21) return "Semana Retrasada";
      return null;
    };
    userMessages.forEach((m) => {
      const cat = getWeekCategory(new Date(m.created_at));
      if (cat) weeklyMinutesMap[cat] += getMessageMinutes();
    });
    submissions.forEach((s) => {
      const cat = getWeekCategory(new Date(s.submitted_at || s.created_at));
      if (cat) weeklyMinutesMap[cat] += getSubmissionMinutes(s);
    });
    const semanas = Object.entries(weeklyMinutesMap).map(([name, tempo]) => ({
      name,
      tempo: Math.round(tempo),
    }));

    // Build real days grouping
    const weekdayNames = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];
    const dailyMinutesMap: { [key: string]: number } = {
      Segunda: 0,
      Terça: 0,
      Quarta: 0,
      Quinta: 0,
      Sexta: 0,
      Sábado: 0,
      Domingo: 0,
    };
    userMessages.forEach((m) => {
      const dayName = weekdayNames[new Date(m.created_at).getDay()];
      dailyMinutesMap[dayName] = (dailyMinutesMap[dayName] || 0) + getMessageMinutes();
    });
    submissions.forEach((s) => {
      const dayName =
        weekdayNames[new Date(s.submitted_at || s.created_at).getDay()];
      dailyMinutesMap[dayName] = (dailyMinutesMap[dayName] || 0) + getSubmissionMinutes(s);
    });
    const dias = weekdayNames.map((name) => ({
      name,
      tempo: Math.round(dailyMinutesMap[name] || 0),
    }));

    // Build real hours range grouping
    const hourRanges = [
      { label: "08h - 10h", start: 8, end: 10, tempo: 0 },
      { label: "10h - 12h", start: 10, end: 12, tempo: 0 },
      { label: "12h - 14h", start: 12, end: 14, tempo: 0 },
      { label: "14h - 16h", start: 14, end: 16, tempo: 0 },
      { label: "16h - 18h", start: 16, end: 18, tempo: 0 },
      { label: "18h - 20h", start: 18, end: 20, tempo: 0 },
      { label: "20h - 22h", start: 20, end: 22, tempo: 0 },
    ];
    let otherHoursTempo = 0;
    userMessages.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      const matched = hourRanges.find((r) => h >= r.start && h < r.end);
      if (matched) matched.tempo += getMessageMinutes();
      else otherHoursTempo += getMessageMinutes();
    });
    submissions.forEach((s) => {
      const h = new Date(s.submitted_at || s.created_at).getHours();
      const matched = hourRanges.find((r) => h >= r.start && h < r.end);
      if (matched) matched.tempo += getSubmissionMinutes(s);
      else otherHoursTempo += getSubmissionMinutes(s);
    });
    const horarios = [
      ...hourRanges.map((h) => ({ name: h.label, tempo: Math.round(h.tempo) })),
      ...(otherHoursTempo > 0
        ? [{ name: "Outros", tempo: Math.round(otherHoursTempo) }]
        : []),
    ];

    const sortedDaysList = Object.entries(dailyMinutesMap).sort(
      (a, b) => b[1] - a[1],
    );
    const mostActiveDayRaw = sortedDaysList[0]?.[0] || "";
    const formattedActiveDay = (mostActiveDayRaw === "Domingo" || mostActiveDayRaw === "Sábado")
      ? mostActiveDayRaw
      : `${mostActiveDayRaw}-feira`;

    const mostActiveDay =
      sortedDaysList[0] && sortedDaysList[0][1] > 0
        ? `${formattedActiveDay} é quando você mais estudou`
        : "Sem acessos";

    // Hora do dia preferida (Noite vs Manhã vs Tarde)
    let morningMins = 0;
    let afternoonMins = 0;
    let nightMins = 0;
    const countPeriod = (d: Date, scale: number) => {
      const h = d.getHours();
      if (h >= 6 && h < 12) morningMins += scale;
      else if (h >= 12 && h < 18) afternoonMins += scale;
      else nightMins += scale;
    };
    userMessages.forEach((m) => countPeriod(new Date(m.created_at), getMessageMinutes()));
    submissions.forEach((s) =>
      countPeriod(new Date(s.submitted_at || s.created_at), getSubmissionMinutes(s)),
    );
    let preferredTimeOfDay = "Sem acessos";
    if (morningMins > 0 || afternoonMins > 0 || nightMins > 0) {
      if (morningMins >= afternoonMins && morningMins >= nightMins)
        preferredTimeOfDay = `Manhã`;
      else if (afternoonMins >= morningMins && afternoonMins >= nightMins)
        preferredTimeOfDay = `Tarde`;
      else preferredTimeOfDay = `Noite`;
    }

    // Sessions calculation
    const sortedDatesAsc = [...activityDates].sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    let sessionsCount = 0;
    let currentSessionEnd = 0;
    sortedDatesAsc.forEach((d) => {
      if (d.getTime() > currentSessionEnd) {
        sessionsCount++;
        currentSessionEnd = d.getTime() + 30 * 60 * 1000;
      }
    });
    const avgSessionVal =
      sessionsCount > 0 ? Math.round(calculatedMinutes / sessionsCount) : 0;
    const avgSessionDuration =
      avgSessionVal > 0 ? `${avgSessionVal} min` : "0 min";

    // Frequência de acesso/semana
    const uniqueDays = new Set(activityDates.map((d) => d.toDateString())).size;
    const firstDate = sortedDatesAsc[0];
    const lastDate = sortedDatesAsc[sortedDatesAsc.length - 1];
    let weeksCount = 1;
    if (firstDate && lastDate) {
      const diffDays = Math.ceil(
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      weeksCount = Math.max(1, Math.ceil(diffDays / 7));
    }
    const weeklyFrequency = parseFloat((uniqueDays / weeksCount).toFixed(1));

    // Consistência precisa baseada em histórico real e frequência
    let consistency = "Início de Jornada (Poucos registros de acesso)";
    if (uniqueDays >= 4 && weeksCount >= 2) {
      consistency = "Altamente Consistente (Frequência contínua e regular)";
    } else if (uniqueDays >= 2) {
      consistency = "Consistência Regular (Estudos em dias específicos)";
    } else if (sessionsCount > 0) {
      consistency = "Estudos Pontuais (Poucas sessões registradas)";
    }

    // Chat Geral vs Chat Prova
    let generalChatsCount = 0;
    let examChatsCount = 0;
    sessions.forEach((s) => {
      const t = (s.title || "").toLowerCase();
      if (
        t.includes("prova") ||
        t.includes("simulado") ||
        t.includes("exame") ||
        t.includes("revisar")
      ) {
        examChatsCount++;
      } else {
        generalChatsCount++;
      }
    });
    let chatGeneralVsExam = "Sem chats";
    if (generalChatsCount > 0 || examChatsCount > 0) {
      chatGeneralVsExam =
        generalChatsCount >= examChatsCount
          ? "Chat Geral (Discussões gerais)"
          : "Chat Prova (Foco simulados)";
    }

    // Estudos distribuídos vs concentrados
    let studyType = "Sem dados";
    if (activityDates.length > 0) {
      const activeDaysCount = new Set(
        activityDates.map((d) => d.toDateString()),
      ).size;
      const ratio = activityDates.length / activeDaysCount;
      if (activeDaysCount >= 2 && ratio < 3) {
        studyType = "Estudos Distribuídos (Pequenos blocos regulares)";
      } else {
        studyType = "Estudos Concentrados (Sessões longas acumuladas)";
      }
    }

    // Progresso semana a semana
    const progressWeekToWeek = [
      { name: "Semana -3", tempo: 0 },
      { name: "Semana -2", tempo: 0 },
      { name: "S. Passada", tempo: 0 },
      { name: "S. Atual", tempo: 0 },
    ];
    userMessages.forEach((m) => {
      const d = new Date(m.created_at);
      const diffDays = Math.floor(
        (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays <= 7) progressWeekToWeek[3].tempo += 8;
      else if (diffDays <= 14) progressWeekToWeek[2].tempo += 8;
      else if (diffDays <= 21) progressWeekToWeek[1].tempo += 8;
      else if (diffDays <= 28) progressWeekToWeek[0].tempo += 8;
    });
    submissions.forEach((s) => {
      const d = new Date(s.submitted_at || s.created_at);
      const diffDays = Math.floor(
        (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays <= 7) progressWeekToWeek[3].tempo += 25;
      else if (diffDays <= 14) progressWeekToWeek[2].tempo += 25;
      else if (diffDays <= 21) progressWeekToWeek[1].tempo += 25;
      else if (diffDays <= 28) progressWeekToWeek[0].tempo += 25;
    });

    // Exam / Simulados stats
    let totalExamScore = 0;
    let validExamsCount = 0;
    const examHistory: { name: string; score: number }[] = [];

    submissions.forEach(s => {
      if (s.telemetry?.is_unfinished === true) return;

      const exam = (allMockExams || []).find((e: any) => e.id === s.mock_exam_id);
      let hasPendingWritten = false;
      if (exam && exam.questions) {
        let qList: any[] = [];
        if (typeof exam.questions === 'string') {
          try {
            qList = JSON.parse(exam.questions);
          } catch {
            qList = [];
          }
        } else if (Array.isArray(exam.questions)) {
          qList = exam.questions;
        }

        const writtenQs = qList.filter((q: any) => q.type === 'written');
        let tel = s.telemetry;
        if (typeof tel === 'string') {
          try { tel = JSON.parse(tel); } catch { tel = null; }
        }
        let manualGrades = s.manual_grades;
        if (typeof manualGrades === 'string') {
          try {
            manualGrades = JSON.parse(manualGrades);
          } catch {
            manualGrades = null;
          }
        }
        if ((!manualGrades || Object.keys(manualGrades).length === 0) && tel && typeof tel === 'object' && tel.manual_grades) {
          manualGrades = tel.manual_grades;
        }
        if (!manualGrades) manualGrades = {};

        const pendingWritten = writtenQs.filter((q: any) => !manualGrades[q.id]);
        if (pendingWritten.length > 0) {
          hasPendingWritten = true;
        }
      }

      // Only include fully evaluated exam scores so pending discursive questions do not falsely lower student average
      if (!hasPendingWritten && s.score !== undefined && s.score !== null) {
        totalExamScore += parseFloat(s.score);
        validExamsCount++;
        const dt = new Date(s.submitted_at || s.created_at);
        examHistory.push({
          name: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          score: parseFloat(s.score)
        });
      }
    });

    const avgScore = validExamsCount > 0 
      ? (totalExamScore / validExamsCount).toFixed(1) 
      : (submissions.length > 0 ? "—" : "0.0");
    
    return {
      hasActivity: true,
      totalTimeText,
      meses,
      semanas,
      dias,
      horarios,
      mostActiveDay,
      preferredTimeOfDay,
      avgSessionDuration,
      weeklyFrequency,
      consistency,
      chatGeneralVsExam,
      studyType,
      progressWeekToWeek,
      openTimeSec,
      activeTimeSec,
      openTimeText: formatTrackingTime(openTimeSec),
      activeTimeText: formatTrackingTime(activeTimeSec),
      simuladosCount: submissions.length,
      avgScore,
      examHistory,
    };
  };

  const getDaysRemainingText = (dateStr: string) => {
    if (!dateStr) return null;
    const examDate = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: "Já ocorreu", className: "text-neutral-500 bg-neutral-900 border-neutral-850", iconClass: "text-neutral-600" };
    } else if (diffDays === 0) {
      return { text: "Hoje! 🚨", className: "text-rose-450 bg-rose-500/15 border-rose-500/25 font-bold animate-pulse", iconClass: "text-rose-400" };
    } else if (diffDays === 1) {
      return { text: "Amanhã! ⚠️", className: "text-amber-450 bg-amber-500/15 border-amber-500/25 font-bold", iconClass: "text-amber-400" };
    } else {
      return { text: `Faltam ${diffDays} dias`, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 font-semibold", iconClass: "text-emerald-400" };
    }
  };

  const [profile, setProfile] = useState<{
    id: string;
    nome_completo: string;
    turma: string;
    numero_chamada: number;
    email?: string;
    escola?: string;
    notification_gmail?: string;
  } | null>(null);

  // Real-time student presence states
  const [openTime, setOpenTime] = useState<number>(0);
  const [activeTime, setActiveTime] = useState<number>(0);
  const openTimeRef = useRef<number>(0);
  const activeTimeRef = useRef<number>(0);
  const hasLoadedInitialTracking = useRef<boolean>(false);

  // 1. Fetch initial tracking values on mount or when profile is available
  useEffect(() => {
    if (profile && !hasLoadedInitialTracking.current) {
      const fetchInitialTracking = async () => {
        try {
          const { data } = await supabase
            .from("wsm_student_analytics")
            .select("*")
            .eq("student_email", email.toLowerCase())
            .maybeSingle();
          if (data) {
            const openS = data.hourly_distribution?.tempo_plataforma_aberta_s || 0;
            const activeS = data.hourly_distribution?.tempo_ativo_mexendo_s || 0;
            setOpenTime(openS);
            setActiveTime(activeS);
            openTimeRef.current = openS;
            activeTimeRef.current = activeS;
          }
          hasLoadedInitialTracking.current = true;
        } catch (err) {
          console.error("Error fetching initial tracking:", err);
        }
      };
      fetchInitialTracking();
    }
  }, [profile, email]);

  // 2. Real-time active physical tracking
  useEffect(() => {
    if (!profile) return;

    let wasActiveInThisSecond = false;

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      wasActiveInThisSecond = true;
    };

    activityEvents.forEach(evt => window.addEventListener(evt, handleActivity));

    let localTickCount = 0;

    const intervalId = setInterval(() => {
      if (!hasLoadedInitialTracking.current) return;

      openTimeRef.current += 1;
      if (wasActiveInThisSecond) {
        activeTimeRef.current += 1;
        wasActiveInThisSecond = false;
      }
    }, 1000);

    // Save periodically to Supabase every 20 seconds
    const saveIntervalId = setInterval(async () => {
      if (!hasLoadedInitialTracking.current) return;
      try {
        const latestOpen = openTimeRef.current;
        const latestActive = activeTimeRef.current;

        // Fetch latest row to merge other keys to avoid overwriting
        const { data: latestRow } = await supabase
          .from("wsm_student_analytics")
          .select("*")
          .eq("student_email", email.toLowerCase())
          .maybeSingle();

        const currentHourly = latestRow?.hourly_distribution || {};

        const { error } = await supabase
          .from("wsm_student_analytics")
          .upsert({
            student_email: email.toLowerCase(),
            hourly_distribution: {
              ...currentHourly,
              tempo_plataforma_aberta_s: latestOpen,
              tempo_ativo_mexendo_s: latestActive
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_email' });

        if (error) {
          console.warn("Error saving tracking times:", error.message);
        }
      } catch (err) {
        console.warn("Exception while saving tracking times:", err);
      }
    }, 20000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearInterval(intervalId);
      clearInterval(saveIntervalId);
    };
  }, [profile, email]);

  const [exams, setExams] = useState<any[]>([]);
  const [mockExams, setMockExams] = useState<any[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([]);
  const [virtualClasses, setVirtualClasses] = useState<any[]>([]);
  const [dbAnnouncements, setDbAnnouncements] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedNotifs, setSelectedNotifs] = useState<Set<string>>(new Set());

  const handleDeleteSelectedNotifs = async () => {
    if (selectedNotifs.size === 0) return;
    try {
      // For virtual welcome notifications
      selectedNotifs.forEach(id => {
        if (id.startsWith('welcome-notif-')) {
          localStorage.setItem(`deleted_${id}_${email.toLowerCase()}`, 'true');
        }
      });
      
      const dbIds = Array.from(selectedNotifs).filter(id => !id.startsWith('welcome-notif-'));
      if (dbIds.length > 0) {
        await supabase
          .from('wsm_notifications')
          .delete()
          .in('id', dbIds);
      }
      
      setNotifications(prev => prev.filter(n => !selectedNotifs.has(n.id)));
      setSelectedNotifs(new Set());
    } catch (err) {
      console.error("Error deleting notifications:", err);
    }
  };

  const handleDeleteAllNotifs = async () => {
    if (!profile) return;
    try {
      // For virtual welcome notifications
      teachers.forEach((t, i) => {
        const id = `welcome-notif-${t.id || i}`;
        localStorage.setItem(`deleted_${id}_${email.toLowerCase()}`, 'true');
      });

      await supabase
        .from('wsm_notifications')
        .delete()
        .eq('user_id', profile.id);
        
      setNotifications([]);
      setSelectedNotifs(new Set());
    } catch (err) {
      console.error("Error deleting all notifications:", err);
    }
  };

  // Dynamic list of all classes the student belongs to
  const allEnrolledClasses = useMemo(() => {
    const list = new Set<string>();
    if (profile?.turma) list.add(profile.turma);
    virtualClasses.forEach(vc => {
      if (vc.name) list.add(vc.name);
    });
    return Array.from(list);
  }, [profile?.turma, virtualClasses]);

  // Computed notifications: fall back to a dynamic welcome notification if there are no database notifications but teachers are registered
  const displayNotifications = notifications.length > 0 
    ? notifications 
    : (teachers || [])
        .map((teacher, index) => {
          const notifId = `welcome-notif-${teacher.id || index}`;
          const readKey = `read_${notifId}_${email.toLowerCase()}`;
          const isRead = localStorage.getItem(readKey) === 'true';
          const isDeleted = localStorage.getItem(`deleted_${notifId}_${email.toLowerCase()}`) === 'true';
          return {
            id: notifId,
            title: `🎉 Bem-vindo(a) ao Athenas!`,
            message: `Olá! O(A) professor(a) ${teacher.nome_completo || 'Docente'} já está cadastrado(a) no sistema e leciona para sua turma (${profile?.turma || ''}).\n\nNesta aba de Notificações, você receberá alertas automáticos em tempo real sempre que novos simulados forem agendados ou quando novas provas físicas forem marcadas! Bons estudos!`,
            is_read: isRead,
            is_deleted: isDeleted,
            created_at: teacher.created_at || new Date().toISOString()
          };
        })
        .filter(n => !n.is_deleted);

  useEffect(() => {
    if (profile) {
      const loadAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
          const cleanEmail = (email || '').toLowerCase().trim();
          const { data: submissions } = await supabase
            .from("wsm_mock_submissions")
            .select("*")
            .ilike("student_email", cleanEmail);

          const { data: sessions } = await supabase
            .from("wsm_chat_sessions")
            .select("*")
            .ilike("user_email", cleanEmail);

          let userMessages: any[] = [];
          if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map((s) => s.id);
            const { data: msgData } = await supabase
              .from("wsm_chat_messages")
              .select("*")
              .eq("role", "user")
              .in("session_id", sessionIds);
            if (msgData) {
              userMessages = msgData;
            }
          }

          let dbAnalytics = null;
          try {
            const { data } = await supabase
              .from("wsm_student_analytics")
              .select("*")
              .ilike("student_email", cleanEmail)
              .maybeSingle();
            if (data) {
              dbAnalytics = data;
            }
          } catch (err) {
            // Table might not exist yet
          }

          let dbMockExams: any[] = [];
          try {
            const { data: mExams } = await supabase
              .from("wsm_mock_exams")
              .select("id, questions, total_points");
            if (mExams) dbMockExams = mExams;
          } catch (err) {
            console.warn("Could not load mock exams for student analytics:", err);
          }

          const stableStats = calculateStudentStats(
            submissions || [],
            sessions || [],
            userMessages,
            dbAnalytics,
            openTime,
            activeTime,
            dbMockExams
          );
          setAnalyticsData(stableStats);
        } catch (err) {
          console.error("Error loading student analytics:", err);
        } finally {
          setLoadingAnalytics(false);
        }
      };
      loadAnalytics();
    }
  }, [activeTab, profile, email]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        let profileData: any = null;
        let dbError = null;
        const emailClean = (email || '').trim().toLowerCase();
        if (!emailClean) return;

        // 1. Query auth metadata and local cache as solid fallbacks
        let authMeta: any = {};
        try {
          const { data: authUserData } = await supabase.auth.getUser();
          if (authUserData?.user?.user_metadata) {
            authMeta = authUserData.user.user_metadata;
          }
        } catch (authErr) {
          console.warn('Could not read auth user_metadata:', authErr);
        }

        const localTurma = localStorage.getItem(`wsm_profile_turma_${emailClean}`) || localStorage.getItem(`wsm_active_student_class_${emailClean}`) || '';
        const localChamadaRaw = localStorage.getItem(`wsm_profile_chamada_${emailClean}`);
        const localChamada = localChamadaRaw ? parseInt(localChamadaRaw, 10) : NaN;
        const localNome = localStorage.getItem(`wsm_profile_nome_${emailClean}`) || '';
        const localEscola = localStorage.getItem(`wsm_profile_escola_${emailClean}`) || '';
        const localGmail = localStorage.getItem(`wsm_gmail_fallback_${emailClean}`) || null;

        try {
          const { data, error } = await supabase
            .from('wsm_user_profiles')
            .select('id, nome_completo, turma, numero_chamada, email, notification_gmail')
            .ilike('email', emailClean)
            .maybeSingle();
          if (error) {
            dbError = error;
          } else {
            profileData = data;
          }
        } catch (err) {
          dbError = err;
        }

        if (dbError || !profileData) {
          try {
            const { data } = await supabase
              .from('wsm_user_profiles')
              .select('id, nome_completo, turma, numero_chamada, email')
              .ilike('email', emailClean)
              .maybeSingle();
            if (data) {
              profileData = {
                ...data,
                notification_gmail: localGmail
              };
            }
          } catch (fbErr) {
            console.warn('Fallback query failed:', fbErr);
          }
        }

        // 2. Discover enrolled virtual class if not yet bound
        let discoveredTurma = profileData?.turma || authMeta.turma || localTurma || '';
        try {
          const { data: vClasses } = await supabase
            .from('wsm_virtual_classes')
            .select('id, name, access_code, student_emails');
          if (vClasses && vClasses.length > 0) {
            const foundClass = vClasses.find((vc: any) => {
              let emails: string[] = [];
              if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
              else if (typeof vc.student_emails === 'string') {
                try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()); }
              }
              const inEmails = emails.some((e: string) => e && e.toLowerCase().trim() === emailClean);
              const matchesDiscovered = discoveredTurma ? areTurmasMatching(vc.name, discoveredTurma) || vc.access_code === discoveredTurma : false;
              return inEmails || matchesDiscovered;
            });
            if (foundClass && foundClass.name) {
              discoveredTurma = foundClass.name;
              
              // Ensure student email is in this virtual class
              let currentEmails: string[] = [];
              if (Array.isArray(foundClass.student_emails)) currentEmails = foundClass.student_emails;
              else if (typeof foundClass.student_emails === 'string') {
                try { currentEmails = JSON.parse(foundClass.student_emails); } catch { currentEmails = foundClass.student_emails.split(',').map((s: string) => s.trim()); }
              }
              if (!currentEmails.some((e: string) => e && e.toLowerCase().trim() === emailClean)) {
                const updatedList = Array.from(new Set([...currentEmails, emailClean]));
                supabase
                  .from('wsm_virtual_classes')
                  .update({ student_emails: updatedList })
                  .eq('id', foundClass.id)
                  .then(({ error }) => {
                    if (error) console.warn('Background auto-enroll error:', error);
                  });
              }
            }
          }
        } catch (healErr) {
          console.warn('Virtual classes check error:', healErr);
        }

        const resolvedTurma = profileData?.turma || authMeta.turma || discoveredTurma || localTurma || '';
        const resolvedChamada = (profileData?.numero_chamada !== undefined && profileData?.numero_chamada !== null)
          ? Number(profileData.numero_chamada)
          : (authMeta.numero_chamada !== undefined && authMeta.numero_chamada !== null
            ? Number(authMeta.numero_chamada)
            : (!isNaN(localChamada) ? localChamada : 1));
        const resolvedNome = profileData?.nome_completo || authMeta.nome_completo || localNome || emailClean.split('@')[0];
        const resolvedEscola = profileData?.escola || authMeta.escola || localEscola || '';
        const resolvedNotificationGmail = profileData?.notification_gmail || localGmail || null;

        if (profileData) {
          // Persist back to database if we healed missing turma or calling number
          if (resolvedTurma && (!profileData.turma || profileData.numero_chamada === null || profileData.numero_chamada === undefined)) {
            await supabase
              .from('wsm_user_profiles')
              .update({ 
                turma: resolvedTurma,
                numero_chamada: resolvedChamada,
                nome_completo: resolvedNome
              })
              .eq('id', profileData.id);
          }

          setProfile({
            id: profileData.id,
            nome_completo: resolvedNome,
            turma: resolvedTurma,
            numero_chamada: resolvedChamada,
            email: profileData.email || emailClean,
            escola: resolvedEscola,
            notification_gmail: resolvedNotificationGmail
          });

          // Sync active turma
          const savedActive = localStorage.getItem(`wsm_active_student_class_${emailClean}`);
          if (savedActive) {
            setActiveTurma(savedActive);
          } else if (resolvedTurma) {
            setActiveTurma(resolvedTurma);
            localStorage.setItem(`wsm_active_student_class_${emailClean}`, resolvedTurma);
          }

          localStorage.setItem(`wsm_profile_turma_${emailClean}`, resolvedTurma);
          localStorage.setItem(`wsm_profile_chamada_${emailClean}`, String(resolvedChamada));

          setSetName(resolvedNome);
          setSetEscola(resolvedEscola);
          setSetChamada(resolvedChamada);
          setActiveChamada(resolvedChamada);
          setSetMail(profileData.email || emailClean);
          if (resolvedNotificationGmail) {
            setNotificationGmailInput(resolvedNotificationGmail);
          }
        } else {
          // Initialize a consistent student profile if not found
          const defaultId = crypto.randomUUID();
          const newProfile = {
            id: defaultId,
            email: emailClean,
            role: 'student' as const,
            nome_completo: resolvedNome,
            turma: resolvedTurma,
            numero_chamada: resolvedChamada,
            escola: resolvedEscola,
            notification_gmail: resolvedNotificationGmail
          };
          await safeUpsertUserProfile(newProfile);
          setProfile(newProfile);
          setActiveChamada(resolvedChamada);
          
          if (resolvedTurma) {
            setActiveTurma(resolvedTurma);
            localStorage.setItem(`wsm_active_student_class_${emailClean}`, resolvedTurma);
          }

          localStorage.setItem(`wsm_profile_turma_${emailClean}`, resolvedTurma);
          localStorage.setItem(`wsm_profile_chamada_${emailClean}`, String(resolvedChamada));

          setSetName(resolvedNome);
          setSetEscola(resolvedEscola);
          setSetChamada(resolvedChamada);
          setSetMail(emailClean);
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
      }
    }
    fetchProfile();
  }, [email]);

  // Start Realtime Browser Push Notification Listener for student
  useEffect(() => {
    const cleanup = startRealtimeNotificationListener('student', profile?.turma, email);
    return () => {
      cleanup();
    };
  }, [profile?.turma, email]);

  // Sync settings inputs whenever settings modal opens
  useEffect(() => {
    if (isSettingsOpen && profile) {
      setSetName(profile.nome_completo || '');
      setSetEscola(profile.escola || '');
      setSetChamada(profile.numero_chamada || 1);
      setSetMail(profile.email || email);
      setSetPassword('');
      setSettingsStatus(null);
    }
  }, [isSettingsOpen, profile, email]);

  const handleUpdateSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile && !email) return;
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const cleanName = setName.trim();
      const cleanMail = (setMail.trim() || profile?.email || email || '').toLowerCase();
      const cleanEscola = setEscola.trim();
      const cleanChamada = Number(setChamada) || 1;

      if (!cleanName) {
        throw new Error('Por favor, informe seu nome completo.');
      }

      // 1. Optional password update in Supabase Auth
      if (setPassword.trim().length >= 6) {
        try {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: setPassword.trim() });
          if (pwdErr) console.warn('Could not update auth password:', pwdErr);
        } catch (pErr) {
          console.warn('Auth password update exception:', pErr);
        }
      }

      // 2. Update user metadata in Supabase Auth
      try {
        await supabase.auth.updateUser({
          data: {
            nome_completo: cleanName,
            numero_chamada: cleanChamada,
            escola: cleanEscola
          }
        });
      } catch (authErr) {
        console.warn('Auth user metadata update error:', authErr);
      }

      // 3. Direct UPDATE in wsm_user_profiles
      const directUpdatePayload: any = {
        nome_completo: cleanName,
        numero_chamada: cleanChamada,
        ...(setPassword.trim().length >= 6 ? { senha_plana: setPassword.trim() } : {})
      };

      if (profile?.id) {
        const { error: idUpdateErr } = await supabase
          .from('wsm_user_profiles')
          .update(directUpdatePayload)
          .eq('id', profile.id);
        if (idUpdateErr) console.warn('Direct update by id failed:', idUpdateErr);
      }

      const { error: emailUpdateErr } = await supabase
        .from('wsm_user_profiles')
        .update(directUpdatePayload)
        .eq('email', cleanMail);
      if (emailUpdateErr) console.warn('Direct update by email warning:', emailUpdateErr);

      // 4. Safe upsert fallback
      const { data: updatedData, error } = await safeUpsertUserProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        email: cleanMail,
        role: 'student',
        nome_completo: cleanName,
        turma: profile?.turma || '',
        numero_chamada: cleanChamada,
        escola: cleanEscola
      });
        
      if (error && emailUpdateErr) throw error;
      
      // 5. Update local cache
      try {
        localStorage.setItem(`wsm_profile_nome_${cleanMail}`, cleanName);
        localStorage.setItem(`wsm_profile_escola_${cleanMail}`, cleanEscola);
        localStorage.setItem(`wsm_profile_chamada_${cleanMail}`, String(cleanChamada));
      } catch {}

      // 6. Update local profile state
      setProfile(prev => ({
        id: updatedData?.id || profile?.id || prev?.id || crypto.randomUUID(),
        nome_completo: cleanName,
        email: cleanMail,
        turma: updatedData?.turma || profile?.turma || prev?.turma || '',
        numero_chamada: cleanChamada,
        escola: cleanEscola,
        notification_gmail: profile?.notification_gmail
      }));
      setActiveChamada(cleanChamada);
      
      setSetPassword('');
      setSettingsStatus({ type: 'success', msg: 'Suas preferências foram salvas com sucesso!' });
      await loadData();

      setTimeout(() => {
        setIsSettingsOpen(false);
        setSettingsStatus(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setSettingsStatus({ type: 'error', msg: err.message || 'Erro ao atualizar as configurações.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const targetEmail = notificationGmailInput.trim();
    if (!targetEmail) {
      setGmailStatus({ type: 'error', msg: 'Por favor, insira um endereço de e-mail do Gmail válido.' });
      return;
    }

    if (!targetEmail.toLowerCase().endsWith('@gmail.com')) {
      setGmailStatus({ type: 'error', msg: 'O e-mail precisa ser um endereço válido do Gmail (exemplo@gmail.com).' });
      return;
    }

    setSavingGmail(true);
    setGmailStatus(null);

    // Save locally first so user feels instant feedback and has reliable backup
    localStorage.setItem(`wsm_gmail_fallback_${email.toLowerCase()}`, targetEmail);

    try {
      // 1. Try to save on the server local JSON mapping
      try {
        await fetch('/api/save-notification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, email: targetEmail })
        });
      } catch (apiErr) {
        console.warn('Erro ao salvar e-mail de notificações no servidor:', apiErr);
      }

      // 2. Try to update in Supabase
      try {
        await supabase
          .from('wsm_user_profiles')
          .update({
            notification_gmail: targetEmail
          })
          .eq('id', profile.id);
      } catch (dbErr) {
        console.warn('Erro ao salvar no banco de dados (provável falta de coluna):', dbErr);
      }

      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        notification_gmail: targetEmail
      } : null);

      setGmailStatus({ type: 'success', msg: 'E-mail do Gmail cadastrado e ativado com sucesso para receber notificações!' });
      setIsEditingGmail(false);
    } catch (err: any) {
      console.error('Erro no fluxo de salvamento do Gmail:', err);
      setGmailStatus({ type: 'error', msg: 'Erro ao cadastrar seu e-mail de notificações.' });
    } finally {
      setSavingGmail(false);
    }
  };

  const handleDeleteGmail = async () => {
    if (!profile) return;
    
    if (!window.confirm('Tem certeza que deseja desativar as notificações e remover este e-mail do Gmail?')) {
      return;
    }

    setSavingGmail(true);
    setGmailStatus(null);

    // Remove from local storage
    localStorage.removeItem(`wsm_gmail_fallback_${email.toLowerCase()}`);

    try {
      // 1. Try to delete on the server local JSON mapping
      try {
        await fetch('/api/save-notification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, email: null })
        });
      } catch (apiErr) {
        console.warn('Erro ao deletar e-mail de notificações no servidor:', apiErr);
      }

      // 2. Try to update in Supabase
      try {
        await supabase
          .from('wsm_user_profiles')
          .update({
            notification_gmail: null
          })
          .eq('id', profile.id);
      } catch (dbErr) {
        console.warn('Erro ao limpar no banco de dados:', dbErr);
      }

      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        notification_gmail: null
      } : null);

      setNotificationGmailInput('');
      setGmailStatus({ type: 'success', msg: 'Notificações por e-mail desativadas e e-mail removido com sucesso!' });
      setIsEditingGmail(false);
    } catch (err: any) {
      console.error('Erro ao deletar o Gmail:', err);
      setGmailStatus({ type: 'error', msg: 'Erro ao remover o e-mail de notificações.' });
    } finally {
      setSavingGmail(false);
    }
  };

  const loadData = async (overrideActiveTurma?: string) => {
    if (!profile) return;
    const currentActiveTurma = overrideActiveTurma || activeTurma || profile.turma || '';

    try {
      // Fetch virtual classes this student belongs to first
      let studentVirtualClassIds: string[] = [];
      let studentVirtualClassesList: any[] = [];
      try {
        const { data: allVCls } = await supabase
          .from('wsm_virtual_classes')
          .select('*');
        if (allVCls) {
          const cleanEmail = email.toLowerCase().trim();
          // First check direct enrollment in virtual classes
          const directlyEnrolled = allVCls.filter((vc: any) => {
            let vcEmails: string[] = [];
            if (Array.isArray(vc.student_emails)) vcEmails = vc.student_emails;
            else if (typeof vc.student_emails === 'string') {
              try { vcEmails = JSON.parse(vc.student_emails); } catch { vcEmails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean); }
            }
            return vcEmails.some((e: any) => e && String(e).toLowerCase().trim() === cleanEmail);
          });

          if (directlyEnrolled.length > 0) {
            studentVirtualClassesList = directlyEnrolled;
          } else {
            // Fallback to turma name / access code match
            studentVirtualClassesList = allVCls.filter((vc: any) => {
              const matchesTurma = currentActiveTurma && (vc.name === currentActiveTurma || vc.access_code === currentActiveTurma);
              const matchesOfficial = profile.turma && (vc.name === profile.turma || vc.access_code === profile.turma);
              return matchesTurma || matchesOfficial;
            });
          }

          studentVirtualClassIds = studentVirtualClassesList.flatMap((vc: any) =>
            [vc.id, vc.name, vc.access_code, vc.teacher_email].filter(Boolean)
          );
          setVirtualClasses(studentVirtualClassesList);
        }
      } catch (vcErr) {
        console.warn("Could not query virtual classes for student", vcErr);
      }

      // Maintain student's official Chamada number for the active room context
      try {
        if (profile?.numero_chamada !== undefined && profile?.numero_chamada !== null) {
          setActiveChamada(Number(profile.numero_chamada));
        } else {
          const localChamadaRaw = localStorage.getItem(`wsm_profile_chamada_${email.toLowerCase().trim()}`);
          if (localChamadaRaw) {
            const num = parseInt(localChamadaRaw, 10);
            if (!isNaN(num)) setActiveChamada(num);
          }
        }
      } catch (chErr) {
        console.warn("Could not set active chamada:", chErr);
      }

      // 1. Fetch Teachers belonging to the student's virtual classes or cohort
      const { data: teacherProfiles } = await supabase
        .from('wsm_user_profiles')
        .select('*')
        .eq('role', 'teacher');
      
      let filteredTeachers: any[] = [];
      if (teacherProfiles) {
        const allowedTeacherEmails = new Set(
          studentVirtualClassesList
            .map((vc: any) => (vc.teacher_email || '').toLowerCase().trim())
            .filter(Boolean)
        );

        filteredTeachers = teacherProfiles.filter((t: any) => {
          if (!t || !t.email) return false;
          const tEmail = t.email.toLowerCase().trim();
          if (tEmail.endsWith('@example.com') || tEmail.endsWith('@atenas.com')) return false;

          if (allowedTeacherEmails.has(tEmail)) return true;
          const anos = Array.isArray(t.anos_lecionados)
            ? t.anos_lecionados.map((a: string) => String(a).trim())
            : (typeof t.anos_lecionados === 'string' ? t.anos_lecionados.split(',').map((a: string) => a.trim()) : []);
          if (currentActiveTurma && anos.some((a: string) => areTurmasMatching(a, currentActiveTurma))) {
            return true;
          }
          return false;
        });

        // Deduplicate teachers
        const uniqueFiltered = filteredTeachers.filter((t: any, idx: number, arr: any[]) =>
          arr.findIndex((x: any) => (x.email || '').toLowerCase().trim() === (t.email || '').toLowerCase().trim()) === idx
        );

        setTeachers(uniqueFiltered);
      }

      // 2. Fetch Exams for this cohort, virtual classes, or individual email
      const { data: dbExams } = await supabase
        .from('wsm_exams')
        .select('*')
        .order('exam_date', { ascending: true });
      
      let filteredExams: any[] = [];
      if (dbExams) {
        filteredExams = dbExams.filter((ex: any) => {
          if (!ex.classes) return false;
          const matchesCohort = ex.classes.includes(currentActiveTurma);
          const matchesEmail = ex.classes.map((c: string) => c.toLowerCase().trim()).includes(email.toLowerCase().trim());
          const matchesVirtualClass = ex.classes.some((c: string) => c === currentActiveTurma || studentVirtualClassIds.includes(c));
          return matchesCohort || matchesEmail || matchesVirtualClass;
        });
        setExams(filteredExams);
      }

      // 2b. Fetch Mock Exams (Simulados Online) for this class, virtual class, or individual email
      const { data: dbMockExams } = await supabase
        .from('wsm_mock_exams')
        .select('*')
        .order('created_at', { ascending: false });
      
      let filteredMockExams: any[] = [];
      if (dbMockExams) {
        filteredMockExams = dbMockExams.filter((mock: any) => {
          const { settings } = parseExamSettings(mock.description || '');
          if (settings.is_draft || mock.is_draft === true || mock.status === 'draft') return false;
          return matchesStudentTarget(mock.class_name, email, currentActiveTurma, studentVirtualClassIds);
        });
        setMockExams(filteredMockExams);
      }

      // 2c. Fetch student submissions for pending status checks
      let currentStudentSubmissions: any[] = [];
      try {
        const cleanEmail = (email || '').toLowerCase().trim();
        const { data: dbSubmissions } = await supabase
          .from('wsm_mock_submissions')
          .select('*')
          .ilike('student_email', cleanEmail);
        if (dbSubmissions) {
          currentStudentSubmissions = dbSubmissions;
          setStudentSubmissions(dbSubmissions);
        }
      } catch (subErr) {
        console.warn('Error loading student submissions:', subErr);
      }

      // 2d. Fetch announcements (Avisos no Mural) & join with active teacher profiles
      try {
        const { data: dbAnns } = await supabase
          .from('wsm_announcements')
          .select('*')
          .order('created_at', { ascending: false });
        if (dbAnns) {
          const activeTeacherMap = new Map<string, any>();
          (teacherProfiles || []).forEach((t: any) => {
            if (t.email && !t.email.toLowerCase().endsWith('@atenas.com')) {
              activeTeacherMap.set(t.email.toLowerCase().trim(), t);
            }
          });

          const emailClean = email.toLowerCase().trim();
          const filteredAnns = dbAnns
            .filter((ann: any) => {
              const target = ann.class_name;
              const matchesTarget = matchesStudentTarget(target, emailClean, currentActiveTurma, studentVirtualClassIds);
              const matchesCohort = currentActiveTurma && target ? areTurmasMatching(target, currentActiveTurma) : false;
              const isGeneral = !target || ['geral', 'todas', 'toda a escola', 'todos'].includes(target.toLowerCase().trim());
              return matchesTarget || matchesCohort || isGeneral;
            })
            .map((ann: any) => {
              const rawEmail = (ann.teacher_email || '').toLowerCase().trim();
              const activeT = activeTeacherMap.get(rawEmail);
              if (activeT) {
                return {
                  ...ann,
                  teacher_name: activeT.nome_completo || ann.teacher_name || 'Docente',
                  teacher_email: activeT.email,
                  is_teacher_removed: false
                };
              } else {
                return {
                  ...ann,
                  teacher_name: 'Professor removido',
                  teacher_email: 'Professor removido',
                  is_teacher_removed: true
                };
              }
            });
          setDbAnnouncements(filteredAnns);
        }
      } catch (annErr) {
        console.warn('Could not load announcements for student:', annErr);
      }

      // 3. Fetch Notifications count & list
      let dbNotifications: any[] = [];
      if (profile?.id) {
        const { data: nData } = await supabase
          .from('wsm_notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });
        if (nData) dbNotifications = nData;
      }
      
      let finalNotifications: any[] = [];

      // Process and filter notifications strictly according to active academic events
      if (dbNotifications && profile) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // 1. Get list of student submissions to know which simulados are completed
        const studentSubs = currentStudentSubmissions || [];
        const submittedMockIds = new Set(studentSubs.map((s: any) => s.mock_exam_id).filter(Boolean));

        // Set of lowercased titles of completed mock exams
        const completedMockTitles = new Set<string>();
        if (dbMockExams) {
          dbMockExams.forEach((m: any) => {
            if (submittedMockIds.has(m.id) && m.title) {
              completedMockTitles.add(m.title.toLowerCase().trim());
            }
          });
        }

        const notificationIdsToDelete: string[] = [];

        finalNotifications = dbNotifications.filter((n: any) => {
          const titleLower = (n.title || '').toLowerCase();
          const msgLower = (n.message || '').toLowerCase();

          // A) REMOVE COUNTDOWN / TIMER NOTIFICATIONS
          if (
            msgLower.includes('[ref:') ||
            titleLower.includes('em breve') ||
            msgLower.includes('resta apenas') ||
            msgLower.includes('falta apenas') ||
            titleLower.includes('⏰')
          ) {
            notificationIdsToDelete.push(n.id);
            return false;
          }

          // B) SIMULADO NOTIFICATION: stays until the student completes/takes the simulado OR the deadline passes
          const isSimuladoNotif = titleLower.includes('simulado') || msgLower.includes('simulado');
          if (isSimuladoNotif) {
            // Check if student completed any mock exam referenced in this notification
            for (const sub of studentSubs) {
              if (sub.mock_exam_id && !sub.telemetry?.is_unfinished) {
                const mock = (dbMockExams || []).find((m: any) => m.id === sub.mock_exam_id);
                if (mock && mock.title) {
                  const mTitle = mock.title.toLowerCase().trim();
                  if (msgLower.includes(mTitle) || titleLower.includes(mTitle)) {
                    notificationIdsToDelete.push(n.id);
                    return false; // Student finished this simulado! Hide notification
                  }
                }
              }
            }
            for (const title of completedMockTitles) {
              if (title && (msgLower.includes(title) || titleLower.includes(title))) {
                notificationIdsToDelete.push(n.id);
                return false; // Student finished this simulado!
              }
            }

            // Check if any referenced mock exam has an expired deadline
            const referencedMocks = (dbMockExams || []).filter((m: any) => {
              if (!m.title) return false;
              const mTitle = m.title.toLowerCase().trim();
              return msgLower.includes(mTitle) || titleLower.includes(mTitle);
            });

            if (referencedMocks.length > 0) {
              const allExpired = referencedMocks.every((m: any) => {
                if (!m.deadline) return false;
                return new Date(m.deadline).getTime() < now.getTime();
              });

              if (allExpired) {
                notificationIdsToDelete.push(n.id);
                return false; // Deadline passed! Auto-delete & hide notification
              }
            } else {
              // If notification contains explicit deadline date text (e.g. "disponível até DD/MM/YYYY")
              const dateMatch = msgLower.match(/(disponível até|prazo|até o dia|encerra em)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
              if (dateMatch) {
                const day = parseInt(dateMatch[2], 10);
                const month = parseInt(dateMatch[3], 10) - 1;
                const year = parseInt(dateMatch[4], 10);
                const deadlineTime = new Date(year, month, day, 23, 59, 59, 999).getTime();
                if (now.getTime() > deadlineTime) {
                  notificationIdsToDelete.push(n.id);
                  return false; // Date in notification passed!
                }
              }
            }
          }

          // C) PROVA NOTIFICATION: stays until the day of the prova arrives (or passes)
          const isProvaNotif = titleLower.includes('nova prova') || (titleLower.includes('prova') && !isSimuladoNotif);
          if (isProvaNotif) {
            // First check if a date is formatted in the notification message (e.g. "para o dia DD/MM/YYYY")
            const dateMatch = msgLower.match(/para o dia (\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1], 10);
              const month = parseInt(dateMatch[2], 10) - 1;
              const year = parseInt(dateMatch[3], 10);
              const examTime = new Date(year, month, day, 0, 0, 0, 0).getTime();
              if (todayStart >= examTime) {
                notificationIdsToDelete.push(n.id);
                return false; // Day of prova arrived or passed!
              }
            }

            // Also check matching exam from filteredExams
            const matchingExam = (filteredExams || []).find((ex: any) => {
              if (!ex.title) return false;
              const exTitleLower = ex.title.toLowerCase().trim();
              return msgLower.includes(exTitleLower) || titleLower.includes(exTitleLower);
            });

            if (matchingExam && matchingExam.exam_date) {
              let examTime = 0;
              const datePart = matchingExam.exam_date.split('T')[0];
              const [y, m, d] = datePart.split('-').map(Number);
              if (y && m && d) {
                examTime = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
              } else {
                examTime = new Date(matchingExam.exam_date).getTime();
              }

              if (todayStart >= examTime) {
                notificationIdsToDelete.push(n.id);
                return false; // Day of prova arrived or passed!
              }
            }
          }

          return true;
        });

        // Clean up outdated / completed notifications from the database
        if (notificationIdsToDelete.length > 0) {
          supabase
            .from('wsm_notifications')
            .delete()
            .in('id', notificationIdsToDelete)
            .then(({ error }) => {
              if (error) console.warn('Could not auto-clean notifications:', error);
            });
        }
      }

      // Enrich exams with extracted exam time from date string, observations, content, and notifications
      if (filteredExams && filteredExams.length > 0) {
        const enrichedExams = filteredExams.map((ex: any) => {
          const time = extractExamTime(ex, dbNotifications || undefined);
          return {
            ...ex,
            exam_time: time || ex.exam_time || null,
          };
        });
        setExams(enrichedExams);
      }

      setNotifications(finalNotifications);
    } catch (err) {
      console.error('Error loading academic data:', err);
    }
  };

  // Poll for changes and subscribe to real-time additions
  useEffect(() => {
    if (profile) {
      loadData();
      const interval = setInterval(loadData, 5000);

      const channel = supabase
        .channel(`student-realtime-${email.toLowerCase().trim()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wsm_announcements' }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wsm_notifications' }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wsm_exams' }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wsm_mock_exams' }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        clearInterval(interval);
        channel.unsubscribe();
      };
    }
  }, [profile]);
  
  // Local AI simulator states
  const [aiMessage, setAiMessage] = useState('');
  const [conversation, setConversation] = useState<{role: 'user' | 'athenas', text: string}[]>([
    { role: 'athenas', text: 'Olá! Sou o Athenas AI, seu tutor inteligente. Como posso te auxiliar em seus estudos de Engenharia de Software hoje?' }
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Pre-programmed smart quick answers to make the app super interactive & responsive
  const suggestQuestions = [
    "Como calcular meu limite de faturas?",
    "Resumo da prova de Modelagem de Software",
    "Melhores práticas de SOLID"
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || aiMessage;
    if (!text.trim()) return;

    setConversation(prev => [...prev, { role: 'user', text }]);
    setAiMessage('');
    setIsAiThinking(true);

    setTimeout(() => {
      let response = 'Interessante! Recomendo revisar os módulos do capítulo 3 para aprofundar esse conceito. Deseja que eu elabore um mapa de estudos?';
      
      const normalizedText = text.toLowerCase();
      if (normalizedText.includes('solid')) {
        response = '**Princípios S.O.L.I.D. no Athenas:**\n1. *Single Responsibility*: Uma classe deve ter apenas um motivo para mudar.\n2. *Open/Closed*: Entidades de software devem estar abertas para extensão, mas fechadas para modificação.\n3. *Liskov Substitution*: Subtipos devem ser substituíveis por seus tipos de base.\n4. *Interface Segregation*: Muitas interfaces específicas são melhores que uma geral.\n5. *Dependency Inversion*: Dependa de abstrações, não de concretizações.';
      } else if (normalizedText.includes('modelagem') || normalizedText.includes('prova')) {
        response = 'Para a prova de **Modelagem de Software** em 24/06, o Prof. Marcos indica:\n- Diagrama de Classes e Casos de Uso (60% do peso);\n- Ciclos de Vida Ágeis [Scrum/XP] (40% do peso).\n\n*Quer que eu crie um simulado com 3 questões hoje à noite?*';
      } else if (normalizedText.includes('limite') || normalizedText.includes('fatura') || normalizedText.includes('gpa')) {
        response = 'O seu **I.R.A. (Índice de Rendimento Acadêmico)** atual é **8.4**. Para manter seu status de alta performance e elegibilidade para bolsas de iniciação científica, mantenha suas notas acima de 7.5.';
      }

      setConversation(prev => [...prev, { role: 'athenas', text: response }]);
      setIsAiThinking(false);
    }, 900);
  };

  // Calculate student metrics
  const approvedCount = grades.filter(g => g.grade >= 7).length;
  const GPA = (grades.reduce((acc, curr) => acc + curr.grade, 0) / grades.length).toFixed(1);

  const renderStudentAnalytics = () => {
    if (loadingAnalytics) {
      return (
        <TabLoadingSkeleton
          title="Minhas Métricas de Estudo"
          subtitle="Processando estatísticas individuais, tempos de interação e simulados em tempo real..."
        />
      );
    }

    if (!analyticsData || !analyticsData.hasActivity) {
      return (
        <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn pb-12">
          <div className="border-b border-neutral-900 pb-4">
            <h2 className="text-xl font-bold text-neutral-100 font-display">Minhas Métricas de Estudo</h2>
            <p className="text-neutral-500 text-xs mt-1">Sua análise individual de desempenho, consistência e tempo de foco.</p>
          </div>
          <div className="p-8 rounded-3xl bg-neutral-900/10 border border-neutral-900 text-center space-y-4 max-w-xl mx-auto py-12">
            <TrendingUp className="w-10 h-10 text-neutral-600 mx-auto animate-pulse" />
            <h4 className="text-base font-bold text-neutral-200">Ainda não há dados suficientes de estudos</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Nenhum dado de estudo real foi registrado no banco de dados para a sua conta ainda. 
              Suas métricas de desempenho (tempo de estudo por mês, semana, dia, horários de pico, frequência e hábitos) 
              começarão a ser calculadas e exibidas aqui em tempo real conforme você estudar utilizando o **WSM Athenas (Chat AI)** 
              ou responder aos **Simulados** da plataforma!
            </p>
          </div>
        </div>
      );
    }

    // Prepare Custom Tooltips for Recharts
    const ScoreTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const val = payload[0].value;
        return (
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-[11px] shadow-2xl">
            <p className="text-neutral-400 font-bold mb-1 uppercase tracking-wider">{payload[0].payload.name || 'Simulado'}</p>
            <p className="text-emerald-400 font-black">Nota: <span className="text-neutral-100">{val}</span></p>
          </div>
        );
      }
      return null;
    };

    const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const val = payload[0].value;
        const hrsVal = Math.floor(val / 60);
        const minsVal = val % 60;
        const textVal = hrsVal > 0 ? `${hrsVal}h ${minsVal}min` : `${minsVal}min`;
        return (
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-[11px] shadow-2xl">
            <p className="text-neutral-400 font-bold mb-1 uppercase tracking-wider">{payload[0].payload.name || 'Registro'}</p>
            <p className="text-emerald-400 font-black">Tempo: <span className="text-neutral-100">{textVal}</span></p>
          </div>
        );
      }
      return null;
    };

    return (
      <div className="max-w-4xl mx-auto w-full space-y-10 animate-fadeIn pb-12">
        <div className="border-b border-neutral-900 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-100 font-display">Minhas Métricas de Estudo</h2>
            <p className="text-neutral-500 text-xs mt-1">Análise individual de desempenho, consistência e hábitos de aprendizagem.</p>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-850 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 font-mono text-[11px] shrink-0 self-start sm:self-auto">
            <Clock className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-neutral-500 block uppercase font-bold tracking-wider text-[9px]">Tempo Total Estimado</span>
              <span className="font-extrabold text-neutral-250 text-xs">{analyticsData.totalTimeText}</span>
            </div>
          </div>
        </div>

        {/* Real-time Presence Metrics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/5 to-blue-500/0 border border-blue-500/10 shadow-[0_4px_20px_rgba(59,130,246,0.02)] flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-450 uppercase block font-bold tracking-wider">Tempo com a Plataforma Aberta</span>
              <span className="text-xl font-extrabold text-neutral-100 font-display mt-1 block">
                {analyticsData.openTimeText || "0s"}
              </span>
              <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                Tempo total acumulado com o Athenas aberto em seu navegador nesta sessão e anteriores.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/0 border border-emerald-500/10 shadow-[0_4px_20px_rgba(16,185,129,0.02)] flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-450 uppercase block font-bold tracking-wider">Tempo Ativo de Interação Real</span>
              <span className="text-xl font-extrabold text-emerald-400 font-display mt-1 block">
                {analyticsData.activeTimeText || "0s"}
              </span>
              <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                Tempo total de engajamento prático detectado (digitando, clicando, rolando as páginas).
              </p>
            </div>
          </div>
        </div>

        {/* Simulados Performance Section */}
        <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-6">
          <div>
            <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              Desempenho em Simulados
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Suas médias e histórico de envio de simulados avaliativos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-1">Simulados Feitos</span>
                <span className="text-2xl font-black text-neutral-100 font-display">{analyticsData.simuladosCount}</span>
              </div>
              <ClipboardList className="w-8 h-8 text-neutral-800" />
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-1">Média das Notas</span>
                <span className="text-2xl font-black text-emerald-400 font-display">{analyticsData.avgScore}</span>
              </div>
              <TrendingUp className="w-8 h-8 text-neutral-800" />
            </div>
          </div>

          {analyticsData.examHistory && analyticsData.examHistory.length > 0 && (
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 mt-4">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-4">Evolução das Notas</span>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.examHistory} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#525252" fontSize={9} tickLine={false} axisLine={false} domain={[0, 10]} />
                    <Tooltip content={<ScoreTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* 1. SEAMLESS TIME BLOCKS SECTION (Tempo total/mês, semana, dia, horários) */}
        <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-6">
          <div>
            <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Tempo total e Distribuição dos seus Estudos
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Tempo deduzido ativamente com base em interações com o tutor inteligente e a conclusão de simulados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tempo total/mês */}
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-2">
                  Tempo total / Mês
                </span>
                <div className="space-y-1">
                  {analyticsData.meses.length === 0 ? (
                    <span className="text-neutral-550 text-xs italic font-mono block text-center py-2 text-neutral-600">
                      Sem registros
                    </span>
                  ) : (
                    analyticsData.meses.map((m: any) => {
                      const hrsVal = Math.floor(m.tempo / 60);
                      const minsVal = m.tempo % 60;
                      const textVal = hrsVal > 0 ? `${hrsVal}h ${minsVal}min` : `${minsVal}min`;
                      return (
                        <div key={m.name} className="flex justify-between items-center text-xs font-mono">
                          <span className="text-neutral-450">{m.name}:</span>
                          <span className="font-bold text-neutral-200">{textVal}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Tempo total/semana */}
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-2">
                  Tempo total / Semana
                </span>
                <div className="space-y-1">
                  {analyticsData.semanas.filter((s: any) => s.tempo > 0).length === 0 ? (
                    <span className="text-neutral-550 text-xs italic font-mono block text-center py-2 text-neutral-600">
                      Sem registros
                    </span>
                  ) : (
                    analyticsData.semanas.map((s: any) => {
                      const hrsVal = Math.floor(s.tempo / 60);
                      const minsVal = s.tempo % 60;
                      const textVal = hrsVal > 0 ? `${hrsVal}h ${minsVal}min` : `${minsVal}min`;
                      return (
                        <div key={s.name} className="flex justify-between items-center text-xs font-mono">
                          <span className="text-neutral-450">{s.name}:</span>
                          <span className="font-bold text-neutral-200">{textVal}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Tempo total/dia */}
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-2">
                  Tempo total / Dia
                </span>
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                  {analyticsData.dias.filter((d: any) => d.tempo > 0).length === 0 ? (
                    <span className="text-neutral-550 text-xs italic font-mono block text-center py-2 text-neutral-600">
                      Sem registros
                    </span>
                  ) : (
                    analyticsData.dias.map((d: any) => {
                      const hrsVal = Math.floor(d.tempo / 60);
                      const minsVal = d.tempo % 60;
                      const textVal = hrsVal > 0 ? `${hrsVal}h ${minsVal}min` : `${minsVal}min`;
                      return (
                        <div key={d.name} className="flex justify-between items-center text-xs font-mono">
                          <span className="text-neutral-450">{d.name}:</span>
                          <span className="font-bold text-neutral-250">{textVal}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Horários que mais estuda */}
            <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-bold mb-2">
                  Horários que mais estuda
                </span>
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                  {analyticsData.horarios.filter((h: any) => h.tempo > 0).length === 0 ? (
                    <span className="text-neutral-550 text-xs italic font-mono block text-center py-2 text-neutral-600">
                      Sem registros
                    </span>
                  ) : (
                    analyticsData.horarios.map((h: any) => {
                      const hrsVal = Math.floor(h.tempo / 60);
                      const minsVal = h.tempo % 60;
                      const textVal = hrsVal > 0 ? `${hrsVal}h ${minsVal}min` : `${minsVal}min`;
                      return (
                        <div key={h.name} className="flex justify-between items-center text-xs font-mono">
                          <span className="text-neutral-450">{h.name}:</span>
                          <span className="font-bold text-neutral-250">{textVal}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Chart Overlay Tabs */}
          <div className="bg-neutral-950/50 border border-neutral-900 rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-900/40">
              <span className="text-[10.5px] uppercase font-mono tracking-widest text-neutral-500 font-bold block">
                Visualização Gráfica do seu Tempo de Estudo
              </span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono">
                {(['mensal', 'semanal', 'diario', 'horarios'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAnalyticsChartTab(tab)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl border cursor-pointer transition-all ${
                      analyticsChartTab === tab
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-black shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                        : 'bg-transparent border-transparent text-neutral-550 hover:text-neutral-300 hover:bg-neutral-900/20'
                    }`}
                  >
                    {tab === 'mensal' ? 'Mensal' : tab === 'semanal' ? 'Semanal' : tab === 'diario' ? 'Por Dia' : 'Faixa Horária'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {analyticsChartTab === 'semanal' ? (
                  <AreaChart data={analyticsData.semanas} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentColorTempo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#171717" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={10} fontStyle="italic" dy={8} />
                    <YAxis stroke="#525252" fontSize={10} unit=" min" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="tempo" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#studentColorTempo)" />
                  </AreaChart>
                ) : analyticsChartTab === 'mensal' ? (
                  <AreaChart data={analyticsData.meses} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentColorTempoMensal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#171717" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={10} fontStyle="italic" dy={8} />
                    <YAxis stroke="#525252" fontSize={10} unit=" min" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="tempo" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#studentColorTempoMensal)" />
                  </AreaChart>
                ) : analyticsChartTab === 'diario' ? (
                  <BarChart data={analyticsData.dias} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="#171717" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={10} fontStyle="italic" dy={8} />
                    <YAxis stroke="#525252" fontSize={10} unit=" min" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tempo" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={32} />
                  </BarChart>
                ) : (
                  <BarChart data={analyticsData.horarios} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="#171717" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" fontSize={10} fontStyle="italic" dy={8} />
                    <YAxis stroke="#525252" fontSize={10} unit=" min" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tempo" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={32} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 2. INDICADORES DE FREQUÊNCIA E CONSISTÊNCIA */}
          <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Indicadores de Frequência e Consistência
                </h3>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Métricas de aderência, regularidade e consistência dos seus acessos.
                </p>
              </div>

              <div className="space-y-4">
                {/* Dia da semana mais ativo */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-550 uppercase block font-bold tracking-wider mb-1">Dia da semana mais ativo</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.mostActiveDay}</p>
                  </div>
                </div>

                {/* Hora do dia preferida */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider mb-1">Hora do dia preferida</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.preferredTimeOfDay}</p>
                  </div>
                </div>

                {/* Duração média de sessão */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider mb-1">Duração média de sessão</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.avgSessionDuration}</p>
                  </div>
                </div>

                {/* Frequência de acesso/semana */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider mb-1">Frequência de acesso / semana</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.weeklyFrequency} dias por semana</p>
                  </div>
                </div>

                {/* Consistência */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider mb-1">Consistência de Acesso</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.consistency}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FOCO DE CHATS E PREFERÊNCIA DE ESTUDOS */}
          <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-emerald-400" />
                  Foco de Chats & Preferência de Estudos
                </h3>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Distribuição de tópicos de conversação, metodologia de estudo e progresso semanal.
                </p>
              </div>

              <div className="space-y-4">
                {/* Chat geral vs Chat prova */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider mb-1">Canal de Chat mais Utilizado</span>
                    <p className="text-neutral-200 text-xs font-medium leading-relaxed">{analyticsData.chatGeneralVsExam}</p>
                  </div>
                </div>

                {/* Estudos distribuídos vs concentrados */}
                <div className="p-4 rounded-2xl bg-[#0a0d0a]/60 border border-emerald-500/10 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mt-0.5 border border-emerald-500/15 font-mono shrink-0">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-emerald-450 uppercase block font-bold tracking-wider mb-1">Metodologia Dominante</span>
                    <p className="text-neutral-200 text-xs font-semibold leading-relaxed">{analyticsData.studyType}</p>
                  </div>
                </div>

                {/* Progresso semana a semana */}
                <div className="p-4 rounded-2xl bg-neutral-950/45 border border-neutral-900 space-y-3.5">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-555 uppercase block font-bold tracking-wider">Progresso Semana a Semana</span>
                    <p className="text-neutral-500 text-[10px] mt-0.5">Seu crescimento de minutos dedicados nas últimas 4 semanas.</p>
                  </div>

                  <div className="space-y-2.5">
                    {analyticsData.progressWeekToWeek.map((p: any, idx: number) => {
                      const maxVal = Math.max(...analyticsData.progressWeekToWeek.map((x: any) => x.tempo), 60);
                      const pct = Math.max(5, Math.min(100, (p.tempo / maxVal) * 100));
                      const isLast = idx === analyticsData.progressWeekToWeek.length - 1;
                      const hrsW = Math.floor(p.tempo / 60);
                      const minsW = p.tempo % 60;
                      const textW = hrsW > 0 ? `${hrsW}h ${minsW}min` : `${minsW}min`;
                      
                      return (
                        <div key={p.name} className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-mono">
                            <span className={isLast ? 'text-emerald-400 font-extrabold' : 'text-neutral-450'}>
                              {p.name} {isLast ? '(Atual)' : ''}
                            </span>
                            <span className={isLast ? 'text-emerald-300 font-black' : 'text-neutral-350 font-semibold'}>
                              {textW}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-neutral-950 border border-neutral-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isLast ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-neutral-800'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#040605] text-neutral-200 font-sans flex relative">
      {/* Background elegant overlays */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-10 w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Modern Sidebar for desktop */}
      {!isExamActive && (
        <aside 
          id="dashboard-sidebar" 
          data-collapsed={isSidebarCollapsed}
          className={`${
            isSidebarCollapsed ? 'w-24 px-2.5 py-6' : 'w-64 p-6'
          } h-full border-r border-emerald-950/20 bg-neutral-950/60 hidden md:flex flex-col shrink-0 justify-between z-30 overflow-y-auto scrollbar-none transition-all duration-300`}
        >
        <div className="space-y-8">
          <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between gap-2 animate-fadeIn'}`}>
            <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center' : 'items-center'} gap-3`}>
              <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 max-w-none object-contain select-none"
                />
              </div>
              {!isSidebarCollapsed && (
                <div className="animate-fadeIn">
                  <h1 className="text-base font-bold text-neutral-100 font-display">Athenas</h1>
                  <span className="text-[9px] text-emerald-400 font-mono tracking-wider uppercase font-semibold">Portal do Aluno</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg border border-neutral-850 bg-neutral-900/50 text-neutral-450 hover:text-emerald-400 hover:border-emerald-500/25 transition-all cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="space-y-1.5">
            {!isSidebarCollapsed ? (
              <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono font-bold pl-2 mb-2 animate-fadeIn">Menu Principal</p>
            ) : (
              <div className="border-b border-emerald-950/25 my-3 mx-2" />
            )}
            
            {/* Athenas AI Tab (1st place with green border emphasis) */}
            <button
              id="student-tab-chat"
              onClick={() => {
                if (isExamActive) {
                  alert("⚠️ PROVA EM ANDAMENTO!\n\nVocê está realizando um simulado. Para navegar pelo site, você deve primeiro concluir e enviar a sua prova utilizando o botão 'Finalizar e Entregar Prova'.");
                  return;
                }
                setStudyExamTheme(undefined);
                setStudyExamContent(undefined);
                setActiveTab('wsm_athenas');
              }}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'wsm_athenas'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/60 font-bold shadow-[0_0_14px_rgba(16,185,129,0.12)]'
                  : 'bg-emerald-500/[0.04] text-neutral-300 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/70 hover:text-white shadow-[0_0_10px_rgba(16,185,129,0.04)]'
              }`}
            >
              <div className={`${isSidebarCollapsed ? 'flex flex-col items-center gap-1' : 'flex items-center gap-3'}`}>
                <div className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center shrink-0 overflow-hidden relative`}>
                  <img
                    src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                    alt="Mascote"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 max-w-none object-contain select-none opacity-90"
                  />
                  {isSidebarCollapsed && (
                    <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse border border-neutral-950" />
                  )}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full text-center' : 'truncate'}>
                  Athenas AI
                </span>
              </div>
              {!isSidebarCollapsed && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse" />
              )}
            </button>

            <button
              id="student-tab-inicio"
              onClick={() => handleTabClick('inicio')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'inicio'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <Home className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
              <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Início</span>
            </button>

            {/* Mural de Avisos Tab */}
            <button
              id="student-tab-mural"
              onClick={() => handleTabClick('mural')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'mural'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <Megaphone className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Mural</span>
              </div>
              {dbAnnouncements.length > 0 && activeTab !== 'mural' && (
                <span className="min-w-[18px] h-[18px] px-1 bg-amber-500 text-neutral-950 text-[10px] font-black rounded-full flex items-center justify-center border border-neutral-950 font-mono leading-none">
                  {dbAnnouncements.length}
                </span>
              )}
            </button>

            {/* Calendário Tab */}
            <button
              id="student-tab-calendario"
              onClick={() => handleTabClick('calendario')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'calendario'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <Calendar className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
              <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Calendário</span>
            </button>

            {/* Conversas Tab */}
            <button
              id="student-tab-conversas"
              onClick={() => handleTabClick('conversas')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'conversas'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <MessageSquare className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && unreadChatCount > 0 && activeTab !== 'conversas' && (
                    <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-neutral-950 shadow-lg shadow-emerald-500/40 z-20 animate-pulse font-mono leading-none">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Conversas</span>
              </div>
              {!isSidebarCollapsed && unreadChatCount > 0 && activeTab !== 'conversas' && (
                <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-neutral-950 shadow-md shadow-emerald-500/30 animate-pulse font-mono leading-none">
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>

            {/* Caderno de Biologia Tab */}
            <button
              id="student-tab-caderno"
              onClick={() => handleTabClick('caderno')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'caderno'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <BookOpen className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
              <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Caderno</span>
            </button>

            {/* NEW Simulados Tab */}
            <button
              id="student-tab-simulados"
              onClick={() => handleTabClick('simulados')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'simulados'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <ClipboardList className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
              <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Simulados</span>
            </button>

            {/* Ouvir música ambiente Tab */}
            <button
              id="student-tab-musica"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-study-music-player'));
              }}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200`}
            >
              <Headphones className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
              <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Ouvir música ambiente</span>
            </button>
          </div>
        </div>

        {/* Music Player Mini Card in Sidebar (above footer) */}
        <div id="sidebar-music-slot" data-collapsed={isSidebarCollapsed} className="w-full mt-auto mb-3 empty:hidden transition-all duration-300"></div>

        <div className="border-t border-neutral-900 pt-5 space-y-3">
          {!isSidebarCollapsed ? (
            <div className="animate-fadeIn space-y-3">
              <div className="pl-2">
                <p className="text-neutral-300 text-[11px] font-semibold truncate max-w-[195px]">{profile ? profile.nome_completo : email}</p>
                <p className="text-neutral-550 text-[9px] font-mono">RA: {getUniqueRA(email)} • {profile ? profile.turma : ''}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setActiveSettingsTab('profile');
                    setGmailStatus(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-850 hover:text-emerald-400 border border-neutral-850 hover:border-emerald-500/25 rounded-xl transition-all text-[11px] font-semibold cursor-pointer"
                  title="Configurar Perfil"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-450 animate-spin-slow" />
                  <span>Ajustes</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-red-950/20 hover:text-red-400 border border-neutral-850 hover:border-red-950/35 rounded-xl transition-all text-[11px] font-semibold cursor-pointer"
                  title="Sair do Portal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex justify-center" title={profile ? profile.nome_completo : email}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center font-bold font-display text-[11px] text-emerald-400 uppercase">
                  {(profile ? profile.nome_completo : email).substring(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full px-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setActiveSettingsTab('profile');
                    setGmailStatus(null);
                  }}
                  className="w-full flex justify-center p-2.5 bg-neutral-900 hover:bg-neutral-850 hover:text-emerald-400 border border-neutral-850 rounded-xl transition-all cursor-pointer"
                  title="Configurações"
                >
                  <Settings className="w-4 h-4 text-emerald-450" />
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex justify-center p-2.5 bg-neutral-900 hover:bg-red-950/20 hover:text-red-400 border border-neutral-850 hover:border-red-950/35 rounded-xl transition-all cursor-pointer"
                  title="Sair do Portal"
                >
                  <LogOut className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
      )}

      {/* Main View Area */}
      <div className={`flex-1 h-full overflow-y-auto flex flex-col ${
        isExamActive 
          ? 'p-2 sm:p-4 max-w-none' 
          : activeTab === 'wsm_athenas'
            ? 'p-2 md:p-4 max-w-none relative z-50'
            : 'p-4 md:p-8 max-w-7xl'
      } w-full ${activeTab === 'wsm_athenas' ? 'relative z-50' : 'z-10'}`}>
        
        {localStorage.getItem('wsm_sys_maintenance_mode') === 'true' && (
          <div className="mb-6 p-4 rounded-3xl bg-pink-950/20 border border-pink-500/20 text-xs text-pink-300 flex items-start gap-4 animate-slideDown">
            <div className="p-1 bg-pink-500/10 text-pink-400 rounded-lg font-bold font-mono text-[9px] uppercase tracking-wider shrink-0 mt-0.5">Aviso Mestre</div>
            <div>
              <p className="font-bold text-neutral-100 text-xs">Alerta de Janela de Manutenção Técnica</p>
              <p className="text-[11px] text-pink-405 mt-1 leading-relaxed">Nossos servidores estão sob otimização programada pela Administração Geral. O acesso ao Athenas AI Chatbot e Simulados online poderá registrar instabilidades breves.</p>
            </div>
          </div>
        )}

        {/* Navigation header (responsive) & Welcome Area Combined */}
        {!isExamActive && (
        <header className={
          activeTab === 'inicio' 
            ? "shrink-0 p-6 sm:p-8 rounded-3xl bg-neutral-950/40 border border-neutral-900/80 backdrop-blur-md relative mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 min-h-fit overflow-visible"
            : "shrink-0 flex flex-col md:hidden items-start gap-4 pb-4 mb-6 border-b border-emerald-950/20"
        }>
          {activeTab === 'inicio' && <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />}
          
          {activeTab === 'inicio' ? (
            <div className="flex items-start sm:items-center gap-4 animate-fadeIn relative z-10 w-full xl:w-auto min-h-fit">
              <div className="p-3 md:hidden bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shrink-0 mt-1 sm:mt-0">
                <GraduationCap className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl md:text-2xl font-black text-neutral-100 font-display tracking-tight">Athenas</h1>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold">Portal do Aluno</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent tracking-tight mb-2">
                  Olá, {profile ? profile.nome_completo : email}!
                </h2>
                <p className="text-neutral-400 text-xs leading-relaxed max-w-2xl mb-3">
                  Bem-vindo de volta ao Athenas. Aqui no seu painel principal, você acompanha os lembretes de avaliações físicas e os professores conectados à sua sala.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-neutral-500">
                  <span className="bg-neutral-900/50 px-2.5 py-1 rounded-md border border-neutral-800 flex items-center gap-1.5">
                    Turma Ativa: <strong className="text-emerald-300 font-bold">{activeTurma || profile?.turma || 'Sem turma'}</strong>
                    {activeTurma && profile?.turma && activeTurma !== profile.turma && (
                      <span className="text-[9px] text-teal-400 bg-teal-950/40 px-1 rounded border border-teal-500/20">Virtual</span>
                    )}
                  </span>
                  <span className="bg-neutral-900/50 px-2.5 py-1 rounded-md border border-neutral-800">
                    Nº de chamada na Turma: <strong className="text-emerald-400">{(profile?.numero_chamada !== undefined && profile?.numero_chamada !== null) ? profile.numero_chamada : (activeChamada ?? '-')}</strong>
                  </span>
                  {allEnrolledClasses.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-emerald-950/30 px-2.5 py-1 rounded-md border border-emerald-500/30">
                      <span className="text-emerald-400 font-bold text-[10px]">Trocar Turma:</span>
                      <select
                        value={activeTurma || profile?.turma || ''}
                        onChange={(e) => handleSelectActiveTurma(e.target.value)}
                        className="bg-neutral-900 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 outline-none cursor-pointer"
                      >
                        {allEnrolledClasses.map(c => (
                          <option key={c} value={c}>
                            {c} {c === profile?.turma ? '(Oficial)' : '(Virtual)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-fadeIn">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <GraduationCap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-100 font-display tracking-tight">Athenas</h1>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase">Portal do Aluno</span>
              </div>
            </div>
          )}

          {/* Quick tab switcher on mobile only */}
          <div className={`flex md:hidden flex-wrap items-center gap-2 w-full font-mono relative z-10 ${activeTab === 'inicio' ? 'xl:w-auto mt-2 xl:mt-0' : ''}`}>
            <button
              onClick={() => handleTabClick('inicio')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                activeTab === 'inicio' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span>Início</span>
            </button>
            <button
              onClick={() => handleTabClick('mural')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                activeTab === 'mural' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mural</span>
            </button>
            <button
              onClick={() => handleTabClick('calendario')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                activeTab === 'calendario' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Calendário</span>
            </button>
            <button
              onClick={() => handleTabClick('conversas')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                activeTab === 'conversas' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conversas</span>
            </button>

            {/* Mobile Caderno 3D Button */}
            <button
              onClick={() => handleTabClick('caderno')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                activeTab === 'caderno' 
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Caderno</span>
            </button>
            
            {/* Mobile Simulados Button */}
            <button
              onClick={() => handleTabClick('simulados')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                activeTab === 'simulados' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulados</span>
            </button>


            <button
              onClick={() => {
                if (isExamActive) {
                  alert("⚠️ PROVA EM ANDAMENTO!\n\nVocê está realizando um simulado. Para navegar pelo site, você deve primeiro concluir e enviar a sua prova utilizando o botão 'Finalizar e Entregar Prova'.");
                  return;
                }
                setStudyExamTheme(undefined);
                setStudyExamContent(undefined);
                setActiveTab('wsm_athenas');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                activeTab === 'wsm_athenas' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                  alt="Mascote"
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 max-w-none object-contain select-none"
                />
              </div>
              <span>Chat AI</span>
            </button>
            
            {/* Browser Push Notification Compact Header Badge */}
            <BrowserNotificationPrompt userRole="student" compact />

            <button
              onClick={onLogout}
              className="p-2 bg-neutral-900 text-neutral-450 hover:text-red-400 rounded-xl transition-all border border-neutral-850 cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
        )}

        {/* Browser Push Notification Prompt Banner if not granted */}
        {activeTab !== 'wsm_athenas' && (
          <div className="mb-4">
            <BrowserNotificationPrompt userRole="student" />
          </div>
        )}

        {isTabTransitioning ? (
          <TabLoadingSkeleton
            title={`Carregando ${
              activeTab === 'mural'
                ? 'Mural de Avisos & Comunicados'
                : activeTab === 'conversas'
                ? 'Conversas da Turma'
                : activeTab === 'wsm_athenas'
                ? 'WSM Athenas AI Chatbot'
                : activeTab === 'simulados'
                ? 'Simulados & Avaliações'
                : activeTab === 'desempenho'
                ? 'Métricas de Desempenho'
                : 'Painel do Estudante'
            }...`}
            subtitle="Sincronizando registros do sistema e dados em tempo real..."
          />
        ) : activeTab === 'mural' ? (
          <StudentAnnouncements
            studentEmail={email}
            studentName={profile?.nome_completo || 'Aluno'}
            studentTurma={activeTurma || profile?.turma || ''}
            teachers={teachers}
          />
        ) : activeTab === 'conversas' ? (
          <ClassChat
            currentUserEmail={email}
            currentUserName={profile?.nome_completo || 'Aluno'}
            currentUserRole="student"
            userTurma={activeTurma || profile?.turma || ''}
          />
        ) : activeTab === 'caderno' ? (
          <VirtualNotebook
            userRole="student"
            userEmail={email}
            userName={profile?.nome_completo || 'Aluno'}
            userTurma={activeTurma || profile?.turma || ''}
            userEscola={profile?.escola}
            onUnsavedChangesChange={setHasUnsavedNotebook}
          />
        ) : activeTab === 'wsm_athenas' ? (
          <WsmChat 
            userEmail={email} 
            userRole="student" 
            studyExamTheme={studyExamTheme}
            studyExamContent={studyExamContent}
            onClearStudyTheme={() => {
              setStudyExamTheme(undefined);
              setStudyExamContent(undefined);
            }}
          />
        ) : activeTab === 'calendario' ? (
          <AcademicCalendar
            userRole="student"
            userEmail={email}
            userName={profile?.nome_completo || 'Aluno'}
            exams={exams}
            mockExams={mockExams}
            onStudyForExam={(title, content) => {
              setStudyExamTheme(title);
              setStudyExamContent(content);
              setActiveTab('wsm_athenas');
            }}
            onTakeMockExam={() => {
              setActiveTab('simulados');
            }}
          />
        ) : activeTab === 'simulados' ? (
          <StudentSimulados
            email={email}
            studentName={profile?.nome_completo || 'Aluno'}
            studentClass={activeTurma || profile?.turma || ''}
            initialExams={mockExams}
            onExamActiveChange={setIsExamActive}
            onStudyForExam={(theme, content) => {
              setStudyExamTheme(theme);
              setStudyExamContent(content);
              setActiveTab('wsm_athenas');
            }}
          />
        ) : (
          /* Main Dashboard Content Layout (Início) */
          <div className="max-w-4xl mx-auto w-full space-y-10 animate-fadeIn pb-12">
            
            {/* CARDS VERMELHOS DE NOTIFICAÇÕES (Simulados, Provas e Avisos Pendentes) */}
            {(() => {
              // Pending simulados (assigned to student, not submitted yet, and deadline not passed)
              const pendingMockExams = mockExams.filter(mock => {
                const hasSubmitted = studentSubmissions.some(s => s.mock_exam_id === mock.id && !s.telemetry?.is_unfinished);
                const isDeadlinePassed = mock.deadline ? new Date(mock.deadline).getTime() < new Date().getTime() : false;
                return !hasSubmitted && !isDeadlinePassed;
              });

              // Upcoming physical exams
              const upcomingExamsList = exams.filter(ex => {
                if (!ex.exam_date) return false;
                const dateObj = ex.exam_date.includes('T') ? new Date(ex.exam_date) : new Date(`${ex.exam_date}T23:59:59`);
                return dateObj.getTime() >= new Date().getTime();
              });

              // Unread system notifications
              const unreadNotifs = notifications.filter(n => !n.is_read);

              const totalPending = pendingMockExams.length + upcomingExamsList.length + unreadNotifs.length + dbAnnouncements.length;

              if (totalPending === 0) return null;

              return (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-l-4 border-red-500 pl-3.5 py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 animate-pulse">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-neutral-100 font-display uppercase tracking-wider flex items-center gap-2">
                          Alertas e Notificações Importantes
                        </h3>
                        <p className="text-xs text-red-300/80 font-mono">
                          Você possui <strong className="text-red-400 underline">{totalPending}</strong> pendência(s) ativa(s) precisando da sua atenção
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-3 py-1 rounded-full font-mono font-extrabold uppercase tracking-widest animate-pulse">
                      🚨 NOTIFICAÇÕES
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Avisos do Mural Publicados pelos Professores */}
                    {dbAnnouncements.map((ann) => (
                      <motion.div
                        key={`notif-ann-${ann.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/50 via-neutral-950/90 to-neutral-950/90 border border-amber-500/40 hover:border-amber-500/70 transition-all shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between space-y-4 group"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

                        <div className="space-y-3 relative z-10">
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-black bg-amber-500/20 border border-amber-500/40 text-amber-300 uppercase tracking-wider animate-pulse">
                              <Megaphone className="w-3 h-3 text-amber-400" />
                              📢 {ann.category === 'urgente' ? '🚨 Aviso Urgente' : ann.category === 'prova' ? '📝 Prova / Conteúdo' : ann.category === 'evento' ? '🎉 Evento Escolar' : 'Aviso do Professor'}
                            </span>
                            <span className="text-[10px] text-amber-300/90 font-mono font-bold bg-neutral-950/80 px-2 py-0.5 rounded border border-amber-900/40">
                              {ann.class_name ? formatTargetDisplayName(ann.class_name, virtualClasses) : 'Geral'}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-amber-200 transition-colors leading-snug">
                              {ann.title}
                            </h4>
                            <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed whitespace-pre-wrap line-clamp-3">
                              {ann.message || ann.content}
                            </p>
                          </div>

                          {ann.image_url && (
                            <div className="rounded-xl overflow-hidden border border-neutral-800/80 max-h-36">
                              <img
                                src={ann.image_url}
                                alt="Anexo"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-amber-900/30 gap-2">
                            <span className="flex items-center gap-1 text-amber-300/80 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              {new Date(ann.created_at).toLocaleDateString('pt-BR')} {new Date(ann.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              Prof(a):{' '}
                              <strong className={ann.is_teacher_removed ? 'text-neutral-400 italic' : 'text-neutral-200'}>
                                {ann.teacher_name || 'Docente'}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveTab('mural')}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-98 text-neutral-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-amber-400/50 relative z-10"
                        >
                          <Megaphone className="w-4 h-4" />
                          <span>Ver no Mural de Avisos</span>
                        </button>
                      </motion.div>
                    ))}

                    {/* Pending Simulados (Cards Vermelhos) */}
                    {pendingMockExams.map((mock) => (
                      <motion.div
                        key={`notif-sim-${mock.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 rounded-2xl bg-gradient-to-br from-red-950/60 via-red-900/30 to-neutral-950/90 border border-red-500/50 hover:border-red-500/80 transition-all shadow-xl shadow-red-950/30 relative overflow-hidden flex flex-col justify-between space-y-4 group"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-red-500/20 transition-all" />
                        
                        <div className="space-y-3 relative z-10">
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-black bg-red-500/20 border border-red-500/40 text-red-300 uppercase tracking-wider animate-pulse">
                              <AlertCircle className="w-3 h-3 text-red-400" />
                              🚨 Novo Simulado Disponível
                            </span>
                            <span className="text-[10px] text-red-300/80 font-mono font-bold bg-neutral-950/80 px-2 py-0.5 rounded border border-red-900/40">
                              {mock.subject || 'Biologia'}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-red-200 transition-colors leading-snug">
                              {mock.title}
                            </h4>
                            {(() => {
                              const { cleanDescription } = parseExamSettings(mock.description || '');
                              if (cleanDescription) {
                                return (
                                  <p className="text-xs text-neutral-300 mt-1.5 line-clamp-2 leading-relaxed font-normal">
                                    <strong className="text-red-300 font-bold">Conteúdo:</strong> {cleanDescription}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-red-900/40 gap-2">
                            <span className="flex items-center gap-1 text-red-300 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              Prazo: {mock.deadline ? new Date(mock.deadline).toLocaleString('pt-BR') : 'Sem prazo'}
                            </span>
                            {mock.class_name && (
                              <span className="text-[10px] bg-red-950/90 px-2 py-0.5 rounded border border-red-900/60 text-red-300 font-bold">
                                Turma: {formatTargetDisplayName(mock.class_name, virtualClasses)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 relative z-10">
                          <button
                            onClick={() => setActiveTab('simulados')}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-500 active:scale-98 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-red-400/40"
                          >
                            <ClipboardList className="w-4 h-4" />
                            <span>Responder Simulado Agora</span>
                          </button>

                          <button
                            onClick={() => {
                              const { cleanDescription } = parseExamSettings(mock.description || '');
                              setStudyExamTheme(mock.title);
                              setStudyExamContent(cleanDescription || mock.description || 'Assuntos do simulado');
                              setActiveTab('wsm_athenas');
                            }}
                            className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 active:scale-98 text-emerald-300 font-bold rounded-xl text-xs transition-all shadow flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 hover:border-emerald-400"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Estudar Conteúdo com Athenas AI</span>
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    {/* Upcoming Physical Exams (Cards Vermelhos) */}
                    {upcomingExamsList.map((ex) => (
                      <motion.div
                        key={`notif-exam-${ex.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 rounded-2xl bg-gradient-to-br from-red-950/60 via-rose-950/30 to-neutral-950/90 border border-red-500/50 hover:border-red-500/80 transition-all shadow-xl shadow-red-950/30 relative overflow-hidden flex flex-col justify-between space-y-4 group"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-red-500/20 transition-all" />

                        <div className="space-y-3 relative z-10">
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-black bg-rose-500/20 border border-rose-500/40 text-rose-300 uppercase tracking-wider animate-pulse">
                              <Calendar className="w-3 h-3 text-rose-400" />
                              📝 Prova Presencial Marcada
                            </span>
                            <span className="text-[10px] text-rose-300/80 font-mono font-bold bg-neutral-950/80 px-2 py-0.5 rounded border border-rose-900/40">
                              {ex.materia || 'Biologia'}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-rose-200 transition-colors leading-snug">
                              {ex.title}
                            </h4>
                            <p className="text-xs text-neutral-350 mt-1 line-clamp-2">
                              <strong className="text-neutral-200">Conteúdo:</strong> {cleanExamContent(ex.content)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-rose-900/40 gap-2">
                            <span className="flex items-center gap-1.5 text-rose-300 font-bold">
                              <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              Data: {formatExamDateDisplay(ex, ex.exam_time, notifications).fullFormatted}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              Prof: {ex.teacher_name}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setStudyExamTheme(ex.title);
                            setStudyExamContent(cleanExamContent(ex.content));
                            setActiveTab('wsm_athenas');
                          }}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-rose-400/40 relative z-10"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Estudar com Athenas AI</span>
                        </button>
                      </motion.div>
                    ))}

                    {/* Unread System Notifications */}
                    {unreadNotifs.map((n) => (
                      <motion.div
                        key={`notif-unr-${n.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 rounded-2xl bg-gradient-to-br from-red-950/50 via-red-900/20 to-neutral-950/90 border border-red-500/40 hover:border-red-500/70 transition-all shadow-xl relative overflow-hidden flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-black bg-red-500/20 border border-red-500/30 text-red-300 uppercase tracking-wider">
                            <Bell className="w-3 h-3 text-red-400" />
                            📢 Comunicado Geral
                          </span>
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {new Date(n.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-neutral-100">{n.title}</h4>
                          <p className="text-xs text-neutral-300 mt-1 leading-relaxed whitespace-pre-wrap">{cleanNotificationMessage(n.message)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Card de Cadastro de Gmail para Notificações */}
            {profile && !profile.notification_gmail && !isGmailCardDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-neutral-950/40 border border-emerald-500/20 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

                {/* Dismiss Button (X) */}
                <button
                  type="button"
                  onClick={handleDismissGmailCard}
                  className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer z-20"
                  title="Fechar aviso de Gmail"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex gap-4 items-start w-full md:w-2/3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0 mt-1">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-neutral-100 font-display tracking-tight">E-mail de Notificações do Gmail</h3>
                      {profile.notification_gmail ? (
                        <span className="px-2 py-0.5 text-[9px] font-extrabold font-mono rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                          Ativado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-extrabold font-mono rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                          Pendente
                        </span>
                      )}
                    </div>
                    {profile.notification_gmail && !isEditingGmail ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-neutral-400 text-xs">
                          Você está cadastrado para receber avisos de novas provas, trabalhos, avisos e simulados no seguinte Gmail:
                        </p>
                        <p className="text-emerald-400 text-sm font-bold font-mono bg-emerald-950/20 inline-block px-2.5 py-1 rounded-xl border border-emerald-500/10">
                          {profile.notification_gmail}
                        </p>
                      </div>
                    ) : (
                      <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                        Cadastre seu e-mail do <strong>Gmail</strong> para receber avisos de novas provas, trabalhos, avisos no mural e simulados diretamente na sua caixa de entrada, com notificações automáticas enviadas por <span className="text-emerald-400 font-mono text-[11px]">wsmathenas@gmail.com</span>.
                      </p>
                    )}
                  </div>
                </div>

                {(!profile.notification_gmail || isEditingGmail) ? (
                  <form onSubmit={handleSaveGmail} className="w-full md:w-1/3 space-y-3 relative z-10">
                    <div>
                      <input
                        type="email"
                        required
                        placeholder="seu-email@gmail.com"
                        value={notificationGmailInput}
                        onChange={(e) => setNotificationGmailInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-900/90 text-neutral-100 placeholder-neutral-500 rounded-xl border border-neutral-800 text-xs focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      {isEditingGmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingGmail(false);
                            setNotificationGmailInput(profile.notification_gmail || '');
                            setGmailStatus(null);
                          }}
                          className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={savingGmail}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold rounded-xl text-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {savingGmail ? (
                          <span>Salvando...</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>{profile.notification_gmail ? 'Salvar Novo' : 'Ativar E-mail'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {gmailStatus && (
                      <p className={`text-[10px] text-center font-semibold mt-1.5 ${gmailStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gmailStatus.msg}
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="w-full md:w-1/3 flex flex-col items-stretch justify-center relative z-10 space-y-2">
                    <button
                      onClick={() => {
                        setIsEditingGmail(true);
                        setGmailStatus(null);
                      }}
                      className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 hover:border-emerald-500/20 text-neutral-300 font-bold rounded-xl text-xs border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Alterar E-mail</span>
                    </button>
                    {gmailStatus && (
                      <p className="text-[10px] text-center text-emerald-400 font-semibold">
                        {gmailStatus.msg}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Seção de Salas Virtuais do Aluno */}
            <StudentVirtualClasses
              email={email}
              studentName={profile?.nome_completo || 'Aluno'}
              officialTurma={profile?.turma || ''}
              activeTurma={activeTurma || profile?.turma || ''}
              onSelectActiveTurma={handleSelectActiveTurma}
              teachers={teachers}
              onExamActiveChange={setIsExamActive}
            />

            {/* Calendário Acadêmico & Pessoal */}
            <AcademicCalendar
              userRole="student"
              userEmail={email}
              userName={profile?.nome_completo || 'Aluno'}
              exams={exams}
              mockExams={mockExams}
              onStudyForExam={(title, content) => {
                setStudyExamTheme(title);
                setStudyExamContent(content);
                setActiveTab('wsm_athenas');
              }}
              onTakeMockExam={() => {
                setActiveTab('simulados');
              }}
            />

            {/* Provas Marcadas Section (Only Rendered if exams.length > 0) */}
            {exams.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                  <h3 className="text-sm font-extrabold text-neutral-200 tracking-wider uppercase font-mono">
                    Provas Marcadas:
                  </h3>
                  <span className="text-[10px] bg-red-500/15 text-red-450 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                    {exams.length} Ativa(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {exams.map((ex) => (
                    <motion.div
                      key={ex.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 rounded-2xl bg-[#090e0b]/80 border border-emerald-500/15 hover:border-emerald-500/30 transition-all shadow-xl space-y-4 relative flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold font-mono tracking-wider text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-md">
                              {ex.materia || 'Disciplina Geral'}
                            </span>
                            <h4 className="font-extrabold text-[#f3f4f6] text-base mt-2">{ex.title}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {(() => {
                              const dateInfo = formatExamDateDisplay(ex, ex.exam_time, notifications);
                              return (
                                <div className="text-right bg-neutral-900/80 px-3.5 py-2 rounded-xl border border-neutral-800 text-emerald-400 font-mono text-center min-w-[105px]">
                                  <p className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Data da Prova</p>
                                  <p className="text-xs font-black mt-0.5 text-neutral-100">
                                    {dateInfo.dateFormatted}
                                  </p>
                                  {dateInfo.timeFormatted && (
                                    <p className="text-[11px] font-extrabold text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span>às {dateInfo.timeFormatted}</span>
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                            {(() => {
                              const badge = getDaysRemainingText(ex.exam_date);
                              if (!badge) return null;
                              return (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-wider ${badge.className}`}>
                                  {badge.text}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="space-y-1 pt-1.5 border-t border-neutral-900/60 text-xs">
                          <p className="text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">Conteúdo cobrado:</p>
                          <p className="text-[#d1d5db] font-medium leading-relaxed">{cleanExamContent(ex.content)}</p>
                        </div>

                        {cleanExamObservations(ex.observations) && (
                          <div className="p-3 bg-neutral-950/60 rounded-xl text-neutral-400 text-xs italic leading-relaxed border border-neutral-900/50">
                            <span className="block not-italic font-bold text-[10.5px] uppercase tracking-wider text-neutral-500 mb-0.5">Observações do Professor:</span>
                            "{cleanExamObservations(ex.observations)}"
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 font-mono border-t border-neutral-900/40">
                          <span>Docente: <strong className="text-neutral-350">{ex.teacher_name}</strong></span>
                           <span>Agendado em: {new Date(ex.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="pt-3">
                        <button
                          onClick={() => {
                            setStudyExamTheme(ex.title);
                            setStudyExamContent(cleanExamContent(ex.content));
                            setActiveTab('wsm_athenas');
                          }}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs transition-all active:scale-98 flex items-center justify-center gap-2 select-none shadow-md border border-emerald-400/25 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          <span>Estudar para a prova</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Professores Cadastrados Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                <h3 className="text-sm font-extrabold text-neutral-200 tracking-wider uppercase font-mono">
                  Professores do {profile ? profile.turma : ''}
                </h3>
              </div>

              {teachers.length === 0 ? (
                <div className="p-8 text-center bg-neutral-950/20 border border-neutral-900/60 rounded-2xl">
                  <p className="text-neutral-500 text-xs">Nenhum professor cadastrado para o {profile ? profile.turma : ''} até o momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {teachers.map((t: any) => (
                    <div 
                      key={t.id} 
                      className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-950 hover:border-neutral-900 transition-colors flex items-center gap-3.5"
                    >
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 font-extrabold flex items-center justify-center text-sm border border-emerald-500/20 shadow-inner">
                        {t.nome_completo ? t.nome_completo.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-neutral-200 text-xs truncate">{t.nome_completo}</h4>
                        <p className="text-emerald-400 text-[11px] font-semibold mt-0.5 truncate">{t.materia || 'Biologia'}</p>
                        <p className="text-neutral-500 text-[9px] font-mono mt-0.5 truncate">{t.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Minhas Métricas Section (Analytics) */}
            {renderStudentAnalytics()}

          </div>
        )}
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 overflow-hidden relative shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-100 font-display">Ajustes do Aluno</h3>
                  <p className="text-[10px] text-neutral-500 font-mono">Gerenciar seus dados e preferências</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-neutral-450 hover:text-neutral-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-neutral-950/40 border border-neutral-850 hover:border-neutral-800 transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </div>

            {/* Tab Switcher inside Settings */}
            <div className="flex border-b border-neutral-850 mb-5 pb-0.5 gap-4">
              <button
                type="button"
                onClick={() => setActiveSettingsTab('profile')}
                className={`pb-2 text-xs font-bold transition-all relative ${
                  activeSettingsTab === 'profile'
                    ? 'text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Meu Perfil
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('notifications')}
                className={`pb-2 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                  activeSettingsTab === 'notifications'
                    ? 'text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <span>Notificações</span>
                {profile?.notification_gmail && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </button>
            </div>

            {activeSettingsTab === 'profile' && (
              <div className="animate-fadeIn">
                {settingsStatus && (
                  <div className={`mb-4 p-3.5 rounded-xl text-xs border flex items-center justify-between gap-2.5 animate-fadeIn ${
                    settingsStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-medium' 
                      : settingsStatus.type === 'info'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 font-medium shadow-sm shadow-cyan-950/30'
                      : 'bg-red-500/10 border-red-500/25 text-red-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {settingsStatus.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : settingsStatus.type === 'info' ? (
                        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span>{settingsStatus.msg}</span>
                    </div>
                    {settingsStatus.type === 'error' && (
                      <button
                        type="button"
                        onClick={(e) => handleUpdateSettings(e as any)}
                        disabled={savingSettings}
                        className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Tentar Novamente</span>
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={setName}
                      onChange={(e) => setSetName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 font-medium"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Escola / Instituição de Ensino</label>
                    <input
                      type="text"
                      value={setEscola}
                      onChange={(e) => setSetEscola(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 font-medium"
                      placeholder="Nome da sua Escola (Opcional)"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Endereço de E-mail</label>
                    <input
                      type="email"
                      required
                      value={setMail}
                      onChange={(e) => setSetMail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 font-medium"
                      placeholder="Seu e-mail"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Nova Senha (Opcional - deixe em branco para não alterar)</label>
                    <div className="relative">
                      <input
                        type={showPwd ? "text" : "password"}
                        value={setPassword}
                        onChange={(e) => setSetPassword(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-xl pl-3.5 pr-10 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 font-mono"
                        placeholder="Deixe em branco para manter a senha atual"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-emerald-400 transition-colors"
                      >
                        {showPwd ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Número de Chamada</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={setChamada}
                        onChange={(e) => setSetChamada(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/30 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-550 uppercase font-mono tracking-widest mb-1.5 font-bold">Turma (Inalterável)</label>
                      <div className="w-full bg-neutral-950/60 border border-neutral-900 text-neutral-500 rounded-xl px-3.5 py-2 text-xs font-bold font-mono">
                        {profile ? profile.turma : ''}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Tema do Portal</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreference('escuro');
                          setSettingsStatus({ type: 'info', msg: '🌙 Tema Escuro selecionado (padrão do portal).' });
                          setTimeout(() => setSettingsStatus(prev => prev?.type === 'info' ? null : prev), 3500);
                        }}
                        className={`px-3 py-2 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          themePreference === 'escuro'
                            ? 'bg-neutral-950 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-950'
                            : 'bg-transparent border-neutral-850 text-neutral-550 hover:text-neutral-400'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Escuro (Padrão)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsStatus({
                            type: 'info',
                            msg: '☀️ O tema claro está em desenvolvimento e será liberado em breve! Por enquanto, utilize o tema escuro padrão.'
                          });
                          setTimeout(() => setSettingsStatus(prev => prev?.type === 'info' ? null : prev), 5000);
                        }}
                        title="Funcionalidade em desenvolvimento — o tema claro estará disponível em breve!"
                        className="px-3 py-2 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl border transition-all flex items-center justify-center gap-1.5 bg-neutral-950/40 border-neutral-850/70 text-neutral-400 hover:text-amber-300 hover:border-amber-500/30 cursor-pointer group"
                      >
                        <Sun className="w-3.5 h-3.5 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                        <span>Claro</span>
                        <span className="text-[8px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-normal font-sans font-bold">Em breve</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      onClick={() => handleUpdateSettings()}
                      disabled={savingSettings}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl transition-all text-xs shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer"
                    >
                      {savingSettings ? 'Gravando dados...' : 'Salvar Preferências'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeSettingsTab === 'notifications' && (
              <div className="space-y-4 animate-fadeIn text-left">
                <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-850 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-neutral-200">Alertas por E-mail</h4>
                        {profile?.notification_gmail ? (
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold font-mono rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold font-mono rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        Receba avisos de novas provas, trabalhos, recados do mural e simulados diretamente na sua caixa de entrada, enviados por <span className="text-emerald-400 font-mono text-[10px]">wsmathenas@gmail.com</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {profile?.notification_gmail && !isEditingGmail ? (
                  <div className="space-y-3.5 pt-1">
                    <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5">
                      <p className="text-[10px] uppercase font-bold font-mono tracking-wider text-neutral-500">Gmail Cadastrado</p>
                      <p className="text-emerald-400 text-sm font-bold font-mono bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-500/10 select-all">
                        {profile.notification_gmail}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteGmail}
                        disabled={savingGmail}
                        className="flex-1 py-2.5 bg-red-950/20 hover:bg-red-950/30 text-red-400 border border-red-900/15 hover:border-red-900/35 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir E-mail</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingGmail(true);
                          setNotificationGmailInput(profile.notification_gmail || '');
                          setGmailStatus(null);
                        }}
                        disabled={savingGmail}
                        className="flex-1 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 font-bold rounded-xl text-xs border border-neutral-850 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-450" />
                        <span>Alterar E-mail</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveGmail} className="space-y-3 text-left">
                    <div>
                      <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">
                        {profile?.notification_gmail ? 'Novo Endereço do Gmail' : 'Endereço do Gmail para Receber Avisos'}
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="seu-email@gmail.com"
                        value={notificationGmailInput}
                        onChange={(e) => setNotificationGmailInput(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 font-medium"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      {isEditingGmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingGmail(false);
                            setNotificationGmailInput(profile?.notification_gmail || '');
                            setGmailStatus(null);
                          }}
                          className="flex-1 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 font-bold rounded-xl text-xs border border-neutral-850 transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={savingGmail}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold rounded-xl text-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                      >
                        {savingGmail ? (
                          <span>Salvando...</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>{profile?.notification_gmail ? 'Salvar Novo' : 'Ativar E-mail'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {gmailStatus && (
                  <p className={`text-[10px] text-center font-semibold mt-2.5 ${gmailStatus.type === 'success' ? 'text-emerald-400 bg-emerald-500/5 py-2 px-3 border border-emerald-500/10 rounded-xl' : 'text-rose-400 bg-rose-500/5 py-2 px-3 border border-rose-500/10 rounded-xl'}`}>
                    {gmailStatus.msg}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
      {/* Unsaved Notebook Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100 font-display">Alterações Pendentes no Caderno</h3>
                <span className="text-[10px] text-amber-400 font-mono">Autosave e sincronização</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Você possui edições recentes no Caderno que estão sendo sincronizadas com o servidor. Se sair agora, o rascunho permanecerá salvo localmente no seu navegador. Deseja sair ou permanecer no caderno?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setPendingTargetTab(null);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Permanecer no Caderno
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setHasUnsavedNotebook(false);
                  if (pendingTargetTab) {
                    setIsTabTransitioning(true);
                    setActiveTab(pendingTargetTab);
                    setPendingTargetTab(null);
                    setTimeout(() => setIsTabTransitioning(false), 300);
                  }
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Sair do Caderno
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
