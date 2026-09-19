import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  X, 
  Sparkles, 
  Clock, 
  BookOpen, 
  ArrowRight, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  Trash2, 
  Tag, 
  Filter, 
  Search, 
  Layers, 
  FileText, 
  Award,
  ListTodo,
  CalendarDays,
  UserCheck,
  Undo2
} from 'lucide-react';
import { parseExamSettings, cleanExamContent, formatExamDateDisplay, cleanExamObservations, extractExamTime } from '../utils/examSettings';

export interface UserCalendarItem {
  id: string;
  title: string;
  type: 'evento' | 'tarefa' | 'estudo' | 'lembrete';
  date: string; // YYYY-MM-DD
  event_date?: string;
  time?: string; // HH:MM
  priority?: 'baixa' | 'media' | 'alta';
  description?: string;
  subject?: string;
  completed?: boolean;
  createdAt: number;
}

interface AcademicCalendarProps {
  userRole: 'student' | 'teacher';
  userEmail: string;
  userName?: string;
  exams?: any[]; // Physical/scheduled exams
  mockExams?: any[]; // Virtual simulations
  onStudyForExam?: (title: string, content: string) => void;
  onTakeMockExam?: () => void;
  onViewResults?: () => void;
}

export default function AcademicCalendar({
  userRole,
  userEmail,
  userName = 'Usuário',
  exams = [],
  mockExams = [],
  onStudyForExam,
  onTakeMockExam,
  onViewResults
}: AcademicCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Filter and Search states
  const [activeFilter, setActiveFilter] = useState<'all' | 'prova' | 'simulado' | 'evento' | 'tarefa'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // Custom User Items state (stored in localStorage / Supabase)
  const [userItems, setUserItems] = useState<UserCalendarItem[]>(() => {
    try {
      const storageKey = `athenas_calendar_items_${userEmail.toLowerCase().trim()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    // Clean initial state for new accounts (no fake or unrequested global events)
    return [];
  });

  // Modal State for Creating Event/Task
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<'evento' | 'tarefa' | 'estudo' | 'lembrete'>('evento');
  const [newItemDate, setNewItemDate] = useState(selectedDayStr);
  const [newItemTime, setNewItemTime] = useState('09:00');
  const [newItemPriority, setNewItemPriority] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newItemSubject, setNewItemSubject] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  // Confirmation & Undo states for deletion (P2-02)
  const [itemToDelete, setItemToDelete] = useState<UserCalendarItem | null>(null);
  const [undoItem, setUndoItem] = useState<UserCalendarItem | null>(null);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [toastFeedback, setToastFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper to safely extract YYYY-MM-DD from any date string or timestamp
  const extractDateStr = (raw: any): string | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // Match "YYYY-MM-DD..."
      const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchIso) {
        return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
      }
      // Match "DD/MM/YYYY"
      const matchBr = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (matchBr) {
        return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
      }
    }
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Local state for DB fetched exams/simulados to guarantee synchronization
  const [dbExams, setDbExams] = useState<any[]>([]);
  const [dbMockExams, setDbMockExams] = useState<any[]>([]);
  const [dbNotifs, setDbNotifs] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      try {
        let query = supabase.from('wsm_exams').select('*');
        if (userRole === 'teacher' && userEmail) {
          query = query.eq('teacher_email', userEmail.toLowerCase().trim());
        }
        const { data, error } = await query;

        // Also fetch notifications to cross-reference time
        let notifsList: any[] = [];
        try {
          const { data: nData } = await supabase
            .from('wsm_notifications')
            .select('title, message')
            .order('created_at', { ascending: false })
            .limit(150);
          if (nData) notifsList = nData;
        } catch {
          // ignore
        }

        if (isMounted) {
          setDbNotifs(notifsList);
        }

        if (!error && data && isMounted) {
          const enriched = data.map((ex: any) => {
            const time = extractExamTime(ex, notifsList);
            return {
              ...ex,
              exam_time: time || ex.exam_time || null,
            };
          });
          setDbExams(enriched);
        }
      } catch {
        // ignore
      }
    };

    const fetchMockExams = async () => {
      try {
        let query = supabase.from('wsm_mock_exams').select('*');
        if (userRole === 'teacher' && userEmail) {
          query = query.eq('teacher_email', userEmail.toLowerCase().trim());
        }
        const { data, error } = await query;
        if (!error && data && isMounted) {
          setDbMockExams(data);
        }
      } catch {
        // ignore
      }
    };

    fetchExams();
    fetchMockExams();

    return () => { isMounted = false; };
  }, [userRole, userEmail]);

  // Combine passed props and DB fetched items, deduplicating by ID
  const effectiveExams = useMemo(() => {
    const map = new Map<string, any>();
    [...exams, ...dbExams].forEach(item => {
      if (item && (item.id || item.title)) {
        const time = extractExamTime(item, dbNotifs);
        const enrichedItem = {
          ...item,
          exam_time: time || item.exam_time || null,
        };
        const key = item.id || `${item.title}-${item.exam_date || item.date}`;
        map.set(key, enrichedItem);
      }
    });
    return Array.from(map.values());
  }, [exams, dbExams, dbNotifs]);

  const effectiveMockExams = useMemo(() => {
    const map = new Map<string, any>();
    [...mockExams, ...dbMockExams].forEach(item => {
      if (item && (item.id || item.title)) {
        const key = item.id || `${item.title}-${item.deadline || 'sem-prazo'}`;
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [mockExams, dbMockExams]);

  // Fetch calendar items from Supabase if table exists, with fallback to LocalStorage
  useEffect(() => {
    if (!userEmail) return;

    let isMounted = true;
    const fetchSupabaseItems = async () => {
      try {
        const { data, error } = await supabase
          .from('user_calendar_events')
          .select('*')
          .eq('user_email', userEmail.toLowerCase().trim());

        if (!error && data && isMounted) {
          const mapped: UserCalendarItem[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            type: row.type || 'evento',
            date: row.event_date || row.date,
            time: row.event_time || row.time || '09:00',
            priority: row.priority || 'media',
            description: row.description || '',
            subject: row.subject || '',
            completed: Boolean(row.completed),
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));

          setUserItems(mapped);
        }
      } catch (err) {
        // Table might not exist yet, fallback silently to localStorage
      }
    };

    fetchSupabaseItems();
    return () => { isMounted = false; };
  }, [userEmail]);

  // Save custom user items to localStorage whenever updated
  useEffect(() => {
    if (!userEmail) return;
    try {
      const storageKey = `athenas_calendar_items_${userEmail.toLowerCase().trim()}`;
      localStorage.setItem(storageKey, JSON.stringify(userItems));
    } catch (err) {
      console.error('Failed to save calendar items:', err);
    }
  }, [userItems, userEmail]);

  // Keep modal date synced when selected day changes
  useEffect(() => {
    if (selectedDayStr) {
      setNewItemDate(selectedDayStr);
    }
  }, [selectedDayStr]);

  // Month navigation calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDaysCount = getDaysInMonth(prevYear, prevMonth);

  const prevMonthDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push({
      day: prevMonthDaysCount - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  const currentMonthDays = [];
  for (let i = 1; i <= totalDays; i++) {
    currentMonthDays.push({
      day: i,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  const remainingCells = 42 - (prevMonthDays.length + currentMonthDays.length);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const nextMonthDays = [];
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthDays.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  const allCalendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Helper to fetch all events for a given YYYY-MM-DD date
  const getEventsForDate = (y: number, m: number, d: number) => {
    const formattedMonth = String(m + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    const dateStr = `${y}-${formattedMonth}-${formattedDay}`;

    // 1. Provas (physical exams)
    const dayExams = effectiveExams.filter(ex => {
      const exDate = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      return exDate === dateStr;
    });

    // 2. Simulados (virtual exams) - only scheduled if they have a valid deadline/date
    const dayMockExams = effectiveMockExams.filter(me => {
      const rawDeadline = me.deadline || me.due_date || me.exam_date;
      if (!rawDeadline) return false;
      const meDate = extractDateStr(rawDeadline);
      return meDate === dateStr;
    });

    // 3. User Custom Items
    const dayUserItems = userItems.filter(item => {
      const itemDate = extractDateStr(item.date || item.event_date);
      return itemDate === dateStr;
    });

    return {
      exams: dayExams,
      mockExams: dayMockExams,
      userItems: dayUserItems,
      totalCount: dayExams.length + dayMockExams.length + dayUserItems.length
    };
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDayStr(`${y}-${m}-${d}`);
  };

  // Add new item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !newItemDate) return;

    const newItem: UserCalendarItem = {
      id: `usr-item-${Date.now()}`,
      title: newItemTitle.trim(),
      type: newItemType,
      date: newItemDate,
      time: newItemTime || '09:00',
      priority: newItemPriority,
      subject: newItemSubject.trim() || undefined,
      description: newItemDescription.trim() || undefined,
      completed: false,
      createdAt: Date.now()
    };

    setUserItems(prev => [newItem, ...prev]);
    setIsModalOpen(false);

    // Sync to Supabase in background if table exists
    try {
      await supabase.from('user_calendar_events').insert({
        id: newItem.id,
        user_email: userEmail.toLowerCase().trim(),
        title: newItem.title,
        type: newItem.type,
        event_date: newItem.date,
        event_time: newItem.time,
        priority: newItem.priority,
        subject: newItem.subject || null,
        description: newItem.description || null,
        completed: false
      });
    } catch {
      // Ignored - fallback to LocalStorage
    }

    // Reset form
    setNewItemTitle('');
    setNewItemDescription('');
    setNewItemSubject('');
  };

  const handleToggleTaskCompleted = async (itemId: string) => {
    let nextState = false;

    setUserItems(prev => prev.map(item => {
      if (item.id === itemId) {
        nextState = !item.completed;
        return { ...item, completed: nextState };
      }
      return item;
    }));

    try {
      await supabase
        .from('user_calendar_events')
        .update({ completed: nextState })
        .eq('id', itemId);
    } catch {
      // Ignored
    }
  };

  const requestDeleteUserItem = (item: UserCalendarItem) => {
    setItemToDelete(item);
  };

  const confirmDeleteUserItem = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setItemToDelete(null);

    // Clear any previous undo timer
    if (undoTimer) clearTimeout(undoTimer);

    // Optimistically remove from state
    setUserItems(prev => prev.filter(item => item.id !== target.id));
    setUndoItem(target);

    // Show undo toast
    setToastFeedback({
      type: 'success',
      message: `Evento "${target.title}" excluído.`
    });

    // Start 8-second countdown before finalizing Supabase deletion
    const timer = setTimeout(async () => {
      setUndoItem(null);
      try {
        const { error } = await supabase
          .from('user_calendar_events')
          .delete()
          .eq('id', target.id);
        if (error) {
          console.warn('Erro ao deletar no Supabase:', error);
        }
      } catch (err) {
        console.warn('Falha na exclusão remota:', err);
      }
    }, 8000);

    setUndoTimer(timer);
  };

  const handleUndoDelete = async () => {
    if (!undoItem) return;
    if (undoTimer) clearTimeout(undoTimer);
    const restored = undoItem;
    setUndoItem(null);

    // Restore locally
    setUserItems(prev => [restored, ...prev]);

    // Restore to Supabase
    try {
      await supabase.from('user_calendar_events').upsert({
        id: restored.id,
        user_email: userEmail.toLowerCase().trim(),
        title: restored.title,
        type: restored.type,
        event_date: restored.date,
        event_time: restored.time,
        priority: restored.priority,
        subject: restored.subject || null,
        description: restored.description || null,
        completed: restored.completed || false
      });
    } catch (err) {
      console.warn('Erro ao restaurar no Supabase:', err);
    }

    setToastFeedback({
      type: 'success',
      message: `Exclusão desfeita! "${restored.title}" foi restaurado.`
    });
  };

  // Get selected day items filtered
  const selectedDayEvents = useMemo(() => {
    if (!selectedDayStr) return { exams: [], mockExams: [], userItems: [] };
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    return getEventsForDate(y, m - 1, d);
  }, [selectedDayStr, effectiveExams, effectiveMockExams, userItems]);

  // Overall statistics for banner
  const monthlyStats = useMemo(() => {
    const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const totalExamsThisMonth = effectiveExams.filter(ex => {
      const d = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      return d && d.startsWith(currentYearMonth);
    }).length;
    
    const totalMocksThisMonth = effectiveMockExams.filter(me => {
      const rawDeadline = me.deadline || me.due_date || me.exam_date;
      if (!rawDeadline) return false;
      const d = extractDateStr(rawDeadline);
      return d && d.startsWith(currentYearMonth);
    }).length;

    const pendingUserTasks = userItems.filter(i => {
      const d = extractDateStr(i.date || i.event_date);
      return i.type === 'tarefa' && !i.completed && d && d.startsWith(currentYearMonth);
    }).length;

    const totalUserEvents = userItems.filter(i => {
      const d = extractDateStr(i.date || i.event_date);
      return d && d.startsWith(currentYearMonth);
    }).length;

    return {
      totalExamsThisMonth,
      totalMocksThisMonth,
      pendingUserTasks,
      totalUserEvents
    };
  }, [effectiveExams, effectiveMockExams, userItems, year, month]);

  return (
    <div className="p-4 sm:p-6 md:p-8 rounded-3xl bg-neutral-950/60 border border-neutral-900/90 backdrop-blur-md space-y-6 shadow-2xl">
      
      {/* Top Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-neutral-900 pb-6 relative overflow-hidden">
        {/* Glow behind header */}
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-100 font-display tracking-tight">
                Calendário Acadêmico & Pessoal
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                {userRole === 'teacher' ? 'Professor' : 'Aluno'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Gerencie suas provas, simulados, eventos pessoais e tarefas diárias em um único lugar.
            </p>
          </div>
        </div>

        {/* Quick Actions & View Mode Controls */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-extrabold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Evento / Tarefa</span>
          </button>

          <div className="flex items-center bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'month' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Visão Mês</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'agenda' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Minhas Tarefas ({userItems.filter(i => i.type === 'tarefa').length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Statistics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block">Provas do Mês</span>
            <span className="text-base font-black text-neutral-200 font-mono">{monthlyStats.totalExamsThisMonth}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block">Simulados</span>
            <span className="text-base font-black text-neutral-200 font-mono">{monthlyStats.totalMocksThisMonth}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block">Tarefas Pendentes</span>
            <span className="text-base font-black text-neutral-200 font-mono">{monthlyStats.pendingUserTasks}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block">Eventos Salvos</span>
            <span className="text-base font-black text-neutral-200 font-mono">{monthlyStats.totalUserEvents}</span>
          </div>
        </div>
      </div>

      {/* Filtering and Month Selector Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-neutral-900/40 p-3 rounded-2xl border border-neutral-900">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-bold border border-neutral-800 transition-all cursor-pointer active:scale-95"
          >
            Hoje
          </button>
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 rounded-lg transition-colors cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-xs font-black text-neutral-200 font-mono uppercase tracking-wider select-none">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 rounded-lg transition-colors cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'all' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('prova')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'prova' ? 'bg-rose-500 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Provas
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('simulado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'simulado' ? 'bg-teal-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Simulados
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('evento')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'evento' ? 'bg-sky-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Meus Eventos
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('tarefa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'tarefa' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Tarefas
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Calendar Grid (8 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Week Days Header */}
            <div className="grid grid-cols-7 text-center gap-1">
              {weekDays.map(day => (
                <span key={day} className="text-[11px] uppercase font-bold tracking-wider text-neutral-500 font-mono py-1.5 select-none">
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {allCalendarDays.map((cell, idx) => {
                const formattedMonth = String(cell.month + 1).padStart(2, '0');
                const formattedDay = String(cell.day).padStart(2, '0');
                const dateStr = `${cell.year}-${formattedMonth}-${formattedDay}`;

                const isSelected = selectedDayStr === dateStr;
                const isToday = (() => {
                  const today = new Date();
                  return today.getDate() === cell.day && 
                         today.getMonth() === cell.month && 
                         today.getFullYear() === cell.year;
                })();

                const dayEvents = getEventsForDate(cell.year, cell.month, cell.day);

                // Filter logic for counts
                const hasExams = activeFilter === 'all' || activeFilter === 'prova';
                const hasMocks = activeFilter === 'all' || activeFilter === 'simulado';
                const hasEvents = activeFilter === 'all' || activeFilter === 'evento';
                const hasTasks = activeFilter === 'all' || activeFilter === 'tarefa';

                const showExamsCount = hasExams ? dayEvents.exams.length : 0;
                const showMocksCount = hasMocks ? dayEvents.mockExams.length : 0;
                const showUserEventsCount = hasEvents ? dayEvents.userItems.filter(i => i.type !== 'tarefa').length : 0;
                const showUserTasksCount = hasTasks ? dayEvents.userItems.filter(i => i.type === 'tarefa').length : 0;
                const totalFilteredEvents = showExamsCount + showMocksCount + showUserEventsCount + showUserTasksCount;

                // Priority style determination
                const hasExamIndicator = showExamsCount > 0;
                const hasMockIndicator = showMocksCount > 0 && !hasExamIndicator;
                const hasEventIndicator = showUserEventsCount > 0 && !hasExamIndicator && !hasMockIndicator;
                const hasTaskIndicator = showUserTasksCount > 0 && !hasExamIndicator && !hasMockIndicator && !hasEventIndicator;

                let cellBaseClass = 'bg-neutral-950/40 text-neutral-400 border-neutral-900 hover:bg-neutral-900/60 hover:text-neutral-200';
                
                if (!cell.isCurrentMonth) {
                  cellBaseClass = 'text-neutral-700 border-transparent bg-transparent opacity-25 hover:opacity-40';
                } else if (isSelected) {
                  if (hasExamIndicator) {
                    cellBaseClass = 'bg-rose-950/70 text-rose-100 border-rose-400 ring-2 ring-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)]';
                  } else if (hasMockIndicator) {
                    cellBaseClass = 'bg-emerald-950/70 text-emerald-100 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]';
                  } else if (hasEventIndicator) {
                    cellBaseClass = 'bg-sky-950/70 text-sky-100 border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.35)]';
                  } else if (hasTaskIndicator) {
                    cellBaseClass = 'bg-amber-950/70 text-amber-100 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]';
                  } else {
                    cellBaseClass = 'bg-neutral-850 text-neutral-100 border-neutral-700 ring-2 ring-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
                  }
                } else if (hasExamIndicator) {
                  cellBaseClass = 'bg-rose-950/30 text-rose-100 border-rose-500/40 hover:bg-rose-900/40 hover:border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20';
                } else if (hasMockIndicator) {
                  cellBaseClass = 'bg-emerald-950/30 text-emerald-100 border-emerald-500/40 hover:bg-emerald-900/40 hover:border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20';
                } else if (hasEventIndicator) {
                  cellBaseClass = 'bg-sky-950/30 text-sky-100 border-sky-500/40 hover:bg-sky-900/40 hover:border-sky-400 ring-1 ring-sky-500/20';
                } else if (hasTaskIndicator) {
                  cellBaseClass = 'bg-amber-950/30 text-amber-100 border-amber-500/40 hover:bg-amber-900/40 hover:border-amber-400 ring-1 ring-amber-500/20';
                } else if (isToday) {
                  cellBaseClass = 'bg-neutral-900/90 text-neutral-100 border-emerald-500/40 font-bold';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayStr(dateStr)}
                    className={`aspect-square min-h-[58px] sm:min-h-[64px] rounded-2xl flex flex-col justify-between p-2 border transition-all cursor-pointer relative group/cell overflow-hidden ${cellBaseClass}`}
                  >
                    {/* Top Row: Day number + Main badge */}
                    <div className="flex items-start justify-between w-full gap-1">
                      <span className={`text-xs font-mono ${
                        hasExamIndicator 
                          ? 'text-rose-300 font-black' 
                          : hasMockIndicator 
                          ? 'text-emerald-300 font-black' 
                          : isToday 
                          ? 'text-emerald-400 font-black' 
                          : 'font-bold'
                      }`}>
                        {cell.day}
                      </span>

                      {/* Prominent High-Visibility Event Badge / Pill */}
                      {cell.isCurrentMonth && (
                        <div className="flex items-center gap-0.5">
                          {hasExamIndicator && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-mono text-[9px] font-black uppercase tracking-tight shadow-sm flex items-center gap-0.5 animate-pulse"
                              title={showExamsCount > 1 ? `${showExamsCount} Provas marcadas` : 'Prova Marcada'}
                            >
                              <Award className="w-2.5 h-2.5" />
                              <span className="hidden sm:inline">{showExamsCount > 1 ? `${showExamsCount} Provas` : 'Prova'}</span>
                              <span className="sm:hidden">{showExamsCount > 1 ? `${showExamsCount}P` : 'P'}</span>
                            </span>
                          )}

                          {hasMockIndicator && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-neutral-950 font-mono text-[9px] font-black uppercase tracking-tight shadow-sm flex items-center gap-0.5"
                              title="Simulado Online"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span className="hidden sm:inline">{showMocksCount > 1 ? `${showMocksCount} Sim.` : 'Simulado'}</span>
                              <span className="sm:hidden">{showMocksCount > 1 ? `${showMocksCount}S` : 'S'}</span>
                            </span>
                          )}

                          {hasEventIndicator && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md bg-sky-500/40 text-sky-200 border border-sky-400/40 font-mono text-[9px] font-bold"
                              title="Evento / Compromisso"
                            >
                              <span className="hidden sm:inline">{showUserEventsCount > 1 ? `${showUserEventsCount} Evt.` : 'Evento'}</span>
                              <span className="sm:hidden">E</span>
                            </span>
                          )}

                          {hasTaskIndicator && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md bg-amber-500/40 text-amber-200 border border-amber-400/40 font-mono text-[9px] font-bold"
                              title="Tarefa Pessoal"
                            >
                              <span className="hidden sm:inline">{showUserTasksCount > 1 ? `${showUserTasksCount} Tar.` : 'Tarefa'}</span>
                              <span className="sm:hidden">T</span>
                            </span>
                          )}

                          {isToday && totalFilteredEvents === 0 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Hoje" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Middle: Truncated Title Preview on medium+ screens */}
                    {cell.isCurrentMonth && totalFilteredEvents > 0 && (
                      <div className="hidden sm:block w-full text-left my-0.5">
                        {hasExamIndicator && dayEvents.exams[0] && (
                          <span className="text-[9px] font-bold text-rose-200/90 block truncate leading-tight">
                            {dayEvents.exams[0].title || dayEvents.exams[0].materia || 'Prova Presencial'}
                          </span>
                        )}
                        {hasMockIndicator && dayEvents.mockExams[0] && (
                          <span className="text-[9px] font-bold text-emerald-200/90 block truncate leading-tight">
                            {dayEvents.mockExams[0].title || 'Simulado'}
                          </span>
                        )}
                        {hasEventIndicator && dayEvents.userItems[0] && (
                          <span className="text-[9px] font-medium text-sky-200/90 block truncate leading-tight">
                            {dayEvents.userItems[0].title}
                          </span>
                        )}
                        {hasTaskIndicator && dayEvents.userItems[0] && (
                          <span className="text-[9px] font-medium text-amber-200/90 block truncate leading-tight">
                            {dayEvents.userItems[0].title}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bottom Indicator Dots & Accent Bar */}
                    <div className="w-full flex items-end justify-between mt-auto">
                      {cell.isCurrentMonth && totalFilteredEvents > 0 && (
                        <div className="flex gap-1 items-center flex-wrap">
                          {showExamsCount > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-900" title={`${showExamsCount} Prova(s)`} />
                          )}
                          {showMocksCount > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-900" title={`${showMocksCount} Simulado(s)`} />
                          )}
                          {showUserEventsCount > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-sm" title={`${showUserEventsCount} Evento(s)`} />
                          )}
                          {showUserTasksCount > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm" title={`${showUserTasksCount} Tarefa(s)`} />
                          )}
                        </div>
                      )}

                      {/* Bottom Accent Bar */}
                      {cell.isCurrentMonth && (
                        <>
                          {hasExamIndicator && (
                            <span className="absolute bottom-0 left-1 right-1 h-1 rounded-t-full bg-rose-500 shadow-sm shadow-rose-500/80" />
                          )}
                          {hasMockIndicator && (
                            <span className="absolute bottom-0 left-1 right-1 h-1 rounded-t-full bg-emerald-400 shadow-sm shadow-emerald-500/80" />
                          )}
                          {hasEventIndicator && (
                            <span className="absolute bottom-0 left-1 right-1 h-1 rounded-t-full bg-sky-400" />
                          )}
                          {hasTaskIndicator && (
                            <span className="absolute bottom-0 left-1 right-1 h-1 rounded-t-full bg-amber-400" />
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Color Guide Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-400 pt-3 font-mono border-t border-neutral-900">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-md bg-rose-500 shadow-sm shadow-rose-900" />
                <span className="text-neutral-300 font-semibold">Provas Marcadas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-md bg-emerald-400 shadow-sm shadow-emerald-900" />
                <span>Simulados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-md bg-sky-400 shadow-sm" />
                <span>Eventos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-md bg-amber-400 shadow-sm" />
                <span>Tarefas</span>
              </div>
            </div>
          </div>

          {/* Selected Day Agenda Side Panel (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDayStr}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-850 space-y-4 min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-neutral-500">
                        Atividades Agendadas:
                      </span>
                      <h4 className="text-sm font-extrabold text-neutral-100 font-mono mt-0.5">
                        {(() => {
                          if (!selectedDayStr) return '';
                          const [y, m, d] = selectedDayStr.split('-').map(Number);
                          return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                        })()}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNewItemDate(selectedDayStr);
                        setIsModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-emerald-400 rounded-xl text-xs font-bold border border-neutral-700 flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Event Items List for selected day */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1 custom-scrollbar">
                  {/* Provas */}
                  {(activeFilter === 'all' || activeFilter === 'prova') && selectedDayEvents.exams.map((ex, i) => {
                    const dateInfo = formatExamDateDisplay(ex, ex.exam_time, dbNotifs);
                    return (
                      <div key={`ex-${i}`} className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {ex.materia || 'Prova'}
                          </span>
                          {ex.teacher_name && (
                            <span className="text-[10px] text-neutral-400 font-mono">Prof. {ex.teacher_name}</span>
                          )}
                        </div>

                        {/* Date and Time Badge */}
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-300 bg-rose-950/50 px-2.5 py-1 rounded-lg border border-rose-900/40">
                          <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{dateInfo.fullFormatted || 'Data marcada'}</span>
                        </div>

                        <h5 className="text-xs font-bold text-neutral-100 leading-snug">{ex.title}</h5>
                        {ex.content && (
                          <p className="text-[11px] text-neutral-300 bg-neutral-950/60 p-2 rounded-xl border border-neutral-850">
                            <strong>Conteúdo:</strong> {cleanExamContent(ex.content)}
                          </p>
                        )}
                        {cleanExamObservations(ex.observations) && (
                          <p className="text-[10.5px] text-neutral-400 italic bg-neutral-950/40 p-2 rounded-xl border border-neutral-900">
                            <strong>Obs:</strong> "{cleanExamObservations(ex.observations)}"
                          </p>
                        )}
                        {onStudyForExam && (
                          <button
                            type="button"
                            onClick={() => onStudyForExam(ex.title, cleanExamContent(ex.content) || '')}
                            className="w-full py-1.5 bg-emerald-500 text-neutral-950 font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Gerar Plano de Estudo com AI</span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Simulados */}
                  {(activeFilter === 'all' || activeFilter === 'simulado') && selectedDayEvents.mockExams.map((me, i) => {
                    const rawDeadline = me.deadline || me.due_date || me.exam_date;
                    const meDateInfo = rawDeadline ? formatExamDateDisplay(rawDeadline) : null;
                    return (
                      <div key={`me-${i}`} className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Simulado • {me.subject || 'Geral'}
                          </span>
                          {me.teacher_name && (
                            <span className="text-[10px] text-neutral-400 font-mono">Prof. {me.teacher_name}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300 bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-900/40">
                          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {rawDeadline && meDateInfo?.fullFormatted
                              ? `Prazo: ${meDateInfo.fullFormatted}`
                              : 'Prazo: Sem prazo (ritmo livre)'}
                          </span>
                        </div>

                        <h5 className="text-xs font-bold text-neutral-100 leading-snug">{me.title}</h5>
                        {userRole === 'student' && onTakeMockExam && (
                          <button
                            type="button"
                            onClick={onTakeMockExam}
                            className="w-full py-1.5 bg-emerald-500 text-neutral-950 font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Responder Simulado</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        {userRole === 'teacher' && onViewResults && (
                          <button
                            type="button"
                            onClick={onViewResults}
                            className="w-full py-1.5 bg-neutral-800 text-emerald-400 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer border border-neutral-700"
                          >
                            <span>Ver Desempenho dos Alunos</span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* User Created Items */}
                  {selectedDayEvents.userItems.map((item) => {
                    const isTask = item.type === 'tarefa';
                    const isChecked = item.completed;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                          isTask
                            ? isChecked
                              ? 'bg-neutral-900/40 border-neutral-800 opacity-60'
                              : 'bg-amber-500/10 border-amber-500/25'
                            : 'bg-sky-500/10 border-sky-500/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isTask && (
                              <button
                                type="button"
                                onClick={() => handleToggleTaskCompleted(item.id)}
                                className="text-amber-400 hover:text-amber-300 cursor-pointer"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-amber-400" />
                                )}
                              </button>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase ${
                              isTask ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                            }`}>
                              {item.type}
                            </span>
                            {item.time && (
                              <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.time}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => requestDeleteUserItem(item)}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <h5 className={`text-xs font-bold text-neutral-100 ${isChecked ? 'line-through text-neutral-400' : ''}`}>
                          {item.title}
                        </h5>

                        {item.description && (
                          <p className="text-[11px] text-neutral-300 bg-neutral-950/50 p-2 rounded-xl">
                            {item.description}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {selectedDayEvents.exams.length === 0 &&
                   selectedDayEvents.mockExams.length === 0 &&
                   selectedDayEvents.userItems.length === 0 && (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto text-neutral-500">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-neutral-400">Nenhum evento para esta data</p>
                      <p className="text-[11px] text-neutral-500">Clique em "+ Adicionar" para agendar uma tarefa ou lembrete.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* Agenda View / Task Manager List */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-850 space-y-3">
            <h3 className="text-sm font-extrabold text-neutral-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Gerenciador Pessoal de Tarefas e Lembretes</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {userItems.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                    item.completed
                      ? 'bg-neutral-900/30 border-neutral-850 opacity-60'
                      : 'bg-neutral-900/80 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {item.type} • {item.date}
                    </span>
                    <button
                      type="button"
                      onClick={() => requestDeleteUserItem(item)}
                      className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5">
                    {item.type === 'tarefa' && (
                      <button
                        type="button"
                        onClick={() => handleToggleTaskCompleted(item.id)}
                        className="mt-0.5 text-emerald-400 cursor-pointer"
                      >
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-500" />
                        )}
                      </button>
                    )}
                    <div>
                      <h4 className={`text-xs font-bold text-neutral-100 ${item.completed ? 'line-through text-neutral-400' : ''}`}>
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-[11px] text-neutral-400 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Evento / Tarefa */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-neutral-950 border border-emerald-500/30 rounded-3xl p-6 space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-neutral-100">Criar Novo Evento ou Tarefa</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} noValidate className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">Título do Agendamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Estudar Matemática, Reunião de Pais..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500"
                  />
                  {!newItemTitle.trim() && (
                    <p className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Por favor, preencha o título do agendamento.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">Tipo</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500"
                    >
                      <option value="evento">Evento / Compromisso</option>
                      <option value="tarefa">Tarefa / To-do</option>
                      <option value="estudo">Sessão de Estudo</option>
                      <option value="lembrete">Lembrete</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">Horário</label>
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">Prioridade</label>
                    <select
                      value={newItemPriority}
                      onChange={(e) => setNewItemPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">Descrição / Anotações</label>
                  <textarea
                    rows={3}
                    placeholder="Detalhes adicionais ou instruções..."
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newItemTitle.trim() || !newItemDate.trim()}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    Salvar no Calendário
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmar Exclusão de Evento (P2-02) */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
              role="alertdialog"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-desc"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 id="delete-dialog-title" className="text-base font-bold text-neutral-100">
                  Excluir Evento?
                </h3>
                <p id="delete-dialog-desc" className="text-xs text-neutral-400 leading-relaxed">
                  Tem certeza que deseja excluir o evento <strong className="text-neutral-200">"{itemToDelete.title}"</strong>? Esta ação removerá o lembrete da sua agenda.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUserItem}
                  className="py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-lg shadow-red-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Feedback Notification com opção de Desfazer (Undo) */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-xs backdrop-blur-md ${
              toastFeedback.type === 'success'
                ? 'bg-neutral-900/95 border-neutral-800 text-neutral-200'
                : 'bg-red-950/90 border-red-800/60 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastFeedback.type === 'success' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              )}
              <span>{toastFeedback.message}</span>
            </div>

            {undoItem && (
              <button
                type="button"
                onClick={handleUndoDelete}
                className="ml-2 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setToastFeedback(null)}
              className="text-neutral-400 hover:text-white p-1 ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
