/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CustomDatePicker } from './CustomDatePicker';
import { motion } from 'motion/react';
import { 
  Trophy, 
  Send, 
  UserPlus, 
  Plus, 
  BookOpen, 
  Bell, 
  LogOut, 
  AlertCircle, 
  CheckCircle,
  RotateCcw,
  TrendingUp,
  FileText,
  Home,
  Bot,
  Calendar,
  Edit,
  Trash2,
  Users,
  ClipboardList,
  BarChart3,
  Eye,
  CheckSquare,
  Sparkles,
  Clock,
  ArrowLeft,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Settings,
  EyeOff,
  MessageSquare,
  X,
  CheckCheck,
  BellOff,
  Inbox,
  Filter,
  Award,
  Info,
  Moon,
  Sun,
  Headphones
} from 'lucide-react';
import { SubjectGrade, Announcement, PortalRole, MockExam, MockExamQuestion, MockSubmission } from '../types';
import WsmChat from './WsmChat';
import ClassChat from './ClassChat';
import TeacherSimulados from './TeacherSimulados';
import TeacherVirtualClasses from './TeacherVirtualClasses';
import PublishSuccessModal from './PublishSuccessModal';
import TabLoadingSkeleton from './TabLoadingSkeleton';
import BrowserNotificationPrompt from './BrowserNotificationPrompt';
import AcademicCalendar from './AcademicCalendar';
import TeacherNotebooksReview from './TeacherNotebooksReview';
import { sendBrowserNotification, startRealtimeNotificationListener } from '../utils/browserNotifications';
import { supabase } from '../supabase';
import { safeUpsertUserProfile, safeFetchUserProfile, areTurmasMatching } from '../utils/profileDb';
import { cleanExamContent, formatExamDateDisplay, cleanExamObservations, serializeExamObservations, extractExamTime, parseExamSettings } from '../utils/examSettings';
import { formatTargetDisplayName, matchesStudentTarget, getStudentVirtualClassIdentifiers, parseExamTargets } from '../utils/targetMatcher';

interface TeacherDashboardProps {
  email: string;
  onLogout: () => void;
  grades: SubjectGrade[];
  onUpdateGrade: (subjectId: string, newGrade: number) => void;
  announcements: Announcement[];
  onAddAnnouncement: (title: string, content: string, category: 'Geral' | 'Urgent' | 'Prova' | 'Evento') => void;
}

