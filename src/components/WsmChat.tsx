import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Sparkles, Bot, User, Trash2, HelpCircle, Loader2, 
  History, Plus, MessageSquare, Mic, ArrowUp, X, MicOff, 
  Paperclip, PanelLeftClose, PanelLeft, Search, Pin, Copy, Check, Headphones 
} from 'lucide-react';
import { supabase } from '../supabase';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: any[]) => Promise<void>;
      typeset?: (elements?: any[]) => void;
      typesetClear?: (elements?: any[]) => void;
    };
  }
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Array<{ name: string; type: string; data: string; size: number }>;
}

interface ChatSession {
  id: string;
  user_email: string;
  title: string;
  created_at: string;
  is_pinned?: boolean; // dynamic support
}

// Interactive Copy Button for code snippets or message blocks
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy text", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-emerald-500/30 text-neutral-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
      title="Copiar resposta"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const sanitizeAndNormalizeContent = (text: string) => {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/áôÁêâôÁê/g, '')
    .replace(/[\uFFFD]/g, '');
};

const ChatMessageItem = React.memo(({ msg }: { msg: ChatMessage }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`py-6 px-4 md:px-6 w-full ${
        msg.role === 'assistant' 
          ? 'bg-neutral-950/20 border-y border-neutral-950/10' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-3xl mx-auto flex items-start gap-4 md:gap-6">
        {/* Avatar badge */}
        {msg.role === 'assistant' ? (
          <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center overflow-hidden shadow-inner shadow-emerald-500/10">
            <img
              src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
              alt="Athenas"
              referrerPolicy="no-referrer"
              className="w-12 h-12 max-w-none object-contain select-none scale-110"
            />
          </div>
        ) : (
          <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 md:w-4.5 md:h-4.5 text-emerald-400/80" />
          </div>
        )}

        {/* Message Bubble/Text */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500 font-mono">
              {msg.role === 'assistant' ? 'WSM Athenas' : 'Você'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-600 font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <CopyButton text={sanitizeAndNormalizeContent(msg.content)} />
            </div>
          </div>

          <div className="text-neutral-200 text-[13.5px] md:text-sm leading-relaxed antialiased select-text">
            {msg.role === 'assistant' ? (
              <div className="markdown-body text-neutral-300">
                <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {sanitizeAndNormalizeContent(msg.content)}
                </Markdown>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const cleaned = (msg.content || '')
                    .replace(/\n\n---\n\*Arquivos Enviados:\*[\s\S]*/gi, '')
                    .replace(/\*Arquivos Enviados:\*[\s\S]*/gi, '')
                    .trim();
                  const displayText = cleaned === "Análise de arquivos anexados." ? "" : cleaned;
                  return displayText ? <p className="whitespace-pre-wrap text-neutral-200">{displayText}</p> : null;
                })()}
                
                {/* File attachment preview inside message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-2.5 border-t border-neutral-900">
                    {msg.attachments.map((file, fIdx) => {
                      const isImg = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                      if (isImg) {
                        return (
                          <div 
                            key={fIdx} 
                            className="overflow-hidden rounded-xl border border-neutral-850 shadow-lg bg-neutral-950/60 max-w-[280px] cursor-zoom-in group relative"
                            onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: file.data }))}
                            title="Ver em tela cheia"
                          >
                            <img 
                              src={file.data} 
                              alt={file.name} 
                              className="w-full max-h-[220px] object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded">Ver Tela Cheia 🔍</span>
                            </div>
                          </div>
                        );
                      } else {
                        const parts = file.name.split('.');
                        const ext = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'DOC';
                        return (
                          <div key={fIdx} className="w-[120px] h-[100px] flex flex-col justify-between bg-neutral-900/60 border border-neutral-850 p-2.5 rounded-xl shadow-md transition-all select-none">
                            <span className="text-[10px] text-neutral-300 font-semibold line-clamp-2 leading-tight break-all" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center justify-between pt-1 border-t border-neutral-800/40">
                              <span className="text-[8px] font-extrabold px-1 py-0.5 rounded border border-neutral-800 text-neutral-400 bg-neutral-950 uppercase">
                                {ext}
                              </span>
                              <span className="text-neutral-500 text-[8px] font-mono">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem';

// Helper to format file sizes accurately
const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface WsmChatProps {
  userEmail: string;
  userRole: 'student' | 'teacher';
  studyExamTheme?: string;
  studyExamContent?: string;
  onClearStudyTheme?: () => void;
}

export default function WsmChat({ 
  userEmail, 
  userRole, 
  studyExamTheme, 
  studyExamContent, 
  onClearStudyTheme 
}: WsmChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sidebar Layout controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionSearch, setSessionSearch] = useState('');
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([]);

  // States & Refs for Custom Form & Voice / Attachments support
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; data: string; size: number }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const activeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic layout compensation when the music mini-player is active in background
  const [isMusicMiniPlayerActive, setIsMusicMiniPlayerActive] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean((window as any).__athenas_music_mini_player_active);
  });

  useEffect(() => {
    const handleMusicChange = (e: any) => {
      setIsMusicMiniPlayerActive(Boolean(e.detail?.active));
    };
    window.addEventListener('study-music-mini-player-active', handleMusicChange);

    // Periodic synchronization check to ensure prompt is never covered
    const syncInterval = setInterval(() => {
      const active = typeof window !== 'undefined' && Boolean((window as any).__athenas_music_mini_player_active);
      setIsMusicMiniPlayerActive(prev => prev !== active ? active : prev);
    }, 300);

    return () => {
      window.removeEventListener('study-music-mini-player-active', handleMusicChange);
      clearInterval(syncInterval);
    };
  }, []);

  // Initialize Web Speech and Responsive width adjustments
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'pt-BR';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputText(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
      };

      recognitionRef.current = rec;
    }

    // Auto collapse sidebar on smaller screens initially
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }

    return () => {
      if (activeIntervalRef.current) clearInterval(activeIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Auto-expand input bar textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  // Audio Recording helpers
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64Data = reader.result as string;
          const fileName = `Audio_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`;
          
          setAttachedFiles(prev => {
            if (prev.length >= 5) {
              alert("Você já atingiu o limite de 5 arquivos.");
              return prev;
            }
            return [
              ...prev,
              {
                name: fileName,
                type: 'audio/webm',
                data: b64Data,
                size: audioBlob.size
              }
            ];
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("Speech recognition start warning:", e);
        }
      }
    } catch (err) {
      console.error("Microphone access err:", err);
      alert("Não foi possível acessar o microfone. Conceda as permissões de gravação.");
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech recognition stop error:", e);
      }
    }
  };

  const cancelRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Safe catch
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAudio();
    } else {
      startRecordingAudio();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesList = Array.from(e.target.files);
    
    if (attachedFiles.length + filesList.length > 5) {
      alert("Você pode anexar no máximo 5 arquivos por mensagem.");
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    filesList.forEach((file) => {
      if (file.size > MAX_SIZE) {
        alert(`O arquivo "${file.name}" excede o limite máximo de 10MB.`);
        return;
      }

      const isText = file.type.startsWith("text/") || 
        file.type.includes("json") || 
        file.type.includes("javascript") || 
        file.type.includes("csv") || 
        /\.(txt|csv|tsv|json|md|log|xml|html|css|js|ts|py|sql)$/i.test(file.name);

      const reader = new FileReader();
      reader.onloadend = () => {
        const b64Data = reader.result as string;

        if (isText) {
          const textReader = new FileReader();
          textReader.onloadend = () => {
            const rawText = textReader.result as string;
            setAttachedFiles(prev => {
              if (prev.length >= 5) return prev;
              return [
                ...prev,
                {
                  name: file.name,
                  type: file.type || 'text/plain',
                  data: b64Data,
                  size: file.size,
                  textContent: rawText
                }
              ];
            });
          };
          textReader.readAsText(file);
        } else {
          setAttachedFiles(prev => {
            if (prev.length >= 5) return prev;
            return [
              ...prev,
              {
                name: file.name,
                type: file.type || 'application/octet-stream',
                data: b64Data,
                size: file.size
              }
            ];
          });
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeAttachedFile = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Load conversation messages from selected session
  const loadSessionMessages = async (sessionId: string) => {
    setIsLoading(true);
    setErrorMessage('');
    if (activeIntervalRef.current) {
      clearInterval(activeIntervalRef.current);
      activeIntervalRef.current = null;
    }
    setIsTyping(false);
    
    try {
      const { data, error } = await supabase
        .from('wsm_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted: ChatMessage[] = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        attachments: msg.attachments || []
      }));

      setMessages(formatted);
      setCurrentSessionId(sessionId);
    } catch (err: any) {
      console.error("Error loading messages:", err);
      setErrorMessage("Erro ao carregar o histórico de mensagens.");
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    if (activeIntervalRef.current) {
      clearInterval(activeIntervalRef.current);
      activeIntervalRef.current = null;
    }
    setMessages([]);
    setCurrentSessionId(null);
    setErrorMessage('');
    setIsLoading(false);
    setIsTyping(false);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente apagar esta conversa permanentemente?")) {
      try {
        const { error } = await supabase
          .from('wsm_chat_sessions')
          .delete()
          .eq('id', sessionId);

        if (error) throw error;

        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          startNewSession();
        }
      } catch (err) {
        console.error("Error deleting session:", err);
      }
    }
  };

  // Pin / Unpin a session visually
  const togglePinSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessionIds(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId) 
        : [sessionId, ...prev]
    );
  };

  // Load sessions from Supabase on start
  useEffect(() => {
    const initSessions = async () => {
      if (userEmail) {
        setIsLoadingSessions(true);
        try {
          const { data, error } = await supabase
            .from('wsm_chat_sessions')
            .select('*')
            .eq('user_email', userEmail)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setSessions(data || []);
          setMessages([]);
          setCurrentSessionId(null);
        } catch (err) {
          console.error("Error initializing sessions:", err);
        } finally {
          setIsLoadingSessions(false);
        }
      }
    };
    initSessions();
  }, [userEmail]);

  useEffect(() => {
    startNewSession();
  }, [studyExamTheme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, isTyping]);

  useEffect(() => {
    let isMounted = true;
    const cleanAssistiveMml = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.querySelectorAll('mjx-assistive-mml').forEach((el) => el.remove());
      }
    };

    const triggerMathJax = () => {
      if (!isMounted) return;
      cleanAssistiveMml();
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        const target = chatContainerRef.current ? [chatContainerRef.current] : undefined;
        try {
          if (typeof window.MathJax.typesetClear === 'function' && target) {
            window.MathJax.typesetClear(target);
          }
          window.MathJax.typesetPromise(target)
            .then(() => {
              if (isMounted) cleanAssistiveMml();
            })
            .catch((err: any) => {
              console.warn("MathJax formatting error:", err);
            });
        } catch (e) {
          console.warn("MathJax execution error:", e);
        }
      }
    };

    triggerMathJax();
    const timeoutId = setTimeout(triggerMathJax, 150);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend || inputText;
    if ((!rawText.trim() && attachedFiles.length === 0) || isLoading || isTyping) return;

    if (activeIntervalRef.current) {
      clearInterval(activeIntervalRef.current);
      activeIntervalRef.current = null;
    }

    const currentFiles = [...attachedFiles];

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: rawText,
      timestamp: new Date(),
      attachments: currentFiles
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachedFiles([]);
    setIsLoading(true);
    setErrorMessage('');

    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        let title = studyExamTheme ? `Estudos: ${studyExamTheme}` : rawText.trim();
        if (!studyExamTheme && !title && currentFiles.length > 0) {
          title = `Anexos: ${currentFiles.map(f => f.name).join(', ')}`;
        }
        if (title.length > 25) {
          title = title.substring(0, 25) + "...";
        }
        const { data: newSess, error: sessErr } = await supabase
          .from('wsm_chat_sessions')
          .insert([{ user_email: userEmail, title }])
          .select()
          .single();

        if (sessErr) throw sessErr;

        if (newSess) {
          sessionId = newSess.id;
          setCurrentSessionId(sessionId);
          setSessions(prev => [newSess, ...prev]);
        }
      }

      const contentToSave = rawText;

      if (sessionId) {
        await supabase.from('wsm_chat_messages').insert([{
          session_id: sessionId,
          role: 'user',
          content: contentToSave,
          attachments: currentFiles
        }]);
      }

      const conversationalHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        text: msg.content,
        attachments: msg.attachments
      }));

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: rawText || "Análise de arquivos anexados.",
          history: conversationalHistory,
          attachments: currentFiles,
          studyExamTheme,
          studyExamContent,
          userRole
        })
      });

      if (!res.ok) {
        let errorMsg = "Não foi possível obter resposta do Athenas.";
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const fullText = data.text || "Sem resposta no momento.";
      
      if (sessionId) {
        await supabase.from('wsm_chat_messages').insert([{
          session_id: sessionId,
          role: 'assistant',
          content: fullText
        }]);
      }

      setIsLoading(false);
      setIsTyping(false);

      const botResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: fullText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botResponse]);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erro ao conectar com o Athenas AI.");
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const clearChat = async () => {
    if (confirm("Excluir todas as mensagens deste chat atual?")) {
      if (activeIntervalRef.current) {
        clearInterval(activeIntervalRef.current);
        activeIntervalRef.current = null;
      }
      
      if (currentSessionId) {
        try {
          const { error } = await supabase
            .from('wsm_chat_messages')
            .delete()
            .eq('session_id', currentSessionId);

          if (error) throw error;
        } catch (err) {
          console.error("Error clearing session messages:", err);
        }
      }
      
      setMessages([]);
      setErrorMessage('');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const promptChips = userRole === 'teacher' 
    ? [
        { label: "Elaborar Simulado", text: "Elabore um simulado com 3 questões sobre princípios SOLID em Engenharia de Software." },
        { label: "Feedback Construtivo", text: "Como posso fornecer um feedback pedagógico e construtivo de alto nível sobre a entrega de um trabalho prático?" },
        { label: "Sugestões de Atividades", text: "Me dê ideias de projetos e atividades práticas inovadoras para os alunos desenvolverem em equipe." }
      ]
    : [
        { label: "🌿 Fórmula da Fotossíntese", text: "Qual a equação química e biológica da fotossíntese com reagentes, produtos e catalisadores em notação científica limpa?" },
        { label: "Princípios de Software", text: "Explique de forma visual o princípio Open/Closed (OCP) do SOLID com exemplos práticos." },
        { label: "Dicas de Estudo", text: "Estou me preparando para a prova de Engenharia de Software. Como posso organizar meus estudos de forma eficiente?" },
        { label: "Microsserviços", text: "Qual a diferença real e vantagens entre uma arquitetura Monolítica e uma em Microsserviços?" }
      ];

  // Filters sessions based on search
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter(s => pinnedSessionIds.includes(s.id));
  const recentSessions = filteredSessions.filter(s => !pinnedSessionIds.includes(s.id));

  return (
    <div className="flex flex-1 min-h-0 h-full w-full bg-neutral-950 border border-neutral-900 rounded-3xl overflow-hidden backdrop-blur-md relative font-sans text-neutral-200">
      
      {/* 1. COLLAPSIBLE LEFT SIDEBAR */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="h-full bg-neutral-950/95 border-r border-neutral-900 flex flex-col justify-between shrink-0 overflow-hidden relative z-30"
          >
            {/* Sidebar Top Header & New Chat button */}
            <div className="p-3.5 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 tracking-widest font-mono uppercase flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  Athenas AI
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  title="Fechar painel lateral"
                  className="p-1.5 hover:bg-neutral-900 text-neutral-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={startNewSession}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/5 select-none cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Novo Chat
                </span>
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              </button>

              {/* Session Search bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-neutral-900/60 border border-neutral-900 focus:border-neutral-800 text-[11px] text-neutral-300 placeholder-neutral-600 pl-8 pr-3 py-2 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Scrollable list of chats */}
            <div className="flex-1 overflow-y-auto px-2 space-y-4 scrollbar-thin scrollbar-thumb-neutral-900">
              
              {/* Pinned Section */}
              {pinnedSessions.length > 0 && (
                <div className="space-y-1">
                  <span className="px-2 text-[9px] font-bold text-neutral-600 tracking-wider uppercase font-mono">Fixadas</span>
                  {pinnedSessions.map(sess => (
                    <div
                      key={sess.id}
                      onClick={() => loadSessionMessages(sess.id)}
                      className={`group relative p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        currentSessionId === sess.id
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                          : 'bg-transparent border-transparent hover:bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500/40 group-hover:text-emerald-400 shrink-0" />
                        <span className="text-xs truncate font-medium">{sess.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => togglePinSession(sess.id, e)}
                          className="p-1 hover:text-emerald-400 text-neutral-500"
                          title="Desafixar conversa"
                        >
                          <Pin className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                        </button>
                        <button
                          onClick={(e) => deleteSession(sess.id, e)}
                          className="p-1 hover:text-red-400 text-neutral-500"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recents Section */}
              <div className="space-y-1">
                <span className="px-2 text-[9px] font-bold text-neutral-600 tracking-wider uppercase font-mono">Recentes</span>
                {isLoadingSessions ? (
                  <div className="flex flex-col items-center justify-center py-8 text-neutral-600 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400/80" />
                    <span className="text-[10px] font-mono">Buscando...</span>
                  </div>
                ) : recentSessions.length === 0 ? (
                  <div className="text-center py-8 text-neutral-600 text-[11px] px-3">
                    Nenhum chat salvo.
                  </div>
                ) : (
                  recentSessions.map(sess => (
                    <div
                      key={sess.id}
                      onClick={() => loadSessionMessages(sess.id)}
                      className={`group relative p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        currentSessionId === sess.id
                          ? 'bg-emerald-950/25 border-emerald-500/20 text-emerald-400'
                          : 'bg-transparent border-transparent hover:bg-neutral-900/40 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-700 group-hover:text-emerald-500/50 shrink-0" />
                        <span className="text-xs truncate font-medium">{sess.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => togglePinSession(sess.id, e)}
                          className="p-1 hover:text-emerald-400 text-neutral-500"
                          title="Fixar conversa"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => deleteSession(sess.id, e)}
                          className="p-1 hover:text-red-400 text-neutral-500"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sidebar Bottom Footer Profile details */}
            <div className="p-3 bg-neutral-900/35 border-t border-neutral-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400 font-bold text-xs select-none">
                  {userEmail?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-neutral-200 truncate">{userEmail}</p>
                  <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                    {userRole === 'teacher' ? 'PROFESSOR' : 'ESTUDANTE'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full bg-[#090b0a] overflow-hidden relative">
        
        {/* Chat top header navbar */}
        <div className="px-4 md:px-6 py-3 border-b border-neutral-900/80 bg-neutral-950 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Open sidebar button if closed */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Abrir painel lateral"
                className="p-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer mr-1"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <span className="text-sm font-extrabold text-neutral-100 font-display flex items-center gap-1.5">
                WSM Athenas AI
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">v3.5</span>
              </span>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-study-music-player'))}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold rounded-full text-xs transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 border border-emerald-300"
                title="Ouvir música para estudar"
              >
                <Headphones className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="truncate">Ouvir música para estudar</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentSessionId && (
              <button
                onClick={clearChat}
                title="Limpar mensagens deste chat"
                className="p-1.5 hover:bg-neutral-900 text-neutral-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Special Exam Study Banner */}
        {studyExamTheme && (
          <div className="bg-emerald-950/20 border-b border-emerald-900/30 px-6 py-2.5 flex items-center justify-between text-xs animate-fadeIn shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="font-extrabold text-emerald-300 text-[11px] uppercase tracking-wider font-mono">Modo de Estudos Ativo (Escopo Delimitado)</p>
                <p className="text-neutral-300 text-xs truncate">
                  Focado no tema: <strong className="text-white font-semibold">{studyExamTheme}</strong>
                </p>
                {studyExamContent && (
                  <p className="text-[11px] text-neutral-400 truncate max-w-xl">
                    <span className="text-neutral-500 font-medium">Conteúdo delimitado:</span> {studyExamContent}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClearStudyTheme}
              className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0"
            >
              Sair do modo estudos
            </button>
          </div>
        )}

        {/* Messages feed display */}
        <div 
          ref={chatContainerRef}
          className={`flex-1 ${messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto'} bg-transparent scrollbar-thin scrollbar-thumb-neutral-900`}
        >
          {messages.length === 0 ? (
            /* EMPTY STATE: Welcoming mascot screen */
            <div className="flex flex-col items-center justify-center h-full py-6 px-6 max-w-2xl mx-auto w-full text-center animate-fadeIn space-y-6 select-none overflow-hidden">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/10">
                  <img
                    src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                    alt="Athenas"
                    referrerPolicy="no-referrer"
                    className="w-28 h-28 max-w-none object-contain select-none scale-105"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-neutral-100 font-display">Como posso ajudar hoje?</h3>
                  <p className="text-neutral-400 text-xs mt-1 leading-relaxed max-w-sm mx-auto">
                    Sou o seu assistente inteligente acadêmico. Posso explicar matérias, corrigir exercícios, ou gerar simulados.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* MESSAGES LIST */
            <div className="divide-y divide-neutral-900/55 pb-12">
              {messages.map((msg) => (
                <ChatMessageItem key={msg.id} msg={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="py-6 px-4 md:px-6 w-full bg-neutral-950/10 border-y border-neutral-950/5">
                  <div className="max-w-3xl mx-auto flex items-start gap-4 md:gap-6">
                    <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center overflow-hidden">
                      <img
                        src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                        alt="Athenas"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 max-w-none object-contain select-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500 font-mono">WSM Athenas</span>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      </div>
                      <p className="text-xs text-neutral-500 italic animate-pulse">Pensando e consultando banco acadêmico...</p>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="py-4 px-4 max-w-2xl mx-auto">
                  <div className="p-3 bg-red-950/20 border border-red-500/25 text-red-400 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                    <HelpCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. INPUT PROMPT FORM AND ACTIONS */}
        <div 
          id="wsm-chat-input-container"
          className={`p-4 ${
            isMusicMiniPlayerActive ? 'pb-24 sm:pb-28' : 'pb-6'
          } bg-gradient-to-t from-neutral-950 to-transparent border-t border-neutral-900/60 flex flex-col items-center shrink-0 relative z-50 transition-all duration-300`}
        >
          
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Centered chat wrapper */}
          <div className="w-full max-w-3xl space-y-2 relative z-50">
            
            <div className={`bg-[#212121] border border-neutral-800 focus-within:border-neutral-700 rounded-[26px] p-1.5 pr-2 flex flex-col transition-all duration-300 shadow-xl overflow-hidden relative z-50`}>
              
              {/* Attached file tags */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-neutral-800 max-h-24 overflow-y-auto">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded-xl text-[10px] text-neutral-300 animate-fadeIn">
                      <Paperclip className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span className="truncate max-w-[140px] font-mono" title={file.name}>{file.name}</span>
                      <span className="text-[9px] text-neutral-500 font-mono">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(i)}
                        className="p-0.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Input Panel */}
              <div className="flex items-end gap-1.5 w-full relative z-50">
                
                {/* Plus Upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivos (max 5)"
                  disabled={isLoading || isTyping || attachedFiles.length >= 5}
                  className="w-9 h-9 mb-0.5 ml-0.5 text-neutral-400 hover:text-white rounded-full transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-30"
                >
                  <Plus className="w-6 h-6" />
                </button>

                {/* Input TextArea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Pergunte alguma coisa"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading || isTyping}
                  className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none outline-none text-xs md:text-[15px] text-neutral-200 placeholder-neutral-500 px-1 py-2.5 resize-none max-h-[200px] leading-relaxed overflow-y-auto select-text scrollbar-thin scrollbar-thumb-neutral-700"
                />

                {/* Send button */}
                <button
                  id="btn-wsm-chat-send"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || isTyping || (!inputText.trim() && attachedFiles.length === 0)}
                  title="Enviar pergunta"
                  className="relative z-50 w-8 h-8 mb-1 bg-white disabled:bg-[#333333] text-black disabled:text-neutral-500 rounded-full transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed hover:bg-neutral-200 duration-300 shadow-sm"
                >
                  <ArrowUp className="w-4.5 h-4.5 stroke-[3]" />
                </button>
              </div>
            </div>

            <p className="text-[10px] text-neutral-550 text-center select-none">
              O Athenas AI pode cometer erros de interpretação. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
