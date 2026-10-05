import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Undo2,
  CalendarRange,
  Flame,
  CheckCircle2,
  ChevronDown,
  CalendarCheck,
  CalendarClock,
  Pin,
  GraduationCap,
  Bell,
  CheckCircle,
  Clock3,
  Compass,
  Laptop
} from 'lucide-react';
import { parseExamSettings, cleanExamContent, formatExamDateDisplay, cleanExamObservations, extractExamTime } from '../utils/examSettings';
import { matchesStudentTarget, matchesStudentExam } from '../utils/targetMatcher';
import { areTurmasMatching } from '../utils/profileDb';

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'prova' | 'simulado' | 'evento' | 'tarefa'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

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
  const [newItemType, setNewItemType] = useState<'evento' | 'tarefa' | 'estudo' | 'lembrete'>('evento');
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
        subject: newItem.subject || null,
        description: newItem.description || null,
        completed: false
      });
    } catch {
      // Ignored - fallback to LocalStorage
    }

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

    if (undoTimer) clearTimeout(undoTimer);

    setUserItems(prev => prev.filter(item => item.id !== target.id));
    setUndoItem(target);

    setToastFeedback({
      type: 'success',
      message: `Compromisso "${target.title}" removido.`
    });

    const timer = setTimeout(async () => {
      setUndoItem(null);
      try {
        await supabase
          .from('user_calendar_events')
          .delete()
          .eq('id', target.id);
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

    setUserItems(prev => [restored, ...prev]);

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
      message: `"${restored.title}" foi restaurado.`
    });
  };

  // Selected day items filtered
  const selectedDayEvents = useMemo(() => {
    if (!selectedDayStr) return { exams: [], mockExams: [], userItems: [], totalCount: 0 };
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    const events = getEventsForDate(y, m - 1, d);

    // Apply search filter if typed
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return {
        exams: events.exams.filter(ex => 
          (ex.title && ex.title.toLowerCase().includes(q)) || 
          (ex.materia && ex.materia.toLowerCase().includes(q)) ||
          (ex.content && ex.content.toLowerCase().includes(q))
        ),
        mockExams: events.mockExams.filter(me => 
          (me.title && me.title.toLowerCase().includes(q)) || 
          (me.subject && me.subject.toLowerCase().includes(q))
        ),
        userItems: events.userItems.filter(ui => 
          (ui.title && ui.title.toLowerCase().includes(q)) || 
          (ui.description && ui.description.toLowerCase().includes(q)) ||
          (ui.subject && ui.subject.toLowerCase().includes(q))
        ),
        totalCount: events.totalCount
      };
    }

    return events;
  }, [selectedDayStr, getEventsForDate, searchTerm]);

  // Overall statistics for the month
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

    const totalTasksThisMonth = userItems.filter(i => {
      const d = extractDateStr(i.date || i.event_date);
      return i.type === 'tarefa' && d && d.startsWith(currentYearMonth);
    }).length;

    const completedTasksThisMonth = userItems.filter(i => {
      const d = extractDateStr(i.date || i.event_date);
      return i.type === 'tarefa' && i.completed && d && d.startsWith(currentYearMonth);
    }).length;

    const pendingUserTasks = userItems.filter(i => {
      return i.type === 'tarefa' && !i.completed;
    }).length;

    // Nearest upcoming exam or mock
    const todayIso = new Date().toISOString().slice(0, 10);
    const allUpcoming = [
      ...effectiveExams.map(e => ({
        title: e.title,
        materia: e.materia || 'Geral',
        type: 'Prova Presencial',
        date: extractDateStr(e.exam_date || e.date || e.data_prova || e.data),
        color: 'rose'
      })),
      ...effectiveMockExams.map(m => ({
        title: m.title,
        materia: m.subject || 'Simulado',
        type: 'Simulado Online',
        date: extractDateStr(m.deadline || m.due_date || m.exam_date),
        color: 'emerald'
      }))
    ]
      .filter(item => item.date && item.date >= todayIso)
      .sort((a, b) => (a.date! > b.date! ? 1 : -1));

    const nextEvent = allUpcoming[0] || null;

    // Days difference to next event
    let daysToNextEvent = null;
    if (nextEvent?.date) {
      const todayDate = new Date(todayIso);
      const nextDate = new Date(nextEvent.date);
      const diffTime = nextDate.getTime() - todayDate.getTime();
      daysToNextEvent = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      totalExamsThisMonth,
      totalMocksThisMonth,
      totalTasksThisMonth,
      completedTasksThisMonth,
      pendingUserTasks,
      nextEvent,
      daysToNextEvent
    };
  }, [effectiveExams, effectiveMockExams, userItems, year, month, extractDateStr]);

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

  // All chronological events for Agenda view
  const allChronologicalItems = useMemo(() => {
    const list: {
      id: string;
      title: string;
      category: 'prova' | 'simulado' | 'evento' | 'tarefa' | 'estudo' | 'lembrete';
      dateStr: string;
      timeStr?: string;
      subject?: string;
      teacherName?: string;
      description?: string;
      content?: string;
      completed?: boolean;
      priority?: 'baixa' | 'media' | 'alta';
      rawObject: any;
    }[] = [];

    // Provas
    effectiveExams.forEach(ex => {
      const d = extractDateStr(ex.exam_date || ex.date || ex.data_prova || ex.data);
      if (d) {
        list.push({
          id: `ex-${ex.id || ex.title}-${d}`,
          title: ex.title,
          category: 'prova',
          dateStr: d,
          timeStr: ex.exam_time || undefined,
          subject: ex.materia || 'Geral',
          teacherName: ex.teacher_name,
          content: cleanExamContent(ex.content),
          description: cleanExamObservations(ex.observations),
          rawObject: ex
        });
      }
    });

    // Simulados
    effectiveMockExams.forEach(me => {
      const rawDeadline = me.deadline || me.due_date || me.exam_date;
      const d = extractDateStr(rawDeadline);
      if (d) {
        list.push({
          id: `me-${me.id || me.title}-${d}`,
          title: me.title,
          category: 'simulado',
          dateStr: d,
          timeStr: undefined,
          subject: me.subject || 'Simulado',
          teacherName: me.teacher_name,
          description: me.description,
          rawObject: me
        });
      }
    });

    // User Items
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

    // Filter by category
    let filtered = list;
    if (activeFilter === 'prova') filtered = filtered.filter(i => i.category === 'prova');
    if (activeFilter === 'simulado') filtered = filtered.filter(i => i.category === 'simulado');
    if (activeFilter === 'evento') filtered = filtered.filter(i => i.category === 'evento' || i.category === 'estudo' || i.category === 'lembrete');
    if (activeFilter === 'tarefa') filtered = filtered.filter(i => i.category === 'tarefa');

    // Filter by search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(q) ||
        (i.subject && i.subject.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q))
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

  // Current week days calculation for Week View
  const currentWeekDays = useMemo(() => {
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const dayOfWeek = selectedDate.getDay(); // 0 is Sunday
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dy = dayDate.getFullYear();
      const dm = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(dayDate.getDate()).padStart(2, '0');
      const dateStr = `${dy}-${dm}-${dd}`;

      days.push({
        date: dayDate,
        dateStr,
        dayNumber: dayDate.getDate(),
        weekdayLabel: weekDays[i],
        isToday: (() => {
          const today = new Date();
          return today.getDate() === dayDate.getDate() && 
                 today.getMonth() === dayDate.getMonth() && 
                 today.getFullYear() === dayDate.getFullYear();
        })(),
        isSelected: dateStr === selectedDayStr
      });
    }
    return days;
  }, [selectedDayStr, weekDays]);

  // Dynamic counts for quick filter tags
  const filterCounts = useMemo(() => {
    const today = new Date();
    const currYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    let provas = 0;
    let simulados = 0;
    let tarefas = 0;
    let eventos = 0;

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
        if (ui.type === 'tarefa') tarefas++;
        else eventos++;
      }
    });

    return {
      all: provas + simulados + tarefas + eventos,
      provas,
      simulados,
      tarefas,
      eventos
    };
  }, [effectiveExams, effectiveMockExams, userItems, year, month, extractDateStr]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner & Executive Metric Strip */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900/90 via-neutral-900/70 to-neutral-950/90 border border-neutral-800/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-black/40">
        {/* Subtle decorative glow circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Brand & Contextual Headline */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-400/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Calendário Acadêmico
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  {userTurma ? `${userTurma} · ` : ''}{userRole === 'teacher' ? 'Docente' : 'Estudante'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl font-normal leading-relaxed">
                Gestão centralizada de avaliações, simulados online e cronograma individual de estudos.
              </p>
            </div>
          </div>

          {/* Top Actions: View Mode Switcher + New Item */}
          <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
            {/* View Mode Segmented Control */}
            <div className="inline-flex p-1 bg-neutral-950/90 border border-neutral-800 rounded-2xl shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mês</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5 text-emerald-400" />
                <span>Semana</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'agenda'
                    ? 'bg-neutral-800 text-white shadow-md border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Agenda</span>
              </button>
            </div>

            {/* Create Item Button */}
            <button
              type="button"
              onClick={() => {
                setNewItemDate(selectedDayStr);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Registro</span>
            </button>
          </div>
        </div>

        {/* 2. Structured Executive KPI Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-6 mt-6 border-t border-neutral-800/80">
          
          {/* Provas Presenciais */}
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-rose-500/30 transition-all flex items-center justify-between group">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                Provas Presenciais
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-white tabular-nums">
                  {monthlyStats.totalExamsThisMonth}
                </span>
                <span className="text-[11px] text-neutral-500">neste mês</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {/* Simulados Online */}
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-emerald-500/30 transition-all flex items-center justify-between group">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Simulados Online
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-white tabular-nums">
                  {monthlyStats.totalMocksThisMonth}
                </span>
                <span className="text-[11px] text-neutral-500">cadastrados</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Laptop className="w-5 h-5" />
            </div>
          </div>

          {/* Tarefas e Metas */}
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-amber-500/30 transition-all flex items-center justify-between group">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Tarefas Pessoais
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-white tabular-nums">
                  {monthlyStats.pendingUserTasks}
                </span>
                <span className="text-[11px] text-neutral-500">pendentes</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>

          {/* Próximo Marco */}
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-sky-500/30 transition-all flex items-center justify-between group">
            <div className="truncate pr-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Próximo Marco
              </span>
              {monthlyStats.nextEvent ? (
                <div className="mt-1 truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {monthlyStats.nextEvent.date?.split('-').reverse().slice(0, 2).join('/')}
                    </span>
                    {monthlyStats.daysToNextEvent !== null && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        monthlyStats.daysToNextEvent === 0 
                          ? 'bg-rose-500/20 text-rose-300' 
                          : monthlyStats.daysToNextEvent <= 2 
                          ? 'bg-amber-500/20 text-amber-300' 
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {monthlyStats.daysToNextEvent === 0 
                          ? 'Hoje!' 
                          : monthlyStats.daysToNextEvent === 1 
                          ? 'Amanhã' 
                          : `em ${monthlyStats.daysToNextEvent}d`}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-200 truncate block mt-0.5">
                    {monthlyStats.nextEvent.title}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs font-semibold text-neutral-400">
                  Agenda em dia
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. Modern Control & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-neutral-900/60 p-3.5 rounded-2xl border border-neutral-800/80 backdrop-blur-md">
        
        {/* Month Navigator & Jump to Today */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-3.5 py-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-xl text-xs font-bold border border-neutral-750 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Hoje
          </button>

          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-xs font-bold text-white select-none min-w-[140px] text-center tracking-wide">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Dynamic Filter Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar matéria, título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-emerald-500/80 transition-colors"
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

          {/* Category Filter Chips with Dynamic Badges */}
          <div className="inline-flex p-1 bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                activeFilter === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] font-mono px-1 rounded bg-neutral-900 text-neutral-400">
                {filterCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('prova')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                activeFilter === 'prova'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Provas</span>
              {filterCounts.provas > 0 && (
                <span className="text-[10px] font-mono px-1 rounded bg-rose-950 text-rose-300">
                  {filterCounts.provas}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('simulado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                activeFilter === 'simulado'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Simulados</span>
              {filterCounts.simulados > 0 && (
                <span className="text-[10px] font-mono px-1 rounded bg-emerald-950 text-emerald-300">
                  {filterCounts.simulados}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('tarefa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                activeFilter === 'tarefa'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Tarefas</span>
              {filterCounts.tarefas > 0 && (
                <span className="text-[10px] font-mono px-1 rounded bg-amber-950 text-amber-300">
                  {filterCounts.tarefas}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('evento')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                activeFilter === 'evento'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Eventos</span>
              {filterCounts.eventos > 0 && (
                <span className="text-[10px] font-mono px-1 rounded bg-sky-950 text-sky-300">
                  {filterCounts.eventos}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 4. Main Body: MONTH VIEW, WEEK VIEW, OR AGENDA FEED */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Calendar Month Grid (7 columns on desktop) */}
          <div className="lg:col-span-7 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-md">
            
            {/* Weekday labels */}
            <div className="grid grid-cols-7 text-center mb-3">
              {weekDays.map((day, idx) => (
                <span 
                  key={day} 
                  className={`text-[11px] font-mono font-bold uppercase tracking-wider py-1.5 select-none ${
                    idx === 0 || idx === 6 ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
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
                const showExams = activeFilter === 'all' || activeFilter === 'prova';
                const showMocks = activeFilter === 'all' || activeFilter === 'simulado';
                const showEvents = activeFilter === 'all' || activeFilter === 'evento';
                const showTasks = activeFilter === 'all' || activeFilter === 'tarefa';

                const examsCount = showExams ? dayEvents.exams.length : 0;
                const mocksCount = showMocks ? dayEvents.mockExams.length : 0;
                const userEventsCount = showEvents ? dayEvents.userItems.filter(i => i.type !== 'tarefa').length : 0;
                const userTasksCount = showTasks ? dayEvents.userItems.filter(i => i.type === 'tarefa').length : 0;
                const totalVisible = examsCount + mocksCount + userEventsCount + userTasksCount;

                // Categories present
                const hasExam = examsCount > 0;
                const hasMock = mocksCount > 0;
                const hasTask = userTasksCount > 0;
                const hasEvent = userEventsCount > 0;

                // Base style for the calendar cell
                let cellStyle = 'bg-neutral-950/50 text-neutral-300 border-neutral-850 hover:border-neutral-700 hover:bg-neutral-900/60 shadow-inner';

                if (!cell.isCurrentMonth) {
                  cellStyle = 'bg-neutral-950/20 text-neutral-600 border-neutral-900/40 opacity-35 hover:opacity-60';
                } else if (isSelected) {
                  cellStyle = 'bg-neutral-850/95 text-white border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/30';
                } else if (isToday) {
                  cellStyle = 'bg-neutral-900/90 text-white border-emerald-500/60';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayStr(dateStr)}
                    className={`group aspect-square min-h-[68px] sm:min-h-[82px] rounded-2xl p-2 border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${cellStyle}`}
                  >
                    {/* Top Row: Date Number and Category Dot Indicators */}
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-mono tabular-nums leading-none ${
                        isToday
                          ? 'px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black shadow-sm'
                          : isSelected
                          ? 'font-black text-emerald-400'
                          : 'font-semibold text-neutral-300'
                      }`}>
                        {cell.day}
                      </span>

                      {/* Small subtle status indicators */}
                      {cell.isCurrentMonth && totalVisible > 0 && (
                        <div className="flex items-center gap-1">
                          {hasExam && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Prova" />}
                          {hasMock && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Simulado" />}
                          {hasTask && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Tarefa" />}
                          {hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Evento" />}
                        </div>
                      )}
                    </div>

                    {/* Middle: Clean High-End Schedule Chips */}
                    {cell.isCurrentMonth && totalVisible > 0 && (
                      <div className="space-y-1 my-auto w-full hidden sm:block">
                        {showExams && dayEvents.exams[0] && (
                          <div className="flex items-center gap-1 border-l-2 border-rose-500 bg-rose-500/15 text-rose-200 px-1.5 py-0.5 rounded-r text-[10px] truncate font-medium">
                            <span className="truncate">{dayEvents.exams[0].materia || dayEvents.exams[0].title}</span>
                          </div>
                        )}
                        {showMocks && dayEvents.mockExams[0] && (
                          <div className="flex items-center gap-1 border-l-2 border-emerald-400 bg-emerald-500/15 text-emerald-200 px-1.5 py-0.5 rounded-r text-[10px] truncate font-medium">
                            <span className="truncate">{dayEvents.mockExams[0].title}</span>
                          </div>
                        )}
                        {showTasks && dayEvents.userItems.filter(i => i.type === 'tarefa')[0] && (
                          <div className="flex items-center gap-1 border-l-2 border-amber-400 bg-amber-500/15 text-amber-200 px-1.5 py-0.5 rounded-r text-[10px] truncate font-medium">
                            <span className="truncate">{dayEvents.userItems.filter(i => i.type === 'tarefa')[0].title}</span>
                          </div>
                        )}
                        {showEvents && dayEvents.userItems.filter(i => i.type !== 'tarefa')[0] && (
                          <div className="flex items-center gap-1 border-l-2 border-sky-400 bg-sky-500/15 text-sky-200 px-1.5 py-0.5 rounded-r text-[10px] truncate font-medium">
                            <span className="truncate">{dayEvents.userItems.filter(i => i.type !== 'tarefa')[0].title}</span>
                          </div>
                        )}
                        {totalVisible > 2 && (
                          <span className="text-[9.5px] text-neutral-400 font-mono font-medium block pl-1">
                            +{totalVisible - 2} mais
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bottom Indicator for Mobile */}
                    <div className="sm:hidden w-full flex items-center justify-end">
                      {cell.isCurrentMonth && totalVisible > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold tabular-nums">
                          {totalVisible}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quiet Footer Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400 pt-5 mt-5 border-t border-neutral-800/80">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="font-medium text-neutral-300">Prova Presencial</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="font-medium text-neutral-300">Simulado Online</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="font-medium text-neutral-300">Tarefa</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <span className="font-medium text-neutral-300">Evento / Lembrete</span>
                </span>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                {currentMonthDays.length} dias no mês
              </span>
            </div>
          </div>

          {/* 5. Selected Day Detail Inspector Panel (5 columns) */}
          <div className="lg:col-span-5 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl backdrop-blur-md">
            
            {/* Inspector Header */}
            <div className="flex items-start justify-between border-b border-neutral-800/80 pb-4 gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                  Agenda Diária
                </span>
                <h3 className="text-base font-black text-white capitalize mt-0.5">
                  {selectedDayFormattedHeadline}
                </h3>
                <span className="text-xs text-neutral-400 font-medium mt-0.5 block">
                  {selectedDayEvents.totalCount} compromisso(s) registrado(s)
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewItemDate(selectedDayStr);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl text-xs font-bold border border-neutral-700/80 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* List of Events for the Day */}
            <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
              
              {/* Provas Presenciais */}
              {(activeFilter === 'all' || activeFilter === 'prova') && selectedDayEvents.exams.map((ex, i) => {
                const dateInfo = formatExamDateDisplay(ex, ex.exam_time, dbNotifs);
                return (
                  <div 
                    key={`ex-${i}`} 
                    className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-rose-500/50 transition-all space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="font-bold text-rose-300 font-mono text-[11px] uppercase tracking-wide">
                          {ex.materia || 'Prova Presencial'}
                        </span>
                      </div>
                      {ex.teacher_name && (
                        <span className="text-[11px] text-neutral-400 font-mono bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                          Prof. {ex.teacher_name}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {ex.title}
                      </h4>
                      {ex.content && (
                        <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-850">
                          {cleanExamContent(ex.content)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 text-xs font-mono text-neutral-400 border-t border-neutral-900">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{dateInfo.fullFormatted || 'Horário de aula'}</span>
                      </span>

                      {onStudyForExam && (
                        <button
                          type="button"
                          onClick={() => onStudyForExam(ex.title, cleanExamContent(ex.content) || '')}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Estudar com IA</span>
                        </button>
                      )}
                    </div>
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
                    className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="font-bold text-emerald-300 font-mono text-[11px] uppercase tracking-wide">
                          Simulado · {me.subject || 'Geral'}
                        </span>
                      </div>
                      {me.teacher_name && (
                        <span className="text-[11px] text-neutral-400 font-mono bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                          Prof. {me.teacher_name}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {me.title}
                      </h4>
                      {me.description && (
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                          {me.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 text-xs font-mono text-neutral-400 border-t border-neutral-900">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>
                          {rawDeadline && meDateInfo?.fullFormatted 
                            ? meDateInfo.fullFormatted 
                            : 'Prazo livre'}
                        </span>
                      </span>

                      {userRole === 'student' && onTakeMockExam && (
                        <button
                          type="button"
                          onClick={onTakeMockExam}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <span>Iniciar Prova</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {userRole === 'teacher' && onViewResults && (
                        <button
                          type="button"
                          onClick={onViewResults}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl text-xs font-bold border border-neutral-700 transition-colors cursor-pointer"
                        >
                          Ver Resultados
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* User Items: Tarefas & Eventos */}
              {selectedDayEvents.userItems.map(item => {
                const isTask = item.type === 'tarefa';
                const isChecked = item.completed;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-md ${
                      isChecked
                        ? 'bg-neutral-950/40 border-neutral-850/60 opacity-60'
                        : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {isTask && (
                          <button
                            type="button"
                            onClick={() => handleToggleTaskCompleted(item.id)}
                            className="text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-500" />
                            )}
                          </button>
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${isTask ? 'bg-amber-400' : 'bg-sky-400'}`} />
                        <span className={`font-mono text-[11px] font-bold uppercase tracking-wide ${
                          isTask ? 'text-amber-300' : 'text-sky-300'
                        }`}>
                          {item.type} {item.subject ? `· ${item.subject}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {item.time && (
                          <span className="text-xs text-neutral-400 font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                            {item.time}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteUserItem(item)}
                          className="text-neutral-500 hover:text-rose-400 transition-colors p-1 cursor-pointer rounded-lg hover:bg-neutral-900"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className={`text-xs sm:text-sm font-semibold text-white ${isChecked ? 'line-through text-neutral-500' : ''}`}>
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty state for the selected day */}
              {selectedDayEvents.exams.length === 0 &&
               selectedDayEvents.mockExams.length === 0 &&
               selectedDayEvents.userItems.length === 0 && (
                <div className="py-14 text-center space-y-3 bg-neutral-950/40 rounded-2xl border border-neutral-850 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                    <CalendarCheck className="w-6 h-6 text-emerald-500/70" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-neutral-200">
                      Nenhum compromisso marcado
                    </h5>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Aproveite este dia livre ou planeje uma meta de estudo personalizada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewItemDate(selectedDayStr);
                      setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agendar para esta data</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* 5. WEEK VIEW (7-DAY COLUMN SCHEDULE) */
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-4 gap-2">
            <div>
              <h3 className="text-base font-black text-white">Visualização Semanal</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Distribuição dos compromissos e tarefas ao longo dos 7 dias da semana selecionada.
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
              Semana de {currentWeekDays[0].dayNumber} a {currentWeekDays[6].dayNumber} de {monthNames[month]}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeekDays.map(weekDay => {
              const dayEvents = getEventsForDate(
                weekDay.date.getFullYear(),
                weekDay.date.getMonth(),
                weekDay.date.getDate()
              );

              return (
                <div 
                  key={weekDay.dateStr}
                  onClick={() => setSelectedDayStr(weekDay.dateStr)}
                  className={`rounded-2xl p-3 border transition-all flex flex-col justify-between min-h-[300px] cursor-pointer ${
                    weekDay.isSelected
                      ? 'bg-neutral-900 border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-lg'
                      : weekDay.isToday
                      ? 'bg-neutral-950/80 border-emerald-500/50'
                      : 'bg-neutral-950/50 border-neutral-850 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                      <span className="text-[11px] font-mono font-bold uppercase text-neutral-400">
                        {weekDay.weekdayLabel}
                      </span>
                      <span className={`text-xs font-mono tabular-nums ${
                        weekDay.isToday 
                          ? 'px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black' 
                          : weekDay.isSelected 
                          ? 'font-black text-emerald-400' 
                          : 'font-semibold text-neutral-300'
                      }`}>
                        {weekDay.dayNumber}
                      </span>
                    </div>

                    {/* Day Events Stack */}
                    <div className="space-y-2 mt-2">
                      {dayEvents.exams.map((ex, i) => (
                        <div key={`we-${i}`} className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                          <span className="font-bold block truncate">{ex.materia || ex.title}</span>
                          <span className="text-[10px] text-rose-300 block truncate">{ex.title}</span>
                        </div>
                      ))}

                      {dayEvents.mockExams.map((me, i) => (
                        <div key={`wm-${i}`} className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs">
                          <span className="font-bold block truncate">{me.title}</span>
                          <span className="text-[10px] text-emerald-300 block truncate">{me.subject || 'Simulado'}</span>
                        </div>
                      ))}

                      {dayEvents.userItems.map((ui, i) => (
                        <div key={`wu-${i}`} className={`p-2 rounded-xl border text-xs ${
                          ui.type === 'tarefa'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                            : 'bg-sky-500/15 border-sky-500/30 text-sky-200'
                        }`}>
                          <span className="font-bold block truncate">{ui.title}</span>
                          {ui.time && <span className="text-[10px] font-mono text-neutral-400">{ui.time}</span>}
                        </div>
                      ))}

                      {dayEvents.totalCount === 0 && (
                        <span className="text-[11px] text-neutral-600 block text-center py-6">
                          Sem atividades
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewItemDate(weekDay.dateStr);
                      setSelectedDayStr(weekDay.dateStr);
                      setIsModalOpen(true);
                    }}
                    className="w-full mt-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-[11px] font-bold border border-neutral-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 6. AGENDA FEED VIEW (CHRONOLOGICAL TIMELINE) */
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
            <div>
              <h3 className="text-base font-black text-white">Linha do Tempo de Atividades</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Visualização cronológica contínua de todas as provas, simulados e tarefas acadêmicas.
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-xl border border-neutral-800">
              {allChronologicalItems.length} registros encontrados
            </span>
          </div>

          {agendaGroupedByDate.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <CalendarRange className="w-6 h-6 text-neutral-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-200">
                  Nenhum compromisso encontrado para os filtros atuais.
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Tente alterar os filtros ou adicione uma nova entrada na agenda.
                </p>
              </div>
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
                    {/* Date Divider Header */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                        isToday 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                          : 'bg-neutral-950 text-neutral-300 border border-neutral-800'
                      }`}>
                        {dateDisplay} {isToday && '· Hoje'}
                      </span>
                      <div className="flex-1 h-px bg-neutral-800/80" />
                    </div>

                    {/* Cards for this date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pl-3 border-l-2 border-neutral-800/80">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl space-y-2.5 hover:border-neutral-700 transition-all shadow-md"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase ${
                              item.category === 'prova'
                                ? 'text-rose-300'
                                : item.category === 'simulado'
                                ? 'text-emerald-300'
                                : item.category === 'tarefa'
                                ? 'text-amber-300'
                                : 'text-sky-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                item.category === 'prova'
                                  ? 'bg-rose-400'
                                  : item.category === 'simulado'
                                  ? 'bg-emerald-400'
                                  : item.category === 'tarefa'
                                  ? 'bg-amber-400'
                                  : 'bg-sky-400'
                              }`} />
                              <span>{item.category} {item.subject ? `· ${item.subject}` : ''}</span>
                            </span>

                            {item.timeStr && (
                              <span className="font-mono text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                                {item.timeStr}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-white">
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs text-neutral-400 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {item.category === 'tarefa' && (
                            <div className="pt-2.5 border-t border-neutral-900 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleToggleTaskCompleted(item.id)}
                                className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-emerald-400 cursor-pointer"
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
                                className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer rounded hover:bg-neutral-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {item.category === 'prova' && onStudyForExam && (
                            <div className="pt-2.5 border-t border-neutral-900 flex justify-end">
                              <button
                                type="button"
                                onClick={() => onStudyForExam(item.title, item.content || '')}
                                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Gerar Plano com IA</span>
                              </button>
                            </div>
                          )}

                          {item.category === 'simulado' && userRole === 'student' && onTakeMockExam && (
                            <div className="pt-2.5 border-t border-neutral-900 flex justify-end">
                              <button
                                type="button"
                                onClick={onTakeMockExam}
                                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                              >
                                <span>Responder Simulado</span>
                                <ArrowRight className="w-3.5 h-3.5" />
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

      {/* 7. Modal Criar Evento / Tarefa com Design Modernizado */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Novo Registro na Agenda
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Adicione eventos, lembretes ou tarefas ao seu cronograma pessoal.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4">
                {/* Visual Category Selector Cards */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                    Tipo de Registro
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemType('evento')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        newItemType === 'evento'
                          ? 'bg-sky-500/20 border-sky-500/60 text-white shadow-sm ring-1 ring-sky-500/40'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <CalendarIcon className="w-4 h-4 text-sky-400" />
                      <span className="text-[11px] font-bold">Evento</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewItemType('tarefa')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        newItemType === 'tarefa'
                          ? 'bg-amber-500/20 border-amber-500/60 text-white shadow-sm ring-1 ring-amber-500/40'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px] font-bold">Tarefa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewItemType('estudo')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        newItemType === 'estudo'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-white shadow-sm ring-1 ring-emerald-500/40'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <span className="text-[11px] font-bold">Estudo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewItemType('lembrete')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        newItemType === 'lembrete'
                          ? 'bg-purple-500/20 border-purple-500/60 text-white shadow-sm ring-1 ring-purple-500/40'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Bell className="w-4 h-4 text-purple-400" />
                      <span className="text-[11px] font-bold">Lembrete</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Revisar Bioquímica, Entregar trabalho..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                      Data *
                    </label>
                    <input
                      type="date"
                      required
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                      Horário
                    </label>
                    <input
                      type="time"
                      value={newItemTime}
                      onChange={(e) => setNewItemTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                      Prioridade
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-2xl border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setNewItemPriority('baixa')}
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          newItemPriority === 'baixa'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Baixa
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemPriority('media')}
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          newItemPriority === 'media'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Média
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemPriority('alta')}
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          newItemPriority === 'alta'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Alta
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                      Disciplina / Matéria
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Biologia..."
                      value={newItemSubject}
                      onChange={(e) => setNewItemSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Observações / Anotações
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detalhes adicionais, orientações ou páginas do conteúdo..."
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white outline-none focus:border-emerald-500/80 transition-colors resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newItemTitle.trim() || !newItemDate.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-neutral-950 text-xs font-black rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Salvar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Modal Confirmar Exclusão */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
              role="alertdialog"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-black text-white">
                  Remover compromisso?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Confirma a exclusão de <strong className="text-neutral-200">"{itemToDelete.title}"</strong> da sua agenda?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="py-2.5 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUserItem}
                  className="py-2.5 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black cursor-pointer shadow-md"
                >
                  Remover
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. Toast Feedback com Desfazer (Undo) */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3.5 px-5 py-3 rounded-2xl border border-neutral-800 bg-neutral-900/95 text-white shadow-2xl text-xs backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="font-medium">{toastFeedback.message}</span>
            </div>

            {undoItem && (
              <button
                type="button"
                onClick={handleUndoDelete}
                className="ml-2 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setToastFeedback(null)}
              className="text-neutral-500 hover:text-white p-1 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
