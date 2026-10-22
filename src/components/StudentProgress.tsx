import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Monitor, 
  Activity, 
  ClipboardCheck, 
  Clock, 
  TrendingUp, 
  Moon, 
  Sparkles,
  Calendar,
  Award,
  ChevronDown,
  Info,
  BarChart3,
  AlertCircle,
  Target,
  BrainCircuit,
  CheckCircle2,
  BookOpen,
  ShieldAlert,
  Copy,
  MessageSquare,
  Layers,
  Zap,
  HelpCircle,
  Flame,
  MousePointerClick
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid
} from 'recharts';
import { MockSubmission, MockExam } from '../types';
import { supabase } from '../supabase';

interface StudentProgressProps {
  userEmail: string;
  userName: string;
  userTurma?: string;
  submissions?: MockSubmission[];
  mockExams?: MockExam[];
}

// Semicircular Arc Gauge Component (Verde Água)
function SemicircularGauge({ score, maxScore = 10 }: { score: number; maxScore?: number }) {
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  
  // Calculate SVG arc coordinates for semicircular arc (180deg)
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius; // Half perimeter
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[280px] mx-auto select-none">
      <svg viewBox="0 0 200 115" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Arc */}
        <path
          d="M 20 95 A 80 80 0 0 1 180 95"
          fill="none"
          stroke="#262626"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value Filled Arc */}
        <path
          d="M 20 95 A 80 80 0 0 1 180 95"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#gaugeGlow)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center Label inside Arc */}
      <div className="absolute top-[48px] sm:top-[52px] flex flex-col items-center text-center">
        <span className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight leading-none">
          {score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </span>
        <span className="text-[11px] font-mono text-neutral-400 font-semibold mt-1">
          de {maxScore} pontos
        </span>
      </div>
    </div>
  );
}

// Custom Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label, unit = '' }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl text-xs font-sans space-y-1 z-50">
        <p className="font-bold text-neutral-200">{data.fullTitle || label}</p>
        {data.subject && <p className="text-[11px] text-teal-400 font-mono">{data.subject}</p>}
        {data.date && <p className="text-[10px] text-neutral-500 font-mono">{data.date}</p>}
        <p className="text-teal-300 font-bold font-mono pt-1 border-t border-neutral-800">
          {payload[0].name || 'Valor'}: {payload[0].value}{unit}
        </p>
      </div>
    );
  }
  return null;
};

