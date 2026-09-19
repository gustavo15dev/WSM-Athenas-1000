import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Megaphone, Sparkles, Send } from 'lucide-react';

interface PublishSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  targetClass?: string;
  message?: string;
}

// Generate random confetti particles
const CONFETTI_PARTICLES = Array.from({ length: 28 }).map((_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 320,
  y: -Math.random() * 220 - 40,
  rotation: Math.random() * 720 - 360,
  scale: Math.random() * 0.6 + 0.5,
  color: [
    '#10b981', // Emerald
    '#34d399', // Mint
    '#02c39a', // Teal
    '#f59e0b', // Amber/Gold
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#ffffff'  // White
  ][i % 7],
  shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'square' : 'pill'
}));

export default function PublishSuccessModal({
  isOpen,
  onClose,
  title = 'Aviso / Comunicado',
  targetClass,
  message = 'Seu aviso foi registrado e as notificações foram enviadas em tempo real.'
}: PublishSuccessModalProps) {

  // Auto close after 3.5 seconds if user doesn't click
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3800);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          {/* Confetti Container */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            {CONFETTI_PARTICLES.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                animate={{
                  x: particle.x,
                  y: particle.y,
                  opacity: [1, 1, 0],
                  scale: particle.scale,
                  rotate: particle.rotation
                }}
                transition={{
                  duration: 1.8 + (particle.id % 5) * 0.2,
                  ease: [0.22, 1, 0.36, 1],
                  delay: (particle.id % 4) * 0.05
                }}
                className="absolute"
                style={{
                  backgroundColor: particle.color,
                  width: particle.shape === 'pill' ? '12px' : '8px',
                  height: particle.shape === 'square' ? '8px' : particle.shape === 'pill' ? '5px' : '8px',
                  borderRadius: particle.shape === 'circle' ? '50%' : particle.shape === 'pill' ? '999px' : '2px',
                  boxShadow: `0 0 10px ${particle.color}80`
                }}
              />
            ))}
          </div>

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="relative w-full max-w-md bg-neutral-950 border border-emerald-500/40 rounded-3xl p-7 text-center shadow-[0_0_50px_rgba(16,185,129,0.25)] space-y-6 overflow-hidden"
          >
            {/* Background Ambient Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Giant Check Badge with Pulsing Ring */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.25, 1] }}
                transition={{ duration: 0.5, ease: 'backOut' }}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-2xl shadow-emerald-500/50 flex items-center justify-center"
              >
                <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-500/15 animate-pulse" />
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Check className="w-12 h-12 text-emerald-400 stroke-[3]" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Decorative spark badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 }}
                className="absolute -top-1 -right-1 p-1.5 bg-amber-400 text-neutral-950 rounded-full shadow-lg"
              >
                <Sparkles className="w-4 h-4 fill-neutral-950" />
              </motion.div>
            </div>

            {/* Modal Text Content */}
            <div className="space-y-2 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-widest">
                <Megaphone className="w-3 h-3 text-emerald-400" />
                Publicação Concluída
              </span>

              <h3 className="text-xl font-extrabold text-neutral-100 font-display">
                Aviso Publicado com Sucesso!
              </h3>

              {title && (
                <p className="text-xs font-semibold text-emerald-300 font-mono bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800 line-clamp-1 truncate max-w-xs mx-auto">
                  "{title}"
                </p>
              )}

              <p className="text-xs text-neutral-400 leading-relaxed pt-1">
                {targetClass ? (
                  <>
                    Disparado instantaneamente para os alunos da turma{' '}
                    <strong className="text-emerald-400 font-bold">{targetClass}</strong>.
                  </>
                ) : (
                  message
                )}
              </p>

              <div className="flex items-center justify-center gap-2 pt-2 text-[10px] font-mono text-neutral-500">
                <Send className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Notificação enviada em tempo real para os dispositivos cadastrados</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-neutral-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
