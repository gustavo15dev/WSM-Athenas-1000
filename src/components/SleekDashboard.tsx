import React from 'react';
import { motion } from 'motion/react';
import { LogOut, User, Sparkles, Layout, Globe, BookOpen, Compass } from 'lucide-react';
import { PortalRole } from '../types';

interface SleekDashboardProps {
  email: string;
  role: PortalRole;
  onLogout: () => void;
}

export default function SleekDashboard({ email, role, onLogout }: SleekDashboardProps) {
  const isStudent = role === 'student';

  return (
    <div className="relative min-h-screen bg-[#050505] text-white flex font-sans overflow-hidden">
      
      {/* Decorative Blur Spheres for Aesthetic Depth */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[350px] h-[350px] bg-emerald-950/15 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT SIDEBAR */}
      <aside 
        id="dashboard-sidebar"
        className="w-64 md:w-72 border-r border-white/5 bg-neutral-950/40 backdrop-blur-3xl flex flex-col justify-between py-8 px-6 z-20 shrink-0 relative"
      >
        {/* Subtle grid accent inside the sidebar */}
        <div className="absolute inset-0 opacity-[0.01] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:20px_20px]" />
        
        <div className="space-y-8 relative">
          
          {/* Logo Brand Title */}
          <div className="flex items-center space-x-3 pb-6 border-b border-white/5">
            <div className="w-10 h-10 bg-gradient-to-b from-neutral-900 to-neutral-950 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                alt="Logo"
                referrerPolicy="no-referrer"
                className="w-14 h-14 max-w-none object-contain select-none"
              />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-400">
                Athenas
              </span>
              <p className="text-[9px] text-[#10b981]/60 uppercase tracking-[0.2em] font-mono leading-none mt-0.5">
                Cognitive Portal
              </p>
            </div>
          </div>

          {/* Empty Sidebar State Indicator with Delicate Dashed Container */}
          <div className="space-y-4 pt-4">
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-semibold block px-2">
              Menu Principal
            </span>
            
            <div className="border border-dashed border-white/5 rounded-2xl p-6 text-center space-y-3 bg-white/[0.01]">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                <Layout className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                  Módulos de aula e diários de notas em fase de implantação.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Details & Sair (Logout) Button */}
        <div className="space-y-6 pt-6 border-t border-white/5 relative">
          
          {/* Logged in User Identity Card */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono text-sm uppercase shrink-0 font-bold">
              {email ? email.charAt(0) : 'U'}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/90 truncate" title={email}>
                {email || 'Usuário Athenas'}
              </p>
              
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[9px] uppercase tracking-wider text-[#10b981] font-mono font-bold">
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
            className="w-full py-3.5 px-4 bg-neutral-900/60 hover:bg-neutral-850 border border-white/5 hover:border-emerald-500/20 hover:text-emerald-400 transition-all rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
          >
            <LogOut className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* MAIN MAIN CONTENT WORKSPACE */}
      <main className="flex-1 bg-gradient-to-b from-[#080808] to-[#040404] p-8 md:p-12 overflow-y-auto flex flex-col justify-between z-10">
        
        {/* Workspace Upper Bar */}
        <div className="flex justify-between items-center pb-8 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 tracking-[0.1em] font-medium uppercase font-mono">
              Ambiente de Trabalho Activo
            </span>
            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
              ONLINE
            </span>
          </div>
          
          <div className="text-xs text-white/40 font-mono">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Center Workspace Greeting Card in Modern Grid Layout */}
        <div className="my-auto py-12 max-w-4xl mx-auto w-full space-y-10">
          
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full"
            >
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              <span className="text-[10px] text-white/60 tracking-wider">Configuração de Credenciais Concluída</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none"
            >
              Olá, <span className="text-[#10b981] font-extrabold">{email || 'Estudante'}</span>.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 0.6, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-neutral-400 text-sm md:text-base tracking-wide max-w-2xl leading-relaxed font-sans"
            >
              Seu perfil de <strong className="text-white font-medium">{isStudent ? 'Aluno' : 'Professor'}</strong> foi autenticado com sucesso na base de dados. O painel central está sendo carregado com os dados integrados do seu cronograma de aulas e diário acadêmico.
            </motion.p>
          </div>

          {/* Visual Concept Placeholder Displaying Premium Quality */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4"
          >
            <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#10b981]">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Cronograma & Diários</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Informações de notas, frequências, boletins e presenças estarão sincronizadas com a sua nova conta institucional.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#10b981]">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Próximo Passo no Athenas</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Novas turmas, chamadas virtuais e ferramentas de inteligência artificial cognitiva serão adicionadas neste diretório.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Workspace Footer details */}
        <div className="text-center pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-neutral-500 tracking-wider uppercase font-mono">
          <span> ATHENAS COGNITIVE SYSTEMS © 2026.1</span>
          <span className="flex items-center gap-1.5 mt-2 md:mt-0">
            <Globe className="w-3.5 h-3.5 text-[#10b981]/80" />
            <span>Região Ativa: Central de Dados</span>
          </span>
        </div>
      </main>
    </div>
  );
}
