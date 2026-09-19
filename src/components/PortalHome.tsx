/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Landmark, Sparkles, Trophy } from 'lucide-react';
import { PortalRole } from '../types';

interface PortalHomeProps {
  onSelectRole: (role: PortalRole) => void;
}

export default function PortalHome({ onSelectRole }: PortalHomeProps) {
  const [gifSrc, setGifSrc] = useState("https://i.ibb.co/CKrqwX3f/Adobe-Express-503402de-b8ec-479e-9cb6-dfa44fa80675-1.gif");
  const [gifError, setGifError] = useState(false);

  const handleGifError = () => {
    setGifError(true);
  };

  // Letters of the title "Athenas" for sequential wave animation
  const titleLetters = "Athenas".split("");

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

  const buttonVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as any,
      }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 overflow-hidden uiverse-dark-grid font-sans text-white select-none">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#10b981] opacity-10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#064e3b] opacity-20 rounded-full blur-[70px] md:blur-[100px] pointer-events-none"></div>
      
      {/* Top Header Navbar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 z-20 border border-neutral-800/80 bg-neutral-950/60 backdrop-blur-xl rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <img
            src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
            alt="WSM Athenas Mascot"
            referrerPolicy="no-referrer"
            className="w-9 h-9 sm:w-11 sm:h-11 object-contain select-none drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-xl font-extrabold tracking-tight font-sans text-white">
              <span className="text-emerald-400">WSM</span> Athenas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            id="btn-entrar-aluno"
            onClick={() => onSelectRole('student')}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md hover:shadow-emerald-500/25 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Entrar Aluno</span>
          </button>
          
          <button 
            id="btn-entrar-professor"
            onClick={() => onSelectRole('teacher')}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-semibold text-xs sm:text-sm rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2 backdrop-blur-md shadow-sm"
          >
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span>Entrar Professor</span>
          </button>
        </div>
      </header>

      {/* Center Branding Hero */}
      <div className="flex flex-col items-center justify-center space-y-4 z-10 my-auto py-12">
        {/* Dynamic staggered title: "Athenas" */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-1 sm:gap-2"
        >
          {/* Logo Mascote Oficial */}
          <motion.img
            variants={letterVariants}
            src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
            alt="Mascote WSM Athenas"
            referrerPolicy="no-referrer"
            className="w-24 h-24 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain select-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] -mr-3 sm:-mr-6 md:-mr-8"
          />

          <div className="flex items-center justify-center">
            <motion.span
              variants={letterVariants}
              className="text-7xl sm:text-9xl md:text-[130px] font-normal leading-none mb-1 select-none animate-glow"
              style={{
                fontFamily: "'Brother Signature', 'Mr De Haviland', 'Monsieur La Doulaise', cursive",
                background: "linear-gradient(180deg, #FFFFFF 40%, #10b981 120%)",
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
          animate={{ opacity: 0.6, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-xs md:text-sm text-neutral-400 font-sans tracking-wide max-w-sm text-center leading-relaxed mt-4"
        >
          Acesse sua plataforma de estudos de Biologia
        </motion.p>
      </div>

      {/* Subtle Corner Detail */}
      <div className="absolute bottom-0 right-0 p-4 hidden md:block pointer-events-none">
        <div className="w-16 h-16 border-r-2 border-b-2 border-[#10b981]/20"></div>
      </div>

      {/* Pré-carregador oculto da imagem de login/cadastro para carregamento instantâneo */}
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

