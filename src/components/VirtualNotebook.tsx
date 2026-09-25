/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Trash2,
  Save,
  Award,
  CheckCheck,
  X,
  FileText,
  Calendar,
  User,
  StickyNote,
  AlertCircle,
  AlertTriangle,
  Cloud,
  CloudOff,
  Loader2,
  HardDrive,
  Check
} from 'lucide-react';
import {
  NotebookPage,
  NotebookStamp
} from '../types';
import { supabase } from '../supabase';
import { areTurmasMatching } from '../utils/profileDb';

interface VirtualNotebookProps {
  userRole: 'student' | 'teacher';
  userEmail: string;
  userName?: string;
  userTurma?: string;
  userEscola?: string;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  // If teacher is inspecting a specific notebook:
  inspectNotebookId?: string;
  inspectStudentEmail?: string;
  inspectStudentName?: string;
  inspectStudentClass?: string;
  onReviewCompleted?: (reviewId: string, stampLabel: string) => void;
  onCloseInspect?: () => void;
}

const AVAILABLE_STAMPS: {
  type: NotebookStamp['type'];
  label: string;
  subLabel: string;
  color: string;
}[] = [
  {
    type: 'visto',
    label: 'VISTO REGULAR',
    subLabel: 'Caderno em dia',
    color: '#059669'
  },
  {
    type: 'excelente',
    label: '⭐ EXCELENTE!',
    subLabel: 'Capricho exemplar',
    color: '#2563eb'
  },
  {
    type: 'foco',
    label: '🔥 FOCO TOTAL!',
    subLabel: 'Grande dedicação',
    color: '#ea580c'
  },
  {
    type: 'nota10',
    label: '💯 NOTA 10!',
    subLabel: 'Trabalho perfeito',
    color: '#7c3aed'
  },
  {
    type: 'revisar',
    label: '⚠️ REVISAR CONTEÚDO',
    subLabel: 'Completar notas',
    color: '#dc2626'
  },
  {
    type: 'parabens',
    label: '👏 MUITO BOM!',
    subLabel: 'Excelente resumo',
    color: '#0d9488'
  }
];

// Approximate maximum lines / height per fixed A4 sheet content area
const MAX_A4_CONTENT_CHARS = 2400;

