/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Trophy, Users, ArrowRight, ChevronDown, CheckCircle2, MessageSquare, BarChart3, ShieldCheck, Award, Sparkles, Flame } from 'lucide-react';
import { PortalRole } from '../types';

const LOGO_OPEN = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png";
const LOGO_CLOSED = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/boneco_olhos_fechados_cutout_1_mmguon.png";

interface PortalHomeProps {
  onSelectRole: (role: PortalRole) => void;
  onOpenProjects?: () => void;
}

export default function PortalHome({ onSelectRole, onOpenProjects }: PortalHomeProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Preload and manage the mascot double-blink cycle:
  // 1. Imagem 1 (Aberta): 3 segundos
  // 2. Imagem 2 (Fechada): 0.2 segundos
  // 3. Imagem 1 (Aberta): 1 segundo
  // 4. Imagem 2 (Fechada): 0.2 segundos
  // 5. Retorna à Imagem 1 e reinicia o loop infinito
  useEffect(() => {
    const preloadOpen = new Image();
    preloadOpen.src = LOGO_OPEN;
    const preloadClosed = new Image();
    preloadClosed.src = LOGO_CLOSED;

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

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-[#0B0F0E] font-sans text-[#F1F5F3] select-none">
      
      {/* Top Header Navbar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-3 px-5 z-20 border border-[#27322D] bg-[#111715] rounded-full">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_OPEN}
            alt="Mascote WSM Athenas"
            referrerPolicy="no-referrer"
            className="w-8 h-8 object-contain select-none shrink-0"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-[#F1F5F3]">
              WSM Athenas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button 
            id="btn-projetos"
            onClick={onOpenProjects}
            className="px-4 py-1.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] font-medium text-xs rounded-full transition-colors cursor-pointer"
          >
            Projetos
          </button>

          <button 
            id="btn-entrar-aluno"
            onClick={() => onSelectRole('student')}
            className="px-4 py-1.5 bg-[#55E6B5] hover:bg-[#7AF0C8] text-[#07110D] font-bold text-xs rounded-full transition-colors active:scale-98 cursor-pointer shadow-[0_0_15px_rgba(85,230,181,0.2)]"
          >
            Entrar Aluno
          </button>
          
          <button 
            id="btn-entrar-professor"
            onClick={() => onSelectRole('teacher')}
            className="px-4 py-1.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] font-medium text-xs rounded-full transition-colors active:scale-98 cursor-pointer hidden sm:inline-block"
          >
            Entrar Professor
          </button>

          <button 
            id="btn-entrar-pais"
            onClick={() => onSelectRole('parent')}
            className="px-4 py-1.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] hover:text-[#55E6B5] font-medium text-xs rounded-full transition-colors active:scale-98 cursor-pointer hidden sm:inline-block"
          >
            Área dos Pais
          </button>
        </div>
      </header>

      {/* Center Branding Hero Container */}
      <div className="w-full max-w-5xl mx-auto min-h-[calc(100vh-160px)] flex flex-col items-center justify-center relative py-12 px-4 z-10">
        
        {/* Floating Side Card 1: Left (DESEMPENHO) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden xl:flex flex-col p-4 w-52 rounded-xl bg-[#111715] border border-[#27322D] shadow-2xl absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 -rotate-6 hover:rotate-0 transition-transform duration-300 pointer-events-auto z-10 text-left"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#77827C]">
              DESEMPENHO
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#111F1A] border border-[#1E3A2F] text-[10px] font-bold text-[#55E6B5]">
              92% ↑
            </span>
          </div>

          {/* Activity Bar Chart */}
          <div className="flex items-end justify-between gap-1.5 h-10 px-1 py-1">
            <div className="w-2.5 rounded-full bg-[#55E6B5]/40 h-2" />
            <div className="w-2.5 rounded-full bg-[#55E6B5]/60 h-4" />
            <div className="w-2.5 rounded-full bg-[#55E6B5]/50 h-3" />
            <div className="w-2.5 rounded-full bg-[#55E6B5]/80 h-6" />
            <div className="w-2.5 rounded-full bg-[#55E6B5]/70 h-5" />
            <div className="w-2.5 rounded-full bg-[#55E6B5] h-8" />
          </div>

          <span className="text-[11px] text-[#A5B0AA] font-medium mt-2">
            +12% essa semana
          </span>
        </motion.div>

        {/* Floating Side Card 2: Top Right (Streak 14 dias) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden xl:flex flex-col p-4 w-60 rounded-xl bg-[#111715] border border-[#27322D] shadow-2xl absolute right-0 top-10 translate-x-8 rotate-6 hover:rotate-0 transition-transform duration-300 pointer-events-auto z-10 text-left"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#111F1A] border border-[#1E3A2F] flex items-center justify-center text-[#55E6B5] shrink-0">
              <Flame className="w-4 h-4 text-[#55E6B5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F1F5F3] leading-tight">Streak 14 dias</h4>
              <p className="text-[10px] text-[#A5B0AA]">Você está voando!</p>
            </div>
          </div>

          <div className="w-full bg-[#171E1B] border border-[#27322D] h-2 rounded-full overflow-hidden">
            <div className="bg-[#55E6B5] h-full rounded-full w-4/5" />
          </div>
        </motion.div>

        {/* Floating Side Card 3: Bottom Right (SIMULADO ENEM) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="hidden xl:flex flex-col p-4 w-56 rounded-xl bg-[#111715] border border-[#27322D] shadow-2xl absolute right-0 bottom-6 translate-x-12 rotate-2 hover:rotate-0 transition-transform duration-300 pointer-events-auto z-10 text-left"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#77827C]">
            SIMULADO ENEM
          </span>
          <div className="text-2xl font-bold text-[#F1F5F3] mt-1 tracking-tight">
            780 pts
          </div>
          <span className="text-xs text-[#55E6B5] font-semibold mt-1">
            Top 3% da sua turma
          </span>
        </motion.div>

        {/* Center Hero Content Box */}
        <div className="flex flex-col items-center justify-center space-y-5 max-w-2xl mx-auto text-center z-20">

          {/* Mascot & Main Single Line Title */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 my-1">
            <motion.img
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={isBlinking ? LOGO_CLOSED : LOGO_OPEN}
              alt="Mascote WSM Athenas"
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain select-none shrink-0"
            />
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#F1F5F3] whitespace-nowrap leading-none">
              WSM Athenas
            </h1>
          </div>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#A5B0AA] max-w-xl leading-relaxed font-normal">
            Acesse sua plataforma de aprendizagem e estudos
          </p>

          {/* Action Pill Buttons */}
          <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
            <button
              onClick={onOpenProjects}
              className="px-5 py-2.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] font-medium text-xs sm:text-sm rounded-full transition-colors cursor-pointer"
            >
              Projetos
            </button>

            <button
              onClick={() => onSelectRole('student')}
              className="px-6 py-2.5 bg-[#55E6B5] hover:bg-[#7AF0C8] text-[#07110D] font-bold text-xs sm:text-sm rounded-full transition-colors cursor-pointer active:scale-98 shadow-[0_0_20px_rgba(85,230,181,0.25)]"
            >
              Área do Aluno
            </button>

            <button
              onClick={() => onSelectRole('teacher')}
              className="px-5 py-2.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] font-medium text-xs sm:text-sm rounded-full transition-colors cursor-pointer"
            >
              Área do Professor
            </button>

            <button
              onClick={() => onSelectRole('parent')}
              className="px-5 py-2.5 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] text-[#F1F5F3] hover:text-[#55E6B5] font-medium text-xs sm:text-sm rounded-full transition-colors cursor-pointer"
            >
              Área dos Pais
            </button>
          </div>

          {/* Scroll Link */}
          <a
            href="#secao-pais"
            className="pt-6 flex flex-col items-center gap-1.5 text-xs text-[#77827C] hover:text-[#55E6B5] transition-colors cursor-pointer group"
          >
            <span>Conheça a Área dos Pais</span>
            <ChevronDown className="w-4 h-4 text-[#55E6B5] group-hover:translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>

      {/* SEÇÃO DEDICADA: Área dos Pais & Responsáveis */}
      <section id="secao-pais" className="w-full max-w-5xl mx-auto py-16 sm:py-20 z-10 px-2 sm:px-4">
        <div className="p-6 sm:p-10 rounded-xl bg-[#111715] border border-[#27322D] text-left">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[#27322D]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#171E1B] border border-[#27322D] text-[#55E6B5] text-[11px] font-medium uppercase tracking-wide">
                  Recurso
                </span>
                <span className="text-xs text-[#A5B0AA]">
                  Acompanhamento Acadêmico
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F1F5F3] tracking-tight flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#55E6B5]" />
                Área dos Pais & Responsáveis
              </h2>
              <p className="text-xs sm:text-sm text-[#A5B0AA] max-w-2xl leading-relaxed">
                Acompanhe notas de simulados, ranking, frequência e conversas de estudo dos seus filhos com o tutor Athenas.
              </p>
            </div>

            <button
              id="btn-secao-pais-acessar"
              onClick={() => onSelectRole('parent')}
              className="px-4 py-2.5 bg-[#55E6B5] hover:bg-[#7AF0C8] text-[#07110D] font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-2 shrink-0 self-start md:self-center"
            >
              <span>Acessar Área dos Pais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 mb-8">
            <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-start gap-3">
              <div className="p-2 rounded-md bg-[#111715] border border-[#27322D] text-[#55E6B5] shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#F1F5F3]">Espelho de Tutoria</h4>
                <p className="text-xs text-[#A5B0AA] mt-1 leading-relaxed">Acesso às conversas acadêmicas e dúvidas do aluno com o assistente Athenas.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-start gap-3">
              <div className="p-2 rounded-md bg-[#111715] border border-[#27322D] text-[#55E6B5] shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#F1F5F3]">Notas & Métricas</h4>
                <p className="text-xs text-[#A5B0AA] mt-1 leading-relaxed">Desempenho em simulados, horas de estudo, evolução e consistência pedagógica.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-start gap-3">
              <div className="p-2 rounded-md bg-[#111715] border border-[#27322D] text-[#55E6B5] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#F1F5F3]">Vínculo Seguro</h4>
                <p className="text-xs text-[#A5B0AA] mt-1 leading-relaxed">Conexão protegida por código de autorização gerado diretamente pelo aluno.</p>
              </div>
            </div>
          </div>

          {/* Passo a Passo Card Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#77827C] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#55E6B5]" />
                Passos para Vinculação de Conta
              </span>
              <span className="text-xs text-[#77827C]">Processo em 3 etapas</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#111715] border border-[#27322D] text-[#55E6B5] text-[10px] font-semibold">
                      Passo 1
                    </span>
                    <span className="text-[11px] text-[#77827C]">Conta do aluno</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#F1F5F3] mb-1">Acesso aos Ajustes</h4>
                  <p className="text-xs text-[#A5B0AA] leading-relaxed">
                    O aluno acessa a plataforma e abre a seção de Perfil / Vínculo com Pais.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-[#27322D] text-[11px] text-[#77827C] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#55E6B5]" />
                  <span>Aba Vínculo com Pais</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#111715] border border-[#27322D] text-[#55E6B5] text-[10px] font-semibold">
                      Passo 2
                    </span>
                    <span className="text-[11px] text-[#77827C]">Código de 4 dígitos</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#F1F5F3] mb-1">Gerar Código</h4>
                  <p className="text-xs text-[#A5B0AA] leading-relaxed">
                    O aluno gera um código de 4 caracteres para autorizar o acesso da família.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-[#27322D] text-[11px] text-[#77827C] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#55E6B5]" />
                  <span>Até 5 responsáveis por aluno</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#171E1B] border border-[#27322D] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#111715] border border-[#27322D] text-[#55E6B5] text-[10px] font-semibold">
                      Passo 3
                    </span>
                    <span className="text-[11px] text-[#77827C]">Área dos pais</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#F1F5F3] mb-1">Inserir e Conectar</h4>
                  <p className="text-xs text-[#A5B0AA] leading-relaxed">
                    O responsável cadastra sua conta e insere o código para desbloquear os dados.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-[#27322D] text-[11px] text-[#77827C] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#55E6B5]" />
                  <span>Acesso instantâneo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer within section */}
          <div className="mt-6 pt-5 border-t border-[#27322D] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#171E1B] p-4 rounded-lg border border-[#27322D]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#111715] border border-[#27322D] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[#55E6B5]" />
              </div>
              <p className="text-xs text-[#A5B0AA]">
                Já possui o código fornecido pelo aluno? Conecte-se para iniciar o acompanhamento.
              </p>
            </div>
            <button
              onClick={() => onSelectRole('parent')}
              className="px-3.5 py-2 bg-[#55E6B5] hover:bg-[#7AF0C8] text-[#07110D] font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>Vincular Conta de Aluno</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Preloaders */}
      <img
        src={LOGO_OPEN}
        alt=""
        referrerPolicy="no-referrer"
        className="hidden"
        aria-hidden="true"
      />
      <img
        src={LOGO_CLOSED}
        alt=""
        referrerPolicy="no-referrer"
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
