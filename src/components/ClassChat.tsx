import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  FileCode, 
  Download, 
  X, 
  Check, 
  CheckCheck, 
  User, 
  Users, 
  ShieldCheck, 
  Smile, 
  Circle, 
  ArrowLeft, 
  MoreVertical, 
  MoreHorizontal,
  Sparkles, 
  Clock, 
  Filter, 
  FileSpreadsheet, 
  Presentation, 
  Archive, 
  Eye,
  Info,
  Lock,
  ShieldAlert,
  Trash2,
  Pencil,
  Heart
} from 'lucide-react';
import { supabase } from '../supabase';
import { sendBrowserNotification } from '../utils/browserNotifications';

export interface ChatContact {
  email: string;
  name: string;
  role: 'student' | 'teacher';
  turma: string; // e.g. "8ºA"
  materia?: string; // for teachers
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
}

export interface ChatMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_role: 'student' | 'teacher';
  receiver_email: string;
  receiver_name: string;
  receiver_role?: 'student' | 'teacher';
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string; // 'image' | 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'archive' | 'file'
  attachment_size?: string;
  turma_context?: string;
  is_read?: boolean;
  created_at: string;
  reactions?: Record<string, string[]>;
  is_edited?: boolean;
}

export interface MonitoredConversationPair {
  pairKey: string;
  student1: {
    email: string;
    name: string;
    turma: string;
  };
  student2: {
    email: string;
    name: string;
    turma: string;
  };
  turma: string;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
}

interface ClassChatProps {
  currentUserEmail: string;
  currentUserName: string;
  currentUserRole: 'student' | 'teacher';
  userTurma?: string; // For student, e.g. "9A"
  userAnosLecionados?: string[]; // For teacher, e.g. ["Biologia 9A", "Biologia 9B"]
}

function parseAnosLecionados(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseStudentEmails(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).toLowerCase().trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    return trimmed.split(',').map(s => s.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}

function cleanTurma(t: string | null | undefined): string {
  if (!t) return '';
  return String(t).toLowerCase().replace(/\s+/g, '').replace(/[º°ª]/g, '').trim();
}

function normalizeTurmaToken(t: string | null | undefined): string {
  if (!t) return '';
  return String(t)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª\s\-_()]/g, '')
    .trim();
}

