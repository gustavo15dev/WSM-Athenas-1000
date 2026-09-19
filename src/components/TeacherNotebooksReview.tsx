/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowRight,
  User,
  Layers,
  ChevronRight,
  Calendar,
  MessageSquare,
  Sparkles,
  CheckCheck,
  RefreshCw,
  Eye,
  FileText,
  Inbox
} from 'lucide-react';
import VirtualNotebook from './VirtualNotebook';
import { supabase } from '../supabase';
import { areTurmasMatching } from '../utils/profileDb';

interface TeacherNotebooksReviewProps {
  teacherEmail: string;
  teacherName: string;
  teacherEscola?: string | null;
  teacherAnosLecionados?: string[] | null;
}

interface NotebookReviewItem {
  id: string;
  student_email: string;
  student_name: string;
  student_class: string;
  subject: string;
  teacher_email?: string;
  student_school?: string;
  student_message?: string;
  status: 'pending' | 'completed';
  pages_count: number;
  created_at: string;
  reviewed_at?: string;
  stamp_applied?: string;
  teacher_feedback?: string;
}

export default function TeacherNotebooksReview({
  teacherEmail,
  teacherName,
  teacherEscola,
  teacherAnosLecionados
}: TeacherNotebooksReviewProps) {
  const [reviews, setReviews] = useState<NotebookReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected notebook for inspection / stamping
  const [activeInspectItem, setActiveInspectItem] = useState<NotebookReviewItem | null>(null);

  // Fetch reviews with strict school & class association checks
  const fetchReviews = async () => {
    setLoading(true);
    try {
      // 1. Get teacher profile to confirm authorized school & taught classes
      let currentSchool = (teacherEscola || '').trim().toLowerCase();
      let currentClasses: string[] = (teacherAnosLecionados || []).map(c => String(c).trim().toLowerCase());

      const { data: teacherProfile } = await supabase
        .from('wsm_user_profiles')
        .select('anos_lecionados')
        .ilike('email', teacherEmail)
        .maybeSingle();

      if (teacherProfile) {
        if (currentClasses.length === 0 && teacherProfile.anos_lecionados) {
          if (Array.isArray(teacherProfile.anos_lecionados)) {
            currentClasses = teacherProfile.anos_lecionados.map((c: string) => String(c).trim().toLowerCase());
          } else if (typeof teacherProfile.anos_lecionados === 'string') {
            currentClasses = teacherProfile.anos_lecionados.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
          }
        }
      }

      // 1.5 Fetch virtual classes created by this teacher
      let teacherVirtualClassNames: string[] = [];
      let teacherVirtualClassStudentEmails: string[] = [];
      try {
        const { data: vClasses } = await supabase
          .from('wsm_virtual_classes')
          .select('*');
        if (vClasses) {
          const myVClasses = vClasses.filter((vc: any) =>
            (vc.teacher_email && vc.teacher_email.toLowerCase().trim() === teacherEmail.toLowerCase().trim()) ||
            currentClasses.includes((vc.name || '').toLowerCase().trim())
          );
          myVClasses.forEach((vc: any) => {
            if (vc.name) teacherVirtualClassNames.push(vc.name.toLowerCase().trim());
            if (vc.student_emails) {
              let emails: string[] = [];
              if (Array.isArray(vc.student_emails)) emails = vc.student_emails;
              else if (typeof vc.student_emails === 'string') {
                try { emails = JSON.parse(vc.student_emails); } catch { emails = vc.student_emails.split(',').map((s: string) => s.trim()); }
              }
              emails.forEach((e: string) => {
                if (e) teacherVirtualClassStudentEmails.push(e.toLowerCase().trim());
              });
            }
          });
        }
      } catch (vcErr) {
        console.warn('Error fetching virtual classes in review:', vcErr);
      }

      currentClasses = Array.from(new Set([...currentClasses, ...teacherVirtualClassNames]));

      // 2. Fetch reviews from notebook_reviews and student_notebooks
      const { data: rawReviews } = await supabase
        .from('notebook_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: rawStudentNotebooks } = await supabase
        .from('student_notebooks')
        .select('*')
        .in('status', ['pending_review', 'reviewed', 'pending']);

      const mergedMap = new Map<string, NotebookReviewItem>();

      (rawReviews || []).forEach(r => {
        const isCompleted = ['completed', 'reviewed', 'vistado'].includes((r.status || '').toLowerCase().trim());
        mergedMap.set(r.id, {
          id: r.id,
          student_email: r.student_email,
          student_name: r.student_name,
          student_class: r.student_class,
          subject: r.subject,
          teacher_email: r.teacher_email || '',
          student_school: r.student_school,
          student_message: r.student_message,
          status: isCompleted ? 'completed' : 'pending',
          pages_count: r.pages_count || 1,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
          stamp_applied: r.stamp_applied,
          teacher_feedback: r.teacher_feedback
        });
      });

      (rawStudentNotebooks || []).forEach(sn => {
        const studentEmail = (sn.student_email || '').toLowerCase().trim();
        const subject = (sn.subject || '').toLowerCase().trim();
        const hasExistingReview = Array.from(mergedMap.values()).some(
          r => (r.student_email || '').toLowerCase().trim() === studentEmail &&
               (r.subject || '').toLowerCase().trim() === subject
        );
        if (!hasExistingReview) {
          mergedMap.set(`sn_${sn.id}`, {
            id: sn.id,
            student_email: sn.student_email,
            student_name: sn.student_name || 'Estudante',
            student_class: sn.student_class || '',
            subject: sn.subject,
            teacher_email: sn.requested_teacher_email || '',
            student_message: sn.student_message || '',
            status: sn.status === 'reviewed' ? 'completed' : 'pending',
            pages_count: Array.isArray(sn.pages) ? sn.pages.length : 1,
            created_at: sn.updated_at || sn.created_at || new Date().toISOString(),
            reviewed_at: sn.updated_at,
            stamp_applied: sn.last_stamp?.label || null,
            teacher_feedback: sn.teacher_feedback || null
          });
        }
      });

      const combinedReviews = Array.from(mergedMap.values());

      if (combinedReviews.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // 3. Fetch student user profiles to verify their class association
      const studentEmails = Array.from(new Set(combinedReviews.map(r => (r.student_email || '').toLowerCase()).filter(Boolean)));
      const { data: studentProfiles } = await supabase
        .from('wsm_user_profiles')
        .select('email, turma')
        .in('email', studentEmails);

      const studentMap = new Map<string, { turma?: string }>();
      if (studentProfiles) {
        studentProfiles.forEach(sp => {
          if (sp.email) {
            studentMap.set(sp.email.toLowerCase(), { turma: sp.turma });
          }
        });
      }

      // 4. Strict multi-tenant and cross-teacher filtering
      const authorizedReviews = combinedReviews.filter(r => {
        const reqTeacher = (r.teacher_email || '').toLowerCase().trim();
        const teacherOwn = reqTeacher === teacherEmail.toLowerCase().trim();

        const stEmail = (r.student_email || '').toLowerCase().trim();
        const stProfile = studentMap.get(stEmail);
        const studentClass = (r.student_class || stProfile?.turma || '').trim();

        // If explicitly addressed to another distinct teacher (not generic fallback), and not this teacher, block it
        const isGenericEmail = !reqTeacher || reqTeacher === 'professora.athenas@colegio.edu' || reqTeacher.includes('@colegio.edu');
        if (reqTeacher && !teacherOwn && !isGenericEmail) {
          return false;
        }

        // Check class association (official classes or virtual classes)
        const matchesVirtualStudent = teacherVirtualClassStudentEmails.includes(stEmail);
        const matchesClass = teacherOwn || matchesVirtualStudent || (currentClasses.length > 0 && currentClasses.some(c => areTurmasMatching(c, studentClass)));
        const teacherNoClasses = currentClasses.length === 0 && isGenericEmail;

        return teacherOwn || matchesVirtualStudent || matchesClass || teacherNoClasses;
      });

      setReviews(authorizedReviews);
    } catch (e) {
      console.error('Error fetching authorized reviews:', e);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [teacherEmail]);

  // Unique classes for filter
  const classesList = Array.from(new Set(reviews.map((r) => r.student_class).filter(Boolean)));

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    const matchesStatus =
      filterStatus === 'all' ? true : r.status === filterStatus;
    const matchesClass =
      filterClass === 'all' ? true : r.student_class === filterClass;
    const matchesSearch =
      (r.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.student_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesClass && matchesSearch;
  });

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const completedCount = reviews.filter((r) => r.status === 'completed').length;

  // If teacher is inspecting a specific student's notebook
  if (activeInspectItem) {
    return (
      <div className="w-full">
        {/* Inspection Top Bar */}
        <div className="w-full max-w-4xl mx-auto bg-neutral-900 border border-emerald-500/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  Avaliando Caderno de Biologia
                </span>
                <span className="text-xs text-neutral-400">• Turma {activeInspectItem.student_class}</span>
                {activeInspectItem.status === 'completed' && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> Vistado ({activeInspectItem.stamp_applied || 'Visto'})
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-neutral-100">
                {activeInspectItem.student_name} ({activeInspectItem.student_email})
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveInspectItem(null);
              fetchReviews();
            }}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            ← Voltar para a Fila de Vistos
          </button>
        </div>

        {/* Render Virtual Notebook in Inspection Mode */}
        <VirtualNotebook
          userRole="teacher"
          userEmail={teacherEmail}
          userName={teacherName}
          userTurma={activeInspectItem.student_class}
          userEscola={teacherEscola || undefined}
          inspectNotebookId={activeInspectItem.id}
          inspectStudentEmail={activeInspectItem.student_email}
          inspectStudentName={activeInspectItem.student_name}
          inspectStudentClass={activeInspectItem.student_class}
          onReviewCompleted={(_reviewId, stampLabel) => {
            setActiveInspectItem(prev => prev ? { ...prev, status: 'completed', stamp_applied: stampLabel } : null);
            fetchReviews();
          }}
          onCloseInspect={() => {
            setActiveInspectItem(null);
            fetchReviews();
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center text-neutral-100 font-sans-clean">
      
      {/* Top Banner */}
      <section className="w-full max-w-5xl bg-neutral-950 border border-neutral-850 rounded-3xl p-6 sm:p-8 mb-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>Vistos Virtuais em Folhas A4</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              Mesa de Vistos de Biologia
            </h1>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Avalie e carimbe digitalmente os cadernos e anotações A4 enviados pelos seus alunos.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 min-w-[130px] text-center">
              <span className="text-2xl font-black text-amber-400 block">{pendingCount}</span>
              <span className="text-xs text-neutral-400 font-medium">Aguardando Visto</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 min-w-[130px] text-center">
              <span className="text-2xl font-black text-emerald-400 block">{completedCount}</span>
              <span className="text-xs text-neutral-400 font-medium">Já Vistados</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="w-full max-w-5xl bg-neutral-950/80 border border-neutral-850 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por aluno, email ou assunto..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Todos ({reviews.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              filterStatus === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-3 h-3" /> Pendentes ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              filterStatus === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckCheck className="w-3 h-3" /> Vistados ({completedCount})
          </button>
        </div>

        {/* Class Filter */}
        {classesList.length > 0 && (
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todas as Turmas</option>
            {classesList.map((c) => (
              <option key={c} value={c}>
                Turma {c}
              </option>
            ))}
          </select>
        )}

        {/* Refresh Button */}
        <button
          onClick={fetchReviews}
          disabled={loading}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
          title="Atualizar lista"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Review Queue Cards */}
      <div className="w-full max-w-5xl space-y-3">
        {loading ? (
          <div className="w-full py-16 text-center text-neutral-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
            Carregando pedidos de vistos...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="w-full py-16 text-center bg-neutral-950 border border-neutral-850 rounded-3xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto mb-3">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-200">Nenhum visto pendente</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
              Quando os alunos clicarem em "Pedir Visto à Professora" no caderno de Biologia, os cadernos aparecerão aqui para avaliação.
            </p>
          </div>
        ) : (
          filteredReviews.map((item) => {
            const isPending = item.status === 'pending';
            const formattedDate = new Date(item.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={item.id}
                className="w-full bg-neutral-950 border border-neutral-850 hover:border-neutral-750 rounded-2xl p-4 sm:p-5 transition shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isPending
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-neutral-100">{item.student_name}</h4>
                      <span className="text-[10px] bg-neutral-850 text-neutral-300 px-2 py-0.5 rounded-full font-medium">
                        Turma {item.student_class}
                      </span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                        Biologia
                      </span>
                      {isPending ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pendente
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCheck className="w-2.5 h-2.5" /> {item.stamp_applied || 'Vistado'}
                        </span>
                      )}
                    </div>

                    {item.student_message && (
                      <p className="text-xs text-neutral-300 italic mt-1 bg-neutral-900/60 p-2 rounded-lg border border-neutral-850">
                        "{item.student_message}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-2">
                      <span>Enviado em: {formattedDate}</span>
                      <span>•</span>
                      <span>{item.pages_count || 1} {item.pages_count === 1 ? 'folha A4' : 'folhas A4'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveInspectItem(item)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                      isPending
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                        : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-200 border border-neutral-750'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isPending ? 'Abrir & Carimbar' : 'Ver Caderno'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
