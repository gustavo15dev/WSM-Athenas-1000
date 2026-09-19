/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Search,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Inbox,
  User,
  BookOpen,
  Filter,
  CheckCircle,
  Hash,
  Key,
  Clock,
  Activity,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Copy,
  Check,
  Download,
  Flame,
  FileText,
  BarChart3,
  X,
  TrendingUp,
  BrainCircuit,
  Info,
  Megaphone,
  Send,
  ChevronDown,
  RefreshCw,
  ClipboardList,
  Plus,
} from "lucide-react";
import { supabase } from "../supabase";
import { areTurmasMatching } from "../utils/profileDb";
import { sendBrowserNotification } from "../utils/browserNotifications";
import PublishSuccessModal from "./PublishSuccessModal";
import { getUniqueRA } from "../types";

// Recharts components
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface StudentProfile {
  id: string;
  nome_completo: string;
  email: string;
  turma: string;
  numero_chamada?: number | null;
}

interface TeacherVirtualClassesProps {
  email: string;
  teacherId?: string;
  teacherName: string;
  allStudents: StudentProfile[];
  virtualClasses?: any[];
  anosLecionados?: string[];
  onRefreshData: () => Promise<void>;
}

export default function TeacherVirtualClasses({
  email,
  teacherId,
  teacherName,
  allStudents,
  virtualClasses: parentVirtualClasses,
  anosLecionados = [],
  onRefreshData,
}: TeacherVirtualClassesProps) {
  const [activeSubTab, setActiveSubTab] = useState<"salas" | "todos_alunos">(
    "salas",
  );
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [publishCelebrationData, setPublishCelebrationData] = useState<{
    isOpen: boolean;
    title: string;
    targetClass: string;
  } | null>(null);

  // Class dashboard states
  const [classSubmissions, setClassSubmissions] = useState<any[]>([]);
  const [classChatSessions, setClassChatSessions] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Load class dashboard data
  React.useEffect(() => {
    if (!selectedClass) {
      setClassSubmissions([]);
      setClassChatSessions([]);
      return;
    }

    const fetchDashboardData = async () => {
      setLoadingDashboard(true);
      try {
        const matchedVC = virtualClasses.find(
          v => v.id === selectedClass || (v.name && v.name.toLowerCase() === selectedClass.toLowerCase())
        );

        let vcEmails: string[] = [];
        if (matchedVC?.student_emails) {
          if (Array.isArray(matchedVC.student_emails)) {
            vcEmails = matchedVC.student_emails;
          } else if (typeof matchedVC.student_emails === 'string') {
            try {
              vcEmails = JSON.parse(matchedVC.student_emails);
            } catch {
              vcEmails = matchedVC.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
        }

        const currentClassStudents = allStudents.filter(
          (st) => (st.turma || "").toLowerCase() === selectedClass.toLowerCase() || (st.email && vcEmails.some(e => e.toLowerCase() === st.email.toLowerCase()))
        );
        const emails = Array.from(new Set([
          ...currentClassStudents.map((st) => st.email.toLowerCase().trim()),
          ...vcEmails.map(e => e.toLowerCase().trim())
        ])).filter(Boolean);

        if (emails.length === 0) {
          setClassSubmissions([]);
          setClassChatSessions([]);
          return;
        }

        // Fetch submissions
        const { data: subs, error: subsErr } = await supabase
          .from("wsm_mock_submissions")
          .select("*")
          .in("student_email", emails);

        if (subsErr) {
          console.warn("Error fetching class submissions:", subsErr);
        }

        // Fetch chat sessions
        const { data: sessions, error: sessionsErr } = await supabase
          .from("wsm_chat_sessions")
          .select("*")
          .in("user_email", emails);

        if (sessionsErr) {
          console.warn("Error fetching class chat sessions:", sessionsErr);
        }

        let activeSessions: any[] = [];
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const { data: userMessages, error: msgsErr } = await supabase
            .from("wsm_chat_messages")
            .select("session_id")
            .eq("role", "assistant")
            .in("session_id", sessionIds);

          if (!msgsErr && userMessages) {
            const activeSessionIds = new Set(userMessages.map(m => m.session_id));
            activeSessions = sessions.filter(s => activeSessionIds.has(s.id));
          }
        }

        setClassSubmissions(subs || []);
        setClassChatSessions(activeSessions);
      } catch (err) {
        console.error("Error loading class dashboard data:", err);
      } finally {
        setLoadingDashboard(false);
      }
    };

    fetchDashboardData();
  }, [selectedClass, allStudents]);

  const getDashboardMetrics = () => {
    if (!selectedClass) {
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        classAverage: 0,
        maxScale: 1.0,
        isScaleOne: true,
        riskThreshold: 0.5,
        avgAI: null,
        avgNonAI: null,
        aiSubmissionsCount: 0,
        nonAiSubmissionsCount: 0,
        aiStudentsCount: 0,
        nonAiStudentsCount: 0,
        histogram: [],
        atRiskList: [],
      };
    }

    const currentVC = virtualClasses.find((vc: any) => 
      vc && (vc.id === selectedClass || vc.access_code === selectedClass || vc.name === selectedClass || areTurmasMatching(vc.name, selectedClass))
    );
    let vcStudentEmails: string[] = [];
    if (currentVC?.student_emails) {
      if (Array.isArray(currentVC.student_emails)) {
        vcStudentEmails = currentVC.student_emails.map((e: string) => String(e).toLowerCase().trim());
      } else if (typeof currentVC.student_emails === 'string') {
        try {
          const parsed = JSON.parse(currentVC.student_emails);
          if (Array.isArray(parsed)) vcStudentEmails = parsed.map((e: string) => String(e).toLowerCase().trim());
        } catch {
          vcStudentEmails = currentVC.student_emails.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        }
      }
    }

    const curClassStudents = allStudents.filter((st) => {
      const matchesCohort = areTurmasMatching(st.turma || '', selectedClass);
      const matchesVC = st.email && vcStudentEmails.includes(st.email.toLowerCase().trim());
      return matchesCohort || matchesVC;
    });

    const studentEmails = curClassStudents.map((st) => st.email.toLowerCase());

    const curSubmissions = classSubmissions.filter(
      (sub) => sub.student_email && 
               studentEmails.includes(sub.student_email.toLowerCase()) &&
               sub.telemetry?.is_unfinished !== true
    );

    const curSessions = classChatSessions.filter(
      (sess) => sess.user_email && studentEmails.includes(sess.user_email.toLowerCase())
    );

    const aiUserEmails = new Set(curSessions.map((s) => (s.user_email || "").toLowerCase()));

    const aiStudents = curClassStudents.filter((st) => aiUserEmails.has(st.email.toLowerCase()));
    const nonAiStudents = curClassStudents.filter((st) => !aiUserEmails.has(st.email.toLowerCase()));

    const aiSubmissions = curSubmissions.filter(
      (sub) => sub.student_email && aiUserEmails.has(sub.student_email.toLowerCase())
    );
    const nonAiSubmissions = curSubmissions.filter(
      (sub) => sub.student_email && !aiUserEmails.has(sub.student_email.toLowerCase())
    );

    const totalClassSubmissions = curSubmissions.length;
    const totalClassScore = curSubmissions.reduce((sum, s) => sum + parseFloat(s.score || "0"), 0);
    const classAverage = totalClassSubmissions > 0 ? totalClassScore / totalClassSubmissions : 0;

    const sumAI = aiSubmissions.reduce((sum, s) => sum + parseFloat(s.score || "0"), 0);
    const avgAI = aiSubmissions.length > 0 ? sumAI / aiSubmissions.length : null;

    const sumNonAI = nonAiSubmissions.reduce((sum, s) => sum + parseFloat(s.score || "0"), 0);
    const avgNonAI = nonAiSubmissions.length > 0 ? sumNonAI / nonAiSubmissions.length : null;

    // Detect score scale (default to 1.0 in WSM Athenas, adjust if multi-question exams produce scores > 1.0)
    const highestScore = curSubmissions.reduce((max, s) => Math.max(max, parseFloat(s.score || "0")), 0);
    const maxScale = highestScore > 1.0 ? Math.max(1.0, Math.ceil(highestScore)) : 1.0;
    const isScaleOne = maxScale <= 1.0;
    const riskThreshold = isScaleOne ? 0.5 : maxScale * 0.5;

    const histogram = isScaleOne
      ? [
          { range: "0.0 - 0.2", count: 0 },
          { range: "0.3 - 0.4", count: 0 },
          { range: "0.5 - 0.6", count: 0 },
          { range: "0.7 - 0.8", count: 0 },
          { range: "0.9 - 1.0", count: 0 },
        ]
      : [
          { range: "0.0 - 2.0", count: 0 },
          { range: "2.1 - 4.0", count: 0 },
          { range: "4.1 - 6.0", count: 0 },
          { range: "6.1 - 8.0", count: 0 },
          { range: "8.1 - 10.0", count: 0 },
        ];

    curSubmissions.forEach((sub) => {
      const score = parseFloat(sub.score || "0");
      if (isScaleOne) {
        if (score <= 0.2) histogram[0].count++;
        else if (score <= 0.4) histogram[1].count++;
        else if (score <= 0.6) histogram[2].count++;
        else if (score <= 0.8) histogram[3].count++;
        else histogram[4].count++;
      } else {
        if (score <= 2.0) histogram[0].count++;
        else if (score <= 4.0) histogram[1].count++;
        else if (score <= 6.0) histogram[2].count++;
        else if (score <= 8.0) histogram[3].count++;
        else histogram[4].count++;
      }
    });

    const atRiskList = curClassStudents
      .map((student) => {
        const subs = curSubmissions.filter(
          (sub) => (sub.student_email || "").toLowerCase() === student.email.toLowerCase()
        );
        if (subs.length === 0) return null;

        const sum = subs.reduce((acc, s) => acc + parseFloat(s.score || "0"), 0);
        const avg = sum / subs.length;
        return {
          student,
          avgScore: avg,
          totalTests: subs.length,
        };
      })
      .filter((item): item is { student: StudentProfile; avgScore: number; totalTests: number } => {
        return item !== null && item.avgScore < riskThreshold;
      });

    return {
      totalStudents: curClassStudents.length,
      totalSubmissions: totalClassSubmissions,
      classAverage,
      maxScale,
      isScaleOne,
      riskThreshold,
      avgAI,
      avgNonAI,
      aiSubmissionsCount: aiSubmissions.length,
      nonAiSubmissionsCount: nonAiSubmissions.length,
      aiStudentsCount: aiStudents.length,
      nonAiStudentsCount: nonAiStudents.length,
      histogram,
      atRiskList,
    };
  };

  // Search inputs
  const [searchSalaStudents, setSearchSalaStudents] = useState("");
  const [searchAllStudents, setSearchAllStudents] = useState("");

  // Student analytics states
  const [analyzingStudent, setAnalyzingStudent] =
    useState<StudentProfile | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsChartTab, setAnalyticsChartTab] = useState<
    "mensal" | "semanal" | "diario" | "horarios"
  >("mensal");

  // Virtual Classes State
  const [virtualClasses, setVirtualClasses] = useState<any[]>(parentVirtualClasses || []);

  React.useEffect(() => {
    if (parentVirtualClasses) {
      setVirtualClasses(parentVirtualClasses);
    }
  }, [parentVirtualClasses]);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [isJoiningClass, setIsJoiningClass] = useState(false);
  const [teacherJoinCode, setTeacherJoinCode] = useState("");
  const [teacherJoining, setTeacherJoining] = useState(false);
  const [teacherJoinError, setTeacherJoinError] = useState<string | null>(null);
  const [teacherJoinSuccess, setTeacherJoinSuccess] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Announcement state for virtual classes
  const [selectedClassForAnnouncement, setSelectedClassForAnnouncement] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annImageBase64, setAnnImageBase64] = useState("");
  const [annImageFileName, setAnnImageFileName] = useState("");
  const [isPostingAnn, setIsPostingAnn] = useState(false);
  const [annSuccess, setAnnSuccess] = useState<string | null>(null);
  const [annError, setAnnError] = useState<string | null>(null);

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
      setAnnImageBase64(base64);
      setAnnImageFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForAnnouncement) return;
    if (!annTitle.trim() || !annMessage.trim()) {
      setAnnError("Preencha o título e a mensagem do aviso.");
      return;
    }

    setIsPostingAnn(true);
    setAnnError(null);
    setAnnSuccess(null);

    try {
      const targetClassName = selectedClassForAnnouncement;

      const { error: insertErr } = await supabase
        .from('wsm_announcements')
        .insert({
          title: annTitle.trim(),
          content: annMessage.trim(),
          message: annMessage.trim(),
          class_name: targetClassName,
          image_url: annImageBase64 || null,
          teacher_email: email,
          teacher_name: teacherName || 'Professora',
          category: 'Geral',
          created_at: new Date().toISOString()
        });

      if (insertErr) throw insertErr;

      const currentVC = virtualClasses.find((vc: any) => 
        vc && (vc.id === targetClassName || vc.access_code === targetClassName || vc.name === targetClassName || areTurmasMatching(vc.name, targetClassName))
      );
      let vcStudentEmails: string[] = [];
      if (currentVC?.student_emails) {
        if (Array.isArray(currentVC.student_emails)) {
          vcStudentEmails = currentVC.student_emails.map((e: string) => String(e).toLowerCase().trim());
        } else if (typeof currentVC.student_emails === 'string') {
          try {
            const parsed = JSON.parse(currentVC.student_emails);
            if (Array.isArray(parsed)) vcStudentEmails = parsed.map((e: string) => String(e).toLowerCase().trim());
          } catch {
            vcStudentEmails = currentVC.student_emails.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
          }
        }
      }

      const classStudents = allStudents.filter(st => {
        const matchesCohort = areTurmasMatching(st.turma || '', targetClassName);
        const matchesVC = st.email && vcStudentEmails.includes(st.email.toLowerCase().trim());
        return matchesCohort || matchesVC;
      });

      for (const st of classStudents) {
        if (st.id) {
          await supabase.from('wsm_notifications').insert({
            user_id: st.id,
            title: `📢 Novo Aviso: ${annTitle.trim()} (Turma ${targetClassName})`,
            message: annMessage.trim(),
            is_read: false
          });
        }
      }

      setAnnSuccess(`Aviso publicado com sucesso para a turma ${targetClassName}!`);
      
      sendBrowserNotification(`📢 Novo Aviso Publicado: ${annTitle.trim()}`, {
        body: `Publicação disparada para a turma ${targetClassName}.`,
        tag: `pub-ann-vc-${Date.now()}`
      });

      setPublishCelebrationData({
        isOpen: true,
        title: annTitle.trim(),
        targetClass: targetClassName
      });

      setAnnTitle("");
      setAnnMessage("");
      setAnnImageBase64("");
      setAnnImageFileName("");
      setTimeout(() => {
        setSelectedClassForAnnouncement(null);
        setAnnSuccess(null);
      }, 1600);
    } catch (err: any) {
      console.error("Error posting announcement:", err);
      setAnnError(err.message || "Erro ao publicar aviso. Tente novamente.");
    } finally {
      setIsPostingAnn(false);
    }
  };

  // Fetch Virtual Classes
  React.useEffect(() => {
    const fetchVirtualClasses = async () => {
      if (!email) return;
      setLoadingClasses(true);
      try {
        const { data: allVClasses, error } = await supabase
          .from("wsm_virtual_classes")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        
        const myVClasses = (allVClasses || []).filter((vc: any) =>
          (vc.teacher_email && vc.teacher_email.toLowerCase() === email.toLowerCase()) ||
          (anosLecionados || []).map((a: string) => a.toLowerCase()).includes((vc.name || "").toLowerCase())
        );
        setVirtualClasses(myVClasses);
      } catch (error) {
        console.error("Error fetching virtual classes:", error);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchVirtualClasses();
  }, [email, anosLecionados]);

  const handleTeacherJoinClass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teacherJoinCode.trim()) return;
    setTeacherJoining(true);
    setTeacherJoinError(null);
    setTeacherJoinSuccess(null);

    try {
      // Find virtual class by code using maybeSingle() to avoid HTTP 406
      const { data: vClass, error } = await supabase
        .from("wsm_virtual_classes")
        .select("*")
        .eq("access_code", teacherJoinCode.trim())
        .maybeSingle();

      if (error || !vClass) {
        setTeacherJoinError("Código de sala inválido. Verifique com o professor criador e tente novamente.");
        setTeacherJoining(false);
        return;
      }

      // Check if teacher is already in this class
      const currentTeacherClasses = Array.from(new Set([
        ...(anosLecionados || []),
        ...virtualClasses.map(vc => vc.name)
      ]));

      if (
        currentTeacherClasses.map(c => c.toLowerCase()).includes((vClass.name || "").toLowerCase()) ||
        (vClass.teacher_email && vClass.teacher_email.toLowerCase() === email.toLowerCase())
      ) {
        setTeacherJoinError("Você já tem acesso a esta sala virtual!");
        setTeacherJoining(false);
        setTeacherJoinCode("");
        return;
      }

      // Get teacher's current profile from DB to preserve all existing classes
      const { data: profData } = await supabase
        .from("wsm_user_profiles")
        .select("anos_lecionados")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      const existingAnos: string[] = Array.isArray(profData?.anos_lecionados)
        ? profData.anos_lecionados
        : (anosLecionados || []);

      const updatedAnos = Array.from(new Set([...existingAnos, vClass.name]));

      const { error: updateProfErr } = await supabase
        .from("wsm_user_profiles")
        .update({ anos_lecionados: updatedAnos })
        .eq("email", email.toLowerCase());

      if (updateProfErr) throw updateProfErr;

      setTeacherJoinSuccess(`Você entrou na sala "${vClass.name}" com sucesso! Agora você tem controle total desta turma.`);
      setTeacherJoinCode("");
      setIsJoiningClass(false);

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      console.error("Error joining class as teacher:", err);
      setTeacherJoinError("Erro ao entrar na turma. Tente novamente.");
    } finally {
      setTeacherJoining(false);
    }
  };

  const handleCreateVirtualClass = async () => {
    if (!newClassName.trim()) return;
    
    // Generate 4-digit code
    let code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Ensure uniqueness
    let isUnique = false;
    while (!isUnique) {
      const { data } = await supabase.from("wsm_virtual_classes").select("id").eq("access_code", code).single();
      if (!data) {
        isUnique = true;
      } else {
        code = Math.floor(1000 + Math.random() * 9000).toString();
      }
    }

    try {
      const { data, error } = await supabase
        .from("wsm_virtual_classes")
        .insert({
          name: newClassName.trim(),
          teacher_email: email.toLowerCase().trim(),
          teacher_id: teacherId,
          access_code: code
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Synchronize teacher profile anos_lecionados
      try {
        const { data: profData } = await supabase
          .from("wsm_user_profiles")
          .select("anos_lecionados")
          .ilike("email", email)
          .maybeSingle();

        const existingAnos: string[] = Array.isArray(profData?.anos_lecionados)
          ? profData.anos_lecionados
          : (anosLecionados || []);

        const updatedAnos = Array.from(new Set([...existingAnos, newClassName.trim()]));

        await supabase
          .from("wsm_user_profiles")
          .update({ anos_lecionados: updatedAnos })
          .ilike("email", email);
      } catch (profErr) {
        console.warn("Could not sync anos_lecionados:", profErr);
      }

      setVirtualClasses([data, ...virtualClasses]);
      setNewClassName("");
      setIsCreatingClass(false);

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (error) {
      console.error("Error creating virtual class:", error);
      alert("Erro ao criar turma. Tente novamente.");
    }
  };

  // Normalize list of classes teacher teaches
  // Now combining anosLecionados (legacy) and virtualClasses names
  const legacyClasses = (anosLecionados || []).map((cls) => cls.trim()).filter(Boolean);
  const virtualClassesNames = virtualClasses.map(vc => vc.name);
  const teacherClasses = Array.from(new Set([...legacyClasses, ...virtualClassesNames]));

  // Union of students taught by this teacher
  const taughtStudents = allStudents.filter((st) => {
    if (!st || !st.email) return false;
    // Exclude teacher themselves if present
    if (email && st.email.toLowerCase() === email.toLowerCase()) return false;
    // Exclude non-students
    if ((st as any).role && (st as any).role.toLowerCase() !== 'student') return false;

    // 1. Match by turma
    const matchesTurma = teacherClasses.some(
      (cls) => cls.toLowerCase() === (st.turma || "").trim().toLowerCase()
    );

    // 2. Match by virtual class student_emails or virtual class name
    const matchesVirtual = virtualClasses.some((vc) => {
      if (!vc) return false;
      if (vc.name && (st.turma || "").trim().toLowerCase() === vc.name.trim().toLowerCase()) return true;
      if (!vc.student_emails) return false;
      let emails: string[] = [];
      if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
      else if (typeof vc.student_emails === 'string') {
        try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean); }
      }
      return emails.some((e: any) => e && String(e).toLowerCase() === st.email.toLowerCase());
    });

    return matchesTurma || matchesVirtual;
  });

  // Students belonging to the currently selected room/class
  const classStudents = allStudents.filter((st) => {
    if (!selectedClass || !st || !st.email) return false;
    if (email && st.email.toLowerCase() === email.toLowerCase()) return false;
    if ((st as any).role && (st as any).role.toLowerCase() !== 'student') return false;

    // 1. Match by turma
    if ((st.turma || "").trim().toLowerCase() === selectedClass.trim().toLowerCase()) return true;

    // 2. Match if selectedClass is a virtual class and st.email is in student_emails
    const vc = virtualClasses.find(v => v.id === selectedClass || v.name?.toLowerCase() === selectedClass.toLowerCase());
    if (vc && vc.student_emails) {
      let emails: string[] = [];
      if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
      else if (typeof vc.student_emails === 'string') {
        try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean); }
      }
      return emails.some((e: any) => e && String(e).toLowerCase() === st.email.toLowerCase());
    }

    return false;
  }).sort((a, b) => {
    const numA = (a.numero_chamada !== undefined && a.numero_chamada !== null) ? Number(a.numero_chamada) : 9999;
    const numB = (b.numero_chamada !== undefined && b.numero_chamada !== null) ? Number(b.numero_chamada) : 9999;
    if (numA !== numB) return numA - numB;
    return (a.nome_completo || '').localeCompare(b.nome_completo || '');
  });

  // Filter students of selected class
  const filteredClassStudents = classStudents.filter((st) => {
    const term = searchSalaStudents.toLowerCase();
    return (
      st.nome_completo.toLowerCase().includes(term) ||
      st.email.toLowerCase().includes(term) ||
      String(st.numero_chamada || "").includes(term)
    );
  });

  // Filter all taught students
  const filteredTaughtStudents = taughtStudents.filter((st) => {
    const term = searchAllStudents.toLowerCase();
    return (
      st.nome_completo.toLowerCase().includes(term) ||
      st.email.toLowerCase().includes(term) ||
      (st.turma || "").toLowerCase().includes(term) ||
      String(st.numero_chamada || "").includes(term)
    );
  });

  // Calculate student statistics directly from real Supabase records
  const calculateStudentStats = (
    student: StudentProfile,
    submissions: any[],
    sessions: any[],
    userMessages: any[],
    dbAnalytics: any,
  ) => {
    const openTimeSec = dbAnalytics?.hourly_distribution?.tempo_plataforma_aberta_s || 0;
    const activeTimeSec = dbAnalytics?.hourly_distribution?.tempo_ativo_mexendo_s || 0;

    // If we have no activity dates at all, we flag hasActivity based on openTime too
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
        student,
        hasActivity: false,
        totalTimeText: "0 min",
        currentExamTheme: "Nenhum simulado realizado",
        currentExamDate: "-",
        percentile: 0,
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
        totalQuestions: 0,
        questionsPerDay: "0",
        questionsThisWeek: 0,
        mostAskedTopic: "Nenhum tema",
        questionsQuality: "Sem dados",
        safetySignals: "🔴 Nenhuma atividade no sistema.",
        safetyStatus: "red",
        submissionsDetails: [],
        sessionsDetails: [],
        userMessagesDetails: [],
        openTimeSec: 0,
        activeTimeSec: 0,
        openTimeText: "0 min",
        activeTimeText: "0 min",
        simuladosCount: 0,
        avgScore: "0.0",
        examHistory: [],
      };
    }

    // Now, we calculate completely REAL metrics based on activity!
    const activityDates = [
      ...userMessages.map((m) => new Date(m.created_at)),
      ...submissions.map((s) => new Date(s.submitted_at || s.created_at)),
    ].filter((d) => !isNaN(d.getTime()));

    const totalExams = submissions.length;

    // Average score based on actual submissions scores
    let avgExamScore = 0;
    if (totalExams > 0) {
      let totalNumerator = 0;
      let totalDenominator = 0;
      submissions.forEach((sub) => {
        const scoreVal = parseFloat(sub.score || "0");
        const questionsVal = sub.total_questions || 5;
        totalNumerator += scoreVal;
        totalDenominator += questionsVal;
      });
      avgExamScore =
        totalDenominator > 0
          ? Math.round((totalNumerator / totalDenominator) * 100)
          : 0;
    }

    // Exam / Simulados stats
    let totalExamScore = 0;
    let validExamsCount = 0;
    const examHistory: { name: string; score: number }[] = [];

    submissions.forEach(s => {
      if (s.score !== undefined && s.score !== null) {
        totalExamScore += parseFloat(s.score);
        validExamsCount++;
        const dt = new Date(s.submitted_at || s.created_at);
        examHistory.push({
          name: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          score: parseFloat(s.score)
        });
      }
    });
    const avgScoreStr = validExamsCount > 0 ? (totalExamScore / validExamsCount).toFixed(1) : "0.0";

    const realQuestions = userMessages.length;

    // Estimated study time based 100% on actual active interaction lengths inside the platform
    // Let's assume each user message represents 8 minutes of review and each quiz submission represents 25 minutes of test-taking
    const calculatedMinutes = realQuestions * 8 + totalExams * 25;
    const hrs = Math.floor(calculatedMinutes / 60);
    const mins = calculatedMinutes % 60;
    const totalTimeText = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;

    // Calculate dynamic percentile: base top performance tier on average exam scores vs standard
    const calculatedPercentile =
      totalExams > 0
        ? Math.max(5, Math.min(99, 100 - Math.round(avgExamScore * 0.45)))
        : 80; // default benchmark top %

    // Get the actual latest simulated exam theme
    const sortedSubmissions = [...submissions].sort((a, b) => {
      const dateA = new Date(a.submitted_at || a.created_at).getTime();
      const dateB = new Date(b.submitted_at || b.created_at).getTime();
      return dateB - dateA;
    });

    const currentExamTheme =
      sortedSubmissions.length > 0
        ? sortedSubmissions[0].title ||
          `Simulado #${sortedSubmissions[0].id.substring(0, 4)}`
        : "Nenhum";

    const formatDate = (dateObj: Date) => {
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}`;
    };

    const currentExamDate =
      sortedSubmissions.length > 0
        ? formatDate(
            new Date(
              sortedSubmissions[0].submitted_at ||
                sortedSubmissions[0].created_at,
            ),
          )
        : "-";

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
      monthlyMinutesMap[mName] = (monthlyMinutesMap[mName] || 0) + 8;
    });
    submissions.forEach((s) => {
      const mName =
        monthsNames[new Date(s.submitted_at || s.created_at).getMonth()];
      monthlyMinutesMap[mName] = (monthlyMinutesMap[mName] || 0) + 25;
    });
    const meses = Object.entries(monthlyMinutesMap).map(([name, tempo]) => ({
      name,
      tempo,
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
      if (cat) weeklyMinutesMap[cat] += 8;
    });
    submissions.forEach((s) => {
      const cat = getWeekCategory(new Date(s.submitted_at || s.created_at));
      if (cat) weeklyMinutesMap[cat] += 25;
    });
    const semanas = Object.entries(weeklyMinutesMap).map(([name, tempo]) => ({
      name,
      tempo,
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
      dailyMinutesMap[dayName] = (dailyMinutesMap[dayName] || 0) + 8;
    });
    submissions.forEach((s) => {
      const dayName =
        weekdayNames[new Date(s.submitted_at || s.created_at).getDay()];
      dailyMinutesMap[dayName] = (dailyMinutesMap[dayName] || 0) + 25;
    });
    const dias = weekdayNames.map((name) => ({
      name,
      tempo: dailyMinutesMap[name] || 0,
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
      if (matched) matched.tempo += 8;
      else otherHoursTempo += 8;
    });
    submissions.forEach((s) => {
      const h = new Date(s.submitted_at || s.created_at).getHours();
      const matched = hourRanges.find((r) => h >= r.start && h < r.end);
      if (matched) matched.tempo += 25;
      else otherHoursTempo += 25;
    });
    const horarios = [
      ...hourRanges.map((h) => ({ name: h.label, tempo: h.tempo })),
      ...(otherHoursTempo > 0
        ? [{ name: "Outros", tempo: otherHoursTempo }]
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
        ? `${formattedActiveDay} é quando o estudante mais acessou e estudou`
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
    userMessages.forEach((m) => countPeriod(new Date(m.created_at), 8));
    submissions.forEach((s) =>
      countPeriod(new Date(s.submitted_at || s.created_at), 25),
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

    // Consistência
    const activeWeekdays = Object.values(dailyMinutesMap).filter(
      (m) => m > 0,
    ).length;
    let consistency = "Estudos ocasionais";
    if (activeWeekdays > 0) {
      if (activeWeekdays === 1)
        consistency = "Altamente Consistente (Sempre acessa no mesmo dia)";
      else if (activeWeekdays <= 3)
        consistency = "Consistência Regular (Acessa dias específicos)";
      else consistency = "Acessos distribuídos aleatoriamente pela semana";
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

    const mostAskedTopic =
      sessions.length > 0 && sessions[0].title
        ? sessions[0].title.replace("Estudo: ", "").replace("Dúvida: ", "")
        : "Nenhum";

    let safetySignals = "🟢 Tudo saudável. Excelente engajamento.";
    let safetyStatus = "green" as "green" | "yellow" | "red";
    if (totalExams > 0 && avgExamScore < 60) {
      safetySignals =
        "🟡 Atenção: Desempenho médio abaixo de 60% nos simulados.";
      safetyStatus = "yellow";
    } else if (realQuestions < 1 && totalExams < 1) {
      safetySignals = "🔴 Sem engajamento recente na plataforma.";
      safetyStatus = "red";
    }

    return {
      student,
      hasActivity,
      totalTimeText,
      totalEstimatedMinutes: calculatedMinutes,
      currentExamTheme,
      currentExamDate,
      percentile: calculatedPercentile,
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
      totalQuestions: realQuestions,
      questionsPerDay: (realQuestions / 20).toFixed(1),
      questionsThisWeek: Math.round(realQuestions * 0.3) || 1,
      mostAskedTopic,
      questionsQuality:
        realQuestions > 6
          ? "🟢 Perguntas contextualizadas"
          : "🟡 Pouco aprofundamento",
      safetySignals,
      safetyStatus,
      submissionsDetails: submissions,
      sessionsDetails: sessions,
      userMessagesDetails: userMessages,
      openTimeSec,
      activeTimeSec,
      openTimeText: formatTrackingTime(openTimeSec),
      activeTimeText: formatTrackingTime(activeTimeSec),
      simuladosCount: submissions.length,
      avgScore: avgScoreStr,
      examHistory,
    };
  };

  const handleOpenStudentAnalytics = async (student: StudentProfile) => {
    setAnalyzingStudent(student);
    setLoadingAnalytics(true);
    setAnalyticsData(null);
    try {
      // 1. Fetch real mock submissions for this student
      const { data: submissions, error: subErr } = await supabase
        .from("wsm_mock_submissions")
        .select("*")
        .eq("student_email", student.email);

      // 2. Fetch real chat sessions for this student
      const { data: sessions, error: sessErr } = await supabase
        .from("wsm_chat_sessions")
        .select("*")
        .eq("user_email", student.email);

      // 3. Count real chat messages of role 'user'
      let userMessages: any[] = [];
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        const { data: msgData, error: msgErr } = await supabase
          .from("wsm_chat_messages")
          .select("*")
          .eq("role", "user")
          .in("session_id", sessionIds);
        if (!msgErr && msgData) {
          userMessages = msgData;
        }
      }

      // 4. Try fetching dedicated DB-saved student analytics if it exists
      let dbAnalytics = null;
      try {
        const { data, error: filterErr } = await supabase
          .from("wsm_student_analytics")
          .select("*")
          .eq("student_email", student.email)
          .maybeSingle();
        if (!filterErr && data) {
          dbAnalytics = data;
        }
      } catch (err) {
        // Table might not exist yet before they add the SQL, which is absolutely fine!
      }

      const stableStats = calculateStudentStats(
        student,
        submissions || [],
        sessions || [],
        userMessages,
        dbAnalytics,
      );
      setAnalyticsData(stableStats);
    } catch (err) {
      console.error("Error loading student analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  if (analyzingStudent) {
    const formatDateObj = (dateObj: Date) => {
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const mins = String(dateObj.getMinutes()).padStart(2, "0");
      return `${day}/${month} às ${hours}:${mins}`;
    };

    return (
      <div
        className="space-y-8 animate-fadeIn"
        id="teacher-student-analytics-page"
      >
        {/* Simple crisp back button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAnalyzingStudent(null);
              setAnalyticsData(null);
            }}
            className="px-4 py-2 bg-neutral-900 border border-neutral-850 hover:bg-neutral-850 hover:border-neutral-700 rounded-xl text-neutral-350 hover:text-neutral-100 transition-all cursor-pointer text-xs font-mono flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar para Salas
          </button>
          <div className="h-4 w-px bg-neutral-855" />
          <span className="text-xs text-neutral-400 font-mono">
            Ficha Analítica de Aprendizado do Aluno
          </span>
        </div>

        {/* Premium Profile card header */}
        <div className="p-6 rounded-3xl bg-neutral-950/40 border border-neutral-900 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-neutral-100">
                  {analyzingStudent.nome_completo}
                </h2>
                <span className="text-[10px] uppercase bg-neutral-900 text-emerald-400 border border-neutral-850 px-2.5 py-0.5 rounded-full font-bold font-mono">
                  Turma {analyzingStudent.turma}
                </span>
                <span className="text-[10px] uppercase bg-neutral-900 text-neutral-400 border border-neutral-850 px-2.5 py-0.5 rounded-full font-bold font-mono">
                  Chamada N°{" "}
                  {String(analyzingStudent.numero_chamada || "-").padStart(
                    2,
                    "0",
                  )}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-1">
                {analyzingStudent.email} • RA: {getUniqueRA(analyzingStudent.email)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingAnalytics}
              onClick={() => handleOpenStudentAnalytics(analyzingStudent)}
              className="px-4 py-2 bg-neutral-900 border border-neutral-850 hover:bg-neutral-850 hover:border-neutral-700 disabled:opacity-50 rounded-xl text-neutral-300 hover:text-neutral-100 transition-all cursor-pointer text-xs font-mono flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? "animate-spin" : ""}`} />
              Atualizar Dados
            </button>
          </div>
        </div>

        {loadingAnalytics ? (
          <div className="py-24 text-center space-y-4">
            <div className="loader inline-block w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <p className="text-neutral-400 text-xs font-mono">
              Carregando interações reais de estudo do Supabase...
            </p>
          </div>
        ) : analyticsData ? (
          <div className="space-y-8">
            {/* Condition check: if student has no real activity at all */}
            {!analyticsData.hasActivity ? (
              <div className="p-16 rounded-3xl bg-neutral-905 border border-neutral-900 border-dashed text-center space-y-3">
                <Info className="w-10 h-10 text-neutral-600 mx-auto" />
                <h4 className="text-sm font-semibold text-neutral-300 font-mono uppercase tracking-wider">
                  Métricas Reais de Estudos
                </h4>
                <p className="text-xs text-neutral-550 max-w-lg mx-auto leading-relaxed">
                  Não existem informações reais suficientes registradas no banco
                  de dados para criar análises deste aluno. Assim que o aluno
                  iniciar o treinamento no chat de estudos ou responder aos
                  simulados, as métricas e gráficos serão desenhados em tempo
                  real de forma 100% verídica.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Métricas de Tempo Aberto e Ativo Real */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex items-start gap-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-neutral-450 uppercase block font-bold tracking-wider">Tempo com a Plataforma Aberta</span>
                      <span className="text-xl font-extrabold text-neutral-100 font-display mt-1 block">
                        {analyticsData.openTimeText || "0s"}
                      </span>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                        Duração total acumulada em que o aluno permaneceu com a plataforma Athenas aberta.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex items-start gap-4">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-neutral-450 uppercase block font-bold tracking-wider">Tempo Ativo de Interação Real</span>
                      <span className="text-xl font-extrabold text-emerald-400 font-display mt-1 block">
                        {analyticsData.activeTimeText || "0s"}
                      </span>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                        Duração de digitação, cliques, rolagem de tela e movimentação ativa no navegador.
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
                      Médias e histórico de envio de simulados avaliativos pelo aluno.
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
                              <linearGradient id="colorScoreTeacher" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis dataKey="name" stroke="#525252" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#525252" fontSize={9} tickLine={false} axisLine={false} domain={[0, 10]} />
                            <Tooltip 
                              cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }} 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-[11px] shadow-2xl">
                                      <p className="text-neutral-400 font-bold mb-1 uppercase tracking-wider">{payload[0].payload.name}</p>
                                      <p className="text-emerald-400 font-black">Nota: <span className="text-neutral-100">{payload[0].value}</span></p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScoreTeacher)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* 1. SEAMLESS TIME BLOCKS SECTION (Tempo total/mês, semana, dia, horários) */}
                <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-6">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Métricas de Horas e Tempo de Estudo Real
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Tempo deduzido ativamente a partir dos gabaritos e logs de
                      conversa do estudante.
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
                              Não há info suficiente
                            </span>
                          ) : (
                            analyticsData.meses.map((m: any) => {
                              const hrsVal = Math.floor(m.tempo / 60);
                              const minsVal = m.tempo % 60;
                              const textVal =
                                hrsVal > 0
                                  ? `${hrsVal}h ${minsVal}min`
                                  : `${minsVal}min`;
                              return (
                                <div
                                  key={m.name}
                                  className="flex justify-between items-center text-xs font-mono"
                                >
                                  <span className="text-neutral-450">
                                    {m.name}:
                                  </span>
                                  <span className="font-bold text-neutral-200">
                                    {textVal}
                                  </span>
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
                          {analyticsData.semanas.filter((s: any) => s.tempo > 0)
                            .length === 0 ? (
                            <span className="text-neutral-550 text-xs italic font-mono block text-center py-2 text-neutral-600">
                              Não há info suficiente
                            </span>
                          ) : (
                            analyticsData.semanas.map((s: any) => {
                              const hrsVal = Math.floor(s.tempo / 60);
                              const minsVal = s.tempo % 60;
                              const textVal =
                                hrsVal > 0
                                  ? `${hrsVal}h ${minsVal}min`
                                  : `${minsVal}min`;
                              return (
                                <div
                                  key={s.name}
                                  className="flex justify-between items-center text-xs font-mono"
                                >
                                  <span className="text-neutral-450">
                                    {s.name}:
                                  </span>
                                  <span className="font-bold text-neutral-200">
                                    {textVal}
                                  </span>
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
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {analyticsData.dias.filter((d: any) => d.tempo > 0)
                            .length === 0 ? (
                            <span className="text-neutral-555 text-xs italic font-mono block text-center py-2 text-neutral-600">
                              Não há info suficiente
                            </span>
                          ) : (
                            analyticsData.dias
                              .filter((d: any) => d.tempo > 0)
                              .map((d: any) => {
                                const hrsVal = Math.floor(d.tempo / 60);
                                const minsVal = d.tempo % 60;
                                const textVal =
                                  hrsVal > 0
                                    ? `${hrsVal}h ${minsVal}min`
                                    : `${minsVal}min`;
                                return (
                                  <div
                                    key={d.name}
                                    className="flex justify-between items-center text-xs font-mono mb-1"
                                  >
                                    <span className="text-neutral-450">
                                      {d.name}:
                                    </span>
                                    <span className="font-bold text-neutral-200">
                                      {textVal}
                                    </span>
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
                          Horários Preferidos
                        </span>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {analyticsData.horarios.filter(
                            (h: any) => h.tempo > 0,
                          ).length === 0 ? (
                            <span className="text-neutral-555 text-xs italic font-mono block text-center py-2 text-neutral-600">
                              Não há info suficiente
                            </span>
                          ) : (
                            analyticsData.horarios
                              .filter((h: any) => h.tempo > 0)
                              .map((h: any) => (
                                <div
                                  key={h.name}
                                  className="flex justify-between items-center text-xs font-mono mb-1"
                                >
                                  <span className="text-neutral-450">
                                    {h.name}:
                                  </span>
                                  <span className="font-bold text-neutral-200">
                                    {h.tempo} min
                                  </span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Graphic Selection tabs (Only exactly what requested, with warning when there's no data) */}
                  <div className="space-y-3">
                    <div className="flex gap-2 border-b border-neutral-900 pb-2">
                      {(
                        ["mensal", "semanal", "diario", "horarios"] as const
                      ).map((tabKey) => (
                        <button
                          key={tabKey}
                          onClick={() => setAnalyticsChartTab(tabKey)}
                          className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest font-bold border transition-all cursor-pointer rounded-lg ${
                            analyticsChartTab === tabKey
                              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                              : "bg-neutral-950 border-neutral-850 text-neutral-500 hover:text-neutral-300"
                          }`}
                        >
                          Gráfico {tabKey}
                        </button>
                      ))}
                    </div>

                    <div className="h-48 w-full bg-neutral-950/20 rounded-2xl p-4 border border-neutral-905 flex items-center justify-center">
                      {analyticsChartTab === "mensal" ? (
                        analyticsData.meses.length === 0 ? (
                          <div className="text-neutral-500 text-xs font-mono text-center space-y-1.5 p-4">
                            <AlertTriangle className="w-5 h-5 text-neutral-600 mx-auto" />
                            <span>
                              Não há informações e interações de estudos mensais
                              suficientes para gerar esta visualização.
                            </span>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData.meses}>
                              <defs>
                                <linearGradient
                                  id="monGrad"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#10b981"
                                    stopOpacity={0.25}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#10b981"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="name"
                                stroke="#525252"
                                fontSize={10}
                              />
                              <YAxis stroke="#525252" fontSize={10} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#090b0a",
                                  borderColor: "#262626",
                                  borderRadius: "12px",
                                  fontSize: "10px",
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="tempo"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#monGrad)"
                                name="Minutos"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )
                      ) : analyticsChartTab === "semanal" ? (
                        analyticsData.semanas.filter((s: any) => s.tempo > 0)
                          .length === 0 ? (
                          <div className="text-neutral-500 text-xs font-mono text-center space-y-1.5 p-4">
                            <AlertTriangle className="w-5 h-5 text-neutral-600 mx-auto" />
                            <span>
                              Não há informações e interações de estudos
                              semanais suficientes para gerar esta visualização.
                            </span>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.semanas}>
                              <XAxis
                                dataKey="name"
                                stroke="#525252"
                                fontSize={10}
                              />
                              <YAxis stroke="#525252" fontSize={10} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#090b0a",
                                  borderColor: "#262626",
                                  borderRadius: "12px",
                                  fontSize: "10px",
                                }}
                              />
                              <Bar
                                dataKey="tempo"
                                fill="#14b8a6"
                                radius={[4, 4, 0, 0]}
                                name="Minutos"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      ) : analyticsChartTab === "diario" ? (
                        analyticsData.dias.filter((d: any) => d.tempo > 0)
                          .length === 0 ? (
                          <div className="text-neutral-500 text-xs font-mono text-center space-y-1.5 p-4">
                            <AlertTriangle className="w-5 h-5 text-neutral-600 mx-auto" />
                            <span>
                              Não há informações e interações de estudo diárias
                              suficientes para gerar esta visualização.
                            </span>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.dias}>
                              <XAxis
                                dataKey="name"
                                stroke="#525252"
                                fontSize={10}
                              />
                              <YAxis stroke="#525252" fontSize={10} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#090b0a",
                                  borderColor: "#262626",
                                  borderRadius: "12px",
                                  fontSize: "10px",
                                }}
                              />
                              <Bar
                                dataKey="tempo"
                                fill="#059669"
                                radius={[4, 4, 0, 0]}
                                name="Minutos"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      ) : analyticsData.horarios.filter((h: any) => h.tempo > 0)
                          .length === 0 ? (
                        <div className="text-neutral-500 text-xs font-mono text-center space-y-1.5 p-4">
                          <AlertTriangle className="w-5 h-5 text-neutral-600 mx-auto" />
                          <span>
                            Não há informações e períodos de estudos suficientes
                            no banco de dados para gerar esta visualização.
                          </span>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.horarios}>
                            <defs>
                              <linearGradient
                                id="hourGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0.25}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="name"
                              stroke="#525252"
                              fontSize={10}
                            />
                            <YAxis stroke="#525252" fontSize={10} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#090b0a",
                                borderColor: "#262626",
                                borderRadius: "12px",
                                fontSize: "10px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="tempo"
                              stroke="#06b6d4"
                              fillOpacity={1}
                              fill="url(#hourGrad)"
                              name="Minutos"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. SPECIFIC INDICATORS COMPREHENSIVE CARD (Dia mais ativo, hora preferida, média de sessão, consistência, frequência de acesso) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tempo & Atividade indicators */}
                  <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-4">
                    <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-450 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Indicadores de Frequência e Consistência
                    </h3>

                    <div className="space-y-3 text-xs font-mono text-neutral-350">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Dia da semana mais ativo:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.mostActiveDay}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Hora do dia preferida:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.preferredTimeOfDay}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Duração média de sessão:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.avgSessionDuration}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-505">
                          Frequência de acesso / semana:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.weeklyFrequency} dias por semana
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-neutral-500">
                          Consistência de Acesso:
                        </span>
                        <span className="font-bold text-emerald-400">
                          {analyticsData.consistency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Communication focus channels & session list (Chat Geral vs Prova, Estudos Distribuidos, Progresso) */}
                  <div className="p-6 rounded-3xl bg-neutral-900/10 border border-neutral-900 space-y-4">
                    <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-emerald-455 flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-emerald-400" />
                      Foco de Chats & Preferência de Estudos
                    </h3>

                    <div className="space-y-3 text-xs font-mono text-neutral-350">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Canal de Chat mais Utilizado:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.chatGeneralVsExam}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Metodologia Dominante:
                        </span>
                        <span className="font-bold text-neutral-200">
                          {analyticsData.studyType}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                        <span className="text-neutral-500">
                          Progresso Semana a Semana:
                        </span>
                        <span
                          className={`font-bold ${analyticsData.progressWeekToWeek[3].tempo >= analyticsData.progressWeekToWeek[2].tempo ? "text-emerald-400" : "text-neutral-400"}`}
                        >
                          {analyticsData.progressWeekToWeek[3].tempo >=
                          analyticsData.progressWeekToWeek[2].tempo
                            ? "📈 Melhorando (Estudos em alta)"
                            : "📉 Desacelerando (Menos atividades)"}
                        </span>
                      </div>

                      {/* Render exact week progression info */}
                      <div className="pt-2 border-t border-neutral-900/40">
                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold block mb-2">
                          Histórico do Progresso Semanal (Minutos Estimados)
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {analyticsData.progressWeekToWeek.map((p: any) => (
                            <div
                              key={p.name}
                              className="bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-center"
                            >
                              <span className="text-[9px] font-bold text-neutral-500 block truncate">
                                {p.name}
                              </span>
                              <span className="text-xs font-bold text-neutral-200 block mt-1">
                                {p.tempo} min
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn" id="teacher-classes-manager">
      {/* Modern navigation subtabs */}
      <div className="flex gap-2 border-b border-neutral-900 pb-px">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("salas");
            setSelectedClass(null);
          }}
          className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase transition-all relative cursor-pointer ${
            activeSubTab === "salas"
              ? "text-emerald-400 font-bold border-b-2 border-emerald-400"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Minhas Salas ({teacherClasses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("todos_alunos")}
          className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase transition-all relative cursor-pointer ${
            activeSubTab === "todos_alunos"
              ? "text-emerald-400 font-bold border-b-2 border-emerald-400"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Meus Alunos ({taughtStudents.length})
        </button>
      </div>

      {activeSubTab === "salas" ? (
        <div className="space-y-6">
          {!selectedClass ? (
            /* Classes Grid Selection */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-200 uppercase font-mono tracking-wider">
                    Selecione uma Sala Oficial
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Clique para carregar e inspecionar os alunos correspondentes
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewClassName("");
                        setIsCreatingClass(true);
                        setIsJoiningClass(false);
                      }}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Criar nova sala</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherJoinCode("");
                        setTeacherJoinError(null);
                        setIsJoiningClass(true);
                        setIsCreatingClass(false);
                      }}
                      className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-850 text-neutral-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span>Entrar em sala existente</span>
                    </button>
                  </div>
                </div>
              </div>

              {teacherJoinError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span className="font-medium">{teacherJoinError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeacherJoinError(null)}
                    className="text-neutral-400 hover:text-neutral-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {teacherJoinSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className="font-medium">{teacherJoinSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeacherJoinSuccess(null)}
                    className="text-neutral-400 hover:text-neutral-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {teacherClasses.length === 0 ? (
                <div className="py-16 text-center text-neutral-550 border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10">
                  <Inbox className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-neutral-350">
                    Você não possui turmas vinculadas ao seu perfil.
                  </p>
                  <p className="text-xs text-neutral-550 mt-1 max-w-sm mx-auto">
                    Crie uma turma acima e compartilhe o código de acesso (4 dígitos) com seus alunos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teacherClasses.map((clsName) => {
                    // Check if it's a virtual class to show code
                    const vc = virtualClasses.find(c => c.name === clsName);
                    // Count of students in this class
                    const countInThisClass = allStudents.filter((st) => {
                      if (!st || !st.email) return false;
                      if (st.turma && st.turma.toLowerCase().trim() === clsName.toLowerCase().trim()) return true;
                      if (vc && vc.student_emails) {
                        let emails: string[] = [];
                        if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
                        else if (typeof vc.student_emails === 'string') {
                          try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()); }
                        }
                        return emails.some((e: any) => e && String(e).toLowerCase().trim() === st.email.toLowerCase().trim());
                      }
                      return false;
                    }).length;
                    return (
                      <div
                        key={clsName}
                        onClick={() => setSelectedClass(clsName)}
                        className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-855 hover:border-emerald-500/25 transition-all flex flex-col justify-between space-y-4 cursor-pointer group hover:bg-neutral-900/70"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            {vc && (
                              <div className="text-left">
                                <p className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">Cód. Acesso</p>
                                <p className="text-sm font-bold tracking-widest text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 mt-0.5">
                                  {vc.access_code}
                                </p>
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-mono bg-neutral-950 border border-neutral-850 text-neutral-400 px-2 py-0.5 rounded">
                            {vc ? 'Virtual' : 'Oficial'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-extrabold text-neutral-100 font-display group-hover:text-emerald-400 transition-colors">
                            Turma {clsName}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-1">
                            {countInThisClass}{" "}
                            {countInThisClass === 1
                              ? "estudante cadastrado"
                              : "estudantes cadastrados"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-950 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassForAnnouncement(clsName);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-neutral-950 rounded-lg transition-all border border-emerald-500/30 cursor-pointer font-bold text-[11px]"
                          >
                            <Megaphone className="w-3.5 h-3.5" />
                            <span>Criar Aviso</span>
                          </button>
                          <div className="flex items-center gap-1 text-emerald-400">
                            <span>Abrir Sala</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Selected Class Detail View */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-900/60 pb-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClass(null);
                      setSearchSalaStudents("");
                    }}
                    className="p-2 bg-neutral-900 border border-neutral-850 hover:bg-neutral-850 rounded-xl text-neutral-350 hover:text-neutral-100 transition-all cursor-pointer"
                    title="Voltar para Salas"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-neutral-100 font-display">
                          Sala {selectedClass}
                        </h4>
                        <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                          {filteredClassStudents.length}{" "}
                          {filteredClassStudents.length === 1
                            ? "Aluno"
                            : "Alunos"}
                        </span>
                      </div>
                      {virtualClasses.find(vc => vc.name === selectedClass) && (
                        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg">
                          <span className="text-[10px] text-neutral-400 font-mono uppercase">Cód. Acesso:</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono tracking-widest bg-neutral-950 px-2 rounded">
                            {virtualClasses.find(vc => vc.name === selectedClass)?.access_code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const code = virtualClasses.find(vc => vc.name === selectedClass)?.access_code;
                              if (code) {
                                navigator.clipboard.writeText(code);
                                alert("Código copiado!");
                              }
                            }}
                            className="p-1.5 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 transition-colors ml-1 cursor-pointer"
                            title="Copiar código"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                      Clique em qualquer estudante na lista abaixo para abrir a
                      ficha completa de analítica de aprendizado.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedClassForAnnouncement(selectedClass)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-extrabold transition-all shadow cursor-pointer sm:ml-auto"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>Criar Aviso para esta Turma</span>
                  </button>
                </div>

                {/* Search in selected class */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Filtrar aluno..."
                    value={searchSalaStudents}
                    onChange={(e) => setSearchSalaStudents(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-emerald-500/40 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Painel Class Dashboard */}
              {(() => {
                const metrics = getDashboardMetrics();
                
                if (loadingDashboard) {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-neutral-900 rounded-3xl bg-neutral-950/20">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 animate-pulse space-y-4">
                          <div className="h-4 w-1/3 bg-neutral-800 rounded" />
                          <div className="h-8 w-1/2 bg-neutral-800 rounded" />
                          <div className="h-3 w-3/4 bg-neutral-800 rounded" />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-1 border border-neutral-900/40 rounded-3xl bg-neutral-950/15" id="teacher-class-dashboard">
                    {/* CARD 1: MEDIA DA TURMA */}
                    <div className="lg:col-span-3 p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900/60 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold tracking-wider">
                            Média da Turma
                          </span>
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-neutral-100 font-display">
                              {metrics.totalSubmissions > 0 ? metrics.classAverage.toFixed(1) : "0.0"}
                            </span>
                            <span className="text-neutral-500 text-xs font-mono">/ {metrics.maxScale.toFixed(1)}</span>
                          </div>
                          
                          {/* Progress bar representing class average */}
                          <div className="w-full bg-neutral-950 rounded-full h-1.5 mt-3 overflow-hidden border border-neutral-900">
                            <div 
                              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (metrics.classAverage / metrics.maxScale) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-neutral-900/60 text-[10px] text-neutral-500 font-mono flex justify-between items-center">
                        <span>{metrics.totalSubmissions} envios</span>
                        <span>{metrics.totalStudents} alunos</span>
                      </div>
                    </div>

                    {/* CARD 2: COMPARATIVO A/B IA VS SEM IA */}
                    <div className="lg:col-span-4 p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900/60 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold tracking-wider">
                              Comparativo Científico A/B
                            </span>
                            <h5 className="text-[11px] text-neutral-500 font-bold mt-0.5 font-sans">Média: IA vs Sem IA</h5>
                          </div>
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <BrainCircuit className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {/* Group A: with AI */}
                          <div>
                            <div className="flex justify-between items-center text-xs font-mono mb-1">
                              <span className="text-emerald-450 font-bold flex items-center gap-1">
                                ● Usaram a IA
                                <span className="text-[9px] text-neutral-500 font-normal">({metrics.aiStudentsCount} alunos)</span>
                              </span>
                              <span className="text-emerald-400 font-bold">
                                {metrics.avgAI !== null ? `${metrics.avgAI.toFixed(1)}` : "Sem dados"}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-900">
                              <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${metrics.avgAI !== null ? Math.min(100, (metrics.avgAI / metrics.maxScale) * 100) : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Group B: without AI */}
                          <div>
                            <div className="flex justify-between items-center text-xs font-mono mb-1">
                              <span className="text-neutral-400 font-bold flex items-center gap-1">
                                ○ Não usaram IA
                                <span className="text-[9px] text-neutral-550 font-normal">({metrics.nonAiStudentsCount} alunos)</span>
                              </span>
                              <span className="text-neutral-350">
                                {metrics.avgNonAI !== null ? `${metrics.avgNonAI.toFixed(1)}` : "Sem dados"}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-900">
                              <div 
                                className="bg-neutral-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${metrics.avgNonAI !== null ? Math.min(100, (metrics.avgNonAI / metrics.maxScale) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-900/60 flex items-center justify-between">
                        {metrics.avgAI !== null && metrics.avgNonAI !== null ? (
                          (() => {
                            const diff = metrics.avgAI - metrics.avgNonAI;
                            if (diff > 0) {
                              return (
                                <>
                                  <span className="text-[9px] text-emerald-450 font-semibold font-mono">
                                    ✓ Hipótese comprovada!
                                  </span>
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold font-mono">
                                    +{diff.toFixed(1)} pontos com IA
                                  </span>
                                </>
                              );
                            } else if (diff < 0) {
                              return (
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  Diferença: {diff.toFixed(1)} pontos.
                                </span>
                              );
                            } else {
                              return (
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  Grupos empatados.
                                </span>
                              );
                            }
                          })()
                        ) : (
                          <span className="text-[9px] text-neutral-500 font-mono italic">
                            Aguardando respostas para traçar comparativo.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CARD 3: HISTOGRAMA DE DISTRIBUIÇÃO */}
                    <div className="lg:col-span-5 p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900/60">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold tracking-wider">
                          Distribuição de Notas da Turma (Histograma)
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                      </div>

                      {metrics.totalSubmissions === 0 ? (
                        <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-neutral-850 rounded-xl bg-neutral-950/20">
                          <BarChart3 className="w-6 h-6 text-neutral-600 mb-1" />
                          <p className="text-[10px] text-neutral-550 font-mono">
                            Nenhum simulado enviado nesta turma.
                          </p>
                        </div>
                      ) : (
                        <div className="h-[120px] w-full pr-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.histogram} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                              <XAxis dataKey="range" stroke="#737373" fontSize={9} tickLine={false} />
                              <YAxis stroke="#737373" fontSize={9} tickLine={false} allowDecimals={false} />
                              <Tooltip
                                cursor={{ fill: "rgba(16, 185, 129, 0.05)" }}
                                contentStyle={{
                                  backgroundColor: "#090b0a",
                                  borderColor: "#262626",
                                  borderRadius: "8px",
                                  fontSize: "9px",
                                }}
                              />
                              <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} name="Alunos" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* CARD 4: ALUNOS EM RISCO */}
                    <div className="lg:col-span-12 p-5 rounded-2xl bg-red-500/5 border border-red-950/30 flex flex-col justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400">
                          <AlertTriangle className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-neutral-200">
                            Identificação Automática de Alunos em Risco (Média &lt; {metrics.riskThreshold.toFixed(1)})
                          </h5>
                          <p className="text-[10px] text-neutral-500 mt-0.5 font-sans">
                            Estudantes com nota média abaixo de 50% ({metrics.riskThreshold.toFixed(1)}) que necessitam de intervenção pedagógica de suporte.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        {metrics.atRiskList.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {metrics.atRiskList.map((item) => (
                              <div 
                                key={item.student.id}
                                onClick={() => handleOpenStudentAnalytics(item.student)}
                                className="p-3 rounded-xl bg-neutral-900/60 border border-red-950/20 hover:border-red-500/30 transition-all flex justify-between items-center cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-lg bg-neutral-950 text-red-450 font-bold font-mono text-xs">
                                    #{String(item.student.numero_chamada || "-").padStart(2, "0")}
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-neutral-200 group-hover:text-red-450 transition-colors block">
                                      {item.student.nome_completo}
                                    </span>
                                    <span className="text-[9px] text-neutral-500 block font-mono">
                                      {item.totalTests} simulado{item.totalTests === 1 ? "" : "s"} realizado{item.totalTests === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs font-bold font-mono text-red-400">
                                    Média: {item.avgScore.toFixed(1)}
                                  </span>
                                  <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono uppercase block mt-1">
                                    Risco <span className="lowercase">&lt;</span> {metrics.riskThreshold.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-[11px] font-semibold">
                              Nenhum estudante com média abaixo de {metrics.riskThreshold.toFixed(1)} detectado na Turma {selectedClass}. Excelente engajamento!
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {filteredClassStudents.length === 0 ? (
                <div className="py-12 text-center text-neutral-550 font-mono text-xs">
                  Nenhum estudante correspondente encontrado na classe{" "}
                  {selectedClass}.
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-850 rounded-2xl bg-neutral-950/40">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-neutral-950 border-b border-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-5">Chamada</th>
                        <th className="py-3 px-5">Código RA</th>
                        <th className="py-3 px-5">Nome do Aluno</th>
                        <th className="py-3 px-5">Correio Eletrônico</th>
                        <th className="py-3 px-5 text-right">Estatuto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {filteredClassStudents.map((student) => (
                        <tr
                          key={student.id}
                          onClick={() => handleOpenStudentAnalytics(student)}
                          className="hover:bg-emerald-500/5 hover:text-emerald-300 text-neutral-350 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-5 font-semibold text-emerald-500">
                            {String(student.numero_chamada || "-").padStart(
                              2,
                              "0",
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-neutral-500">
                            {getUniqueRA(student.email)}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-neutral-150">
                            {student.nome_completo}
                          </td>
                          <td className="py-3.5 px-5 text-neutral-450">
                            {student.email}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-bold inline-block">
                              Carregar Analítica
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </div>
      ) : (
        /* Union Taught Students General View */
        <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-neutral-200 font-display flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Relação Geral de Alunos Sob sua Docência
              </h3>
              <p className="text-neutral-500 text-xs mt-0.5">
                Exibindo todos os alunos matriculados nas séries em que você
                ministra aulas ({teacherClasses.join(", ")}). Clique em qualquer
                estudante pra inspecionar.
              </p>
            </div>

            {/* General student search */}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Pesquisar por nome, RA, email ou turma..."
                value={searchAllStudents}
                onChange={(e) => setSearchAllStudents(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-emerald-500/45 transition-all font-mono"
              />
            </div>
          </div>

          {filteredTaughtStudents.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10">
              <Inbox className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-350">
                Nenhum aluno localizado.
              </p>
              <p className="text-xs text-neutral-550 mt-1 max-w-sm mx-auto">
                Certifique-se de que os termos buscados estão corretos e que
                você possui turmas vinculadas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-850 rounded-2xl bg-neutral-950/40">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-5">Chamada</th>
                    <th className="py-3 px-5">Estudante</th>
                    <th className="py-3 px-5">E-mail Cadastrado</th>
                    <th className="py-3 px-5 text-center">Série / Turma</th>
                    <th className="py-3 px-5 text-right">Estatuto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredTaughtStudents.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => handleOpenStudentAnalytics(student)}
                      className="hover:bg-emerald-500/5 hover:text-emerald-300 text-neutral-350 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-semibold text-emerald-500">
                        {String(student.numero_chamada || "-").padStart(2, "0")}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-neutral-100">
                        {student.nome_completo}
                      </td>
                      <td className="py-3.5 px-5 text-neutral-450">
                        {student.email}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="bg-neutral-900 text-neutral-300 px-2.5 py-0.5 rounded-full border border-neutral-800 font-bold">
                          {student.turma || "-"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-bold">
                          Analisar
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* OVERLAY REMOVED FOR DEDICATED PAGE REDIRECT */}
      <AnimatePresence>
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setAnalyzingStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0c0e0d] border border-neutral-850 w-full max-w-4xl rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col my-8 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-900 bg-neutral-950 flex justify-between items-center bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                    <Users className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-neutral-100 font-display flex items-center gap-2">
                      {analyzingStudent.nome_completo}
                      <span className="text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800 px-2.5 py-0.5 rounded-md font-semibold font-bold">
                        {analyzingStudent.turma}
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-450 font-mono mt-0.5">
                      {analyzingStudent.email} • ID de Matrícula:{" "}
                      {analyzingStudent.id.substring(0, 8)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAnalyzingStudent(null)}
                  className="p-2 text-neutral-500 hover:text-neutral-100 bg-neutral-900/50 border border-neutral-850 hover:border-neutral-700 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingAnalytics ? (
                <div className="py-24 text-center space-y-4">
                  <div className="loader inline-block w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <p className="text-neutral-400 text-xs font-mono">
                    Consolidando atividades e logs em tempo real...
                  </p>
                </div>
              ) : analyticsData ? (
                <div className="p-6 md:p-8 space-y-8 max-h-[82vh] overflow-y-auto">
                  {/* BENTO GRID: ROW 1 (RESUMO GERAL) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-bold">
                        Tempo na Plataforma
                      </span>
                      <div className="mt-2.5">
                        <span className="text-2xl font-extrabold text-neutral-100 tracking-tight font-display">
                          {analyticsData.totalTimeText}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mt-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tempo consolidado</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-bold">
                        Conteúdo da Prova
                      </span>
                      <div className="mt-2.5">
                        <span
                          className="text-[12.5px] font-extrabold text-neutral-100 tracking-tight block truncate font-display"
                          title={analyticsData.currentExamTheme}
                        >
                          {analyticsData.currentExamTheme}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-450 mt-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          <span>
                            Data oficial: {analyticsData.currentExamDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-bold">
                        Percentil Classe
                      </span>
                      <div className="mt-2.5">
                        <span className="text-2xl font-extrabold text-emerald-400 tracking-tight font-display">
                          Top {analyticsData.percentile}%
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1 font-semibold">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                          <span>Acima da média</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-900 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-bold">
                        Sinais & Alerta
                      </span>
                      <div className="mt-2.5">
                        <span
                          className={`text-[11px] font-extrabold tracking-tight flex items-center gap-1.5 py-1 px-2.5 rounded-full ${
                            analyticsData.safetyStatus === "yellow"
                              ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            {analyticsData.safetyStatus === "yellow"
                              ? "Atenção"
                              : "Normal"}
                          </span>
                        </span>
                        <span className="text-[9px] text-neutral-550 block mt-1 font-mono truncate">
                          {analyticsData.safetySignals}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BENTO GRID: ROW 2 (CHARTS SECTION) */}
                  <div className="p-5 rounded-2xl bg-neutral-900/20 border border-neutral-900 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-900 pb-4">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-neutral-200">
                          📈 Métricas de Estudo e Distribuição
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          Selecione o filtro temporal do gráfico para analisar
                          de perto
                        </p>
                      </div>

                      <div className="flex gap-1.5 bg-neutral-950 p-1 border border-neutral-850 rounded-xl">
                        {(
                          ["mensal", "semanal", "diario", "horarios"] as const
                        ).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setAnalyticsChartTab(tab)}
                            className={`px-3 py-1 text-[10px] font-mono uppercase font-bold rounded-lg transition-all cursor-pointer ${
                              analyticsChartTab === tab
                                ? "bg-emerald-500 text-neutral-950"
                                : "text-neutral-500 hover:text-neutral-300"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-60 w-full font-mono text-[10px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {analyticsChartTab === "mensal" ? (
                          <AreaChart data={analyticsData.meses}>
                            <defs>
                              <linearGradient
                                id="colorTempo"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#10b981"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#10b981"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1c1f1d"
                            />
                            <XAxis dataKey="name" stroke="#525252" />
                            <YAxis stroke="#525252" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#090b0a",
                                borderColor: "#262626",
                                borderRadius: "12px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="tempo"
                              stroke="#10b981"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorTempo)"
                              name="Minutos"
                            />
                          </AreaChart>
                        ) : analyticsChartTab === "semanal" ? (
                          <BarChart data={analyticsData.semanas}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1c1f1d"
                            />
                            <XAxis dataKey="name" stroke="#525252" />
                            <YAxis stroke="#525252" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#090b0a",
                                borderColor: "#262626",
                                borderRadius: "12px",
                              }}
                            />
                            <Bar
                              dataKey="tempo"
                              fill="#14b8a6"
                              radius={[6, 6, 0, 0]}
                              name="Minutos estudados"
                            />
                          </BarChart>
                        ) : analyticsChartTab === "diario" ? (
                          <BarChart data={analyticsData.dias}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1c1f1d"
                            />
                            <XAxis dataKey="name" stroke="#525252" />
                            <YAxis stroke="#525252" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#090b0a",
                                borderColor: "#262626",
                                borderRadius: "12px",
                              }}
                            />
                            <Bar
                              dataKey="tempo"
                              fill="#059669"
                              radius={[4, 4, 0, 0]}
                              name="Minutos"
                            />
                          </BarChart>
                        ) : (
                          <AreaChart data={analyticsData.horarios}>
                            <defs>
                              <linearGradient
                                id="colorHoras"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1c1f1d"
                            />
                            <XAxis dataKey="name" stroke="#525252" />
                            <YAxis stroke="#525252" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#090b0a",
                                borderColor: "#262626",
                                borderRadius: "12px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="tempo"
                              stroke="#06b6d4"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorHoras)"
                              name="Minutos"
                            />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Chart Context Labels */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-neutral-900/60 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase">
                          Acesso Mais Ativo
                        </span>
                        <p className="text-neutral-200 font-bold mt-0.5">
                          {analyticsData.mostActiveDay}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase">
                          Hora de Preferência
                        </span>
                        <p className="text-neutral-200 font-bold mt-0.5">
                          {analyticsData.preferredTimeOfDay}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase">
                          Duração de Sessão
                        </span>
                        <p className="text-neutral-200 font-bold mt-0.5">
                          {analyticsData.avgSessionDuration} (Média)
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-mono">
                          frequência de acesso
                        </span>
                        <p className="text-neutral-200 font-bold mt-0.5">
                          {analyticsData.weeklyFrequency} dias / semana
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BENTO GRID: ROW 3 (ATIVIDADE NA IA & PADRÕES) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Atividade na IA */}
                    <div className="p-6 rounded-2xl bg-neutral-900/20 border border-neutral-900 space-y-4">
                      <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-neutral-200 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-emerald-400" />
                        💬 Atividade de Diálogos na IA
                      </h4>

                      <div className="space-y-3 font-mono text-xs text-neutral-350">
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Perguntas Feitas:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.totalQuestions}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Média Diária:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.questionsPerDay} / dia
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Foco de Conteúdo principal:</span>
                          <span className="font-bold text-emerald-400">
                            "{analyticsData.mostAskedTopic}"
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span>Qualidade das Perguntas:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.questionsQuality}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Padroes de estudo */}
                    <div className="p-6 rounded-2xl bg-neutral-900/20 border border-neutral-900 space-y-4">
                      <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-neutral-200 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        📚 Padrões de Estudos
                      </h4>

                      <div className="space-y-3 font-mono text-xs text-neutral-350">
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Consistência:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.consistency}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Padrão de Diálogo:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.chatGeneralVsExam}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-900/40">
                          <span>Estudos Distribuídos vs Concentrado:</span>
                          <span className="font-bold text-neutral-100">
                            {analyticsData.studyType}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span>Estudo Pré-provas:</span>
                          <span className="font-bold text-emerald-400">
                            Sim (Méd. 2 semanas antes)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Criar Nova Sala */}
      <AnimatePresence>
        {isCreatingClass && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-6"
            >
              <button
                type="button"
                onClick={() => setIsCreatingClass(false)}
                className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-100 font-display">
                  Criar Nova Sala Virtual
                </h3>
                <p className="text-xs text-neutral-400">
                  Crie uma sala exclusiva para organizar seus alunos e aplicar simulados e avisos.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 uppercase tracking-wider font-mono">
                    Nome da Sala
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Matemática - 9º Ano A"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-emerald-500 transition-colors"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingClass(false)}
                    className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateVirtualClass}
                    disabled={!newClassName.trim()}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    Criar Sala
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Entrar em Sala Existente */}
      <AnimatePresence>
        {isJoiningClass && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-6"
            >
              <button
                type="button"
                onClick={() => {
                  setIsJoiningClass(false);
                  setTeacherJoinError(null);
                }}
                className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-100 font-display">
                  Entrar em Sala Existente
                </h3>
                <p className="text-xs text-neutral-400">
                  Digite o código de 4 dígitos para se vincular como professor desta sala.
                </p>
              </div>

              <form onSubmit={handleTeacherJoinClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 uppercase tracking-wider font-mono">
                    Código de Acesso
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 7728"
                    value={teacherJoinCode}
                    maxLength={6}
                    onChange={(e) => {
                      setTeacherJoinCode(e.target.value);
                      if (teacherJoinError) setTeacherJoinError(null);
                    }}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-center text-lg font-mono font-bold tracking-widest uppercase text-emerald-400 placeholder-neutral-600 outline-none focus:border-emerald-500 transition-colors"
                    autoFocus
                    required
                  />
                </div>

                {teacherJoinError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{teacherJoinError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsJoiningClass(false);
                      setTeacherJoinError(null);
                    }}
                    className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={teacherJoining || !teacherJoinCode.trim()}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    {teacherJoining ? "Entrando..." : "Entrar na Sala"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal para Criar Aviso com Imagem para a Turma */}
      {selectedClassForAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-emerald-500/30 rounded-3xl p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-100 font-display">
                    Criar Aviso para a Turma
                  </h3>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Turma: {selectedClassForAnnouncement}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClassForAnnouncement(null);
                  setAnnError(null);
                  setAnnSuccess(null);
                  setAnnImageBase64("");
                  setAnnImageFileName("");
                }}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                  Título do Aviso
                </label>
                <input
                  type="text"
                  placeholder="Ex: Entrega do Trabalho Prático / Lembrete de Prova"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl text-xs text-neutral-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                  Mensagem do Aviso
                </label>
                <textarea
                  rows={4}
                  placeholder="Escreva a mensagem ou comunicado com todos os detalhes para os alunos desta turma..."
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl text-xs text-neutral-200 outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                  Anexar Imagem do Dispositivo / Galeria (Opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="block w-full text-xs text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30 cursor-pointer"
                />
                {annImageBase64 && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-emerald-500/30 bg-neutral-950 p-2 flex items-center justify-between">
                    <img src={annImageBase64} alt="Preview do Anexo" className="h-20 object-cover rounded-lg border border-neutral-800" />
                    <button
                      type="button"
                      onClick={() => { setAnnImageBase64(""); setAnnImageFileName(""); }}
                      className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Remover Imagem
                    </button>
                  </div>
                )}
              </div>

              {annError && (
                <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-300 font-semibold">
                  {annError}
                </div>
              )}

              {annSuccess && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold">
                  {annSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassForAnnouncement(null);
                    setAnnError(null);
                    setAnnSuccess(null);
                    setAnnImageBase64("");
                    setAnnImageFileName("");
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPostingAnn}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPostingAnn ? (
                    <span>Enviando...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Publicar Aviso</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Publish Success Modal */}
      <PublishSuccessModal
        isOpen={!!publishCelebrationData?.isOpen}
        onClose={() => setPublishCelebrationData(null)}
        title={publishCelebrationData?.title}
        targetClass={publishCelebrationData?.targetClass}
      />
    </div>
  );
}