function areTurmasMatching(t1: string | null | undefined, t2: string | null | undefined): boolean {
  if (!t1 || !t2) return false;
  const n1 = normalizeTurmaToken(t1);
  const n2 = normalizeTurmaToken(t2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Extract core cohort identifier (e.g. "9a", "9b", "8a", "1ano", "3c")
  const extractCohort = (str: string) => {
    const match = str.match(/([0-9]+[a-z]?)/i);
    return match ? match[1].toLowerCase() : null;
  };
  const c1 = extractCohort(n1);
  const c2 = extractCohort(n2);
  if (c1 && c2 && c1 === c2) return true;

  return false;
}

export default function ClassChat({
  currentUserEmail,
  currentUserName,
  currentUserRole,
  userTurma = '',
  userAnosLecionados = []
}: ClassChatProps) {
  const myEmailLower = currentUserEmail.toLowerCase().trim();

  // Dynamically resolved classes for display and matching
  const [resolvedTaughtClasses, setResolvedTaughtClasses] = useState<string[]>(() => parseAnosLecionados(userAnosLecionados));
  const [resolvedStudentTurma, setResolvedStudentTurma] = useState<string>(userTurma || '');

  // Selected active contact in sidebar
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);

  // Contacts list
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Messages for active conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Input states
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [contactFilter, setContactFilter] = useState<'todos' | 'alunos' | 'professores'>('todos');

  // Teacher Monitoring Mode state
  const [isMonitoringMode, setIsMonitoringMode] = useState(false);
  const [monitoredPairs, setMonitoredPairs] = useState<MonitoredConversationPair[]>([]);
  const [activeMonitoredPairKey, setActiveMonitoredPairKey] = useState<string | null>(null);
  const [loadingMonitored, setLoadingMonitored] = useState(false);
  const [monitoredSearchTerm, setMonitoredSearchTerm] = useState('');
  const [monitoredTurmaFilter, setMonitoredTurmaFilter] = useState<string>('todas');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    previewUrl?: string;
    type: 'image' | 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'archive' | 'file';
    sizeFormatted: string;
  } | null>(null);

  // Emoji picker popup toggle
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Lightbox modal for image viewing
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Mobile sidebar toggle
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);

  // Active contact email ref for background summary sync
  const activeContactEmailRef = useRef<string | null>(null);

  // Mark conversation as read helper across state, database and notification events
  const markConversationAsRead = useCallback(async (contactEmail: string) => {
    if (!contactEmail || !myEmailLower) return;
    const cEmail = contactEmail.toLowerCase().trim();

    // 1. Instantly clear unread count for this contact in local contacts state
    setContacts(prev => prev.map(c => 
      c.email.toLowerCase().trim() === cEmail ? { ...c, unreadCount: 0 } : c
    ));

    // 2. Instantly update messages state in active conversation so is_read is true
    setMessages(prev => prev.map(m => {
      if ((m.sender_email || '').toLowerCase().trim() === cEmail && (m.receiver_email || '').toLowerCase().trim() === myEmailLower) {
        return { ...m, is_read: true };
      }
      return m;
    }));

    // 3. Update localStorage cache
    try {
      const storageKey = `athenas_chat_${[myEmailLower, cEmail].sort().join('_')}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((m: any) => {
            if ((m.sender_email || '').toLowerCase().trim() === cEmail && (m.receiver_email || '').toLowerCase().trim() === myEmailLower) {
              return { ...m, is_read: true };
            }
            return m;
          });
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
      }
    } catch {
      // ignore
    }

    // 4. Update Supabase database (both direct_messages and wsm_direct_messages)
    try {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .ilike('sender_email', cEmail)
        .ilike('receiver_email', myEmailLower)
        .eq('is_read', false);

      await supabase
        .from('wsm_direct_messages')
        .update({ is_read: true })
        .ilike('sender_email', cEmail)
        .ilike('receiver_email', myEmailLower)
        .eq('is_read', false);
    } catch (err) {
      console.warn('Error marking messages as read in Supabase:', err);
    }

    // 5. Notify parent dashboard (TeacherDashboard / StudentDashboard) immediately
    window.dispatchEvent(new CustomEvent('wsm_direct_messages_read', {
      detail: { sender_email: cEmail, receiver_email: myEmailLower }
    }));
  }, [myEmailLower]);

  // Message 3-Dots Menu & Editing & Reaction States
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    setActiveMenuMessageId(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));

    try {
      const res1 = await supabase.from('direct_messages').delete().eq('id', msgId);
      if (res1.error) {
        await supabase.from('wsm_direct_messages').delete().eq('id', msgId);
      }
    } catch (err) {
      console.warn('Error deleting message:', err);
    }
  };

  // Start editing message
  const handleStartEdit = (msg: ChatMessage) => {
    setActiveMenuMessageId(null);
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  // Save edited message
  const handleSaveEdit = async (msgId: string) => {
    if (!editingContent.trim()) return;

    const trimmed = editingContent.trim();
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return { ...m, content: trimmed, is_edited: true };
      }
      return m;
    }));

    setEditingMessageId(null);
    setEditingContent('');

    try {
      const payload = { content: trimmed, is_edited: true };
      const res1 = await supabase.from('direct_messages').update(payload).eq('id', msgId);
      if (res1.error) {
        await supabase.from('wsm_direct_messages').update(payload).eq('id', msgId);
      }
    } catch (err) {
      console.warn('Error saving edited message:', err);
    }
  };

  // Toggle Reaction on message
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    setActiveMenuMessageId(null);

    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const currentReactions: Record<string, string[]> = m.reactions ? { ...m.reactions } : {};
        const usersForEmoji = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        
        const userIndex = usersForEmoji.indexOf(myEmailLower);
        if (userIndex >= 0) {
          usersForEmoji.splice(userIndex, 1);
        } else {
          usersForEmoji.push(myEmailLower);
        }

        if (usersForEmoji.length > 0) {
          currentReactions[emoji] = usersForEmoji;
        } else {
          delete currentReactions[emoji];
        }

        const updatedMsg = { ...m, reactions: currentReactions };

        // Save async to Supabase
        (async () => {
          try {
            const payload = { reactions: currentReactions };
            const res1 = await supabase.from('direct_messages').update(payload).eq('id', msgId);
            if (res1.error) {
              await supabase.from('wsm_direct_messages').update(payload).eq('id', msgId);
            }
          } catch (e) {
            console.warn('Error persisting reaction:', e);
          }
        })();

        return updatedMsg;
      }
      return m;
    }));
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic layout compensation when the music mini-player is active in background
  const [isMusicMiniPlayerActive, setIsMusicMiniPlayerActive] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean((window as any).__athenas_music_mini_player_active);
  });

  useEffect(() => {
    const handleMusicChange = (e: any) => {
      setIsMusicMiniPlayerActive(Boolean(e.detail?.active));
    };
    window.addEventListener('study-music-mini-player-active', handleMusicChange);

    const syncInterval = setInterval(() => {
      const active = typeof window !== 'undefined' && Boolean((window as any).__athenas_music_mini_player_active);
      setIsMusicMiniPlayerActive(prev => prev !== active ? active : prev);
    }, 400);

    return () => {
      window.removeEventListener('study-music-mini-player-active', handleMusicChange);
      clearInterval(syncInterval);
    };
  }, []);

  const lastActiveContactRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);

  // Quick Emoji options
  const quickEmojis = ['😊', '👍', '📚', '📝', '👏', '💡', '🔥', '✅', '❓', '🎯', '🚀', '⭐'];

  // Smart scroll to bottom (only if near bottom or contact changed or user sent message)
  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 180;

    if (force || isNearBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: force ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    const activeEmail = activeContact?.email;
    const contactChanged = lastActiveContactRef.current !== activeEmail;
    const currentCount = messages.length;
    const lastMsgId = currentCount > 0 ? messages[currentCount - 1].id : null;
    const isNewMessageAdded = currentCount > lastMessageCountRef.current || (lastMsgId !== null && lastMsgId !== lastMessageIdRef.current);

    if (contactChanged) {
      lastActiveContactRef.current = activeEmail || null;
      lastMessageCountRef.current = currentCount;
      lastMessageIdRef.current = lastMsgId;
      setTimeout(() => scrollToBottom(true), 60);
    } else if (isNewMessageAdded) {
      lastMessageCountRef.current = currentCount;
      lastMessageIdRef.current = lastMsgId;
      scrollToBottom(false);
    }
  }, [messages, activeContact, selectedFile]);

  // Load Monitored Conversations for Teacher
  useEffect(() => {
    if (currentUserRole !== 'teacher') return;

    let isMounted = true;
    async function fetchMonitoredChats() {
      if (isMounted && monitoredPairs.length === 0) setLoadingMonitored(true);
      try {
        // Fetch user profiles to know student turmas and teacher settings
        const { data: profiles } = await supabase
          .from('wsm_user_profiles')
          .select('id, nome_completo, turma, email, anos_lecionados, materia');

        // Fetch virtual classes to include students in teacher's virtual classes
        const { data: vClasses } = await supabase
          .from('wsm_virtual_classes')
          .select('id, name, student_emails, teacher_email');

        const myProfile = (profiles || []).find(p => p.email && p.email.toLowerCase().trim() === myEmailLower);
        const profileTaught = parseAnosLecionados(myProfile?.anos_lecionados);
        const propsTaught = parseAnosLecionados(userAnosLecionados);

        const teacherVClasses = (vClasses || []).filter(
          vc => (vc.teacher_email || '').toLowerCase().trim() === myEmailLower
        );
        const vClassNames = teacherVClasses.map(vc => vc.name).filter(Boolean);
        const combinedTaughtClasses = Array.from(new Set([...propsTaught, ...profileTaught, ...vClassNames]));

        const teacherVClassStudents = new Set<string>();
        teacherVClasses.forEach(vc => {
          parseStudentEmails(vc.student_emails).forEach(e => teacherVClassStudents.add(e));
        });

        // Map of students taught by this teacher
        const taughtStudentsMap = new Map<string, { email: string; name: string; turma: string }>();
        (profiles || []).forEach(p => {
          if (!p.email) return;
          const emailLower = p.email.toLowerCase().trim();
          const pTaughtClean = parseAnosLecionados(p.anos_lecionados);
          const isTeacher = pTaughtClean.length > 0 || Boolean(p.materia) || emailLower.includes('prof');

          if (!isTeacher) {
            const matchesTaughtClass = combinedTaughtClasses.length > 0 && combinedTaughtClasses.some(cls => areTurmasMatching(p.turma, cls));
            const matchesVClass = teacherVClassStudents.has(emailLower);
            const isFallbackAllowed = combinedTaughtClasses.length === 0 && teacherVClassStudents.size === 0;

            if (matchesTaughtClass || matchesVClass || isFallbackAllowed) {
              taughtStudentsMap.set(emailLower, {
                email: p.email,
                name: p.nome_completo || p.email.split('@')[0],
                turma: p.turma || 'Turma'
              });
            }
          }
        });

        // Query wsm_direct_messages or direct_messages for student-to-student messages
        let dbMessages: ChatMessage[] = [];
        try {
          const res1 = await supabase
            .from('wsm_direct_messages')
            .select('*')
            .order('created_at', { ascending: true });

          if (!res1.error && res1.data) {
            dbMessages = res1.data as ChatMessage[];
          } else {
            const res2 = await supabase
              .from('direct_messages')
              .select('*')
              .order('created_at', { ascending: true });
            if (!res2.error && res2.data) {
              dbMessages = res2.data as ChatMessage[];
            }
          }
        } catch (e) {
          console.warn('Monitored messages fetch fallback:', e);
        }

        // Group messages by student pairs, enforcing strict permission rule
        const pairMap = new Map<string, MonitoredConversationPair>();

        dbMessages.forEach((msg: ChatMessage) => {
          if (msg.sender_role && msg.sender_role !== 'student') return;
          if (msg.receiver_role && msg.receiver_role !== 'student') return;
          const senderLower = msg.sender_email.toLowerCase().trim();
          const receiverLower = msg.receiver_email.toLowerCase().trim();

          // STRICT PERMISSION: Both students MUST be taught by this teacher!
          if (taughtStudentsMap.has(senderLower) && taughtStudentsMap.has(receiverLower)) {
            const pairKey = [senderLower, receiverLower].sort().join('_');
            const s1 = taughtStudentsMap.get(senderLower)!;
            const s2 = taughtStudentsMap.get(receiverLower)!;

            if (!pairMap.has(pairKey)) {
              pairMap.set(pairKey, {
                pairKey,
                student1: s1,
                student2: s2,
                turma: s1.turma || s2.turma || 'Turma',
                messages: [],
                lastMessage: '',
                lastMessageTime: ''
              });
            }

            const pairObj = pairMap.get(pairKey)!;
            pairObj.messages.push(msg);
            pairObj.lastMessage = msg.content || (msg.attachment_name ? `📎 Anexo: ${msg.attachment_name}` : 'Mensagem');
            const d = new Date(msg.created_at);
            pairObj.lastMessageTime = isNaN(d.getTime()) ? 'Agora' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        });

        const pairsArray = Array.from(pairMap.values());

        if (isMounted) {
          setMonitoredPairs(pairsArray);
          if (pairsArray.length > 0) {
            setActiveMonitoredPairKey(prev => prev || pairsArray[0].pairKey);
          } else {
            setActiveMonitoredPairKey(null);
          }
        }
      } catch (err) {
        console.error('Error loading monitored chats:', err);
      } finally {
        if (isMounted) setLoadingMonitored(false);
      }
    }

    fetchMonitoredChats();
    const interval = setInterval(fetchMonitoredChats, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUserRole, JSON.stringify(userAnosLecionados), myEmailLower]);

  const activeMonitoredPair = useMemo(() => {
    return monitoredPairs.find(p => p.pairKey === activeMonitoredPairKey) || monitoredPairs[0] || null;
  }, [monitoredPairs, activeMonitoredPairKey]);

  const filteredMonitoredPairs = useMemo(() => {
    return monitoredPairs.filter(pair => {
      const s1 = pair.student1.name.toLowerCase();
      const s2 = pair.student2.name.toLowerCase();
      const t = pair.turma.toLowerCase();
      const query = monitoredSearchTerm.toLowerCase();

      const matchesQuery = s1.includes(query) || s2.includes(query) || t.includes(query);
      if (!matchesQuery) return false;

      if (monitoredTurmaFilter !== 'todas') {
        return areTurmasMatching(pair.turma, monitoredTurmaFilter);
      }
      return true;
    });
  }, [monitoredPairs, monitoredSearchTerm, monitoredTurmaFilter]);

  // 1. Fetch valid contacts from same turma or teacher's taught classes
  useEffect(() => {
    let isMounted = true;

    async function loadContacts() {
      setLoadingContacts(true);
      try {
        // Fetch all user profiles from wsm_user_profiles
        const { data: profiles, error } = await supabase
          .from('wsm_user_profiles')
          .select('id, nome_completo, turma, anos_lecionados, materia, email');

        let rawList: any[] = profiles || [];

        // Also fetch virtual classes to check member overlap
        const { data: vClasses } = await supabase
          .from('wsm_virtual_classes')
          .select('id, name, student_emails, teacher_email');

        // Resolve current user profile
        const myProfile = rawList.find(
          p => p.email && p.email.toLowerCase().trim() === myEmailLower
        );

        // Filter out current user
        let filteredProfiles = rawList.filter(
          p => p.email && p.email.toLowerCase().trim() !== myEmailLower
        );

        if (currentUserRole === 'student') {
          let myTurma = (userTurma || myProfile?.turma || '').trim();
          if (!myTurma) {
            const enrolledVC = (vClasses || []).find(vc => {
              const emails = parseStudentEmails(vc.student_emails);
              return emails.includes(myEmailLower);
            });
            if (enrolledVC?.name) {
              myTurma = enrolledVC.name;
            }
          }
          setResolvedStudentTurma(myTurma);

          // Student's virtual classes
          const myVClasses = (vClasses || []).filter(vc => {
            const emails = parseStudentEmails(vc.student_emails);
            return emails.includes(myEmailLower) || (myTurma && areTurmasMatching(vc.name, myTurma));
          });
          const myVClassTeachers = myVClasses.map(vc => (vc.teacher_email || '').toLowerCase().trim()).filter(Boolean);
          const myVClassStudents = new Set<string>();
          myVClasses.forEach(vc => {
            parseStudentEmails(vc.student_emails).forEach(e => myVClassStudents.add(e));
          });

          filteredProfiles = filteredProfiles.filter(p => {
            const pEmail = (p.email || '').toLowerCase().trim();
            if (pEmail.endsWith('@example.com') || pEmail.endsWith('@atenas.com')) return false;
            const pTaughtClean = parseAnosLecionados(p.anos_lecionados);
            const isTeacher = pTaughtClean.length > 0 || Boolean(p.materia) || pEmail.includes('prof') || p.role === 'teacher';

            if (isTeacher) {
              const teachesMyTurma = myTurma ? pTaughtClean.some(cls => areTurmasMatching(cls, myTurma)) : false;
              const ownsVirtualClass = myVClassTeachers.includes(pEmail);
              return teachesMyTurma || ownsVirtualClass || !myTurma;
            } else {
              if (myVClassStudents.has(pEmail)) return true;
              if (!myTurma || !p.turma) return true; // If turma not set yet, show school peers
              return areTurmasMatching(p.turma, myTurma);
            }
          });
        } else {
          // Teacher Role
          const profileTaught = parseAnosLecionados(myProfile?.anos_lecionados);
          const propsTaught = parseAnosLecionados(userAnosLecionados);

          const myCreatedVClasses = (vClasses || []).filter(
            vc => (vc.teacher_email || '').toLowerCase().trim() === myEmailLower
          );
          const vClassNames = myCreatedVClasses.map(vc => vc.name).filter(Boolean);
          const combinedTaughtClasses = Array.from(new Set([...propsTaught, ...profileTaught, ...vClassNames]));
          setResolvedTaughtClasses(combinedTaughtClasses);

          let myVClassStudents = new Set<string>();
          myCreatedVClasses.forEach(vc => {
            parseStudentEmails(vc.student_emails).forEach(e => myVClassStudents.add(e));
          });

          filteredProfiles = filteredProfiles.filter(p => {
            const pEmail = (p.email || '').toLowerCase().trim();
            if (pEmail.endsWith('@example.com') || pEmail.endsWith('@atenas.com')) return false;
            const pTaughtClean = parseAnosLecionados(p.anos_lecionados);
            const isTeacher = pTaughtClean.length > 0 || Boolean(p.materia) || pEmail.includes('prof') || p.role === 'teacher';

            if (isTeacher) {
              // Other teacher shares at least one taught turma with this teacher OR shares a virtual class
              if (combinedTaughtClasses.length === 0) return true;
              const sharesTaughtClass = pTaughtClean.some(t => combinedTaughtClasses.some(ct => areTurmasMatching(t, ct)));
              const sharesVirtualClass = myCreatedVClasses.some(vc => (vc.teacher_email || '').toLowerCase().trim() === pEmail);
              return sharesTaughtClass || sharesVirtualClass;
            } else {
              // Student belongs to teacher's taught classes OR is in teacher's virtual class
              if (combinedTaughtClasses.length === 0 && myVClassStudents.size === 0) return true;
              const matchesTaughtClass = p.turma && combinedTaughtClasses.some(ct => areTurmasMatching(p.turma, ct));
              const matchesVClassStudent = myVClassStudents.has(pEmail);
              return matchesTaughtClass || matchesVClassStudent || combinedTaughtClasses.length === 0;
            }
          });
        }

        // Map to ChatContact structure
        const mappedContacts: ChatContact[] = filteredProfiles.map(p => {
          const pTaughtClean = parseAnosLecionados(p.anos_lecionados);
          const isTeacher = pTaughtClean.length > 0 || Boolean(p.materia) || (p.email && p.email.toLowerCase().includes('prof'));

          return {
            email: p.email,
            name: p.nome_completo || p.email.split('@')[0],
            role: isTeacher ? 'teacher' : 'student',
            turma: isTeacher ? (pTaughtClean.join(', ') || 'Professor') : (p.turma || userTurma || 'Turma'),
            materia: p.materia,
            isOnline: true
          };
        });

        // Ensure any participant from message history is also in contacts list so no incoming chat is orphaned
        try {
          const { data: histMsgs } = await supabase
            .from('wsm_direct_messages')
            .select('sender_email, sender_name, sender_role, receiver_email, receiver_name, receiver_role, turma_context')
            .or(`sender_email.ilike.${myEmailLower},receiver_email.ilike.${myEmailLower}`);

          const existingEmails = new Set(mappedContacts.map(c => c.email.toLowerCase().trim()));

          (histMsgs || []).forEach(m => {
            const otherEmail = m.sender_email.toLowerCase().trim() === myEmailLower ? m.receiver_email : m.sender_email;
            const otherName = m.sender_email.toLowerCase().trim() === myEmailLower ? m.receiver_name : m.sender_name;
            const otherRole = m.sender_email.toLowerCase().trim() === myEmailLower ? m.receiver_role : m.sender_role;

            if (otherEmail && otherEmail.toLowerCase().trim() !== myEmailLower && !existingEmails.has(otherEmail.toLowerCase().trim())) {
              existingEmails.add(otherEmail.toLowerCase().trim());
              mappedContacts.push({
                email: otherEmail,
                name: otherName || otherEmail.split('@')[0],
                role: (otherRole as any) || (otherEmail.includes('prof') ? 'teacher' : 'student'),
                turma: m.turma_context || 'Sala Virtual',
                isOnline: true
              });
            }
          });
        } catch (e) {
          console.warn('Fallback loading history contacts:', e);
        }

        // Set contacts list
        if (isMounted) {
          setContacts(mappedContacts);
          if (mappedContacts.length > 0) {
            setActiveContact(prev => prev || mappedContacts[0]);
          } else {
            setActiveContact(null);
          }
        }
      } catch (err) {
        console.error('Error loading chat contacts:', err);
      } finally {
        if (isMounted) setLoadingContacts(false);
      }
    }

    loadContacts();
    return () => { isMounted = false; };
  }, [myEmailLower, currentUserRole, userTurma, JSON.stringify(userAnosLecionados)]);

  // 2. Fetch and Subscribe Messages for active contact
  const activeContactEmail = activeContact?.email;

  useEffect(() => {
    if (!activeContact || !activeContactEmail) return;

    let isMounted = true;
    const contactEmailLower = activeContactEmail.toLowerCase().trim();

    async function loadConversationMessages(isBackground = false) {
      if (!isBackground && isMounted) setLoadingMessages(true);
      try {
        let data: any[] | null = null;
        let fetchErr: any = null;

        try {
          // 1. Try direct_messages table
          const res1 = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_email.ilike.${myEmailLower},receiver_email.ilike.${contactEmailLower}),and(sender_email.ilike.${contactEmailLower},receiver_email.ilike.${myEmailLower})`)
            .order('created_at', { ascending: true });

          if (!res1.error && res1.data && res1.data.length > 0) {
            data = res1.data;
          } else {
            // 2. Try wsm_direct_messages table
            const res2 = await supabase
              .from('wsm_direct_messages')
              .select('*')
              .or(`and(sender_email.ilike.${myEmailLower},receiver_email.ilike.${contactEmailLower}),and(sender_email.ilike.${contactEmailLower},receiver_email.ilike.${myEmailLower})`)
              .order('created_at', { ascending: true });

            if (!res2.error && res2.data && res2.data.length > 0) {
              data = res2.data;
            } else if (!res1.error && res1.data) {
              data = res1.data;
            } else {
              fetchErr = res1.error || res2.error;
            }
          }
        } catch (err) {
          fetchErr = err;
        }

        if (!fetchErr && data && data.length > 0 && isMounted) {
          const normalized = data.map(m => {
            if ((m.sender_email || '').toLowerCase().trim() === contactEmailLower &&
                (m.receiver_email || '').toLowerCase().trim() === myEmailLower) {
              return { ...m, is_read: true };
            }
            return m;
          });
          setMessages(normalized);
          markConversationAsRead(contactEmailLower);
        } else {
          // Fallback to LocalStorage
          const storageKey = `athenas_chat_${[myEmailLower, contactEmailLower].sort().join('_')}`;
          const localSaved = localStorage.getItem(storageKey);
          if (localSaved && isMounted) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              markConversationAsRead(contactEmailLower);
            }
          }
        }
      } catch (err) {
        console.warn('Direct messages query fallback:', err);
      } finally {
        if (!isBackground && isMounted) setLoadingMessages(false);
      }
    }

    loadConversationMessages(false);

    // Supabase Realtime Subscription
    const channel = supabase
      .channel(`chat_${[myEmailLower, contactEmailLower].sort().join('_')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wsm_direct_messages'
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (
            newMsg && newMsg.sender_email && newMsg.receiver_email &&
            ((newMsg.sender_email.toLowerCase() === myEmailLower && newMsg.receiver_email.toLowerCase() === contactEmailLower) ||
            (newMsg.sender_email.toLowerCase() === contactEmailLower && newMsg.receiver_email.toLowerCase() === myEmailLower))
          ) {
            const isFromContact = newMsg.sender_email.toLowerCase() === contactEmailLower;
            const updatedMsg = isFromContact ? { ...newMsg, is_read: true } : newMsg;

            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, updatedMsg];
            });

            if (isFromContact) {
              markConversationAsRead(contactEmailLower);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages'
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (
            newMsg && newMsg.sender_email && newMsg.receiver_email &&
            ((newMsg.sender_email.toLowerCase() === myEmailLower && newMsg.receiver_email.toLowerCase() === contactEmailLower) ||
            (newMsg.sender_email.toLowerCase() === contactEmailLower && newMsg.receiver_email.toLowerCase() === myEmailLower))
          ) {
            const isFromContact = newMsg.sender_email.toLowerCase() === contactEmailLower;
            const updatedMsg = isFromContact ? { ...newMsg, is_read: true } : newMsg;

            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, updatedMsg];
            });

            if (isFromContact) {
              markConversationAsRead(contactEmailLower);
            }
          }
        }
      )
      .subscribe();

    // Smooth background refresh every 4 seconds
    const interval = setInterval(() => {
      loadConversationMessages(true);
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeContactEmail, myEmailLower, currentUserName, markConversationAsRead]);

  // Persist local state whenever messages update
  useEffect(() => {
    if (!activeContact || messages.length === 0) return;
    const contactEmailLower = activeContact.email.toLowerCase().trim();
    const storageKey = `athenas_chat_${[myEmailLower, contactEmailLower].sort().join('_')}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // Storage quota fallback
    }
  }, [messages, activeContact, myEmailLower]);

  // Keep activeContactEmailRef updated and mark unread messages as read
  useEffect(() => {
    activeContactEmailRef.current = activeContact?.email || null;
    if (activeContact?.email) {
      markConversationAsRead(activeContact.email);
    }
  }, [activeContact?.email, markConversationAsRead]);

  // Periodically update unread counts and latest message for all contacts in background
  useEffect(() => {
    if (contacts.length === 0 || !myEmailLower) return;

    let isMounted = true;

    async function refreshContactsSummary() {
      try {
        let dbMsgs: ChatMessage[] = [];
        const res1 = await supabase
          .from('direct_messages')
          .select('*')
          .or(`sender_email.ilike.${myEmailLower},receiver_email.ilike.${myEmailLower}`)
          .order('created_at', { ascending: true });

        if (!res1.error && res1.data) {
          dbMsgs = res1.data as ChatMessage[];
        } else {
          const res2 = await supabase
            .from('wsm_direct_messages')
            .select('*')
            .or(`sender_email.ilike.${myEmailLower},receiver_email.ilike.${myEmailLower}`)
            .order('created_at', { ascending: true });
          if (!res2.error && res2.data) {
            dbMsgs = res2.data as ChatMessage[];
          }
        }

        if (!isMounted) return;

        setContacts(prevContacts => {
          let hasChanges = false;
          const currentActiveEmail = (activeContactEmailRef.current || '').toLowerCase().trim();

          const updated = prevContacts.map(contact => {
            const cEmail = (contact.email || '').toLowerCase().trim();
            const convMsgs = dbMsgs.filter(m => {
              const s = (m.sender_email || '').toLowerCase().trim();
              const r = (m.receiver_email || '').toLowerCase().trim();
              return (s === cEmail && r === myEmailLower) || (s === myEmailLower && r === cEmail);
            });

            const isCurrentActive = Boolean(currentActiveEmail && currentActiveEmail === cEmail);
            const unreadMsgs = convMsgs.filter(m => {
              const s = (m.sender_email || '').toLowerCase().trim();
              const r = (m.receiver_email || '').toLowerCase().trim();
              return s === cEmail && r === myEmailLower && m.is_read !== true;
            });

            const unreadCount = isCurrentActive ? 0 : unreadMsgs.length;

            if (isCurrentActive && unreadMsgs.length > 0) {
              markConversationAsRead(cEmail);
            }

            const lastMsg = convMsgs[convMsgs.length - 1];
            let lastMessageStr = contact.lastMessage || '';
            let lastMessageTimeStr = contact.lastMessageTime || '';

            if (lastMsg) {
              lastMessageStr = lastMsg.content || (lastMsg.attachment_name ? `📎 ${lastMsg.attachment_name}` : 'Anexo');
              const d = new Date(lastMsg.created_at);
              lastMessageTimeStr = isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            if (
              contact.unreadCount !== unreadCount ||
              contact.lastMessage !== lastMessageStr ||
              contact.lastMessageTime !== lastMessageTimeStr
            ) {
              hasChanges = true;
              return {
                ...contact,
                unreadCount,
                lastMessage: lastMessageStr,
                lastMessageTime: lastMessageTimeStr
              };
            }
            return contact;
          });

          return hasChanges ? updated : prevContacts;
        });
      } catch (err) {
        console.warn('Error refreshing contacts summary:', err);
      }
    }

    refreshContactsSummary();
    const interval = setInterval(refreshContactsSummary, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [contacts.length, myEmailLower, markConversationAsRead]);

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeFormatted = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKB} KB`;

    let fileTypeCategory: 'image' | 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'archive' | 'file' = 'file';

    if (file.type.startsWith('image/')) {
      fileTypeCategory = 'image';
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      fileTypeCategory = 'pdf';
    } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      fileTypeCategory = 'docx';
    } else if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
      fileTypeCategory = 'pptx';
    } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      fileTypeCategory = 'xlsx';
    } else if (file.name.endsWith('.zip') || file.name.endsWith('.rar')) {
      fileTypeCategory = 'archive';
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedFile({
        file,
        previewUrl: dataUrl,
        type: fileTypeCategory,
        sizeFormatted
      });
    };
    reader.readAsDataURL(file);
  };

  // Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeContact) return;
    if (!messageInput.trim() && !selectedFile) return;

    const textContent = messageInput.trim();
    const contactEmailLower = activeContact.email.toLowerCase().trim();

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender_email: myEmailLower,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      receiver_email: contactEmailLower,
      receiver_name: activeContact.name,
      content: textContent,
      attachment_url: selectedFile?.previewUrl || undefined,
      attachment_name: selectedFile?.file.name || undefined,
      attachment_type: selectedFile?.type || undefined,
      attachment_size: selectedFile?.sizeFormatted || undefined,
      turma_context: activeContact.turma,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Optimistic UI update
    setMessages(prev => [...prev, newMsg]);
    setMessageInput('');
    setSelectedFile(null);
    setShowEmojiPicker(false);
    setTimeout(() => scrollToBottom(true), 50);

    // Save to Supabase
    try {
      const payload = {
        id: newMsg.id,
        sender_email: newMsg.sender_email,
        sender_name: newMsg.sender_name,
        sender_role: newMsg.sender_role,
        receiver_email: newMsg.receiver_email,
        receiver_name: newMsg.receiver_name,
        content: newMsg.content,
        attachment_url: newMsg.attachment_url,
        attachment_name: newMsg.attachment_name,
        attachment_type: newMsg.attachment_type,
        attachment_size: newMsg.attachment_size,
        turma_context: newMsg.turma_context,
        is_read: false,
        created_at: newMsg.created_at,
        reactions: {},
        is_edited: false
      };
      const res1 = await supabase.from('direct_messages').insert(payload);
      if (res1.error) {
        await supabase.from('wsm_direct_messages').insert(payload);
      }
    } catch (err) {
      console.warn('Supabase message insert fallback to local:', err);
    }
  };

  // Filtered contacts based on search and tab
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.turma.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (c.materia && c.materia.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (contactFilter === 'alunos') return c.role === 'student';
      if (contactFilter === 'professores') return c.role === 'teacher';
      return true;
    });
  }, [contacts, searchTerm, contactFilter]);

  if (isMonitoringMode) {
    return (
      <div className="h-[calc(100vh-140px)] min-h-[550px] bg-neutral-950 rounded-3xl border border-neutral-900 overflow-hidden flex flex-col shadow-2xl relative">
        {/* Monitoring Header Banner */}
        <div className="p-4 px-6 bg-gradient-to-r from-amber-950/80 via-neutral-950 to-neutral-950 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMonitoringMode(false)}
              className="p-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Minhas Conversas</span>
            </button>

            <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400 animate-pulse" />
                <h3 className="text-sm font-black text-amber-200 font-display">
                  Monitoramento de Conversas entre Alunos
                </h3>
              </div>
              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                Supervisão restrita exclusivamente aos alunos das suas turmas: <span className="text-amber-400 font-bold">{parseAnosLecionados(userAnosLecionados).join(', ')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Apenas Leitura • Sigilo Pedagógico</span>
            </span>
          </div>
        </div>

        {/* Main Monitoring 2-Column Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left: Monitored Pairs List */}
          <div className={`${
            mobileShowSidebar ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-80 lg:w-96 bg-neutral-950/90 border-r border-neutral-900 shrink-0 h-full`}>
            {/* Search & Turma Filter */}
            <div className="p-4 border-b border-neutral-900 space-y-3 bg-neutral-950">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome de aluno ou turma..."
                  value={monitoredSearchTerm}
                  onChange={(e) => setMonitoredSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Turma Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setMonitoredTurmaFilter('todas')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                    monitoredTurmaFilter === 'todas'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Todas as Turmas
                </button>
                {parseAnosLecionados(userAnosLecionados).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMonitoredTurmaFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                      cleanTurma(monitoredTurmaFilter) === cleanTurma(t)
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Turma {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Monitored Pairs Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/60 custom-scrollbar">
              {loadingMonitored ? (
                <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Carregando conversas monitoradas...</p>
                </div>
              ) : filteredMonitoredPairs.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-neutral-700" />
                  <p className="font-bold text-neutral-400">Nenhuma conversa registrada</p>
                  <p className="text-[11px] text-neutral-500">
                    Nenhuma conversa realizada entre alunos das suas turmas até o momento. As interações reais aparecerão aqui em tempo real assim que os alunos enviarem mensagens.
                  </p>
                </div>
              ) : (
                filteredMonitoredPairs.map((pair) => {
                  const isSelected = activeMonitoredPairKey === pair.pairKey;
                  return (
                    <button
                      key={pair.pairKey}
                      type="button"
                      onClick={() => {
                        setActiveMonitoredPairKey(pair.pairKey);
                        setMobileShowSidebar(false);
                      }}
                      className={`w-full p-3.5 flex items-start gap-3 transition-all text-left cursor-pointer group ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-2 border-l-amber-500'
                          : 'hover:bg-neutral-900/50'
                      }`}
                    >
                      {/* Dual Student Avatar */}
                      <div className="relative shrink-0 flex items-center -space-x-2 pt-1">
                        <div className="w-7 h-7 rounded-xl bg-neutral-800 border border-neutral-700 text-emerald-400 font-bold text-[10px] flex items-center justify-center uppercase shadow-sm">
                          {pair.student1.name.substring(0, 2)}
                        </div>
                        <div className="w-7 h-7 rounded-xl bg-neutral-800 border border-neutral-700 text-sky-400 font-bold text-[10px] flex items-center justify-center uppercase shadow-sm">
                          {pair.student2.name.substring(0, 2)}
                        </div>
                      </div>

                      {/* Pair Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-neutral-100 truncate group-hover:text-amber-300">
                            {pair.student1.name.split(' ')[0]} ↔ {pair.student2.name.split(' ')[0]}
                          </h4>
                          <span className="text-[9px] font-mono text-neutral-500 shrink-0">
                            {pair.lastMessageTime}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 text-[9px] font-mono font-bold">
                            Turma {pair.turma}
                          </span>
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {pair.messages.length} msgs
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-400 truncate mt-1">
                          {pair.lastMessage}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Rendered Chat View */}
          {activeMonitoredPair ? (
            <div className={`${
              !mobileShowSidebar ? 'flex' : 'hidden'
            } md:flex flex-col flex-1 h-full bg-[#050806] relative`}>
              {/* Header of Monitored Chat */}
              <div className="p-3.5 px-5 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileShowSidebar(true)}
                    className="md:hidden p-1.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center -space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center justify-center uppercase">
                      {activeMonitoredPair.student1.name.substring(0, 2)}
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 font-extrabold text-xs flex items-center justify-center uppercase">
                      {activeMonitoredPair.student2.name.substring(0, 2)}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-neutral-100 font-display">
                        {activeMonitoredPair.student1.name} & {activeMonitoredPair.student2.name}
                      </h3>
                      <span className="px-2 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
                        Turma {activeMonitoredPair.turma}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <Eye className="w-3 h-3 text-amber-400" />
                      <span>Visualizando Histórico de Interação entre Alunos</span>
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono font-bold">
                  Modo Supervisão Docente
                </span>
              </div>

              {/* Rendered Messages Feed */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 custom-scrollbar">
                {activeMonitoredPair.messages.map((msg) => {
                  const isStudent1 = msg.sender_email.toLowerCase().trim() === activeMonitoredPair.student1.email.toLowerCase().trim();
                  const dateObj = new Date(msg.created_at);
                  const timeStr = isNaN(dateObj.getTime()) ? 'Agora' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStudent1 ? 'items-start' : 'items-end'} space-y-1`}
                    >
                      <span className={`text-[10px] font-mono font-bold px-1 ${
                        isStudent1 ? 'text-emerald-400' : 'text-sky-400'
                      }`}>
                        {msg.sender_name} ({activeMonitoredPair.turma})
                      </span>

                      <div
                        className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl space-y-2 shadow-lg ${
                          isStudent1
                            ? 'bg-neutral-900 text-neutral-100 rounded-tl-none border border-emerald-500/30'
                            : 'bg-sky-950/60 text-sky-100 rounded-tr-none border border-sky-500/30'
                        }`}
                      >
                        {/* Image Attachment */}
                        {msg.attachment_url && msg.attachment_type === 'image' && (
                          <div className="rounded-xl overflow-hidden border border-black/20 bg-black/40 group/img relative">
                            <img
                              src={msg.attachment_url}
                              alt={msg.attachment_name || 'Imagem'}
                              className="max-h-60 w-full object-cover rounded-xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                              onClick={() => setViewingImage(msg.attachment_url || null)}
                            />
                          </div>
                        )}

                        {/* Document Attachment */}
                        {msg.attachment_url && msg.attachment_type !== 'image' && (
                          <div className="p-3 rounded-xl border bg-black/40 border-neutral-800 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-5 h-5 text-amber-400" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{msg.attachment_name || 'Documento'}</p>
                                <span className="text-[10px] font-mono opacity-80">{msg.attachment_size || 'Arquivo'}</span>
                              </div>
                            </div>
                            <a
                              href={msg.attachment_url}
                              download={msg.attachment_name || 'anexo'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}

                        {msg.content && (
                          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}

                        <div className="flex items-center justify-end text-[9px] font-mono text-neutral-500">
                          <span>{timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Read-only Footer Banner */}
              <div className="p-3.5 px-5 bg-neutral-950 border-t border-neutral-900 flex items-center justify-center gap-2 text-center text-xs text-neutral-400 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px]">
                  Modo de Supervisão Pedagógica • Canal privado entre alunos. Ações do professor são somente de leitura para acompanhamento escolar.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500 space-y-3 bg-[#050806]">
              <Eye className="w-12 h-12 text-neutral-700" />
              <h3 className="text-sm font-bold text-neutral-300">Selecione uma conversa para monitorar</h3>
              <p className="text-xs text-neutral-500 max-w-xs">
                Escolha uma conversa entre dois alunos da sua turma na lista ao lado para acompanhar as interações.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] min-h-[550px] bg-neutral-950 rounded-3xl border border-neutral-900 overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
      
      {/* 1. Sidebar Contacts List */}
      <div 
        className={`${
          mobileShowSidebar ? 'flex' : 'hidden'
        } md:flex flex-col w-full md:w-80 lg:w-96 bg-neutral-950/80 border-r border-neutral-900 shrink-0 h-full`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-900 space-y-3 bg-neutral-950/90 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-neutral-100 font-display">Conversas da Turma</h3>
                <p className="text-[10px] text-neutral-400 font-mono">
                  {currentUserRole === 'teacher' 
                    ? (resolvedTaughtClasses.length > 0 ? `Turmas: ${resolvedTaughtClasses.join(', ')}` : 'Docente Athenas') 
                    : (resolvedStudentTurma ? `Turma: ${resolvedStudentTurma}` : 'Estudante Athenas')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                {filteredContacts.length} contatos
              </span>
              {contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-neutral-950 text-[10px] font-mono font-black shadow-md animate-pulse">
                  {contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0)} novas
                </span>
              )}
            </div>
          </div>

          {/* Search Contacts */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, matéria ou turma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs text-neutral-200 outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-neutral-900/60 p-1 rounded-xl border border-neutral-850">
            <button
              type="button"
              onClick={() => setContactFilter('todos')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                contactFilter === 'todos' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setContactFilter('alunos')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                contactFilter === 'alunos' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Alunos
            </button>
            <button
              type="button"
              onClick={() => setContactFilter('professores')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                contactFilter === 'professores' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Professores
            </button>
          </div>
        </div>

        {/* Contacts Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/50 custom-scrollbar">
          {/* Teacher Monitoring Card */}
          {currentUserRole === 'teacher' && (
            <div className="p-3 bg-neutral-950 border-b border-neutral-900">
              <button
                type="button"
                onClick={() => {
                  setIsMonitoringMode(true);
                  setMobileShowSidebar(false);
                }}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 hover:border-amber-500/60 flex items-center gap-3 transition-all cursor-pointer group text-left shadow-md hover:shadow-amber-500/10"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Eye className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-300 font-display truncate">
                      Monitoramento de conversas
                    </h4>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-mono font-bold uppercase shrink-0">
                      Supervisão
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    Ver chats entre alunos das suas turmas
                  </p>
                </div>
              </button>
            </div>
          )}

          {loadingContacts ? (
            <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Carregando contatos da turma...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
              <Users className="w-8 h-8 mx-auto text-neutral-700" />
              <p className="font-bold text-neutral-400">Nenhum contato encontrado</p>
              <p className="text-[11px] text-neutral-500">Apenas alunos e professores da sua turma são listados.</p>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = activeContact?.email === contact.email;
              const isTeacher = contact.role === 'teacher';
              const hasUnread = Boolean(contact.unreadCount && contact.unreadCount > 0);

              return (
                <button
                  key={contact.email}
                  type="button"
                  onClick={() => {
                    setActiveContact(contact);
                    setMobileShowSidebar(false);
                    markConversationAsRead(contact.email);
                  }}
                  className={`w-full p-3.5 flex items-center gap-3 transition-all text-left cursor-pointer group ${
                    isSelected 
                      ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' 
                      : hasUnread
                        ? 'bg-emerald-950/25 hover:bg-emerald-900/30 border-l-2 border-l-emerald-400'
                        : 'hover:bg-neutral-900/50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs uppercase shadow-sm ${
                      isTeacher 
                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-neutral-950' 
                        : 'bg-neutral-800 text-emerald-400 border border-neutral-700'
                    }`}>
                      {contact.name.substring(0, 2)}
                    </div>
                    {hasUnread ? (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-neutral-950 font-black text-[10px] flex items-center justify-center absolute -bottom-1 -right-1 border-2 border-neutral-950 shadow-md animate-pulse z-10">
                        {contact.unreadCount! > 99 ? '99+' : contact.unreadCount}
                      </span>
                    ) : contact.isOnline ? (
                      <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-neutral-950 absolute -bottom-0.5 -right-0.5 shadow-sm" />
                    ) : null}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs truncate ${
                        hasUnread
                          ? 'font-black text-emerald-300'
                          : 'font-bold text-neutral-100 group-hover:text-emerald-300'
                      }`}>
                        {contact.name}
                      </h4>
                      {contact.lastMessageTime && (
                        <span className={`text-[9px] font-mono shrink-0 ${
                          hasUnread ? 'text-emerald-400 font-bold' : 'text-neutral-500'
                        }`}>
                          {contact.lastMessageTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                        isTeacher ? 'bg-teal-500/20 text-teal-300' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {isTeacher ? `Prof. ${contact.materia || ''}` : `Aluno • ${contact.turma}`}
                      </span>
                    </div>

                    {contact.lastMessage && (
                      <p className={`text-[11px] truncate mt-1 ${
                        hasUnread ? 'text-emerald-300 font-bold' : 'text-neutral-400'
                      }`}>
                        {contact.lastMessage}
                      </p>
                    )}
                  </div>

                  {hasUnread ? (
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-1">
                      <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-emerald-400 text-neutral-950 font-black text-[11px] flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-300">
                        {contact.unreadCount! > 99 ? '99+' : contact.unreadCount}
                      </span>
                      <span className="text-[8px] font-mono font-black text-emerald-400 uppercase tracking-tighter">
                        Nova
                      </span>
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Chat Area */}
      {activeContact ? (
        <div 
          className={`${
            !mobileShowSidebar ? 'flex' : 'hidden'
          } md:flex flex-col flex-1 h-full bg-[#050806] relative`}
        >
          {/* Chat Header */}
          <div className="p-3.5 px-5 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={() => setMobileShowSidebar(true)}
                className="md:hidden p-1.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Active Contact Avatar & Status */}
              <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 text-emerald-400 font-bold text-xs uppercase flex items-center justify-center shrink-0">
                {activeContact.name.substring(0, 2)}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-neutral-100 font-display">
                    {activeContact.name}
                  </h3>
                  <span className={`px-2 py-0.2 rounded-md text-[9px] font-mono font-extrabold uppercase ${
                    activeContact.role === 'teacher' ? 'bg-teal-500/20 text-teal-300' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {activeContact.role === 'teacher' ? `Professor (${activeContact.materia || 'Docente'})` : `Aluno (${activeContact.turma})`}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online na plataforma • Canal Seguro da Turma {activeContact.turma}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-850 text-[10px] text-neutral-400 font-mono">
                Conversa Criptografada
              </span>
            </div>
          </div>

          {/* Messages Feed */}
          <div ref={messagesContainerRef} className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 custom-scrollbar">
            {loadingMessages ? (
              <div className="py-12 text-center text-xs text-neutral-500 space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Carregando histórico da conversa...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <MessageSquare className="w-6 h-6 text-emerald-500/50" />
                </div>
                <p className="text-xs font-bold text-neutral-300">Nenhuma mensagem ainda</p>
                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                  Envie uma mensagem ou documento para iniciar a conversa com {activeContact.name}.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_email.toLowerCase().trim() === myEmailLower;
                const dateObj = new Date(msg.created_at);
                const timeStr = isNaN(dateObj.getTime()) ? 'Agora' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isMenuOpen = activeMenuMessageId === msg.id;
                const isEditing = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 group/msg relative`}
                  >
                    {/* Sender Name badge for group context */}
                    {!isMe && (
                      <span className="text-[10px] font-mono font-bold text-neutral-400 px-1">
                        {msg.sender_name}
                      </span>
                    )}

                    <div className="relative max-w-[85%] sm:max-w-[70%]">
                      {/* Message Bubble */}
                      <div
                        className={`p-3.5 rounded-2xl space-y-2 shadow-lg relative ${
                          isMe
                            ? 'bg-emerald-600/90 text-white rounded-br-none border border-emerald-500/40'
                            : 'bg-neutral-900 text-neutral-100 rounded-bl-none border border-neutral-800'
                        }`}
                      >
                        {/* 3-Dots Options Trigger Icon in Corner */}
                        <div className={`absolute top-2.5 ${isMe ? 'right-2.5' : 'right-2.5'} z-20`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                            }}
                            className={`p-1 rounded-lg transition-all cursor-pointer ${
                              isMenuOpen 
                                ? 'bg-black/50 text-white opacity-100' 
                                : 'opacity-0 group-hover/msg:opacity-100 hover:bg-black/30 text-neutral-300'
                            }`}
                            title="Opções da mensagem"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Options Card Dropdown (Excluir, Editar, Reagir) */}
                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute top-7 ${
                                  isMe ? 'right-0' : 'left-0'
                                } w-56 sm:w-60 bg-neutral-900/98 border border-neutral-750 backdrop-blur-2xl rounded-2xl shadow-2xl p-2 z-[100] text-neutral-200 space-y-1.5 font-sans`}
                              >
                                {/* Option 3: Reagir (With reaction emojis on the side) */}
                                <div className="p-2.5 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-extrabold text-neutral-300">
                                    <span className="flex items-center gap-1.5">
                                      <Smile className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>3. Reagir</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-1 pt-0.5">
                                    {REACTION_EMOJIS.map((emoji) => {
                                      const hasReacted = msg.reactions?.[emoji]?.includes(myEmailLower);
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => handleToggleReaction(msg.id, emoji)}
                                          className={`p-1.5 rounded-xl text-base hover:scale-125 transition-transform cursor-pointer ${
                                            hasReacted ? 'bg-emerald-500/25 border border-emerald-500/40 shadow-sm' : 'hover:bg-neutral-800'
                                          }`}
                                          title={`Reagir com ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Option 2: Editar mensagem */}
                                {isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(msg)}
                                    className="w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-neutral-800 text-neutral-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-sky-400" />
                                    <span>2. Editar mensagem</span>
                                  </button>
                                )}

                                {/* Option 1: Excluir mensagem */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>1. Excluir mensagem</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Image Attachment */}
                        {msg.attachment_url && msg.attachment_type === 'image' && (
                          <div className="rounded-xl overflow-hidden border border-black/20 bg-black/40 group/img relative">
                            <img
                              src={msg.attachment_url}
                              alt={msg.attachment_name || 'Imagem em anexo'}
                              className="max-h-60 w-full object-cover rounded-xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                              onClick={() => setViewingImage(msg.attachment_url || null)}
                            />
                            <button
                              type="button"
                              onClick={() => setViewingImage(msg.attachment_url || null)}
                              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                              title="Expandir Imagem"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* File / Document Attachment */}
                        {msg.attachment_url && msg.attachment_type !== 'image' && (
                          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            isMe ? 'bg-emerald-700/60 border-emerald-400/30 text-white' : 'bg-neutral-950/80 border-neutral-800 text-neutral-200'
                          }`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-2 rounded-lg shrink-0 ${
                                msg.attachment_type === 'pdf' ? 'bg-rose-500/20 text-rose-300' :
                                msg.attachment_type === 'docx' ? 'bg-sky-500/20 text-sky-300' :
                                msg.attachment_type === 'pptx' ? 'bg-amber-500/20 text-amber-300' :
                                msg.attachment_type === 'xlsx' ? 'bg-emerald-500/20 text-emerald-300' :
                                'bg-neutral-800 text-neutral-300'
                              }`}>
                                {msg.attachment_type === 'pdf' ? <FileText className="w-5 h-5" /> :
                                 msg.attachment_type === 'docx' ? <FileCode className="w-5 h-5" /> :
                                 msg.attachment_type === 'pptx' ? <Presentation className="w-5 h-5" /> :
                                 msg.attachment_type === 'xlsx' ? <FileSpreadsheet className="w-5 h-5" /> :
                                 msg.attachment_type === 'archive' ? <Archive className="w-5 h-5" /> :
                                 <FileText className="w-5 h-5" />}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{msg.attachment_name || 'Documento'}</p>
                                <span className="text-[10px] font-mono opacity-80">{msg.attachment_size || 'Arquivo'}</span>
                              </div>
                            </div>

                            <a
                              href={msg.attachment_url}
                              download={msg.attachment_name || 'anexo'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-2 rounded-lg hover:scale-105 transition-transform ${
                                isMe ? 'bg-emerald-800 hover:bg-emerald-900 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-emerald-400'
                              }`}
                              title="Baixar Arquivo"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}

                        {/* Text Content / Edit Box */}
                        {isEditing ? (
                          <div className="space-y-2 py-1 pr-6">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full p-2 bg-black/40 border border-emerald-400/50 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-emerald-400 resize-none min-h-[60px]"
                              placeholder="Editar mensagem..."
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingMessageId(null)}
                                className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-[10px] text-neutral-300 font-bold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(msg.id)}
                                className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-[10px] text-neutral-950 font-black shadow-md"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.content && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words pr-5">
                              {msg.content}
                            </p>
                          )
                        )}

                        {/* Footer Timestamp & Edit Status */}
                        <div className={`flex items-center justify-end gap-1.5 text-[9px] font-mono ${
                          isMe ? 'text-emerald-200' : 'text-neutral-500'
                        }`}>
                          {msg.is_edited && (
                            <span className="italic opacity-80">(editada)</span>
                          )}
                          <span>{timeStr}</span>
                          {isMe && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                        </div>
                      </div>

                      {/* FLOATING REACTION PILL BADGE ATTACHED AT BOTTOM CORNER (Matching attached image!) */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} z-20 flex items-center gap-1`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMessageId(msg.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white text-neutral-900 border border-neutral-200 shadow-lg backdrop-blur-md text-[11px] font-black select-none cursor-pointer hover:scale-110 transition-transform"
                            title="Reações da mensagem"
                          >
                            {Object.entries(msg.reactions).map(([emoji, users]) => {
                              if (!users || users.length === 0) return null;
                              return (
                                <span key={emoji} className="flex items-center gap-0.5">
                                  <span>{emoji}</span>
                                  {users.length > 1 && (
                                    <span className="text-[9px] font-mono font-bold text-neutral-700">
                                      {users.length}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected File Attachment Preview Bar */}
          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-3 px-5 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selectedFile.type === 'image' && selectedFile.previewUrl ? (
                    <img
                      src={selectedFile.previewUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-xl border border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-100 truncate">{selectedFile.file.name}</p>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {selectedFile.sizeFormatted} • Anexo Pronto para Envio
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Emoji Bar Popup */}
          {showEmojiPicker && (
            <div className="p-2 bg-neutral-900 border-t border-neutral-800 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setMessageInput(prev => prev + emoji);
                  }}
                  className="p-2 hover:bg-neutral-800 rounded-xl text-base transition-transform active:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className={`p-3.5 px-4 ${isMusicMiniPlayerActive ? 'pb-24 sm:pb-28' : 'pb-3.5'} bg-neutral-950 border-t border-neutral-900 flex items-center gap-2 shrink-0 relative z-50 transition-all duration-300`}
          >
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
              onChange={handleFileChange}
            />

            {/* Attach File Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 rounded-xl border border-neutral-850 transition-all cursor-pointer active:scale-95"
              title="Anexar Imagem ou Documento"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Quick Emoji Toggle Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                showEmojiPicker 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-850'
              }`}
              title="Inserir Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Textarea / Input */}
            <input
              type="text"
              placeholder={`Escrever mensagem para ${activeContact.name}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-500/50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!messageInput.trim() && !selectedFile}
              className={`relative z-50 p-2.5 rounded-xl font-extrabold transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                messageInput.trim() || selectedFile
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-neutral-900 text-neutral-600 border border-neutral-850 cursor-not-allowed'
              }`}
              title="Enviar Mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500 space-y-3 bg-[#050806]">
          <MessageSquare className="w-12 h-12 text-neutral-700" />
          <h3 className="text-sm font-bold text-neutral-300">Selecione uma conversa</h3>
          <p className="text-xs text-neutral-500 max-w-xs">
            Escolha um colega ou professor na lista ao lado para iniciar um chat privado da turma.
          </p>
        </div>
      )}

      {/* Lightbox Modal for Image Preview */}
      <AnimatePresence>
        {viewingImage && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
            >
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="absolute top-2 right-2 p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={viewingImage}
                alt="Imagem Expandida"
                className="max-h-[85vh] max-w-full object-contain rounded-2xl border border-neutral-800 shadow-2xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
