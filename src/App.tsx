/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScreenType, PortalRole, SubjectGrade, Announcement, Task } from './types';
import PortalHome from './components/PortalHome';
import LoginModal from './components/LoginModal';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import SleekDashboard from './components/SleekDashboard';
import AdminPortal from './components/AdminPortal';
import { supabase } from './supabase';
import FullscreenImageViewer from './components/FullscreenImageViewer';
import StudyMusicPlayer from './components/StudyMusicPlayer';
import { registerUserPresence } from './utils/presenceTracker';

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('PORTAL_HOME');
  const [activeRole, setActiveRole] = useState<PortalRole | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);

  // Auto track user presence for live admin monitor
  useEffect(() => {
    registerUserPresence({
      email: userEmail || 'visitante@athenas.edu',
      role: activeRole || 'guest',
      currentScreen: screen
    });
  }, [screen, userEmail, activeRole]);

  // Global event listener for Study Music Player
  useEffect(() => {
    const handleOpenPlayer = () => setShowMusicPlayer(true);
    window.addEventListener('open-study-music-player', handleOpenPlayer);
    return () => window.removeEventListener('open-study-music-player', handleOpenPlayer);
  }, []);

  // Auto restore logged in user on page load/refresh
  useEffect(() => {
    const restoreSession = async () => {
      const savedEmail = localStorage.getItem('athenas_user_email');
      const savedRole = localStorage.getItem('athenas_active_role') as PortalRole | null;

      if (savedEmail && savedRole) {
        setUserEmail(savedEmail);
        setActiveRole(savedRole);
        if (savedRole === 'student') {
          setScreen('STUDENT_DASHBOARD');
        } else if (savedRole === 'teacher') {
          setScreen('TEACHER_DASHBOARD');
        }
        return;
      }

      // Supabase session fallback
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const email = session.user.email;
          const { data: profile } = await supabase
            .from('wsm_user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const role = (profile?.role || session.user.user_metadata?.role || 'student') as PortalRole;
          setUserEmail(email);
          setActiveRole(role);
          localStorage.setItem('athenas_user_email', email);
          localStorage.setItem('athenas_active_role', role);

          if (role === 'student') {
            setScreen('STUDENT_DASHBOARD');
          } else if (role === 'teacher') {
            setScreen('TEACHER_DASHBOARD');
          }
        }
      } catch (err) {
        console.warn('Error checking persistent session:', err);
      }
    };

    restoreSession();
  }, []);

  // Sssh! Secret Admin state
  const [showAdminPasswordPortal, setShowAdminPasswordPortal] = useState(false);
  const [adminPasswordValue, setAdminPasswordValue] = useState('');
  const [adminErrorMsg, setAdminErrorMsg] = useState('');

  // Key combination listener effect
  useEffect(() => {
    let countCombo8 = 0;
    let limitTimer: NodeJS.Timeout;

    const handleKeyComboListener = (e: KeyboardEvent) => {
      // Look for holding Ctrl + pressing "8"
      if (e.ctrlKey && e.key === '8') {
        e.preventDefault();
        countCombo8 += 1;

        clearTimeout(limitTimer);
        limitTimer = setTimeout(() => {
          countCombo8 = 0;
        }, 3000); // 3 seconds tolerance window

        if (countCombo8 >= 5) {
          countCombo8 = 0;
          setShowAdminPasswordPortal(true);
          setAdminPasswordValue('');
          setAdminErrorMsg('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyComboListener);
    return () => {
      window.removeEventListener('keydown', handleKeyComboListener);
      clearTimeout(limitTimer);
    };
  }, []);

  const handleAdminPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordValue === '3473') {
      setScreen('ADMIN_PORTAL');
      setShowAdminPasswordPortal(false);
      setAdminPasswordValue('');
      setAdminErrorMsg('');
    } else {
      setAdminErrorMsg('Acesso negado. Token de segurança incorreto.');
      setAdminPasswordValue('');
    }
  };

  // Shared institutional state for interactive simulation
  const [grades, setGrades] = useState<SubjectGrade[]>([
    { id: 'sub-req', subject: 'Engenharia de Requisitos', grade: 8.5, maxGrade: 10, teacher: 'Prof. Marcos Silva', status: 'Aprovado' },
    { id: 'sub-arch', subject: 'Arquiteturas Distribuídas', grade: 7.8, maxGrade: 10, teacher: 'Profª Helena Castro', status: 'Aprovado' },
    { id: 'sub-db', subject: 'Banco de Dados Relacionais', grade: 9.2, maxGrade: 10, teacher: 'Prof. Alan Turing', status: 'Aprovado' },
    { id: 'sub-comp', subject: 'Engenharia de Compiladores', grade: 5.4, maxGrade: 10, teacher: 'Prof. Grace Hopper', status: 'Recuperação' },
    { id: 'sub-hci', subject: 'Interação Humano-Computador', grade: 6.8, maxGrade: 10, teacher: 'Profª Ada Lovelace', status: 'Em Análise' }
  ]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: 'ann-1', title: 'Entrega do Projeto Final', content: 'A entrega final do projeto integrado de Engenharia de Software será no dia 28/06 via portal Athenas.', date: 'Hoje', author: 'Profª Helena Castro', category: 'Urgent' },
    { id: 'ann-2', title: 'Simulado de Compiladores', content: 'Disponibilizado na biblioteca virtual o material prático e gabarito das provas substitutivas.', date: 'Ontem', author: 'Prof. Grace Hopper', category: 'Prova' },
    { id: 'ann-3', title: 'Palestra de Escopo Tecnológico', content: 'Athenas Summit 2026 acontecerá nos dias 21 e 22 de Junho presencialmente no Auditório Central.', date: '15 Jun', author: 'Coordenação Acadêmica', category: 'Evento' }
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    { id: 'task-1', title: 'Entrega do Diagrama de Classes UML', subject: 'Engenharia de Requisitos', dueDate: 'Amanhã', status: 'Pendente' },
    { id: 'task-2', title: 'Implementar Algoritmo LL(1) Parser', subject: 'Engenharia de Compiladores', dueDate: '23 Jun', status: 'Pendente' },
    { id: 'task-3', title: 'Relatório Prático Web Workers', subject: 'Arquiteturas Distribuídas', dueDate: '26 Jun', status: 'Concluído' },
    { id: 'task-4', title: 'Estudo dirigido sobre Forças Normais (1NF a 3NF)', subject: 'Banco de Dados Relacionais', dueDate: 'Atrasado', status: 'Atrasado' }
  ]);

  // Handle student role selection
  const handleSelectRole = (role: PortalRole) => {
    setActiveRole(role);
    setScreen('LOGIN');
  };

  // Handle back to home
  const handleBackToHome = () => {
    setActiveRole(null);
    setScreen('PORTAL_HOME');
  };

  // Handle login completion sequence
  const handleLoginSuccess = (email: string) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    setUserEmail(cleanEmail);
    localStorage.setItem('athenas_user_email', cleanEmail);
    if (activeRole) {
      localStorage.setItem('athenas_active_role', activeRole);
    }
    if (activeRole === 'student') {
      setScreen('STUDENT_DASHBOARD');
    } else if (activeRole === 'teacher') {
      setScreen('TEACHER_DASHBOARD');
    } else {
      setScreen('DASHBOARD_EMPTY');
    }
  };

  // Handle logout sequence
  const handleLogout = async () => {
    localStorage.removeItem('athenas_user_email');
    localStorage.removeItem('athenas_active_role');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setScreen('PORTAL_HOME');
    setActiveRole(null);
    setUserEmail('');
  };

  // Action: update student grade (initiated by the teacher)
  const handleUpdateGrade = (subjectId: string, newGrade: number) => {
    setGrades(prev => prev.map(g => {
      if (g.id === subjectId) {
        let status: 'Aprovado' | 'Em Análise' | 'Recuperação' = 'Em Análise';
        if (newGrade >= 7.0) {
          status = 'Aprovado';
        } else if (newGrade < 5.0) {
          status = 'Recuperação';
        }
        return { ...g, grade: newGrade, status };
      }
      return g;
    }));
  };

  // Action: post new announcement (initiated by the teacher)
  const handleAddAnnouncement = (title: string, content: string, category: 'Geral' | 'Urgent' | 'Prova' | 'Evento') => {
    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title,
      content,
      date: 'Hoje',
      author: 'Prof. (Minhas Aulas)',
      category
    };
    setAnnouncements(prev => [newAnn, ...prev]);
  };

  // Action: toggle task completion state (initiated by the student)
  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'Concluído' ? 'Pendente' : 'Concluído';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  return (
    <div className="bg-[#050706] min-h-screen max-w-full overflow-x-hidden text-neutral-100 selection:bg-emerald-500/30 selection:text-emerald-100">
      <AnimatePresence mode="wait">
        {screen === 'PORTAL_HOME' && (
          <motion.div
            key="portal-home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <PortalHome onSelectRole={handleSelectRole} />
          </motion.div>
        )}

        {screen === 'LOGIN' && activeRole && (
          <motion.div
            key="login-modal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <LoginModal
              role={activeRole}
              onBack={handleBackToHome}
              onLoginSuccess={handleLoginSuccess}
            />
          </motion.div>
        )}

        {screen === 'STUDENT_DASHBOARD' && (
          <motion.div
            key="student-dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <StudentDashboard
              email={userEmail}
              onLogout={handleLogout}
              grades={grades}
              announcements={announcements}
              tasks={tasks}
              onToggleTask={handleToggleTask}
            />
          </motion.div>
        )}

        {screen === 'TEACHER_DASHBOARD' && (
          <motion.div
            key="teacher-dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <TeacherDashboard
              email={userEmail}
              onLogout={handleLogout}
              grades={grades}
              onUpdateGrade={handleUpdateGrade}
              announcements={announcements}
              onAddAnnouncement={handleAddAnnouncement}
            />
          </motion.div>
        )}

        {screen === 'DASHBOARD_EMPTY' && (
          <motion.div
            key="dashboard-empty"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <SleekDashboard
              email={userEmail}
              role={activeRole || 'student'}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {screen === 'ADMIN_PORTAL' && (
          <motion.div
            key="admin-portal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-screen"
          >
            <AdminPortal
              adminEmail={userEmail || 'gustavo14dev@gmail.com'}
              onBack={() => {
                // Return safely to whichever screen they were working on
                if (userEmail) {
                  if (activeRole === 'student') {
                    setScreen('STUDENT_DASHBOARD');
                  } else if (activeRole === 'teacher') {
                    setScreen('TEACHER_DASHBOARD');
                  } else {
                    setScreen('DASHBOARD_EMPTY');
                  }
                } else {
                  setScreen('PORTAL_HOME');
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secret floating password prompt challenge */}
      <AnimatePresence>
        {showAdminPasswordPortal && (
          <div className="fixed inset-0 bg-[#000000ea] backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-xs font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="p-6 rounded-3xl bg-[#060807] border border-red-500/20 w-full max-w-sm text-center relative space-y-4 shadow-red-500/5 shadow-2xl"
            >
              <div className="mx-auto w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-1">
                <span className="text-xl">🛡️</span>
              </div>

              <div>
                <h3 className="text-sm font-black text-neutral-100 uppercase tracking-wider">Acesso Administrativo Restrito</h3>
                <p className="text-[10px] text-neutral-450 mt-1 leading-relaxed">Este módulo requer autenticação de segurança. Digite a senha administrativa de 4 dígitos para prosseguir.</p>
              </div>

              <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
                <input
                  type="password"
                  placeholder="Senha de 4 dígitos..."
                  value={adminPasswordValue}
                  onChange={(e) => setAdminPasswordValue(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-900 border border-neutral-850 focus:border-red-500/30 rounded-xl text-center text-lg font-mono font-black tracking-widest outline-none text-red-500 placeholder-neutral-700"
                  required
                  autoFocus
                />

                {adminErrorMsg && (
                  <p className="text-[10.5px] text-red-400 font-semibold animate-fadeIn">{adminErrorMsg}</p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1 font-semibold text-xs">
                  <button
                    type="button"
                    onClick={() => setShowAdminPasswordPortal(false)}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-850 rounded-xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 bg-red-500 hover:bg-red-400 text-neutral-950 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    Entrar no Painel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <FullscreenImageViewer />
      <StudyMusicPlayer isOpen={showMusicPlayer} onClose={() => setShowMusicPlayer(false)} />
    </div>
  );
}
