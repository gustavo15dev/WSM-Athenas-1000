import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Music, Repeat, Plus, Trash2, Headphones, Sparkles, Check, Disc, Volume1, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  youtubeId: string;
  url: string;
}

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-default-1',
    title: 'Ruído Marrom',
    youtubeId: 'P618lZBDDac',
    url: 'https://youtu.be/P618lZBDDac?si=sbKfpc2GGxDTjrsh'
  },
  {
    id: 'track-default-2',
    title: 'Foco e Estudo',
    youtubeId: 'YEkfvd1AnJ8',
    url: 'https://youtu.be/YEkfvd1AnJ8?si=MxBmAKg3af2Cu34P'
  },
  {
    id: 'track-default-3',
    title: 'Relaxar',
    youtubeId: 'mIQKHDabxOU',
    url: 'https://youtu.be/mIQKHDabxOU?si=2FxpnKo6Q4Lnb39e'
  },
  {
    id: 'track-default-4',
    title: 'Chopin',
    youtubeId: 'BkJVuHj3qJQ',
    url: 'https://youtu.be/BkJVuHj3qJQ?si=hYfn_Rjo1ZCZyOgs'
  },
  {
    id: 'track-default-5',
    title: 'Mozart',
    youtubeId: 'URQUrkEhluM',
    url: 'https://youtu.be/URQUrkEhluM?si=dHFg_yG2U0T46U7v'
  }
];