export default function VirtualNotebook({
  userRole,
  userEmail,
  userName = 'Estudante',
  userTurma = '',
  userEscola = '',
  onUnsavedChangesChange,
  inspectNotebookId,
  inspectStudentEmail,
  inspectStudentName,
  inspectStudentClass,
  onReviewCompleted,
  onCloseInspect
}: VirtualNotebookProps) {
  const SUBJECT = 'Biologia';
  const targetEmail = inspectStudentEmail || userEmail || (typeof window !== 'undefined' ? localStorage.getItem('athenas_user_email') || '' : '');
  const isReadOnly = Boolean(inspectStudentEmail) || userRole === 'teacher';

  const [isLoadingNotebook, setIsLoadingNotebook] = useState<boolean>(true);

  // Synchronously initialize state from localStorage cache if available
  const [pages, setPages] = useState<NotebookPage[]>(() => {
    if (!targetEmail) return [{ id: 'page-1', title: '', content: '' }];
    try {
      const storageKey = `athenas_notebook_bio_${targetEmail}`;
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      const raw = localStorage.getItem(draftKey) || localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          return parsed.pages;
        }
      }
    } catch {}
    return [{ id: 'page-1', title: '', content: '' }];
  });

  const [notebookStatus, setNotebookStatus] = useState<'draft' | 'pending_review' | 'reviewed'>(() => {
    if (!targetEmail) return 'draft';
    try {
      const storageKey = `athenas_notebook_bio_${targetEmail}`;
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      const raw = localStorage.getItem(draftKey) || localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.status) return parsed.status;
      }
    } catch {}
    return 'draft';
  });

  const [lastStamp, setLastStamp] = useState<NotebookStamp | null>(() => {
    if (!targetEmail) return null;
    try {
      const storageKey = `athenas_notebook_bio_${targetEmail}`;
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      const raw = localStorage.getItem(draftKey) || localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.last_stamp) return parsed.last_stamp;
      }
    } catch {}
    return null;
  });

  // Autosave and Sync state tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(() => {
    if (!targetEmail) return false;
    try {
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Boolean(parsed.hasDraft);
      }
    } catch {}
    return false;
  });

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'local_only' | 'unsaved' | 'error'>(() => {
    if (!targetEmail) return 'saved';
    try {
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.hasDraft) return 'unsaved';
      }
    } catch {}
    return 'saved';
  });

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
    if (!targetEmail) return null;
    try {
      const storageKey = `athenas_notebook_bio_${targetEmail}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.updated_at) return new Date(parsed.updated_at);
      }
    } catch {}
    return null;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  // Refs for tracking latest data during timers, unmount, and window unload
  const pagesRef = useRef<NotebookPage[]>(pages);
  pagesRef.current = pages;
  const hasUnsavedRef = useRef<boolean>(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;
  const isInitialLoadedRef = useRef<boolean>(false);
  const autosaveTimerRef = useRef<any>(null);

  // Notify parent of unsaved status
  useEffect(() => {
    if (onUnsavedChangesChange) {
      onUnsavedChangesChange(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  // Atomic page deletion states
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Review request modal
  const [requestReviewModalOpen, setRequestReviewModalOpen] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState('');
  const [teachersList, setTeachersList] = useState<{ email: string; nome_completo?: string }[]>([]);

  // Active page & review selection
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [requestReviewPageIndex, setRequestReviewPageIndex] = useState(0);
  const [validationErrorToast, setValidationErrorToast] = useState<string | null>(null);

  // Teacher stamping controls
  const [selectedStampType, setSelectedStampType] = useState<NotebookStamp['type']>('visto');
  const [teacherComment, setTeacherComment] = useState('');
  const [isStamping, setIsStamping] = useState(false);
  const [targetPageIndexToStamp, setTargetPageIndexToStamp] = useState(0);
  const [stampedSuccessPage, setStampedSuccessPage] = useState<number | null>(null);
  const [confirmOverwriteStampOpen, setConfirmOverwriteStampOpen] = useState(false);

  // Play satisfying rubber stamp impact audio
  const playStampSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {
      // Audio fallback
    }
  };

  // Scroll to a specific page smoothly
  const scrollToPage = (pageIdx: number) => {
    setTimeout(() => {
      const el = document.getElementById(`a4-page-${pageIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // References to textareas
  const textareaRefs = useRef<{ [key: number]: HTMLTextAreaElement | null }>({});

  // Core Storage & Save Execution Helper
  const persistNotebook = useCallback(async (
    targetPages: NotebookPage[],
    options: { syncServer?: boolean; markSaved?: boolean } = { syncServer: true, markSaved: true }
  ): Promise<boolean> => {
    if (!targetEmail) return false;
    const primaryKey = `athenas_notebook_bio_${targetEmail}`;
    const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
    const nowIso = new Date().toISOString();
    const versionTs = Date.now();

    // Clean payload strictly adhering to database schema (no invalid columns)
    const dbPayload = {
      student_email: targetEmail,
      student_name: userName || 'Estudante',
      student_class: userTurma || '',
      subject: SUBJECT,
      title: `Caderno de ${SUBJECT}`,
      pages: targetPages,
      status: notebookStatus,
      last_stamp: lastStamp,
      updated_at: nowIso
    };

    const localPayload = {
      ...dbPayload,
      version: versionTs
    };

    // 1. Synchronously save to localStorage cache immediately
    try {
      localStorage.setItem(primaryKey, JSON.stringify(localPayload));
      localStorage.setItem(draftKey, JSON.stringify({ ...localPayload, hasDraft: !options.markSaved }));
    } catch (lsErr) {
      console.warn('LocalStorage quota or write warning:', lsErr);
    }

    if (!options.syncServer || isReadOnly) {
      if (options.markSaved) {
        setSaveStatus('local_only');
      }
      return true;
    }

    // 2. Sync to Supabase cloud database
    try {
      if (options.markSaved) {
        setSaveStatus('saving');
      }
      const { error } = await supabase.from('student_notebooks').upsert(dbPayload, {
        onConflict: 'student_email,subject'
      });

      if (error) {
        throw error;
      }

      if (options.markSaved) {
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setLastSavedAt(new Date(nowIso));
        // Clean draft indicator now that server confirmed receipt
        try {
          localStorage.setItem(draftKey, JSON.stringify({ ...localPayload, hasDraft: false }));
        } catch {}
      }
      return true;
    } catch (dbErr: any) {
      console.error('[VirtualNotebook] Supabase notebook sync error:', dbErr);
      if (options.markSaved) {
        setSaveStatus('local_only');
        setHasUnsavedChanges(true);
      }
      return false;
    }
  }, [targetEmail, userName, userTurma, notebookStatus, lastStamp, isReadOnly]);

  // Manual-only Draft Trigger on Content/Title Change (No auto-server saving)
  const triggerContentChange = useCallback((updatedPages: NotebookPage[]) => {
    if (isReadOnly || !targetEmail) return;
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');

    const primaryKey = `athenas_notebook_bio_${targetEmail}`;
    const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
    const nowIso = new Date().toISOString();
    const versionTs = Date.now();

    const localPayload = {
      student_email: targetEmail,
      student_name: userName || 'Estudante',
      student_class: userTurma || '',
      subject: SUBJECT,
      title: `Caderno de ${SUBJECT}`,
      pages: updatedPages,
      status: notebookStatus,
      last_stamp: lastStamp,
      updated_at: nowIso,
      version: versionTs
    };

    // Instantly persist draft locally in case user reloads before clicking Salvar
    try {
      localStorage.setItem(primaryKey, JSON.stringify(localPayload));
      localStorage.setItem(draftKey, JSON.stringify({ ...localPayload, hasDraft: true }));
    } catch {}
  }, [isReadOnly, targetEmail, userName, userTurma, notebookStatus, lastStamp]);

  // Window beforeunload & pagehide listener to preserve local draft on close/reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedRef.current && !isReadOnly && targetEmail) {
        try {
          const primaryKey = `athenas_notebook_bio_${targetEmail}`;
          const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
          const localPayload = {
            student_email: targetEmail,
            student_name: userName,
            student_class: userTurma,
            subject: SUBJECT,
            title: `Caderno de ${SUBJECT}`,
            pages: pagesRef.current,
            status: notebookStatus,
            last_stamp: lastStamp,
            updated_at: new Date().toISOString(),
            version: Date.now()
          };
          localStorage.setItem(primaryKey, JSON.stringify(localPayload));
          localStorage.setItem(draftKey, JSON.stringify({ ...localPayload, hasDraft: true }));
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [targetEmail, userName, userTurma, notebookStatus, lastStamp, isReadOnly]);

  // Component unmount cleanup (preserves local draft without auto-saving to server)
  useEffect(() => {
    return () => {
      if (hasUnsavedRef.current && !isReadOnly && targetEmail) {
        const primaryKey = `athenas_notebook_bio_${targetEmail}`;
        const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
        const nowIso = new Date().toISOString();
        const localPayload = {
          student_email: targetEmail,
          student_name: userName,
          student_class: userTurma,
          subject: SUBJECT,
          title: `Caderno de ${SUBJECT}`,
          pages: pagesRef.current,
          status: notebookStatus,
          last_stamp: lastStamp,
          updated_at: nowIso,
          version: Date.now()
        };
        try {
          localStorage.setItem(primaryKey, JSON.stringify(localPayload));
          localStorage.setItem(draftKey, JSON.stringify({ ...localPayload, hasDraft: true }));
        } catch {}
      }
    };
  }, [targetEmail, userName, userTurma, notebookStatus, lastStamp, isReadOnly]);

  // Load Teachers list for review request
  useEffect(() => {
    async function loadTeachers() {
      try {
        const cleanUserEmail = (userEmail || '').toLowerCase().trim();
        const cleanUserTurma = (userTurma || '').trim();

        // 1. Fetch virtual classes to find the student's enrolled rooms & teachers
        let matchedTeacherEmail: string | null = null;
        const studentTeacherEmails = new Set<string>();

        try {
          const { data: vClasses } = await supabase
            .from('wsm_virtual_classes')
            .select('teacher_email, name, access_code, student_emails');

          if (vClasses && vClasses.length > 0) {
            vClasses.forEach((vc: any) => {
              let emails: string[] = [];
              if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
              else if (typeof vc.student_emails === 'string') {
                try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()); }
              }
              const isEnrolled = cleanUserEmail && emails.some((e: string) => e && e.toLowerCase().trim() === cleanUserEmail);
              const isTurmaMatch = cleanUserTurma && (areTurmasMatching(vc.name, cleanUserTurma) || areTurmasMatching(vc.access_code, cleanUserTurma));

              if ((isEnrolled || isTurmaMatch) && vc.teacher_email) {
                const tEmail = vc.teacher_email.toLowerCase().trim();
                studentTeacherEmails.add(tEmail);
                if (isEnrolled && !matchedTeacherEmail) {
                  matchedTeacherEmail = tEmail;
                }
              }
            });
          }
        } catch (vcErr) {
          console.warn('Could not query virtual classes for teacher routing:', vcErr);
        }

        // 2. Fetch teacher profiles from wsm_user_profiles
        let teacherProfiles: any[] = [];
        try {
          const { data } = await supabase
            .from('wsm_user_profiles')
            .select('email, nome_completo, role, anos_lecionados, materia')
            .ilike('role', 'teacher');
          if (data) teacherProfiles = data;
        } catch (tpErr) {
          console.warn('Could not query teacher profiles:', tpErr);
        }

        // 3. Filter strictly to teachers linked to this student's class or virtual classes
        const validTeachers = teacherProfiles.filter(t => {
          if (!t || !t.email) return false;
          const tEmail = t.email.toLowerCase().trim();
          
          // Exclude demo, dummy, or deprecated dev domains
          if (tEmail.endsWith('@example.com') || tEmail.endsWith('@atenas.com')) return false;

          // Check if student is actively enrolled in this teacher's virtual class
          if (studentTeacherEmails.has(tEmail)) return true;

          // Check if teacher officially teaches this student's turma
          const taughtClasses = Array.isArray(t.anos_lecionados)
            ? t.anos_lecionados
            : (typeof t.anos_lecionados === 'string' ? t.anos_lecionados.split(',').map((s: string) => s.trim()) : []);

          if (cleanUserTurma && taughtClasses.some((c: string) => areTurmasMatching(c, cleanUserTurma))) {
            return true;
          }
          return false;
        });

        // Deduplicate and filter out any invalid/unrelated accounts
        // We do NOT fallback to all teachers in the database when cleanUserTurma is set
        const finalList = validTeachers.filter((t, idx, arr) => 
          arr.findIndex(x => (x.email || '').toLowerCase().trim() === (t.email || '').toLowerCase().trim()) === idx
        );

        if (finalList.length > 0) {
          // Sort teachers so that the matched class teacher appears first
          const sorted = finalList.sort((a, b) => {
            const aMail = (a.email || '').toLowerCase().trim();
            const bMail = (b.email || '').toLowerCase().trim();
            if (matchedTeacherEmail && aMail === matchedTeacherEmail) return -1;
            if (matchedTeacherEmail && bMail === matchedTeacherEmail) return 1;
            return 0;
          });

          setTeachersList(sorted);
          if (!selectedTeacherEmail || !sorted.some(t => t.email.toLowerCase() === selectedTeacherEmail.toLowerCase())) {
            setSelectedTeacherEmail(matchedTeacherEmail || sorted[0].email);
          }
        } else {
          setTeachersList([]);
          setSelectedTeacherEmail('');
        }
      } catch (e) {
        console.error('Error loading teachers:', e);
      }
    }
    loadTeachers();
  }, [userEscola, userTurma, userEmail]);

  // Fetch, Version Comparison & Draft Restoration
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingNotebook(true);

    async function loadNotebook() {
      if (!targetEmail) {
        setIsLoadingNotebook(false);
        return;
      }
      const storageKey = `athenas_notebook_bio_${targetEmail}`;
      const draftKey = `athenas_notebook_bio_draft_${targetEmail}`;
      
      let localData: any = null;
      try {
        const draftRaw = localStorage.getItem(draftKey);
        const normalRaw = localStorage.getItem(storageKey);
        const bestRaw = draftRaw || normalRaw;
        if (bestRaw) {
          localData = JSON.parse(bestRaw);
        }
      } catch {}

      let serverData: any = null;
      try {
        const { data, error } = await supabase
          .from('student_notebooks')
          .select('*')
          .eq('student_email', targetEmail)
          .eq('subject', SUBJECT)
          .maybeSingle();

        if (error) {
          console.warn('Could not fetch remote notebook:', error);
        } else if (data) {
          serverData = data;
        }
      } catch (e) {
        console.warn('Could not fetch remote notebook:', e);
      }

      if (isCancelled) return;

      const localHasDraft = Boolean(localData && localData.hasDraft);
      const localTime = localData?.updated_at ? new Date(localData.updated_at).getTime() : (localData?.version || 0);
      const serverTime = serverData?.updated_at ? new Date(serverData.updated_at).getTime() : 0;

      if (serverData) {
        // If local storage has an uncommitted draft that is strictly newer than the server (student only)
        if (!inspectStudentEmail && localHasDraft && localTime > serverTime) {
          if (localData.pages && Array.isArray(localData.pages) && localData.pages.length > 0) {
            setPages(localData.pages);
          }
          if (localData.status) setNotebookStatus(localData.status);
          if (localData.last_stamp) setLastStamp(localData.last_stamp);
          if (localData.updated_at) {
            try {
              setLastSavedAt(new Date(localData.updated_at));
            } catch {}
          }
          setSaveStatus('unsaved');
          setHasUnsavedChanges(true);
          setRestoredFromDraft(true);
          setTimeout(() => setRestoredFromDraft(false), 5000);
        } else {
          // Cloud server is the source of truth
          if (serverData.pages && Array.isArray(serverData.pages) && serverData.pages.length > 0) {
            let loadedPages: NotebookPage[] = [...serverData.pages];
            // Normalize: If serverData has last_stamp, attach to targetIdx if that page has no stamp
            if (serverData.last_stamp) {
              const targetIdx = (typeof serverData.last_stamp.pageIndex === 'number' && loadedPages[serverData.last_stamp.pageIndex])
                ? serverData.last_stamp.pageIndex
                : 0;
              if (!loadedPages[targetIdx]?.stamp) {
                loadedPages[targetIdx] = {
                  ...loadedPages[targetIdx],
                  stamp: serverData.last_stamp,
                  reviewNotes: serverData.teacher_feedback || undefined
                };
              }
            }
            setPages(loadedPages);
            const firstUnstamped = loadedPages.findIndex((p: NotebookPage) => !p.stamp);
            if (firstUnstamped !== -1) {
              setTargetPageIndexToStamp(firstUnstamped);
            }
          }
          if (serverData.status) setNotebookStatus(serverData.status);
          if (serverData.last_stamp) setLastStamp(serverData.last_stamp);
          if (serverData.updated_at) {
            try {
              setLastSavedAt(new Date(serverData.updated_at));
            } catch {}
          }
          setSaveStatus('saved');
          setHasUnsavedChanges(false);

          // Synchronize local cache with verified server data
          try {
            localStorage.setItem(storageKey, JSON.stringify(serverData));
            localStorage.setItem(draftKey, JSON.stringify({ ...serverData, hasDraft: false }));
          } catch {}
        }
      } else if (localData && !inspectStudentEmail) {
        // First session / local-only
        if (localData.pages && Array.isArray(localData.pages) && localData.pages.length > 0) {
          let loadedPages: NotebookPage[] = [...localData.pages];
          if (localData.last_stamp) {
            const targetIdx = (typeof localData.last_stamp.pageIndex === 'number' && loadedPages[localData.last_stamp.pageIndex])
              ? localData.last_stamp.pageIndex
              : 0;
            if (!loadedPages[targetIdx]?.stamp) {
              loadedPages[targetIdx] = {
                ...loadedPages[targetIdx],
                stamp: localData.last_stamp,
                reviewNotes: localData.teacher_feedback || undefined
              };
            }
          }
          setPages(loadedPages);
          const firstUnstamped = loadedPages.findIndex((p: NotebookPage) => !p.stamp);
          if (firstUnstamped !== -1) {
            setTargetPageIndexToStamp(firstUnstamped);
          }
        }
        if (localData.status) setNotebookStatus(localData.status);
        if (localData.last_stamp) setLastStamp(localData.last_stamp);
        if (localData.updated_at) {
          try {
            setLastSavedAt(new Date(localData.updated_at));
          } catch {}
        }
        setSaveStatus(localHasDraft ? 'unsaved' : 'saved');
        setHasUnsavedChanges(localHasDraft);
      }

      isInitialLoadedRef.current = true;
      setIsLoadingNotebook(false);
    }

    loadNotebook();

    return () => {
      isCancelled = true;
    };
  }, [targetEmail, inspectStudentEmail]);

  // Handle Page Title Change
  const handleTitleChange = (index: number, value: string) => {
    const updated = [...pages];
    if (updated[index]) {
      updated[index] = { ...updated[index], title: value };
    }
    setPages(updated);
    triggerContentChange(updated);
  };

  // Handle Page Content Change with Auto-Overflow to the next A4 sheet below
  const handleContentChange = (index: number, value: string) => {
    const textarea = textareaRefs.current[index];
    const isOverflowingHeight = textarea && textarea.scrollHeight > textarea.clientHeight + 16;
    const isOverflowingChars = value.length > MAX_A4_CONTENT_CHARS;

    // Check if the current page has reached the end of its A4 size
    if ((isOverflowingHeight || isOverflowingChars) && value.length > 50) {
      // Split content: keep what fits in this page, move the rest to the next page below
      const lines = value.split('\n');
      const linesForCurrentPage = lines.slice(0, Math.max(1, lines.length - 2)).join('\n');
      const overflowText = lines.slice(Math.max(1, lines.length - 2)).join('\n');

      const updated = [...pages];
      updated[index] = { ...updated[index], content: linesForCurrentPage };

      const nextIndex = index + 1;
      if (updated[nextIndex]) {
        updated[nextIndex] = {
          ...updated[nextIndex],
          content: (overflowText + '\n' + (updated[nextIndex].content || '')).trimStart()
        };
      } else {
        updated.push({
          id: `page-${Date.now()}`,
          title: '',
          content: overflowText.trimStart()
        });
      }

      setPages(updated);
      triggerContentChange(updated);

      // Focus the next page textarea smoothly
      setTimeout(() => {
        const nextEl = textareaRefs.current[index + 1];
        if (nextEl) {
          nextEl.focus();
          nextEl.selectionStart = nextEl.selectionEnd = 0;
        }
      }, 50);

      return;
    }

    const updated = [...pages];
    if (updated[index]) {
      updated[index] = { ...updated[index], content: value };
    }
    setPages(updated);
    triggerContentChange(updated);
  };

  // Add a new A4 page below
  const handleAddNewPage = () => {
    const newPage: NotebookPage = {
      id: `page-${Date.now()}`,
      title: '',
      content: ''
    };
    const updated = [...pages, newPage];
    const newIdx = updated.length - 1;
    setPages(updated);
    setActivePageIndex(newIdx);
    triggerContentChange(updated);

    setTimeout(() => {
      const newIdx = updated.length - 1;
      const el = textareaRefs.current[newIdx];
      if (el) {
        el.focus();
      }
    }, 100);
  };

  // Delete an A4 page with confirmation, loading state, try/catch/finally, reversible optimistic update, and atomic persistence
  const handleDeletePage = (indexToDelete: number) => {
    setDeleteErrorMsg('');
    if (pages.length <= 1) {
      setDeleteErrorMsg('O caderno precisa ter ao menos uma folha A4.');
      return;
    }
    setDeleteConfirmIndex(indexToDelete);
  };

  const executeDeletePage = async (indexToDelete: number) => {
    setDeleteErrorMsg('');
    if (pages.length <= 1) {
      setDeleteErrorMsg('O caderno precisa ter ao menos uma folha A4.');
      setDeleteConfirmIndex(null);
      return;
    }

    setIsDeletingPage(true);
    const previousPages = [...pages];
    const updatedPages = pages.filter((_, idx) => idx !== indexToDelete);

    // Optimistic UI update
    setPages(updatedPages);
    setDeleteConfirmIndex(null);

    try {
      await persistNotebook(updatedPages, { syncServer: true, markSaved: true });
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('Erro ao excluir a folha:', err);
      // Revert optimistic update
      setPages(previousPages);
      setDeleteErrorMsg('Falha ao excluir a folha no banco de dados. A alteração foi revertida.');
    } finally {
      setIsDeletingPage(false);
    }
  };

  // Explicit Manual Save (Button clicked by user)
  const handleManualSave = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setIsSaving(true);
    setDeleteErrorMsg('');
    setSaveStatus('saving');
    try {
      const isSuccess = await persistNotebook(pages, { syncServer: true, markSaved: true });
      if (isSuccess) {
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 3000);
      } else {
        setDeleteErrorMsg('Não foi possível sincronizar com a nuvem no momento. Suas alterações foram salvas localmente neste navegador.');
      }
    } catch (err: any) {
      console.error('[VirtualNotebook] Manual save failed:', err);
      setDeleteErrorMsg('Erro ao salvar o caderno na nuvem. Suas alterações foram mantidas no navegador.');
      setSaveStatus('local_only');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if a page has both title AND content
  const isPageFilled = (page?: NotebookPage) => {
    if (!page) return false;
    const hasTitle = Boolean(page.title && page.title.trim().length > 0);
    const hasContent = Boolean(page.content && page.content.trim().length > 0);
    return hasTitle && hasContent;
  };

  const handleOpenRequestReview = () => {
    const pageIdxToCheck = (activePageIndex >= 0 && activePageIndex < pages.length)
      ? activePageIndex
      : (pages.length - 1);
    const targetPage = pages[pageIdxToCheck];

    if (!isPageFilled(targetPage)) {
      setValidationErrorToast('Você não pode pedir visto de uma folha em branco. Escreva suas anotações primeiro.');
      scrollToPage(pageIdxToCheck);
      setTimeout(() => setValidationErrorToast(null), 5000);
      return;
    }

    setRequestReviewPageIndex(pageIdxToCheck);
    setRequestReviewModalOpen(true);
  };

  // Student Submits Notebook for Teacher Review
  const handleSubmitForReview = async () => {
    const pageToSubmit = pages[requestReviewPageIndex] || pages[activePageIndex] || pages[0];

    if (!isPageFilled(pageToSubmit)) {
      setValidationErrorToast('Você não pode pedir visto de uma folha em branco. Escreva suas anotações primeiro.');
      setRequestReviewModalOpen(false);
      setTimeout(() => setValidationErrorToast(null), 5000);
      return;
    }

    setIsSubmittingReview(true);
    try {
      // First save current content
      await persistNotebook(pages, { syncServer: true, markSaved: true });

      let targetTeacherEmail = selectedTeacherEmail;
      if (!targetTeacherEmail && teachersList && teachersList.length > 0) {
        targetTeacherEmail = teachersList[0].email;
      }

      const reviewPayload = {
        student_email: targetEmail,
        student_name: userName || 'Estudante',
        student_class: userTurma || '',
        subject: SUBJECT,
        title: `Caderno de ${SUBJECT}`,
        pages,
        status: 'pending_review' as const,
        requested_teacher_email: targetTeacherEmail || null,
        student_message: reviewMessage || '',
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase.from('student_notebooks').upsert(reviewPayload, {
        onConflict: 'student_email,subject'
      });

      if (upsertErr) {
        console.error('[VirtualNotebook] Error submitting notebook for review:', upsertErr);
        throw upsertErr;
      }

      const formattedMessage = reviewMessage.trim()
        ? `[Folha ${requestReviewPageIndex + 1}: ${pageToSubmit.title?.trim() || 'Anotação'}] ${reviewMessage.trim()}`
        : `[Folha ${requestReviewPageIndex + 1}: ${pageToSubmit.title?.trim() || 'Anotação'}] Pedido de visto enviado.`;

      const { error: reviewInsertErr } = await supabase.from('notebook_reviews').insert({
        student_email: targetEmail,
        student_name: userName || 'Estudante',
        student_class: userTurma || '',
        subject: SUBJECT,
        teacher_email: targetTeacherEmail || null,
        student_message: formattedMessage,
        status: 'pending',
        pages_count: pages.length,
        created_at: new Date().toISOString()
      });

      if (reviewInsertErr) {
        console.warn('Warning inserting into notebook_reviews:', reviewInsertErr);
      }

      // Insert real-time notification for the teacher if email is present
      if (targetTeacherEmail) {
        try {
          const { data: teacherProfile } = await supabase
            .from('wsm_user_profiles')
            .select('id')
            .ilike('email', targetTeacherEmail.trim())
            .maybeSingle();

          if (teacherProfile?.id) {
            await supabase.from('wsm_notifications').insert({
              user_id: teacherProfile.id,
              title: `Novo Pedido de Visto (${userTurma || 'Turma'})`,
              message: `${userName || 'Estudante'} enviou a Folha ${requestReviewPageIndex + 1} (${pageToSubmit.title || 'Anotação'}) do Caderno de ${SUBJECT} para visto.`,
              is_read: false
            });
          }
        } catch (notifErr) {
          console.warn('Could not insert teacher notification:', notifErr);
        }
      }

      setNotebookStatus('pending_review');
      setRequestReviewModalOpen(false);
      setReviewMessage('');
      alert(`✅ Pedido de Visto Enviado!\n\nA Folha ${requestReviewPageIndex + 1} ("${pageToSubmit.title || 'Anotações'}") do seu caderno foi enviada com sucesso.`);
    } catch (e) {
      setNotebookStatus('pending_review');
      setRequestReviewModalOpen(false);
      alert('✅ Pedido de visto registrado!');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Teacher Applies Stamp to Chosen Page
  const handleApplyTeacherStamp = async () => {
    if (isStamping || isLoadingNotebook) return;
    const targetPage = pages[targetPageIndexToStamp];
    const existingStamp =
      targetPage?.stamp ||
      (targetPageIndexToStamp === 0 && lastStamp ? lastStamp : null) ||
      (pages.length === 1 && lastStamp ? lastStamp : null);

    const selectedStampObj =
      AVAILABLE_STAMPS.find((s) => s.type === selectedStampType) || AVAILABLE_STAMPS[0];

    if (existingStamp) {
      // Direct confirmation dialog with the exact prompt
      const confirmQuestion = `Deseja substituir o visto '${existingStamp.label}' pelo novo '${selectedStampObj.label}'? Esta ação não pode ser desfeita.`;

      let hasNativeConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function';
      let userConfirmed: boolean | null = null;

      if (hasNativeConfirm) {
        try {
          userConfirmed = window.confirm(confirmQuestion);
        } catch (e) {
          userConfirmed = null;
        }
      }

      // If user explicitly confirmed via native dialog
      if (userConfirmed === true) {
        await executeApplyTeacherStamp();
        return;
      }

      // If user clicked cancel on native dialog, abort immediately
      if (userConfirmed === false) {
        return;
      }

      // Fallback: If native confirm threw or was unavailable, open in-app modal
      setConfirmOverwriteStampOpen(true);
      return;
    }
    await executeApplyTeacherStamp();
  };

  const executeApplyTeacherStamp = async () => {
    if (isStamping || isLoadingNotebook) return;
    setIsStamping(true);
    setConfirmOverwriteStampOpen(false);

    try {
      const selectedStampObj =
        AVAILABLE_STAMPS.find((s) => s.type === selectedStampType) || AVAILABLE_STAMPS[0];

      const newStamp: NotebookStamp = {
        id: `stamp-${Date.now()}`,
        type: selectedStampObj.type,
        label: selectedStampObj.label,
        color: selectedStampObj.color,
        teacherName: userName || 'Professor',
        teacherEmail: userEmail,
        date: new Date().toLocaleDateString('pt-BR'),
        comment: teacherComment.trim() || undefined,
        pageIndex: targetPageIndexToStamp
      };

      // Play rubber stamp impact sound
      playStampSound();

      // 1. Fetch latest server state of student_notebooks to guarantee zero page loss or stale overwrite
      let basePages: NotebookPage[] = [...pages];
      let resolvedStudentName = inspectStudentName || '';
      let resolvedStudentClass = inspectStudentClass || userTurma || '';

      try {
        const { data: latestNotebook } = await supabase
          .from('student_notebooks')
          .select('*')
          .eq('student_email', targetEmail)
          .eq('subject', SUBJECT)
          .maybeSingle();

        if (latestNotebook) {
          if (Array.isArray(latestNotebook.pages) && latestNotebook.pages.length > 0) {
            // If the remote notebook has more pages or real content, prioritize it to prevent any accidental loss
            basePages = [...latestNotebook.pages];
            if (latestNotebook.last_stamp) {
              const targetIdx = (typeof latestNotebook.last_stamp.pageIndex === 'number' && basePages[latestNotebook.last_stamp.pageIndex])
                ? latestNotebook.last_stamp.pageIndex
                : 0;
              if (!basePages[targetIdx]?.stamp) {
                basePages[targetIdx] = {
                  ...basePages[targetIdx],
                  stamp: latestNotebook.last_stamp,
                  reviewNotes: latestNotebook.teacher_feedback || undefined
                };
              }
            }
          }
          if (latestNotebook.student_name && (!resolvedStudentName || resolvedStudentName === 'Estudante')) {
            resolvedStudentName = latestNotebook.student_name;
          }
          if (latestNotebook.student_class && !resolvedStudentClass) {
            resolvedStudentClass = latestNotebook.student_class;
          }
        }
      } catch (checkErr) {
        console.warn('Could not re-fetch latest remote notebook before stamping:', checkErr);
      }

      if (!resolvedStudentName || resolvedStudentName === 'Estudante') {
        try {
          const { data: stProf } = await supabase
            .from('wsm_user_profiles')
            .select('nome_completo, turma')
            .ilike('email', targetEmail.trim())
            .maybeSingle();
          if (stProf?.nome_completo) resolvedStudentName = stProf.nome_completo;
          if (stProf?.turma && !resolvedStudentClass) resolvedStudentClass = stProf.turma;
        } catch {}
      }

      if (!resolvedStudentName) resolvedStudentName = 'Aluno';

      // Compute updated pages with stamp attached to target page and preserve previous stamp in history
      const updatedPages = basePages.map((p, idx) => {
        if (idx === targetPageIndexToStamp) {
          const history = p.stampHistory ? [...p.stampHistory] : [];
          if (p.stamp) {
            history.push(p.stamp);
          } else if (idx === 0 && lastStamp) {
            history.push(lastStamp);
          }
          return {
            ...p,
            stamp: newStamp,
            reviewNotes: teacherComment.trim() || undefined,
            stampHistory: history
          };
        }
        return p;
      });

      // Update local state synchronously
      setPages(updatedPages);
      setLastStamp(newStamp);
      setNotebookStatus('reviewed');
      setStampedSuccessPage(targetPageIndexToStamp);

      if (targetEmail) {
        try {
          localStorage.setItem(
            `athenas_notebook_bio_${targetEmail}`,
            JSON.stringify({
              student_email: targetEmail,
              student_name: resolvedStudentName,
              student_class: resolvedStudentClass,
              subject: SUBJECT,
              title: `Caderno de ${SUBJECT}`,
              pages: updatedPages,
              status: 'reviewed',
              last_stamp: newStamp,
              teacher_feedback: teacherComment.trim() || null,
              updated_at: new Date().toISOString()
            })
          );
        } catch {}
      }

      const nowIso = new Date().toISOString();

      // 2. Persist directly into notebook_reviews table with real schema columns
      try {
        if (inspectNotebookId && !inspectNotebookId.startsWith('sn_')) {
          const { error: idError } = await supabase
            .from('notebook_reviews')
            .update({
              status: 'completed',
              reviewed_at: nowIso,
              stamp_applied: newStamp.label,
              teacher_feedback: teacherComment.trim() || null,
              teacher_email: userEmail
            })
            .eq('id', inspectNotebookId);

          if (idError) {
            console.error('Error updating notebook_reviews by id:', idError);
          }
        }

        if (targetEmail) {
          const { error: emailError } = await supabase
            .from('notebook_reviews')
            .update({
              status: 'completed',
              reviewed_at: nowIso,
              stamp_applied: newStamp.label,
              teacher_feedback: teacherComment.trim() || null,
              teacher_email: userEmail
            })
            .eq('student_email', targetEmail)
            .eq('subject', SUBJECT);

          if (emailError) {
            console.error('Error updating notebook_reviews by email:', emailError);
          }
        }
      } catch (revErr) {
        console.error('Exception updating notebook_reviews:', revErr);
      }

      // 3. Persist into student_notebooks table with full real student data and all pages
      if (targetEmail) {
        try {
          const { error: snError } = await supabase
            .from('student_notebooks')
            .upsert(
              {
                student_email: targetEmail,
                student_name: resolvedStudentName,
                student_class: resolvedStudentClass,
                subject: SUBJECT,
                title: `Caderno de ${SUBJECT}`,
                pages: updatedPages,
                status: 'reviewed',
                teacher_feedback: teacherComment.trim() || null,
                last_stamp: newStamp,
                updated_at: nowIso
              },
              { onConflict: 'student_email,subject' }
            );

          if (snError) {
            console.error('Error saving student_notebooks:', snError);
          }
        } catch (snErr) {
          console.error('Exception saving student_notebooks:', snErr);
        }
      }

      // 4. Notify student
      if (targetEmail) {
        try {
          const { data: stProfile } = await supabase
            .from('wsm_user_profiles')
            .select('id')
            .ilike('email', targetEmail.trim())
            .maybeSingle();

          if (stProfile?.id) {
            await supabase.from('wsm_notifications').insert({
              user_id: stProfile.id,
              title: `Caderno Vistado: ${SUBJECT}`,
              message: `O professor ${userName || ''} avaliou seu caderno com o selo "${newStamp.label}".`,
              is_read: false
            });
          }
        } catch (notifErr) {
          console.warn('Could not notify student:', notifErr);
        }
      }

      // 5. Trigger onReviewCompleted callback
      onReviewCompleted?.(inspectNotebookId || '', newStamp.label);

      setTeacherComment('');
      scrollToPage(targetPageIndexToStamp);

      setTimeout(() => {
        setStampedSuccessPage(null);
      }, 5000);
    } finally {
      setIsStamping(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center font-sans-clean text-neutral-100 pb-24 relative">
      
      {/* Top Floating / Sticky Header Bar */}
      <header className="sticky top-4 z-40 w-full max-w-4xl bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-3 sm:p-4 mb-8 flex flex-wrap items-center justify-between gap-3 shadow-2xl">
        
        {/* Left: Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-neutral-100">
                Caderno de Biologia
              </h1>
              <span className="text-[10px] bg-neutral-850 text-neutral-300 border border-neutral-750 px-2 py-0.5 rounded-full font-medium">
                {pages.length} {pages.length === 1 ? 'Folha A4' : 'Folhas A4'}
              </span>

              {/* Live Autosave / Cloud Sync Badge */}
              {!isReadOnly && (
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border transition-all ${
                  saveStatus === 'saving'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                    : saveStatus === 'unsaved'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : saveStatus === 'local_only'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : saveStatus === 'error'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {saveStatus === 'saving' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  )}
                  {saveStatus === 'unsaved' && (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>Salvando em instantes...</span>
                    </>
                  )}
                  {saveStatus === 'local_only' && (
                    <>
                      <HardDrive className="w-3 h-3" />
                      <span>Salvo localmente</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <Cloud className="w-3 h-3" />
                      <span>Salvo na nuvem {lastSavedAt ? `às ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      <span>Salvo local (erro nuvem)</span>
                    </>
                  )}
                </span>
              )}

              {/* Status */}
              {notebookStatus === 'pending_review' && (
                <span className="text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Aguardando Visto {pages.some(p => p.stamp) ? '(Nova Folha)' : ''}
                </span>
              )}
              {pages.some(p => p.stamp) && (
                <button
                  type="button"
                  onClick={() => {
                    const firstStampedIdx = pages.findIndex(p => p.stamp);
                    if (firstStampedIdx !== -1) scrollToPage(firstStampedIdx);
                  }}
                  className="text-[10px] bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 cursor-pointer transition"
                  title="Rolar direto para a folha com o carimbo"
                >
                  <CheckCheck className="w-3 h-3" /> {pages.filter(p => p.stamp).length} folha(s) vistada(s)
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 mt-0.5">
              {inspectStudentEmail
                ? `Inspecionando caderno do aluno: ${inspectStudentEmail}`
                : userTurma
                ? `Contexto: ${userTurma} • Clique em 'Salvar Caderno' para registrar suas alterações`
                : "Clique em 'Salvar Caderno' para registrar suas alterações"}
            </p>
          </div>
        </div>

        {/* Right: Actions (Prominent Save Button, Pedir Visto, Add Page) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Add Page Button */}
          {!isReadOnly && (
            <button
              onClick={handleAddNewPage}
              className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer hover:border-emerald-500/40"
              title="Adicionar nova folha A4 embaixo"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Folha A4</span>
            </button>
          )}

          {/* Student: Pedir Visto Button */}
          {!isReadOnly && userRole === 'student' && (
            <button
              onClick={handleOpenRequestReview}
              className="bg-neutral-850 hover:bg-neutral-800 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Pedir Visto</span>
            </button>
          )}

          {/* BIG PROMINENT SAVE BUTTON */}
          {!isReadOnly && (
            <button
              id="btn-salvar-caderno"
              onClick={handleManualSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 ring-2 ring-emerald-400/40 shadow-emerald-950/50 scale-105'
                  : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : hasUnsavedChanges ? 'Salvar Caderno' : 'Salvo ✓'}</span>
            </button>
          )}

          {/* Teacher Close Inspect */}
          {inspectStudentEmail && onCloseInspect && (
            <button
              onClick={onCloseInspect}
              className="bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <X className="w-4 h-4" /> Fechar
            </button>
          )}

        </div>
      </header>

      {/* Save / Delete Notification Toasts */}
      <AnimatePresence>
        {deleteErrorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 z-50 bg-red-950 border border-red-800 text-red-200 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{deleteErrorMsg}</span>
            <button onClick={() => setDeleteErrorMsg('')} className="ml-2 text-red-400 hover:text-white">✕</button>
          </motion.div>
        )}

        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 z-50 bg-emerald-500 text-neutral-950 font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Caderno de Biologia salvo com sucesso!</span>
          </motion.div>
        )}

        {restoredFromDraft && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 z-50 bg-cyan-950 border border-cyan-700 text-cyan-200 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs"
          >
            <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Rascunho recuperado do seu dispositivo com sucesso!</span>
            <button onClick={() => setRestoredFromDraft(false)} className="ml-2 text-cyan-400 hover:text-white">✕</button>
          </motion.div>
        )}

        {stampedSuccessPage !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-20 z-50 bg-neutral-900 border-2 border-emerald-500 text-emerald-300 font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs backdrop-blur-md"
          >
            <Award className="w-5 h-5 text-emerald-400 animate-bounce" />
            <div>
              <p className="font-extrabold text-white text-xs">Visto aplicado com sucesso!</p>
              <p className="text-[11px] text-emerald-400 font-normal">Rolando e destacando a Página {stampedSuccessPage + 1}...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Excluir Folha {deleteConfirmIndex + 1}?</h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Esta ação apagará permanentemente todo o conteúdo desta página do seu caderno de Biologia.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmIndex(null)}
                disabled={isDeletingPage}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeDeletePage(deleteConfirmIndex)}
                disabled={isDeletingPage}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeletingPage ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STACK OF A4 PAGES (Displayed vertically one below the other like Word) */}
      {isLoadingNotebook ? (
        <div className="w-full max-w-[800px] h-[450px] bg-neutral-900/60 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm font-semibold text-neutral-200">Carregando folhas do caderno de Biologia...</p>
          <span className="text-xs text-neutral-500">Sincronizando notas com o servidor seguro</span>
        </div>
      ) : (
        <main className="w-full flex flex-col items-center gap-8">
          {pages.map((page, index) => {
            const isJustStamped = stampedSuccessPage === index;
            const isTargetPageForTeacher = targetPageIndexToStamp === index && (userRole === 'teacher' || Boolean(inspectStudentEmail));
            return (
              <article
                key={page.id || index}
                id={`a4-page-${index}`}
                onClick={() => {
                  if (userRole === 'teacher' || inspectStudentEmail) {
                    setTargetPageIndexToStamp(index);
                  }
                }}
                className={`w-full max-w-[800px] h-[1130px] a4-sheet rounded-sm p-10 sm:p-14 text-neutral-900 flex flex-col justify-between relative overflow-hidden border shadow-2xl mx-auto transition-all duration-700 ${
                  isJustStamped
                    ? 'ring-8 ring-emerald-500/80 border-emerald-500 shadow-emerald-950/60 scale-[1.01]'
                    : isTargetPageForTeacher
                    ? 'ring-4 ring-emerald-500/50 border-emerald-400'
                    : 'border-neutral-300'
                }`}
              >
                {/* Top / Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Rubber Stamp (If this page was stamped by teacher) */}
                  {page.stamp && (
                    <div
                      onClick={(e) => {
                        if (userRole === 'teacher' || inspectStudentEmail) {
                          e.stopPropagation();
                          setTargetPageIndexToStamp(index);
                        }
                      }}
                      className="mb-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-wrap items-center justify-between gap-3 animate-stamp-slam shrink-0 cursor-pointer"
                      title={userRole === 'teacher' || inspectStudentEmail ? 'Clique para selecionar esta folha na mesa de avaliação' : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="rubber-stamp"
                          style={{ color: page.stamp.color }}
                        >
                          <span className="text-xs font-black">{page.stamp.label}</span>
                          <span className="text-[9px] lowercase font-normal opacity-90">Prof(a). {page.stamp.teacherName}</span>
                        </div>
                        <div className="space-y-1">
                          {page.reviewNotes && (
                            <div className="text-xs text-neutral-700">
                              <span className="font-bold text-neutral-900 flex items-center gap-1">
                                <StickyNote className="w-3 h-3 text-amber-600" /> Observação da Professora:
                              </span>
                              <p className="italic text-neutral-800 mt-0.5">"{page.reviewNotes}"</p>
                            </div>
                          )}
                          {page.stampHistory && page.stampHistory.length > 0 && (
                            <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 pt-0.5">
                              <span className="font-semibold text-neutral-600">Histórico de vistos:</span>
                              {page.stampHistory.map((h, hIdx) => (
                                <span key={hIdx} className="bg-neutral-200/80 text-neutral-700 px-1.5 py-0.5 rounded text-[9px] font-medium">
                                  {h.label} ({h.date})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        ✓ Avaliado
                      </span>
                    </div>
                  )}

                  {/* Page Title (Editable) */}
                  <input
                    type="text"
                    value={page.title || ''}
                    onFocus={() => setActivePageIndex(index)}
                    onChange={(e) => {
                      setActivePageIndex(index);
                      handleTitleChange(index, e.target.value);
                    }}
                    disabled={isReadOnly}
                    placeholder="Título da anotação..."
                    className="w-full text-xl sm:text-2xl font-bold text-neutral-900 bg-transparent outline-none placeholder-neutral-300 border-b border-transparent focus:border-neutral-200 pb-1 mb-4 font-sans-clean shrink-0"
                  />

                  {/* Page Textarea (Fixed A4 height, without internal scrollbar, auto-splits when full) */}
                  <textarea
                    id={`page-textarea-${index}`}
                    ref={(el) => {
                      textareaRefs.current[index] = el;
                    }}
                    value={page.content || ''}
                    onFocus={() => setActivePageIndex(index)}
                    onChange={(e) => {
                      setActivePageIndex(index);
                      handleContentChange(index, e.target.value);
                    }}
                    disabled={isReadOnly}
                    placeholder="Escreva suas anotações de Biologia nesta folha A4..."
                    className="w-full flex-1 text-neutral-850 text-base leading-relaxed bg-transparent outline-none resize-none font-sans-clean placeholder-neutral-300 overflow-hidden"
                  />
                </div>

                {/* Page Footer (Page Numbering) */}
                <footer className="pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-400 font-sans-clean shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-600">Biologia</span>
                    {!isReadOnly && pages.length > 1 && (
                      <button
                        onClick={() => handleDeletePage(index)}
                        className="text-neutral-400 hover:text-red-500 transition ml-2 p-1 cursor-pointer"
                        title="Excluir esta folha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-medium text-neutral-500">
                    Página {index + 1} de {pages.length}
                  </span>
                </footer>

              </article>
            );
          })}
        </main>
      )}

      {/* Button to Insert Another A4 Page at the Bottom */}
      {!isReadOnly && (
        <div className="w-full max-w-[800px] mt-6 flex justify-center">
          <button
            onClick={handleAddNewPage}
            className="w-full py-4 border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-400 hover:text-emerald-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Adicionar Nova Folha A4 Embaixo</span>
          </button>
        </div>
      )}

      {/* TEACHER EVALUATION & STAMP PANEL (When teacher opens student's notebook) */}
      {(userRole === 'teacher' || inspectStudentEmail) && (
        <section className="w-full max-w-4xl bg-neutral-950 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 mt-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
              Mesa de Avaliação & Carimbo Virtual da Professora
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            
            {/* 1. Stamp Picker */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Escolha o Carimbo Digital:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_STAMPS.map((stamp) => {
                  const isSelected = selectedStampType === stamp.type;
                  return (
                    <button
                      key={stamp.type}
                      type="button"
                      onClick={() => setSelectedStampType(stamp.type)}
                      className={`p-2 rounded-xl text-left border text-xs transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className="font-bold text-[11px]" style={{ color: isSelected ? undefined : stamp.color }}>
                        {stamp.label}
                      </span>
                      <span className="text-[9px] opacity-75">{stamp.subLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Teacher Feedback Comment */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Observação para o Aluno (Opcional):
              </label>
              <textarea
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="Ex: Excelente resumo das organelas celulares!"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500 resize-none h-[88px]"
              />
            </div>

            {/* 3. Action Button: Stamp Page */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300">
                  Aplicar na Página:
                </label>
                <select
                  value={targetPageIndexToStamp}
                  onChange={(e) => setTargetPageIndexToStamp(Number(e.target.value))}
                  className="bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {pages.map((p, idx) => {
                    const pageStamp = p.stamp || (idx === 0 ? lastStamp : null);
                    return (
                      <option key={idx} value={idx}>
                        Página {idx + 1} {pageStamp ? `[Já Vistada: ${pageStamp.label}]` : '[Pendente de Visto]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {(() => {
                const pageStamp = pages[targetPageIndexToStamp]?.stamp || (targetPageIndexToStamp === 0 ? lastStamp : null);
                if (!pageStamp) return null;
                return (
                  <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Esta folha já tem visto ({pageStamp.label}). Será solicitada confirmação antes de substituir.</span>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleApplyTeacherStamp}
                disabled={isStamping || isLoadingNotebook}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isLoadingNotebook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Carregando notas do aluno...</span>
                  </>
                ) : isStamping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Salvando visto no banco...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4 text-emerald-200" />
                    <span>Carimbar e Devolver Vistado</span>
                  </>
                )}
              </button>

              {notebookStatus === 'reviewed' && (
                <div className="mt-2.5 p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Caderno Vistado ({lastStamp?.label || 'VISTO REGULAR'})
                  </span>
                  {onCloseInspect && (
                    <button
                      type="button"
                      onClick={onCloseInspect}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      Voltar à Fila
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </section>
      )}

      {/* Modal: Pedir Visto à Professora */}
      <AnimatePresence>
        {requestReviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-neutral-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-100">Pedir Visto à Professora</h3>
                    <p className="text-xs text-neutral-400">Envie seu caderno de Biologia</p>
                  </div>
                </div>
                <button
                  onClick={() => setRequestReviewModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {pages.length > 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Folha a ser enviada para visto:
                    </label>
                    <select
                      value={requestReviewPageIndex}
                      onChange={(e) => setRequestReviewPageIndex(Number(e.target.value))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-200 outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {pages.map((p, idx) => {
                        const filled = isPageFilled(p);
                        return (
                          <option key={idx} value={idx}>
                            Página {idx + 1}: {p.title?.trim() || '(Sem título)'} {p.stamp ? `[Já Vistada: ${p.stamp.label}]` : filled ? '[Pronta para Visto]' : '[Em branco]'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Selecione a Professora / Professor:
                  </label>
                  {teachersList.length > 0 ? (
                    <select
                      value={selectedTeacherEmail}
                      onChange={(e) => setSelectedTeacherEmail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-200 outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {teachersList.map((t: any) => (
                        <option key={t.email} value={t.email}>
                          {t.nome_completo || t.email} {t.materia ? `(${t.materia})` : ''} - {t.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-200">Nenhum professor vinculado à sua turma</p>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          Não há professores associados à turma {userTurma ? `"${userTurma}"` : 'atual'}. Verifique com o professor o código de acesso da sala virtual.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Recado para a Professora (Opcional):
                  </label>
                  <textarea
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                    placeholder="Ex: Professora, finalizei as anotações do caderno de Biologia para o visto!"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500 resize-none h-24"
                  />
                </div>

                {!isPageFilled(pages[requestReviewPageIndex]) ? (
                  <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-100">Folha em branco</p>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">
                        Você não pode pedir visto de uma folha em branco. Escreva suas anotações e título primeiro.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      A <strong>Folha {requestReviewPageIndex + 1} ({pages[requestReviewPageIndex]?.title || 'Anotações'})</strong> será enviada para a mesa da professora.
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestReviewModalOpen(false)}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitForReview}
                    disabled={isSubmittingReview || !selectedTeacherEmail || teachersList.length === 0 || !isPageFilled(pages[requestReviewPageIndex])}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingReview ? 'Enviando...' : 'Enviar para Visto'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERWRITE STAMP CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmOverwriteStampOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-neutral-100 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-neutral-100">Substituir Visto Anterior?</h3>
                  <p className="text-xs text-neutral-400">Página {targetPageIndexToStamp + 1}</p>
                </div>
              </div>

              {(() => {
                const currentStamp = pages[targetPageIndexToStamp]?.stamp || (targetPageIndexToStamp === 0 ? lastStamp : null);
                const nextStamp = AVAILABLE_STAMPS.find((s) => s.type === selectedStampType) || AVAILABLE_STAMPS[0];
                return (
                  <>
                    <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 font-medium">Selo Anterior:</span>
                        <span
                          className="font-bold px-2 py-0.5 rounded-lg bg-neutral-800"
                          style={{ color: currentStamp?.color || '#3b82f6' }}
                        >
                          {currentStamp?.label || 'VISTO'}
                        </span>
                      </div>
                      {currentStamp?.teacherName && (
                        <div className="text-[11px] text-neutral-500">
                          Aplicado por: Prof(a). {currentStamp.teacherName} em {currentStamp.date}
                        </div>
                      )}
                      {pages[targetPageIndexToStamp]?.reviewNotes && (
                        <div className="text-[11px] text-neutral-300 italic bg-neutral-900/80 p-2 rounded-lg border border-neutral-850">
                          "{pages[targetPageIndexToStamp]?.reviewNotes}"
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-850">
                        <span className="text-neutral-400 font-medium">Novo Carimbo:</span>
                        <span className="font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          {nextStamp.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                      Deseja substituir o visto <strong className="text-amber-300">'{currentStamp?.label || 'Visto'}'</strong> pelo novo <strong className="text-emerald-300">'{nextStamp.label}'</strong>? Esta ação não pode ser desfeita.
                    </p>
                  </>
                );
              })()}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmOverwriteStampOpen(false)}
                  disabled={isStamping}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeApplyTeacherStamp}
                  disabled={isStamping}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                >
                  {isStamping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Sim, substituir</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VALIDATION ERROR TOAST (For empty pages, etc.) */}
      <AnimatePresence>
        {validationErrorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] max-w-md w-full px-4"
          >
            <div className="p-4 rounded-2xl bg-amber-950/95 border border-amber-500/60 text-amber-100 shadow-2xl backdrop-blur-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-xs text-amber-100">Atenção ao pedir visto</p>
                <p className="text-xs text-amber-200/90 mt-0.5">{validationErrorToast}</p>
              </div>
              <button
                type="button"
                onClick={() => setValidationErrorToast(null)}
                className="text-amber-400 hover:text-amber-100 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
