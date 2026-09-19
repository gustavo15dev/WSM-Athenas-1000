/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Users,
  UserCheck,
  GraduationCap,
  FileCode,
  FileText,
  Trash2,
  Edit2,
  Plus,
  Search,
  Database,
  ArrowLeft,
  X,
  AlertTriangle,
  RefreshCw,
  Bell,
  Terminal,
  Activity,
  CheckCircle,
  HelpCircle,
  Clock,
  Laptop,
  Sliders,
  MessageSquare,
  Settings,
  AlertCircle,
  Lock,
  Mail,
  UserPlus,
  Eye,
  EyeOff,
  Zap,
  TrendingUp,
  Upload,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Download
} from 'lucide-react';
import { supabase } from '../supabase';
import { logSystemAction } from '../utils/auditLogger';
import AdminGeneralAnalytics from './AdminGeneralAnalytics';

function normalizeTurmaToken(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª\-_.\s]+/g, '')
    .trim();
}

function areTurmasMatching(t1: string | null | undefined, t2: string | null | undefined): boolean {
  if (!t1 || !t2) return false;
  const n1 = normalizeTurmaToken(t1);
  const n2 = normalizeTurmaToken(t2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const extractCohort = (str: string) => {
    const match = str.match(/([0-9]+[a-z]?)/i);
    return match ? match[1].toLowerCase() : null;
  };
  const c1 = extractCohort(n1);
  const c2 = extractCohort(n2);
  if (c1 && c2 && c1 === c2) return true;

  return false;
}

interface AdminPortalProps {
  onBack: () => void;
  adminEmail: string;
}

export default function AdminPortal({ onBack, adminEmail }: AdminPortalProps) {
  // Navigation tabs: 'stats' | 'users' | 'exams' | 'announcements' | 'chats' | 'settings' | 'logs' | 'danger'
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'exams' | 'announcements' | 'chats' | 'settings' | 'logs' | 'danger'>('stats');

  // Loaders and alerts
  const [loading, setLoading] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<{ type: 'success' | 'error' | 'warning' | null; message: string }>({ type: null, message: '' });

  // DB datasets
  const [users, setUsers] = useState<any[]>([]);
  const [mockExams, setMockExams] = useState<any[]>([]);
  const [mockSubmissions, setMockSubmissions] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // New Chat Sessions supervision state
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [selectedChatSession, setSelectedChatSession] = useState<any | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<any[]>([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);

  // New Announcements control form state
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnType, setNewAnnType] = useState<string>('geral');
  const [newAnnIcon, setNewAnnIcon] = useState<string>('bell');
  const [isPostingAnn, setIsPostingAnn] = useState(false);

  // New Global Settings parameters state
  const [passingGrade, setPassingGrade] = useState(() => {
    const v = localStorage.getItem('wsm_sys_passing_grade');
    return v ? parseFloat(v) : 6.0;
  });
  const [blockPosting, setBlockPosting] = useState(() => {
    return localStorage.getItem('wsm_sys_block_posting') === 'true';
  });
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('wsm_sys_maintenance_mode') === 'true';
  });

  // Search & Filter state
  const [userSearchText, setUserSearchText] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [userClassFilter, setUserClassFilter] = useState<string>('all');

  // Logs Search state
  const [logSearchText, setLogSearchText] = useState('');
  const [logSelectedRow, setLogSelectedRow] = useState<any | null>(null);

  // Form State Modals
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    nomeCompleto: '',
    role: 'student' as 'student' | 'teacher',
    turma: '' as string | null,
    numeroChamada: '',
    materia: '',
    anosLecionados: [] as string[],
    senhaPlana: '123456'
  });

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Grade Edit Forms
  const [editingSubmission, setEditingSubmission] = useState<any | null>(null);
  const [editingGradeValue, setEditingGradeValue] = useState<string>('');

  // Batch Onboarding & CSV System States
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchRawText, setBatchRawText] = useState('');
  const [batchParsedRows, setBatchParsedRows] = useState<Array<{
    id: string;
    nome: string;
    email: string;
    role: 'student' | 'teacher';
    turma: string;
    numeroChamada: number | null;
    materia: string;
    status: 'idle' | 'processing' | 'success' | 'error';
    errorMsg?: string;
  }>>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [batchBackoffSeconds, setBatchBackoffSeconds] = useState<number | null>(null);
  const isBatchCancelledRef = React.useRef(false);

  useEffect(() => {
    fetchEverything();
    // Log administrative portal entry
    logSystemAction({
      userEmail: adminEmail || 'admin-portal',
      userName: 'Administrador Mestre',
      role: 'admin',
      action: 'ADMIN_ACCESS',
      details: 'Acessou o painel de administração mestre via atalho secreto.'
    });
  }, []);

  const fetchEverything = async () => {
    setLoading(true);
    setGlobalStatus({ type: null, message: '' });
    try {
      // 1. Fetch user profiles
      const { data: profiles, error: pErr } = await supabase
        .from('wsm_user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (pErr) console.warn("Error fetching profiles:", pErr);
      if (profiles) setUsers(profiles);

      // 2. Fetch mock exams (simulados)
      const { data: mocks, error: moErr } = await supabase
        .from('wsm_mock_exams')
        .select('*')
        .order('created_at', { ascending: false });
      if (moErr) console.warn("Error fetching mock exams:", moErr);
      if (mocks) setMockExams(mocks);

      // 3. Fetch mock submissions (respostas dos simulados)
      const { data: subs, error: subErr } = await supabase
        .from('wsm_mock_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (subErr) console.warn("Error fetching submissions:", subErr);
      if (subs) setMockSubmissions(subs);

      // 4. Fetch regular exams
      const { data: physicalExams, error: exErr } = await supabase
        .from('wsm_exams')
        .select('*')
        .order('created_at', { ascending: false });
      if (exErr) console.warn("Error fetching exams:", exErr);
      if (physicalExams) setExams(physicalExams);

      // 5. Fetch announcements
      const { data: annData } = await supabase
        .from('wsm_announcements')
        .select('*');
      if (annData) setAnnouncements(annData);

      // 6. Fetch audit logs
      const { data: logs, error: lErr } = await supabase
        .from('wsm_system_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (lErr) console.warn("Error system logs table may need to be created:", lErr);
      if (logs) setSystemLogs(logs);

      // 7. Fetch active chat sessions
      const { data: chats, error: cErr } = await supabase
        .from('wsm_chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (cErr) console.warn("Error fetching chat sessions:", cErr);
      if (chats) setChatSessions(chats);

    } catch (err: any) {
      console.error("General fetch error:", err);
      setGlobalStatus({ type: 'error', message: `Erro ao integrar com o banco: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error' | 'warning', msg: string) => {
    setGlobalStatus({ type, message: msg });
    setTimeout(() => {
      setGlobalStatus({ type: null, message: '' });
    }, 4500);
  };

  // Create User Sequence
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const customEmail = newUserForm.email.trim().toLowerCase();
    
    try {
      // Form parameters checks
      if (!customEmail || !newUserForm.nomeCompleto) {
        throw new Error("E-mail e Nome Completo são obrigatórios.");
      }
      
      if (newUserForm.role === 'student' && newUserForm.turma && newUserForm.numeroChamada) {
        const isDuplicate = users.some(u => 
          u.role === 'student' && 
          u.turma === newUserForm.turma && 
          u.numero_chamada == parseInt(newUserForm.numeroChamada)
        );
        if (isDuplicate) {
          throw new Error(`Número de chamada ${newUserForm.numeroChamada} já está em uso na turma ${newUserForm.turma}.`);
        }
      }

      // 1. Generate user in auth-mock simulator or real auth.
      // Since admin client tools might not have service-role keys allowed to insert to auth.users,
      // we can provision the row in `wsm_user_profiles` directly so they can log in or bypass.
      // To bypass constraints, we can generate a unique UUID and set profile.
      // (If they sign up themselves with the same email, they connect to this pre-assigned profile!)
      const generatedId = crypto.randomUUID();

      const { error: profileErr } = await supabase
        .from('wsm_user_profiles')
        .insert({
          id: generatedId,
          email: customEmail,
          role: newUserForm.role,
          nome_completo: newUserForm.nomeCompleto.trim(),
          turma: newUserForm.role === 'student' ? newUserForm.turma : null,
          numero_chamada: newUserForm.role === 'student' ? (parseInt(newUserForm.numeroChamada) || 1) : null,
          anos_lecionados: newUserForm.role === 'teacher' ? newUserForm.anosLecionados : null,
          materia: newUserForm.role === 'teacher' ? (newUserForm.materia.trim() || 'Biologia') : null
        });

      if (profileErr) throw profileErr;

      // Log the creation
      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'CREATE_USER',
        details: `Criou novo perfil (${newUserForm.role}): ${newUserForm.nomeCompleto} <${customEmail}>`,
        metadata: { newUserForm }
      });

      showToast('success', `Perfil de ${newUserForm.nomeCompleto} cadastrado com sucesso!`);
      setIsCreatingUser(false);
      setNewUserForm({
        email: '',
        nomeCompleto: '',
        role: 'student',
        turma: '',
        numeroChamada: '',
        materia: '',
        anosLecionados: [],
        senhaPlana: '123456'
      });
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao criar perfil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // BATCH ONBOARDING & CSV IMPORT ENGINE
  // ==========================================
  const handleParseBatchInput = (rawText: string) => {
    setBatchRawText(rawText);
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBatchParsedRows([]);
      return;
    }

    const parsed: Array<{
      id: string;
      nome: string;
      email: string;
      role: 'student' | 'teacher';
      turma: string;
      numeroChamada: number | null;
      materia: string;
      status: 'idle' | 'processing' | 'success' | 'error';
      errorMsg?: string;
    }> = [];

    // Header detection
    const firstLineLower = lines[0].toLowerCase();
    const hasHeader = firstLineLower.includes('nome') || firstLineLower.includes('email') || firstLineLower.includes('cargo') || firstLineLower.includes('turma');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, idx) => {
      // Split by comma, semicolon, or tab
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim());
      } else if (line.includes(';')) {
        parts = line.split(';').map(p => p.trim());
      } else {
        // Basic CSV split ignoring commas inside quotes
        parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      }

      if (parts.length >= 2) {
        const nome = parts[0] || '';
        const email = (parts[1] || '').toLowerCase();
        let role: 'student' | 'teacher' = 'student';
        const rolePart = (parts[2] || '').toLowerCase();
        if (rolePart.includes('prof') || rolePart.includes('teach') || rolePart.includes('docente')) {
          role = 'teacher';
        }

        const turma = parts[3] || '';
        let numeroChamada: number | null = null;
        if (parts[4] && !isNaN(parseInt(parts[4], 10))) {
          numeroChamada = parseInt(parts[4], 10);
        }
        const materia = parts[5] || (role === 'teacher' ? 'Biologia' : '');

        parsed.push({
          id: `batch-${idx}-${Date.now()}`,
          nome,
          email,
          role,
          turma,
          numeroChamada,
          materia,
          status: 'idle'
        });
      }
    });

    setBatchParsedRows(parsed);
  };

  const handleStartBatchProcessing = async () => {
    if (batchParsedRows.length === 0) return;
    setIsProcessingBatch(true);
    isBatchCancelledRef.current = false;
    setBatchProgress({ current: 0, total: batchParsedRows.length, success: 0, failed: 0 });

    let currentSuccess = 0;
    let currentFailed = 0;

    for (let i = 0; i < batchParsedRows.length; i++) {
      if (isBatchCancelledRef.current) {
        showToast('warning', 'Processamento em lote interrompido pelo usuário.');
        break;
      }

      const row = batchParsedRows[i];
      if (row.status === 'success') {
        currentSuccess++;
        setBatchProgress(prev => ({ ...prev, current: i + 1, success: currentSuccess }));
        continue;
      }

      // Update row status to processing
      setBatchParsedRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing', errorMsg: undefined } : r));

      let retryCount = 0;
      let success = false;

      while (!success && retryCount < 3) {
        try {
          if (!row.email || !row.nome) {
            throw new Error('Nome e e-mail são obrigatórios.');
          }

          // Duplicate call check in current DB
          if (row.role === 'student' && row.turma && row.numeroChamada) {
            const { data: existingSameNumStudents } = await supabase
              .from('wsm_user_profiles')
              .select('id, nome_completo, email, turma, numero_chamada')
              .eq('role', 'student')
              .eq('numero_chamada', row.numeroChamada)
              .neq('email', row.email);

            const dupStudent = (existingSameNumStudents || []).find(st => 
              areTurmasMatching(st.turma, row.turma)
            );

            if (dupStudent) {
              throw new Error(`Chamada Nº ${row.numeroChamada} já ocupada por ${dupStudent.nome_completo || dupStudent.email} na turma ${row.turma}.`);
            }
          }

          // Upsert row safely
          const { error: upsertErr } = await supabase
            .from('wsm_user_profiles')
            .upsert({
              email: row.email.toLowerCase().trim(),
              role: row.role,
              nome_completo: row.nome.trim(),
              turma: row.role === 'student' ? row.turma : null,
              numero_chamada: row.role === 'student' ? row.numeroChamada : null,
              materia: row.role === 'teacher' ? (row.materia || 'Biologia') : null,
              anos_lecionados: row.role === 'teacher' ? (row.turma ? [row.turma] : []) : null
            }, { onConflict: 'email' });

          if (upsertErr) {
            throw upsertErr;
          }

          // If student has a turma, sync into virtual class if matching access code or name
          if (row.role === 'student' && row.turma) {
            try {
              const { data: vClasses } = await supabase
                .from('wsm_virtual_classes')
                .select('*');
              
              if (vClasses) {
                const targetVC = vClasses.find((vc: any) => vc.name === row.turma || vc.access_code === row.turma);
                if (targetVC) {
                  const existingEmails = Array.isArray(targetVC.student_emails) ? targetVC.student_emails : [];
                  const updated = Array.from(new Set([...existingEmails, row.email.toLowerCase().trim()]));
                  await supabase
                    .from('wsm_virtual_classes')
                    .update({ student_emails: updated })
                    .eq('id', targetVC.id);
                }
              }
            } catch (vSyncErr) {
              console.warn('Virtual class sync warning during batch:', vSyncErr);
            }
          }

          success = true;
          currentSuccess++;
          setBatchParsedRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
        } catch (err: any) {
          const errMsg = err.message || 'Erro desconhecido ao salvar.';
          const isRateLimit = errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');

          if (isRateLimit && retryCount < 2) {
            retryCount++;
            const backoffWait = 4 * retryCount;
            // Display countdown
            for (let sec = backoffWait; sec > 0; sec--) {
              if (isBatchCancelledRef.current) break;
              setBatchBackoffSeconds(sec);
              await new Promise(r => setTimeout(r, 1000));
            }
            setBatchBackoffSeconds(null);
            // Continue retry loop
          } else {
            // Failed definitively
            currentFailed++;
            setBatchParsedRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', errorMsg: errMsg } : r));
            break;
          }
        }
      }

      setBatchProgress({
        current: i + 1,
        total: batchParsedRows.length,
        success: currentSuccess,
        failed: currentFailed
      });

      // Small pacing delay between requests to avoid triggering provider burst rate limits
      await new Promise(r => setTimeout(r, 220));
    }

    setIsProcessingBatch(false);
    setBatchBackoffSeconds(null);
    await fetchEverything();
    showToast('success', `Importação concluída: ${currentSuccess} registros gravados com sucesso.`);
  };

  const handleCancelBatchProcessing = () => {
    isBatchCancelledRef.current = true;
    setIsProcessingBatch(false);
    setBatchBackoffSeconds(null);
  };

  const handleDownloadSampleCsv = () => {
    const sample = `Nome Completo,E-mail,Cargo,Turma,Numero Chamada,Materia
Ana Clara Silva,ana.silva@escola.com,student,9A,1,
Bernardo Costa,bernardo.costa@escola.com,student,9A,2,
Camila Oliveira,camila.oliveira@escola.com,student,9B,1,
Prof. Roberto Souza,roberto.bio@escola.com,teacher,9A, ,Biologia`;
    
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_athenas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle teacher's classes selection in form
  const handleToggleFormClass = (cls: string) => {
    setNewUserForm(prev => {
      const classes = [...prev.anosLecionados];
      if (classes.includes(cls)) {
        return { ...prev, anosLecionados: classes.filter(c => c !== cls) };
      } else {
        return { ...prev, anosLecionados: [...classes, cls] };
      }
    });
  };

  // Toggle teacher's classes selection in dynamic user editor
  const handleToggleEditClass = (cls: string) => {
    if (!editingUser) return;
    const currentClasses = editingUser.anos_lecionados || [];
    let nextClasses = [];
    if (currentClasses.includes(cls)) {
      nextClasses = currentClasses.filter((c: string) => c !== cls);
    } else {
      nextClasses = [...currentClasses, cls];
    }
    setEditingUser({ ...editingUser, anos_lecionados: nextClasses });
  };

  // Edit/Update user profile
  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);

    try {
      if (editingUser.role === 'student' && editingUser.turma && editingUser.numero_chamada) {
        const isDuplicate = users.some(u => 
          u.id !== editingUser.id &&
          u.role === 'student' && 
          u.turma === editingUser.turma && 
          u.numero_chamada == parseInt(editingUser.numero_chamada)
        );
        if (isDuplicate) {
          throw new Error(`Número de chamada ${editingUser.numero_chamada} já está em uso na turma ${editingUser.turma}.`);
        }
      }

      const { error: updErr } = await supabase
        .from('wsm_user_profiles')
        .update({
          email: editingUser.email.trim().toLowerCase(),
          nome_completo: editingUser.nome_completo,
          role: editingUser.role,
          turma: editingUser.role === 'student' ? editingUser.turma : null,
          numero_chamada: editingUser.role === 'student' ? (parseInt(editingUser.numero_chamada) || null) : null,
          anos_lecionados: editingUser.role === 'teacher' ? editingUser.anos_lecionados : null,
          materia: editingUser.role === 'teacher' ? editingUser.materia : null
        })
        .eq('id', editingUser.id);

      if (updErr) throw updErr;

      // Log the edition
      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'UPDATE_USER',
        details: `Atualizou perfil do usuário ID ${editingUser.id}: ${editingUser.nome_completo} (${editingUser.email})`,
        metadata: { updatedProfile: editingUser }
      });

      showToast('success', `Perfil de ${editingUser.nome_completo} atualizado!`);
      setEditingUser(null);
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao salvar edição: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Chat supervision and load messages
  const fetchChatMessages = async (session: any) => {
    setSelectedChatSession(session);
    setLoadingChatMessages(true);
    try {
      const { data, error } = await supabase
        .from('wsm_chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setSelectedChatMessages(data || []);
    } catch (err: any) {
      showToast('error', `Erro ao carregar mensagens: ${err.message}`);
    } finally {
      setLoadingChatMessages(false);
    }
  };

  const handleDeleteChatSession = async (sessionId: string) => {
    if (!window.confirm("Deseja realmente excluir esta sessão de chat e todo seu histórico de mensagens?")) return;
    try {
      const { error } = await supabase
        .from('wsm_chat_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
      showToast('success', "Sessão de chat e mensagens removidas do Supabase.");
      setSelectedChatSession(null);
      setSelectedChatMessages([]);
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Erro ao excluir chat: ${err.message}`);
    }
  };

  // NEW: Create and delete announcements
  const handleCreateAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) {
      showToast('error', "Título e conteúdo do comunicado são obrigatórios.");
      return;
    }
    setIsPostingAnn(true);
    try {
      const dbCategory = newAnnType === 'Importante' ? 'Urgent' : newAnnType === 'Atividades' ? 'Prova' : newAnnType === 'Eventos' ? 'Evento' : 'Geral';
      const { error } = await supabase
        .from('wsm_announcements')
        .insert([{
          title: newAnnTitle,
          content: newAnnContent,
          category: dbCategory,
          teacher_email: adminEmail || 'admin@athenas.com',
          teacher_name: 'Administração Geral',
          likes_count: 0,
          liked_by: [],
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;

      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'CREATE_ANNOUNCEMENT',
        details: `Criou novo comunicado institucional: "${newAnnTitle}"`
      });

      showToast('success', "Novo comunicado publicado com sucesso!");
      setNewAnnTitle('');
      setNewAnnContent('');
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Erro ao publicar comunicado: ${err.message}`);
    } finally {
      setIsPostingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string, titleStr: string) => {
    if (!window.confirm(`Excluir comunicado "${titleStr}"?`)) return;
    try {
      const { error } = await supabase
        .from('wsm_announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'DELETE_ANNOUNCEMENT',
        details: `Removeu o comunicado institucional ID ${id}: "${titleStr}"`
      });

      showToast('success', "Comunicado apagado do sistema.");
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Erro ao apagar comunicado: ${err.message}`);
    }
  };

  // NEW: Save system parameters settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wsm_sys_passing_grade', passingGrade.toString());
    localStorage.setItem('wsm_sys_block_posting', blockPosting ? 'true' : 'false');
    localStorage.setItem('wsm_sys_maintenance_mode', maintenanceMode ? 'true' : 'false');
    showToast('success', "Parâmetros globais atualizados e salvos com sucesso.");
    logSystemAction({
      userEmail: adminEmail,
      userName: 'Admin',
      role: 'admin',
      action: 'UPDATE_SYSTEM_SETTINGS',
      details: `Parâmetros atualizados: Média Mínima=${passingGrade}, Bloqueio Notas=${blockPosting}, Manutenção=${maintenanceMode}`
    });
  };

  // Delete User Row
  const handleDeleteUser = async (id: string, name: string, emailStr: string) => {
    if (!confirm(`TEM CERTEZA absoluta que deseja excluir o usuário ${name} (${emailStr})?\nEsta alteração é definitiva!`)) return;
    setLoading(true);

    try {
      const { error: delErr } = await supabase
        .from('wsm_user_profiles')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      // Log action
      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'DELETE_USER',
        details: `Removeu o usuário e perfil: ${name} <${emailStr}>`,
        metadata: { deletedId: id, emailStr }
      });

      showToast('success', `Usuário ${name} removido com sucesso.`);
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao deletar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Complete clean up database (excluir TODOS o dados - reset master)
  const handleMasterPurge = async () => {
    const confirmation1 = prompt("⚠️ ALERTA EXTREMO! Você está prestes a apagar TODOS OS DADOS de todas as tabelas (perfis, exames, simulados, chats, submissões, notificações, e avisos). Os logins do Supabase continuarão existindo, mas vazios.\n\nPara prosseguir, digite 'RESETAR ATHENAS' abaixo:");
    if (confirmation1 !== 'RESETAR ATHENAS') {
      alert("Operação cancelada. Chave de reset inválida.");
      return;
    }

    setLoading(true);
    try {
      // Sequential deletes
      await supabase.from('wsm_chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_chat_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_mock_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_mock_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_user_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'MASTER_PURGE',
        details: 'Executou um RESET COMPLETO em todas as tabelas do Supabase Athenas.',
        metadata: { date: new Date().toISOString() }
      });

      alert("💥 Reset Completo Realizado com Sucesso! Todas as tabelas foram inteiramente limpas.");
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Erro no purge: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Excluir apenas os perfis de usuários (teachers e students)
  const handlePurgeUsersOnly = async () => {
    const confirmation = prompt("⚠️ Confirme a remoção de todos os Perfis Acadêmicos (wsm_user_profiles), desvinculando todos os estudantes e professores.\n\nPara confirmar, digite 'APAGAR PERFIS':");
    if (confirmation !== 'APAGAR PERFIS') return;

    setLoading(true);
    try {
      await supabase.from('wsm_user_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'PURGE_USERS_ONLY',
        details: 'Excluiu todos os perfis cadastrados de estudantes e professores.',
      });

      alert("Limpeza de perfis concluída.");
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao apagar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Limpar apenas dados escolares (provas, simulados, submissões, notas, chats, anúncios), preservando os usuários
  const handlePurgeSchoolDataOnly = async () => {
    const confirmation = prompt("⚠️ Confirme a limpeza de todo o conteúdo escolar (provas físicas agendadas, simulados digitais, respostas de alunos, conversas da AI, e notificações), mantendo a tabela de usuários limpa de interações.\n\nPara confirmar, digite 'LIMPAR CONTEUDO':");
    if (confirmation !== 'LIMPAR CONTEUDO') return;

    setLoading(true);
    try {
      await supabase.from('wsm_chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_chat_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_mock_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_mock_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wsm_announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'PURGE_SCHOOL_DATA_ONLY',
        details: 'Removeu todo conteúdo letivo, simulados e mensagens de chat do banco de dados.',
      });

      alert("Limpeza de conteúdo letivo e simulados concluída. Usuários foram mantidos!");
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao apagar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit revised exam score (Editing student's graded submisson score)
  const handleUpdateSubmissionScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubmission) return;

    const nextScore = parseFloat(editingGradeValue);
    if (isNaN(nextScore) || nextScore < 0 || nextScore > 10) {
      alert("A nota deve ser um valor numérico entre 0.00 e 10.00");
      return;
    }

    setLoading(true);
    try {
      const { error: updErr } = await supabase
        .from('wsm_mock_submissions')
        .update({
          score: nextScore
        })
        .eq('id', editingSubmission.id);

      if (updErr) throw updErr;

      // Log the grade override action
      await logSystemAction({
        userEmail: adminEmail,
        userName: 'Admin',
        role: 'admin',
        action: 'UPDATE_STUDENT_SCORE',
        details: `Corrigiu administrativamente a nota do simulado para ${nextScore}. Estudante: ${editingSubmission.student_name} (${editingSubmission.student_email})`,
        metadata: {
          submissionId: editingSubmission.id,
          oldScore: editingSubmission.score,
          newScore: nextScore,
          examId: editingSubmission.mock_exam_id
        }
      });

      showToast('success', `Nota alterada com sucesso para ${nextScore}!`);
      setEditingSubmission(null);
      fetchEverything();
    } catch (err: any) {
      showToast('error', `Falha ao atualizar nota: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filters profiles logic
  const filteredUsers = users.filter(usr => {
    const matchesSearch =
      (usr.nome_completo || '').toLowerCase().includes(userSearchText.toLowerCase()) ||
      (usr.email || '').toLowerCase().includes(userSearchText.toLowerCase());
    
    const matchesRole = userRoleFilter === 'all' ? true : usr.role === userRoleFilter;
    const matchesClass = userClassFilter === 'all' ? true : usr.turma === userClassFilter;

    return matchesSearch && matchesRole && matchesClass;
  });

  // Filters Audit Logs
  const filteredLogs = systemLogs.filter(lg => {
    const searchString = logSearchText.toLowerCase();
    if (!searchString) return true;

    return (
      (lg.user_email || '').toLowerCase().includes(searchString) ||
      (lg.user_name || '').toLowerCase().includes(searchString) ||
      (lg.action || '').toLowerCase().includes(searchString) ||
      (lg.details || '').toLowerCase().includes(searchString) ||
      (lg.location_info || '').toLowerCase().includes(searchString)
    );
  });

  return (
    <div className="min-h-screen bg-[#030504] text-neutral-100 flex flex-col font-sans relative">
      
      {/* Background elegant accents */}
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Admin Subheader Panel */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl">
            <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-neutral-100 uppercase">
                Console Administrativo Mestre
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                Poder Total
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Logado como master: <span className="font-mono text-neutral-200">{adminEmail}</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Tabs header */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => {
              fetchEverything();
              showToast('success', 'Dados acadêmicos recarregados direto do Supabase.');
            }}
            disabled={loading}
            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer mr-2 shrink-0"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>

          <button
            onClick={onBack}
            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sair do Admin</span>
          </button>
        </div>
      </header>

      {/* Global Status Banner Alert */}
      {globalStatus.message && (
        <div className={`mx-6 mt-4 p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 animate-slideDown ${
          globalStatus.type === 'success' ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' :
          globalStatus.type === 'error' ? 'bg-red-950/20 border-red-500/20 text-red-400' :
          'bg-amber-950/20 border-amber-500/20 text-amber-400'
        }`}>
          {globalStatus.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {globalStatus.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {globalStatus.type === 'warning' && <Activity className="w-4 h-4 shrink-0 animate-ping" />}
          <span className="font-semibold">{globalStatus.message}</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-8">
        
        {/* Navigation Sidebar Panel */}
        <div className="md:col-span-1 space-y-2">
          <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase px-3.5 mb-2">Acesso Rápido</p>
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'stats' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800 shadow-sm' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Informações Gerais & Métricas</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'users' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Controle de Usuários</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'exams' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <FileCode className="w-4 h-4 text-purple-400" />
            <span>Simulados & Notas</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'logs' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-500" />
            <span>Logs de Atividades</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'announcements' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <Bell className="w-4 h-4 text-emerald-400" />
            <span>Mural de Comunicados</span>
          </button>

          <button
            onClick={() => setActiveTab('chats')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'chats' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span>Monitor de Chats</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-neutral-900 text-neutral-100 border-neutral-800' 
                : 'bg-transparent text-neutral-450 border-transparent hover:text-neutral-200 hover:bg-neutral-950/40'
            }`}
          >
            <Settings className="w-4 h-4 text-pink-400" />
            <span>Parâmetros do Portal</span>
          </button>

          <div className="pt-4 border-t border-neutral-900/60 my-4" />

          <button
            onClick={() => setActiveTab('danger')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-black border transition-all text-left cursor-pointer ${
              activeTab === 'danger' 
                ? 'bg-red-950/20 text-red-400 border-red-500/20' 
                : 'bg-transparent text-red-500/70 border-transparent hover:text-red-400 hover:bg-red-950/10'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse animate-duration-1000" />
            <span>ZONA PERIGOSA</span>
          </button>
        </div>

        {/* Content Section Panel */}
        <div className="md:col-span-4 space-y-6">
          
          {/* TAB 1: INFORMAÇÕES GERAIS, TELEMETRIA & MÉTRICAS MESTRE */}
          {activeTab === 'stats' && (
            <AdminGeneralAnalytics
              users={users}
              mockExams={mockExams}
              mockSubmissions={mockSubmissions}
              exams={exams}
              announcements={announcements}
              systemLogs={systemLogs}
              chatSessions={chatSessions}
              onRefreshAll={fetchEverything}
              isLoading={loading}
            />
          )}

          {/* TAB 2: CONTROLE DE USUÁRIOS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Header inside view and creation action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900">
                <div>
                  <h2 className="text-sm font-bold text-neutral-100">Configuração de Alunos e Docentes</h2>
                  <p className="text-xs text-neutral-450 mt-0.5">Gerencie os perfis, altere turmas e altere as configurações cadastrais.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsBatchModalOpen(true);
                      if (batchParsedRows.length === 0 && !batchRawText) {
                        handleParseBatchInput(`Nome Completo,E-mail,Cargo,Turma,Numero Chamada,Materia
Aluno Exemplo 01,aluno1@escola.com,student,9A,1,
Aluno Exemplo 02,aluno2@escola.com,student,9A,2,
Professora Roberta,roberta.bio@escola.com,teacher,9A, ,Biologia`);
                      }
                    }}
                    className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-850 text-blue-400 hover:text-blue-300 border border-neutral-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>Importação em Lote / CSV</span>
                  </button>

                  <button
                    onClick={() => setIsCreatingUser(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Novo Aluno / Professor</span>
                  </button>
                </div>
              </div>

              {/* Search & filter toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 focus:border-blue-500/30 rounded-xl text-xs placeholder-neutral-500 outline-none"
                  />
                </div>

                <div>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs outline-none cursor-pointer"
                  >
                    <option value="all">Filtro de Perfil: TODOS</option>
                    <option value="student">Apenas Alunos</option>
                    <option value="teacher">Apenas Professores</option>
                  </select>
                </div>

                <div>
                  <select
                    value={userClassFilter}
                    onChange={(e) => setUserClassFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs outline-none cursor-pointer"
                  >
                    <option value="all">Filtro de Turma: TODAS</option>
                    {Array.from(new Set(users.map(u => u.turma).filter(Boolean))).sort().map(cls => (
                      <option key={cls} value={cls}>Turma: {cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Users list table */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-905 bg-neutral-950/80 text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                        <th className="p-4 px-5">Inscrição / Nome</th>
                        <th className="p-4">Cargo</th>
                        <th className="p-4">Turma / Matéria</th>
                        <th className="p-4">Criado em</th>
                        <th className="p-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/60 text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-neutral-500">
                            Nenhum usuário localizado correspondente aos filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((usr) => {
                          const isStudent = usr.role === 'student';
                          return (
                            <tr key={usr.id} className="hover:bg-neutral-900/20 transition-all">
                              <td className="p-4 px-5">
                                <div className="font-bold text-neutral-200">{usr.nome_completo || 'Sem nome'}</div>
                                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{usr.email}</div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isStudent ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                                }`}>
                                  {isStudent ? 'Estudante' : 'Professor(a)'}
                                </span>
                              </td>
                              <td className="p-4">
                                {isStudent ? (
                                  <div>
                                    <span className="font-semibold text-neutral-300">Turma {usr.turma || '-'}</span>
                                    <span className="text-[10px] text-neutral-500 ml-1.5 font-mono">Nº {usr.numero_chamada || '-'}</span>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="font-semibold text-neutral-300">{usr.materia || 'Biologia'}</div>
                                    <div className="text-[9.5px] text-neutral-500 font-mono">
                                      Leciona: {Array.isArray(usr.anos_lecionados) ? usr.anos_lecionados.join(', ') : 'Nenhuma'}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-neutral-500 font-mono text-[10px]">
                                {usr.created_at ? new Date(usr.created_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingUser(usr)}
                                    className="p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 rounded-lg hover:text-white transition-all cursor-pointer"
                                    title="Editar perfil"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(usr.id, usr.nome_completo, usr.email)}
                                    className="p-1.5 bg-red-950/20 hover:bg-red-500 hover:text-neutral-950 border border-red-500/10 text-red-400 rounded-lg transition-all cursor-pointer"
                                    title="Excluir do sistema"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SIMULADOS E NOTAS */}
          {activeTab === 'exams' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900">
                <h2 className="text-sm font-bold text-neutral-100">Supervisão Acadêmica de Simulados Online</h2>
                <p className="text-xs text-neutral-450 mt-0.5">Permite monitorar as submissões de notas de simulados virtuais feitas pelos alunos e editar as notas errôneas.</p>
              </div>

              {/* Master list of Mock submissions (Grades override) */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl overflow-hidden">
                <div className="p-4 bg-neutral-950/60 border-b border-neutral-900 flex items-center justify-between">
                  <div className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Total de Submissões: {mockSubmissions.length}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-900 bg-neutral-955/80 text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                        <th className="p-4 px-5">Estudante / Turma</th>
                        <th className="p-4">Simulado Avaliado</th>
                        <th className="p-4">Acertos</th>
                        <th className="p-4">Nota Obtida</th>
                        <th className="p-4">Data Submissão</th>
                        <th className="p-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/60 text-xs">
                      {mockSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-neutral-500">
                            Nenhum simulado foi submetido ou respondido por alunos até agora.
                          </td>
                        </tr>
                      ) : (
                        mockSubmissions.map((sub) => {
                          const originalExam = mockExams.find(ex => ex.id === sub.mock_exam_id);
                          const isExcellent = parseFloat(sub.score) >= 7.0;
                          return (
                            <tr key={sub.id} className="hover:bg-neutral-900/20 transition-all">
                              <td className="p-4 px-5">
                                <div className="font-bold text-neutral-200">{sub.student_name || 'Sem nome'}</div>
                                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{sub.student_email} • Turma {sub.student_class || '-'}</div>
                              </td>
                              <td className="p-4">
                                <div className="font-semibold text-neutral-300">{originalExam?.title || 'Simulado Excluído/Não Localizado'}</div>
                                <span className="text-[10px] text-neutral-500 font-mono">{originalExam?.subject || 'Biologia'}</span>
                              </td>
                              <td className="p-4 font-mono text-neutral-300 text-xs">
                                {sub.correct_count} / {sub.total_questions || 5}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                  isExcellent ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  {parseFloat(sub.score || '0').toFixed(2)}
                                </span>
                              </td>
                              <td className="p-4 text-neutral-500 font-mono text-[10px]">
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '-'}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => {
                                    setEditingSubmission(sub);
                                    setEditingGradeValue(sub.score?.toString() || '0');
                                  }}
                                  className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-emerald-400 hover:text-emerald-300 rounded-xl font-bold flex items-center gap-1 ml-auto text-[11px] transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Mudar Nota</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900">
                <h2 className="text-sm font-bold text-neutral-100">Auditoria Forense de Logs</h2>
                <p className="text-xs text-neutral-450 mt-0.5">Rastreabilidade integral. Cada login, clique ou exclusão de dados é perpetuado na tabela de auditoria pública. Clique na linha correspondente para abrir mais metadados.</p>
              </div>

              {/* Logs filter search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Pesquisar por email da conta, ação executada (LOGIN, MASTER_PURGE, etc)..."
                  value={logSearchText}
                  onChange={(e) => setLogSearchText(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 focus:border-amber-500/30 rounded-xl text-xs placeholder-neutral-500 outline-none"
                />
              </div>

              {/* Huge Data Table */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-neutral-950 z-10 border-b border-neutral-900 text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
                      <tr>
                        <th className="p-4 px-5">Horário / Data</th>
                        <th className="p-4">Agente</th>
                        <th className="p-4">Ação</th>
                        <th className="p-4">Descrição das Alterações</th>
                        <th className="p-4">Dispositivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/40 text-xs">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-neutral-500">
                            Nenhum log gravado no banco de dados correspondente aos termos digitados.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const badgeColor =
                            log.action === 'ADMIN_ACCESS' ? 'bg-red-950 text-red-400 border border-red-500/20' :
                            log.action?.includes('PURGE') || log.action?.includes('DELETE') ? 'bg-orange-950 text-orange-400 border-orange-500/20' :
                            log.action?.includes('CREATE') ? 'bg-blue-950 text-blue-400' :
                            'bg-neutral-800 text-neutral-300';

                          return (
                            <tr
                              key={log.id}
                              onClick={() => setLogSelectedRow(log)}
                              className="hover:bg-neutral-900/40 transition-all cursor-pointer active:bg-neutral-900/60"
                              title="Clique para visualizar detalhes enriquecidos de browser e metadados JSON"
                            >
                              <td className="p-4 px-5 whitespace-nowrap text-neutral-500 font-mono text-[10.5px]">
                                {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                              </td>
                              <td className="p-4">
                                <span className="font-bold text-neutral-250 block">{log.user_name || 'Agente'}</span>
                                <span className="text-[10px] text-neutral-500 font-mono">{log.user_email} • {log.role}</span>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${badgeColor}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="p-4 text-neutral-305 max-w-sm truncate whitespace-pre-wrap leading-relaxed">
                                {log.details}
                              </td>
                              <td className="p-4 text-neutral-500 font-mono text-[10.5px]">
                                <div className="flex items-center gap-1">
                                  <Laptop className="w-3.5 h-3.5 text-amber-500/75 shrink-0" />
                                  <span>{log.location_info || 'Dispositivo Web'}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* NEW TAB: MURAL DE COMUNICADOS */}
          {activeTab === 'announcements' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-100">Mural de Comunicados Institucionais</h2>
                  <p className="text-xs text-neutral-450 mt-0.5">Atribua notícias, avisos acadêmicos ou ordens operacionais visíveis diretamente no dashboard de alunos e professores.</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20 uppercase">
                  {announcements.length} Comunicados Ativos
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                
                {/* Form to create announcement */}
                <div className="lg:col-span-2 bg-neutral-950/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold font-mono text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-900 pb-3">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Publicar Comunicado</span>
                  </h3>

                  <form onSubmit={handleCreateAnnouncementSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-neutral-450 mb-1">Título do Comunicado</label>
                      <input
                        type="text"
                        placeholder="Ex: Calendário de Provas Finais"
                        value={newAnnTitle}
                        onChange={(e) => setNewAnnTitle(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none text-neutral-200"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-mono text-neutral-450 mb-1">Conteúdo Textual</label>
                      <textarea
                        rows={4}
                        placeholder="Digite o comunicado completo para exibição imediata..."
                        value={newAnnContent}
                        onChange={(e) => setNewAnnContent(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none text-neutral-200 resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-neutral-450 mb-1">Categoria / Tipo</label>
                        <select
                          value={newAnnType}
                          onChange={(e) => setNewAnnType(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none text-neutral-200"
                        >
                          <option value="geral">Aviso Geral</option>
                          <option value="Importante">Importante (Destaque)</option>
                          <option value="Atividades">Lembrete Letivo</option>
                          <option value="Eventos">Social / Eventos</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-mono text-neutral-450 mb-1">Ícone Visual</label>
                        <select
                          value={newAnnIcon}
                          onChange={(e) => setNewAnnIcon(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none text-neutral-200"
                        >
                          <option value="bell">Sino (Bell)</option>
                          <option value="info">Informação (Info)</option>
                          <option value="star">Estrela (Star)</option>
                          <option value="shield">Escudo (Shield)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPostingAnn}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isPostingAnn ? 'Publicando...' : 'Divulgar Comunicado'}
                    </button>
                  </form>
                </div>

                {/* List of active announcements */}
                <div className="lg:col-span-3 space-y-4">
                  <h3 className="text-xs font-bold font-mono text-neutral-350 uppercase tracking-widest pl-1">Exibindo Comunicados Ativos</h3>

                  {announcements.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20 flex flex-col items-center justify-center">
                      <Bell className="w-10 h-10 text-neutral-850 mb-2" />
                      <p className="text-sm font-semibold text-neutral-405">Sem comunicados publicados</p>
                      <p className="text-[11px] text-neutral-600 max-w-xs mt-0.5">Preencha o formulário administrativo à esquerda para gerar avisos globais no portal letivo.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                      {announcements.map((ann) => {
                        const isHighlight = ann.category === 'Urgent';
                        const catLabel = ann.category === 'Urgent' ? 'Destaque' : ann.category === 'Prova' ? 'Prova' : ann.category === 'Evento' ? 'Evento' : 'Geral';
                        return (
                          <div 
                            key={ann.id} 
                            className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                              isHighlight 
                                ? 'bg-amber-950/10 border-amber-500/20 text-neutral-200' 
                                : 'bg-neutral-950/50 border-neutral-900 text-neutral-300'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono tracking-wider font-extrabold uppercase ${
                                  isHighlight ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-400'
                                }`}>
                                  {catLabel}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {ann.created_at ? new Date(ann.created_at).toLocaleString() : ''}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-neutral-100">{ann.title}</h4>
                              <p className="text-[11.5px] text-neutral-400 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                              className="p-1 px-1.5 text-neutral-600 hover:text-red-400 hover:bg-neutral-900 rounded transition-all cursor-pointer"
                              title="Excluir comunicado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* NEW TAB: MONITOR DE CHATS */}
          {activeTab === 'chats' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900">
                <h2 className="text-sm font-bold text-neutral-100">Supervisão de Conversas do Chatbot</h2>
                <p className="text-xs text-neutral-450 mt-0.5">Auditoria e diagnóstico em detalhes. Visualize em tempo real as conversações e atendimentos remotos travados pelos usuários com a Athenas AI.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                
                {/* Chat Sessions list */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-xs font-bold font-mono text-neutral-350 uppercase tracking-widest pl-1">Sessões Ativas ({chatSessions.length})</h3>
                  
                  {chatSessions.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/20">
                      <MessageSquare className="w-8 h-8 text-neutral-800 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 font-semibold">Nenhuma sessão de chat no banco</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                      {chatSessions.map((session) => {
                        const isSelected = selectedChatSession?.id === session.id;
                        return (
                          <div
                            key={session.id}
                            onClick={() => fetchChatMessages(session)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected 
                                ? 'bg-neutral-900 border-neutral-800 text-neutral-100 shadow-md' 
                                : 'bg-neutral-950/30 border-neutral-905 hover:bg-neutral-900/40 text-neutral-400'
                            }`}
                          >
                            <div className="space-y-1 truncate flex-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500">
                                <span className="font-bold text-sky-400 truncate max-w-[120px]">{session.user_email}</span>
                                <span>•</span>
                                <span>{session.created_at ? new Date(session.created_at).toLocaleDateString('pt-BR') : ''}</span>
                              </div>
                              <div className="text-xs font-semibold text-neutral-200 truncate">{session.title || 'Conversa sem título'}</div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChatSession(session.id);
                              }}
                              className="p-1 px-1.5 text-neutral-600 hover:text-red-400 hover:bg-neutral-900/40 rounded transition-all cursor-pointer"
                              title="Excluir chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Chat Session Messages View (Transcript) */}
                <div className="lg:col-span-3 bg-neutral-950/50 border border-neutral-900 rounded-3xl p-5 flex flex-col h-[550px] justify-between">
                  {selectedChatSession ? (
                    <div className="flex-1 flex flex-col h-full justify-between">
                      
                      {/* Subheader selected conversation */}
                      <div className="border-b border-neutral-900 pb-3 flex items-center justify-between shrink-0 mb-4">
                        <div>
                          <div className="text-[10px] text-neutral-500 font-mono">AUDITANDO SESSÃO</div>
                          <div className="text-xs font-extrabold text-neutral-200 truncate max-w-sm">{selectedChatSession.title}</div>
                          <div className="text-[10.5px] text-neutral-450 truncate">Membro: <span className="font-mono text-sky-305">{selectedChatSession.user_email}</span></div>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedChatSession(null);
                            setSelectedChatMessages([]);
                          }}
                          className="p-1 hover:bg-neutral-900 rounded text-neutral-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Transcripts scroll */}
                      <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                        {loadingChatMessages ? (
                          <div className="h-full flex items-center justify-center text-xs text-neutral-500 gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                            <span>Extraindo transcendimentos do Supabase...</span>
                          </div>
                        ) : selectedChatMessages.length === 0 ? (
                          <p className="text-xs text-center text-neutral-500 py-12">Esta sessão está vazia ou as mensagens foram limpas.</p>
                        ) : (
                          selectedChatMessages.map((msg) => {
                            const isAssistant = msg.role === 'assistant';
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col max-w-[85%] space-y-1 ${
                                  isAssistant ? 'self-start' : 'self-end ml-auto'
                                }`}
                              >
                                <span className={`text-[9.5px] font-mono tracking-wider uppercase ${isAssistant ? 'text-amber-500/75' : 'text-sky-500/75 self-end'}`}>
                                  {isAssistant ? 'ATHENAS AI' : 'ESTUDANTE'}
                                </span>
                                <div className={`p-3 rounded-2xl text-[11.5px] leading-relaxed whitespace-pre-wrap ${
                                  isAssistant 
                                    ? 'bg-neutral-900 border border-neutral-850 text-neutral-200 rounded-tl-none' 
                                    : 'bg-emerald-500/10 border border-emerald-500/20 text-neutral-250 rounded-tr-none'
                                }`}>
                                  {msg.content}
                                  
                                  {/* Attachment indicators */}
                                  {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-neutral-800/60 text-[10.5px] text-neutral-400 font-mono space-y-1">
                                      <div className="text-neutral-500 font-bold uppercase tracking-widest text-[8px]">Arquivos Anexados:</div>
                                      {msg.attachments.map((file: any, fIdx: number) => (
                                        <div key={fIdx} className="flex items-center gap-1.5 text-indigo-400">
                                          <Laptop className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                          <span className="underline truncate max-w-xs">{file.name || 'document.pdf'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[9.5px] text-neutral-600 font-mono ${isAssistant ? '' : 'self-end'}`}>
                                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                      <Terminal className="w-10 h-10 text-neutral-800 animate-pulse" />
                      <h4 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">Nenhuma Conversa Selecionada</h4>
                      <p className="text-[11px] text-neutral-500 max-w-sm leading-relaxed px-4">
                        Clique em qualquer uma das sessões operacionais listadas à esquerda para carregar a transcrição e os metadados das mensagens enviadas.
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* NEW TAB: GERENCIADOR DE PARÂMETROS / CONFIG */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900">
                <h2 className="text-sm font-bold text-neutral-100">Configuração de Parâmetros Operacionais</h2>
                <p className="text-xs text-neutral-450 mt-0.5">Defina limites, regras acadêmicas locais e simule bloqueios ou manutenção de infraestrutura do sistema.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Panel settings fields */}
                <div className="lg:col-span-2 bg-neutral-950/30 border border-neutral-900 rounded-3xl p-6">
                  <h3 className="text-xs font-bold font-mono text-neutral-300 uppercase tracking-wider border-b border-neutral-900 pb-3 mb-6">Regras & Bloqueios do Sistema</h3>
                  
                  <form onSubmit={handleSaveSettings} className="space-y-6 text-xs text-neutral-350">
                    
                    {/* Media de aprovacao slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="block text-xs font-bold text-neutral-200">Média Mínima para Aprovação</label>
                          <span className="text-[10px] text-neutral-500">Atesta o mínimo necessário para status excelente em notas e simulados.</span>
                        </div>
                        <span className="text-lg font-black text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                          {passingGrade.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="4.0"
                        max="8.0"
                        step="0.5"
                        value={passingGrade}
                        onChange={(e) => setPassingGrade(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-[9px] text-neutral-600 font-mono">
                        <span>4.0 (Suave)</span>
                        <span>6.0 (Médio)</span>
                        <span>8.0 (Rígido)</span>
                      </div>
                    </div>

                    <hr className="border-neutral-900" />

                    {/* Toggle: lock grade posting */}
                    <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-neutral-900/10 border border-neutral-905">
                      <div className="space-y-0.5 max-w-md">
                        <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Bloquear Lançamento de Notas</span>
                        </label>
                        <p className="text-[10.5px] text-neutral-500 leading-relaxed">
                          Se ativado, impede temporariamente os professores de cadastrar, alterar ou excluir notas no sistema institucional.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBlockPosting(!blockPosting)}
                        className={`w-11 h-6 rounded-full p-1 transition-all ${blockPosting ? 'bg-amber-500' : 'bg-neutral-80 loading bg-neutral-800'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-neutral-950 transition-all ${blockPosting ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Toggle: maintenance mode simulation */}
                    <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-neutral-900/10 border border-neutral-905">
                      <div className="space-y-0.5 max-w-md">
                        <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-neutral-405" />
                          <span>Simular Banner de Manutenção</span>
                        </label>
                        <p className="text-[10.5px] text-neutral-500 leading-relaxed">
                          Gera um banner visível de 'Alerta de Infraestrutra' na página inicial de todos os alunos informando de uma janela técnica.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMaintenanceMode(!maintenanceMode)}
                        className={`w-11 h-6 rounded-full p-1 transition-all ${maintenanceMode ? 'bg-pink-500' : 'bg-neutral-80 bg-neutral-800'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-neutral-950 transition-all ${maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-100 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs text-center"
                    >
                      <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Salvar e Sincronizar Regras</span>
                    </button>

                  </form>
                </div>

                {/* Performance Analytics Mock Visual Panel */}
                <div className="bg-neutral-950/30 border border-neutral-900 rounded-3xl p-6 space-y-6">
                  <h3 className="text-xs font-bold font-mono text-neutral-300 uppercase tracking-wider border-b border-neutral-900 pb-3 mb-2">Métricas de Infreestrutura</h3>

                  {/* Latency */}
                  <div className="p-3 bg-neutral-900/20 border border-neutral-900/60 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[9.5px] text-neutral-500 font-mono">LATÊNCIA DO SUPABASE</div>
                      <div className="text-xs font-black text-emerald-400 font-mono">24 ms (Excelente)</div>
                    </div>
                    <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                  </div>

                  {/* Platform Active threads mockup */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                      <span>Carga do Servidor</span>
                      <span>18.4%</span>
                    </div>
                    <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '18.4%' }} />
                    </div>
                  </div>

                  {/* SQLite dynamic rows count metrics based on real database state */}
                  <div className="space-y-4 pt-2 border-t border-neutral-900">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Tabelas Relacionais (Supabase)</div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-905">
                        <div className="text-[10px] text-neutral-500 font-mono">PERFIS</div>
                        <div className="text-sm font-black text-neutral-200 font-mono">{users.length}</div>
                      </div>

                      <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-905">
                        <div className="text-[10px] text-neutral-500 font-mono font-bold">SUBMISSÕES</div>
                        <div className="text-sm font-black text-neutral-200 font-mono">{mockSubmissions.length}</div>
                      </div>

                      <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-905">
                        <div className="text-[10px] text-neutral-500 font-mono">COMUNICADOS</div>
                        <div className="text-sm font-black text-neutral-200 font-mono">{announcements.length}</div>
                      </div>

                      <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-905">
                        <div className="text-[10px] text-neutral-500 font-mono">LOGS</div>
                        <div className="text-sm font-black text-neutral-200 font-mono">{systemLogs.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* GORGEOUS custom mockup vector chart representing platform activity */}
                  <div className="pt-4 border-t border-neutral-900 space-y-2">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Atividade de Acessos Recentes (Últimas 24h)</div>
                    
                    <div className="h-20 w-full relative flex items-end justify-between bg-neutral-950 rounded-xl p-2 border border-neutral-905 overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-radial-gradient from-emerald-500/20 to-transparent pointer-events-none" />
                      
                      <div className="w-1.5 bg-neutral-850 h-[30%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[25%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[45%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[15%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[55%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[40%] rounded-t-sm" />
                      <div className="w-1.5 bg-emerald-500 h-[70%] rounded-t-sm animate-pulse" />
                      <div className="w-1.5 bg-emerald-500 h-[65%] rounded-t-sm animate-pulse" />
                      <div className="w-1.5 bg-neutral-850 h-[50%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[80%] rounded-t-sm" />
                      <div className="w-1.5 bg-emerald-500 h-[92%] rounded-t-sm animate-pulse" />
                      <div className="w-1.5 bg-neutral-850 h-[35%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[40%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[48%] rounded-t-sm" />
                      <div className="w-1.5 bg-neutral-850 h-[10%] rounded-t-sm" />

                    </div>
                    <div className="flex justify-between text-[8px] text-neutral-600 font-mono">
                      <span>00:00 (Madrugada)</span>
                      <span>12:00 (Meio-dia)</span>
                      <span>AGORA (Recente)</span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 5: ZONA PERIGOSA */}
          {activeTab === 'danger' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="p-6 rounded-3xl bg-red-950/15 border border-red-500/10">
                <div className="flex items-center gap-2 mb-2 text-red-400">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                  <h2 className="text-sm font-black uppercase tracking-tight">Zona de Exclusão Irreversível</h2>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Os botões abaixo executam queries imediatas de limpeza extrema no Supabase. Ideal para deixar a plataforma livre de lixo e dados de testes antes de apresentações. Prossiga com plena atenção!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Purge Option 1 */}
                <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-900 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-mono font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded">EXCLUSÃO TOTAL</span>
                    <h3 className="text-sm font-bold text-neutral-200 mt-2 mb-1">Limpar Tudo (Reset Geral)</h3>
                    <p className="text-xs text-neutral-450 leading-relaxed">Apaga todos os perfis, alunos, professores, notas, provas e simulados criados até agora de uma vez só.</p>
                  </div>
                  <button
                    onClick={handleMasterPurge}
                    className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Executar Purga Master</span>
                  </button>
                </div>

                {/* Purge Option 2 */}
                <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-900 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-mono font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">CADASTRADOS APENAS</span>
                    <h3 className="text-sm font-bold text-neutral-200 mt-2 mb-1">Apagar Usuários</h3>
                    <p className="text-xs text-neutral-450 leading-relaxed">Remove apenas as linhas de perfis (wsm_user_profiles), desvinculando os registros acadêmicos das contas de cadastro.</p>
                  </div>
                  <button
                    onClick={handlePurgeUsersOnly}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer hover:text-red-400 hover:border-red-500/20"
                  >
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Excluir Perfis</span>
                  </button>
                </div>

                {/* Purge Option 3 */}
                <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-900 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-mono font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">DADOS LETIVOS</span>
                    <h3 className="text-sm font-bold text-neutral-200 mt-2 mb-1">Limpar Dados Escolares</h3>
                    <p className="text-xs text-neutral-450 leading-relaxed">Remove todas as provas, simulados digitais, gabaritos e boletins inseridos, mas preserva os usuários para que eles continuem conseguindo fazer login normalmente.</p>
                  </div>
                  <button
                    onClick={handlePurgeSchoolDataOnly}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer hover:border-blue-500/20 hover:text-blue-400"
                  >
                    <Database className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Resetar Conteúdo Letivo</span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-neutral-900 bg-neutral-950/40 p-4 text-center text-[10px] text-neutral-500 font-mono">
        Athenas Systems Portal Uni • Terminal Mestre v2.0
      </footer>

      {/* --- FLOATING & OVERLAY MODALS --- */}

      {/* MODAL 1: CREATE NEW STUDENT/PROFS */}
      <AnimatePresence>
        {isCreatingUser && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Cadastrar Novo Acadêmico</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 text-xs text-neutral-300">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">E-mail da Conta</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
                    <input
                      type="email"
                      placeholder="aluno@athenas.edu.br"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Senha do usuário (Ex: 123456)"
                      value={newUserForm.senhaPlana}
                      onChange={(e) => setNewUserForm({ ...newUserForm, senhaPlana: e.target.value })}
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none text-neutral-200"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="João da Silva"
                    value={newUserForm.nomeCompleto}
                    onChange={(e) => setNewUserForm({ ...newUserForm, nomeCompleto: e.target.value })}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Tipo de Usuário</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      key="student-btn"
                      type="button"
                      onClick={() => setNewUserForm({ ...newUserForm, role: 'student' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        newUserForm.role === 'student' ? 'bg-blue-500/10 text-blue-400 border-blue-500/35' : 'bg-transparent text-neutral-500 border-neutral-850'
                      }`}
                    >
                      Estudante
                    </button>
                    <button
                      key="teacher-btn"
                      type="button"
                      onClick={() => setNewUserForm({ ...newUserForm, role: 'teacher' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        newUserForm.role === 'teacher' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/35' : 'bg-transparent text-neutral-500 border-neutral-850'
                      }`}
                    >
                      Professor(a)
                    </button>
                  </div>
                </div>

                {/* Role Specific Forms fields */}
                {newUserForm.role === 'student' ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Turma</label>
                      <input
                        type="text"
                        value={newUserForm.turma || ''}
                        onChange={(e) => setNewUserForm({ ...newUserForm, turma: e.target.value })}
                        placeholder="Ex: 8ºA, Sala 101"
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Nº Chamada</label>
                      <input
                        type="number"
                        placeholder="14"
                        value={newUserForm.numeroChamada}
                        onChange={(e) => setNewUserForm({ ...newUserForm, numeroChamada: e.target.value })}
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg outline-none font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 space-y-3.5 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Matéria Principal</label>
                      <input
                        type="text"
                        placeholder="Biologia"
                        value={newUserForm.materia}
                        onChange={(e) => setNewUserForm({ ...newUserForm, materia: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 pointer-events-none">Turmas Lecionadas</label>
                      <input
                        type="text"
                        placeholder="Ex: 8ºA, 1º Ano B"
                        value={newUserForm.anosLecionados.join(', ')}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setNewUserForm({ ...newUserForm, anosLecionados: val });
                        }}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl transition-all uppercase text-xs tracking-wider cursor-pointer mt-4"
                >
                  {loading ? 'Cadastrando...' : 'Confirmar e Criar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDIT USER DETAILS */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between animate-fadeIn">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-400" />
                  <span>Modificar Informações Acadêmicas</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateUserSubmit} className="space-y-4 text-xs text-neutral-300">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">E-mail da Conta</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-neutral-905 border border-neutral-850 rounded-xl outline-none text-neutral-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Nome Acadêmico</label>
                  <input
                    type="text"
                    value={editingUser.nome_completo || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, nome_completo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-neutral-905 border border-neutral-850 rounded-xl outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Papel Escola</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl outline-none"
                  >
                    <option value="student">Estudante (Aluno)</option>
                    <option value="teacher">Docente Principal (Professor)</option>
                  </select>
                </div>

                {editingUser.role === 'student' ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Escolher Turma</label>
                      <input
                        type="text"
                        value={editingUser.turma || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, turma: e.target.value })}
                        placeholder="Ex: 8ºA, Sala 101"
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Nº Chamada</label>
                      <input
                        type="number"
                        value={editingUser.numero_chamada || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, numero_chamada: e.target.value })}
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg outline-none font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 space-y-3.5 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Materia Ministrada</label>
                      <input
                        type="text"
                        value={editingUser.materia || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, materia: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Classes Atribuídas</label>
                      <input
                        type="text"
                        placeholder="Ex: 8ºA, 1º Ano B"
                        value={(editingUser.anos_lecionados || []).join(', ')}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setEditingUser({ ...editingUser, anos_lecionados: val });
                        }}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-black rounded-xl transition-all uppercase text-xs tracking-wider cursor-pointer mt-4 shadow-lg shadow-blue-500/10"
                >
                  {loading ? 'Sincronizando...' : 'Gravar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: EDIT SIMULADO GRADE */}
      <AnimatePresence>
        {editingSubmission && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-105 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-emerald-400" />
                  <span>Substituição Manual de Nota</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingSubmission(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-neutral-900/30 border border-neutral-900 text-xs rounded-xl space-y-1.5">
                <div className="text-neutral-400">Estudante: <span className="text-neutral-200 font-bold ml-1">{editingSubmission.student_name}</span></div>
                <div className="text-neutral-400 font-mono text-[10.5px]">E-mail: {editingSubmission.student_email}</div>
                <div className="text-neutral-400">Nota Atual registrada: <span className="font-mono text-amber-400 font-bold ml-1">{parseFloat(editingSubmission.score || '0').toFixed(2)}</span></div>
              </div>

              <form onSubmit={handleUpdateSubmissionScore} className="space-y-4 text-xs text-neutral-300">
                <div>
                  <label className="block text-[10px] font-mono tracking-wider uppercase text-neutral-400 mb-1">Nova Nota no Simulado (0.00 a 10.00)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={editingGradeValue}
                    onChange={(e) => setEditingGradeValue(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-850 text-neutral-200 text-center font-mono font-bold text-lg rounded-xl outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="text-[10px] text-neutral-500 text-center">Este ajuste se refletirá imediatamente nos gráficos de visualização e boletim do aluno.</div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl transition-all uppercase text-xs tracking-wider cursor-pointer"
                >
                  {loading ? 'Substituindo...' : 'Salvar Nova Nota'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: DETAILED JSON AUDIT LOG EXPANDED */}
      <AnimatePresence>
        {logSelectedRow && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-500 animate-pulse" />
                  <h3 className="text-sm font-black font-mono tracking-wider text-neutral-300 uppercase">
                    Inspecionar Payload de Auditoria
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLogSelectedRow(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg bg-neutral-900 hover:bg-neutral-850 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Log Details card fields */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-900 space-y-1">
                  <div className="text-[10px] text-neutral-500">ID DO EVENTO</div>
                  <div className="text-neutral-300 text-[11px] truncate" title={logSelectedRow.id}>{logSelectedRow.id}</div>
                </div>

                <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-900 space-y-1">
                  <div className="text-[10px] text-neutral-500">TIMESTAMP UNIX</div>
                  <div className="text-neutral-300 text-[11px] truncate">
                    {logSelectedRow.created_at ? new Date(logSelectedRow.created_at).toISOString() : '-'}
                  </div>
                </div>

                <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-900 space-y-1">
                  <div className="text-[10px] text-neutral-500">CONTA AUTORA</div>
                  <div className="text-neutral-300 text-[11px] truncate">{logSelectedRow.user_email}</div>
                </div>

                <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-900 space-y-1">
                  <div className="text-[10px] text-neutral-500">APARELHO / SISTEMA OPERACIONAL</div>
                  <div className="text-neutral-300 text-[11px] truncate flex items-center gap-1 font-mono">
                    <Laptop className="w-3.5 h-3.5 text-amber-500" />
                    <span>{logSelectedRow.location_info || 'Web Portal Client'}</span>
                  </div>
                </div>
              </div>

              {/* Action and description section */}
              <div className="p-4 bg-neutral-900/30 border border-neutral-900 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-black">
                    {logSelectedRow.action}
                  </span>
                  <span className="text-xs font-bold text-neutral-300">{logSelectedRow.user_name} ({logSelectedRow.role})</span>
                </div>
                <p className="text-xs text-neutral-450 leading-relaxed max-h-24 overflow-y-auto pr-2">{logSelectedRow.details}</p>
              </div>

              {/* Enriched JSON viewer */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-neutral-500">METADADOS ENRIQUECIDOS (JSON DE AUDITORIA)</div>
                <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-4 overflow-auto max-h-56 text-[10.5px] font-mono text-amber-400">
                  <pre>{JSON.stringify(logSelectedRow.metadata || {}, null, 2)}</pre>
                </div>
              </div>

              <div className="text-[10px] text-neutral-500 leading-normal text-center">Os relatórios de auditoria respeitam o regulamento geral de proteção do sistema Athenas.</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: BATCH ONBOARDING & CSV IMPORT */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 w-full max-w-4xl space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                      <span>Importação de Usuários em Lote &amp; CSV</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">Resiliente com Fila</span>
                    </h3>
                    <p className="text-xs text-neutral-400">Cadastre ou atualize centenas de alunos e professores simultaneamente sem estourar limites de requisição.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Modelo CSV</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingBatch}
                    onClick={() => {
                      if (!isProcessingBatch) setIsBatchModalOpen(false);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-xl bg-neutral-900 hover:bg-neutral-850 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Backoff countdown banner if provider rate limit triggered */}
              {batchBackoffSeconds !== null && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center gap-3 animate-pulse">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold text-amber-300">Pausa Protetora de Rate Limit Ativada</div>
                    <div className="text-amber-400/80 mt-0.5">
                      Aguardando <span className="font-bold font-mono text-amber-200">{batchBackoffSeconds} segundos</span> antes de retomar a fila automaticamente para não sobrecarregar o provedor.
                    </div>
                  </div>
                </div>
              )}

              {/* Main scrollable body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Input method tabs / file upload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-neutral-300 font-mono uppercase">
                        1. Colar Dados CSV / Tabulação
                      </label>
                      <span className="text-[10px] text-neutral-500">Nome, Email, Cargo, Turma, Chamada, Matéria</span>
                    </div>
                    <textarea
                      disabled={isProcessingBatch}
                      value={batchRawText}
                      onChange={(e) => handleParseBatchInput(e.target.value)}
                      placeholder="Nome Completo,E-mail,Cargo,Turma,Numero Chamada,Materia..."
                      className="w-full h-32 p-3 bg-neutral-900/70 border border-neutral-800 rounded-2xl font-mono text-[11px] text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-500/40 resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2 flex flex-col">
                    <label className="text-[11px] font-bold text-neutral-300 font-mono uppercase">
                      2. Ou Selecionar Arquivo .CSV / .TXT
                    </label>
                    <label className="flex-1 border-2 border-dashed border-neutral-800 hover:border-blue-500/40 rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all bg-neutral-900/30 hover:bg-neutral-900/60">
                      <Upload className="w-7 h-7 text-neutral-500 mb-2" />
                      <span className="text-xs text-neutral-300 font-semibold text-center">Clique para carregar planilha CSV</span>
                      <span className="text-[10px] text-neutral-500 mt-1">Compatível com Excel, Google Sheets ou exportações de secretaria</span>
                      <input
                        type="file"
                        accept=".csv,.txt,.tsv"
                        disabled={isProcessingBatch}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              if (content) handleParseBatchInput(content);
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Progress bar if active or parsed */}
                {batchParsedRows.length > 0 && (
                  <div className="p-3.5 bg-neutral-900/40 border border-neutral-850 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-200">
                        {isProcessingBatch ? 'Processando Fila em Lote...' : 'Pré-visualização e Status da Fila'}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400">
                        {batchProgress.success} sucessos • {batchProgress.failed} falhas • {batchParsedRows.length} total
                      </span>
                    </div>

                    <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${batchParsedRows.length > 0 ? (batchProgress.current / batchParsedRows.length) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Parsed Rows Table */}
                {batchParsedRows.length > 0 && (
                  <div className="border border-neutral-850 rounded-2xl overflow-hidden bg-neutral-950">
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-neutral-850 bg-neutral-900 text-[9.5px] font-mono text-neutral-400 uppercase tracking-wider sticky top-0">
                            <th className="p-2.5 px-3">Status</th>
                            <th className="p-2.5">Nome</th>
                            <th className="p-2.5">E-mail</th>
                            <th className="p-2.5">Cargo</th>
                            <th className="p-2.5">Turma</th>
                            <th className="p-2.5">Nº Chamada</th>
                            <th className="p-2.5">Matéria / Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900 font-sans">
                          {batchParsedRows.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-neutral-900/30">
                              <td className="p-2.5 px-3">
                                {row.status === 'idle' && (
                                  <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono text-[9px]">Pendente</span>
                                )}
                                {row.status === 'processing' && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[9px] flex items-center gap-1">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    Gravando
                                  </span>
                                )}
                                {row.status === 'success' && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[9px] flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Salvo
                                  </span>
                                )}
                                {row.status === 'error' && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono text-[9px] flex items-center gap-1" title={row.errorMsg}>
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Erro
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-semibold text-neutral-200">{row.nome}</td>
                              <td className="p-2.5 font-mono text-neutral-400 text-[10px]">{row.email}</td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  row.role === 'student' ? 'bg-blue-950/40 text-blue-300' : 'bg-emerald-950/40 text-emerald-300'
                                }`}>
                                  {row.role === 'student' ? 'Aluno' : 'Docente'}
                                </span>
                              </td>
                              <td className="p-2.5 text-neutral-300 font-mono">{row.turma || '-'}</td>
                              <td className="p-2.5 text-neutral-300 font-mono">{row.numeroChamada ?? '-'}</td>
                              <td className="p-2.5 text-neutral-400 text-[10px]">
                                {row.errorMsg ? (
                                  <span className="text-red-400">{row.errorMsg}</span>
                                ) : (
                                  row.materia || '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-900">
                <div className="text-[11px] text-neutral-500">
                  Total de {batchParsedRows.length} registros prontos para sincronização.
                </div>

                <div className="flex items-center gap-2">
                  {isProcessingBatch ? (
                    <button
                      type="button"
                      onClick={handleCancelBatchProcessing}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar / Interromper Fila</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={batchParsedRows.length === 0}
                      onClick={handleStartBatchProcessing}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-emerald-500/10"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Iniciar Importação Segura</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
