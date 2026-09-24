import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  BellOff, 
  BellRing, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle, 
  Send, 
  X,
  Volume2
} from 'lucide-react';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendBrowserNotification 
} from '../utils/browserNotifications';

interface BrowserNotificationPromptProps {
  userRole?: 'student' | 'teacher';
  compact?: boolean;
}

export default function BrowserNotificationPrompt({ 
  userRole = 'student',
  compact = false 
}: BrowserNotificationPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);
  const [testSent, setTestSent] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('wsm_dismissed_browser_push_banner') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      localStorage.setItem('wsm_dismissed_browser_push_banner', 'true');
    } catch (e) {
      console.error('Failed to save notification banner dismissal:', e);
    }
  };

  useEffect(() => {
    const supported = isNotificationSupported();
    setIsSupported(supported);
    if (supported) {
      setPermission(getNotificationPermission());
    }
  }, []);

  const handleEnable = async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      sendBrowserNotification('🔔 Notificações Ativadas com Sucesso!', {
        body: 'Você receberá pop-ups do navegador para novos avisos, simulados e mensagens da escola em tempo real.',
        tag: 'welcome-notif'
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  const handleTestNotification = async () => {
    const success = await sendBrowserNotification('🧪 Teste de Notificação Pop-up Athenas', {
      body: `Esta é uma notificação do navegador para ${userRole === 'student' ? 'alunos' : 'professores'}. O sistema está pronto para enviar avisos em tempo real!`,
      tag: `test-${Date.now()}`
    });
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  if (!isSupported) {
    return null;
  }

  // Compact Header Badge mode
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {permission === 'granted' ? (
          <button
            type="button"
            onClick={handleTestNotification}
            className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Clique para testar a notificação pop-up no seu navegador"
          >
            <BellRing className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Notificações Push Ativas</span>
            {testSent && <span className="text-emerald-300 font-extrabold ml-1">✓ Enviado!</span>}
          </button>
        ) : permission === 'denied' ? (
          <div className="px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono font-bold flex items-center gap-1">
            <BellOff className="w-3 h-3" />
            <span>Push Bloqueado</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEnable}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[10px] font-mono font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer animate-pulse"
          >
            <Bell className="w-3 h-3" />
            <span>Ativar Notificações Pop-up</span>
          </button>
        )}
      </div>
    );
  }

  // Full Banner Mode (for Dashboard)
  if (permission === 'granted' || isBannerDismissed) {
    return null; // Don't show large prompt banner if granted or dismissed
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-neutral-950 via-emerald-950/40 to-neutral-950 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)] relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-3.5 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold text-neutral-100 font-display">
                Ativar Notificações Push do Navegador
              </h4>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold rounded-full border border-amber-500/30">
                Pop-up
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
              Receba avisos instantâneos na sua tela para novos simulados, comunicados da coordenação e mensagens do professor — mesmo quando a aba do Athenas não estiver aberta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 relative z-10">
          <button
            type="button"
            onClick={handleEnable}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span>Permitir Notificações Pop-up</span>
          </button>

          <button
            type="button"
            onClick={handleDismissBanner}
            className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Fechar aviso de notificações"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
