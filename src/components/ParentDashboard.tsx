/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  LogOut, 
  Sparkles, 
  GraduationCap, 
  ClipboardList, 
  MessageSquare, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Bot, 
  Copy, 
  Check, 
  ShieldCheck, 
  Search, 
  HelpCircle, 
  ArrowRight,
  TrendingUp,
  FileText,
  User,
  Paperclip,
  Download,
  Clock,
  Send,
  Eye,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../supabase';
import { fetchParentLinkedStudents, linkParentWithCode, removeStudentParentLink } from '../utils/profileDb';
import StudentProgress from './StudentProgress';
import AthenasMarkdownRenderer from './AthenasMarkdownRenderer';

const LOGO_OPEN = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png";
const LOGO_CLOSED = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/boneco_olhos_fechados_cutout_1_mmguon.png";

interface ParentDashboardProps {
  email: string;
  onLogout: () => void;
}

interface LinkedStudent {
  linkId: string;
  email: string;
  name: string;
  turma: string;
  numero_chamada?: number;
  escola?: string;
  linked_at?: string;
}

interface ChatSession {
  id: string;
  user_email: string;
  title: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: any[];
}

interface DirectMessageItem {
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
  attachment_type?: string;
  attachment_size?: string;
  turma_context?: string;
  created_at: string;
  is_read?: boolean;
}

interface PersonConversation {
  contactEmail: string;
  contactName: string;
  contactRole: 'student' | 'teacher';
  lastMessage: string;
  lastMessageTime: string;
  messages: DirectMessageItem[];
}

function formatRealChatTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje às ${timeStr}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timeStr}`;
}

export default function ParentDashboard({ email, onLogout }: ParentDashboardProps) {
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Dropdown selector state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tab navigation: 'metricas' | 'simulados' | 'conversas_pessoas' | 'chat_ia' | 'vincular'
  const [activeTab, setActiveTab] = useState<'metricas' | 'simulados' | 'conversas_pessoas' | 'chat_ia' | 'vincular'>('metricas');

  // Linking code form state
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  // Onboarding modal state (shown on first access)
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(() => {
    try {
      const cleanEmail = email.toLowerCase().trim();
      return localStorage.getItem(`wsm_parent_onboarding_dismissed_${cleanEmail}`) !== 'true';
    } catch {
      return true;
    }
  });

  // Mascot blink cycle
  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const step1OpenLong = () => {
      setIsBlinking(false);
      timer = setTimeout(step2CloseFirst, 3000);
    };
    const step2CloseFirst = () => {
      setIsBlinking(true);
      timer = setTimeout(step3OpenShort, 200);
    };
    const step3OpenShort = () => {
      setIsBlinking(false);
      timer = setTimeout(step4CloseSecond, 1000);
    };
    const step4CloseSecond = () => {
      setIsBlinking(true);
      timer = setTimeout(step1OpenLong, 200);
    };
    step1OpenLong();
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch linked students
  const loadStudents = async () => {
    if (!email) return;
    setLoadingStudents(true);
    try {
      const students = await fetchParentLinkedStudents(email);
      setLinkedStudents(students);
      if (students.length > 0 && selectedStudentIndex >= students.length) {
        setSelectedStudentIndex(0);
      }
    } catch (err) {
      console.warn('Erro ao carregar estudantes vinculados:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [email]);

  const currentStudent = linkedStudents[selectedStudentIndex] || null;

  // Handle linking code submission
  const handleLinkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);

    const cleanCode = linkCodeInput.trim().toUpperCase();
    if (cleanCode.length !== 4) {
      setLinkError('O código de vínculo deve conter exatamente 4 dígitos.');
      return;
    }

    setLinkingLoading(true);
    try {
      const res = await linkParentWithCode(email, cleanCode);
      if (!res.success) {
        setLinkError(res.error || 'Código inválido ou expirado.');
      } else {
        setLinkSuccess(`🎉 Vínculo realizado com sucesso com ${res.studentName || 'seu filho(a)'}!`);
        setLinkCodeInput('');
        await loadStudents();
        setActiveTab('metricas');
      }
    } catch (err: any) {
      setLinkError('Erro ao processar vínculo. Tente novamente.');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleDismissOnboarding = () => {
    setShowOnboardingModal(false);
    try {
      const cleanEmail = email.toLowerCase().trim();
      localStorage.setItem(`wsm_parent_onboarding_dismissed_${cleanEmail}`, 'true');
    } catch {}
  };

  // =========================================================================
  // REAL STUDENT DATA (Exact same real metrics that appear for the student)
  // =========================================================================
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([]);
  const [studentMockExams, setStudentMockExams] = useState<any[]>([]);
  const [studentOpenTime, setStudentOpenTime] = useState<number>(0);
  const [studentActiveTime, setStudentActiveTime] = useState<number>(0);
  const [loadingStudentData, setLoadingStudentData] = useState(false);

  useEffect(() => {
    if (!currentStudent?.email) return;
    const cleanStudentEmail = currentStudent.email.toLowerCase().trim();

    const fetchRealStudentData = async () => {
      setLoadingStudentData(true);
      try {
        // 1. Real submissions
        const { data: subs } = await supabase
          .from('wsm_mock_submissions')
          .select('*')
          .eq('student_email', cleanStudentEmail)
          .order('submitted_at', { ascending: false });

        setStudentSubmissions(subs || []);

        // 2. Real exams
        const { data: mocks } = await supabase
          .from('wsm_mock_exams')
          .select('*')
          .order('created_at', { ascending: false });

        setStudentMockExams(mocks || []);

        // 3. Real tracked platform time (open & active physical time)
        const { data: analyticsData } = await supabase
          .from("wsm_student_analytics")
          .select("*")
          .eq("student_email", cleanStudentEmail)
          .maybeSingle();

        const dbOpen = analyticsData?.hourly_distribution?.tempo_plataforma_aberta_s || 0;
        const dbActive = analyticsData?.hourly_distribution?.tempo_ativo_mexendo_s || 0;
        const localOpen = parseInt(localStorage.getItem(`wsm_time_open_${cleanStudentEmail}`) || '0', 10);
        const localActive = parseInt(localStorage.getItem(`wsm_time_active_${cleanStudentEmail}`) || '0', 10);

        setStudentOpenTime(Math.max(dbOpen, localOpen));
        setStudentActiveTime(Math.max(dbActive, localActive));
      } catch (err) {
        console.warn('Erro ao carregar métricas reais do aluno:', err);
      } finally {
        setLoadingStudentData(false);
      }
    };

    fetchRealStudentData();
  }, [currentStudent?.email]);

  // =========================================================================
  // REAL CONVERSATIONS WITH OTHER PEOPLE (Teachers and Classmates)
  // Strictly authentic data: NO fake messages.
  // =========================================================================
  const [personConversations, setPersonConversations] = useState<PersonConversation[]>([]);
  const [selectedContactEmail, setSelectedContactEmail] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [searchPersonQuery, setSearchPersonQuery] = useState('');

  useEffect(() => {
    if (!currentStudent?.email) return;
    const sEmail = currentStudent.email.toLowerCase().trim();

    const loadRealConversations = async () => {
      setLoadingConversations(true);
      try {
        const rawMsgs: DirectMessageItem[] = [];

        // 1. Try direct_messages table
        try {
          const res1 = await supabase
            .from('direct_messages')
            .select('*')
            .or(`sender_email.ilike.${sEmail},receiver_email.ilike.${sEmail}`)
            .order('created_at', { ascending: true });

          if (res1.data && res1.data.length > 0) {
            rawMsgs.push(...res1.data);
          }
        } catch (e1) {
          console.warn('Fallback direct_messages query:', e1);
        }

        // 2. Try wsm_direct_messages table
        try {
          const res2 = await supabase
            .from('wsm_direct_messages')
            .select('*')
            .or(`sender_email.ilike.${sEmail},receiver_email.ilike.${sEmail}`)
            .order('created_at', { ascending: true });

          if (res2.data && res2.data.length > 0) {
            rawMsgs.push(...res2.data);
          }
        } catch (e2) {
          console.warn('Fallback wsm_direct_messages query:', e2);
        }

        // 3. Fallback: inspect any local storage chat keys involving this student
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('athenas_chat_') && key.includes(sEmail)) {
              const val = localStorage.getItem(key);
              if (val) {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  rawMsgs.push(...parsed);
                }
              }
            }
          }
        } catch {}

        // Deduplicate messages by id or (sender + receiver + created_at)
        const seenKeys = new Set<string>();
        const uniqueList: DirectMessageItem[] = [];
        rawMsgs.forEach(m => {
          const k = m.id || `${m.sender_email}_${m.receiver_email}_${m.created_at}_${m.content}`;
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            uniqueList.push(m);
          }
        });

        // Sort chronologically
        uniqueList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Group by the other participant
        const convMap = new Map<string, PersonConversation>();

        uniqueList.forEach(msg => {
          const senderLower = (msg.sender_email || '').toLowerCase().trim();
          const receiverLower = (msg.receiver_email || '').toLowerCase().trim();
          const isSender = senderLower === sEmail;
          const otherEmail = isSender ? receiverLower : senderLower;

          if (!otherEmail || otherEmail === sEmail) return;

          const otherName = isSender 
            ? (msg.receiver_name || otherEmail) 
            : (msg.sender_name || otherEmail);
          const otherRole = (isSender ? msg.receiver_role : msg.sender_role) || 'student';

          if (!convMap.has(otherEmail)) {
            convMap.set(otherEmail, {
              contactEmail: otherEmail,
              contactName: otherName,
              contactRole: otherRole as 'student' | 'teacher',
              lastMessage: '',
              lastMessageTime: '',
              messages: []
            });
          }

          const conv = convMap.get(otherEmail)!;
          conv.messages.push(msg);
          conv.lastMessage = msg.content || (msg.attachment_name ? `📎 ${msg.attachment_name}` : 'Mensagem');
          conv.lastMessageTime = msg.created_at;
          if (otherName && otherName !== otherEmail) {
            conv.contactName = otherName;
          }
          if (otherRole) {
            conv.contactRole = otherRole as 'student' | 'teacher';
          }
        });

        // Order contacts by latest message timestamp descending
        const contactsArray = Array.from(convMap.values()).sort((a, b) => {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });

        setPersonConversations(contactsArray);
        if (contactsArray.length > 0) {
          setSelectedContactEmail(prev => {
            if (prev && contactsArray.some(c => c.contactEmail === prev)) return prev;
            return contactsArray[0].contactEmail;
          });
        } else {
          setSelectedContactEmail(null);
        }
      } catch (err) {
        console.warn('Erro ao carregar conversas do aluno com outras pessoas:', err);
      } finally {
        setLoadingConversations(false);
      }
    };

    loadRealConversations();
  }, [currentStudent?.email]);

  const activePersonConversation = useMemo(() => {
    if (!selectedContactEmail) return null;
    return personConversations.find(c => c.contactEmail === selectedContactEmail) || null;
  }, [personConversations, selectedContactEmail]);

  // =========================================================================
  // ATHENAS AI TUTOR CHAT SESSIONS & MESSAGES (Real queries to Athenas AI)
  // =========================================================================
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loadingChatSessions, setLoadingChatSessions] = useState(false);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [searchChatQuery, setSearchChatQuery] = useState('');
  const [expandedReasoningMap, setExpandedReasoningMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentStudent?.email && activeTab === 'chat_ia') {
      const fetchChatSessions = async () => {
        setLoadingChatSessions(true);
        try {
          const { data, error } = await supabase
            .from('wsm_chat_sessions')
            .select('*')
            .eq('user_email', currentStudent.email.toLowerCase().trim())
            .order('created_at', { ascending: false });

          if (error) throw error;
          setChatSessions(data || []);
          if (data && data.length > 0) {
            setSelectedSessionId(data[0].id);
          } else {
            setSelectedSessionId(null);
            setSessionMessages([]);
          }
        } catch (err) {
          console.warn('Erro ao carregar sessões de chat com IA:', err);
        } finally {
          setLoadingChatSessions(false);
        }
      };
      fetchChatSessions();
    }
  }, [currentStudent?.email, activeTab]);

  useEffect(() => {
    if (selectedSessionId && activeTab === 'chat_ia') {
      const fetchMessages = async () => {
        setLoadingChatMessages(true);
        try {
          const { data, error } = await supabase
            .from('wsm_chat_messages')
            .select('*')
            .eq('session_id', selectedSessionId)
            .order('created_at', { ascending: true });

          if (error) throw error;
          setSessionMessages(data || []);
        } catch (err) {
          console.warn('Erro ao carregar mensagens com IA:', err);
        } finally {
          setLoadingChatMessages(false);
        }
      };
      fetchMessages();
    }
  }, [selectedSessionId, activeTab]);

  // Helper to extract thinking time and reasoning
  const parseMessageContent = (rawText: string) => {
    let clean = rawText || '';
    let thinkingSeconds: number | undefined;
    let reasoning: string | undefined;

    const timeMatch = clean.match(/\[\[THINKING_TIME:([\d.]+)\]\]/);
    if (timeMatch) {
      const sec = parseFloat(timeMatch[1]);
      thinkingSeconds = isNaN(sec) ? undefined : sec;
      clean = clean.replace(/\[\[THINKING_TIME:[\d.]+\]\]/g, '').trim();
    }

    const reasoningMatch = clean.match(/\[\[REASONING_CONTENT:([\s\S]*?)\]\]/);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
      clean = clean.replace(/\[\[REASONING_CONTENT:[\s\S]*?\]\]/g, '').trim();
    } else {
      const thinkTagMatch = clean.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkTagMatch) {
        reasoning = thinkTagMatch[1].trim();
        clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
    }

    return { clean, thinkingSeconds, reasoning };
  };

  // If loading initially
  if (loadingStudents) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070908] text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#02c39a] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-400 font-mono tracking-wide">Carregando Portal dos Pais...</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: NO LINKED STUDENTS (Mandatory linking initial screen with tutorial)
  // Verde água design (#02c39a)
  // =========================================================================
  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-[#070908] text-white font-sans flex flex-col justify-between p-4 sm:p-6 md:p-8 relative selection:bg-[#02c39a] selection:text-neutral-950">
        {/* Header */}
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-3 px-5 border border-neutral-850 bg-neutral-900/60 backdrop-blur-xl rounded-2xl shadow-xl z-10">
          <div className="flex items-center gap-3">
            <img
              src={isBlinking ? LOGO_CLOSED : LOGO_OPEN}
              alt="Mascote WSM Athenas"
              className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(2,195,154,0.3)]"
            />
            <div>
              <span className="text-sm font-extrabold text-neutral-100 flex items-center gap-1.5 font-display">
                <span className="text-[#02c39a]">WSM</span> Athenas · Área dos Pais
              </span>
              <span className="text-[10px] text-neutral-400 block font-mono">Conectado como {email}</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-neutral-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </header>

        {/* Center Card with 4-digit input */}
        <div className="max-w-2xl mx-auto w-full my-auto py-8 space-y-6 z-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-3xl bg-neutral-900/90 border-2 border-[#02c39a]/40 backdrop-blur-2xl shadow-2xl space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#02c39a]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#02c39a]/10 border border-[#02c39a]/30 text-[#02c39a] text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[#02c39a]" />
                PRIMEIRO PASSO: VINCULAR CONTA DO FILHO
              </div>
              <h2 className="text-2xl font-extrabold text-neutral-100 tracking-tight font-display">
                Digite o Código de 4 Dígitos
              </h2>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                Para ter acesso às métricas verdadeiras, notas dos simulados e conversas do seu filho(a), solicite a ele(a) o código de 4 dígitos gerado na conta de aluno.
              </p>
            </div>

            <form onSubmit={handleLinkSubmit} className="space-y-4 max-w-sm mx-auto">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ex: 7K2M"
                  value={linkCodeInput}
                  onChange={(e) => {
                    setLinkCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    if (linkError) setLinkError(null);
                  }}
                  className="w-full px-4 py-3 bg-neutral-950 border-2 border-[#02c39a]/50 focus:border-[#02c39a] rounded-2xl text-center text-3xl font-mono font-black tracking-widest outline-none text-[#02c39a] placeholder-neutral-700 shadow-inner"
                />
              </div>

              {linkError && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{linkError}</span>
                </div>
              )}

              {linkSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{linkSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={linkingLoading || linkCodeInput.length !== 4}
                className="w-full py-3.5 bg-[#02c39a] hover:bg-[#02b18c] disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#02c39a]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {linkingLoading ? 'Verificando Código...' : 'Vincular Conta do Filho'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Instructions box */}
            <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
              <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 uppercase font-mono">
                <HelpCircle className="w-3.5 h-3.5 text-[#02c39a]" />
                Onde meu filho encontra esse código?
              </span>
              <ol className="text-xs text-neutral-400 space-y-1 list-decimal list-inside leading-relaxed">
                <li>Seu filho entra na conta de aluno dele no Athenas.</li>
                <li>Na barra superior ou em Perfil, clica em <strong>"Vincular Responsável"</strong>.</li>
                <li>O sistema gera um código de 4 dígitos válido por 10 minutos.</li>
                <li>Basta você digitar esse código no campo acima!</li>
              </ol>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="w-full max-w-4xl mx-auto py-3 text-center text-[11px] text-neutral-600 font-mono">
          WSM Athenas · Plataforma de Educação Inteligente & Acompanhamento Familiar
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW: FULL PARENT DASHBOARD (At least 1 student linked)
  // Clean Verde Água styling (#02c39a) + Dropdown Selector + Real Data + Real Chats
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#070908] text-white font-sans flex flex-col selection:bg-[#02c39a] selection:text-neutral-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full border-b border-neutral-850/80 bg-neutral-950/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo & Portal title */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={isBlinking ? LOGO_CLOSED : LOGO_OPEN}
              alt="Mascote WSM Athenas"
              className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(2,195,154,0.3)]"
            />
            <div>
              <span className="text-sm font-extrabold text-neutral-100 flex items-center gap-1.5 font-display">
                <span className="text-[#02c39a]">WSM</span> Athenas · Portal dos Pais
              </span>
              <span className="text-[10px] text-neutral-400 block font-mono">Responsável: {email}</span>
            </div>
          </div>

          {/* Child Switcher (Interactive Dropdown Selector - Click to open list) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 px-3 sm:px-4 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-[#02c39a]/35 text-neutral-100 text-xs font-semibold transition-all shadow-sm cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-[#02c39a]/15 text-[#02c39a] flex items-center justify-center font-bold text-xs shrink-0">
                {currentStudent?.name.charAt(0) || <GraduationCap className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left max-w-[140px] sm:max-w-[200px]">
                <span className="block text-xs font-bold text-neutral-100 group-hover:text-[#02c39a] transition-colors truncate">
                  {currentStudent?.name || 'Selecione o filho'}
                </span>
                <span className="block text-[10px] text-neutral-400 font-mono truncate">
                  {currentStudent?.turma} {currentStudent?.numero_chamada ? `· Nº ${currentStudent.numero_chamada}` : ''}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 group-hover:text-[#02c39a] transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-[#02c39a]' : ''}`} />
            </button>

            {/* Dropdown Popover Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 sm:left-0 mt-2 w-72 rounded-2xl bg-neutral-900/95 border border-[#02c39a]/30 shadow-2xl backdrop-blur-xl z-50 p-2 space-y-1 overflow-hidden"
                >
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800 flex items-center justify-between">
                    <span>Filhos Vinculados</span>
                    <span className="text-[#02c39a] font-bold">{linkedStudents.length}</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar py-1">
                    {linkedStudents.map((stud, idx) => {
                      const isSelected = selectedStudentIndex === idx;
                      return (
                        <button
                          key={stud.linkId}
                          type="button"
                          onClick={() => {
                            setSelectedStudentIndex(idx);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#02c39a]/15 text-[#02c39a] font-bold border border-[#02c39a]/35'
                              : 'hover:bg-neutral-800/70 text-neutral-200 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected ? 'bg-[#02c39a] text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                            }`}>
                              {stud.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{stud.name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono truncate">
                                Turma: {stud.turma} {stud.numero_chamada ? `· Nº ${stud.numero_chamada}` : ''}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#02c39a] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('vincular');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#02c39a] hover:bg-[#02c39a]/10 font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Vincular outro filho(a)</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-neutral-850 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

        {/* Tab Navigation Bar (Verde Água design) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 border-t border-neutral-900 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('metricas')}
            className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'metricas'
                ? 'border-[#02c39a] text-[#02c39a]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#02c39a]" />
            <span>Métricas & Progresso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulados')}
            className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'simulados'
                ? 'border-[#02c39a] text-[#02c39a]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-[#02c39a]" />
            <span>Notas & Simulados</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conversas_pessoas')}
            className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'conversas_pessoas'
                ? 'border-[#02c39a] text-[#02c39a]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#02c39a]" />
            <span>Conversas Escolares</span>
            {personConversations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#02c39a]/20 text-[#02c39a] text-[10px] font-mono font-bold">
                {personConversations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat_ia')}
            className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'chat_ia'
                ? 'border-[#02c39a] text-[#02c39a]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Bot className="w-4 h-4 text-teal-400" />
            <span>Tutora Athenas AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vincular')}
            className={`py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'vincular'
                ? 'border-[#02c39a] text-[#02c39a]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Key className="w-4 h-4 text-[#02c39a]" />
            <span>Vincular Outro Filho</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* =========================================================
            TAB 1: MÉTRICAS & PROGRESSO (StudentProgress Integration)
            Showing 100% REAL data matching what the student views
           ========================================================= */}
        {activeTab === 'metricas' && currentStudent && (
          <div className="space-y-4 animate-fadeIn">
            {/* Student Header Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#02c39a]/15 border border-[#02c39a]/30 text-[#02c39a] flex items-center justify-center font-bold font-mono text-base">
                  {currentStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">{currentStudent.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                    <span>Turma: <strong className="text-neutral-200 font-mono">{currentStudent.turma}</strong></span>
                    {currentStudent.numero_chamada && (
                      <>
                        <span>•</span>
                        <span>Nº Chamada: <strong className="text-neutral-200 font-mono">{currentStudent.numero_chamada}</strong></span>
                      </>
                    )}
                    {currentStudent.escola && (
                      <>
                        <span>•</span>
                        <span>{currentStudent.escola}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-950/60 border border-neutral-800 px-3 py-1.5 rounded-xl font-mono">
                <ShieldCheck className="w-4 h-4 text-[#02c39a]" />
                <span>Dados reais sincronizados da conta do aluno</span>
              </div>
            </div>

            {/* Embedded StudentProgress with REAL submissions, exams, and platform telemetry */}
            <div className="pt-2">
              <StudentProgress
                userEmail={currentStudent.email}
                userName={currentStudent.name}
                userTurma={currentStudent.turma}
                submissions={studentSubmissions}
                mockExams={studentMockExams}
                openTimeSeconds={studentOpenTime}
                activeTimeSeconds={studentActiveTime}
              />
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: NOTAS & SIMULADOS
           ========================================================= */}
        {activeTab === 'simulados' && currentStudent && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-neutral-900 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-neutral-100 font-display">Histórico de Simulados e Notas</h2>
                <p className="text-neutral-400 text-xs mt-1">
                  Acompanhe todas as avaliações respondidas por <strong>{currentStudent.name}</strong> na plataforma.
                </p>
              </div>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-850 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Total de Envios: <strong className="text-[#02c39a] font-bold">{studentSubmissions.length}</strong>
              </span>
            </div>

            {loadingStudentData ? (
              <div className="py-12 text-center text-xs text-neutral-500 font-mono animate-pulse">
                Carregando histórico de notas e simulados...
              </div>
            ) : studentSubmissions.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-neutral-900/30 border border-dashed border-neutral-850 max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto text-neutral-500">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-300">Nenhum simulado respondido ainda</h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Assim que o aluno responder aos simulados propostos pelos professores, todas as notas, acertos e comentários pedagógicos aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {studentSubmissions.map((sub: any) => {
                  const exam = studentMockExams.find(m => m.id === sub.mock_exam_id);
                  const examTitle = sub.mock_exam_title || exam?.title || 'Simulado Acadêmico';
                  const subject = exam?.subject || 'Geral';
                  const score = typeof sub.score === 'number' ? sub.score.toFixed(1) : sub.score;
                  const correctCount = sub.correct_count ?? 0;
                  const totalQuestions = sub.total_questions ?? 0;
                  const submittedDate = sub.submitted_at || sub.created_at;

                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-850 hover:border-[#02c39a]/40 transition-all space-y-4 shadow-lg flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-[#02c39a] font-bold">
                            {subject}
                          </span>
                          <span>{submittedDate ? new Date(submittedDate).toLocaleDateString('pt-BR') : ''}</span>
                        </div>

                        <h4 className="text-sm font-bold text-neutral-100 line-clamp-2">
                          {examTitle}
                        </h4>
                      </div>

                      <div className="pt-3 border-t border-neutral-800/80 grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-850 text-center">
                          <span className="text-[10px] uppercase font-mono text-neutral-450 block font-bold">Nota Final</span>
                          <span className="text-xl font-black font-mono text-[#02c39a]">{score ?? '—'}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-850 text-center">
                          <span className="text-[10px] uppercase font-mono text-neutral-450 block font-bold">Acertos</span>
                          <span className="text-sm font-black font-mono text-neutral-200 mt-0.5 block">
                            {correctCount} / {totalQuestions}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: CONVERSAS COM OUTRAS PESSOAS (Professores e Colegas)
            100% REAL conversations. Strictly NO fake/mock data.
           ========================================================= */}
        {activeTab === 'conversas_pessoas' && currentStudent && (
          <div className="space-y-4 animate-fadeIn">
            {/* Visual Header Banner for Parent */}
            <div className="p-3.5 rounded-2xl bg-[#02c39a]/10 border border-[#02c39a]/25 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#02c39a]/20 text-[#02c39a]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-[#02c39a] block">
                    Conversas Escolares do(a) Aluno(a) (Professores e Colegas)
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    Histórico 100% autêntico das mensagens trocadas por {currentStudent.name} com professores e colegas no chat oficial do Athenas.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-[#02c39a]/20 text-[#02c39a] px-2 py-1 rounded-md shrink-0 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Conversas Reais
              </span>
            </div>

            {/* Chat Layout: Contacts List Sidebar + Messages Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[650px] rounded-3xl overflow-hidden border border-neutral-850 bg-neutral-950">
              {/* Sidebar with Contacts */}
              <div className="lg:col-span-1 border-r border-neutral-850 p-3 flex flex-col justify-between bg-neutral-900/60 overflow-hidden">
                <div className="space-y-2.5 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-neutral-300 uppercase font-mono tracking-wider">
                      Conversas ({personConversations.length})
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou email..."
                      value={searchPersonQuery}
                      onChange={(e) => setSearchPersonQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-[#02c39a]/50"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {loadingConversations ? (
                      <div className="p-4 text-center text-xs text-neutral-500 font-mono animate-pulse">
                        Carregando conversas do aluno...
                      </div>
                    ) : personConversations.length === 0 ? (
                      <div className="p-6 text-center text-neutral-500 space-y-2">
                        <MessageCircle className="w-8 h-8 text-neutral-600 mx-auto" />
                        <p className="text-xs font-medium text-neutral-400">Nenhuma conversa registrada ainda</p>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                          O aluno ainda não trocou mensagens com professores ou colegas. Nenhuma conversa falsa ou simulada é exibida.
                        </p>
                      </div>
                    ) : (
                      personConversations
                        .filter(c => 
                          !searchPersonQuery || 
                          c.contactName.toLowerCase().includes(searchPersonQuery.toLowerCase()) || 
                          c.contactEmail.toLowerCase().includes(searchPersonQuery.toLowerCase())
                        )
                        .map(c => {
                          const isSelected = selectedContactEmail === c.contactEmail;
                          const isTeacher = c.contactRole === 'teacher';
                          return (
                            <button
                              key={c.contactEmail}
                              type="button"
                              onClick={() => setSelectedContactEmail(c.contactEmail)}
                              className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#02c39a]/15 border border-[#02c39a]/40 text-[#02c39a] font-bold shadow-sm'
                                  : 'bg-neutral-950/40 hover:bg-neutral-950 border border-neutral-850 text-neutral-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected 
                                    ? 'bg-[#02c39a] text-neutral-950' 
                                    : isTeacher 
                                      ? 'bg-teal-500/20 text-teal-300' 
                                      : 'bg-neutral-800 text-neutral-300'
                                }`}>
                                  {c.contactName.charAt(0)}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-xs font-medium text-neutral-100">{c.contactName}</p>
                                    <span className={`text-[9px] font-mono px-1 rounded ${
                                      isTeacher 
                                        ? 'bg-teal-500/20 text-teal-300' 
                                        : 'bg-neutral-800 text-neutral-400'
                                    }`}>
                                      {isTeacher ? 'Prof' : 'Aluno'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                    {c.lastMessage}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Messages View Area */}
              <div className="lg:col-span-3 flex flex-col justify-between bg-neutral-950/70 p-4 overflow-hidden relative">
                {activePersonConversation ? (
                  <>
                    {/* Header of Active Conversation */}
                    <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3 mb-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#02c39a]/15 text-[#02c39a] font-bold text-sm flex items-center justify-center">
                          {activePersonConversation.contactName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                            <span>{activePersonConversation.contactName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                              {activePersonConversation.contactRole === 'teacher' ? 'Professor(a)' : 'Aluno(a) / Colega'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            {activePersonConversation.contactEmail}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 px-2 py-1 rounded-lg">
                        {activePersonConversation.messages.length} mensagens trocadas
                      </span>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
                      {activePersonConversation.messages.map((msg) => {
                        const isStudentSender = (msg.sender_email || '').toLowerCase().trim() === currentStudent.email.toLowerCase().trim();

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isStudentSender ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                          >
                            <div className={`max-w-lg rounded-2xl p-3.5 space-y-1.5 text-xs shadow-md select-text ${
                              isStudentSender
                                ? 'bg-[#0b3b32] text-emerald-50 border border-[#02c39a]/35 rounded-tr-sm'
                                : 'bg-neutral-900 text-neutral-200 border border-neutral-800 rounded-tl-sm'
                            }`}>
                              {/* Sender Identification */}
                              <div className="flex items-center justify-between gap-3 text-[10px] font-mono pb-1 border-b border-white/10">
                                <span className={isStudentSender ? 'text-[#02c39a] font-bold' : 'text-neutral-400 font-bold'}>
                                  {isStudentSender ? `${currentStudent.name} (Seu filho)` : activePersonConversation.contactName}
                                </span>
                                <span className="text-neutral-400 text-[10px]">
                                  {formatRealChatTime(msg.created_at)}
                                </span>
                              </div>

                              {/* Content */}
                              {msg.content && (
                                <p className="text-sm whitespace-pre-wrap leading-relaxed text-neutral-100">
                                  {msg.content}
                                </p>
                              )}

                              {/* Attachments if present */}
                              {msg.attachment_url && (
                                <div className="pt-1.5">
                                  <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-xl bg-neutral-950/60 border border-white/10 hover:border-[#02c39a]/40 text-neutral-300 hover:text-white transition-all text-xs"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 text-[#02c39a]" />
                                    <span className="truncate max-w-[200px]">{msg.attachment_name || 'Anexo'}</span>
                                    <Download className="w-3 h-3 text-neutral-400 ml-auto" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Status bar */}
                    <div className="pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-500 font-mono mt-2">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#02c39a]" />
                        Modo Leitura Parental · Histórico Autêntico
                      </span>
                      <span>Atualizado em tempo real</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-bold text-neutral-300">
                        {personConversations.length === 0 ? 'Sem conversas no momento' : 'Selecione uma conversa'}
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-sm mt-1">
                        {personConversations.length === 0
                          ? 'Quando seu filho trocar mensagens com professores ou colegas no chat da escola, a conversa aparecerá aqui para você acompanhar.'
                          : 'Clique em um dos contatos na lista ao lado para ler o histórico completo de mensagens.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: CHAT DA IA ATHENAS (Fiel, visual replica)
           ========================================================= */}
        {activeTab === 'chat_ia' && currentStudent && (
          <div className="space-y-4 animate-fadeIn">
            {/* Visual Header Banner for Parent */}
            <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-teal-300 block">
                    Visualização em Primeira Mão das Dúvidas do Aluno com a Tutora IA
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    Aqui você visualiza as perguntas que {currentStudent.name} fez à tutora Athenas AI e as explicações completas geradas pela inteligência artificial.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-teal-500/20 text-teal-300 px-2 py-1 rounded-md shrink-0 font-bold">
                Modo Leitura Fiel
              </span>
            </div>

            {/* Chat Layout with Sessions Sidebar + Messages Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[650px] rounded-3xl overflow-hidden border border-neutral-850 bg-neutral-950">
              {/* Sidebar with Sessions */}
              <div className="lg:col-span-1 border-r border-neutral-850 p-3 flex flex-col justify-between bg-neutral-900/60 overflow-hidden">
                <div className="space-y-2.5 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-neutral-300 uppercase font-mono tracking-wider">
                      Sessões IA ({chatSessions.length})
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por assunto..."
                      value={searchChatQuery}
                      onChange={(e) => setSearchChatQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-teal-500/40"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {loadingChatSessions ? (
                      <div className="p-4 text-center text-xs text-neutral-500 font-mono animate-pulse">
                        Carregando conversas...
                      </div>
                    ) : chatSessions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-neutral-500">
                        Nenhuma conversa com a tutora IA registrada ainda.
                      </div>
                    ) : (
                      chatSessions
                        .filter(s => !searchChatQuery || (s.title || '').toLowerCase().includes(searchChatQuery.toLowerCase()))
                        .map(sess => (
                          <button
                            key={sess.id}
                            type="button"
                            onClick={() => setSelectedSessionId(sess.id)}
                            className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              selectedSessionId === sess.id
                                ? 'bg-teal-500/15 border border-teal-500/40 text-teal-200 font-bold shadow-sm'
                                : 'bg-neutral-950/40 hover:bg-neutral-950 border border-neutral-850 text-neutral-300'
                            }`}
                          >
                            <div className="truncate">
                              <p className="truncate text-xs font-medium">{sess.title || 'Conversa sem título'}</p>
                              <p className="text-[10px] text-neutral-500 font-mono">
                                {new Date(sess.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Messages View Area */}
              <div className="lg:col-span-3 flex flex-col justify-between bg-neutral-950/70 p-4 overflow-hidden relative">
                {/* Active Session Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {loadingChatMessages ? (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-500 font-mono animate-pulse">
                      Carregando mensagens da conversa...
                    </div>
                  ) : !selectedSessionId ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
                      <MessageSquare className="w-8 h-8 text-neutral-600" />
                      <p className="text-xs">Selecione uma sessão ao lado para visualizar</p>
                    </div>
                  ) : sessionMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
                      <Bot className="w-8 h-8 text-neutral-600" />
                      <p className="text-xs">Esta conversa está vazia</p>
                    </div>
                  ) : (
                    sessionMessages.map((msg) => {
                      const isAssistant = msg.role === 'assistant';
                      const { clean, thinkingSeconds, reasoning } = parseMessageContent(msg.content);
                      const isExpanded = Boolean(expandedReasoningMap[msg.id]);

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-fadeIn`}
                        >
                          <div className={`max-w-2xl ${isAssistant ? 'w-full' : 'max-w-lg'}`}>
                            {isAssistant ? (
                              <div className="space-y-2">
                                {/* Mascot Header with Thinking Badge */}
                                <div className="flex items-center gap-2">
                                  <img
                                    src={isBlinking ? LOGO_CLOSED : LOGO_OPEN}
                                    alt="Athenas AI"
                                    className="w-6 h-6 object-contain"
                                  />
                                  <span className="text-xs font-bold text-teal-400 font-display">Athenas AI</span>
                                  {thinkingSeconds !== undefined && (
                                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                                      Pensou por <strong className="text-teal-400">{thinkingSeconds.toFixed(1)}s</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Reasoning Dropdown (if present) */}
                                {reasoning && (
                                  <div className="pl-8">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedReasoningMap(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                      className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                                    >
                                      <span>{isExpanded ? 'Ocultar raciocínio da IA' : 'Ver raciocínio da IA'}</span>
                                      {isExpanded ? <ChevronDown className="w-3 h-3 text-teal-400" /> : <ChevronRight className="w-3 h-3 text-neutral-500" />}
                                    </button>

                                    {isExpanded && (
                                      <div className="mt-2 p-3 bg-neutral-900/80 border border-teal-500/25 rounded-xl text-xs text-neutral-300 leading-relaxed font-sans">
                                        <AthenasMarkdownRenderer content={reasoning} />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Main Assistant Response Bubble */}
                                <div className="pl-8 text-neutral-200 text-sm leading-relaxed select-text">
                                  <AthenasMarkdownRenderer content={clean} />
                                </div>
                              </div>
                            ) : (
                              /* Student Message Bubble (right-aligned) */
                              <div className="bg-[#1b4332]/90 text-emerald-50 border border-teal-500/25 px-4 py-3 rounded-2xl rounded-tr-md shadow-md select-text">
                                <p className="text-xs text-teal-300/80 font-mono mb-1 font-bold">
                                  {currentStudent.name} (Aluno):
                                </p>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{clean}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Read-only footer indicator */}
                <div className="pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                  <span>Sessão do aluno visualizada em modo somente leitura</span>
                  <span>{sessionMessages.length} mensagens nesta conversa</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: VINCULAR OUTRO FILHO (No limit for parents)
           ========================================================= */}
        {activeTab === 'vincular' && (
          <div className="max-w-xl mx-auto space-y-6 animate-fadeIn py-4">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#02c39a]/10 border border-[#02c39a]/30 text-[#02c39a] text-xs font-bold font-mono">
                <Users className="w-3.5 h-3.5 text-[#02c39a]" />
                VÍNCULO MULTI-FILHOS
              </div>
              <h2 className="text-2xl font-extrabold text-neutral-100 font-display">
                Vincular Outro Filho(a)
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Você pode conectar quantos filhos desejar na sua conta de responsável, sem qualquer limite!
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/90 border border-[#02c39a]/30 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono text-center">
                Código de 4 Dígitos do seu outro filho(a):
              </label>

              <form onSubmit={handleLinkSubmit} className="space-y-4">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ex: 8X2A"
                  value={linkCodeInput}
                  onChange={(e) => {
                    setLinkCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    if (linkError) setLinkError(null);
                  }}
                  className="w-full px-4 py-3 bg-neutral-950 border-2 border-[#02c39a]/50 focus:border-[#02c39a] rounded-2xl text-center text-2xl font-mono font-black tracking-widest outline-none text-[#02c39a] placeholder-neutral-700 shadow-inner"
                />

                {linkError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{linkError}</span>
                  </div>
                )}

                {linkSuccess && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{linkSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={linkingLoading || linkCodeInput.length !== 4}
                  className="w-full py-3 bg-[#02c39a] hover:bg-[#02b18c] disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-[#02c39a]/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {linkingLoading ? 'Verificando...' : 'Conectar Novo Filho'}
                </button>
              </form>
            </div>

            {/* List of currently linked children with option to remove */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">
                Filhos Atualmente Conectados ({linkedStudents.length})
              </h4>

              <div className="space-y-2">
                {linkedStudents.map((stud) => (
                  <div
                    key={stud.linkId}
                    className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-850 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#02c39a]/15 border border-[#02c39a]/30 text-[#02c39a] flex items-center justify-center font-bold font-mono">
                        {stud.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-200">{stud.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          Turma: {stud.turma} • {stud.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Deseja remover o vínculo com ${stud.name}?`)) {
                          await removeStudentParentLink(stud.linkId);
                          await loadStudents();
                        }
                      }}
                      className="px-2.5 py-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
