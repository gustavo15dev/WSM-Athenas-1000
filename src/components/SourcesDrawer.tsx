import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, ArrowUpRight } from 'lucide-react';
import { WebSource, extractDomain } from '../utils/tavilyAgent';

interface SourcesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: WebSource[];
  activeSourceUrl?: string;
}

export default function SourcesDrawer({
  isOpen,
  onClose,
  sources,
  activeSourceUrl
}: SourcesDrawerProps) {
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Lateral Card Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md md:max-w-lg bg-[#0c0f14] border-l border-neutral-850 shadow-2xl flex flex-col overflow-hidden select-text"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-850 bg-[#0c0f14]/95 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Fontes
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                    {sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sources List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-thin">
              {sources.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 text-xs flex flex-col items-center gap-2">
                  <Globe className="w-8 h-8 text-neutral-600 mb-1" />
                  <span>Nenhuma fonte consultada para esta mensagem.</span>
                </div>
              ) : (
                sources.map((source, idx) => {
                  const domain = source.domain || extractDomain(source.url);
                  const isHighlighted = Boolean(activeSourceUrl && source.url === activeSourceUrl);
                  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                  return (
                    <div
                      key={source.id || idx}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3.5 group relative ${
                        isHighlighted 
                          ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40' 
                          : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800/80 hover:border-emerald-500/40 shadow-xs'
                      }`}
                    >
                      {/* Left: Favicon / Logo Image + Title & Domain */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800/90 border border-neutral-700/60 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                          <img
                            src={faviconUrl}
                            alt=""
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-emerald-400/90 font-mono truncate mb-0.5">
                            {domain}
                          </div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors leading-snug line-clamp-2 hover:underline decoration-emerald-400/40 block"
                            title={source.title}
                          >
                            {source.title || domain}
                          </a>
                        </div>
                      </div>

                      {/* Right: Direct Access Button */}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-2 rounded-xl bg-neutral-800/90 hover:bg-emerald-600 text-neutral-200 hover:text-white text-xs font-medium transition-all inline-flex items-center gap-1.5 shadow-xs group-hover:bg-emerald-600/90 cursor-pointer"
                        title="Acessar fonte original"
                      >
                        <span>Acessar</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