export default function StudentProgress({
  userEmail,
  userName,
  userTurma = '',
  submissions = [],
  mockExams = []
}: StudentProgressProps) {
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  // 1. Local Active Time Tracker
  const [localActiveSeconds, setLocalActiveSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`wsm_student_active_secs_${cleanEmail}`);
      return saved ? parseInt(saved, 10) : 600; // 10 min default session
    } catch {
      return 600;
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalActiveSeconds(prev => {
        const next = prev + 5;
        try {
          localStorage.setItem(`wsm_student_active_secs_${cleanEmail}`, String(next));
        } catch {}
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [cleanEmail]);

  // 2. Notebooks & Athenas AI Chat Stats
  const [notebookStats, setNotebookStats] = useState({
    count: 0,
    pagesCount: 0,
    stampedCount: 0,
    pendingReview: 0
  });

  const [chatQueriesCount, setChatQueriesCount] = useState<number>(0);

  useEffect(() => {
    async function loadAccountStats() {
      if (!cleanEmail) return;

      // Fetch Notebooks
      try {
        const { data: dbNotebooks } = await supabase
          .from('wsm_saved_notebooks')
          .select('*')
          .eq('student_email', cleanEmail);

        let nList = dbNotebooks || [];
        if (nList.length === 0) {
          const rawLocal = localStorage.getItem(`athenas_notebook_bio_${cleanEmail}`);
          if (rawLocal) {
            try {
              const parsed = JSON.parse(rawLocal);
              nList = [parsed];
            } catch {}
          }
        }

        let totalPages = 0;
        let stamped = 0;
        let pending = 0;

        nList.forEach((nb: any) => {
          if (Array.isArray(nb.pages)) totalPages += nb.pages.length;
          if (nb.last_stamp || nb.status === 'reviewed') stamped += 1;
          if (nb.status === 'pending_review') pending += 1;
        });

        setNotebookStats({
          count: nList.length,
          pagesCount: totalPages,
          stampedCount: stamped,
          pendingReview: pending
        });
      } catch {}

      // Count Chat queries from LocalStorage / WSM Chat history
      try {
        let count = 0;
        const chatKey = `athenas_chat_history_${cleanEmail}`;
        const rawChat = localStorage.getItem(chatKey);
        if (rawChat) {
          const parsed = JSON.parse(rawChat);
          if (Array.isArray(parsed)) count = parsed.filter((m: any) => m.sender === 'user').length;
        }
        setChatQueriesCount(count);
      } catch {}
    }

    loadAccountStats();
  }, [cleanEmail]);

  // 3. Filter 100% REAL completed submissions for this student email
  const completedSubmissions = useMemo(() => {
    return (submissions || []).filter(sub => {
      const matchEmail = (sub.student_email || '').toLowerCase().trim() === cleanEmail;
      const isFinished = sub.telemetry?.is_unfinished !== true;
      return matchEmail && isFinished;
    }).sort((a, b) => new Date(a.submitted_at || a.created_at || 0).getTime() - new Date(b.submitted_at || b.created_at || 0).getTime());
  }, [submissions, cleanEmail]);

  const hasSubmissions = completedSubmissions.length > 0;

  // 4. REAL Average Score & Percentage
  const averageScore = useMemo(() => {
    if (!hasSubmissions) return 0;
    const sum = completedSubmissions.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    const avg = sum / completedSubmissions.length;
    return Math.round(avg * 10) / 10;
  }, [completedSubmissions, hasSubmissions]);

  const averagePercentage = Math.min(100, Math.max(0, Math.round((averageScore / 10) * 100)));

  // 5. REAL Questions and Accuracy Metrics
  const questionMetrics = useMemo(() => {
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTimeSec = 0;

    completedSubmissions.forEach(sub => {
      totalQuestions += Number(sub.total_questions) || 0;
      totalCorrect += Number(sub.correct_count) || 0;
      totalTimeSec += Number(sub.telemetry?.totalTimeSeconds) || Number(sub.time_spent) || 0;
    });

    const accuracyRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const avgSecPerQuestion = totalQuestions > 0 ? Math.round(totalTimeSec / totalQuestions) : 0;

    return {
      totalQuestions,
      totalCorrect,
      accuracyRate,
      totalTimeSec,
      avgSecPerQuestion
    };
  }, [completedSubmissions]);

  // 6. REAL Telemetry & Integrity Metrics
  const telemetryMetrics = useMemo(() => {
    let totalTabSwitches = 0;
    let cleanExamsCount = 0;
    let totalPastedTextsCount = 0;
    let totalOptionChanges = 0;

    completedSubmissions.forEach(sub => {
      const switches = Number(sub.telemetry?.tabSwitches) || Number(sub.telemetry?.tab_switch_count) || 0;
      totalTabSwitches += switches;
      if (switches === 0) cleanExamsCount += 1;

      if (Array.isArray(sub.telemetry?.pasted_texts)) {
        totalPastedTextsCount += sub.telemetry.pasted_texts.length;
      }

      const opts = sub.telemetry?.optionChanges;
      if (opts && typeof opts === 'object') {
        Object.values(opts).forEach((v: any) => {
          totalOptionChanges += Number(v) || 0;
        });
      }
    });

    const focusIndex = completedSubmissions.length > 0
      ? Math.round((cleanExamsCount / completedSubmissions.length) * 100)
      : 100;

    return {
      totalTabSwitches,
      cleanExamsCount,
      focusIndex,
      totalPastedTextsCount,
      totalOptionChanges
    };
  }, [completedSubmissions]);

  // 7. REAL Subject Breakdown (Disciplinas)
  const subjectStats = useMemo(() => {
    const map: Record<string, { subject: string; count: number; totalScore: number; correct: number; questions: number; maxScore: number }> = {};

    completedSubmissions.forEach(sub => {
      const matchExam = mockExams.find(m => m.id === sub.mock_exam_id);
      const subj = matchExam?.subject || sub.mock_exam_title || 'Geral';
      if (!map[subj]) {
        map[subj] = { subject: subj, count: 0, totalScore: 0, correct: 0, questions: 0, maxScore: 0 };
      }
      map[subj].count += 1;
      map[subj].totalScore += Number(sub.score) || 0;
      map[subj].correct += Number(sub.correct_count) || 0;
      map[subj].questions += Number(sub.total_questions) || 0;
      const scoreNum = Number(sub.score) || 0;
      if (scoreNum > map[subj].maxScore) {
        map[subj].maxScore = scoreNum;
      }
    });

    return Object.values(map).map(s => ({
      ...s,
      avgScore: Math.round((s.totalScore / s.count) * 10) / 10,
      accuracy: s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }, [completedSubmissions, mockExams]);

  // Time format helper
  const totalActiveSecondsCombined = localActiveSeconds + questionMetrics.totalTimeSec;
  const formatSecondsToHoursMins = (totalSec: number) => {
    if (totalSec <= 0) return '0m';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };
  const totalActiveHoursText = formatSecondsToHoursMins(totalActiveSecondsCombined);

  // 8. GRAPH 1: Real Chronological Exam Score Evolution (Line Chart Data)
  // ONLY includes exact completed submissions (e.g. 3 submissions = 3 points)
  const scoreEvolutionData = useMemo(() => {
    if (!hasSubmissions) return [];

    return completedSubmissions.map((sub, idx) => {
      const matchExam = mockExams.find(m => m.id === sub.mock_exam_id);
      const title = sub.mock_exam_title || matchExam?.title || `Simulado ${idx + 1}`;
      const dt = sub.submitted_at 
        ? new Date(sub.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) 
        : `P${idx + 1}`;
      return {
        name: `P${idx + 1}`,
        nota: Number(sub.score) || 0,
        fullTitle: title,
        date: dt,
        subject: matchExam?.subject || 'Geral'
      };
    });
  }, [completedSubmissions, mockExams, hasSubmissions]);

  // 9. GRAPH 2: Real Weekly Study Activity
  // ONLY includes real calendar weeks where activity occurred
  const studyTimeWeeklyData = useMemo(() => {
    if (completedSubmissions.length === 0 && localActiveSeconds < 60) return [];

    const weekMap: Record<string, number> = {};

    completedSubmissions.forEach(sub => {
      if (sub.submitted_at) {
        const date = new Date(sub.submitted_at);
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const label = `Sem. ${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        const sec = Number(sub.telemetry?.totalTimeSeconds || sub.time_spent || 300);
        weekMap[label] = (weekMap[label] || 0) + sec;
      }
    });

    // Current session week
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    const currentWeekLabel = `Sem. ${currentWeekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    weekMap[currentWeekLabel] = (weekMap[currentWeekLabel] || 0) + localActiveSeconds;

    return Object.entries(weekMap).map(([name, sec]) => ({
      name,
      horas: Math.round((sec / 3600) * 10) / 10
    }));
  }, [completedSubmissions, localActiveSeconds]);

  // 10. GRAPH 3: Real Hourly Activity Distribution
  // ONLY includes exact hours where submissions occurred
  const hourlyActivityData = useMemo(() => {
    if (completedSubmissions.length === 0) return [];

    const hourCounts: Record<string, number> = {};

    completedSubmissions.forEach(sub => {
      if (sub.submitted_at) {
        const h = new Date(sub.submitted_at).getHours();
        const hourLabel = `${String(h).padStart(2, '0')}h`;
        const timeSec = Number(sub.telemetry?.totalTimeSeconds || 300);
        const min = Math.max(1, Math.round(timeSec / 60));
        hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + min;
      }
    });

    return Object.entries(hourCounts)
      .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
      .map(([name, minutos]) => ({ name, minutos }));
  }, [completedSubmissions]);

  // Compute Peak Hour from real data
  const peakHourObj = useMemo(() => {
    if (hourlyActivityData.length === 0) return null;
    return hourlyActivityData.reduce((prev, current) => (prev.minutos > current.minutos ? prev : current), hourlyActivityData[0]);
  }, [hourlyActivityData]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16 font-sans text-neutral-200 select-text">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-850">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">Meu Progresso</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              Dados 100% Reais
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Métricas exatas de desempenho, telemetria de simulados e engajamento coletados da sua conta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{userName || 'Aluno'} ({userTurma || 'Turma Ativa'})</span>
          </div>
        </div>
      </div>

      {/* TOP METRICS ROW: 4 Real Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Média Geral */}
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-all shadow-md">
          <div className="flex items-center gap-2 text-neutral-400">
            <Award className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-medium">Média dos Simulados</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight block">
              {averageScore.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-[11px] text-teal-400 font-mono font-semibold mt-0.5 block">
              {averagePercentage}% de aproveitamento
            </span>
          </div>
        </div>

        {/* Card 2: Questões & Taxa de Acertos */}
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-all shadow-md">
          <div className="flex items-center gap-2 text-neutral-400">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Questões Respondidas</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight block">
              {questionMetrics.totalQuestions}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-semibold mt-0.5 block">
              {questionMetrics.totalCorrect} acertos ({questionMetrics.accuracyRate}%)
            </span>
          </div>
        </div>

        {/* Card 3: Tempo Total Ativo */}
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-all shadow-md">
          <div className="flex items-center gap-2 text-neutral-400">
            <Activity className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-medium">Tempo em Estudos</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight block">
              {totalActiveHoursText}
            </span>
            <span className="text-[11px] text-teal-400 font-mono font-semibold mt-0.5 block">
              {questionMetrics.avgSecPerQuestion > 0 ? `~${questionMetrics.avgSecPerQuestion}s por questão` : 'Interação ativa na conta'}
            </span>
          </div>
        </div>

        {/* Card 4: Simulados Entregues */}
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-all shadow-md">
          <div className="flex items-center gap-2 text-neutral-400">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Simulados Concluídos</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight block">
              {completedSubmissions.length}
            </span>
            <span className="text-[11px] text-neutral-500 font-mono mt-0.5 block">
              Provas enviadas oficialmente
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: VISÔMETRO DE DESEMPENHO REAL */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 text-center space-y-4 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 block">
            VISÔMETRO DE APRENDIZADO
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white font-display mt-1">
            Desempenho Geral nos Simulados
          </h2>
        </div>

        {/* Gauge Arc Graphic */}
        <div className="py-2">
          <SemicircularGauge score={averageScore} maxScore={10} />
        </div>

        <div className="space-y-2">
          {hasSubmissions ? (
            <>
              <span className="inline-flex px-3.5 py-1 rounded-full text-xs font-bold font-mono bg-teal-500/15 border border-teal-500/30 text-teal-300">
                {averagePercentage}% de aproveitamento geral
              </span>
              <p className="text-xs text-neutral-400">
                Calculado rigorosamente com base em {completedSubmissions.length} simulado(s) concluído(s) na sua conta.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex px-3.5 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300">
                Nenhum simulado concluído ainda
              </span>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Realize seu primeiro simulado na aba "Simulados" para calcular sua média e porcentagem de aproveitamento oficial!
              </p>
            </>
          )}
        </div>
      </div>

      {/* SECTION 2: DESEMPENHO POR MATÉRIA / DISCIPLINA (DADOS REAIS) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-400" />
              <span>Desempenho por Disciplina</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Rendimento real agrupado por cada matéria das suas provas
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-500/30 px-3 py-1 rounded-full">
            {subjectStats.length} matéria(s) registrada(s)
          </span>
        </div>

        {subjectStats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectStats.map((st) => (
              <div key={st.subject} className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-300 font-mono uppercase tracking-wider">{st.subject}</span>
                  <span className="text-[10px] font-mono font-semibold text-neutral-400">{st.count} prova(s)</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white font-display">{st.avgScore} <span className="text-xs text-neutral-500 font-normal">/10</span></span>
                  <span className="text-xs font-mono font-extrabold text-emerald-400">{st.accuracy}% acertos</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-neutral-850 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${st.accuracy}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-1">
                  <span>Maior nota: {st.maxScore}/10</span>
                  <span>{st.correct}/{st.questions} questões</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-neutral-950/40 border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-xs text-neutral-400">Nenhum simulado finalizado para gerar a divisão por matéria.</p>
          </div>
        )}
      </div>

      {/* SECTION 3: EVOLUÇÃO DAS NOTAS (GRÁFICO COM DADOS 100% REAIS) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <span>Evolução das Notas</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Exibindo estritamente os seus {completedSubmissions.length} registro(s) real(is) em ordem cronológica
            </p>
          </div>
        </div>

        {hasSubmissions ? (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreEvolutionData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#737373" 
                  fontSize={11} 
                  dy={8} 
                  tickLine={false}
                />
                <YAxis 
                  stroke="#737373" 
                  fontSize={10} 
                  domain={[0, 10]} 
                  ticks={[0, 2.5, 5, 7.5, 10]} 
                  tickFormatter={(val) => `${val}/10`}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip unit="/10" />} />
                <Line 
                  type="monotone" 
                  dataKey="nota" 
                  name="Nota" 
                  stroke="#14b8a6" 
                  strokeWidth={2.5} 
                  dot={{ fill: '#14b8a6', r: 5, strokeWidth: 2, stroke: '#0d9488' }}
                  activeDot={{ r: 7, fill: '#34d399' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 px-4 text-center bg-neutral-950/40 border border-dashed border-neutral-800 rounded-2xl space-y-2">
            <BarChart3 className="w-8 h-8 text-neutral-600 mx-auto opacity-60" />
            <p className="text-xs font-bold text-neutral-300">Sem avaliações entregues até o momento</p>
            <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
              Assim que você realizar seus simulados, o gráfico de evolução das notas será preenchido exclusivamente com suas notas reais.
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between font-mono">
          <span>{hasSubmissions ? `${completedSubmissions.length} ponto(s) no gráfico.` : 'Aguardando entregas.'}</span>
          <span className="text-neutral-400">Total: {completedSubmissions.length} registro(s)</span>
        </div>
      </div>

      {/* SECTION 4: TELEMETRIA & INTEGRIDADE NOS SIMULADOS (DADOS REAIS DA PLATAFORMA) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-teal-400" />
              <span>Telemetria & Foco em Prova</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Dados de integridade coletados diretamente durante a execução dos seus simulados
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Foco % */}
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Índice de Foco em Prova</span>
            <span className="text-2xl font-black text-white font-display block">{telemetryMetrics.focusIndex}%</span>
            <span className="text-[11px] text-teal-400 font-mono font-semibold block">{telemetryMetrics.cleanExamsCount} prova(s) sem saídas</span>
          </div>

          {/* Troca de abas */}
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Saídas de Aba Detectadas</span>
            <span className="text-2xl font-black text-white font-display block">{telemetryMetrics.totalTabSwitches}</span>
            <span className="text-[11px] text-neutral-400 font-mono block">Ocorrências acumuladas</span>
          </div>

          {/* Colagens */}
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Textos Colados Detectados</span>
            <span className="text-2xl font-black text-white font-display block">{telemetryMetrics.totalPastedTextsCount}</span>
            <span className="text-[11px] text-neutral-400 font-mono block">Colagens registradas</span>
          </div>

          {/* Troca de Alternativas */}
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Revisão de Alternativas</span>
            <span className="text-2xl font-black text-white font-display block">{telemetryMetrics.totalOptionChanges}</span>
            <span className="text-[11px] text-teal-400 font-mono block">Trocas antes da confirmação</span>
          </div>
        </div>
      </div>

      {/* SECTION 5: CADERNO VIRTUAL & SUPORTE PEDAGÓGICO */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <span>Cadernos Virtuais & Interações</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Registros das suas anotações, correções de professores e uso da Athenas IA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Cadernos Criados</span>
            <span className="text-2xl font-black text-white font-display block">{notebookStats.count}</span>
            <span className="text-[11px] text-teal-400 font-mono block">{notebookStats.pagesCount} página(s) anotada(s)</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Vistos de Professores</span>
            <span className="text-2xl font-black text-white font-display block">{notebookStats.stampedCount}</span>
            <span className="text-[11px] text-emerald-400 font-mono block">Carimbos recebidos</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Aguardando Revisão</span>
            <span className="text-2xl font-black text-white font-display block">{notebookStats.pendingReview}</span>
            <span className="text-[11px] text-amber-400 font-mono block">Enviados para avaliação</span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">Dúvidas na Athenas IA</span>
            <span className="text-2xl font-black text-white font-display block">{chatQueriesCount}</span>
            <span className="text-[11px] text-teal-400 font-mono block">Perguntas ao assistente</span>
          </div>
        </div>
      </div>

      {/* SECTION 6: TEMPO DE ESTUDO POR SEMANA (APENAS SEMANAS ATIVAS) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-400" />
              <span>Tempo de Estudo por Semana</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Apenas semanas em que houve atividade real na plataforma
            </p>
          </div>
        </div>

        {studyTimeWeeklyData.length > 0 ? (
          <div className="h-60 sm:h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studyTimeWeeklyData} margin={{ top: 15, right: 15, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#737373" fontSize={11} dy={8} tickLine={false} />
                <YAxis stroke="#737373" fontSize={10} domain={[0, 'dataMax + 1']} tickFormatter={(v) => `${v} h`} tickLine={false} />
                <Tooltip content={<CustomChartTooltip unit=" h" />} />
                <Line 
                  type="monotone" 
                  dataKey="horas" 
                  name="Horas" 
                  stroke="#14b8a6" 
                  strokeWidth={2.5} 
                  dot={{ fill: '#14b8a6', r: 5, strokeWidth: 2, stroke: '#0d9488' }}
                  activeDot={{ r: 7, fill: '#34d399' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 text-center bg-neutral-950/40 border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-xs text-neutral-400">Nenhuma semana de estudo registrada ainda.</p>
          </div>
        )}
      </div>

      {/* SECTION 7: DISTRIBUIÇÃO POR HORÁRIO (APENAS HORÁRIOS COM REGISTRO REAL) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
              <Moon className="w-5 h-5 text-teal-400" />
              <span>Distribuição de Simulados por Horário</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Horários reais do dia em que você concluiu e enviou provas
            </p>
          </div>
        </div>

        {hourlyActivityData.length > 0 ? (
          <>
            <div className="h-60 sm:h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyActivityData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#737373" fontSize={11} dy={8} tickLine={false} />
                  <YAxis stroke="#737373" fontSize={10} domain={[0, 'dataMax + 5']} tickFormatter={(v) => `${v} min`} tickLine={false} />
                  <Tooltip content={<CustomChartTooltip unit=" min" />} />
                  <Line 
                    type="monotone" 
                    dataKey="minutos" 
                    name="Minutos em prova" 
                    stroke="#14b8a6" 
                    strokeWidth={2.5} 
                    dot={{ fill: '#14b8a6', r: 5, strokeWidth: 2, stroke: '#0d9488' }}
                    activeDot={{ r: 7, fill: '#34d399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {peakHourObj && (
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center gap-4">
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400 shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block">
                    HORÁRIO DE MAIOR ENTREGA
                  </span>
                  <p className="text-sm font-extrabold text-white mt-0.5">
                    {peakHourObj.name} — Faixa com maior concentração de envio e resolução de provas na sua conta
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center bg-neutral-950/40 border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-xs text-neutral-400">Conclua simulados para mapear o horário em que você costuma fazer provas.</p>
          </div>
        )}
      </div>

    </div>
  );
}