export default function TeacherDashboard({ 
  email, 
  onLogout, 
  grades, 
  onUpdateGrade, 
  announcements, 
  onAddAnnouncement 
}: TeacherDashboardProps) {

  const [activeTab, setActiveTab] = useState<'inicio' | 'salas' | 'calendario' | 'conversas' | 'marcar_prova' | 'criar_simulado' | 'resultados_simulado' | 'wsm_athenas' | 'criar_aviso' | 'turmas' | 'vistos'>('inicio');
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [publishCelebrationData, setPublishCelebrationData] = useState<{
    isOpen: boolean;
    title: string;
    targetClass: string;
  } | null>(null);

  // Initialize real-time browser push notification listener for teacher
  useEffect(() => {
    const cleanup = startRealtimeNotificationListener('teacher', undefined, email);
    return () => {
      cleanup();
    };
  }, [email]);

  const handleTabClick = (tab: typeof activeTab) => {
    if (tab !== activeTab) {
      setIsTabTransitioning(true);
      setActiveTab(tab);
      setTimeout(() => {
        setIsTabTransitioning(false);
      }, 300);
    }
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ 
    id: string; 
    nome_completo: string; 
    anos_lecionados?: string[] | null; 
    materia?: string | null;
    email?: string | null;
    escola?: string | null;
  } | null>(null);

  // Settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [setMail, setSetMail] = useState(email);
  const [setName, setSetName] = useState('');
  const [setEscola, setSetEscola] = useState('');
  const [setPassword, setSetPassword] = useState('');
  const [setMateria, setSetMateria] = useState('Biologia');
  const [setAnosLecionados, setSetAnosLecionados] = useState<string[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [themePreference, setThemePreference] = useState<'escuro' | 'claro'>('escuro');
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [virtualClasses, setVirtualClasses] = useState<any[]>([]);

  // Online Simulados State
  const [teacherSimulados, setTeacherSimulados] = useState<MockExam[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<MockSubmission[]>([]);
  const [selectedSubClass, setSelectedSubClass] = useState<string>('');
  const [selectedSubExamId, setSelectedSubExamId] = useState<string>('');
  const [selectedSubmissionReview, setSelectedSubmissionReview] = useState<MockSubmission | null>(null);

  // Notifications and Messages States
  const [receivedChatMessages, setReceivedChatMessages] = useState<any[]>([]);
  const [teacherDbNotifs, setTeacherDbNotifs] = useState<any[]>([]);
  const [activeNotifFilter, setActiveNotifFilter] = useState<'todas' | 'mensagens' | 'simulados' | 'provas' | 'avisos' | 'salas' | 'vistos'>('todas');
  
  // Track dismissed notifications for teacher
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`wsm_teacher_dismissed_notifs_${email.toLowerCase()}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissNotif = (notifId: string) => {
    setDismissedNotifIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const updated = [...prev, notifId];
      try {
        localStorage.setItem(`wsm_teacher_dismissed_notifs_${email.toLowerCase()}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving dismissed notification:', e);
      }
      return updated;
    });
  };

  const handleDismissAllNotifs = (allIds?: string[]) => {
    setDismissedNotifIds((prev) => {
      const idsToAdd = Array.isArray(allIds) ? allIds : [];
      const updated = Array.from(new Set([...prev, ...idsToAdd]));
      try {
        localStorage.setItem(`wsm_teacher_dismissed_notifs_${email.toLowerCase()}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving dismissed notifications:', e);
      }
      return updated;
    });
  };

  // "Criar Simulado" Form Fields
  const [simTitle, setSimTitle] = useState('');
  const [simDescription, setSimDescription] = useState('');
  const [simClass, setSimClass] = useState('');
  const [simDeadline, setSimDeadline] = useState('');
  const [simQuestions, setSimQuestions] = useState<MockExamQuestion[]>([]);
  const [simError, setSimError] = useState('');
  const [simSuccess, setSimSuccess] = useState('');
  const [isPostingSim, setIsPostingSim] = useState(false);

  // Individual Question Creator State
  const [curQuestType, setCurQuestType] = useState<'multiple' | 'written'>('multiple');
  const [curQuestText, setCurQuestText] = useState('');
  const [curQuestImg, setCurQuestImg] = useState('');
  const [curQuestOptions, setCurQuestOptions] = useState<string[]>(['', '', '', '']);
  const [curQuestCorrect, setCurQuestCorrect] = useState<number>(0);
  const [curQuestExplanation, setCurQuestExplanation] = useState('');

  // Lists fetched from DB
  const [postedExams, setPostedExams] = useState<any[]>([]);
  const [studentsUnderMentorship, setStudentsUnderMentorship] = useState<any[]>([]);

  // Derived helper for all classes taught by teacher (legacy + virtual)
  const legacyClasses = useMemo(() => {
    return (profile?.anos_lecionados || []).map((cls: string) => cls.trim()).filter(Boolean);
  }, [profile?.anos_lecionados]);

  const virtualClassesNames = useMemo(() => {
    return (virtualClasses || []).map((vc: any) => vc.name).filter(Boolean);
  }, [virtualClasses]);

  const allTeacherClasses = useMemo(() => {
    return Array.from(new Set([...legacyClasses, ...virtualClassesNames]));
  }, [legacyClasses, virtualClassesNames]);

  const publishedTeacherSimulados = useMemo(() => {
    return teacherSimulados.filter(sim => {
      const { settings } = parseExamSettings(sim.description || '');
      return !settings.is_draft;
    });
  }, [teacherSimulados]);

  const teacherTaughtStudents = useMemo(() => {
    return (studentsUnderMentorship || []).filter((st) => {
      if (!st || !st.email) return false;

      // 1. Exclude the teacher's own profile if present
      if (email && st.email.toLowerCase() === email.toLowerCase()) return false;

      // 2. Exclude non-student profiles if role is present
      if (st.role && st.role.toLowerCase() !== 'student') return false;

      // 3. Match official/legacy class
      const matchesOfficial = legacyClasses.some(
        (cls) => cls.toLowerCase() === (st.turma || '').trim().toLowerCase()
      );

      // 4. Match virtual class (by name or by student_emails)
      const matchesVirtual = (virtualClasses || []).some((vc) => {
        if (!vc) return false;
        if (vc.name && (st.turma || '').trim().toLowerCase() === vc.name.trim().toLowerCase()) {
          return true;
        }
        if (!vc.student_emails) return false;
        let emails: string[] = [];
        if (Array.isArray(vc.student_emails)) {
          emails = vc.student_emails;
        } else if (typeof vc.student_emails === 'string') {
          try {
            emails = JSON.parse(vc.student_emails);
          } catch {
            emails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        return emails.some((e: any) => e && String(e).toLowerCase() === st.email.toLowerCase());
      });

      return matchesOfficial || matchesVirtual;
    });
  }, [studentsUnderMentorship, legacyClasses, virtualClasses, email]);

  // "Marcar Prova" Form fields
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('08:00');
  const [examContent, setExamContent] = useState('');
  const [examObservations, setExamObservations] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [postingError, setPostingError] = useState('');
  const [postingSuccess, setPostingSuccess] = useState('');
  const [isPostingExam, setIsPostingExam] = useState(false);

  // Estados para nova aba de Avisos
  const [dbAnnouncements, setDbAnnouncements] = useState<any[]>([]);
  const [loadingAnns, setLoadingAnns] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnClass, setNewAnnClass] = useState('');
  const [newAnnCategory, setNewAnnCategory] = useState<'Geral' | 'Urgent' | 'Prova' | 'Evento'>('Geral');
  const [newAnnImageBase64, setNewAnnImageBase64] = useState('');
  const [newAnnImageFileName, setNewAnnImageFileName] = useState('');
  const [isPostingAnn, setIsPostingAnn] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [annSuccess, setAnnSuccess] = useState<string | null>(null);
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState<any | null>(null);

  useEffect(() => {
    async function fetchTeacherProfile() {
      try {
        let profileFetched = await safeFetchUserProfile(email);
        let data: any = profileFetched;

        if (!data) {
          // Initialize default teacher profile if not present yet
          const defaultId = crypto.randomUUID();
          const defaultName = email.split('@')[0];
          const newDoc = {
            id: defaultId,
            email: email.toLowerCase().trim(),
            role: 'teacher' as const,
            nome_completo: defaultName,
            materia: 'Biologia',
            escola: localStorage.getItem(`wsm_profile_escola_${email.toLowerCase().trim()}`) || '',
            anos_lecionados: []
          };
          const { data: created } = await safeUpsertUserProfile(newDoc);
          if (created) {
            data = created;
          }
        }

        if (data) {
          let finalClasses: string[] = [];
          if (data.anos_lecionados) {
            if (Array.isArray(data.anos_lecionados)) {
              if (data.anos_lecionados.length > 0) {
                finalClasses = data.anos_lecionados;
              }
            } else if (typeof data.anos_lecionados === 'string') {
              try {
                const parsed = JSON.parse(data.anos_lecionados);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalClasses = parsed;
                } else {
                  finalClasses = data.anos_lecionados.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
              } catch {
                finalClasses = data.anos_lecionados.split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }
          }

          const resolvedMateria = data.materia || 'Biologia';

          setProfile({ 
            id: data.id,
            nome_completo: data.nome_completo, 
            anos_lecionados: finalClasses,
            materia: resolvedMateria,
            email: data.email || email,
            escola: data.escola || ''
          });
          setSelectedClasses(finalClasses);
          
          setSetName(data.nome_completo || '');
          setSetEscola(data.escola || '');
          setSetMail(data.email || email);
          setSetMateria(resolvedMateria);
          setSetAnosLecionados(finalClasses);
        }
      } catch (err) {
        console.error('Error fetching teacher profile:', err);
      }
    }
    fetchTeacherProfile();
  }, [email]);

  // Sync settings whenever settings modal opens
  useEffect(() => {
    if (isSettingsOpen && profile) {
      setSetName(profile.nome_completo || '');
      setSetEscola(profile.escola || '');
      setSetMail(profile.email || email);
      setSetMateria(profile.materia || 'Biologia');
      setSetAnosLecionados(profile.anos_lecionados || []);
      setSetPassword('');
      setSettingsStatus(null);
    }
  }, [isSettingsOpen, profile, email]);

  const handleUpdateSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const cleanName = setName.trim();
      const cleanMail = (setMail.trim() || profile?.email || email || '').toLowerCase();
      const cleanMateria = setMateria.trim() || 'Biologia';
      const cleanEscola = setEscola.trim();
      const cleanAnos = setAnosLecionados.filter(Boolean);

      if (!cleanName) {
        throw new Error('Por favor, informe seu nome completo.');
      }

      // Optional password update in auth
      if (setPassword.trim().length >= 6) {
        try {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: setPassword.trim() });
          if (pwdErr) console.warn('Could not update auth password:', pwdErr);
        } catch (pErr) {
          console.warn('Auth password update exception:', pErr);
        }
      }

      // Update auth user metadata
      try {
        await supabase.auth.updateUser({
          data: {
            nome_completo: cleanName,
            materia: cleanMateria,
            escola: cleanEscola
          }
        });
      } catch (authErr) {
        console.warn('Teacher auth metadata update error:', authErr);
      }

      // Direct update in wsm_user_profiles
      const directUpdatePayload: any = {
        nome_completo: cleanName,
        materia: cleanMateria,
        anos_lecionados: cleanAnos,
        ...(setPassword.trim().length >= 6 ? { senha_plana: setPassword.trim() } : {})
      };

      if (profile?.id) {
        const { error: idErr } = await supabase
          .from('wsm_user_profiles')
          .update(directUpdatePayload)
          .eq('id', profile.id);
        if (idErr) console.warn('Teacher direct update by id error:', idErr);
      }

      const { error: emailUpdateErr } = await supabase
        .from('wsm_user_profiles')
        .update(directUpdatePayload)
        .eq('email', cleanMail);
      if (emailUpdateErr) console.warn('Teacher direct update by email error:', emailUpdateErr);

      // Upsert profile in wsm_user_profiles using schema-resilient helper
      const { data: updatedData, error } = await safeUpsertUserProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        email: cleanMail,
        role: 'teacher',
        nome_completo: cleanName,
        materia: cleanMateria,
        anos_lecionados: cleanAnos,
        escola: cleanEscola
      });
        
      if (error && emailUpdateErr) throw error;
      
      // Update local profile state immediately
      const nextProfile = {
        id: updatedData?.id || profile?.id || crypto.randomUUID(),
        nome_completo: cleanName,
        email: cleanMail,
        materia: cleanMateria,
        anos_lecionados: cleanAnos,
        escola: cleanEscola
      };

      setProfile(nextProfile);
      setSetPassword('');
      setSettingsStatus({ type: 'success', msg: 'Suas configurações pessoais e disciplina foram salvas com êxito!' });
      
      // Re-trigger teacher data load to sync immediately
      await loadTeacherData();

      setTimeout(() => {
        setIsSettingsOpen(false);
        setSettingsStatus(null);
      }, 1200);
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setSettingsStatus({ type: 'error', msg: err.message || 'Erro ao atualizar as configurações.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const loadTeacherData = async () => {
    if (!email) return;
    try {
      // 1. Fetch exams marked by this teacher
      const { data: dbExams } = await supabase
        .from('wsm_exams')
        .select('*')
        .eq('teacher_email', email.toLowerCase())
        .order('exam_date', { ascending: true });

      // Fetch recent notifications to cross-reference time if missing from legacy db rows
      let recentNotifs: any[] = [];
      try {
        const { data: dbNotifs } = await supabase
          .from('wsm_notifications')
          .select('title, message')
          .order('created_at', { ascending: false })
          .limit(150);
        if (dbNotifs) recentNotifs = dbNotifs;
      } catch {
        // ignore
      }
      
      if (dbExams) {
        const enrichedExams = dbExams.map((ex: any) => {
          const time = extractExamTime(ex, recentNotifs);
          return {
            ...ex,
            exam_time: time || ex.exam_time || null,
          };
        });
        setPostedExams(enrichedExams);
      }

      // 2. Fetch students (all students as requested for the general table and selections)
      const { data: allStudents } = await supabase
        .from('wsm_user_profiles')
        .select('id, nome_completo, email, turma, numero_chamada')
        .eq('role', 'student')
        .order('nome_completo', { ascending: true });

      if (allStudents) {
        setStudentsUnderMentorship(allStudents);
      }

      // 2.5 Fetch Virtual Classes
      let resolvedVirtualClasses: any[] = [];
      try {
        const { data: dbVirtualClasses } = await supabase
          .from('wsm_virtual_classes')
          .select('*')
          .order('name', { ascending: true });
        if (dbVirtualClasses) {
          const teacherAnos = (profile?.anos_lecionados || []).map((a: string) => a.toLowerCase().trim());
          const emailLower = email.toLowerCase().trim();
          const profileEmailLower = (profile?.email || '').toLowerCase().trim();
          const profileNameLower = (profile?.nome_completo || '').toLowerCase().trim();

          resolvedVirtualClasses = dbVirtualClasses.filter((vc: any) => {
            const vcMail = (vc.teacher_email || '').toLowerCase().trim();
            if (vcMail && (vcMail === emailLower || vcMail === profileEmailLower)) return true;
            if (emailLower.endsWith('@wsmathenas.com') && vcMail === emailLower.replace('@wsmathenas.com', '@atenas.com')) return true;
            if (emailLower.endsWith('@atenas.com') && vcMail === emailLower.replace('@atenas.com', '@wsmathenas.com')) return true;
            if (vc.name && teacherAnos.includes(vc.name.toLowerCase().trim())) return true;
            if (profileNameLower && vc.teacher_name && vc.teacher_name.toLowerCase().trim() === profileNameLower) return true;
            return false;
          });
          const seenIds = new Set<string>();
          const dedupedVClasses = resolvedVirtualClasses.filter((vc: any) => {
            const key = vc.id || vc.name;
            if (!key || seenIds.has(key)) return false;
            seenIds.add(key);
            return true;
          });
          resolvedVirtualClasses = dedupedVClasses;
          setVirtualClasses(dedupedVClasses);
        }
      } catch (vcErr) {
        console.warn("Could not load virtual classes:", vcErr);
      }

      // 3. Load teacher's mock exams (simulados) safely - query & filtering aligned with TeacherSimulados
      try {
        const { data: dbMockExams, error: mockErr } = await supabase
          .from('wsm_mock_exams')
          .select('*')
          .order('created_at', { ascending: false });

        if (!mockErr && dbMockExams) {
          const emailLower = email.toLowerCase().trim();
          const profileEmailLower = (profile?.email || '').toLowerCase().trim();
          const profileNameLower = (profile?.nome_completo || '').toLowerCase().trim();
          const teacherSubjectLower = (profile?.materia || 'biologia').toLowerCase().trim();

          const legacyAnos = (profile?.anos_lecionados || []).map((cls: string) => cls.trim().toLowerCase());
          const vcNames = resolvedVirtualClasses.map((vc: any) => (vc.name || '').trim().toLowerCase());
          const vcIds = resolvedVirtualClasses.map((vc: any) => (vc.id || '').trim().toLowerCase());
          const vcCodes = resolvedVirtualClasses.map((vc: any) => (vc.access_code || '').trim().toLowerCase());
          const teacherClassesLower = Array.from(new Set([...legacyAnos, ...vcNames, ...vcIds, ...vcCodes])).filter(Boolean);

          const filteredExams = dbMockExams.filter((exam: any) => {
            const exTeacherEmail = (exam.teacher_email || '').toLowerCase().trim();
            const exTeacherName = (exam.teacher_name || '').toLowerCase().trim();
            const exSubject = (exam.subject || '').toLowerCase().trim();

            if (
              (exTeacherEmail && exTeacherEmail === emailLower) ||
              (exTeacherEmail && profileEmailLower && exTeacherEmail === profileEmailLower) ||
              (emailLower.endsWith('@wsmathenas.com') && exTeacherEmail === emailLower.replace('@wsmathenas.com', '@atenas.com')) ||
              (emailLower.endsWith('@atenas.com') && exTeacherEmail === emailLower.replace('@atenas.com', '@wsmathenas.com'))
            ) {
              return true;
            }

            if (
              profileNameLower &&
              exTeacherName &&
              (exTeacherName === profileNameLower || profileNameLower.includes(exTeacherName) || exTeacherName.includes(profileNameLower))
            ) {
              return true;
            }

            if (exam.class_name) {
              const { classes } = parseExamTargets(exam.class_name);
              if (classes.some(c => teacherClassesLower.includes(c.toLowerCase().trim()))) {
                return true;
              }
              const rawClassLower = exam.class_name.toLowerCase();
              if (teacherClassesLower.some(tc => tc && (rawClassLower === tc || rawClassLower.includes(tc)))) {
                return true;
              }
            }

            if (
              teacherSubjectLower &&
              exSubject &&
              exSubject === teacherSubjectLower &&
              (!exTeacherEmail || exTeacherEmail === emailLower || exTeacherEmail === profileEmailLower)
            ) {
              return true;
            }

            return false;
          }).map((exam: any) => {
            let parsedQuestions: MockExamQuestion[] = [];
            if (Array.isArray(exam.questions)) {
              parsedQuestions = exam.questions;
            } else if (typeof exam.questions === 'string') {
              try {
                parsedQuestions = JSON.parse(exam.questions);
              } catch {
                parsedQuestions = [];
              }
            }
            return {
              ...exam,
              questions: parsedQuestions
            };
          });

          setTeacherSimulados(filteredExams);

          // 4. Load submissions for these exams
          if (filteredExams.length > 0) {
            const examIds = filteredExams.map(ex => ex.id);
            const { data: dbSubs, error: subsErr } = await supabase
              .from('wsm_mock_submissions')
              .select('*')
              .in('mock_exam_id', examIds)
              .order('submitted_at', { ascending: false });
            
            if (!subsErr && dbSubs) {
              setAllSubmissions(dbSubs);
            }
          } else {
            setAllSubmissions([]);
          }
        }
      } catch (mockFetchErr) {
        console.warn("Could not load mock exams. Table may not exist yet:", mockFetchErr);
      }

      // Buscar avisos do professor
      await fetchDbAnnouncements();

      // 5. Buscar mensagens diretas NÃO LIDAS recebidas pelo professor para notificações
      try {
        const { data: dmFallback } = await supabase
          .from('direct_messages')
          .select('*')
          .ilike('receiver_email', email)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(50);
        if (dmFallback) {
          setReceivedChatMessages(dmFallback);
        }
      } catch (chatErr) {
        console.warn("Could not load direct messages:", chatErr);
      }

      // 6. Buscar notificações do banco para o professor (pedidos de visto e avisos)
      try {
        if (profile?.id) {
          const { data: tNotifs } = await supabase
            .from('wsm_notifications')
            .select('*')
            .eq('user_id', profile.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });
          if (tNotifs) {
            setTeacherDbNotifs(tNotifs);
          }
        }
      } catch (tNotifErr) {
        console.warn("Could not load teacher notifications:", tNotifErr);
      }

    } catch (err) {
      console.error("Error loading teacher data:", err);
    }
  };

  const fetchDbAnnouncements = async () => {
    if (!email) return;
    setLoadingAnns(true);
    try {
      const { data, error } = await supabase
        .from('wsm_announcements')
        .select('*')
        .eq('teacher_email', email.toLowerCase())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDbAnnouncements(data || []);
    } catch (err) {
      console.warn("Erro ao carregar avisos do Supabase:", err);
    } finally {
      setLoadingAnns(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP, etc).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem é muito grande. Escolha uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setNewAnnImageBase64(base64);
      setNewAnnImageFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnClass) {
      setAnnError("Selecione uma turma de destino.");
      return;
    }
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) {
      setAnnError("Preencha o título e a mensagem do aviso.");
      return;
    }

    setIsPostingAnn(true);
    setAnnError(null);
    setAnnSuccess(null);

    try {
      const targetClassName = newAnnClass;

      const { error: insertErr } = await supabase
        .from('wsm_announcements')
        .insert({
          title: newAnnTitle.trim(),
          content: newAnnMessage.trim(),
          message: newAnnMessage.trim(),
          class_name: targetClassName,
          image_url: newAnnImageBase64 || null,
          teacher_email: email,
          teacher_name: profile?.nome_completo || 'Professora',
          category: newAnnCategory,
          created_at: new Date().toISOString()
        });

      if (insertErr) throw insertErr;

      // Notify students of that class/virtual class/cohort
      const targetStudents = (studentsUnderMentorship || []).filter(st => {
        if (!st || !st.email) return false;
        const studentVCs = getStudentVirtualClassIdentifiers(st.email, virtualClasses);
        const matchesTarget = matchesStudentTarget(targetClassName, st.email, st.turma, studentVCs);
        const matchesCohort = st.turma ? areTurmasMatching(targetClassName, st.turma) : false;
        const isGeneral = !targetClassName || ['geral', 'todas', 'toda a escola', 'todos'].includes(targetClassName.toLowerCase().trim());
        return matchesTarget || matchesCohort || isGeneral;
      });

      if (targetStudents.length > 0) {
        const notifInserts = targetStudents
          .filter(st => st.id)
          .map(st => ({
            user_id: st.id,
            title: `📢 Novo Comunicado: ${newAnnTitle.trim()}`,
            message: `${newAnnMessage.trim()}\n\nTurma: ${targetClassName}\nProfessor(a): ${profile?.nome_completo || 'Docente'}`,
            is_read: false
          }));

        try {
          if (notifInserts.length > 0) {
            await supabase.from('wsm_notifications').insert(notifInserts);
          }
        } catch (nErr) {
          console.warn('Erro ao inserir notificações para alunos:', nErr);
        }

        // Also trigger background email notifications if applicable
        fetch('/api/send-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifications: notifInserts })
        }).catch(err => console.warn('Erro ao disparar e-mails de aviso:', err));
      }

      setAnnSuccess(`Aviso publicado com sucesso para a turma ${targetClassName}!`);
      
      // Dispara a notificação push no navegador do professor/dispositivos
      sendBrowserNotification(`📢 Aviso Publicado: ${newAnnTitle.trim()}`, {
        body: `Publicado com sucesso para os alunos da turma ${targetClassName}.`,
        tag: `pub-ann-${Date.now()}`
      });

      // Abre a animação de comemoração de publicação com confete e check
      setPublishCelebrationData({
        isOpen: true,
        title: newAnnTitle.trim(),
        targetClass: targetClassName
      });

      setNewAnnTitle("");
      setNewAnnMessage("");
      setNewAnnImageBase64("");
      setNewAnnImageFileName("");
      
      // Recarregar os avisos
      await fetchDbAnnouncements();

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setAnnSuccess(null);
      }, 1500);

    } catch (err: any) {
      console.error("Erro ao publicar anúncio:", err);
      setAnnError(err.message || "Ocorreu um erro ao publicar o aviso.");
    } finally {
      setIsPostingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este aviso?")) return;
    try {
      const { error } = await supabase
        .from('wsm_announcements')
        .delete()
        .eq('id', annId);

      if (error) throw error;
      setDbAnnouncements(prev => prev.filter(ann => ann.id !== annId));
    } catch (err) {
      console.error("Erro ao excluir aviso:", err);
      alert("Não foi possível excluir o aviso.");
    }
  };

  useEffect(() => {
    if (profile) {
      loadTeacherData();
      const interval = setInterval(loadTeacherData, 5000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'inicio') {
      loadTeacherData();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleDirectMsgsRead = (e: any) => {
      const senderEmail = (e.detail?.sender_email || '').toLowerCase().trim();
      setReceivedChatMessages(prev =>
        prev.filter(m => {
          if (!senderEmail) return false;
          return (m.sender_email || '').toLowerCase().trim() !== senderEmail;
        })
      );
    };

    window.addEventListener('wsm_direct_messages_read', handleDirectMsgsRead);
    return () => window.removeEventListener('wsm_direct_messages_read', handleDirectMsgsRead);
  }, []);

  useEffect(() => {
    const official = profile?.anos_lecionados || [];
    const virtual = virtualClasses || [];
    if (selectedClasses.length === 0) {
      if (official.length === 1) {
        setSelectedClasses([official[0]]);
      } else if (official.length === 0 && virtual.length === 1) {
        setSelectedClasses([virtual[0].id]);
      }
    }
  }, [profile, virtualClasses]);

  // Form toggles / selection helpers
  const handleToggleClass = (cls: string) => {
    setSelectedClasses(prev => 
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  // Exam markings submit (Save or Edit)
  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingError('');
    setPostingSuccess('');
    setIsPostingExam(true);

    if (localStorage.getItem('wsm_sys_block_posting') === 'true') {
      setPostingError('Aviso Administrativo: O lançamento ou alteração de provas e notas acadêmicas está TEMPORARIAMENTE BLOQUEADO pela Administração Mestre.');
      setIsPostingExam(false);
      return;
    }

    if (!examTitle.trim()) {
      setPostingError('Por favor informe o título da prova.');
      setIsPostingExam(false);
      return;
    }
    if (!examDate) {
      setPostingError('Por favor informe a data da prova.');
      setIsPostingExam(false);
      return;
    }
    if (!examContent.trim()) {
      setPostingError('Por favor informe o conteúdo que será cobrado.');
      setIsPostingExam(false);
      return;
    }
    let classesToPost = [...selectedClasses];
    if (classesToPost.length === 0) {
      const official = profile?.anos_lecionados || [];
      const virtual = virtualClasses || [];
      if (official.length === 1) {
        classesToPost = [official[0]];
      } else if (official.length === 0 && virtual.length === 1) {
        classesToPost = [virtual[0].id];
      }
    }

    if (classesToPost.length === 0) {
      setPostingError('Selecione pelo menos uma sala ou turma (ex: Sala A, B ou C) antes de divulgar o lembrete da prova.');
      setIsPostingExam(false);
      return;
    }

    try {
      const fullExamDate = examTime ? `${examDate}T${examTime}:00` : examDate;
      const sanitizedContent = cleanExamContent(examContent);
      const serializedObservations = serializeExamObservations(examObservations, examTime);

      if (editingExamId) {
        // Edit existing exam
        const { error } = await supabase
          .from('wsm_exams')
          .update({
            title: examTitle.trim(),
            exam_date: fullExamDate,
            content: sanitizedContent,
            observations: serializedObservations,
            classes: classesToPost
          })
          .eq('id', editingExamId);

        if (error) throw error;
        setPostingSuccess('Informações da prova atualizadas com sucesso!');
        setEditingExamId(null);
      } else {
        // Create new exam
        const { error } = await supabase
          .from('wsm_exams')
          .insert({
            title: examTitle.trim(),
            exam_date: fullExamDate,
            content: sanitizedContent,
            observations: serializedObservations,
            teacher_email: email.toLowerCase(),
            teacher_name: profile?.nome_completo || 'Professor',
            materia: profile?.materia || 'Biologia',
            classes: classesToPost
          });

        if (error) throw error;

        // Dispatch notifications to students of selected classes (handling official cohorts, virtual classes, and individual student emails)
        const targetStudents = studentsUnderMentorship.filter(student => {
          const matchesCohort = classesToPost.includes(student.turma);
          const matchesEmail = classesToPost.includes(student.email.toLowerCase());
          const matchesVirtualClass = virtualClasses.some(vc => 
            classesToPost.includes(vc.id) && 
            vc.student_emails && 
            vc.student_emails.includes(student.email.toLowerCase())
          );
          return matchesCohort || matchesEmail || matchesVirtualClass;
        });

        if (targetStudents.length > 0) {
          const notificationInserts = targetStudents.map(student => ({
            user_id: student.id,
            title: `Nova Prova: ${profile?.materia || 'Geral'}`,
            message: `O(A) professor(a) ${profile?.nome_completo} marcou uma prova presencial para o dia ${new Date(examDate).toLocaleDateString('pt-BR')}${examTime ? ` às ${examTime}` : ''}.\n\nTítulo: ${examTitle.trim()}\n\nConteúdo:\n${sanitizedContent}\n\nObservações: ${cleanExamObservations(examObservations) || 'Nenhuma'}\n\nLembrete de nível: Prova Presencial Escolar.`,
            is_read: false
          }));

          await supabase
            .from('wsm_notifications')
            .insert(notificationInserts);

          // Disparar e-mails de notificação por trás
          fetch('/api/send-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notifications: notificationInserts })
          }).catch(err => console.warn('Erro ao disparar e-mails:', err));
        }

        setPostingSuccess('Nova prova agendada e notificações disparadas com sucesso!');
      }

      // Reset form
      setExamTitle('');
      setExamDate('');
      setExamTime('08:00');
      setExamContent('');
      setExamObservations('');
      setSelectedClasses(profile?.anos_lecionados || []);
      loadTeacherData();
    } catch (err: any) {
      console.error(err);
      setPostingError('Ocorreu um erro ao salvar a prova. Tente novamente.');
    } finally {
      setIsPostingExam(false);
    }
  };

  const handleEditClick = (ex: any) => {
    setEditingExamId(ex.id);
    setExamTitle(ex.title);
    // Format date string to YYYY-MM-DD for date input
    const formattedDate = ex.exam_date ? ex.exam_date.substring(0, 10) : '';
    const formattedTime = extractExamTime(ex) || (ex.exam_date && ex.exam_date.includes('T') ? ex.exam_date.split('T')[1].substring(0, 5) : '08:00');
    setExamDate(formattedDate);
    setExamTime(formattedTime);
    setExamContent(cleanExamContent(ex.content));
    setExamObservations(cleanExamObservations(ex.observations));
    setSelectedClasses(ex.classes || []);
    setPostingError('');
    setPostingSuccess('');
    // Scroll form into view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingExamId(null);
    setExamTitle('');
    setExamDate('');
    setExamTime('08:00');
    setExamContent('');
    setExamObservations('');
    setSelectedClasses(profile?.anos_lecionados || []);
    setPostingError('');
    setPostingSuccess('');
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar o registro desta prova?')) return;
    try {
      const { error } = await supabase
        .from('wsm_exams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      loadTeacherData();
    } catch (err) {
      console.error("Error deleting exam:", err);
      alert('Erro ao apagar prova.');
    }
  };

  // Online Mock Exam (Simulado) Handlers
  const handleAddQuestionToSimulado = (e: React.FormEvent) => {
    e.preventDefault();
    setSimError('');
    if (!curQuestText.trim()) {
      setSimError('O enunciado da questão é obrigatório.');
      return;
    }

    const newQuestion: MockExamQuestion = {
      id: 'q-' + Math.random().toString(36).substring(2, 9),
      type: curQuestType,
      text: curQuestText.trim(),
      imageUrl: curQuestImg.trim() || undefined,
      explanation: curQuestExplanation.trim() || undefined
    };

    if (curQuestType === 'multiple') {
      const validOptions = curQuestOptions.map(opt => opt.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setSimError('Questões de múltipla escolha precisam de pelo menos 2 alternativas válidas.');
        return;
      }
      const selectedCorrectText = curQuestOptions[curQuestCorrect] ? curQuestOptions[curQuestCorrect].trim() : '';
      const foundIndex = validOptions.indexOf(selectedCorrectText);
      if (foundIndex === -1) {
        setSimError('A alternativa marcada como Gabarito Correto não pode estar em branco.');
        return;
      }
      newQuestion.options = validOptions;
      newQuestion.correctOption = foundIndex;
    }

    setSimQuestions(prev => [...prev, newQuestion]);
    
    // Reset question form
    setCurQuestText('');
    setCurQuestImg('');
    setCurQuestOptions(['', '', '', '']);
    setCurQuestCorrect(0);
    setCurQuestExplanation('');
    setSimSuccess('Questão adicionada ao simulado!');
    setTimeout(() => setSimSuccess(''), 3000);
  };

  const handleRemoveQuestionFromSimulado = (qId: string) => {
    setSimQuestions(prev => prev.filter(q => q.id !== qId));
  };

  const handlePublishSimulado = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimError('');
    setSimSuccess('');
    setIsPostingSim(true);

    if (localStorage.getItem('wsm_sys_block_posting') === 'true') {
      setSimError('Aviso Administrativo: A criação e lançamento de simulados acadêmicos está TEMPORARIAMENTE BLOQUEADA pela Administração Mestre.');
      setIsPostingSim(false);
      return;
    }

    if (!simTitle.trim()) {
      setSimError('O título do simulado é obrigatório.');
      setIsPostingSim(false);
      return;
    }
    if (!simClass) {
      setSimError('Selecione uma turma para aplicar o simulado.');
      setIsPostingSim(false);
      return;
    }
    if (simQuestions.length === 0) {
      setSimError('Adicione pelo menos 1 questão ao simulado antes de publicar.');
      setIsPostingSim(false);
      return;
    }

    try {
      const { error: simErr } = await supabase
        .from('wsm_mock_exams')
        .insert({
          title: simTitle.trim(),
          description: simDescription.trim(),
          subject: profile?.materia || 'Biologia',
          class_name: simClass,
          teacher_email: email.toLowerCase(),
          teacher_name: profile?.nome_completo || 'Professor',
          deadline: simDeadline ? new Date(simDeadline).toISOString() : null,
          questions: simQuestions
        });

      if (simErr) throw simErr;

      // Notify students of this class
      try {
        const { data: allStudents } = await supabase
          .from('wsm_user_profiles')
          .select('id, email, turma')
          .eq('role', 'student');

        const targetStudents = (allStudents || []).filter(st => {
          if (!st || !st.email) return false;
          const matchesTurma = st.turma === simClass;
          const matchesEmail = st.email.toLowerCase() === simClass.toLowerCase();
          const matchesVC = (virtualClasses || []).some(vc => {
            const isThisVC = vc.id === simClass || vc.name === simClass || vc.access_code === simClass;
            if (!isThisVC) return false;
            let vcEmails: string[] = [];
            if (Array.isArray(vc.student_emails)) vcEmails = vc.student_emails;
            else if (typeof vc.student_emails === 'string') {
              try { vcEmails = JSON.parse(vc.student_emails); } catch { vcEmails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean); }
            }
            return vcEmails.some((e: any) => e && String(e).toLowerCase() === st.email.toLowerCase());
          });
          return matchesTurma || matchesEmail || matchesVC;
        });

        if (targetStudents && targetStudents.length > 0) {
          const notificationInserts = targetStudents.map(st => ({
            user_id: st.id,
            title: `Novo Simulado Online de ${profile?.materia || 'Matéria'}`,
            message: `O(A) professor(a) ${profile?.nome_completo || 'Docente'} publicou um simulado virtual intitulado "${simTitle}".\n\nPrazo de entrega: ${simDeadline ? new Date(simDeadline).toLocaleString('pt-BR') : 'Sem prazo definido'}.\n\nFaça já o simulado para obter sua nota automaticamente!`,
            is_read: false
          }));

          await supabase
            .from('wsm_notifications')
            .insert(notificationInserts);

          // Disparar e-mails de notificação por trás
          fetch('/api/send-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notifications: notificationInserts })
          }).catch(err => console.warn('Erro ao disparar e-mails:', err));
        }
      } catch (notifErr) {
        console.error("Error creating notifications for online mock exam:", notifErr);
      }

      setSimSuccess('Simulado virtual publicado e compartilhado com os alunos com sucesso!');
      
      // Reset form
      setSimTitle('');
      setSimDescription('');
      setSimClass(profile?.anos_lecionados?.[0] || '');
      setSimDeadline('');
      setSimQuestions([]);
      loadTeacherData();
    } catch (err: any) {
      console.error(err);
      setSimError(`Ocorreu um erro ao publicar o simulado: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsPostingSim(false);
    }
  };

  const handleDeleteSimulado = async (simId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este simulado virtual? Isso também removerá as notas e envios dos alunos.')) return;
    try {
      const { error } = await supabase
        .from('wsm_mock_exams')
        .delete()
        .eq('id', simId);

      if (error) throw error;
      setSimSuccess('Simulado deletado com sucesso.');
      loadTeacherData();
    } catch (err: any) {
      console.error("Error deleting simulado:", err);
      alert(`Erro ao deletar simulado: ${err.message}`);
    }
  };

  // Grade post state variables

  const [selectedSubjectId, setSelectedSubjectId] = useState(grades[0]?.id || '');
  const [newGradeValue, setNewGradeValue] = useState('');
  const [gradeError, setGradeError] = useState('');
  const [gradeSuccess, setGradeSuccess] = useState(false);



  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGradeError('');
    setGradeSuccess(false);

    const parsedGrade = parseFloat(newGradeValue);
    if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 10) {
      setGradeError('Por favor, informe uma nota numérica válida entre 0 e 10.');
      return;
    }

    onUpdateGrade(selectedSubjectId, parsedGrade);
    setGradeSuccess(true);
    setNewGradeValue('');

    setTimeout(() => setGradeSuccess(false), 3000);
  };

  // Compute aggregated stats
  const totalStudents = 32; // Mock headcount
  const classGradeAverage = (grades.reduce((acc, curr) => acc + curr.grade, 0) / grades.length).toFixed(1);

  // ----------------------------------------------------
  // UNIFIED NOTIFICATIONS SYSTEM (Teacher)
  // ----------------------------------------------------
  // Only REAL incoming events generate notification badges (unread student messages & submissions)

  // 1. Mensagens de alunos no chat direto (somente não lidas)
  const chatNotifs = receivedChatMessages
    .filter(msg => !msg.is_read && !dismissedNotifIds.includes(`msg_${msg.id}`))
    .map(msg => ({
      id: `msg_${msg.id}`,
      rawId: msg.id,
      category: 'mensagens' as const,
      categoryLabel: 'Mensagem Direta',
      targetTab: 'conversas' as const,
      title: `Nova mensagem de ${msg.sender_name || msg.sender_email || 'Aluno'}`,
      description: msg.content || msg.text || 'Você recebeu uma nova mensagem no chat.',
      timestamp: msg.created_at || new Date().toISOString(),
      actionLabel: 'Abrir Conversas'
    }));

  // 2. Simulados com 100% da turma concluída
  const sim100Notifs = teacherSimulados
    .map(sim => {
      const targetStudents = studentsUnderMentorship.filter(st => {
        const studentVCs = getStudentVirtualClassIdentifiers(st.email, virtualClasses);
        return matchesStudentTarget(
          sim.class_name,
          st.email,
          st.turma || st.cohort || '',
          studentVCs
        );
      });

      const subsForSim = allSubmissions.filter(s => s.mock_exam_id === sim.id);
      const uniqueSubmittedEmails = new Set(
        subsForSim.map(s => (s.student_email || '').toLowerCase())
      );

      const isComplete = targetStudents.length > 0 && uniqueSubmittedEmails.size >= targetStudents.length;

      return {
        sim,
        targetCount: targetStudents.length,
        submittedCount: uniqueSubmittedEmails.size,
        isComplete,
        latestSubAt: subsForSim.reduce((max, s) => {
          const t = new Date(s.submitted_at || 0).getTime();
          return t > max ? t : max;
        }, 0)
      };
    })
    .filter(item => item.isComplete && !dismissedNotifIds.includes(`sim100_${item.sim.id}`))
    .map(({ sim, targetCount, latestSubAt }) => {
      const formattedClass = formatTargetDisplayName(sim.class_name, virtualClasses);
      return {
        id: `sim100_${sim.id}`,
        rawId: sim.id,
        category: 'simulados' as const,
        categoryLabel: '100% da Turma Concluiu',
        targetTab: 'resultados_simulado' as const,
        examId: sim.id,
        title: `Turma 100% Concluída: ${sim.title}`,
        description: `Todos os ${targetCount} alunos da turma ${formattedClass} responderam ao simulado online.`,
        timestamp: latestSubAt ? new Date(latestSubAt).toISOString() : sim.created_at || new Date().toISOString(),
        actionLabel: 'Ver Resultados & Notas'
      };
    });

  // 3. Entregas recentes de simulados pelos alunos
  const recentSubmissionsNotifs = allSubmissions
    .filter(sub => !dismissedNotifIds.includes(`sub_${sub.id}`))
    .slice(0, 15)
    .map(sub => {
      const relatedSim = teacherSimulados.find(s => s.id === sub.mock_exam_id);
      const simTitle = relatedSim ? relatedSim.title : 'Simulado Online';
      const studentName = sub.student_name || sub.student_email || 'Aluno';
      const scoreText = sub.score !== undefined ? ` • Nota: ${sub.score}` : '';

      return {
        id: `sub_${sub.id}`,
        rawId: sub.id,
        category: 'simulados' as const,
        categoryLabel: 'Entrega de Simulado',
        targetTab: 'resultados_simulado' as const,
        examId: sub.mock_exam_id,
        title: `Entrega: ${studentName}`,
        description: `Finalizou o simulado "${simTitle}"${scoreText}.`,
        timestamp: sub.submitted_at || new Date().toISOString(),
        actionLabel: 'Ver Correção'
      };
    });

  // 4. Pedidos de Vistos do Banco para o Professor
  const vistosNotifs = (teacherDbNotifs || [])
    .filter(n => !dismissedNotifIds.includes(`db_${n.id}`) && !n.is_read)
    .map(n => ({
      id: `db_${n.id}`,
      rawId: n.id,
      category: 'vistos' as const,
      categoryLabel: 'Pedido de Visto',
      targetTab: 'vistos' as const,
      title: n.title || 'Novo Pedido de Visto',
      description: n.message || 'Aluno enviou caderno digital para visto.',
      timestamp: n.created_at || new Date().toISOString(),
      actionLabel: 'Abrir Mesa de Vistos'
    }));

  // Keep empty helper arrays for filter pills backwards compatibility
  const upcomingExamsNotifs: any[] = [];
  const announcementsNotifs: any[] = [];
  const virtualClassesNotifs: any[] = [];

  // All REAL unified notifications (only incoming unread student events)
  const allNotifications = [
    ...chatNotifs,
    ...sim100Notifs,
    ...recentSubmissionsNotifs,
    ...vistosNotifs
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Notification Counts for badges per Tab (0 = NO BADGE)
  const tabNotificationCounts = {
    inicio: allNotifications.length,
    salas: 0,
    calendario: 0,
    conversas: activeTab === 'conversas' ? 0 : chatNotifs.length,
    marcar_prova: 0,
    criar_simulado: sim100Notifs.length + recentSubmissionsNotifs.length,
    vistos: activeTab === 'vistos' ? 0 : vistosNotifs.length,
    criar_aviso: 0,
    wsm_athenas: 0
  };

  // Auto-dismiss notifications for a tab when the teacher enters/views that tab
  useEffect(() => {
    if (activeTab === 'conversas') {
      const chatIds = receivedChatMessages.map(m => `msg_${m.id}`);
      if (chatIds.length > 0) {
        handleDismissAllNotifs(chatIds);
      }
    } else if (activeTab === 'criar_simulado' || activeTab === 'resultados_simulado') {
      const sim100Ids = teacherSimulados.map(s => `sim100_${s.id}`);
      const subIds = allSubmissions.map(s => `sub_${s.id}`);
      const simIds = [...sim100Ids, ...subIds];
      if (simIds.length > 0) {
        handleDismissAllNotifs(simIds);
      }
    } else if (activeTab === 'vistos') {
      const vistoIds = vistosNotifs.map(v => v.id);
      if (vistoIds.length > 0) {
        handleDismissAllNotifs(vistoIds);
      }
      if (profile?.id) {
        supabase.from('wsm_notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false).then();
      }
    }
  }, [activeTab]);

  const filteredNotifications = allNotifications.filter(notif => {
    if (activeNotifFilter === 'todas') return true;
    return notif.category === activeNotifFilter;
  });

  // Green circular badge helper component
  const renderSidebarBadge = (count: number, isCollapsed: boolean = false) => {
    if (!count || count <= 0) return null;
    const displayCount = count > 99 ? '99+' : count;

    if (isCollapsed) {
      return (
        <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-neutral-950 shadow-lg shadow-emerald-500/40 z-20 animate-pulse font-mono leading-none">
          {displayCount}
        </span>
      );
    }

    return (
      <span className="ml-auto min-w-[19px] h-[19px] px-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/40 font-mono leading-none">
        {displayCount}
      </span>
    );
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#040605] text-neutral-200 font-sans flex relative">
      {/* Background decorations */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-10 w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Modern Sidebar for desktop */}
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
                  <span className="text-[9px] text-emerald-400 font-mono tracking-wider uppercase font-semibold">Portal do Docente</span>
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
              id="teacher-tab-chat"
              onClick={() => setActiveTab('wsm_athenas')}
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

            {/* Início Tab */}
            <button
              id="teacher-tab-inicio"
              onClick={() => setActiveTab('inicio')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'inicio'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Home className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.inicio, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Início</span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.inicio, false)}
            </button>

            {/* NEW Salas Tab */}
            <button
              id="teacher-tab-salas"
              onClick={() => setActiveTab('salas')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'salas'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Users className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.salas, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Salas</span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.salas, false)}
            </button>

            {/* Calendário Tab */}
            <button
              id="teacher-tab-calendario"
              onClick={() => setActiveTab('calendario')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'calendario'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Calendar className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.calendario, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Calendário</span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.calendario, false)}
            </button>

            {/* Conversas Tab with Green Badge */}
            <button
              id="teacher-tab-conversas"
              onClick={() => setActiveTab('conversas')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'conversas'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <MessageSquare className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.conversas, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>Conversas</span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.conversas, false)}
            </button>

            {/* NEW Marcar Prova Tab with Green Badge */}
            <button
              id="teacher-tab-marcar-prova"
              onClick={() => setActiveTab('marcar_prova')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'marcar_prova'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Calendar className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.marcar_prova, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-none tracking-tight block w-full text-center' : 'truncate'}>
                  {isSidebarCollapsed ? 'Atividades' : 'Marcar Prova (Presencial)'}
                </span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.marcar_prova, false)}
            </button>

            {/* NEW Criar Simulado Tab with Green Badge */}
            <button
              id="teacher-tab-criar-simulado"
              onClick={() => {
                setActiveTab('criar_simulado');
                if (profile?.anos_lecionados && profile.anos_lecionados.length > 0) {
                  setSimClass(profile.anos_lecionados[0]);
                } else {
                  setSimClass('');
                }
              }}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'criar_simulado' || activeTab === 'resultados_simulado'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <ClipboardList className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.criar_simulado, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>
                  Simulados
                </span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.criar_simulado, false)}
            </button>

            {/* Avisos Tab with Green Badge */}
            <button
              id="teacher-tab-criar-aviso"
              onClick={() => setActiveTab('criar_aviso')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'criar_aviso'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15 font-bold shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Megaphone className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.criar_aviso, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>
                  Avisos
                </span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.criar_aviso, false)}
            </button>

            {/* Vistos Virtuais (Cadernos) Tab */}
            <button
              id="teacher-tab-vistos"
              onClick={() => setActiveTab('vistos')}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1 relative' 
                  : 'w-full flex items-center justify-between px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer ${
                activeTab === 'vistos'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                  : 'bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200'
              }`}
            >
              <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-3'}`}>
                <div className="relative">
                  <Award className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-amber-400`} />
                  {isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.vistos, true)}
                </div>
                <span className={isSidebarCollapsed ? 'text-[9.5px] font-medium leading-normal tracking-wide block truncate w-full' : 'truncate'}>
                  Vistos Virtuais
                </span>
              </div>
              {!isSidebarCollapsed && renderSidebarBadge(tabNotificationCounts.vistos, false)}
            </button>

            {/* Ouvir música ambiente Tab */}
            <button
              id="teacher-tab-musica"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-study-music-player'));
              }}
              className={`${
                isSidebarCollapsed 
                  ? 'w-full flex flex-col items-center justify-center py-2 px-1 text-[10px] text-center gap-1' 
                  : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs'
              } rounded-xl font-semibold transition-all border cursor-pointer bg-transparent text-neutral-450 border-transparent hover:bg-neutral-900/40 hover:text-neutral-200`}
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
                <p className="text-neutral-550 text-[9px] font-mono">{profile ? profile.materia : 'Biologia'} {profile?.anos_lecionados && profile.anos_lecionados.length > 0 ? `• Turmas: ${profile.anos_lecionados.join(', ')}` : ''}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-850 hover:text-emerald-400 border border-neutral-850 hover:border-emerald-500/25 rounded-xl transition-all text-[11px] font-semibold cursor-pointer"
                  title="Configurar Perfil"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-455 animate-spin-slow" />
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
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full flex justify-center p-2.5 bg-neutral-900 hover:bg-neutral-850 hover:text-emerald-400 border border-neutral-850 rounded-xl transition-all cursor-pointer"
                  title="Configurações"
                >
                  <Settings className="w-4 h-4 text-emerald-455" />
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

      {/* Main View Area */}
      <div className={`flex-1 h-full overflow-y-auto flex flex-col ${
        activeTab === 'wsm_athenas' 
          ? 'p-2 md:p-4 relative z-50' 
          : 'p-4 md:p-8'
      } w-full ${activeTab === 'wsm_athenas' ? 'relative z-50' : 'z-10'} min-w-0`}>
        
        {/* Navigation header (responsive) */}
        <header className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 mb-6 border-b border-emerald-950/20 ${
          activeTab === 'wsm_athenas' ? 'md:hidden' : ''
        }`}>
          <div className="flex items-center gap-3 animate-fadeIn">
            <div className="p-2 md:hidden bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-neutral-100 font-display">Athenas</h1>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">Portal do Docente</span>
              </div>
              <p className="text-neutral-550 text-xs mt-0.5 font-sans">Professor(a): <span className="text-emerald-400 font-semibold">{profile ? profile.nome_completo : email}</span> • {profile ? profile.materia : 'Biologia'}{profile?.anos_lecionados && profile.anos_lecionados.length > 0 ? ` • Turmas: ${profile.anos_lecionados.join(', ')}` : ''}</p>
            </div>
          </div>

          {/* Quick tab switcher on mobile only */}
          <div className="flex md:hidden items-center gap-1.5 w-full overflow-x-auto sm:w-auto mt-2 sm:mt-0 font-mono pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab('inicio')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border relative ${
                activeTab === 'inicio' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span>Início</span>
              {tabNotificationCounts.inicio > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.inicio}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('salas')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'salas' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Salas</span>
              {tabNotificationCounts.salas > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.salas}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('calendario')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'calendario' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Calendário</span>
              {tabNotificationCounts.calendario > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.calendario}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('conversas')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'conversas' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conversas</span>
              {tabNotificationCounts.conversas > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.conversas}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('marcar_prova')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'marcar_prova' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pr. Presencial</span>
              {tabNotificationCounts.marcar_prova > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.marcar_prova}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('criar_simulado');
                if (profile?.anos_lecionados && profile.anos_lecionados.length > 0) {
                  setSimClass(profile.anos_lecionados[0]);
                } else {
                  setSimClass('');
                }
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'criar_simulado' || activeTab === 'resultados_simulado'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulados</span>
              {tabNotificationCounts.criar_simulado > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.criar_simulado}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('criar_aviso')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'criar_aviso' 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Avisos</span>
              {tabNotificationCounts.criar_aviso > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {tabNotificationCounts.criar_aviso}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vistos')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border shrink-0 relative ${
                activeTab === 'vistos' 
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                  : 'bg-neutral-900/60 text-neutral-450 border-transparent hover:text-neutral-200'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Vistos</span>
            </button>
            <button
              onClick={() => setActiveTab('wsm_athenas')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
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
            
            {/* Browser Push Notification Compact Badge */}
            <BrowserNotificationPrompt userRole="teacher" compact />

            <button
              onClick={onLogout}
              className="p-2 bg-neutral-900 text-neutral-400 hover:text-red-400 rounded-xl transition-all border border-neutral-850 shrink-0 cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Browser Push Notification Banner */}
        {activeTab !== 'wsm_athenas' && (
          <div className="mb-4">
            <BrowserNotificationPrompt userRole="teacher" />
          </div>
        )}

        {activeTab === 'conversas' ? (
          <ClassChat
            currentUserEmail={email}
            currentUserName={profile?.nome_completo || 'Professor'}
            currentUserRole="teacher"
            userAnosLecionados={allTeacherClasses.length > 0 ? allTeacherClasses : (profile?.anos_lecionados || setAnosLecionados || [])}
          />
        ) : activeTab === 'vistos' ? (
          <TeacherNotebooksReview
            teacherEmail={email}
            teacherName={profile?.nome_completo || 'Professora'}
            teacherEscola={profile?.escola || setEscola}
            teacherAnosLecionados={allTeacherClasses}
          />
        ) : activeTab === 'calendario' ? (
          <AcademicCalendar
            userRole="teacher"
            userEmail={email}
            userName={profile?.nome_completo || 'Professor'}
            exams={postedExams}
            mockExams={teacherSimulados}
            onViewResults={() => setActiveTab('resultados_simulado')}
          />
        ) : activeTab === 'wsm_athenas' ? (
          <WsmChat userEmail={email} userRole="teacher" />
        ) : activeTab === 'criar_aviso' ? (
          /* PÁGINA DE GERENCIAMENTO DE AVISOS DO PROFESSOR */
          <div className="space-y-8 animate-fadeIn">
            <div className="p-6 rounded-3xl bg-neutral-950/20 border border-emerald-950/10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-emerald-400" />
                  Mural de Avisos & Comunicados
                </h2>
                <p className="text-neutral-400 text-xs mt-1">
                  Gerencie e publique comunicados acadêmicos para as suas turmas e salas virtuais. Os estudantes receberão alertas instantâneos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const legacyClasses = profile?.anos_lecionados || [];
                  const virtualClassesNames = virtualClasses.map(vc => vc.name);
                  const allTeacherClasses = Array.from(new Set([...legacyClasses, ...virtualClassesNames]));
                  
                  if (allTeacherClasses.length > 0 && !newAnnClass) {
                    setNewAnnClass(allTeacherClasses[0]);
                  }
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Comunicado</span>
              </button>
            </div>

            {loadingAnns ? (
              <div className="py-20 text-center text-neutral-550">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-4"></div>
                <p className="text-xs">Buscando comunicados no banco de dados...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const legacyClasses = profile?.anos_lecionados || [];
                  const virtualClassesNames = virtualClasses.map(vc => vc.name);
                  const allTeacherClasses = Array.from(new Set([...legacyClasses, ...virtualClassesNames]));

                  if (allTeacherClasses.length === 0 && dbAnnouncements.length === 0) {
                    return (
                      <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10">
                        <Megaphone className="w-10 h-10 text-neutral-600 mx-auto mb-3 animate-pulse" />
                        <h4 className="text-sm font-semibold text-neutral-400">Nenhuma sala vinculada ou aviso criado</h4>
                        <p className="text-xs text-neutral-550 mt-1 max-w-sm mx-auto">Vincule turmas no seu perfil ou crie salas virtuais para poder disparar comunicados acadêmicos.</p>
                      </div>
                    );
                  }

                  // Avisos que não pertencem a nenhuma das turmas atuais listadas
                  const unmatchedAnns = dbAnnouncements.filter(ann => {
                    const className = ann.class_name || '';
                    return !allTeacherClasses.some(c => c.toLowerCase() === className.toLowerCase());
                  });

                  return (
                    <div className="space-y-8">
                      {/* Seções das salas */}
                      {allTeacherClasses.map((className) => {
                        const classAnns = dbAnnouncements.filter(ann => (ann.class_name || '').toLowerCase() === className.toLowerCase());
                        return (
                          <div key={className} className="p-6 rounded-3xl bg-neutral-950/40 border border-neutral-900 backdrop-blur-md space-y-5">
                            <div className="flex items-center justify-between border-b border-neutral-850/60 pb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                <h3 className="text-sm font-extrabold text-neutral-200">
                                  Turma: <span className="text-emerald-400">{className}</span>
                                </h3>
                                <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-850 px-2 py-0.5 rounded-full ml-2">
                                  {classAnns.length} {classAnns.length === 1 ? 'aviso' : 'avisos'}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setNewAnnClass(className);
                                  setIsCreateModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Criar Aviso</span>
                              </button>
                            </div>

                            {classAnns.length === 0 ? (
                              <div className="py-8 text-center text-neutral-550 border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20 space-y-3">
                                <p className="text-xs">Nenhum aviso ativo nesta turma.</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewAnnClass(className);
                                    setIsCreateModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Criar primeiro aviso para esta turma</span>
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {classAnns.map(ann => (
                                  <div key={ann.id} className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-850/50 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-4 shadow-sm">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                          ann.category === 'Urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                          ann.category === 'Prova' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                          ann.category === 'Evento' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                          'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                        }`}>
                                          {ann.category === 'Urgent' ? '🚨 Urgente' : ann.category === 'Prova' ? '📝 Prova' : ann.category === 'Evento' ? '🎉 Evento' : '📢 Geral'}
                                        </span>
                                        <span className="text-[10px] text-neutral-500 font-mono">
                                          {ann.created_at ? new Date(ann.created_at).toLocaleDateString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                      </div>

                                      <h4 className="text-sm font-bold text-neutral-100 font-display leading-snug break-words">{ann.title}</h4>
                                      <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap break-words">{ann.content || ann.message}</p>
                                      
                                      {ann.image_url && (
                                        <div 
                                          className="rounded-xl overflow-hidden border border-neutral-850 aspect-video w-full relative bg-neutral-950 flex items-center justify-center cursor-zoom-in group"
                                          onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: ann.image_url }))}
                                          title="Clique para ver em tela cheia"
                                        >
                                          <img src={ann.image_url} alt="Imagem do Aviso" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[11px] font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Clique para ampliar 🔍</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-neutral-850/60">
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/10 text-[11px] font-bold font-mono">
                                          <span>👍</span>
                                          <span>{ann.likes_count || 0}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAnnouncementDetail(ann)}
                                          className="text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3" />
                                          <span>Detalhes</span>
                                        </button>
                                      </div>
                                      
                                      <button
                                        onClick={() => handleDeleteAnnouncement(ann.id)}
                                        className="p-1.5 bg-neutral-950 hover:bg-red-950/20 text-neutral-500 hover:text-red-400 border border-neutral-850 hover:border-red-500/20 rounded-lg transition-colors cursor-pointer"
                                        title="Excluir Aviso"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Avisos Gerais / Outros */}
                      {unmatchedAnns.length > 0 && (
                        <div className="p-6 rounded-3xl bg-neutral-950/40 border border-neutral-900 backdrop-blur-md space-y-5">
                          <div className="flex items-center justify-between border-b border-neutral-850/60 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                              <h3 className="text-sm font-extrabold text-neutral-200">
                                Outros / Avisos Sem Turma
                              </h3>
                              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-850 px-2 py-0.5 rounded-full ml-2">
                                {unmatchedAnns.length} {unmatchedAnns.length === 1 ? 'aviso' : 'avisos'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {unmatchedAnns.map(ann => (
                              <div key={ann.id} className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-850/50 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-4 shadow-sm">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                      ann.category === 'Urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      ann.category === 'Prova' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                      ann.category === 'Evento' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                      'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                    }`}>
                                      {ann.category === 'Urgent' ? '🚨 Urgente' : ann.category === 'Prova' ? '📝 Prova' : ann.category === 'Evento' ? '🎉 Evento' : '📢 Geral'}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono">
                                      {ann.created_at ? new Date(ann.created_at).toLocaleDateString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
                                    </span>
                                  </div>

                                  <h4 className="text-sm font-bold text-neutral-100 font-display leading-snug break-words">{ann.title}</h4>
                                  <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap break-words">{ann.content || ann.message}</p>
                                  
                                  {ann.image_url && (
                                    <div 
                                      className="rounded-xl overflow-hidden border border-neutral-850 aspect-video w-full relative bg-neutral-950 flex items-center justify-center cursor-zoom-in group"
                                      onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: ann.image_url }))}
                                      title="Clique para ver em tela cheia"
                                    >
                                      <img src={ann.image_url} alt="Imagem do Aviso" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Clique para ampliar 🔍</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-neutral-850/60">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/10 text-[11px] font-bold font-mono">
                                      <span>👍</span>
                                      <span>{ann.likes_count || 0}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAnnouncementDetail(ann)}
                                      className="text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Detalhes</span>
                                    </button>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleDeleteAnnouncement(ann.id)}
                                    className="p-1.5 bg-neutral-950 hover:bg-red-950/20 text-neutral-500 hover:text-red-400 border border-neutral-850 hover:border-red-500/20 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir Aviso"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : activeTab === 'criar_simulado' || activeTab === 'resultados_simulado' ? (
          <TeacherSimulados
            email={email}
            teacherName={profile?.nome_completo || 'Professor'}
            teacherSubject={profile?.materia || 'Biologia'}
            availableClasses={allTeacherClasses}
            onDataChange={loadTeacherData}
          />
        ) : activeTab === 'marcar_prova' ? (
          /* SECTION MARCAR PROVA (FÍSICA) */
          <div className="space-y-8 animate-fadeIn">
            
            {/* Header section card */}
            <div className="p-6 rounded-3xl bg-neutral-950/20 border border-emerald-950/10 backdrop-blur-md">
              <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Marcar Prova Presencial
              </h2>
              <p className="text-neutral-400 text-xs mt-1">
                Agende e divulgue lembretes de provas presenciais. Ao cadastrar uma prova física, os alunos das turmas selecionadas receberão imediatamente uma notificação em tempo real na aba "Notificações".
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
              {/* Form Column */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md">
                  <h3 className="text-base font-bold text-neutral-200 mb-4 font-display">
                    {editingExamId ? '📝 Editar Detalhes da Prova' : '➕ Agendar Nova Prova'}
                  </h3>

                  <form onSubmit={handleExamSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-450 tracking-wider uppercase mb-1">Título da Prova</label>
                      <input
                        type="text"
                        placeholder="Ex: Prova de Termodinâmica"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/35 rounded-xl text-xs text-neutral-200 placeholder-neutral-655 outline-none transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-450 tracking-wider uppercase mb-1">Data e Horário</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-950/20 border border-neutral-900/60 p-3 rounded-2xl">
                        <div>
                          <span className="text-[9px] font-semibold text-neutral-550 uppercase tracking-wider block mb-1">1. Selecionar Data</span>
                          <CustomDatePicker
                            value={examDate}
                            onChange={setExamDate}
                          />
                        </div>
                        <div>
                          <span className="text-[9px] font-semibold text-neutral-550 uppercase tracking-wider block mb-1">2. Digitar Horário</span>
                          <input
                            type="time"
                            value={examTime}
                            onChange={(e) => setExamTime(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-neutral-955 border border-neutral-850 hover:border-emerald-500/30 focus-within:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all [color-scheme:dark]"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className={`p-3 rounded-2xl transition-all border ${
                      selectedClasses.length === 0 && postingError
                        ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/30'
                        : selectedClasses.length === 0
                        ? 'bg-neutral-950/40 border-neutral-850'
                        : 'bg-emerald-950/10 border-emerald-500/20'
                    }`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <label className="text-[10px] font-semibold text-neutral-350 tracking-wider uppercase font-mono font-bold flex items-center gap-1.5">
                          Destinatários da Prova
                          {selectedClasses.length > 0 ? (
                            <span className="text-emerald-400 font-sans font-medium text-[11px]">
                              ({selectedClasses.length} {selectedClasses.length === 1 ? 'sala selecionada' : 'salas selecionadas'})
                            </span>
                          ) : (
                            <span className="text-amber-400 font-sans font-semibold text-[10px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              Obrigatório selecionar ao menos uma sala
                            </span>
                          )}
                        </label>

                        {/* Quick select all / clear button for official classes if more than 1 */}
                        {(profile?.anos_lecionados || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const official = profile?.anos_lecionados || [];
                              const allSelected = official.every(cls => selectedClasses.includes(cls));
                              if (allSelected) {
                                setSelectedClasses(prev => prev.filter(c => !official.includes(c)));
                              } else {
                                setSelectedClasses(prev => Array.from(new Set([...prev, ...official])));
                              }
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium cursor-pointer"
                          >
                            {(profile?.anos_lecionados || []).every(cls => selectedClasses.includes(cls))
                              ? 'Desmarcar Todas'
                              : 'Selecionar Todas as Turmas'}
                          </button>
                        )}
                      </div>
                      
                      {/* Turmas Oficiais */}
                      <div className="mt-1.5">
                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest block mb-1">Turmas Oficiais</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile?.anos_lecionados || []).map((cls) => {
                            const isChecked = selectedClasses.includes(cls);
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => handleToggleClass(cls)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer flex items-center gap-1.5 ${
                                  isChecked
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                    : 'bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                                }`}
                              >
                                {isChecked ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : null}
                                <span>{cls}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Virtual Classes */}
                      {virtualClasses.length > 0 && (
                        <div className="mt-3">
                          <span className="text-[9px] text-neutral-500 uppercase tracking-widest block mb-1 font-mono font-bold">Salas Virtuais (Suas)</span>
                          <div className="flex flex-wrap gap-1.5">
                            {virtualClasses.map((vc) => {
                              const targetVal = vc.name || vc.id;
                              const isChecked = selectedClasses.includes(targetVal);
                              return (
                                <button
                                  key={vc.id || vc.name}
                                  type="button"
                                  onClick={() => handleToggleClass(targetVal)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer flex items-center gap-1.5 ${
                                    isChecked
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                      : 'bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                                  }`}
                                  title={vc.name}
                                >
                                  {isChecked ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : null}
                                  <span>{vc.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Empty selection warning message */}
                      {selectedClasses.length === 0 && (
                        <div className="mt-2.5 p-2 px-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-300 text-[11px] animate-fadeIn">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <span>Selecione pelo menos uma sala acima para divulgar o lembrete.</span>
                        </div>
                      )}

                      {/* Individual Alunos */}
                      <div className="mt-3">
                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest block mb-1 font-mono font-bold">Enviar Individualmente</span>
                        <select
                          onChange={(e) => {
                            const mail = e.target.value;
                            if (mail && !selectedClasses.includes(mail)) {
                              handleToggleClass(mail);
                            }
                            e.target.value = '';
                          }}
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-350 outline-none"
                        >
                          <option value="">Clique para buscar e adicionar aluno...</option>
                          {teacherTaughtStudents
                            .filter(st => st.email && !st.email.endsWith('@example.com'))
                            .map((st) => {
                              const isAdded = selectedClasses.includes(st.email);
                              return (
                                <option key={st.id || st.email} value={st.email} disabled={isAdded}>
                                  {st.nome_completo} ({st.turma || 'Sem turma'}) {isAdded ? '✓ Adicionado' : ''}
                                </option>
                              );
                            })}
                        </select>
                        
                        {/* Display tags for specifically added individuals */}
                        {selectedClasses.filter(c => c.includes('@')).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedClasses.filter(c => c.includes('@')).map(mail => {
                              const matchStud = teacherTaughtStudents.find(st => st.email.toLowerCase() === mail.toLowerCase()) || studentsUnderMentorship.find(st => st.email.toLowerCase() === mail.toLowerCase());
                              return (
                                <span
                                  key={mail}
                                  onClick={() => handleToggleClass(mail)}
                                  className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded cursor-pointer hover:bg-red-950/20 hover:text-red-400 hover:border-red-500/25 transition-all text-center"
                                  title="Clique para remover"
                                >
                                  👤 {matchStud ? matchStud.nome_completo : mail} ✕
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-450 tracking-wider uppercase mb-1">Conteúdo Cobrado</label>
                      <textarea
                        rows={4}
                        placeholder="Descreva os temas conceituais, capítulos ou referências (ex: Membrana plasmática, citoplasma, núcleo, organelas...)"
                        value={examContent}
                        onChange={(e) => setExamContent(e.target.value)}
                        className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/35 rounded-xl text-xs text-neutral-200 placeholder-neutral-655 outline-none transition-all resize-none font-sans"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-450 tracking-wider uppercase mb-1">Observações Adicionais (Opcional)</label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Trazer caneta azul ou preta, calculadora científica permitida, etc."
                        value={examObservations}
                        onChange={(e) => setExamObservations(e.target.value)}
                        className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/35 rounded-xl text-xs text-neutral-200 placeholder-neutral-655 outline-none transition-all resize-none font-sans"
                      />
                    </div>

                    {postingError && (
                      <div className="flex items-center justify-between gap-2 p-2.5 px-3 bg-red-950/40 border border-red-500/40 rounded-xl text-[11px] text-red-200 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                          <span className="font-medium">{postingError}</span>
                        </div>
                        {!postingError.toLowerCase().includes('selecione') && (
                          <button
                            type="button"
                            onClick={(e) => handleExamSubmit(e as any)}
                            disabled={isPostingExam}
                            className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Tentar Novamente</span>
                          </button>
                        )}
                      </div>
                    )}

                    {postingSuccess && (
                      <div className="flex items-center gap-1.5 p-2 px-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>{postingSuccess}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isPostingExam || selectedClasses.length === 0}
                        className={`flex-1 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                          selectedClasses.length === 0
                            ? 'bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-not-allowed opacity-80'
                            : 'bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-neutral-950 shadow-lg shadow-emerald-500/20 cursor-pointer'
                        }`}
                        title={selectedClasses.length === 0 ? 'Selecione ao menos uma sala acima para divulgar o lembrete' : ''}
                      >
                        {isPostingExam ? (
                          <span>Enviando...</span>
                        ) : selectedClasses.length === 0 ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-neutral-400">Selecione ao menos 1 sala para divulgar</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{editingExamId ? 'Salvar Alterações' : 'Divulgar Lembrete'}</span>
                          </>
                        )}
                      </button>

                      {editingExamId && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-4 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* List Column */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md">
                  <h3 className="text-base font-bold text-neutral-200 mb-4 font-display">
                    🗓️ Provas Presenciais Marcadas ({postedExams.length})
                  </h3>

                  {postedExams.length === 0 ? (
                    <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20">
                      <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-neutral-400">Nenhuma prova marcada por você até o momento.</p>
                      <p className="text-xs text-neutral-550 mt-1">Preencha o formulário ao lado para compartilhar um lembrete com os estudantes.</p>
                    </div>
                  ) : (
                    <div className="max-h-[580px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {postedExams.map((ex) => (
                          <div key={ex.id} className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-905 hover:border-emerald-500/20 transition-all flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                  {ex.materia || profile?.materia || 'Biologia'}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-850">
                                  <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>Prova: {formatExamDateDisplay(ex).fullFormatted}</span>
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-neutral-100 mt-2">{ex.title}</h4>
                              
                                <div className="text-xs text-neutral-400 mt-2 space-y-1">
                                  <p><strong className="text-neutral-300">Conteúdo:</strong> {cleanExamContent(ex.content)}</p>
                                  {cleanExamObservations(ex.observations) && (
                                    <p><strong className="text-neutral-300 font-semibold font-mono">Obs:</strong> {cleanExamObservations(ex.observations)}</p>
                                  )}
                                </div>

                              <div className="flex flex-wrap gap-1 mt-3">
                                {ex.classes?.map((c: string) => (
                                  <span key={c} className="text-[9px] bg-neutral-950 border border-neutral-850 text-neutral-450 px-1.5 py-0.5 rounded">
                                    Turma: {c}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 border-t border-neutral-900/40 pt-3">
                              <button
                                onClick={() => handleEditClick(ex)}
                                className="flex-1 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-800 text-neutral-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <Edit className="w-3 h-3 text-emerald-400" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => handleDeleteExam(ex.id)}
                                className="px-3 py-1.5 bg-neutral-950 border border-transparent hover:border-red-950/20 hover:text-red-400 text-neutral-500 hover:text-red-400 text-[11px] rounded-lg transition-all cursor-pointer"
                                title="Excluir prova"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : activeTab === 'salas' ? (
          /* PÁGINA DEDICADA DE SALAS E GESTÃO DE TURMAS */
          <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
            {/* Header da Página de Salas */}
            <div className="p-6 sm:p-8 rounded-3xl bg-neutral-950/40 border border-neutral-900/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-neutral-100 font-display tracking-tight">
                      Salas & Gestão de Turmas
                    </h1>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                      Painel Docente
                    </span>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed max-w-2xl mt-1">
                  Gerencie suas salas virtuais, crie novas turmas, gere códigos de convite e visualize todos os estudantes matriculados.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-left">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono block">Salas Virtuais</span>
                  <strong className="text-sm md:text-base text-emerald-400 font-bold font-mono">{virtualClasses.length}</strong>
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-left">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono block">Alunos Totais</span>
                  <strong className="text-sm md:text-base text-emerald-400 font-bold font-mono">{teacherTaughtStudents.length}</strong>
                </div>
              </div>
            </div>

            {/* Seção de Salas Virtuais do Docente */}
            <TeacherVirtualClasses
              email={email}
              teacherId={profile?.id}
              teacherName={profile?.nome_completo || 'Professor'}
              allStudents={studentsUnderMentorship}
              virtualClasses={virtualClasses}
              anosLecionados={profile?.anos_lecionados || []}
              onRefreshData={loadTeacherData}
            />

            {/* Listagem de Alunos de Minhas Turmas */}
            <div className="p-6 sm:p-8 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md">
              {(() => {
                const filteredStudents = teacherTaughtStudents;
                const activeCohortsText = allTeacherClasses.length > 0 ? allTeacherClasses.join(', ') : 'Sem turmas';
                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-neutral-100 font-display">Alunos de Minhas Turmas ({activeCohortsText})</h2>
                          <p className="text-xs text-neutral-400">Estudantes matriculados nas suas turmas regulares e salas virtuais.</p>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-400 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800 font-mono">
                        Total de Alunos: <strong className="text-emerald-400 font-bold">{filteredStudents.length}</strong>
                      </span>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div className="py-12 text-center text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-2xl bg-neutral-950/20">
                        <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
                        Nenhum aluno cadastrado nas suas turmas ativas no momento.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-900 text-neutral-500 text-xs uppercase tracking-wider font-mono">
                              <th className="pb-3 font-medium">Estudante</th>
                              <th className="pb-3 font-medium text-center">Nº de Chamada</th>
                              <th className="pb-3 font-medium text-right">Turma</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900/40 text-sm">
                            {filteredStudents.map((st) => (
                              <tr key={st.id} className="hover:bg-emerald-950/5 transition-colors group">
                                <td className="py-3 font-medium text-neutral-200">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[10px] text-emerald-400 font-bold uppercase shrink-0">
                                      {st.nome_completo ? st.nome_completo[0].toUpperCase() : 'A'}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-semibold block text-neutral-100 text-xs truncate">{st.nome_completo}</span>
                                      <span className="text-[10px] text-neutral-500 font-mono block truncate">{st.email}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 text-center text-xs text-neutral-400 font-mono font-medium">#{st.numero_chamada || '-'}</td>
                                <td className="py-3 text-right">
                                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border bg-emerald-950/20 text-emerald-450 border-emerald-500/10">
                                    {st.turma}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Main Dashboard Content Layout ('inicio') */
          <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Personalized welcome greeting card */}
            <div className="col-span-1 lg:col-span-3">
              <div className="p-6 sm:p-8 rounded-3xl bg-neutral-950/40 border border-neutral-900/80 backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-neutral-100 font-display">Olá, {profile ? profile.nome_completo : 'Professor'}!</h2>
                    <p className="text-neutral-400 text-xs mt-1.5 leading-relaxed max-w-2xl">
                      Bem-vindo de volta ao seu painel docente do Athenas. Aqui você acompanha o resumo geral, notificações de conclusão de simulados e atalhos para suas salas e avaliações.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('salas')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 shrink-0 border border-emerald-400/30"
                  >
                    <Users className="w-4 h-4" />
                    <span>Acessar Minhas Salas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action & Overview Bento Grid */}
            <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab('salas')}
                className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-900/80 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    {allTeacherClasses.length} Salas
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors">
                    Salas & Turmas
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    Gerencie salas virtuais, códigos de convite e alunos cadastrados.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 pt-1">
                  <span>Acessar Salas</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('criar_simulado')}
                className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-900/80 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    {publishedTeacherSimulados.length} {publishedTeacherSimulados.length === 1 ? 'Simulado' : 'Simulados'}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors">
                    Simulados & Provas
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    Crie simulados online, monte gabaritos e acompanhe o ranking.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 pt-1">
                  <span>Ver Simulados</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('criar_aviso')}
                className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-900/80 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    Mural
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors">
                    Mural de Avisos
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    Publique comunicados e envie recados para as suas turmas.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 pt-1">
                  <span>Publicar Aviso</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('marcar_prova')}
                className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-900/80 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    Presencial
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors">
                    Marcar Prova
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    Agende datas de avaliações físicas no calendário dos alunos.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 pt-1">
                  <span>Agendar Prova</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* CENTRAL DE NOTIFICAÇÕES GERAIS DO PROFESSOR */}
            <div className="col-span-1 lg:col-span-3">
              <div className="space-y-4 animate-fadeIn">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between border-l-4 border-emerald-500 pl-3.5 py-1 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-neutral-100 font-display uppercase tracking-wider flex items-center gap-2">
                        Central de Notificações
                      </h3>
                      <p className="text-xs text-neutral-400 font-mono">
                        {allNotifications.length > 0 ? (
                          <>Você possui <strong className="text-emerald-400 font-bold">{allNotifications.length}</strong> notificação(ões) ativa(s) entre mensagens, entregas e avisos.</>
                        ) : (
                          'Todas as notificações de mensagens, entregas de simulados, turmas e avisos aparecerão aqui'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allNotifications.length > 0 && (
                      <button
                        onClick={() => handleDismissAllNotifs(allNotifications.map(n => n.id))}
                        className="text-[11px] font-semibold text-neutral-400 hover:text-emerald-300 bg-neutral-900/80 hover:bg-neutral-850 px-3 py-1.5 rounded-xl border border-neutral-800 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Limpar todas as notificações"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Marcar todas como lidas</span>
                      </button>
                    )}
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-mono font-bold uppercase tracking-widest">
                      {allNotifications.length} ATIVAS
                    </span>
                  </div>
                </div>

                {/* Filter Pills */}
                {allNotifications.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setActiveNotifFilter('todas')}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                        activeNotifFilter === 'todas'
                          ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold shadow-sm shadow-emerald-500/20'
                          : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                      }`}
                    >
                      Todas ({allNotifications.length})
                    </button>
                    {chatNotifs.length > 0 && (
                      <button
                        onClick={() => setActiveNotifFilter('mensagens')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'mensagens'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Mensagens ({chatNotifs.length})
                      </button>
                    )}
                    {(sim100Notifs.length > 0 || recentSubmissionsNotifs.length > 0) && (
                      <button
                        onClick={() => setActiveNotifFilter('simulados')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'simulados'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Simulados ({sim100Notifs.length + recentSubmissionsNotifs.length})
                      </button>
                    )}
                    {vistosNotifs.length > 0 && (
                      <button
                        onClick={() => setActiveNotifFilter('vistos')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'vistos'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Vistos ({vistosNotifs.length})
                      </button>
                    )}
                    {upcomingExamsNotifs.length > 0 && (
                      <button
                        onClick={() => setActiveNotifFilter('provas')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'provas'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-450 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Provas ({upcomingExamsNotifs.length})
                      </button>
                    )}
                    {announcementsNotifs.length > 0 && (
                      <button
                        onClick={() => setActiveNotifFilter('avisos')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'avisos'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Avisos ({announcementsNotifs.length})
                      </button>
                    )}
                    {virtualClassesNotifs.length > 0 && (
                      <button
                        onClick={() => setActiveNotifFilter('salas')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer border ${
                          activeNotifFilter === 'salas'
                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                            : 'bg-neutral-900/60 text-neutral-450 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-850'
                        }`}
                      >
                        Salas ({virtualClassesNotifs.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-neutral-900/30 border border-neutral-850 text-center space-y-2.5">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-200">
                      ✨ Nenhuma notificação pendente no momento
                    </p>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      Você está em dia com todas as mensagens de alunos, entregas de simulados e avisos publicados.
                    </p>
                  </div>
                ) : (
                  /* Cards Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredNotifications.map(notif => {
                      const getCategoryIcon = () => {
                        switch (notif.category as string) {
                          case 'mensagens':
                            return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
                          case 'simulados':
                            return <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />;
                          case 'provas':
                            return <Calendar className="w-3.5 h-3.5 text-emerald-400" />;
                          case 'avisos':
                            return <Megaphone className="w-3.5 h-3.5 text-emerald-400" />;
                          case 'salas':
                            return <Users className="w-3.5 h-3.5 text-emerald-400" />;
                          case 'vistos':
                            return <Award className="w-3.5 h-3.5 text-amber-400" />;
                          default:
                            return <Bell className="w-3.5 h-3.5 text-emerald-400" />;
                        }
                      };

                      return (
                        <motion.div
                          key={`teacher-notif-${notif.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-850 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3 group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                {getCategoryIcon()}
                                {notif.categoryLabel}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {notif.timestamp ? new Date(notif.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                                <button
                                  onClick={() => handleDismissNotif(notif.id)}
                                  title="Marcar como lida e dispensar"
                                  className="p-1 rounded-lg hover:bg-neutral-850 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors line-clamp-1">
                                {notif.title}
                              </h4>
                              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                {notif.description}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              handleDismissNotif(notif.id);
                              if (notif.targetTab === 'resultados_simulado' && notif.examId) {
                                setSelectedSubExamId(notif.examId);
                              }
                              setActiveTab(notif.targetTab as any);
                            }}
                            className="w-full py-2 bg-neutral-900 hover:bg-emerald-600 text-neutral-300 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-neutral-800 hover:border-emerald-500"
                          >
                            <span>{notif.actionLabel}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </main>
        )}
  </div>

  {/* Modal para Criar Comunicado com Imagem */}
  {isCreateModalOpen && (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-emerald-500/30 rounded-3xl p-6 space-y-5 shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-100 font-display">
                  Novo Comunicado Escolar
                </h3>
                {newAnnClass && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {newAnnClass}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-450 mt-0.5">
                Dispare avisos com ou sem imagem para uma turma
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreateModalOpen(false);
              setAnnError(null);
              setAnnSuccess(null);
              setNewAnnTitle("");
              setNewAnnMessage("");
              setNewAnnImageBase64("");
              setNewAnnImageFileName("");
            }}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handlePublishAnnouncement} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                Turma / Sala de Destino
              </label>
              <select
                value={newAnnClass}
                onChange={(e) => setNewAnnClass(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 outline-none cursor-pointer"
                required
              >
                <option value="" disabled>Selecione a turma...</option>
                {(() => {
                  const legacyClasses = profile?.anos_lecionados || [];
                  const virtualClassesNames = virtualClasses.map(vc => vc.name);
                  const allTeacherClasses = Array.from(new Set([...legacyClasses, ...virtualClassesNames]));
                  return allTeacherClasses.map(clsName => (
                    <option key={clsName} value={clsName}>{clsName}</option>
                  ));
                })()}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                Categoria
              </label>
              <select
                value={newAnnCategory}
                onChange={(e) => setNewAnnCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 outline-none cursor-pointer"
              >
                <option value="Geral">☕ Geral</option>
                <option value="Urgent">🚨 Urgente</option>
                <option value="Prova">📝 Prova</option>
                <option value="Evento">🎉 Evento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
              Título do Comunicado
            </label>
            <input
              type="text"
              placeholder="Ex: Entrega do Trabalho Prático"
              value={newAnnTitle}
              onChange={(e) => setNewAnnTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
              Mensagem
            </label>
            <textarea
              rows={4}
              placeholder="Escreva os detalhes e orientações do comunicado para os estudantes..."
              value={newAnnMessage}
              onChange={(e) => setNewAnnMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none resize-none"
              required
            />
          </div>

          {/* Upload de Imagem */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 font-mono">
              Anexar Imagem (Opcional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Selecionar Arquivo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-neutral-500 truncate max-w-[200px]">
                {newAnnImageFileName || "Nenhuma imagem selecionada (máx 5MB)"}
              </span>
              {newAnnImageBase64 && (
                <button
                  type="button"
                  onClick={() => {
                    setNewAnnImageBase64("");
                    setNewAnnImageFileName("");
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold ml-auto cursor-pointer"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          {annError && (
            <div className="flex items-center gap-2 p-2.5 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{annError}</span>
            </div>
          )}

          {annSuccess && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-450 animate-fadeIn">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{annSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPostingAnn}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/5"
          >
            {isPostingAnn ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-neutral-950"></div>
                <span>Publicando comunicado...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Disparar Comunicado para Alunos</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )}

  {/* Modal de Detalhes Expandidos do Aviso */}
  {selectedAnnouncementDetail && (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4 gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                selectedAnnouncementDetail.category === 'Urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                selectedAnnouncementDetail.category === 'Prova' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                selectedAnnouncementDetail.category === 'Evento' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                'bg-neutral-800 text-neutral-300 border border-neutral-700'
              }`}>
                {selectedAnnouncementDetail.category === 'Urgent' ? '🚨 Urgente' : selectedAnnouncementDetail.category === 'Prova' ? '📝 Prova' : selectedAnnouncementDetail.category === 'Evento' ? '🎉 Evento' : '📢 Geral'}
              </span>
              {selectedAnnouncementDetail.class_name && (
                <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Turma: {selectedAnnouncementDetail.class_name}
                </span>
              )}
              <span className="text-[10px] text-neutral-500 font-mono">
                {selectedAnnouncementDetail.created_at ? new Date(selectedAnnouncementDetail.created_at).toLocaleString('pt-BR') : ''}
              </span>
            </div>
            <h3 className="text-lg font-black text-neutral-100 font-display leading-snug">
              {selectedAnnouncementDetail.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAnnouncementDetail(null)}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-850 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
            {selectedAnnouncementDetail.content || selectedAnnouncementDetail.message}
          </div>

          {selectedAnnouncementDetail.image_url && (
            <div 
              className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center cursor-zoom-in group relative"
              onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: selectedAnnouncementDetail.image_url }))}
            >
              <img 
                src={selectedAnnouncementDetail.image_url} 
                alt="Imagem Anexa" 
                className="w-full max-h-[380px] object-contain group-hover:scale-102 transition-transform" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs font-bold text-white bg-black/70 px-3 py-1.5 rounded-xl">Ampliar imagem 🔍</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-850/60">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-bold font-mono">
              <span>👍 Curtidas:</span>
              <span>{selectedAnnouncementDetail.likes_count || 0}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedAnnouncementDetail(null)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

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
              <h3 className="text-sm font-extrabold text-neutral-100 font-display">Ajustes do Docente</h3>
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
              <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold">Matéria</label>
              <input
                type="text"
                required
                value={setMateria}
                onChange={(e) => setSetMateria(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/30 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-450 uppercase font-mono tracking-widest mb-1.5 font-bold font-semibold">Turmas (Sep. Vírgula)</label>
              <input
                type="text"
                required
                value={setAnosLecionados.join(', ')}
                onChange={(e) => setSetAnosLecionados(e.target.value.split(',').map(cls => cls.trim()).filter(Boolean))}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/30 font-mono"
                placeholder="Ex: 1º Ano, Física A"
              />
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-900 font-bold rounded-xl transition-all text-xs shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer"
            >
              {savingSettings ? 'Gravando dados...' : 'Salvar Preferências'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )}

  {/* Publish Announcement Success Modal */}
  <PublishSuccessModal
    isOpen={!!publishCelebrationData?.isOpen}
    onClose={() => setPublishCelebrationData(null)}
    title={publishCelebrationData?.title}
    targetClass={publishCelebrationData?.targetClass}
  />
</div>
);
}
