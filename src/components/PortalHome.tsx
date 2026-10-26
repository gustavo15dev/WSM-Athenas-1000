/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Sparkles, Trophy, Users, ArrowRight, ChevronDown, CheckCircle2, MessageSquare, BarChart3, ShieldCheck } from 'lucide-react';
import { PortalRole } from '../types';

const LOGO_OPEN = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png";
const LOGO_CLOSED = "https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/boneco_olhos_fechados_cutout_1_mmguon.png";

interface PortalHomeProps {
  onSelectRole: (role: PortalRole) => void;
}

export default function PortalHome({ onSelectRole }: PortalHomeProps) {
  const [gifSrc, setGifSrc] = useState("https://i.ibb.co/CKrqwX3f/Adobe-Express-503402de-b8ec-479e-9cb6-dfa44fa80675-1.gif");
  const [gifError, setGifError] = useState(false);
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
      timer = setTimeout(step2CloseFirst, 3000); // 3 segundos aberta
    };

    const step2CloseFirst = () => {
      setIsBlinking(true);
      timer = setTimeout(step3OpenShort, 200); // 0.2 segundos fechada
    };

    const step3OpenShort = () => {
      setIsBlinking(false);
      timer = setTimeout(step4CloseSecond, 1000); // 1 segundo aberta
    };

    const step4CloseSecond = () => {
      setIsBlinking(true);
      timer = setTimeout(step1OpenLong, 200); // 0.2 segundos fechada -> volta ao início
    };

    step1OpenLong();

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleGifError = () => {
    setGifError(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
      } as any,
    },
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 uiverse-dark-grid font-sans text-white select-none">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#1eb996] opacity-10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#0c4f42] opacity-20 rounded-full blur-[70px] md:blur-[100px] pointer-events-none" />
      
      {/* Top Header Navbar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 z-20 border border-neutral-800/80 bg-neutral-950/60 backdrop-blur-xl rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <img
            src="https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png"
            alt="WSM Athenas Mascot"
            referrerPolicy="no-referrer"
            className="w-9 h-9 sm:w-11 sm:h-11 object-contain select-none drop-shadow-[0_0_12px_rgba(30,185,150,0.35)]"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-xl font-extrabold tracking-tight font-sans text-white">
              <span className="text-emerald-400">WSM</span> Athenas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <button 
            id="btn-entrar-aluno"
            onClick={() => onSelectRole('student')}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md hover:shadow-emerald-500/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Entrar Aluno</span>
          </button>
          
          <button 
            id="btn-entrar-professor"
            onClick={() => onSelectRole('teacher')}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-semibold text-xs sm:text-sm rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 backdrop-blur-md shadow-sm"
          >
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span>Entrar Professor</span>
          </button>

          <button 
            id="btn-entrar-pais"
            onClick={() => onSelectRole('parent')}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#02c39a]/15 hover:bg-[#02c39a]/25 border border-[#02c39a]/40 text-[#02c39a] hover:text-white font-semibold text-xs sm:text-sm rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 backdrop-blur-md shadow-sm"
          >
            <Users className="w-4 h-4 text-[#02c39a]" />
            <span>Área dos Pais</span>
          </button>
        </div>
      </header>

      {/* Center Branding Hero - Full height above the fold */}
      <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center space-y-5 z-10 py-10 relative">
        {/* Dynamic staggered title: "Athenas" */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-1 sm:gap-2"
        >
          {/* Logo Mascote Oficial com efeito piscar dinâmico */}
          <motion.img
            variants={letterVariants}
            src={isBlinking ? LOGO_CLOSED : LOGO_OPEN}
            alt="Mascote WSM Athenas"
            referrerPolicy="no-referrer"
            className="w-28 h-28 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain select-none drop-shadow-[0_0_20px_rgba(30,185,150,0.35)] -mr-3 sm:-mr-6 md:-mr-8 transition-all duration-75"
          />

          <div className="flex items-center justify-center">
            <motion.span
              variants={letterVariants}
              className="text-7xl sm:text-9xl md:text-[135px] font-normal leading-none mb-1 select-none animate-glow"
              style={{
                fontFamily: "'Brother Signature', 'Mr De Haviland', 'Monsieur La Doulaise', cursive",
                background: "linear-gradient(180deg, #FFFFFF 40%, #1eb996 120%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                paddingRight: "16px",
              }}
            >
              Athenas
            </motion.span>
          </div>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 0.8, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-xs sm:text-sm md:text-base text-neutral-300 font-sans tracking-wide max-w-md text-center leading-relaxed"
        >
          Acesse sua plataforma inteligente de aprendizagem e estudos
        </motion.p>

        {/* Quick action buttons on hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="flex items-center gap-3 pt-3 flex-wrap justify-center"
        >
          <button
            onClick={() => onSelectRole('student')}
            className="px-5 py-3 bg-[#02c39a] hover:bg-[#02b18c] text-neutral-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-[#02c39a]/20 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Área do Aluno</span>
          </button>
          <button
            onClick={() => onSelectRole('teacher')}
            className="px-5 py-3 bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-700 text-neutral-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span>Área do Professor</span>
          </button>
          <button
            onClick={() => onSelectRole('parent')}
            className="px-5 py-3 bg-[#02c39a]/15 hover:bg-[#02c39a]/25 border border-[#02c39a]/40 text-[#02c39a] hover:text-white font-bold text-xs sm:text-sm rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Área dos Pais</span>
          </button>
        </motion.div>

        {/* Scroll down indicator to discover parent section */}
        <motion.a
          href="#secao-pais"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1.3, duration: 0.8 }}
          className="absolute bottom-4 flex flex-col items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer group"
        >
          <span>Conheça a nova Área dos Pais</span>
          <ChevronDown className="w-4 h-4 animate-bounce text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
        </motion.a>
      </div>

      {/* SEÇÃO DEDICADA: Área dos Pais & Responsáveis (Apenas visível rolando para baixo) */}
      <section id="secao-pais" className="w-full max-w-5xl mx-auto py-16 sm:py-24 z-10 px-2 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="p-6 sm:p-10 rounded-3xl bg-neutral-950/85 border border-[#02c39a]/35 backdrop-blur-2xl shadow-3xl relative overflow-hidden text-left"
        >
          {/* Subtle verde água glow background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#02c39a]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#02c39a] text-neutral-950 text-[10.5px] font-black uppercase tracking-wider font-mono shadow-md shadow-[#02c39a]/20">
                  NOVO
                </span>
                <span className="text-xs font-mono font-medium text-[#02c39a] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Conexão Família & Escola
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-neutral-100 font-display tracking-tight flex items-center gap-3">
                <Users className="w-6 h-6 text-[#02c39a]" />
                Acompanhamento em Tempo Real para Pais & Responsáveis
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-2xl leading-relaxed">
                Transparência completa na evolução acadêmica dos seus filhos. Acompanhe notas, simulados, métricas de estudo e visualize em primeira mão todas as interações com a IA Athenas.
              </p>
            </div>

            <button
              id="btn-secao-pais-acessar"
              onClick={() => onSelectRole('parent')}
              className="px-5 py-3 bg-[#02c39a] hover:bg-[#02b18c] text-neutral-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-[#02c39a]/20 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 self-start md:self-center"
            >
              <span>Acessar Portal dos Pais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 mb-8">
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/90 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#02c39a]/10 border border-[#02c39a]/20 text-[#02c39a] shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-100">Espelho do Chat com IA</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-snug">Visualização idêntica em primeira mão de todas as conversas e dúvidas do aluno com o tutor inteligente.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/90 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#02c39a]/10 border border-[#02c39a]/20 text-[#02c39a] shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-100">Notas & Minhas Métricas</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-snug">Acesso a todas as notas de simulados, ranking de aproveitamento, horas de estudo e consistência.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/90 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#02c39a]/10 border border-[#02c39a]/20 text-[#02c39a] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-100">Múltiplos Filhos & Segurança</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-snug">Alterne entre mais de 2 filhos com facilidade. Cada aluno tem limite de até 5 vínculos protegidos.</p>
              </div>
            </div>
          </div>

          {/* Passo a Passo Card Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#02c39a]" />
                Passo a Passo para Vincular sua Conta
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">Simples, rápido e seguro</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#02c39a]/10 border border-[#02c39a]/25 text-[#02c39a] text-[10px] font-mono font-bold">
                      1º PASSO
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">Na conta do aluno</span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1.5">Aluno Acessa os Ajustes</h4>
                  <p className="text-[11.5px] text-neutral-300 leading-relaxed">
                    Peça ao seu filho para entrar na conta dele do Athenas e clicar no ícone de <strong className="text-[#02c39a] font-semibold">Ajustes / Perfil</strong> no topo da página.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-800/80 text-[10.5px] text-neutral-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#02c39a]" />
                  <span>Aba "Vínculo com Pais"</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#02c39a]/10 border border-[#02c39a]/25 text-[#02c39a] text-[10px] font-mono font-bold">
                      2º PASSO
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">Código exclusivo</span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1.5">Gera Código de 4 Dígitos</h4>
                  <p className="text-[11.5px] text-neutral-300 leading-relaxed">
                    O aluno clica em <strong className="text-[#02c39a] font-semibold">"Gerar Novo Código"</strong>. Será exibido um código de 4 caracteres (números e letras maiúsculas, ex: <span className="font-mono text-emerald-300 font-bold">A7K2</span>).
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-800/80 text-[10.5px] text-neutral-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#02c39a]" />
                  <span>Máximo de 5 vínculos por aluno</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#02c39a]/10 border border-[#02c39a]/25 text-[#02c39a] text-[10px] font-mono font-bold">
                      3º PASSO
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">Na área dos pais</span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-100 mb-1.5">Conecte e Acompanhe</h4>
                  <p className="text-[11.5px] text-neutral-300 leading-relaxed">
                    Cadastre sua conta com <strong className="text-neutral-100 font-semibold">e-mail e senha</strong>, insira os 4 dígitos na tela inicial e pronto! O dashboard do seu filho é liberado instantaneamente.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-800/80 text-[10.5px] text-neutral-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#02c39a]" />
                  <span>Sem limite de filhos por pai</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer within section */}
          <div className="mt-8 pt-6 border-t border-neutral-850 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900/40 p-4 rounded-2xl border border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#02c39a]/15 border border-[#02c39a]/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#02c39a]" />
              </div>
              <p className="text-xs text-neutral-300">
                Já possui o código fornecido pelo seu filho? Comece a acompanhar o progresso acadêmico agora mesmo.
              </p>
            </div>
            <button
              onClick={() => onSelectRole('parent')}
              className="px-4 py-2 bg-[#02c39a] hover:bg-[#02b18c] text-neutral-950 font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-[#02c39a]/25 active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>Vincular Conta de Aluno</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Subtle Corner Detail */}
      <div className="absolute bottom-0 right-0 p-4 hidden md:block pointer-events-none">
        <div className="w-16 h-16 border-r-2 border-b-2 border-[#1eb996]/20" />
      </div>

      {/* Preloaders */}
      <img
        src={LOGO_OPEN}
        alt="Preloader Mascote Aberto"
        referrerPolicy="no-referrer"
        className="hidden"
        aria-hidden="true"
      />
      <img
        src={LOGO_CLOSED}
        alt="Preloader Mascote Fechado"
        referrerPolicy="no-referrer"
        className="hidden"
        aria-hidden="true"
      />
      <img
        src="https://i.ibb.co/dsNgMZMN/2.jpg"
        alt="Preloader Arte Athenas"
        referrerPolicy="no-referrer"
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

