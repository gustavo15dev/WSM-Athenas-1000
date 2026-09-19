import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { supabase } from "../supabase";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Key,
  ClipboardList,
  Megaphone,
  AlertTriangle,
  CheckCircle,
  Bell,
  Star,
  Check
} from "lucide-react";
import StudentSimulados from "./StudentSimulados";
import StudentAnnouncements from "./StudentAnnouncements";
import type { VirtualClass, UserProfile } from "../types";
import { areTurmasMatching } from "../utils/profileDb";

interface StudentVirtualClassesProps {
  email: string;
  studentName: string;
  officialTurma: string;
  activeTurma?: string;
  onSelectActiveTurma?: (turma: string) => void;
  teachers: any[];
  onExamActiveChange?: (active: boolean) => void;
}

export default function StudentVirtualClasses({
  email,
  studentName,
  officialTurma,
  activeTurma,
  onSelectActiveTurma,
  teachers,
  onExamActiveChange
}: StudentVirtualClassesProps) {
  const [virtualClasses, setVirtualClasses] = useState<VirtualClass[]>([]);
  const [classmates, setClassmates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"simulados" | "provas" | "alunos">("simulados");
  const [isExamActive, setIsExamActive] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: userProfile } = await supabase
        .from("wsm_user_profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (userProfile?.id) {
        const { data } = await supabase
          .from("wsm_notifications")
          .select("*")
          .eq("user_id", userProfile.id)
          .eq("is_read", false);
        setNotifications(data || []);
      }
    } catch (err) {
      console.error("Error fetching room notifications:", err);
    }
  }, [email]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const hasNotificationForRoom = (clsName: string) => {
    if (!notifications || notifications.length === 0) return false;
    const clsLower = clsName.toLowerCase();
    const vc = virtualClasses.find((v) => v.name.toLowerCase() === clsLower);
    const teacherEmail = vc?.teacher_email?.toLowerCase();

    return notifications.some((n) => {
      if (n.is_read) return false;
      const titleLower = (n.title || "").toLowerCase();
      const msgLower = (n.message || "").toLowerCase();

      if (titleLower.includes(clsLower) || msgLower.includes(clsLower)) return true;
      if (teacherEmail && (msgLower.includes(teacherEmail) || titleLower.includes(teacherEmail))) return true;
      if (clsName === officialTurma) {
        if (titleLower.includes(officialTurma.toLowerCase()) || msgLower.includes(officialTurma.toLowerCase())) return true;
      }
      return false;
    });
  };

  const handleOpenRoom = async (clsName: string) => {
    setSelectedClass(clsName);
    try {
      const { data: userProfile } = await supabase
        .from("wsm_user_profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (userProfile?.id) {
        await supabase
          .from("wsm_notifications")
          .update({ is_read: true })
          .eq("user_id", userProfile.id)
          .eq("is_read", false);

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  const handleExamActiveChange = useCallback((active: boolean) => {
    setIsExamActive(active);
  }, []);

  useEffect(() => {
    if (onExamActiveChange) {
      onExamActiveChange(isExamActive);
    }
  }, [isExamActive, onExamActiveChange]);

  useEffect(() => {
    fetchClasses();
  }, [email, officialTurma]);

  const fetchClasses = async () => {
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      const { data, error } = await supabase
        .from("wsm_virtual_classes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter((vc: any) => {
        let emails: string[] = [];
        if (Array.isArray(vc.student_emails)) {
          emails = vc.student_emails;
        } else if (typeof vc.student_emails === "string") {
          try {
            emails = JSON.parse(vc.student_emails);
          } catch {
            emails = vc.student_emails.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
        }
        const inEmails = emails.some((e: any) => e && String(e).toLowerCase().trim() === cleanEmail);
        const matchesCohort = officialTurma ? areTurmasMatching(vc.name, officialTurma) || vc.access_code === officialTurma : false;
        return inEmails || matchesCohort;
      });

      setVirtualClasses(filtered);
    } catch (err) {
      console.error("Error fetching virtual classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      // Find class by code using maybeSingle() to avoid 406
      const { data: vClass, error } = await supabase
        .from("wsm_virtual_classes")
        .select("*")
        .eq("access_code", joinCode.trim())
        .maybeSingle();

      if (error || !vClass) {
        setJoinError("Código de sala inválido. Verifique com o seu professor e tente novamente.");
        setJoining(false);
        return;
      }

      const currentEmails = Array.isArray(vClass.student_emails)
        ? vClass.student_emails
        : [];
        
      if (currentEmails.map((e: string) => e.toLowerCase()).includes(email.toLowerCase())) {
        setJoinError("Você já está cadastrado(a) nesta turma!");
        setJoining(false);
        setJoinCode("");
        return;
      }

      const updatedEmails = Array.from(
        new Set([...currentEmails, email.toLowerCase()])
      );

      const { error: updateError } = await supabase
        .from("wsm_virtual_classes")
        .update({ student_emails: updatedEmails })
        .eq("id", vClass.id);

      if (updateError) throw updateError;

      setJoinSuccess(`Entrou na turma "${vClass.name}" com sucesso!`);
      setJoinCode("");
      fetchClasses();
    } catch (err) {
      console.error("Error joining class:", err);
      setJoinError("Erro ao entrar na turma. Tente novamente.");
    } finally {
      setJoining(false);
    }
  };

  const loadClassmates = async (className: string) => {
    try {
      // If it's the official class, fetch users by turma
      if (className === officialTurma) {
        const { data, error } = await supabase
          .from("wsm_user_profiles")
          .select("*")
          .eq("role", "student")
          .eq("turma", officialTurma)
          .order("nome_completo", { ascending: true });
        
        if (error) throw error;
        setClassmates(data || []);
      } else {
        // If virtual class, fetch users by student_emails array
        const vClass = virtualClasses.find(c => c.name === className);
        if (vClass && vClass.student_emails) {
          const { data, error } = await supabase
            .from("wsm_user_profiles")
            .select("*")
            .eq("role", "student")
            .in("email", vClass.student_emails)
            .order("nome_completo", { ascending: true });
            
          if (error) throw error;
          setClassmates(data || []);
        } else {
          setClassmates([]);
        }
      }
    } catch (err) {
      console.error("Error fetching classmates:", err);
    }
  };

  useEffect(() => {
    if (selectedClass) {
      loadClassmates(selectedClass);
    }
  }, [selectedClass]);

  const allClasses = [
    ...(officialTurma ? [officialTurma] : []),
    ...virtualClasses.map((vc) => vc.name),
  ];
  
  // ensure unique classes in case a virtual class has the same name
  const uniqueClasses = Array.from(new Set(allClasses));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display">
            Minhas Salas
          </h2>
          <p className="text-neutral-500 text-xs mt-1">
            Suas turmas oficiais e virtuais
          </p>
        </div>

        {!selectedClass && (
          <form onSubmit={handleJoinClass} className="flex items-center gap-2">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Código da Turma"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  if (joinError) setJoinError(null);
                }}
                className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs rounded-xl pl-9 pr-4 py-2 w-48 focus:outline-none focus:border-emerald-500/50 transition-colors uppercase font-mono"
                required
              />
            </div>
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="bg-emerald-500 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {joining ? "Entrando..." : "Entrar"}
            </button>
          </form>
        )}
      </div>

      {joinError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 animate-fadeIn font-sans">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{joinError}</span>
          </div>
          <button
            type="button"
            onClick={() => setJoinError(null)}
            className="text-neutral-400 hover:text-neutral-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {joinSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between gap-2 animate-fadeIn font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{joinSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setJoinSuccess(null)}
            className="text-neutral-400 hover:text-neutral-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {!selectedClass ? (
        <div className="space-y-4">
          {/* Cards de aviso para salas com novas notificações */}
          {uniqueClasses.filter((cls) => hasNotificationForRoom(cls)).map((clsName) => (
            <motion.div
              key={`notif-banner-${clsName}`}
              onClick={() => handleOpenRoom(clsName)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-center justify-between gap-4 cursor-pointer hover:bg-red-900/50 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-display">
                    Na sala <span className="text-red-400 underline decoration-red-400/50">{clsName}</span> tem novas notificações!
                  </h4>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    Clique aqui para entrar na sala e conferir os novos avisos e recados do seu professor.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-xl shrink-0 shadow-md transition-colors">
                <span>Abrir Sala</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
          ))}

          {/* Grid de Salas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueClasses.map((clsName) => {
              const isOfficial = clsName === officialTurma;
              const isActive = clsName === activeTurma;
              const vc = virtualClasses.find((v) => v.name === clsName);
              const hasNotif = hasNotificationForRoom(clsName);
              
              return (
                <div
                  key={clsName}
                  className={`p-5 rounded-2xl bg-neutral-900/40 border transition-all flex flex-col justify-between space-y-4 group hover:bg-neutral-900/70 relative ${
                    isActive
                      ? "border-emerald-500/50 ring-1 ring-emerald-500/30 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : hasNotif 
                      ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                      : "border-neutral-855 hover:border-emerald-500/25"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${
                        isActive
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : hasNotif
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : "bg-neutral-800/80 border-neutral-700 text-neutral-300"
                      }`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Turma Ativa
                        </span>
                      )}
                      {hasNotif && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-red-600 text-white border border-red-500 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          Notificação
                        </span>
                      )}
                      <span className="text-[9px] font-mono uppercase bg-neutral-950 border border-neutral-850 text-neutral-400 px-2 py-0.5 rounded">
                        {isOfficial ? "Oficial" : "Virtual"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-neutral-200 font-display group-hover:text-emerald-400 transition-colors">
                      {clsName}
                    </h4>
                    {vc && vc.teacher_email && (
                      <p className="text-[10px] text-neutral-500 font-mono mt-1">
                        Prof: {vc.teacher_email}
                      </p>
                    )}
                  </div>

                  {/* Actions for this room */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                    <button
                      type="button"
                      onClick={() => handleOpenRoom(clsName)}
                      className="flex-1 py-2 px-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Abrir Sala</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {onSelectActiveTurma && !isActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectActiveTurma(clsName);
                        }}
                        className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                        title="Definir esta turma como o contexto ativo para provas, caderno e métricas"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Tornar Ativa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {uniqueClasses.length === 0 && (
              <div className="col-span-full p-8 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20 text-center">
                <BookOpen className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400 text-sm font-semibold">
                  Você ainda não está em nenhuma sala
                </p>
                <p className="text-neutral-500 text-xs mt-1">
                  Insira o código fornecido pelo seu professor para entrar.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Room Header */}
          {!isExamActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedClass(null);
                    setActiveSubTab("simulados");
                  }}
                  className="p-2 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-neutral-100 font-display">
                      {selectedClass}
                    </h3>
                    <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      {selectedClass === officialTurma ? "Oficial" : "Virtual"}
                    </span>
                    {selectedClass === activeTurma ? (
                      <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Turma Ativa
                      </span>
                    ) : onSelectActiveTurma && (
                      <button
                        type="button"
                        onClick={() => onSelectActiveTurma(selectedClass)}
                        className="text-[9px] font-mono uppercase bg-neutral-800 hover:bg-emerald-500/20 text-neutral-300 hover:text-emerald-300 border border-neutral-700 hover:border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Star className="w-2.5 h-2.5" />
                        Definir como Ativa
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-850">
                <button
                  onClick={() => setActiveSubTab("simulados")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === "simulados"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Simulados
                </button>
                <button
                  onClick={() => setActiveSubTab("provas")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === "provas"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Avisos
                </button>
                <button
                  onClick={() => setActiveSubTab("alunos")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === "alunos"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Alunos
                </button>
              </div>
            </div>
          )}

          {/* Room Content */}
          <div className={isExamActive ? "mt-0" : "mt-6"}>
            {activeSubTab === "simulados" ? (
              <StudentSimulados
                email={email}
                studentName={studentName}
                studentClass={selectedClass}
                isRoomContext={true}
                onExamActiveChange={handleExamActiveChange}
              />
            ) : activeSubTab === "provas" ? (
              <StudentAnnouncements
                studentEmail={email}
                studentName={studentName}
                studentTurma={selectedClass}
                teachers={teachers}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classmates.map((student) => (
                  <div key={student.id} className="flex items-center gap-3 p-4 rounded-xl border border-neutral-850 bg-neutral-900/30">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-300">
                      {student.nome_completo?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-200">
                        {student.nome_completo}
                      </p>
                      {student.numero_chamada && (
                        <p className="text-[10px] text-neutral-500 font-mono">
                          Nº Chamada: {student.numero_chamada}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {classmates.length === 0 && (
                  <div className="col-span-full text-center py-8 text-neutral-500 text-sm">
                    Nenhum aluno encontrado nesta turma.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
