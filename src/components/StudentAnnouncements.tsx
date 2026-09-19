/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ThumbsUp, 
  Megaphone, 
  Sparkles, 
  Clock, 
  User, 
  AlertTriangle, 
  Info, 
  Calendar,
  CheckCircle2,
  ChevronRight,
  UserX
} from 'lucide-react';
import { supabase } from '../supabase';
import { areTurmasMatching } from '../utils/profileDb';
import { matchesStudentTarget, getStudentVirtualClassIdentifiers } from '../utils/targetMatcher';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  teacher_email: string;
  teacher_name: string;
  class_name?: string;
  likes_count: number;
  liked_by: string[];
  created_at: string;
  image_url?: string | null;
  is_teacher_removed?: boolean;
}

interface StudentAnnouncementsProps {
  studentEmail: string;
  studentName?: string;
  studentTurma?: string;
  teachers?: any[];
}

export default function StudentAnnouncements({ 
  studentEmail,
  studentName = 'Aluno',
  studentTurma = '',
  teachers = []
}: StudentAnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Keep track of virtual likes locally
  const [virtualLikes, setVirtualLikes] = useState<{[key: string]: boolean}>(() => {
    const initial: {[key: string]: boolean} = {};
    teachers.forEach((teacher, index) => {
      const annId = `welcome-ann-${teacher.id || index}`;
      const likedKey = `liked_${annId}_${studentEmail.toLowerCase()}`;
      initial[annId] = localStorage.getItem(likedKey) === 'true';
    });
    return initial;
  });

  const fetchAnnouncements = async () => {
    try {
      // 1. Fetch virtual classes student is enrolled in
      const { data: allVCls } = await supabase
        .from('wsm_virtual_classes')
        .select('*');

      const emailLower = studentEmail.toLowerCase().trim();
      const myVClasses = (allVCls || []).filter((vc: any) => {
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
        const inVC = emails.some((e: any) => e && String(e).toLowerCase().trim() === emailLower);
        const matchesCohort = studentTurma ? areTurmasMatching(vc.name, studentTurma) : false;
        return inVC || matchesCohort;
      });

      const allowedTeacherEmails = new Set(
        myVClasses
          .map((vc: any) => (vc.teacher_email || '').toLowerCase().trim())
          .filter(Boolean)
      );

      // Filter teachers list to only those teaching the student's virtual classes or cohort
      const matchedTeachers = (teachers || []).filter((t: any) => {
        if (!t || !t.email) return false;
        const tEmail = t.email.toLowerCase().trim();
        if (allowedTeacherEmails.has(tEmail)) return true;
        if (studentTurma && Array.isArray(t.anos_lecionados) && t.anos_lecionados.some((a: string) => areTurmasMatching(a, studentTurma))) {
          allowedTeacherEmails.add(tEmail);
          return true;
        }
        return false;
      });

      setFilteredTeachers(matchedTeachers);

      const vClassIdentifiers = getStudentVirtualClassIdentifiers(emailLower, allVCls || []);

      // 2. Fetch announcements & JOIN with active teachers in wsm_user_profiles
      const { data: dbTeacherProfiles } = await supabase
        .from('wsm_user_profiles')
        .select('id, email, nome_completo, role')
        .eq('role', 'teacher');

      const activeTeacherMap = new Map<string, { id: string; email: string; nome_completo?: string }>();
      (dbTeacherProfiles || []).forEach((t: any) => {
        if (t.email && !t.email.toLowerCase().endsWith('@atenas.com')) {
          activeTeacherMap.set(t.email.toLowerCase().trim(), t);
        }
      });
      (teachers || []).forEach((t: any) => {
        if (t.email && !t.email.toLowerCase().endsWith('@atenas.com')) {
          const cleanEmail = t.email.toLowerCase().trim();
          if (!activeTeacherMap.has(cleanEmail)) {
            activeTeacherMap.set(cleanEmail, { id: t.id, email: t.email, nome_completo: t.nome_completo || t.name });
          }
        }
      });

      const { data, error } = await supabase
        .from('wsm_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Enriched announcements with active teacher JOIN verification
        const enriched: Announcement[] = (data as any[]).map((ann) => {
          const rawEmail = (ann.teacher_email || '').toLowerCase().trim();
          const activeTeacher = activeTeacherMap.get(rawEmail);

          if (activeTeacher) {
            return {
              ...ann,
              teacher_name: activeTeacher.nome_completo || ann.teacher_name || 'Professor(a)',
              teacher_email: activeTeacher.email,
              is_teacher_removed: false
            };
          } else {
            // The teacher does not exist in wsm_user_profiles (e.g. deleted account like prof.teste@atenas.com)
            return {
              ...ann,
              teacher_name: 'Professor removido',
              teacher_email: 'Professor removido',
              is_teacher_removed: true
            };
          }
        });

        // Keep announcements targeted to this student's class, virtual class, email, or teacher
        const allowed = enriched.filter((ann) => {
          const target = ann.class_name;
          const matchesTarget = matchesStudentTarget(target, emailLower, studentTurma, vClassIdentifiers);
          const matchesCohort = studentTurma && target ? areTurmasMatching(target, studentTurma) : false;
          const matchesTeacher = ann.teacher_email && !ann.is_teacher_removed ? allowedTeacherEmails.has(ann.teacher_email.toLowerCase().trim()) : false;
          const isGeneral = !target || ['geral', 'todas', 'toda a escola', 'todos'].includes(target.toLowerCase().trim());

          return matchesTarget || matchesCohort || (matchesTeacher && isGeneral) || isGeneral;
        });
        setAnnouncements(allowed);
      }
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setErrorStatus('Não foi possível obter os avisos escolares.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamically compute display announcements
  const displayAnnouncements = announcements.length > 0 
    ? announcements 
    : filteredTeachers.map((teacher, index) => {
        const annId = `welcome-ann-${teacher.id || index}`;
        const isLiked = virtualLikes[annId];
        return {
          id: annId,
          title: `👋 Boas-vindas ao Portal Athenas!`,
          content: `Olá, ${studentName}! Seja muito bem-vindo(a) ao portal de estudos Athenas. Sou seu(sua) professor(a) ${teacher.nome_completo || 'Docente'} da disciplina de ${teacher.materia || 'Biologia'}.\n\nEste é o nosso Mural de Avisos em tempo real. Sempre que eu publicar datas de provas físicas, trabalhos práticos ou recados acadêmicos importantes, eles aparecerão aqui para você curtir e confirmar presença! Se prepare para aprender muito neste ano letivo!`,
          category: 'Geral',
          teacher_email: teacher.email,
          teacher_name: teacher.nome_completo || 'Professor(a)',
          likes_count: isLiked ? 1 : 0,
          liked_by: isLiked ? [studentEmail.toLowerCase()] : [],
          created_at: teacher.created_at || new Date().toISOString()
        } as Announcement;
      });

  useEffect(() => {
    fetchAnnouncements();
    // Set up rapid polling since it's a social/communative component
    const interval = setInterval(fetchAnnouncements, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleLike = async (ann: Announcement) => {
    const emailLower = studentEmail.toLowerCase();

    // Check if it's a virtual announcement
    if (ann.id.startsWith('welcome-ann-')) {
      const likedKey = `liked_${ann.id}_${emailLower}`;
      const hasLiked = virtualLikes[ann.id];
      if (hasLiked) {
        localStorage.removeItem(likedKey);
        setVirtualLikes(prev => ({ ...prev, [ann.id]: false }));
      } else {
        localStorage.setItem(likedKey, 'true');
        setVirtualLikes(prev => ({ ...prev, [ann.id]: true }));
      }
      return;
    }

    const likedByArray = ann.liked_by || [];
    const hasLiked = likedByArray.includes(emailLower);

    let updatedLikedBy: string[];
    if (hasLiked) {
      updatedLikedBy = likedByArray.filter((e: string) => e !== emailLower);
    } else {
      updatedLikedBy = [...likedByArray, emailLower];
    }

    const updatedLikesCount = updatedLikedBy.length;

    // Optimistically update UI
    setAnnouncements(prev => prev.map(item => {
      if (item.id === ann.id) {
        return {
          ...item,
          liked_by: updatedLikedBy,
          likes_count: updatedLikesCount
        };
      }
      return item;
    }));

    try {
      const { error } = await supabase
        .from('wsm_announcements')
        .update({
          liked_by: updatedLikedBy,
          likes_count: updatedLikesCount
        })
        .eq('id', ann.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert optimistic update on failure
      fetchAnnouncements();
    }
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'Urgent':
        return {
          bg: 'bg-red-500/10 border-red-500/20 text-red-400',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'Urgente'
        };
      case 'Prova':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-450',
          icon: <Calendar className="w-3.5 h-3.5" />,
          label: 'Prova Presencial'
        };
      case 'Evento':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          icon: <Sparkles className="w-3.5 h-3.5" />,
          label: 'Evento Acadêmico'
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          icon: <Info className="w-3.5 h-3.5" />,
          label: 'Geral'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title Header Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-neutral-950/20 border border-emerald-950/10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-neutral-100 tracking-tight font-display">
              Quadro de Avisos Escolares
            </h2>
            <p className="text-neutral-450 text-xs mt-1 max-w-xl">
              Fique por dentro de todos os anúncios, comunicados urgentes e lembretes feitos diretamente pelas suas professoras e coordenação.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono bg-neutral-900 border border-neutral-850 px-3 py-1.5 rounded-full text-neutral-500 select-none uppercase tracking-wider font-extrabold align-middle">
          Atualizado em tempo real
        </span>
      </div>

      {loading && displayAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-950/20 border border-neutral-900 rounded-3xl min-h-[300px]">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/25 border-t-emerald-500 animate-spin mb-4" />
          <p className="text-neutral-400 text-xs font-mono">Carregando avisos do mural acadêmico...</p>
        </div>
      ) : errorStatus ? (
        <div className="p-8 text-center bg-red-950/15 border border-red-500/10 rounded-3xl space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <h4 className="text-sm font-bold text-neutral-200">Erro de Conexão</h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {errorStatus} Por favor, certifique-se de que a tabela `wsm_announcements` foi adicionada na sua interface do banco Supabase.
          </p>
        </div>
      ) : displayAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-950/30 border border-neutral-900/60 rounded-3xl text-center min-h-[350px] space-y-4">
          <div className="p-4 bg-neutral-900/40 rounded-full text-neutral-600 border border-neutral-850/30">
            <Megaphone className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neutral-350">Mural limpo no momento!</h4>
            <p className="text-xs text-neutral-550 max-w-xs mx-auto mt-1 leading-relaxed">
              Nenhuma professora ou administrador disparou avisos recentes para sua turma.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AnimatePresence mode="popLayout" initial={false}>
            {displayAnnouncements.map((ann, index) => {
              const theme = getCategoryTheme(ann.category);
              const isLiked = ann.liked_by?.includes(studentEmail.toLowerCase());
              
              return (
                <motion.div
                  key={ann.id}
                  layoutId={ann.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                  className="p-6 rounded-3xl bg-neutral-950/40 border border-neutral-900/90 flex flex-col justify-between hover:border-neutral-800 transition-colors space-y-5"
                >
                  <div className="space-y-3">
                    {/* Header: Category Badge and Created time */}
                    <div className="flex items-center justify-between gap-2 border-b border-neutral-900 pb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${theme.bg}`}>
                        {theme.icon}
                        <span>{theme.label}</span>
                      </span>
                      
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(ann.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Announcement Content */}
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-neutral-200 leading-snug tracking-tight font-display">
                        {ann.title}
                      </h3>
                      <p className="text-neutral-400 text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {ann.content}
                      </p>

                      {ann.image_url && (
                        <div 
                          className="mt-3 rounded-2xl overflow-hidden border border-neutral-800 bg-black/40 relative cursor-zoom-in group"
                          onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: ann.image_url }))}
                          title="Clique para ver em tela cheia"
                        >
                          <img 
                            src={ann.image_url} 
                            alt="Imagem do Anúncio" 
                            className="w-full max-h-72 object-contain bg-neutral-950 group-hover:scale-[1.02] transition-transform duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-bold text-white bg-black/70 px-2.5 py-1 rounded-lg">Clique para ampliar 🔍</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: User profile of author and Thumbs-up button */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-900/55">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs shrink-0 font-bold select-none ${
                        ann.is_teacher_removed
                          ? 'bg-neutral-900 border-neutral-800 text-neutral-500'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {ann.is_teacher_removed ? (
                          <UserX className="w-3.5 h-3.5 text-neutral-500" />
                        ) : (
                          ann.teacher_name ? ann.teacher_name[0].toUpperCase() : 'P'
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className={`block text-[11px] font-extrabold truncate leading-snug ${
                          ann.is_teacher_removed ? 'text-neutral-400 italic' : 'text-neutral-350'
                        }`}>
                          {ann.teacher_name}
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-mono truncate">
                          {ann.is_teacher_removed ? 'Conta inativa' : ann.teacher_email}
                        </span>
                      </div>
                    </div>

                    {/* Like / Thumbs Up Reaction */}
                    <button
                      onClick={() => handleToggleLike(ann)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-90 select-none ${
                        isLiked
                          ? 'bg-emerald-500/15 text-emerald-450 border-emerald-500/25 shadow-inner'
                          : 'bg-neutral-900/60 text-neutral-450 border-neutral-850 hover:bg-neutral-850 hover:text-neutral-200'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-emerald-450 text-emerald-450' : ''}`} />
                      <span className="font-mono">{ann.likes_count || 0}</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