interface StudyMusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function StudyMusicPlayer({ isOpen, onClose }: StudyMusicPlayerProps) {
  const [hasActivated, setHasActivated] = useState<boolean>(false);
  const [tracks, setTracks] = useState<Track[]>(() => {
    const saved = localStorage.getItem('athenas_study_music_tracks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Force replace if the first track is from the old list
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].youtubeId === 'XTBtwgHq9fw') {
           return DEFAULT_TRACKS;
        }
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
      } catch (e) {
        console.warn('Error parsing saved music tracks:', e);
      }
    }
    return DEFAULT_TRACKS;
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [loopCurrent, setLoopCurrent] = useState<boolean>(true);

  // Activate player only when opened
  useEffect(() => {
    if (isOpen) {
      setHasActivated(true);
    }
  }, [isOpen]);

  // New track form state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');
  const [addError, setAddError] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState<boolean>(false);

  const activeTrack = tracks[currentTrackIndex] || tracks[0] || DEFAULT_TRACKS[0];

  // Reset/sync tracks if localStorage has old single track format or old list
  useEffect(() => {
    if (tracks.length < 4 || tracks.some(t => t.youtubeId === 'XTBtwgHq9fw' || t.youtubeId === 'D0KMxRMfwxE')) {
      setTracks(DEFAULT_TRACKS);
    }
  }, []);

  // Persist tracks
  useEffect(() => {
    localStorage.setItem('athenas_study_music_tracks', JSON.stringify(tracks));
  }, [tracks]);

  // Broadcast mini-player active state for responsive layout adjustment (e.g. chat input spacing)
  useEffect(() => {
    const isMiniPlayerActive = !isOpen && isPlaying;
    if (typeof window !== 'undefined') {
      (window as any).__athenas_music_mini_player_active = isMiniPlayerActive;
      window.dispatchEvent(new CustomEvent('study-music-mini-player-active', { 
        detail: { active: isMiniPlayerActive } 
      }));
      document.body.classList.toggle('study-music-mini-player-active', isMiniPlayerActive);
    }
  }, [isOpen, isPlaying]);

  // Track sidebar music slot for embedding the mini-player in sidebar
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const updateSlot = () => {
      const el = document.getElementById('sidebar-music-slot');
      setSidebarSlot(el);
      if (el) {
        const aside = el.closest('aside#dashboard-sidebar');
        const isCollapsed = el.getAttribute('data-collapsed') === 'true' || (aside && aside.getAttribute('data-collapsed') === 'true');
        setIsSidebarCollapsed(Boolean(isCollapsed));
      }
    };

    updateSlot();
    const interval = setInterval(updateSlot, 600);
    return () => clearInterval(interval);
  }, []);

  // Load YouTube IFrame API script ONLY when activated
  useEffect(() => {
    if (!hasActivated) return;
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [hasActivated]);

  // Provide a latest state ref to avoid stale closures in YouTube callbacks
  const handleNextTrackRef = useRef(() => {});

  useEffect(() => {
    handleNextTrackRef.current = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    };
  }, [tracks.length]);

  const latestState = useRef({ loopCurrent, handleNextTrack: () => handleNextTrackRef.current() });
  useEffect(() => {
    latestState.current = { loopCurrent, handleNextTrack: () => handleNextTrackRef.current() };
  }, [loopCurrent]);

  // Initialize or re-init YT player
  useEffect(() => {
    if (!hasActivated || !activeTrack) return;

    let isMounted = true;

    const initPlayer = () => {
      if (window.YT && window.YT.Player && iframeRef.current && !playerRef.current) {
        try {
          playerRef.current = new window.YT.Player(iframeRef.current, {
            width: '0',
            height: '0',
            videoId: activeTrack.youtubeId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              modestbranding: 1,
              iv_load_policy: 3,
              playsinline: 1
            },
            events: {
              onReady: (event: any) => {
                if (!isMounted) return;
                setPlayerReady(true);
                event.target.setVolume(isMuted ? 0 : volume);
              },
              onStateChange: (event: any) => {
                if (!isMounted) return;
                // YT.PlayerState.ENDED === 0
                if (event.data === 0) {
                  if (latestState.current.loopCurrent) {
                    // Loop same song automatically
                    event.target.seekTo(0);
                    event.target.playVideo();
                  } else {
                    // Play next track
                    latestState.current.handleNextTrack();
                  }
                } else if (event.data === 1) { // PLAYING
                  setIsPlaying(true);
                } else if (event.data === 2) { // PAUSED
                  setIsPlaying(false);
                }
              }
            }
          });
        } catch (err) {
          console.warn('Error setting up YT player:', err);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
      // Fallback polling
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initPlayer();
        }
      }, 500);
      return () => clearInterval(interval);
    }

    return () => {
      isMounted = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        setPlayerReady(false);
      }
    };
  }, [hasActivated]);

  // Watch for track change and load new video without recreating player
  useEffect(() => {
    if (playerReady && playerRef.current) {
      if (isPlaying && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(activeTrack.youtubeId);
        playerRef.current.playVideo();
      } else if (typeof playerRef.current.cueVideoById === 'function') {
        playerRef.current.cueVideoById(activeTrack.youtubeId);
      }
    }
  }, [activeTrack.youtubeId, playerReady]);

  // Stop completely and cleanup
  const handleStopAndClose = () => {
    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try {
        playerRef.current.stopVideo();
      } catch (e) {
        console.warn('Error stopping video:', e);
      }
    }
    setIsPlaying(false);
    setHasActivated(false);
    onClose();
  };

  // If the user closed the modal and music is not playing, cleanup completely
  useEffect(() => {
    if (!isOpen && !isPlaying && hasActivated) {
      setHasActivated(false);
    }
  }, [isOpen, isPlaying, hasActivated]);

  if (!hasActivated && !isOpen) {
    return null;
  }

  // Handle Play/Pause
  const togglePlay = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Handle Volume Change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) setIsMuted(false);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(isMuted ? 0 : newVol);
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(nextMute ? 0 : volume);
    }
  };

  const handleNextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  };

  const handlePrevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newUrl.trim()) {
      setAddError('Por favor insira o link do vídeo do YouTube.');
      return;
    }

    const ytId = extractYoutubeId(newUrl.trim());
    if (!ytId) {
      setAddError('Link do YouTube inválido. Exemplo: https://youtu.be/XTBtwgHq9fw');
      return;
    }

    const title = newTitle.trim() || `Música do YouTube (${ytId})`;
    const newTrackObj: Track = {
      id: `track-${Date.now()}`,
      title,
      artist: 'YouTube Audio',
      youtubeId: ytId,
      url: newUrl.trim()
    };

    setTracks(prev => [...prev, newTrackObj]);
    setCurrentTrackIndex(tracks.length); // Switch to added track
    setNewTitle('');
    setNewUrl('');
    setShowAddModal(false);
  };

  const handleDeleteTrack = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tracks.length <= 1) {
      alert('Você precisa manter pelo menos uma música na playlist.');
      return;
    }

    const newTracks = tracks.filter(t => t.id !== idToDelete);
    setTracks(newTracks);
    if (currentTrackIndex >= newTracks.length) {
      setCurrentTrackIndex(0);
    }
  };

  // Instead of returning null and destroying the player, we just hide the UI
  // The iframe must ALWAYS stay in the DOM to keep the music playing in the background.

  return (
    <>
      {/* HIDDEN YOUTUBE IFRAME - AUDIO ONLY (MOUNTED ONLY WHEN ACTIVATED) */}
      <div 
        id="athenas-youtube-audio-container"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '0px',
          height: '0px',
          maxWidth: '0px',
          maxHeight: '0px',
          padding: 0,
          margin: 0,
          border: 'none',
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          zIndex: -9999,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(100%)'
        }}
        aria-hidden="true"
        tabIndex={-1}
      >
        <iframe
          ref={iframeRef}
          id="athenas-youtube-audio-player"
          width="0"
          height="0"
          style={{
            width: '0px',
            height: '0px',
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            opacity: 0,
            pointerEvents: 'none',
            border: 'none'
          }}
          src={`https://www.youtube.com/embed/${activeTrack.youtubeId}?enablejsapi=1&autoplay=0&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&loop=1&playlist=${activeTrack.youtubeId}&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
          title="Athenas YouTube Audio Player"
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {/* SIDEBAR EMBEDDED MINI-PLAYER OR MOBILE PILL */}
      {!isOpen && isPlaying && (
        sidebarSlot ? (
          createPortal(
            !isSidebarCollapsed ? (
              <div 
                id="study-music-mini-player"
                className="w-full bg-gradient-to-r from-neutral-900/95 via-emerald-950/25 to-neutral-900/95 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl p-2.5 shadow-lg shadow-emerald-950/20 backdrop-blur-md flex items-center justify-between gap-2 text-white animate-fadeIn transition-all group"
              >
                <div 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  title="Clique para abrir reprodutor completo de música"
                >
                  <div 
                    className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 animate-spin group-hover:scale-105 transition-transform" 
                    style={{ animationDuration: '6s' }}
                  >
                    <Disc className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-neutral-100 truncate group-hover:text-emerald-300 transition-colors leading-tight">
                      {activeTrack.title}
                    </p>
                    <p className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                      <span className="truncate">Música em 2º plano</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    type="button"
                    onClick={togglePlay} 
                    className="p-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-lg cursor-pointer transition-colors border border-neutral-750"
                    title={isPlaying ? "Pausar áudio" : "Continuar áudio"}
                  >
                    {isPlaying ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))} 
                    className="p-1.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-emerald-300 rounded-lg cursor-pointer transition-colors border border-neutral-750" 
                    title="Abrir reprodutor completo"
                  >
                    <Headphones className="w-3 h-3" />
                  </button>
                  <button 
                    type="button"
                    onClick={handleStopAndClose} 
                    className="p-1.5 hover:bg-neutral-850 text-neutral-400 hover:text-red-400 rounded-lg cursor-pointer transition-colors" 
                    title="Desligar e fechar música"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div 
                id="study-music-mini-player"
                className="w-full bg-gradient-to-b from-neutral-900/95 to-neutral-950/95 border border-emerald-500/30 rounded-2xl p-2 shadow-lg flex flex-col items-center gap-1.5 text-white animate-fadeIn"
              >
                <button 
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))}
                  className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer animate-spin" 
                  style={{ animationDuration: '6s' }}
                  title={`Música: ${activeTrack.title}`}
                >
                  <Disc className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={togglePlay} 
                    className="p-1 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 rounded-lg cursor-pointer border border-neutral-750"
                    title={isPlaying ? "Pausar áudio" : "Tocar áudio"}
                  >
                    {isPlaying ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                  </button>
                  <button 
                    type="button"
                    onClick={handleStopAndClose} 
                    className="p-1 hover:bg-neutral-850 text-neutral-400 hover:text-red-400 rounded-lg cursor-pointer" 
                    title="Fechar música"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ),
            sidebarSlot
          )
        ) : (
          /* Fallback for mobile view when sidebar is hidden */
          <div 
            id="study-music-mini-player"
            className="fixed bottom-16 right-3 md:hidden z-40 bg-neutral-950/95 border border-emerald-500/30 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-white animate-fadeIn pointer-events-auto"
          >
            <div 
              onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))}
              className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-spin cursor-pointer" 
              style={{ animationDuration: '6s' }}
            >
              <Disc className="w-3.5 h-3.5" />
            </div>
            <div 
              className="max-w-[120px] truncate cursor-pointer"
              onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))}
            >
              <p className="text-[11px] font-bold text-neutral-100 truncate">{activeTrack.title}</p>
              <p className="text-[9px] text-emerald-400 font-mono">2º plano</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={togglePlay} 
                className="p-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg cursor-pointer"
                title="Pausar áudio"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button 
                type="button"
                onClick={handleStopAndClose} 
                className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-red-400 rounded-lg cursor-pointer" 
                title="Fechar"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#070908] text-white flex flex-col font-sans overflow-hidden"
          >
            {/* Ambient Glowing Background */}
            <div className="absolute inset-0 bg-radial from-emerald-950/30 via-transparent to-transparent pointer-events-none animate-pulse" />
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* TOP HEADER */}
        <div className="px-6 py-4 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <Headphones className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-neutral-100 font-display flex items-center gap-2">
                Trilha Sonora para Estudos
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  Apenas Áudio
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Selecione uma música da lista para tocar em loop automático de foco
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Música por Link</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Sair da Rádio</span>
              <X className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* CURRENTLY PLAYING CONTROLS BANNER */}
        <div className="bg-neutral-950/80 border-b border-neutral-900 px-6 py-3.5 backdrop-blur-md z-10 shrink-0 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Spinning Disc Visual */}
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-neutral-950 font-black shrink-0 shadow-lg ${
              isPlaying ? 'animate-spin' : ''
            }`} style={{ animationDuration: '6s' }}>
              <Disc className="w-5 h-5 text-neutral-950" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  {isPlaying ? 'Tocando Agora' : 'Pausado'}
                </span>
                {loopCurrent && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                    Loop Ativo
                  </span>
                )}
              </div>
              <h3 className="text-sm font-black text-neutral-100 truncate font-display">
                {activeTrack.title}
              </h3>
            </div>
          </div>

          {/* Quick Play Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevTrack}
                className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-emerald-400 rounded-xl transition-all cursor-pointer"
                title="Anterior"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-emerald-400 hover:bg-emerald-300 text-neutral-950 rounded-xl font-black transition-all transform hover:scale-105 active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Tocar'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-neutral-950" />
                ) : (
                  <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
                )}
              </button>

              <button
                onClick={handleNextTrack}
                className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-emerald-400 rounded-xl transition-all cursor-pointer"
                title="Próxima"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLoopCurrent(!loopCurrent)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  loopCurrent
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                }`}
                title={loopCurrent ? 'Looping Automático Ativo' : 'Ativar Repetição'}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl">
              <button
                onClick={toggleMute}
                className="text-neutral-400 hover:text-emerald-400 cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 accent-emerald-400 bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* MAIN BODY AREA: MUSIC LIST (PRIMARY VIEW) */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-4 z-10 scrollbar-thin scrollbar-thumb-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-100 font-display flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                Lista de Músicas & Trilhas Sonoras ({tracks.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Clique em qualquer música para começar a ouvir em segundo plano
              </p>
            </div>

            <button
              onClick={() => {
                setTracks(DEFAULT_TRACKS);
                setCurrentTrackIndex(0);
                setIsPlaying(true);
              }}
              className="text-[11px] font-mono text-neutral-500 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
              title="Restaurar músicas padrão"
            >
              <RefreshCw className="w-3 h-3" />
              Restaurar Lista Padrão
            </button>
          </div>

          {/* MUSIC LIST - ONE BELOW THE OTHER */}
          <div className="space-y-2.5">
            {tracks.map((track, idx) => {
              const isSelected = idx === currentTrackIndex;
              return (
                <div
                  key={track.id}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlaying(true);
                  }}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer group ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/40 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                      : 'bg-neutral-950/60 hover:bg-neutral-900/60 border-neutral-900 hover:border-neutral-800'
                  }`}
                >
                  {/* Left Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold transition-transform group-hover:scale-105 ${
                      isSelected 
                        ? 'bg-emerald-400 text-neutral-950 shadow-md shadow-emerald-500/20' 
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}>
                      {isSelected && isPlaying ? (
                        <Music className="w-5 h-5 animate-pulse" />
                      ) : (
                        <span className="text-xs font-mono font-black">{idx + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-bold truncate ${
                          isSelected ? 'text-emerald-300 font-black' : 'text-neutral-100 group-hover:text-emerald-400'
                        }`}>
                          {track.title}
                        </h4>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold shrink-0">
                            {isPlaying ? 'Tocando Áudio' : 'Pausado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          togglePlay();
                        } else {
                          setCurrentTrackIndex(idx);
                          setIsPlaying(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                        isSelected && isPlaying
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-neutral-900 hover:bg-emerald-500 hover:text-neutral-950 border border-neutral-800 text-neutral-200'
                      }`}
                    >
                      {isSelected && isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          <span>Ouvir Áudio</span>
                        </>
                      )}
                    </button>

                    {tracks.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteTrack(track.id, e)}
                        className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all cursor-pointer"
                        title="Remover música"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ADD MUSIC MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Adicionar Trilha do YouTube
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-neutral-500 hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddTrack} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-300 font-bold block">
                    Link do Vídeo do YouTube <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: https://youtu.be/MX-iaTDEyGI"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-xs text-neutral-200 p-3 rounded-xl outline-none"
                    required
                  />
                  <p className="text-[10px] text-neutral-500">
                    O áudio será tocado em segundo plano com repetição automática.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-300 font-bold block">
                    Título da Música (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Lofi Instrumental - Estudo de Química"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-xs text-neutral-200 p-3 rounded-xl outline-none"
                  />
                </div>

                {addError && (
                  <p className="text-xs text-red-400 font-mono bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl">
                    {addError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-emerald-500/10"
                  >
                    Salvar na Playlist
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
