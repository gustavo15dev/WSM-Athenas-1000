import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Sparkles, 
  Clock, 
  BookOpen, 
  ArrowRight, 
  CheckSquare, 
  Square, 
  Trash2, 
  Search, 
  CalendarDays, 
  Undo2, 
  CalendarClock, 
  CheckCircle2,
  CalendarCheck2,
  Tag,
  AlertCircle
} from 'lucide-react';
import { parseExamSettings, cleanExamContent, formatExamDateDisplay, cleanExamObservations, extractExamTime } from '../utils/examSettings';
import { matchesStudentTarget, matchesStudentExam } from '../utils/targetMatcher';

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
  userTurma?: string;
  virtualClasses?: any[];
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
  userTurma = '',
  virtualClasses = [],
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'prova' | 'simulado' | 'tarefa'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // Custom User Items state (stored in localStorage & Supabase)
  const [userItems, setUserItems] = useState<UserCalendarItem[]>(() => {
    try {
      const storageKey = `athenas_calendar_items_${userEmail.toLowerCase().trim()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  // Modal State for Creating Event/Task
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<'evento' | 'tarefa' | 'estudo' | 'lembrete'>('tarefa');
  const [newItemDate, setNewItemDate] = useState(selectedDayStr);
  const [newItemTime, setNewItemTime] = useState('09:00');
  const [newItemPriority, setNewItemPriority] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newItemSubject, setNewItemSubject] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  // Confirmation & Undo states for deletion
  const [itemToDelete, setItemToDelete] = useState<UserCalendarItem | null>(null);
  const [undoItem, setUndoItem] = useState<UserCalendarItem | null>(null);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [toastFeedback, setToastFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper to safely extract YYYY-MM-DD from any date string or timestamp
  const extractDateStr = useCallback((raw: any): string | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchIso) {
        return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
      }
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
  }, []);

  // Local state for DB fetched exams/simulados to guarantee synchronization
  const [dbExams, setDbExams] = useState<any[]>([]);
  const [dbMockExams, setDbMockExams] = useState<any[]>([]);
  const [dbNotifs, setDbNotifs] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const cleanEmail = userEmail.toLowerCase().trim();

    const fetchExams = async () => {
      try {
        let query = supabase.from('wsm_exams').select('*');
        if (userRole === 'teacher' && cleanEmail) {
          query = query.eq('teacher_email', cleanEmail);
        }
        const { data, error } = await query;

        let notifsList: any[] = [];
        try {
          const { data: nData } = await supabase
            .from('wsm_notifications')
            .select('title, message')
            .order('created_at', { ascending: false })
            .limit(100);
          if (nData) notifsList = nData;
        } catch {
          // ignore
        }

        if (isMounted) {
          setDbNotifs(notifsList);
        }

        if (!error && data && isMounted) {
          let list = data;
          if (userRole === 'student') {
            const studentVCIds: string[] = (virtualClasses || []).flatMap((vc: any) =>
              [vc.id, vc.name, vc.access_code].filter(Boolean)
            );
            list = data.filter((ex: any) => {
              return matchesStudentExam(ex, cleanEmail, userTurma, studentVCIds);
            });
          }

          const enriched = list.map((ex: any) => {
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
        if (userRole === 'teacher' && cleanEmail) {
          query = query.eq('teacher_email', cleanEmail);
        }
        const { data, error } = await query;
        if (!error && data && isMounted) {
          let list = data;
          if (userRole === 'student') {
            const studentVCIds: string[] = (virtualClasses || []).flatMap((vc: any) =>
              [vc.id, vc.name, vc.access_code].filter(Boolean)
            );
            list = data.filter((mock: any) => {
              const { settings } = parseExamSettings(mock.description || '');
              if (settings.is_draft || mock.is_draft === true || mock.status === 'draft') return false;
              return matchesStudentTarget(mock.class_name, cleanEmail, userTurma, studentVCIds);
            });
          }
          setDbMockExams(list);
        }
      } catch {
        // ignore
      }
    };

    fetchExams();
    fetchMockExams();

    return () => { isMounted = false; };
  }, [userRole, userEmail, userTurma, virtualClasses]);

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

  // Fetch calendar items from Supabase with fallback to LocalStorage
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
            type: row.type || 'tarefa',
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
      } catch {
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
  const getEventsForDate = useCallback((y: number, m: number, d: number) => {
    const formattedMonth = String(m + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    const dateStr = `${y}-${formattedMonth}-${formattedDay}`;

    // 1. Provas (physical exams)
    const dayExams = effectiveExams.filter(ex => {
      const exDate = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      return exDate === dateStr;
    });

    // 2. Simulados (virtual exams)
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
  }, [effectiveExams, effectiveMockExams, userItems, extractDateStr]);

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

    try {
      await supabase.from('user_calendar_events').insert({
        id: newItem.id,
        user_email: userEmail.toLowerCase().trim(),
        title: newItem.title,
        type: newItem.type,
        event_date: newItem.date,
        event_time: newItem.time,
        priority: newItem.priority,
        subject: newItem.subject,
        description: newItem.description,
        completed: false
      });
    } catch {
      // Fallback already saved in localStorage
    }

    setToastFeedback({ type: 'success', message: 'Item adicionado com sucesso!' });
    setTimeout(() => setToastFeedback(null), 3500);

    // Reset fields
    setNewItemTitle('');
    setNewItemSubject('');
    setNewItemDescription('');
  };

  // Toggle task completed
  const handleToggleTaskCompleted = async (itemId: string) => {
    setUserItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const nextCompleted = !item.completed;
        // update supabase
        supabase.from('user_calendar_events')
          .update({ completed: nextCompleted })
          .eq('id', itemId)
          .then();
        return { ...item, completed: nextCompleted };
      }
      return item;
    }));
  };

  // Delete item with Undo capability
  const requestDeleteUserItem = (item: UserCalendarItem) => {
    setItemToDelete(item);
  };

  const confirmDeleteUserItem = () => {
    if (!itemToDelete) return;
    const toDelete = itemToDelete;
    setItemToDelete(null);

    // Remove from state
    setUserItems(prev => prev.filter(i => i.id !== toDelete.id));

    // Supabase delete
    supabase.from('user_calendar_events').delete().eq('id', toDelete.id).then();

    // Prepare Undo
    setUndoItem(toDelete);
    if (undoTimer) clearTimeout(undoTimer);
    const timer = setTimeout(() => {
      setUndoItem(null);
      setToastFeedback(null);
    }, 6000);
    setUndoTimer(timer);

    setToastFeedback({ type: 'success', message: `"${toDelete.title}" removido.` });
  };

  const handleUndoDelete = async () => {
    if (!undoItem) return;
    const restored = undoItem;
    setUserItems(prev => [restored, ...prev]);
    setUndoItem(null);
    if (undoTimer) clearTimeout(undoTimer);

    try {
      await supabase.from('user_calendar_events').insert({
        id: restored.id,
        user_email: userEmail.toLowerCase().trim(),
        title: restored.title,
        type: restored.type,
        event_date: restored.date,
        event_time: restored.time,
        priority: restored.priority,
        subject: restored.subject,
        description: restored.description,
        completed: restored.completed
      });
    } catch {
      // ignore
    }

    setToastFeedback({ type: 'success', message: 'Exclusão desfeita com sucesso!' });
    setTimeout(() => setToastFeedback(null), 3000);
  };

  // Events for selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDayStr) {
      return { exams: [], mockExams: [], userItems: [] };
    }
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    const dayData = getEventsForDate(y, m - 1, d);

    // Apply search filter if active
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return {
        exams: dayData.exams.filter(ex => 
          (ex.title && ex.title.toLowerCase().includes(q)) || 
          (ex.materia && ex.materia.toLowerCase().includes(q)) ||
          (ex.content && cleanExamContent(ex.content).toLowerCase().includes(q))
        ),
        mockExams: dayData.mockExams.filter(me => 
          (me.title && me.title.toLowerCase().includes(q)) ||
          (me.subject && me.subject.toLowerCase().includes(q)) ||
          (me.description && me.description.toLowerCase().includes(q))
        ),
        userItems: dayData.userItems.filter(ui => 
          (ui.title && ui.title.toLowerCase().includes(q)) ||
          (ui.subject && ui.subject.toLowerCase().includes(q)) ||
          (ui.description && ui.description.toLowerCase().includes(q))
        )
      };
    }

    return dayData;
  }, [selectedDayStr, getEventsForDate, searchTerm]);

  // Formatted date string for selected day headline
  const selectedDayFormattedHeadline = useMemo(() => {
    if (!selectedDayStr) return '';
    try {
      const [y, m, d] = selectedDayStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }).format(dateObj);
    } catch {
      return selectedDayStr;
    }
  }, [selectedDayStr]);

  // All chronological items for the Agenda list view
  const allChronologicalItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      category: 'prova' | 'simulado' | 'tarefa' | 'evento' | 'estudo' | 'lembrete';
      dateStr: string;
      timeStr?: string;
      subject?: string;
      description?: string;
      content?: string;
      teacherName?: string;
      completed?: boolean;
      priority?: string;
      rawObject: any;
    }> = [];

    effectiveExams.forEach(ex => {
      const d = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      if (d) {
        list.push({
          id: ex.id || `ex-${ex.title}-${d}`,
          title: ex.title,
          category: 'prova',
          dateStr: d,
          timeStr: ex.exam_time || undefined,
          subject: ex.materia,
          content: cleanExamContent(ex.content),
          teacherName: ex.teacher_name,
          rawObject: ex
        });
      }
    });

    effectiveMockExams.forEach(me => {
      const rawDeadline = me.deadline || me.due_date || me.exam_date;
      const d = extractDateStr(rawDeadline);
      if (d) {
        list.push({
          id: me.id || `me-${me.title}-${d}`,
          title: me.title,
          category: 'simulado',
          dateStr: d,
          subject: me.subject,
          description: me.description,
          teacherName: me.teacher_name,
          rawObject: me
        });
      }
    });

    userItems.forEach(ui => {
      const d = extractDateStr(ui.date || ui.event_date);
      if (d) {
        list.push({
          id: ui.id,
          title: ui.title,
          category: ui.type,
          dateStr: d,
          timeStr: ui.time,
          subject: ui.subject,
          description: ui.description,
          completed: ui.completed,
          priority: ui.priority,
          rawObject: ui
        });
      }
    });

    let filtered = list;
    if (activeFilter === 'prova') filtered = filtered.filter(i => i.category === 'prova');
    if (activeFilter === 'simulado') filtered = filtered.filter(i => i.category === 'simulado');
    if (activeFilter === 'tarefa') filtered = filtered.filter(i => i.category === 'tarefa' || i.category === 'evento' || i.category === 'estudo' || i.category === 'lembrete');

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(q) ||
        (i.subject && i.subject.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.content && i.content.toLowerCase().includes(q))
      );
    }

    return filtered.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [effectiveExams, effectiveMockExams, userItems, activeFilter, searchTerm, extractDateStr]);

  // Group agenda items by date
  const agendaGroupedByDate = useMemo(() => {
    const groups: Record<string, typeof allChronologicalItems> = {};
    allChronologicalItems.forEach(item => {
      if (!groups[item.dateStr]) {
        groups[item.dateStr] = [];
      }
      groups[item.dateStr].push(item);
    });
    return Object.entries(groups).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  }, [allChronologicalItems]);

  // Counts for filter pills
  const filterCounts = useMemo(() => {
    const currYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    let provas = 0, simulados = 0, tarefas = 0;

    effectiveExams.forEach(ex => {
      const d = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      if (d && d.startsWith(currYearMonth)) provas++;
    });

    effectiveMockExams.forEach(me => {
      const rawDeadline = me.deadline || me.due_date || me.exam_date;
      const d = extractDateStr(rawDeadline);
      if (d && d.startsWith(currYearMonth)) simulados++;
    });

    userItems.forEach(ui => {
      const d = extractDateStr(ui.date || ui.event_date);
      if (d && d.startsWith(currYearMonth)) {
        tarefas++;
      }
    });

    return { all: provas + simulados + tarefas, provas, simulados, tarefas };
  }, [effectiveExams, effectiveMockExams, userItems, year, month, extractDateStr]);

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Header Toolbar: Clean, open, not box-in-a-box */}
      <div className="space-y-4">
        
        {/* Top line: Title & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                <span>Calendário Acadêmico</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                {userTurma ? `${userTurma} · ` : ''}{userRole === 'teacher' ? 'Docente' : 'Estudante'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Cronograma organizado de provas, simulados e tarefas.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* View Switcher: Mês / Lista */}
            <div className="flex items-center bg-neutral-900 rounded-xl p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mês</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'agenda'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lista</span>
              </button>
            </div>

            {/* Novo Registro button */}
            <button
              type="button"
              onClick={() => {
                setNewItemDate(selectedDayStr);
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Registro</span>
            </button>
          </div>
        </div>

        {/* Navigation & Filters row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Month Stepper */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded-lg text-xs font-medium border border-neutral-800 transition-colors cursor-pointer"
            >
              Hoje
            </button>

            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-neutral-200 select-none min-w-[130px] text-center">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar prova, simulado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-500 outline-none focus:border-emerald-500/80 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  activeFilter === 'all'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todos ({filterCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('prova')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeFilter === 'prova'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                    : 'text-neutral-400 hover:text-rose-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>Provas ({filterCounts.provas})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('simulado')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeFilter === 'simulado'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-neutral-400 hover:text-emerald-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Simulados ({filterCounts.simulados})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('tarefa')}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeFilter === 'tarefa'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Tarefas ({filterCounts.tarefas})</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 2. Main View Mode: Mês or Lista */}
      {viewMode === 'month' ? (
        <div className="space-y-6">
          
          {/* Calendar Month Grid: Clean, flat table layout, NOT heavy nested boxes */}
          <div className="border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-900/30">
            
            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center border-b border-neutral-800/80 bg-neutral-900/60 py-2.5">
              {weekDays.map((day, idx) => (
                <span 
                  key={day} 
                  className={`text-xs font-mono font-semibold uppercase tracking-wider select-none ${
                    idx === 0 || idx === 6 ? 'text-neutral-500' : 'text-neutral-300'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid: Hairline dividers, clean and open */}
            <div className="grid grid-cols-7 divide-x divide-y divide-neutral-800/60">
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

                const showExams = activeFilter === 'all' || activeFilter === 'prova';
                const showMocks = activeFilter === 'all' || activeFilter === 'simulado';
                const showTasks = activeFilter === 'all' || activeFilter === 'tarefa';

                const examsCount = showExams ? dayEvents.exams.length : 0;
                const mocksCount = showMocks ? dayEvents.mockExams.length : 0;
                const userItemsCount = showTasks ? dayEvents.userItems.length : 0;
                const totalVisible = examsCount + mocksCount + userItemsCount;

                let cellClass = 'bg-transparent text-neutral-300 hover:bg-neutral-800/40';

                if (!cell.isCurrentMonth) {
                  cellClass = 'text-neutral-600 opacity-30 hover:opacity-50 cursor-pointer';
                } else if (isSelected) {
                  cellClass = 'bg-emerald-500/10 text-white ring-2 ring-inset ring-emerald-500';
                } else if (isToday) {
                  cellClass = 'bg-neutral-850/60 text-white font-semibold';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayStr(dateStr)}
                    className={`min-h-[75px] sm:min-h-[96px] p-2 text-left flex flex-col justify-between transition-colors relative cursor-pointer ${cellClass}`}
                  >
                    {/* Top Row: Day number & dots */}
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-mono ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-emerald-500 text-neutral-950 font-black flex items-center justify-center'
                          : isSelected
                          ? 'font-black text-emerald-400'
                          : 'font-medium text-neutral-400'
                      }`}>
                        {cell.day}
                      </span>

                      {/* Event indicator dots */}
                      {cell.isCurrentMonth && totalVisible > 0 && (
                        <div className="flex items-center gap-1">
                          {examsCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Prova marcada" />}
                          {mocksCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Simulado online" />}
                          {userItemsCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Tarefa de estudo" />}
                        </div>
                      )}
                    </div>

                    {/* Middle: Clean compact event tags (hidden on very small screens, visible on tablet/desktop) */}
                    {cell.isCurrentMonth && totalVisible > 0 && (
                      <div className="space-y-1 my-1 w-full hidden sm:block">
                        {showExams && dayEvents.exams[0] && (
                          <div className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] truncate font-medium">
                            {dayEvents.exams[0].materia || dayEvents.exams[0].title}
                          </div>
                        )}
                        {showMocks && dayEvents.mockExams[0] && (
                          <div className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] truncate font-medium">
                            {dayEvents.mockExams[0].title}
                          </div>
                        )}
                        {showTasks && dayEvents.userItems[0] && (
                          <div className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] truncate font-medium">
                            {dayEvents.userItems[0].title}
                          </div>
                        )}
                        {totalVisible > 2 && (
                          <span className="text-[9px] text-neutral-500 font-mono pl-1 block">
                            +{totalVisible - 2} mais
                          </span>
                        )}
                      </div>
                    )}

                    {/* Mobile counter */}
                    <div className="sm:hidden w-full flex items-center justify-end">
                      {cell.isCurrentMonth && totalVisible > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {totalVisible}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400 px-4 py-3 bg-neutral-900/50 border-t border-neutral-800">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Prova Presencial</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Simulado Online</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Tarefa / Estudo</span>
                </span>
              </div>
              <span className="text-neutral-500 text-[11px]">
                Selecione um dia para ver os compromissos
              </span>
            </div>

          </div>

          {/* Section: Commitments of the Selected Day */}
          {/* CRITICAL: "CARD EM BAIXO DE CARD" (Stacked vertically in a single spacious column, NOT squeezed side by side) */}
          <div className="space-y-3 pt-2">
            
            {/* Header: Date title & Add button */}
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-neutral-800">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                  Compromissos para esta data
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white capitalize mt-0.5">
                  {selectedDayFormattedHeadline}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewItemDate(selectedDayStr);
                  setIsModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold border border-neutral-800 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                <span>Adicionar Compromisso</span>
              </button>
            </div>

            {/* Vertical Stack: "card em baixo de card", 100% width, generous breathing room */}
            <div className="flex flex-col space-y-3.5 w-full">
              
              {/* Provas Presenciais */}
              {(activeFilter === 'all' || activeFilter === 'prova') && selectedDayEvents.exams.map((ex, i) => {
                const dateInfo = formatExamDateDisplay(ex, ex.exam_time, dbNotifs);
                return (
                  <div 
                    key={`ex-${i}`} 
                    className="w-full p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 border-l-4 border-l-rose-500 space-y-3 transition-colors hover:border-neutral-700"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[11px] font-bold uppercase tracking-wide">
                          Prova Presencial
                        </span>
                        {ex.materia && (
                          <span className="text-xs text-neutral-200 font-bold">
                            {ex.materia}
                          </span>
                        )}
                        {ex.teacher_name && (
                          <span className="text-xs text-neutral-400">
                            · Prof. {ex.teacher_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{dateInfo.fullFormatted || 'Horário de aula'}</span>
                      </div>
                    </div>

                    {/* Title & Content (Clean text, NO nested bordered box!) */}
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {ex.title}
                      </h4>
                      {ex.content && (
                        <p className="text-xs text-neutral-300 mt-2 leading-relaxed whitespace-pre-line">
                          {cleanExamContent(ex.content)}
                        </p>
                      )}
                      {ex.observations && cleanExamObservations(ex.observations) && (
                        <p className="text-xs text-neutral-400 italic mt-1.5">
                          "{cleanExamObservations(ex.observations)}"
                        </p>
                      )}
                    </div>

                    {/* Action button: INTEGRATED CLEANLY INSIDE THE CARD */}
                    {onStudyForExam && (
                      <div className="pt-2 flex items-center justify-end border-t border-neutral-800/60">
                        <button
                          type="button"
                          onClick={() => onStudyForExam(ex.title, cleanExamContent(ex.content) || '')}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Estudar com IA Athenas</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Simulados Online */}
              {(activeFilter === 'all' || activeFilter === 'simulado') && selectedDayEvents.mockExams.map((me, i) => {
                const rawDeadline = me.deadline || me.due_date || me.exam_date;
                const meDateInfo = rawDeadline ? formatExamDateDisplay(rawDeadline) : null;
                return (
                  <div 
                    key={`me-${i}`} 
                    className="w-full p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 border-l-4 border-l-emerald-500 space-y-3 transition-colors hover:border-neutral-700"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold uppercase tracking-wide">
                          Simulado Online
                        </span>
                        {me.subject && (
                          <span className="text-xs text-neutral-200 font-bold">
                            {me.subject}
                          </span>
                        )}
                        {me.teacher_name && (
                          <span className="text-xs text-neutral-400">
                            · Prof. {me.teacher_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{rawDeadline && meDateInfo?.fullFormatted ? meDateInfo.fullFormatted : 'Prazo livre'}</span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {me.title}
                      </h4>
                      {me.description && (
                        <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                          {me.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons: INTEGRATED CLEANLY INSIDE THE CARD */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800/60">
                      {userRole === 'student' && onTakeMockExam && (
                        <button
                          type="button"
                          onClick={onTakeMockExam}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <span>Iniciar Simulado</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {userRole === 'teacher' && onViewResults && (
                        <button
                          type="button"
                          onClick={onViewResults}
                          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ver Resultados da Turma
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* User Items: Tarefas & Eventos Pessoais */}
              {(activeFilter === 'all' || activeFilter === 'tarefa') && selectedDayEvents.userItems.map(item => {
                const isTask = item.type === 'tarefa';
                const isChecked = item.completed;

                return (
                  <div
                    key={item.id}
                    className={`w-full p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 transition-colors hover:border-neutral-700 space-y-3 ${
                      isTask ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-sky-500'
                    } ${isChecked ? 'opacity-60' : ''}`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTask && (
                          <button
                            type="button"
                            onClick={() => handleToggleTaskCompleted(item.id)}
                            className="text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-500" />
                            )}
                          </button>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                          isTask ? 'bg-amber-500/15 text-amber-300' : 'bg-sky-500/15 text-sky-300'
                        }`}>
                          {item.type} {item.subject ? `· ${item.subject}` : ''}
                        </span>
                        {item.priority && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            item.priority === 'alta' ? 'bg-rose-500/20 text-rose-300' :
                            item.priority === 'media' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-neutral-800 text-neutral-300'
                          }`}>
                            {item.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {item.time && (
                          <span className="text-xs text-neutral-400 font-mono">
                            {item.time}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteUserItem(item)}
                          className="text-neutral-500 hover:text-rose-400 transition-colors p-1.5 cursor-pointer rounded-lg hover:bg-neutral-800"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h4 className={`text-base font-bold text-white ${isChecked ? 'line-through text-neutral-500' : ''}`}>
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty state for selected date */}
              {selectedDayEvents.exams.length === 0 &&
               selectedDayEvents.mockExams.length === 0 &&
               selectedDayEvents.userItems.length === 0 && (
                <div className="w-full py-12 text-center border border-dashed border-neutral-800 rounded-2xl p-6 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                    <CalendarCheck2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-200">
                      Nenhum compromisso marcado para este dia
                    </h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                      Você está livre nesta data. Deseja adicionar uma meta de estudos ou tarefa pessoal?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewItemDate(selectedDayStr);
                      setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar tarefa para esta data</span>
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        /* Agenda / Lista View: 100% "card em baixo de card", continuous vertical timeline */
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white">Cronograma Completo de Atividades</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Visualização contínua de todos os compromissos em ordem de data.
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {allChronologicalItems.length} registros encontrados
            </span>
          </div>

          {agendaGroupedByDate.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-dashed border-neutral-800 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <CalendarIcon className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-sm font-bold text-neutral-200">
                Nenhum compromisso encontrado para os filtros atuais.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchTerm('');
                }}
                className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
              >
                Limpar filtros e busca
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {agendaGroupedByDate.map(([dateKey, items]) => {
                let dateDisplay = dateKey;
                try {
                  const [y, m, d] = dateKey.split('-').map(Number);
                  dateDisplay = new Intl.DateTimeFormat('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }).format(new Date(y, m - 1, d));
                } catch {
                  // ignore
                }

                const isToday = (() => {
                  const today = new Date().toISOString().slice(0, 10);
                  return today === dateKey;
                })();

                return (
                  <div key={dateKey} className="space-y-3">
                    {/* Date Header */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                        isToday 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                          : 'text-neutral-400 font-semibold'
                      }`}>
                        {dateDisplay} {isToday && '· Hoje'}
                      </span>
                      <div className="flex-1 h-px bg-neutral-800" />
                    </div>

                    {/* Cards Stacked Vertically ("card em baixo de card") */}
                    <div className="flex flex-col space-y-3 w-full">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="w-full p-4 sm:p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-3 hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                            <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase ${
                              item.category === 'prova'
                                ? 'text-rose-300'
                                : item.category === 'simulado'
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                item.category === 'prova'
                                  ? 'bg-rose-400'
                                  : item.category === 'simulado'
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                              }`} />
                              <span>{item.category} {item.subject ? `· ${item.subject}` : ''}</span>
                            </span>

                            {item.timeStr && (
                              <span className="font-mono text-xs text-neutral-400">
                                {item.timeStr}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-white">
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs text-neutral-300 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {item.content && (
                            <p className="text-xs text-neutral-300 leading-relaxed">
                              {item.content}
                            </p>
                          )}

                          {/* Action inside card */}
                          {item.category === 'prova' && onStudyForExam && (
                            <div className="pt-2 flex justify-end border-t border-neutral-800/60">
                              <button
                                type="button"
                                onClick={() => onStudyForExam(item.title, item.content || '')}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Estudar com IA Athenas</span>
                              </button>
                            </div>
                          )}

                          {item.category === 'simulado' && userRole === 'student' && onTakeMockExam && (
                            <div className="pt-2 flex justify-end border-t border-neutral-800/60">
                              <button
                                type="button"
                                onClick={onTakeMockExam}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <span>Iniciar Simulado</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {item.category === 'tarefa' && (
                            <div className="pt-2 flex items-center justify-between border-t border-neutral-800/60">
                              <button
                                type="button"
                                onClick={() => handleToggleTaskCompleted(item.id)}
                                className="flex items-center gap-2 text-xs font-medium text-neutral-300 hover:text-emerald-400 cursor-pointer"
                              >
                                {item.completed ? (
                                  <>
                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                    <span className="text-neutral-500 line-through">Concluída</span>
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-4 h-4" />
                                    <span>Concluir tarefa</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => requestDeleteUserItem(item.rawObject)}
                                className="text-neutral-500 hover:text-rose-400 p-1.5 cursor-pointer rounded-lg hover:bg-neutral-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Modal: Criar Registro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Novo Registro na Agenda
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Tipo de Registro
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemType('tarefa')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        newItemType === 'tarefa'
                          ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs">Tarefa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemType('estudo')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        newItemType === 'estudo'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-white font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs">Estudo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemType('evento')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        newItemType === 'evento'
                          ? 'bg-sky-500/20 border-sky-500/60 text-white font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs">Evento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemType('lembrete')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        newItemType === 'lembrete'
                          ? 'bg-purple-500/20 border-purple-500/60 text-white font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs">Lembrete</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Revisar Bioquímica, Entregar lista..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Data *
                    </label>
                    <input
                      type="date"
                      required
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Horário
                    </label>
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Prioridade
                    </label>
                    <select
                      value={newItemPriority}
                      onChange={(e) => setNewItemPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Disciplina / Matéria
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Biologia..."
                      value={newItemSubject}
                      onChange={(e) => setNewItemSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Observações / Anotações
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detalhes adicionais..."
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500/80 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newItemTitle.trim() || !newItemDate.trim()}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Salvar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Modal Confirmar Exclusão */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl"
              role="alertdialog"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-neutral-100">
                  Remover compromisso?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Confirma a exclusão de <strong className="text-neutral-200">"{itemToDelete.title}"</strong> da sua agenda?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUserItem}
                  className="py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Remover
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Toast Feedback com Desfazer (Undo) */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/95 text-neutral-200 shadow-2xl text-xs backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{toastFeedback.message}</span>
            </div>

            {undoItem && (
              <button
                type="button"
                onClick={handleUndoDelete}
                className="ml-2 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setToastFeedback(null)}
              className="text-neutral-500 hover:text-neutral-200 p-0.5 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
