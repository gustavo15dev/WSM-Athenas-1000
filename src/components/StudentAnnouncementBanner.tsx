import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ClipboardList, BookOpen, TrendingUp, ChevronRight, Trophy } from 'lucide-react';
import { getStudentCertificates, StudentCertificateItem } from '../utils/weeklyRanking';

interface StudentAnnouncementBannerProps {
  onNavigate: (tab: 'wsm_athenas' | 'simulados' | 'caderno' | 'progresso' | 'mural' | 'conquistas') => void;
  userEmail?: string;
}

export default function StudentAnnouncementBanner({ onNavigate, userEmail }: StudentAnnouncementBannerProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [userCerts, setUserCerts] = useState<StudentCertificateItem[]>([]);

  useEffect(() => {
    if (userEmail) {
      getStudentCertificates(userEmail).then((certs) => {
        if (certs && certs.length > 0) {
          setUserCerts(certs);
        }
      }).catch(() => {});
    }
  }, [userEmail]);

  const latestCert = userCerts[0];

  const slides = useMemo(() => {
    const defaultSlides = [
      {
        id: 'athenas_ai',
        badge: 'TUTOR INTELIGENTE',
        iconUrl: 'https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png',
        iconComponent: null,
        title: 'Athenas AI',
        subtitle: 'Tire dúvidas em tempo real, peça resumos de matérias e mapas de estudos com seu tutor de IA.',
        buttonText: 'Ir para o Athenas AI',
        targetTab: 'wsm_athenas' as const,
        accentColor: '#55e6b5'
      },
      {
        id: 'simulados',
        badge: 'PROVAS & AVALIAÇÕES',
        iconUrl: null,
        iconComponent: ClipboardList,
        title: 'Simulados Online',
        subtitle: 'Pratique com simulados agendados por seus professores e receba gabarito com nota imediata.',
        buttonText: 'Ver Simulados',
        targetTab: 'simulados' as const,
        accentColor: '#83a9ff'
      },
      {
        id: 'caderno',
        badge: 'ANOTAÇÕES OFICIAIS',
        iconUrl: null,
        iconComponent: BookOpen,
        title: 'Caderno Virtual de Biologia',
        subtitle: 'Escreva suas folhas de estudo e solicite carimbos e vistos pedagógicos dos professores.',
        buttonText: 'Abrir Caderno',
        targetTab: 'caderno' as const,
        accentColor: '#b7a0ff'
      },
      {
        id: 'progresso',
        badge: 'DESEMPENHO',
        iconUrl: null,
        iconComponent: TrendingUp,
        title: 'Minhas Métricas & Gráficos',
        subtitle: 'Acompanhe a evolução das suas notas, mapa de calor de presença e horas ativas de estudo.',
        buttonText: 'Ver Minhas Métricas',
        targetTab: 'progresso' as const,
        accentColor: '#efbd77'
      }
    ];

    if (latestCert) {
      const placeText = latestCert.place === 'gold' ? '1º Lugar (Ouro)' : latestCert.place === 'silver' ? '2º Lugar (Prata)' : '3º Lugar (Bronze)';
      return [
        {
          id: 'certificate_winner_slide',
          badge: '🏆 CERTIFICADO DE RECONHECIMENTO',
          iconUrl: null,
          iconComponent: Trophy,
          title: `Parabéns! Você conquistou o ${placeText} no Ranking Semanal!`,
          subtitle: `Sua dedicação no ciclo ${latestCert.cycleRangeText} foi reconhecida! Clique para visualizar e baixar seu Certificado em PNG.`,
          buttonText: 'Baixar Certificado PNG',
          targetTab: 'conquistas' as const,
          accentColor: '#e4bf74'
        },
        ...defaultSlides
      ];
    }

    return defaultSlides;
  }, [latestCert]);

  // Auto rotation every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const current = slides[slideIndex] || slides[0];
  const IconComp = current.iconComponent;

  return (
    <div className="w-full bg-[#111715] border border-[#27322d] hover:border-[#55e6b5]/40 rounded-3xl p-5 sm:p-6 mb-6 font-sans relative overflow-hidden transition-all duration-300 shadow-xl group select-none">
      {/* Background Subtle Gradient Glow */}
      <div 
        className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-15 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: current.accentColor }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10"
        >
          <div className="flex items-center gap-4">
            {/* Mascot / Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-[#171e1b] border border-[#27322d] flex items-center justify-center shrink-0 overflow-hidden shadow-inner p-1.5 group-hover:scale-105 transition-transform">
              {current.iconUrl ? (
                <img 
                  src={current.iconUrl} 
                  alt="Mascote Athenas" 
                  className="w-11 h-11 object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              ) : IconComp ? (
                <IconComp className="w-7 h-7" style={{ color: current.accentColor }} />
              ) : (
                <Sparkles className="w-7 h-7 text-[#55e6b5]" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span 
                  className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                  style={{ 
                    color: current.accentColor, 
                    backgroundColor: `${current.accentColor}15`,
                    borderColor: `${current.accentColor}30`
                  }}
                >
                  {current.badge}
                </span>
              </div>
              <h3 
                onClick={() => onNavigate(current.targetTab)}
                className="text-lg sm:text-xl font-bold text-[#f1f5f3] hover:text-[#55e6b5] transition-colors cursor-pointer flex items-center gap-1.5 leading-tight"
              >
                <span>{current.title}</span>
                <ChevronRight className="w-4 h-4 text-[#77827c]" />
              </h3>
              <p className="text-xs text-[#a5b0aa] max-w-xl leading-relaxed">
                {current.subtitle}
              </p>
            </div>
          </div>

          {/* Action Button & Navigation Dots */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#27322d]">
            <button
              onClick={() => onNavigate(current.targetTab)}
              className="px-4 py-2.5 bg-[#55e6b5] hover:bg-[#42d4a3] active:scale-98 text-[#0b0f0e] font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
              style={{ backgroundColor: current.id === 'certificate_winner_slide' ? '#e4bf74' : undefined }}
            >
              <span>{current.buttonText}</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Carousel Slide Dots */}
            <div className="flex items-center gap-1.5">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setSlideIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    slideIndex === idx ? 'w-5 bg-[#55e6b5]' : 'w-1.5 bg-[#27322d] hover:bg-[#77827c]'
                  }`}
                  style={{ backgroundColor: slideIndex === idx && s.id === 'certificate_winner_slide' ? '#e4bf74' : undefined }}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
