import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, BarChart3, Clock, Sparkles } from 'lucide-react';

interface TabLoadingSkeletonProps {
  title?: string;
  subtitle?: string;
}

export default function TabLoadingSkeleton({
  title = "Processando métricas e estatísticas...",
  subtitle = "Sincronizando registros do sistema em tempo real..."
}: TabLoadingSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 animate-fadeIn py-2"
    >
      {/* Top Banner Indicator */}
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-emerald-500/20 backdrop-blur-md flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-200 font-mono flex items-center gap-1.5">
              <span>{title}</span>
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
            </h4>
            <p className="text-[11px] text-neutral-500">{subtitle}</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-emerald-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Calculando Tempo Real</span>
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={`sk-card-${i}`}
            className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-neutral-800/80 rounded-md animate-pulse" />
              <div className="w-7 h-7 rounded-lg bg-neutral-800/60 animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-neutral-800/90 rounded-lg animate-pulse" />
            <div className="h-2.5 w-32 bg-neutral-800/50 rounded animate-pulse" />

            {/* Shimmer overlay effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
        ))}
      </div>

      {/* Main Chart/Analytics Skeleton Area */}
      <div className="p-6 rounded-3xl bg-neutral-900/30 border border-neutral-800/80 space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-neutral-800/90 rounded-md animate-pulse" />
            <div className="h-3 w-72 bg-neutral-800/50 rounded-md animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-16 bg-neutral-800/60 rounded-xl animate-pulse" />
            <div className="h-7 w-16 bg-neutral-800/60 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Animated Bar/Line Skeleton Visualization */}
        <div className="h-56 w-full bg-neutral-950/60 rounded-2xl border border-neutral-900 p-4 flex items-end justify-between gap-3 relative overflow-hidden">
          {[40, 65, 30, 85, 50, 95, 70, 60, 45, 80, 55, 90].map((h, idx) => (
            <div key={`sk-bar-${idx}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                className="w-full bg-gradient-to-t from-emerald-500/10 via-emerald-500/20 to-emerald-500/30 rounded-t-lg animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${idx * 0.08}s` }}
              />
              <div className="h-2 w-full max-w-[20px] bg-neutral-800/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Lower Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={`sk-low-${i}`} className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 space-y-4">
            <div className="h-4 w-36 bg-neutral-800/90 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-neutral-800/50 rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-neutral-800/50 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-neutral-800/50 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
