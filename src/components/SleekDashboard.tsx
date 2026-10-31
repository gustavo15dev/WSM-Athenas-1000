import React from 'react';
import { motion } from 'motion/react';
import { LogOut, Layout, Globe, BookOpen, Compass } from 'lucide-react';
import { PortalRole } from '../types';

interface SleekDashboardProps {
  email: string;
  role: PortalRole;
  onLogout: () => void;
}

export default function SleekDashboard({ email, role, onLogout }: SleekDashboardProps) {
  const isStudent = role === 'student';

  return (
    <div className="relative min-h-screen bg-[#0B0F0E] text-[#F1F5F3] flex font-sans overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside 
        id="dashboard-sidebar"
        className="w-64 md:w-72 border-r border-[#27322D] bg-[#111715] flex flex-col justify-between py-8 px-6 z-20 shrink-0 relative"
      >
        <div className="space-y-8 relative">
          {/* Logo Brand Title */}
          <div className="flex items-center space-x-3 pb-6 border-b border-[#27322D]">
            <div className="w-10 h-10 bg-[#171E1B] border border-[#27322D] rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png"
                alt="Logo"
                referrerPolicy="no-referrer"
                className="w-14 h-14 max-w-none object-contain select-none"
              />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-[#F1F5F3]">
                Athenas
              </span>
              <p className="text-[10px] text-[#55E6B5] uppercase tracking-wider font-semibold leading-none mt-1">
                Portal Cognitivo
              </p>
            </div>
          </div>

          {/* Empty Sidebar State Indicator */}
          <div className="space-y-4 pt-4">
            <div className="border border-dashed border-[#27322D] rounded-xl p-6 text-center space-y-3 bg-[#171E1B]/50">
              <div className="w-8 h-8 rounded-full bg-[#171E1B] border border-[#27322D] flex items-center justify-center mx-auto text-[#77827C]">
                <Layout className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-[#A5B0AA] font-normal leading-relaxed">
                  Módulos de aula e diários de notas em fase de implantação.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Details & Sair (Logout) Button */}
        <div className="space-y-4 pt-6 border-t border-[#27322D] relative">
          {/* Logged in User Identity Card */}
          <div className="p-3 bg-[#171E1B] border border-[#27322D] rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#55E6B5]/10 border border-[#55E6B5]/20 flex items-center justify-center text-[#55E6B5] text-xs uppercase shrink-0 font-bold">
              {email ? email.charAt(0) : 'U'}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F1F5F3] truncate" title={email}>
                {email || 'Usuário Athenas'}
              </p>
              
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#55E6B5]" />
                <span className="text-[10px] uppercase tracking-wider text-[#55E6B5] font-semibold">
                  {isStudent ? 'Aluno' : 'Professor'}
                </span>
              </div>
            </div>
          </div>

          {/* Sair (Logout) Button */}
          <button
            id="btn-sidebar-logout"
            onClick={onLogout}
            type="button"
            className="w-full py-2.5 px-3 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#A5B0AA] hover:text-[#F1F5F3] transition-colors rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 bg-[#0B0F0E] p-8 md:p-12 overflow-y-auto flex flex-col justify-between z-10">
        {/* Workspace Upper Bar */}
        <div className="flex justify-between items-center pb-6 border-b border-[#27322D]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#77827C] tracking-wide font-medium uppercase">
              Ambiente de Trabalho Ativo
            </span>
            <span className="px-2 py-0.5 bg-[#111F1A] border border-[#1E3A2F] rounded text-[10px] text-[#55E6B5] font-semibold uppercase tracking-wider">
              ONLINE
            </span>
          </div>
          
          <div className="text-xs text-[#77827C]">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Center Workspace Greeting Card */}
        <div className="my-auto py-12 max-w-4xl mx-auto w-full space-y-8">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-[#111715] border border-[#27322D] rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#55E6B5]" />
              <span className="text-[11px] text-[#A5B0AA]">Configuração de Credenciais Concluída</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-4xl md:text-5xl font-bold tracking-tight text-[#F1F5F3]"
            >
              Olá, <span className="text-[#55E6B5]">{email || 'Estudante'}</span>.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 0.6, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-[#A5B0AA] text-sm md:text-base max-w-2xl leading-relaxed"
            >
              Seu perfil de <strong className="text-[#F1F5F3] font-medium">{isStudent ? 'Aluno' : 'Professor'}</strong> foi autenticado com sucesso na base de dados. O painel central está sendo carregado com os dados integrados do seu cronograma de aulas e diário acadêmico.
            </motion.p>
          </div>

          {/* Visual Concept Cards */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4"
          >
            <div className="p-6 rounded-xl bg-[#111715] border border-[#27322D] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-center justify-center text-[#55E6B5]">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#F1F5F3]">Cronograma & Diários</h3>
              <p className="text-xs text-[#A5B0AA] leading-relaxed">
                Informações de notas, frequências, boletins e presenças estarão sincronizadas com a sua nova conta institucional.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#111715] border border-[#27322D] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-center justify-center text-[#55E6B5]">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#F1F5F3]">Próximo Passo no Athenas</h3>
              <p className="text-xs text-[#A5B0AA] leading-relaxed">
                Novas turmas, chamadas virtuais e ferramentas de inteligência artificial cognitiva serão adicionadas neste diretório.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Workspace Footer details */}
        <div className="pt-8 border-t border-[#27322D] flex flex-col md:flex-row justify-between items-center text-[11px] text-[#77827C]">
          <span>ATHENAS COGNITIVE SYSTEMS © 2026.1</span>
          <span className="flex items-center gap-1.5 mt-2 md:mt-0">
            <Globe className="w-3.5 h-3.5 text-[#55E6B5]" />
            <span>Região Ativa: Central de Dados</span>
          </span>
        </div>
      </main>
    </div>
  );
}
