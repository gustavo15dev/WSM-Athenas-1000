import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  Flame, 
  Sparkles, 
  Target, 
  CheckCircle2, 
  Lock, 
  Star, 
  ShieldCheck, 
  BookOpen, 
  Clock, 
  Zap, 
  Info, 
  Check, 
  X, 
  HelpCircle, 
  TrendingUp, 
  BrainCircuit, 
  FlaskConical, 
  MessageSquare, 
  Headphones, 
  Layers, 
  Calendar,
  Database,
  Trophy,
  Crown,
  Medal,
  Search,
  RefreshCw,
  Building2,
  MapPin,
  Users,
  Filter,
  UserCheck,
  ChevronRight,
  Download,
  Mail,
  FileCheck,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '../supabase';
import { 
  getWeeklyCycleInfo, 
  calculateStudentWeeklyXP, 
  computeSubmissionXP,
  getStudentCertificates, 
  saveWeeklyCycleWinners, 
  StudentCertificateItem, 
  WeeklyWinnerRecord 
} from '../utils/weeklyRanking';
import CertificateModal from './CertificateModal';

interface StudentAchievementsProps {
  userEmail: string;
  userName: string;
  userTurma?: string;
  studentSubmissions?: any[];
  mockExams?: any[];
  openTimeSeconds?: number;
  activeTimeSeconds?: number;
}

export interface BadgeItem {
  id: string;
  name: string;
  desc: string;
  rarity: 'Comum' | 'Rara' | 'Épica' | 'Lendária';
  category: 'simulados' | 'constancia' | 'ia' | 'cadernos' | 'disciplinas' | 'geral';
  xpReward: number;
  iconType: string;
  calcProgress: (data: any) => { current: number; max: number; isUnlocked: boolean };
}

export interface EvaluatedBadge extends BadgeItem {
  progCurrent: number;
  progMax: number;
  isUnlocked: boolean;
}

export interface PlatformStudentRank {
  id: string;
  email: string;
  name: string;
  turma: string;
  escola: string;
  cidade: string;
  totalXp: number; // Weekly XP in ranking view, Total XP in stats
  isCurrentUser: boolean;
  rank?: number;
}

// 37 Extensas Conquistas Estruturadas (Calculadas 100% com Dados Reais do Aluno)
const ALL_BADGES: BadgeItem[] = [
  {
    id: 'first_simulado',
    name: 'Primeiro Passo',
    desc: 'Conclua seu primeiro simulado online na plataforma.',
    rarity: 'Comum',
    category: 'simulados',
    xpReward: 50,
    iconType: 'check',
    calcProgress: (d) => {
      const c = d.submissionsCount || 0;
      return { current: Math.min(1, c), max: 1, isUnlocked: c >= 1 };
    }
  },
  {
    id: 'foco_estudante',
    name: 'Estudante Focado',
    desc: 'Conclua 5 simulados online.',
    rarity: 'Comum',
    category: 'simulados',
    xpReward: 100,
    iconType: 'target',
    calcProgress: (d) => {
      const c = d.submissionsCount || 0;
      return { current: Math.min(5, c), max: 5, isUnlocked: c >= 5 };
    }
  },
  {
    id: 'veterano_provas',
    name: 'Veterano de Provas',
    desc: 'Conclua 20 simulados online.',
    rarity: 'Rara',
    category: 'simulados',
    xpReward: 200,
    iconType: 'award',
    calcProgress: (d) => {
      const c = d.submissionsCount || 0;
      return { current: Math.min(20, c), max: 20, isUnlocked: c >= 20 };
    }
  },
  {
    id: 'lenda_simulados',
    name: 'Lenda dos Simulados',
    desc: 'Conclua 50 simulados online.',
    rarity: 'Lendária',
    category: 'simulados',
    xpReward: 500,
    iconType: 'star',
    calcProgress: (d) => {
      const c = d.submissionsCount || 0;
      return { current: Math.min(50, c), max: 50, isUnlocked: c >= 50 };
    }
  },
  {
    id: 'gabaritador',
    name: 'Gabaritador',
    desc: 'Obtenha nota máxima (10,0) em um simulado.',
    rarity: 'Épica',
    category: 'simulados',
    xpReward: 250,
    iconType: 'star',
    calcProgress: (d) => {
      const has10 = (d.submissions || []).some((s: any) => Number(s.score) >= 10);
      return { current: has10 ? 1 : 0, max: 1, isUnlocked: has10 };
    }
  },
  {
    id: 'nota_prata',
    name: 'Nota de Ouro',
    desc: 'Obtenha nota maior ou igual a 8,0 em um simulado.',
    rarity: 'Comum',
    category: 'simulados',
    xpReward: 75,
    iconType: 'check',
    calcProgress: (d) => {
      const has8 = (d.submissions || []).some((s: any) => Number(s.score) >= 8);
      return { current: has8 ? 1 : 0, max: 1, isUnlocked: has8 };
    }
  },
  {
    id: 'trinca_dizes',
    name: 'Trinca de Dizes',
    desc: 'Obtenha 3 notas 10,0 consecutivas em simulados.',
    rarity: 'Lendária',
    category: 'simulados',
    xpReward: 600,
    iconType: 'star',
    calcProgress: (d) => {
      let streak = 0;
      let maxStreak = 0;
      (d.submissions || []).forEach((s: any) => {
        if (Number(s.score) >= 10) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      });
      return { current: Math.min(3, maxStreak), max: 3, isUnlocked: maxStreak >= 3 };
    }
  },
  {
    id: 'esp_biologia',
    name: 'Especialista em Biologia',
    desc: 'Alcance 85% de taxa de acerto nos simulados de Biologia.',
    rarity: 'Rara',
    category: 'disciplinas',
    xpReward: 150,
    iconType: 'flask',
    calcProgress: (d) => {
      const bioSubs = (d.submissions || []).filter((s: any) => (s.subject || s.mock_exam_title || '').toLowerCase().includes('biologia'));
      let totalQ = 0; let totalC = 0;
      bioSubs.forEach((s: any) => { totalQ += Number(s.total_questions) || 0; totalC += Number(s.correct_count) || 0; });
      const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
      return { current: Math.min(85, acc), max: 85, isUnlocked: acc >= 85 };
    }
  },
  {
    id: 'esp_quimica',
    name: 'Mestre da Química',
    desc: 'Alcance 85% de taxa de acerto nos simulados de Química.',
    rarity: 'Rara',
    category: 'disciplinas',
    xpReward: 150,
    iconType: 'flask',
    calcProgress: (d) => {
      const qSubs = (d.submissions || []).filter((s: any) => (s.subject || s.mock_exam_title || '').toLowerCase().includes('química') || (s.subject || s.mock_exam_title || '').toLowerCase().includes('quimica'));
      let totalQ = 0; let totalC = 0;
      qSubs.forEach((s: any) => { totalQ += Number(s.total_questions) || 0; totalC += Number(s.correct_count) || 0; });
      const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
      return { current: Math.min(85, acc), max: 85, isUnlocked: acc >= 85 };
    }
  },
  {
    id: 'esp_fisica',
    name: 'Físico Quântico',
    desc: 'Alcance 85% de taxa de acerto nos simulados de Física.',
    rarity: 'Rara',
    category: 'disciplinas',
    xpReward: 150,
    iconType: 'flask',
    calcProgress: (d) => {
      const fSubs = (d.submissions || []).filter((s: any) => (s.subject || s.mock_exam_title || '').toLowerCase().includes('física') || (s.subject || s.mock_exam_title || '').toLowerCase().includes('fisica'));
      let totalQ = 0; let totalC = 0;
      fSubs.forEach((s: any) => { totalQ += Number(s.total_questions) || 0; totalC += Number(s.correct_count) || 0; });
      const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
      return { current: Math.min(85, acc), max: 85, isUnlocked: acc >= 85 };
    }
  },
  {
    id: 'esp_matematica',
    name: 'Calculadora Humana',
    desc: 'Alcance 85% de taxa de acerto nos simulados de Matemática.',
    rarity: 'Rara',
    category: 'disciplinas',
    xpReward: 150,
    iconType: 'flask',
    calcProgress: (d) => {
      const mSubs = (d.submissions || []).filter((s: any) => (s.subject || s.mock_exam_title || '').toLowerCase().includes('matemática') || (s.subject || s.mock_exam_title || '').toLowerCase().includes('matematica'));
      let totalQ = 0; let totalC = 0;
      mSubs.forEach((s: any) => { totalQ += Number(s.total_questions) || 0; totalC += Number(s.correct_count) || 0; });
      const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
      return { current: Math.min(85, acc), max: 85, isUnlocked: acc >= 85 };
    }
  },
  {
    id: 'esp_historia',
    name: 'Historiador Athenas',
    desc: 'Alcance 85% de taxa de acerto na disciplina de História.',
    rarity: 'Rara',
    category: 'disciplinas',
    xpReward: 150,
    iconType: 'flask',
    calcProgress: (d) => {
      const hSubs = (d.submissions || []).filter((s: any) => (s.subject || s.mock_exam_title || '').toLowerCase().includes('história') || (s.subject || s.mock_exam_title || '').toLowerCase().includes('historia'));
      let totalQ = 0; let totalC = 0;
      hSubs.forEach((s: any) => { totalQ += Number(s.total_questions) || 0; totalC += Number(s.correct_count) || 0; });
      const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
      return { current: Math.min(85, acc), max: 85, isUnlocked: acc >= 85 };
    }
  },
  {
    id: 'poliglota_cientifico',
    name: 'Poliglota Científico',
    desc: 'Responda simulados de pelo menos 4 disciplinas diferentes.',
    rarity: 'Comum',
    category: 'disciplinas',
    xpReward: 100,
    iconType: 'layers',
    calcProgress: (d) => {
      const subjs = new Set((d.submissions || []).map((s: any) => s.subject || s.mock_exam_title || 'Geral'));
      const count = subjs.size;
      return { current: Math.min(4, count), max: 4, isUnlocked: count >= 4 };
    }
  },
  {
    id: 'escudo_antidistracao',
    name: 'Escudo Anti-Distração',
    desc: 'Conclua 5 provas sem nenhuma troca de aba ou colagem.',
    rarity: 'Épica',
    category: 'constancia',
    xpReward: 250,
    iconType: 'shield',
    calcProgress: (d) => {
      let cleanCount = 0;
      (d.submissions || []).forEach((s: any) => {
        const sw = Number(s.telemetry?.tabSwitches) || Number(s.telemetry?.tab_switch_count) || 0;
        if (sw === 0) cleanCount++;
      });
      return { current: Math.min(5, cleanCount), max: 5, isUnlocked: cleanCount >= 5 };
    }
  },
  {
    id: 'guardiao_integridade',
    name: 'Guardião da Integridade',
    desc: 'Complete 15 simulados com 100% de foco e zero saídas de aba.',
    rarity: 'Lendária',
    category: 'constancia',
    xpReward: 500,
    iconType: 'shield',
    calcProgress: (d) => {
      let cleanCount = 0;
      (d.submissions || []).forEach((s: any) => {
        const sw = Number(s.telemetry?.tabSwitches) || Number(s.telemetry?.tab_switch_count) || 0;
        if (sw === 0) cleanCount++;
      });
      return { current: Math.min(15, cleanCount), max: 15, isUnlocked: cleanCount >= 15 };
    }
  },
  {
    id: 'fogo_sagrado_1',
    name: 'Fogo Sagrado I',
    desc: 'Mantenha 3 dias seguidos de estudo na plataforma.',
    rarity: 'Comum',
    category: 'constancia',
    xpReward: 50,
    iconType: 'flame',
    calcProgress: (d) => {
      const streak = d.streak || 0;
      return { current: Math.min(3, streak), max: 3, isUnlocked: streak >= 3 };
    }
  },
  {
    id: 'fogo_sagrado_2',
    name: 'Fogo Sagrado II',
    desc: 'Mantenha 7 dias seguidos de estudo na plataforma.',
    rarity: 'Rara',
    category: 'constancia',
    xpReward: 150,
    iconType: 'flame',
    calcProgress: (d) => {
      const streak = d.streak || 0;
      return { current: Math.min(7, streak), max: 7, isUnlocked: streak >= 7 };
    }
  },
  {
    id: 'fogo_sagrado_3',
    name: 'Fogo Sagrado III',
    desc: 'Mantenha 30 dias seguidos de estudo na plataforma.',
    rarity: 'Lendária',
    category: 'constancia',
    xpReward: 750,
    iconType: 'flame',
    calcProgress: (d) => {
      const streak = d.streak || 0;
      return { current: Math.min(30, streak), max: 30, isUnlocked: streak >= 30 };
    }
  },
  {
    id: 'coruja_madrugada',
    name: 'Coruja da Madrugada',
    desc: 'Conclua uma atividade ou simulado no turno da madrugada (00h às 06h).',
    rarity: 'Comum',
    category: 'constancia',
    xpReward: 75,
    iconType: 'clock',
    calcProgress: (d) => {
      const hasDawn = (d.submissions || []).some((s: any) => {
        if (!s.submitted_at) return false;
        const h = new Date(s.submitted_at).getHours();
        return h >= 0 && h < 6;
      });
      return { current: hasDawn ? 1 : 0, max: 1, isUnlocked: hasDawn };
    }
  },
  {
    id: 'passarinho_matutino',
    name: 'Passarinho Matutino',
    desc: 'Estude na plataforma no turno da manhã (06h às 12h).',
    rarity: 'Comum',
    category: 'constancia',
    xpReward: 75,
    iconType: 'clock',
    calcProgress: (d) => {
      const hasMorning = (d.submissions || []).some((s: any) => {
        if (!s.submitted_at) return false;
        const h = new Date(s.submitted_at).getHours();
        return h >= 6 && h < 12;
      });
      return { current: hasMorning ? 1 : 0, max: 1, isUnlocked: hasMorning };
    }
  },
  {
    id: 'maratona_estudos',
    name: 'Maratona de Estudos',
    desc: 'Acumule 10 horas ativas de estudo na plataforma.',
    rarity: 'Rara',
    category: 'constancia',
    xpReward: 200,
    iconType: 'clock',
    calcProgress: (d) => {
      const hrs = Math.round(((d.activeSeconds || 0) / 3600) * 10) / 10;
      return { current: Math.min(10, hrs), max: 10, isUnlocked: hrs >= 10 };
    }
  },
  {
    id: 'centenario_horas',
    name: 'Centenário de Horas',
    desc: 'Acumule 100 horas ativas de estudo na plataforma.',
    rarity: 'Lendária',
    category: 'constancia',
    xpReward: 1000,
    iconType: 'clock',
    calcProgress: (d) => {
      const hrs = Math.round(((d.activeSeconds || 0) / 3600) * 10) / 10;
      return { current: Math.min(100, hrs), max: 100, isUnlocked: hrs >= 100 };
    }
  },
  {
    id: 'mente_curiosa',
    name: 'Mente Curiosa',
    desc: 'Envie 10 perguntas ao tutor inteligente Athenas AI.',
    rarity: 'Comum',
    category: 'ia',
    xpReward: 50,
    iconType: 'sparkles',
    calcProgress: (d) => {
      const count = d.chatQueriesCount || 0;
      return { current: Math.min(10, count), max: 10, isUnlocked: count >= 10 };
    }
  },
  {
    id: 'desbravador_conhecimento',
    name: 'Desbravador do Conhecimento',
    desc: 'Faça 50 consultas pedagógicas à Athenas IA.',
    rarity: 'Rara',
    category: 'ia',
    xpReward: 150,
    iconType: 'sparkles',
    calcProgress: (d) => {
      const count = d.chatQueriesCount || 0;
      return { current: Math.min(50, count), max: 50, isUnlocked: count >= 50 };
    }
  },
  {
    id: 'mestre_dialogo',
    name: 'Mestre do Diálogo',
    desc: 'Faça 100 consultas à Athenas IA.',
    rarity: 'Épica',
    category: 'ia',
    xpReward: 300,
    iconType: 'sparkles',
    calcProgress: (d) => {
      const count = d.chatQueriesCount || 0;
      return { current: Math.min(100, count), max: 100, isUnlocked: count >= 100 };
    }
  },
  {
    id: 'oraculo_digital',
    name: 'Oráculo Digital',
    desc: 'Faça 500 perguntas para a Athenas IA.',
    rarity: 'Lendária',
    category: 'ia',
    xpReward: 800,
    iconType: 'sparkles',
    calcProgress: (d) => {
      const count = d.chatQueriesCount || 0;
      return { current: Math.min(500, count), max: 500, isUnlocked: count >= 500 };
    }
  },
  {
    id: 'primeira_linha',
    name: 'Primeira Linha',
    desc: 'Crie seu 1º Caderno Virtual na plataforma.',
    rarity: 'Comum',
    category: 'cadernos',
    xpReward: 50,
    iconType: 'book',
    calcProgress: (d) => {
      const count = d.notebooksCount || 0;
      return { current: Math.min(1, count), max: 1, isUnlocked: count >= 1 };
    }
  },
  {
    id: 'caderno_iluminado',
    name: 'Caderno Iluminado',
    desc: 'Salve 20 páginas de anotações no seu caderno.',
    rarity: 'Rara',
    category: 'cadernos',
    xpReward: 150,
    iconType: 'book',
    calcProgress: (d) => {
      const pages = d.notebookPagesCount || 0;
      return { current: Math.min(20, pages), max: 20, isUnlocked: pages >= 20 };
    }
  },
  {
    id: 'enciclopedia_pessoal',
    name: 'Enciclopédia Pessoal',
    desc: 'Salve 50 páginas de anotações de estudo.',
    rarity: 'Épica',
    category: 'cadernos',
    xpReward: 350,
    iconType: 'book',
    calcProgress: (d) => {
      const pages = d.notebookPagesCount || 0;
      return { current: Math.min(50, pages), max: 50, isUnlocked: pages >= 50 };
    }
  },
  {
    id: 'aprovado_mestre',
    name: 'Aprovado pelo Mestre',
    desc: 'Receba seu 1º Visto Pedagógico oficial do professor.',
    rarity: 'Rara',
    category: 'cadernos',
    xpReward: 150,
    iconType: 'check',
    calcProgress: (d) => {
      const stamped = d.stampedCount || 0;
      return { current: Math.min(1, stamped), max: 1, isUnlocked: stamped >= 1 };
    }
  },
  {
    id: 'colecao_vistos',
    name: 'Coleção de Vistos',
    desc: 'Receba 10 vistos pedagógicos em seus cadernos virtuais.',
    rarity: 'Lendária',
    category: 'cadernos',
    xpReward: 600,
    iconType: 'award',
    calcProgress: (d) => {
      const stamped = d.stampedCount || 0;
      return { current: Math.min(10, stamped), max: 10, isUnlocked: stamped >= 10 };
    }
  },
  {
    id: 'social_mural',
    name: 'Atento aos Avisos',
    desc: 'Inscreva-se em turmas e interaja com o Mural de Avisos.',
    rarity: 'Comum',
    category: 'geral',
    xpReward: 50,
    iconType: 'check',
    calcProgress: (d) => {
      return { current: d.activeSeconds > 60 ? 1 : 0, max: 1, isUnlocked: d.activeSeconds > 60 };
    }
  },
  {
    id: 'trabalho_equipe',
    name: 'Colega de Classe',
    desc: 'Participe ativamente da plataforma.',
    rarity: 'Comum',
    category: 'geral',
    xpReward: 75,
    iconType: 'sparkles',
    calcProgress: (d) => {
      return { current: d.activeSeconds > 120 ? 1 : 0, max: 1, isUnlocked: d.activeSeconds > 120 };
    }
  },
  {
    id: 'audio_foco',
    name: 'Música para Concentração',
    desc: 'Mantenha tempo ativo de estudos na plataforma.',
    rarity: 'Comum',
    category: 'geral',
    xpReward: 50,
    iconType: 'sparkles',
    calcProgress: (d) => {
      return { current: d.activeSeconds > 180 ? 1 : 0, max: 1, isUnlocked: d.activeSeconds > 180 };
    }
  },
  {
    id: 'nivel_10',
    name: 'Nível 10 Alcançado',
    desc: 'Chegue ao Nível 10 de Experiência na plataforma.',
    rarity: 'Rara',
    category: 'geral',
    xpReward: 200,
    iconType: 'star',
    calcProgress: (d) => {
      const lvl = d.computedLevel || 1;
      return { current: Math.min(10, lvl), max: 10, isUnlocked: lvl >= 10 };
    }
  },
  {
    id: 'nivel_25',
    name: 'Nível 25 Alcançado',
    desc: 'Chegue ao Nível 25 de Experiência na plataforma.',
    rarity: 'Épica',
    category: 'geral',
    xpReward: 500,
    iconType: 'star',
    calcProgress: (d) => {
      const lvl = d.computedLevel || 1;
      return { current: Math.min(25, lvl), max: 25, isUnlocked: lvl >= 25 };
    }
  },
  {
    id: 'lenda_athenas_max',
    name: 'Lenda de Athenas',
    desc: 'Chegue ao Nível 50 Supremo de Sabedoria.',
    rarity: 'Lendária',
    category: 'geral',
    xpReward: 2000,
    iconType: 'star',
    calcProgress: (d) => {
      const lvl = d.computedLevel || 1;
      return { current: Math.min(50, lvl), max: 50, isUnlocked: lvl >= 50 };
    }
  }
];

export default function StudentAchievements({
  userEmail,
  userName,
  userTurma = '',
  studentSubmissions = [],
  mockExams = [],
  openTimeSeconds = 0,
  activeTimeSeconds = 0
}: StudentAchievementsProps) {
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  // Navigation View State: 'jornada' (Achievements) or 'ranking' (Weekly BRT Ranking)
  const [activeView, setActiveView] = useState<'jornada' | 'ranking'>('jornada');

  // Filter controls for Achievements
  const [filterCategory, setFilterCategory] = useState<'all' | 'unlocked' | 'locked' | 'simulados' | 'constancia' | 'ia' | 'cadernos'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<EvaluatedBadge | null>(null);
  const [showHowXpModal, setShowHowXpModal] = useState(false);

  // REAL DATA STATES
  const [notebookStats, setNotebookStats] = useState({ count: 0, pagesCount: 0, stampedCount: 0 });
  const [chatQueriesCount, setChatQueriesCount] = useState<number>(0);
  const [claimedMissions, setClaimedMissions] = useState<Record<string, boolean>>({});
  const [manualBonusXP, setManualBonusXP] = useState<number>(0);

  // WEEKLY RANKING & CERTIFICATE STATES
  const [rankingData, setRankingData] = useState<PlatformStudentRank[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState<boolean>(false);
  const [rankingSearch, setRankingSearch] = useState<string>('');
  const [rankingFilterTab, setRankingFilterTab] = useState<'all' | 'turma' | 'top10'>('all');

  // Certificates Modal States
  const [studentCertificates, setStudentCertificates] = useState<StudentCertificateItem[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<StudentCertificateItem | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);
  const [showCertificatesListModal, setShowCertificatesListModal] = useState<boolean>(false);

  // Get current Sunday 18:00 BRT Weekly Cycle Info
  const weeklyCycle = useMemo(() => getWeeklyCycleInfo(), []);

  // 1. Fetch Real Notebooks, Reviews, Chat History, Certificates, and Gamification from Supabase & LocalStorage
  useEffect(() => {
    async function loadRealData() {
      if (!cleanEmail) return;

      // A) Fetch Real Saved Notebooks
      try {
        const { data: dbNotebooks } = await supabase
          .from('wsm_saved_notebooks')
          .select('id, pages, status, last_stamp')
          .eq('student_email', cleanEmail);

        let nList = dbNotebooks || [];
        let totalPages = 0;
        let stamped = 0;

        nList.forEach((nb: any) => {
          if (Array.isArray(nb.pages)) totalPages += nb.pages.length;
          if (nb.last_stamp || nb.status === 'reviewed') stamped += 1;
        });

        try {
          const { data: dbReviews } = await supabase
            .from('notebook_reviews')
            .select('id')
            .eq('student_email', cleanEmail);
          if (dbReviews && dbReviews.length > 0) {
            stamped = Math.max(stamped, dbReviews.length);
          }
        } catch {}

        setNotebookStats({
          count: nList.length,
          pagesCount: totalPages,
          stampedCount: stamped
        });
      } catch {}

      // B) Count Chat Queries to Athenas AI
      try {
        let count = 0;
        const chatKey = `athenas_chat_history_${cleanEmail}`;
        const rawChat = localStorage.getItem(chatKey);
        if (rawChat) {
          const parsed = JSON.parse(rawChat);
          if (Array.isArray(parsed)) count = parsed.filter((m: any) => m.sender === 'user').length;
        }
        setChatQueriesCount(count);
      } catch {}

      // C) Fetch Gamification Row from Supabase table `wsm_student_gamification`
      try {
        const { data: gamRow } = await supabase
          .from('wsm_student_gamification')
          .select('*')
          .eq('student_email', cleanEmail)
          .maybeSingle();

        if (gamRow) {
          if (gamRow.claimed_missions && typeof gamRow.claimed_missions === 'object') {
            setClaimedMissions(gamRow.claimed_missions);
          }
          if (gamRow.total_xp) {
            setManualBonusXP(gamRow.total_xp);
          }
        } else {
          try {
            const rawMissions = localStorage.getItem(`wsm_claimed_missions_${cleanEmail}`);
            if (rawMissions) setClaimedMissions(JSON.parse(rawMissions));
            const rawBonus = localStorage.getItem(`wsm_bonus_xp_${cleanEmail}`);
            if (rawBonus) setManualBonusXP(parseInt(rawBonus, 10));
          } catch {}
        }
      } catch {}

      // D) Fetch Certificates won by this student
      try {
        const certs = await getStudentCertificates(cleanEmail);
        setStudentCertificates(certs);
      } catch {}
    }

    loadRealData();
  }, [cleanEmail]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 2800);
  };

  // 2. Real Active Time (Seconds)
  const realActiveSeconds = Math.max(
    activeTimeSeconds || 0,
    parseInt(localStorage.getItem(`wsm_time_active_${cleanEmail}`) || '0', 10)
  );

  // 3. Real Streak Calculation
  const realStreak = useMemo(() => {
    const distinctDates = new Set<string>();
    studentSubmissions.forEach(s => {
      if (s.submitted_at) distinctDates.add(new Date(s.submitted_at).toLocaleDateString('pt-BR'));
    });
    if (realActiveSeconds > 30) {
      distinctDates.add(new Date().toLocaleDateString('pt-BR'));
    }
    return Math.max(1, distinctDates.size);
  }, [studentSubmissions, realActiveSeconds]);

  const activeDatesSet = useMemo(() => {
    const dates = new Set<string>();
    studentSubmissions.forEach((s: any) => {
      if (s.submitted_at) dates.add(new Date(s.submitted_at).toLocaleDateString('pt-BR'));
    });
    if (realActiveSeconds > 30) {
      dates.add(new Date().toLocaleDateString('pt-BR'));
    }
    return dates;
  }, [studentSubmissions, realActiveSeconds]);

  const weekDaysStatus = useMemo(() => {
    const now = new Date();
    const currentJsDay = now.getDay();
    const todayIdx = currentJsDay === 0 ? 6 : currentJsDay - 1;
    
    const mondayOffset = currentJsDay === 0 ? -6 : 1 - currentJsDay;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + mondayOffset);

    const daysLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

    return daysLabels.map((dayLabel, idx) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + idx);
      const dateStr = d.toLocaleDateString('pt-BR');

      const hasDirectActivity = activeDatesSet.has(dateStr);
      const isWithinStreakWindow = idx <= todayIdx && (todayIdx - idx) < realStreak;
      const isActive = hasDirectActivity || isWithinStreakWindow;
      const isToday = idx === todayIdx;

      return {
        label: dayLabel,
        isActive,
        isToday,
        dateStr
      };
    });
  }, [activeDatesSet, realStreak]);

  // 4. Calculate 100% REAL Total XP earned from real activities with Exam Score conversion & Cola Penalties:
  const realActivitiesXP = useMemo(() => {
    let xp = 0;

    studentSubmissions.forEach((s: any) => {
      const subXp = computeSubmissionXP(s);
      xp += subXp.netXp;
    });

    xp += notebookStats.pagesCount * 25;
    xp += notebookStats.stampedCount * 100;
    xp += chatQueriesCount * 15;
    xp += Math.floor(realActiveSeconds / 900) * 10;

    return xp;
  }, [studentSubmissions, notebookStats, chatQueriesCount, realActiveSeconds]);

  const dataContext = useMemo(() => {
    const submissionsCount = studentSubmissions.length;
    const tempXP = realActivitiesXP + manualBonusXP;
    const computedLevel = Math.max(1, Math.floor(Math.max(0, tempXP) / 500) + 1);

    return {
      submissionsCount,
      submissions: studentSubmissions,
      activeSeconds: realActiveSeconds,
      streak: realStreak,
      notebooksCount: notebookStats.count,
      notebookPagesCount: notebookStats.pagesCount,
      stampedCount: notebookStats.stampedCount,
      chatQueriesCount,
      computedLevel
    };
  }, [studentSubmissions, realActiveSeconds, realStreak, notebookStats, chatQueriesCount, realActivitiesXP, manualBonusXP]);

  const evaluatedBadges = useMemo(() => {
    return ALL_BADGES.map((b) => {
      const prog = b.calcProgress(dataContext);
      return {
        ...b,
        progCurrent: prog.current,
        progMax: prog.max,
        isUnlocked: prog.isUnlocked
      };
    });
  }, [dataContext]);

  const badgesXP = useMemo(() => {
    return evaluatedBadges.reduce((acc, curr) => acc + (curr.isUnlocked ? curr.xpReward : 0), 0);
  }, [evaluatedBadges]);

  const totalXP = realActivitiesXP + badgesXP + manualBonusXP + (claimedMissions['m1'] ? 50 : 0) + (claimedMissions['m2'] ? 30 : 0) + (claimedMissions['m3'] ? 30 : 0);

  // Student's Weekly XP (Sunday 18:00 BRT window)
  const currentStudentWeeklyXP = useMemo(() => {
    return calculateStudentWeeklyXP(
      cleanEmail,
      studentSubmissions,
      realActiveSeconds,
      chatQueriesCount,
      notebookStats,
      weeklyCycle.startDateISO,
      weeklyCycle.endDateISO
    );
  }, [cleanEmail, studentSubmissions, realActiveSeconds, chatQueriesCount, notebookStats, weeklyCycle]);

  const isNegativeXP = totalXP < 0;
  const currentLevel = isNegativeXP ? 0 : Math.floor(totalXP / 500) + 1;
  const xpInLevel = isNegativeXP ? totalXP : totalXP % 500;
  const xpRemaining = isNegativeXP ? Math.abs(totalXP) : 500 - xpInLevel;
  const levelFillPct = isNegativeXP ? 0 : (xpInLevel / 500) * 100;

  const levelTitle = useMemo(() => {
    if (totalXP < 0) return 'Saldo Negativo (Penalidade Disciplinar por Violações/Cola)';
    if (currentLevel < 5) return 'Aspirante Athenas';
    if (currentLevel < 10) return 'Estudante Dedicado';
    if (currentLevel < 20) return 'Investigador Científico';
    if (currentLevel < 30) return 'Estrategista do ENEM';
    if (currentLevel < 40) return 'Especialista das Ciências';
    if (currentLevel < 50) return 'Mestre da Sabedoria';
    return 'Erudito Athenas Supremo';
  }, [totalXP, currentLevel]);

  // FETCH REAL PLATFORM RANKING DATA (ONLY REAL ACCOUNTS - NO FAKE / DEMO ROSTER!)
  const fetchRankingData = async () => {
    setIsLoadingRanking(true);
    try {
      let dbProfiles: any[] = [];
      let dbGamification: any[] = [];

      try {
        const { data: pData } = await supabase
          .from('wsm_user_profiles')
          .select('id, email, nome_completo, turma, escola, cidade, role');
        dbProfiles = pData || [];
      } catch {}

      let allDbSubmissions: any[] = [];
      try {
        const { data: sData } = await supabase
          .from('wsm_mock_submissions')
          .select('id, student_email, score, correct_count, telemetry, submitted_at');
        allDbSubmissions = sData || [];
      } catch {}

      const submissionsByEmail: Record<string, any[]> = {};
      allDbSubmissions.forEach((sub: any) => {
        const sEmail = (sub.student_email || '').toLowerCase().trim();
        if (sEmail) {
          if (!submissionsByEmail[sEmail]) submissionsByEmail[sEmail] = [];
          submissionsByEmail[sEmail].push(sub);
        }
      });

      try {
        const { data: gData } = await supabase
          .from('wsm_student_gamification')
          .select('student_email, total_xp');
        dbGamification = gData || [];
      } catch {}

      const xpMap: Record<string, number> = {};
      dbGamification.forEach((g: any) => {
        if (g.student_email) {
          xpMap[g.student_email.toLowerCase().trim()] = Number(g.total_xp) || 0;
        }
      });

      let combinedList: PlatformStudentRank[] = [];
      const processedEmails = new Set<string>();

      // Process strictly real user accounts from database
      dbProfiles.forEach((p: any) => {
        const pEmail = (p.email || '').toLowerCase().trim();
        if (!pEmail || processedEmails.has(pEmail)) return;
        if (p.role && p.role !== 'student') return; // include student accounts only
        processedEmails.add(pEmail);

        const isMe = pEmail === cleanEmail;
        const studentSubs = isMe ? studentSubmissions : (submissionsByEmail[pEmail] || []);
        const weeklyXpValue = isMe
          ? currentStudentWeeklyXP
          : calculateStudentWeeklyXP(
              pEmail,
              studentSubs,
              0,
              0,
              { count: 0, pagesCount: 0, stampedCount: 0 },
              weeklyCycle.startDateISO,
              weeklyCycle.endDateISO
            );

        combinedList.push({
          id: p.id || pEmail,
          email: pEmail,
          name: p.nome_completo || pEmail.split('@')[0],
          turma: p.turma || userTurma || '8º Ano A',
          escola: p.escola || 'Colégio Athenas',
          cidade: p.cidade || 'São Paulo - SP',
          totalXp: weeklyXpValue,
          isCurrentUser: isMe
        });
      });

      // Ensure current logged in student is in list
      if (!processedEmails.has(cleanEmail) && cleanEmail) {
        combinedList.push({
          id: 'current_student_me',
          email: cleanEmail,
          name: userName || cleanEmail.split('@')[0],
          turma: userTurma || '8º Ano A',
          escola: 'Colégio Athenas',
          cidade: 'São Paulo - SP',
          totalXp: currentStudentWeeklyXP,
          isCurrentUser: true
        });
        processedEmails.add(cleanEmail);
      } else {
        combinedList = combinedList.map((s) => {
          if (s.email === cleanEmail || s.isCurrentUser) {
            return {
              ...s,
              name: userName || s.name,
              turma: userTurma || s.turma,
              totalXp: currentStudentWeeklyXP,
              isCurrentUser: true
            };
          }
          return s;
        });
      }

      // Sort descending by Weekly XP
      combinedList.sort((a, b) => b.totalXp - a.totalXp);

      // Assign 1-indexed global rank
      combinedList.forEach((st, idx) => {
        st.rank = idx + 1;
      });

      setRankingData(combinedList);

      // Auto check and archive winners if current cycle is near close or finished
      if (combinedList.length >= 1) {
        const top1 = combinedList[0] ? { email: combinedList[0].email, name: combinedList[0].name, turma: combinedList[0].turma, cidade: combinedList[0].cidade, xp: combinedList[0].totalXp } : null;
        const top2 = combinedList[1] ? { email: combinedList[1].email, name: combinedList[1].name, turma: combinedList[1].turma, cidade: combinedList[1].cidade, xp: combinedList[1].totalXp } : null;
        const top3 = combinedList[2] ? { email: combinedList[2].email, name: combinedList[2].name, turma: combinedList[2].turma, cidade: combinedList[2].cidade, xp: combinedList[2].totalXp } : null;

        const cycleWinnerRecord: WeeklyWinnerRecord = {
          cycleId: weeklyCycle.cycleId,
          cycleStartISO: weeklyCycle.startDateISO,
          cycleEndISO: weeklyCycle.endDateISO,
          formattedRange: weeklyCycle.formattedRange,
          rank1: top1,
          rank2: top2,
          rank3: top3,
          closedAtISO: new Date().toISOString()
        };

        saveWeeklyCycleWinners(cycleWinnerRecord);

        // Reload certificates for current student
        const certs = await getStudentCertificates(cleanEmail);
        setStudentCertificates(certs);
      }

    } catch (err) {
      console.warn('Error loading weekly platform ranking:', err);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  useEffect(() => {
    fetchRankingData();
  }, [cleanEmail, currentStudentWeeklyXP, activeView]);

  // Auto-sync calculated total XP (including negative balances) to Supabase gamification table
  useEffect(() => {
    if (!cleanEmail) return;
    const timer = setTimeout(async () => {
      try {
        await supabase
          .from('wsm_student_gamification')
          .upsert({
            student_email: cleanEmail,
            total_xp: totalXP,
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_email' });
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [cleanEmail, totalXP]);

  const handleClaimMission = async (missionId: string, xpAmount: number) => {
    if (claimedMissions[missionId]) return;

    const newClaimed = { ...claimedMissions, [missionId]: true };
    const newBonus = manualBonusXP + xpAmount;

    setClaimedMissions(newClaimed);
    setManualBonusXP(newBonus);

    try {
      localStorage.setItem(`wsm_claimed_missions_${cleanEmail}`, JSON.stringify(newClaimed));
      localStorage.setItem(`wsm_bonus_xp_${cleanEmail}`, String(newBonus));
    } catch {}

    try {
      await supabase
        .from('wsm_student_gamification')
        .upsert({
          student_email: cleanEmail,
          total_xp: totalXP + xpAmount,
          claimed_missions: newClaimed,
          updated_at: new Date().toISOString()
        }, { onConflict: 'student_email' });
    } catch (err) {
      console.warn('Could not save gamification to Supabase:', err);
    }

    showToast(`+${xpAmount} XP resgatados com sucesso!`);
  };

  const filteredBadges = useMemo(() => {
    return evaluatedBadges.filter((b) => {
      if (filterCategory === 'all') return true;
      if (filterCategory === 'unlocked') return b.isUnlocked;
      if (filterCategory === 'locked') return !b.isUnlocked;
      return b.category === filterCategory;
    });
  }, [evaluatedBadges, filterCategory]);

  const unlockedCount = evaluatedBadges.filter((b) => b.isUnlocked).length;

  // Compute Ranking Filtered Data & Student Rank Position
  const { filteredRankingList, top30RankingList, currentStudentRankItem, currentStudentRankNumber, totalPlatformStudents } = useMemo(() => {
    let list = [...rankingData];

    if (rankingSearch.trim()) {
      const q = rankingSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.turma.toLowerCase().includes(q) ||
          s.cidade.toLowerCase().includes(q)
      );
    }

    if (rankingFilterTab === 'turma' && userTurma) {
      const tClean = userTurma.toLowerCase().trim();
      list = list.filter((s) => s.turma.toLowerCase().includes(tClean) || s.isCurrentUser);
    } else if (rankingFilterTab === 'top10') {
      list = list.slice(0, 10);
    }

    const top30 = list.slice(0, 30);
    const meItem = rankingData.find((s) => s.isCurrentUser || s.email === cleanEmail);
    const meRankNum = meItem?.rank || 1;

    return {
      filteredRankingList: list,
      top30RankingList: top30,
      currentStudentRankItem: meItem,
      currentStudentRankNumber: meRankNum,
      totalPlatformStudents: rankingData.length
    };
  }, [rankingData, rankingSearch, rankingFilterTab, userTurma, cleanEmail]);

  const isCurrentStudentInTop30 = useMemo(() => {
    return top30RankingList.some((s) => s.isCurrentUser || s.email === cleanEmail);
  }, [top30RankingList, cleanEmail]);

  const openCertModal = (cert: StudentCertificateItem) => {
    setSelectedCertificate(cert);
    setIsCertModalOpen(true);
  };

  return (
    <div className="w-full max-w-[1550px] mx-auto space-y-6 animate-fadeIn pb-16 font-sans text-[#f1f5f3] select-text">
      
      {/* Toast Popup Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#171e1b] border border-[#27322d] text-[#f1f5f3] px-4 py-3 rounded-xl text-xs shadow-2xl z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#55e6b5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Certificate PNG Viewer & Exporter Modal */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={selectedCertificate}
        userEmail={cleanEmail}
      />

      {/* Modal Details for Badge */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#111715] border border-[#27322d] rounded-2xl p-6 space-y-4 relative shadow-2xl"
          >
            <button 
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 text-[#77827c] hover:text-[#f1f5f3] text-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                selectedBadge.isUnlocked 
                  ? 'bg-[#1b2922] border-[#55e6b5]/40 text-[#55e6b5]' 
                  : 'bg-[#171e1b] border-[#27322d] text-[#77827c]'
              }`}>
                <Award className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#55e6b5] bg-[#55e6b5]/10 px-2 py-0.5 rounded border border-[#55e6b5]/20">
                  {selectedBadge.rarity}
                </span>
                <h3 className="text-lg font-bold text-[#f1f5f3] mt-1">{selectedBadge.name}</h3>
              </div>
            </div>

            <p className="text-xs text-[#a5b0aa] leading-relaxed">
              {selectedBadge.desc}
            </p>

            <div className="p-3 bg-[#171e1b] rounded-xl border border-[#27322d] space-y-2 text-xs font-sans">
              <div className="flex justify-between text-[#77827c]">
                <span>Status da Conquista:</span>
                <b className={selectedBadge.isUnlocked ? 'text-[#55e6b5]' : 'text-amber-400'}>
                  {selectedBadge.isUnlocked ? 'Desbloqueada!' : 'Em progresso'}
                </b>
              </div>
              <div className="flex justify-between text-[#77827c]">
                <span>Recompensa de XP:</span>
                <b className="text-[#55e6b5]">+{selectedBadge.xpReward} XP</b>
              </div>
              {!selectedBadge.isUnlocked && (
                <div className="space-y-1 pt-1 border-t border-[#27322d]">
                  <div className="flex justify-between text-[11px] text-[#77827c]">
                    <span>Requisito Atual:</span>
                    <span className="font-mono text-[#f1f5f3]">{selectedBadge.progCurrent} / {selectedBadge.progMax}</span>
                  </div>
                  <div className="w-full bg-[#252e29] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#55e6b5] h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (selectedBadge.progCurrent / selectedBadge.progMax) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedBadge(null)}
              className="w-full py-2.5 bg-[#55e6b5] hover:bg-[#42d4a3] text-[#0b0f0e] font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Entendi
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal: Como Funciona o XP Real */}
      {showHowXpModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[#111715] border border-[#27322d] rounded-2xl p-6 space-y-4 relative shadow-2xl"
          >
            <button 
              onClick={() => setShowHowXpModal(false)}
              className="absolute top-4 right-4 text-[#77827c] hover:text-[#f1f5f3] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#27322d] pb-3">
              <Zap className="w-6 h-6 text-[#55e6b5]" />
              <h3 className="text-base font-bold text-[#f1f5f3]">Cálculo 100% Real do seu XP e Nível</h3>
            </div>

            <div className="text-xs text-[#a5b0aa] space-y-3 leading-relaxed">
              <p>
                Todos os dados exibidos aqui refletem <strong className="text-[#55e6b5]">estritamente o uso real da sua conta</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#f1f5f3]">
                <li><strong>⭐ Conversão Real de Nota em XP:</strong> Suas notas nos simulados se convertem diretamente em XP considerável (ex: Nota 10,0 = <span className="text-[#e4bf74] font-bold">+1.000 XP</span>; Nota 8,5 = <span className="text-[#55e6b5] font-bold">+850 XP</span>; Nota 5,0 = +500 XP) + 20 XP por questão acertada.</li>
                <li><strong>Gabarito Perfeito & Integridade:</strong> +250 XP adicionais por gabaritar (nota 10) e +100 XP por simulados sem qualquer troca de aba.</li>
                <li><strong>⚠️ Penalidades Severas por Violações & Cola:</strong> Cada saída de aba ou tela cheia deduz <span className="text-rose-400 font-bold">-150 XP</span>. Colar trechos externos na prova deduz <span className="text-rose-400 font-bold">-300 XP</span>. Bloqueio por cola flagrante deduz <span className="text-rose-400 font-bold">-500 XP</span> com perda total de bônus!</li>
                <li><strong>📉 XP Negativo (Saldo Devedor):</strong> Estudantes que cometem infrações de cola ou não participam podem ficar com <span className="text-rose-400 font-bold font-mono">XP Negativo (ex: -200 XP)</span>, igual saldo bancário devedor! Para quitar a dívida e voltar ao positivo, o aluno deve realizar novos simulados com integridade e boas notas.</li>
                <li><strong>Caderno Virtual:</strong> +25 XP por página criada + 100 XP por Visto Pedagógico oficial do professor.</li>
                <li><strong>Athenas IA:</strong> +15 XP por dúvida e pergunta formulada no Chat.</li>
                <li><strong>Tempo Ativo de Estudos:</strong> +10 XP a cada 15 minutos com o site em uso ativo.</li>
                <li><strong>Ranking Semanal:</strong> Ciclo oficial reiniciado todos os domingos às <strong className="text-[#e4bf74]">18:00 (Horário de Brasília)</strong> com premiação de certificados em PNG para os 3 primeiros colocados.</li>
              </ul>
              <p className="text-[11px] text-[#77827c] border-t border-[#27322d] pt-2">
                Nível atual: <strong>{isNegativeXP ? 'Nível 0 (Em Débito)' : `Nível ${currentLevel}`}</strong> ({totalXP.toLocaleString('pt-BR')} XP total).
              </p>
            </div>

            <button
              onClick={() => setShowHowXpModal(false)}
              className="w-full py-2.5 bg-[#55e6b5] hover:bg-[#42d4a3] text-[#0b0f0e] font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Entendi
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal: List of Student's Certificates */}
      {showCertificatesListModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-[#111715] border border-[#27322d] rounded-2xl p-6 space-y-4 relative shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <button 
              onClick={() => setShowCertificatesListModal(false)}
              className="absolute top-4 right-4 text-[#77827c] hover:text-[#f1f5f3] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#27322d] pb-3">
              <Trophy className="w-6 h-6 text-[#e4bf74]" />
              <div>
                <h3 className="text-base font-bold text-[#f1f5f3]">Meus Certificados de Reconhecimento</h3>
                <p className="text-xs text-[#77827c]">Certificados em alta definição (PNG) conquistados nos Rankings Semanais</p>
              </div>
            </div>

            {studentCertificates.length === 0 ? (
              <div className="p-8 text-center bg-[#171e1b] rounded-xl border border-[#27322d] space-y-2">
                <FileCheck className="w-10 h-10 text-[#77827c] mx-auto" />
                <p className="text-xs text-[#a5b0aa]">
                  Você ainda não possui certificados emitidos.
                </p>
                <p className="text-[11px] text-[#77827c]">
                  Fique entre os <strong className="text-[#e4bf74]">3 primeiros colocados</strong> do Ranking Semanal (fechamento aos domingos às 18h BRT) para garantir seu Certificado Oficial de Ouro, Prata ou Bronze!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {studentCertificates.map((cert) => {
                  const isGold = cert.place === 'gold';
                  const isSilver = cert.place === 'silver';
                  const isBronze = cert.place === 'bronze';
                  const medalColor = isGold ? '#e4bf74' : isSilver ? '#c0c0c0' : '#cd7f32';

                  return (
                    <div 
                      key={cert.id}
                      className="p-4 bg-[#171e1b] border border-[#27322d] hover:border-[#55e6b5] rounded-xl flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: `${medalColor}20`, border: `1px solid ${medalColor}`, color: medalColor }}>
                          {isGold ? <Crown className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#f1f5f3]">
                            Certificado de {isGold ? 'Ouro (1º Lugar)' : isSilver ? 'Prata (2º Lugar)' : 'Bronze (3º Lugar)'}
                          </div>
                          <div className="text-[11px] text-[#77827c] mt-0.5">
                            {cert.cycleRangeText} · {cert.weeklyXp.toLocaleString('pt-BR')} XP
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setShowCertificatesListModal(false);
                          openCertModal(cert);
                        }}
                        className="px-3 py-1.5 bg-[#55e6b5] hover:bg-[#42d4a3] text-[#0b0f0e] text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PNG</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowCertificatesListModal(false)}
              className="w-full py-2.5 bg-[#171e1b] border border-[#27322d] hover:bg-[#232d27] text-[#f1f5f3] font-bold text-xs rounded-xl transition-all cursor-pointer mt-2"
            >
              Fechar
            </button>
          </motion.div>
        </div>
      )}

      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center justify-between pb-3 border-b border-[#27322d]">
        <div className="flex items-center gap-2 text-xs text-[#77827c]">
          <span>Área do aluno</span>
          <span>/</span>
          <span className="text-[#a5b0aa] font-medium">
            {activeView === 'jornada' ? 'Jornada & Conquistas' : 'Ranking Geral da Plataforma'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* BUTTON FOR MY CERTIFICATES */}
          <button
            onClick={() => setShowCertificatesListModal(true)}
            className="px-3 py-1.5 bg-[#231d13] border border-[#e4bf74]/40 hover:border-[#e4bf74] text-[#e4bf74] text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5 text-[#e4bf74]" />
            <span>Meus Certificados ({studentCertificates.length})</span>
          </button>

          <button 
            onClick={() => setShowHowXpModal(true)}
            className="w-8 h-8 rounded-lg border border-[#27322d] bg-[#111715] hover:border-[#55e6b5] text-[#a5b0aa] flex items-center justify-center transition-all cursor-pointer"
            aria-label="Sobre o XP"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header with Title + Toggle Button side-by-side */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold tracking-wider text-[#55e6b5] uppercase">
            {activeView === 'jornada' ? 'Seu esforço também merece ser visto' : 'Classificação Oficial dos Alunos da Rede'}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f1f5f3]">
              {activeView === 'jornada' ? 'Jornada & Conquistas' : 'Ranking da Plataforma'}
            </h1>

            {/* TOGGLE BUTTON RIGHT BESIDE TITLE */}
            <div className="flex items-center p-1 bg-[#0b0f0e] border border-[#27322d] rounded-xl gap-1">
              <button
                onClick={() => setActiveView('jornada')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'jornada'
                    ? 'bg-[#1b2721] text-[#55e6b5] border border-[#55e6b5]/30 shadow-sm'
                    : 'text-[#77827c] hover:text-[#f1f5f3]'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Conquistas</span>
              </button>
              <button
                onClick={() => setActiveView('ranking')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'ranking'
                    ? 'bg-[#2b2416] text-[#e4bf74] border border-[#e4bf74]/30 shadow-sm'
                    : 'text-[#77827c] hover:text-[#f1f5f3]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-[#e4bf74]" />
                <span>Ranking</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-[#77827c]">
            {activeView === 'jornada'
              ? 'Acompanhe suas metas reais, acumule experiência e celebre cada avanço na sua conta.'
              : 'Classificação real semanal da rede. O ranking reseta todos os domingos às 18:00 (Horário de Brasília).'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setShowHowXpModal(true)}
            className="px-3.5 py-2 bg-transparent border border-[#27322d] hover:bg-[#171e1b] rounded-lg text-xs font-medium text-[#a5b0aa] hover:text-[#f1f5f3] transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Como funciona o XP</span>
          </button>
        </div>
      </header>

      {/* VIEW SWITCHING RENDER: JORNADA VS RANKING */}
      {activeView === 'jornada' ? (
        <>
          {/* HERO SECTION: Level Banner Card + Streak Card */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Level Banner Card (8 cols) */}
            <article className={`lg:col-span-8 ${isNegativeXP ? 'bg-[#181012] border-rose-900/60 shadow-[0_0_25px_rgba(244,63,94,0.1)]' : 'bg-[#111715] border-[#27322d]'} border rounded-2xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Emblem Badge Icon */}
                  {isNegativeXP ? (
                    <div className="w-14 h-14 rounded-full border-2 border-rose-500/60 bg-[#2b1216] flex items-center justify-center text-rose-400 shrink-0 shadow-lg relative">
                      <ShieldAlert className="w-7 h-7 stroke-[1.8]" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full border-2 border-[#e4bf74] bg-[#211b12] flex items-center justify-center text-[#e3bb74] shrink-0 shadow-lg relative">
                      <Award className="w-7 h-7 stroke-[1.7]" />
                    </div>
                  )}

                  <div>
                    <div className={`text-[10px] uppercase font-mono font-bold tracking-wider ${isNegativeXP ? 'text-rose-400' : 'text-[#77827c]'}`}>
                      {isNegativeXP ? 'CONTA NEGATIVADA · DÉBITO DISCIPLINAR' : `NÍVEL ${currentLevel}`}
                    </div>
                    <div className="text-lg sm:text-xl font-semibold text-[#f1f5f3] tracking-tight mt-0.5">
                      {levelTitle}
                    </div>
                    <div className={`text-[11px] font-mono mt-0.5 ${isNegativeXP ? 'text-rose-400/90 font-medium' : 'text-[#d6b570]'}`}>
                      {isNegativeXP ? '⚠️ Penalidades por cola ou infrações aplicadas' : 'Título Honorífico · Moldura Ouro'}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${isNegativeXP ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'text-[#f1f5f3]'}`}>
                    {totalXP.toLocaleString('pt-BR')} <small className={`text-xs ${isNegativeXP ? 'text-rose-300 font-bold' : 'text-[#77827c]'}`}>XP</small>
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isNegativeXP ? 'text-rose-400/90 font-semibold' : 'text-[#77827c]'}`}>
                    {isNegativeXP ? 'saldo negativo devedor (em dívida)' : 'experiência total calculada'}
                  </div>
                </div>
              </div>

              {/* Level Progress Bar or Negative Debt Recovery Bar */}
              {isNegativeXP ? (
                <div className="space-y-2 pt-2 border-t border-rose-900/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-rose-300 flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Saldo devedor por infrações disciplinares
                    </span>
                    <strong className="text-rose-400 font-mono font-bold">{totalXP} XP</strong>
                  </div>

                  <div className="w-full bg-[#2a1317] border border-rose-900/60 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-rose-300">
                    <span>Recupere <b className="text-white font-mono font-bold">+{Math.abs(totalXP)} XP</b> com simulados sem infrações para zerar o débito</span>
                    <span className="font-semibold text-rose-400 font-mono uppercase">Status: Conta no Vermelho</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-[#27322d]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#a5b0aa]">Progresso para o nível {currentLevel + 1}</span>
                    <strong className="text-[#f1f5f3] font-mono">{xpInLevel} / 500 XP</strong>
                  </div>

                  <div className="w-full bg-[#29312c] h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="bg-[#55e6b5] h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${Math.min(100, Math.max(2, levelFillPct))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#77827c]">
                    <span>Faltam <b className="text-[#a5b0aa]">{xpRemaining} XP</b> para subir de nível</span>
                    <span>Próximo nível: <b className="text-[#a5b0aa]">Nível {currentLevel + 1}</b></span>
                  </div>
                </div>
              )}
            </article>

            {/* Streak Card (4 cols) */}
            <article className="lg:col-span-4 bg-[#111715] border border-[#27322d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a5b0aa]">Constância de estudos</span>
                <div className="w-8 h-8 rounded-lg bg-[#282015] flex items-center justify-center text-[#eab66a]">
                  <Flame className="w-4 h-4 stroke-[1.8]" />
                </div>
              </div>

              <div>
                <div className="text-3xl font-semibold text-[#f1f5f3] tracking-tight leading-none">
                  {realStreak} <small className="text-xs text-[#a5b0aa] font-normal">{realStreak === 1 ? 'dia ativo' : 'dias seguidos'}</small>
                </div>
                <div className="text-xs text-[#77827c] mt-1.5">
                  {realStreak > 0 ? 'Mantenha seus estudos para continuar crescendo!' : 'Estude hoje para iniciar sua sequência.'}
                </div>
              </div>

              {/* Molduras de Foquinho Douradas para os Dias Seguidos da Semana */}
              <div className="flex items-center justify-between gap-1 pt-3 border-t border-[#27322d]">
                {weekDaysStatus.map((dayItem, idx) => {
                  return (
                    <div 
                      key={idx} 
                      className="flex flex-col items-center justify-center relative group"
                      title={dayItem.isActive ? `Dia ativo na ofensiva (${dayItem.dateStr})` : `Dia da semana (${dayItem.label})`}
                    >
                      <div className={`relative w-8 h-9 flex items-center justify-center transition-all duration-300 ${
                        dayItem.isActive ? 'hover:scale-115 drop-shadow-[0_2px_8px_rgba(228,191,116,0.4)]' : 'hover:scale-105'
                      }`}>
                        {dayItem.isActive ? (
                          <>
                            <svg
                              viewBox="0 0 24 26"
                              className="absolute inset-0 w-full h-full text-[#e4bf74] fill-[#e4bf74]/20 stroke-[#e4bf74] stroke-[1.8] filter drop-shadow-[0_0_6px_rgba(228,191,116,0.5)]"
                              preserveAspectRatio="none"
                            >
                              <path
                                d="M8.5 15.5A2.5 2.5 0 0 0 11 13c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"
                              />
                            </svg>
                            <span className="relative z-10 text-[11px] font-black font-mono text-[#fff4ce] pt-1.5 tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                              {dayItem.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg
                              viewBox="0 0 24 26"
                              className="absolute inset-0 w-full h-full text-[#24332b] fill-[#121916] stroke-[#28382f] stroke-[1.4] opacity-60"
                              preserveAspectRatio="none"
                            >
                              <path
                                d="M8.5 15.5A2.5 2.5 0 0 0 11 13c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"
                              />
                            </svg>
                            <span className="relative z-10 text-[10px] font-medium font-mono text-[#52695c] pt-1.5">
                              {dayItem.label}
                            </span>
                          </>
                        )}
                      </div>

                      {dayItem.isToday && (
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#55e6b5] shadow-[0_0_6px_#55e6b5]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </article>

          </section>

          {/* TWO COLUMN GRID: Daily Missions + Weekly Quests */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Panel 1: Missões de hoje (7 cols) */}
            <article className="lg:col-span-7 bg-[#111715] border border-[#27322d] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#f1f5f3]">Missões de hoje</div>
                  <div className="text-[10px] text-[#77827c] mt-0.5">Metas reais do seu dia a dia de estudos</div>
                </div>
                <span className="text-[10px] text-[#77827c] font-mono px-2 py-1 border border-[#27322d] rounded-md">
                  Hoje · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </div>

              {/* Missions List */}
              <div className="space-y-2.5">
                {/* Mission 1: Simulado */}
                <div className="p-3 bg-[#141b18] border border-[#27322d]/60 hover:border-[#2c3932] rounded-xl flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#232d27] text-[#a5b0aa] flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#f1f5f3]">Resolva um simulado ou lista</div>
                      <div className="text-[10px] text-[#77827c]">
                        {studentSubmissions.length > 0 ? `${studentSubmissions.length} simulado(s) concluído(s)` : 'Nenhum simulado concluído hoje'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#55e6b5] font-semibold">+50 XP</span>
                    {claimedMissions['m1'] ? (
                      <span className="text-[10px] text-[#55e6b5] bg-[#55e6b5]/10 px-2 py-1 rounded font-mono">Resgatado</span>
                    ) : (
                      <button
                        onClick={() => handleClaimMission('m1', 50)}
                        className="px-2.5 py-1 bg-[#1a2a22] border border-[#345443] text-[#55e6b5] text-[10px] font-semibold rounded-lg hover:bg-[#23382d] transition-colors cursor-pointer"
                      >
                        Resgatar
                      </button>
                    )}
                  </div>
                </div>

                {/* Mission 2: Chat IA */}
                <div className="p-3 bg-[#141b18] border border-[#27322d]/60 hover:border-[#2c3932] rounded-xl flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#232d27] text-[#a5b0aa] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-[#55e6b5]" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#f1f5f3]">Converse com a Athenas IA</div>
                      <div className="text-[10px] text-[#77827c]">
                        {chatQueriesCount > 0 ? `${chatQueriesCount} dúvida(s) enviada(s)` : 'Tire 2 dúvidas no Chat da IA'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#55e6b5] font-semibold">+30 XP</span>
                    {claimedMissions['m2'] ? (
                      <span className="text-[10px] text-[#55e6b5] bg-[#55e6b5]/10 px-2 py-1 rounded font-mono">Resgatado</span>
                    ) : (
                      <button
                        onClick={() => handleClaimMission('m2', 30)}
                        className="px-2.5 py-1 bg-[#1a2a22] border border-[#345443] text-[#55e6b5] text-[10px] font-semibold rounded-lg hover:bg-[#23382d] transition-colors cursor-pointer"
                      >
                        Resgatar
                      </button>
                    )}
                  </div>
                </div>

                {/* Mission 3: Caderno */}
                <div className="p-3 bg-[#141b18] border border-[#27322d]/60 hover:border-[#2c3932] rounded-xl flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#232d27] text-[#a5b0aa] flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#f1f5f3]">Atualize seu caderno</div>
                      <div className="text-[10px] text-[#77827c]">
                        {notebookStats.pagesCount > 0 ? `${notebookStats.pagesCount} página(s) anotada(s)` : 'Escreva ou revise uma página de anotações'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#55e6b5] font-semibold">+30 XP</span>
                    {claimedMissions['m3'] ? (
                      <span className="text-[10px] text-[#55e6b5] bg-[#55e6b5]/10 px-2 py-1 rounded font-mono">Resgatado</span>
                    ) : (
                      <button
                        onClick={() => handleClaimMission('m3', 30)}
                        className="px-2.5 py-1 bg-[#1a2a22] border border-[#345443] text-[#55e6b5] text-[10px] font-semibold rounded-lg hover:bg-[#23382d] transition-colors cursor-pointer"
                      >
                        Resgatar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#27322d] flex items-center justify-between text-[11px] text-[#77827c]">
                <span>Conclusão das 3 missões: <strong className="text-[#a5b0aa]">{(claimedMissions['m1']?1:0) + (claimedMissions['m2']?1:0) + (claimedMissions['m3']?1:0)} de 3</strong></span>
                <span className="text-[#55e6b5] font-semibold">Bônus diário +50 XP</span>
              </div>
            </article>

            {/* Panel 2: Desafios da semana (5 cols) */}
            <article className="lg:col-span-5 bg-[#111715] border border-[#27322d] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#f1f5f3]">Desafios da semana</div>
                  <div className="text-[10px] text-[#77827c] mt-0.5">Progresso em tempo real</div>
                </div>
                <span className="text-[10px] text-[#77827c] font-mono px-2 py-1 border border-[#27322d] rounded-md">
                  Semana Ativa
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a5b0aa] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#55e6b5]" />
                      Estude em dias da semana
                    </span>
                    <span className="text-[11px] text-[#77827c] font-mono">{Math.min(5, realStreak)} / 5</span>
                  </div>
                  <div className="w-full bg-[#2a332e] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#55e6b5] h-full transition-all" style={{ width: `${Math.min(100, (realStreak / 5) * 100)}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a5b0aa] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#55e6b5]" />
                      Horas de estudo ativo
                    </span>
                    <span className="text-[11px] text-[#77827c] font-mono">{(realActiveSeconds / 3600).toFixed(1).replace('.', ',')} / 3 h</span>
                  </div>
                  <div className="w-full bg-[#2a332e] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#55e6b5] h-full transition-all" style={{ width: `${Math.min(100, ((realActiveSeconds / 3600) / 3) * 100)}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a5b0aa] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#55e6b5]" />
                      Conclua 3 simulados
                    </span>
                    <span className="text-[11px] text-[#77827c] font-mono">{Math.min(3, studentSubmissions.length)} / 3</span>
                  </div>
                  <div className="w-full bg-[#2a332e] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#55e6b5] h-full transition-all" style={{ width: `${Math.min(100, (studentSubmissions.length / 3) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#27322d] flex items-center justify-between text-[11px] text-[#77827c]">
                <span>Recompensa ao completar todas</span>
                <b className="text-[#f1f5f3] font-semibold">+150 XP</b>
              </div>
            </article>

          </section>

          {/* BADGES GALLERY SECTION */}
          <section className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#f1f5f3]">Insígnias & Conquistas</h2>
                <p className="text-xs text-[#77827c] mt-0.5">
                  Reconhecimentos reais calculados a partir das suas atividades na conta ({unlockedCount} de {evaluatedBadges.length} conquistadas).
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center p-1 bg-[#0e1311] border border-[#27322d] rounded-xl gap-1 self-start sm:self-auto">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'unlocked', label: 'Conquistadas' },
                  { id: 'locked', label: 'Em progresso' },
                  { id: 'simulados', label: 'Simulados' },
                  { id: 'constancia', label: 'Foco' },
                  { id: 'ia', label: 'Athenas IA' },
                  { id: 'cadernos', label: 'Cadernos' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterCategory(f.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                      filterCategory === f.id
                        ? 'bg-[#171e1b] text-[#f1f5f3]'
                        : 'text-[#77827c] hover:text-[#a5b0aa]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Badge Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredBadges.map((badge) => {
                const pct = Math.min(100, Math.round((badge.progCurrent / badge.progMax) * 100));

                let rarityClass = 'text-[#55e6b5] bg-[#1b2922]';
                if (badge.rarity === 'Rara') rarityClass = 'text-[#83a9ff] bg-[#1b2430]';
                if (badge.rarity === 'Épica') rarityClass = 'text-[#b7a0ff] bg-[#211d2d]';
                if (badge.rarity === 'Lendária') rarityClass = 'text-[#e4bf74] bg-[#2a2418]';

                return (
                  <div
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    className={`p-4 bg-[#111715] border border-[#27322d] hover:border-[#405148] rounded-xl flex flex-col justify-between min-h-[148px] transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 ${
                      badge.isUnlocked ? '' : 'opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${rarityClass}`}>
                          {badge.isUnlocked ? (
                            <Award className="w-5 h-5 stroke-[1.8]" />
                          ) : (
                            <Lock className="w-4 h-4 text-[#77827c]" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#55e6b5] font-semibold">
                          +{badge.xpReward} XP
                        </span>
                      </div>

                      <h3 className="text-xs font-semibold text-[#f1f5f3] group-hover:text-[#55e6b5] transition-colors leading-snug">
                        {badge.name}
                      </h3>
                      <p className="text-[11px] text-[#77827c] mt-1 line-clamp-2 leading-relaxed">
                        {badge.desc}
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-[#27322d]/60 space-y-1">
                      {!badge.isUnlocked && (
                        <div className="w-full bg-[#252e29] h-1 rounded-full overflow-hidden">
                          <div className="bg-[#55e6b5] h-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[#77827c]">
                        <span>{badge.isUnlocked ? 'Conquistada!' : `${badge.progCurrent} / ${badge.progMax}`}</span>
                        <span className="font-mono text-[9px] uppercase">{badge.rarity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        /* RANKING VIEW - WEEKLY RESET SUNDAYS 18:00 BRT */
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* COUNTDOWN & CYCLE BANNER */}
          <div className="p-4 bg-[#141d18] border border-[#e4bf74]/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#282116] border border-[#e4bf74]/50 flex items-center justify-center text-[#e4bf74] shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#f1f5f3] flex items-center gap-2">
                  <span>Fechamento do Ranking Semanal</span>
                  <span className="px-2 py-0.5 bg-[#e4bf74]/20 text-[#e4bf74] border border-[#e4bf74]/30 text-[10px] font-mono rounded">
                    Domingos às 18h (Brasília)
                  </span>
                </div>
                <div className="text-[11px] text-[#a5b0aa] mt-0.5">
                  {weeklyCycle.formattedRange} · Pontuação calculada do ciclo semanal atual.
                </div>
              </div>
            </div>

            <div className="px-3.5 py-1.5 bg-[#231d13] border border-[#e4bf74]/50 rounded-xl text-right shrink-0">
              <div className="text-[10px] text-[#77827c] uppercase font-mono font-bold">Tempo Restante</div>
              <div className="text-sm font-extrabold text-[#e4bf74] font-mono">
                {weeklyCycle.formattedCountdown}
              </div>
            </div>
          </div>

          {/* STATS SUMMARY BAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-[#111715] border border-[#27322d] rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#282116] border border-[#e4bf74]/30 flex items-center justify-center text-[#e4bf74]">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-[#77827c] uppercase font-mono font-semibold">Sua Posição Semanal</div>
                <div className="text-lg font-bold text-[#e4bf74] font-mono">#{currentStudentRankNumber}º Lugar</div>
              </div>
            </div>

            <div className="p-4 bg-[#111715] border border-[#27322d] rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1c2822] border border-[#55e6b5]/30 flex items-center justify-center text-[#55e6b5]">
                <Zap className="w-5 h-5 text-[#55e6b5]" />
              </div>
              <div>
                <div className="text-[10px] text-[#77827c] uppercase font-mono font-semibold">Seu XP na Semana</div>
                <div className="text-lg font-bold text-[#55e6b5] font-mono">{currentStudentWeeklyXP.toLocaleString('pt-BR')} XP</div>
              </div>
            </div>

            <div className="p-4 bg-[#111715] border border-[#27322d] rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#251a24] border border-[#b7a0ff]/30 flex items-center justify-center text-[#b7a0ff]">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-[#77827c] uppercase font-mono font-semibold">1º Colocado na Semana</div>
                <div className="text-sm font-bold text-[#f1f5f3] truncate max-w-[140px]">
                  {rankingData[0]?.name || 'Estudante Athenas'}
                </div>
                <div className="text-[10px] text-[#b7a0ff] font-mono">{rankingData[0]?.totalXp.toLocaleString('pt-BR')} XP</div>
              </div>
            </div>
          </div>

          {/* TOP 3 PODIUM DISPLAY */}
          {rankingData.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              
              {/* 2nd Place (Silver) */}
              <div className="p-5 bg-gradient-to-b from-[#161d20] to-[#111715] border border-[#3b4c59] rounded-2xl flex flex-col items-center text-center space-y-3 relative overflow-hidden shadow-lg">
                <div className="absolute top-3 left-3 text-[10px] font-mono font-bold text-[#c0c0c0] bg-[#1d272f] px-2 py-0.5 rounded border border-[#3b4c59]">
                  2º LUGAR · PRATA
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-[#c0c0c0] bg-[#1d272f] flex items-center justify-center text-[#c0c0c0] mt-3 shadow-md relative">
                  <Medal className="w-8 h-8" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#c0c0c0] text-[#0b0f0e] font-black text-xs flex items-center justify-center">
                    2
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#f1f5f3]">{rankingData[1]?.name}</h3>
                  <div className="text-xs text-[#a5b0aa] font-medium">{rankingData[1]?.turma}</div>
                  <div className="text-[11px] text-[#77827c] flex items-center justify-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#77827c]" />
                    <span>{rankingData[1]?.cidade}</span>
                  </div>
                </div>
                <div className="px-3 py-1 bg-[#1d272f] border border-[#3b4c59] rounded-xl text-xs font-bold text-[#c0c0c0] font-mono">
                  {rankingData[1]?.totalXp.toLocaleString('pt-BR')} XP Semanal
                </div>
              </div>

              {/* 1st Place (Gold Crown) */}
              <div className="p-5 bg-gradient-to-b from-[#241e12] via-[#171a15] to-[#111715] border-2 border-[#e4bf74] rounded-2xl flex flex-col items-center text-center space-y-3 relative overflow-hidden shadow-[0_0_25px_rgba(228,191,116,0.15)] transform md:-translate-y-2">
                <div className="absolute top-3 left-3 text-[10px] font-mono font-bold text-[#e4bf74] bg-[#332716] px-2 py-0.5 rounded border border-[#e4bf74]/40">
                  👑 1º LUGAR · OURO
                </div>
                <div className="w-20 h-20 rounded-full border-3 border-[#e4bf74] bg-[#332716] flex items-center justify-center text-[#e4bf74] mt-3 shadow-xl relative animate-pulse-slow">
                  <Crown className="w-10 h-10" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#e4bf74] text-[#0b0f0e] font-black text-xs flex items-center justify-center shadow">
                    1
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#fff6d6] tracking-wide">{rankingData[0]?.name}</h3>
                  <div className="text-xs text-[#d6b570] font-semibold">{rankingData[0]?.turma}</div>
                  <div className="text-[11px] text-[#a5b0aa] flex items-center justify-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#d6b570]" />
                    <span>{rankingData[0]?.cidade}</span>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-[#332716] border border-[#e4bf74]/50 rounded-xl text-sm font-black text-[#e4bf74] font-mono shadow-md">
                  {rankingData[0]?.totalXp.toLocaleString('pt-BR')} XP Semanal
                </div>
              </div>

              {/* 3rd Place (Bronze) */}
              <div className="p-5 bg-gradient-to-b from-[#201814] to-[#111715] border border-[#593e33] rounded-2xl flex flex-col items-center text-center space-y-3 relative overflow-hidden shadow-lg">
                <div className="absolute top-3 left-3 text-[10px] font-mono font-bold text-[#cd7f32] bg-[#2d1e17] px-2 py-0.5 rounded border border-[#593e33]">
                  3º LUGAR · BRONZE
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-[#cd7f32] bg-[#2d1e17] flex items-center justify-center text-[#cd7f32] mt-3 shadow-md relative">
                  <Medal className="w-8 h-8" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#cd7f32] text-[#0b0f0e] font-black text-xs flex items-center justify-center">
                    3
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#f1f5f3]">{rankingData[2]?.name}</h3>
                  <div className="text-xs text-[#a5b0aa] font-medium">{rankingData[2]?.turma}</div>
                  <div className="text-[11px] text-[#77827c] flex items-center justify-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#77827c]" />
                    <span>{rankingData[2]?.cidade}</span>
                  </div>
                </div>
                <div className="px-3 py-1 bg-[#2d1e17] border border-[#593e33] rounded-xl text-xs font-bold text-[#cd7f32] font-mono">
                  {rankingData[2]?.totalXp.toLocaleString('pt-BR')} XP Semanal
                </div>
              </div>

            </div>
          )}

          {/* CONTROLS BAR: Search + Filters + Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#111715] border border-[#27322d] rounded-2xl">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#77827c] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome do aluno, turma ou cidade..."
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                className="w-full bg-[#0b0f0e] border border-[#27322d] focus:border-[#55e6b5] rounded-xl pl-9 pr-3 py-2 text-xs text-[#f1f5f3] placeholder-[#77827c] outline-none transition-all"
              />
              {rankingSearch && (
                <button 
                  onClick={() => setRankingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77827c] hover:text-[#f1f5f3]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#0b0f0e] border border-[#27322d] rounded-xl shrink-0">
              <button
                onClick={() => setRankingFilterTab('all')}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                  rankingFilterTab === 'all'
                    ? 'bg-[#171e1b] text-[#55e6b5] border border-[#55e6b5]/20'
                    : 'text-[#77827c] hover:text-[#a5b0aa]'
                }`}
              >
                Geral (Plataforma)
              </button>
              <button
                onClick={() => setRankingFilterTab('turma')}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                  rankingFilterTab === 'turma'
                    ? 'bg-[#171e1b] text-[#55e6b5] border border-[#55e6b5]/20'
                    : 'text-[#77827c] hover:text-[#a5b0aa]'
                }`}
              >
                Minha Turma ({userTurma || '8º Ano'})
              </button>
              <button
                onClick={() => setRankingFilterTab('top10')}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                  rankingFilterTab === 'top10'
                    ? 'bg-[#171e1b] text-[#55e6b5] border border-[#55e6b5]/20'
                    : 'text-[#77827c] hover:text-[#a5b0aa]'
                }`}
              >
                Top 10
              </button>
            </div>

            {/* Actions: Refresh */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchRankingData}
                disabled={isLoadingRanking}
                className="px-3 py-2 bg-[#171e1b] border border-[#27322d] hover:border-[#55e6b5] rounded-xl text-xs text-[#a5b0aa] hover:text-[#f1f5f3] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Atualizar dados do ranking"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRanking ? 'animate-spin text-[#55e6b5]' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>

          </div>

          {/* BANNER IF STUDENT IS IN TOP 30 */}
          {isCurrentStudentInTop30 && (
            <div className="p-3.5 bg-[#17241e] border border-[#55e6b5]/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#55e6b5] shrink-0" />
                <span>
                  Parabéns! Você está classificado no <strong className="text-[#55e6b5]">Top do Ranking Semanal</strong> na posição <strong className="text-[#e4bf74]">#{currentStudentRankNumber}º</strong> com {currentStudentWeeklyXP.toLocaleString('pt-BR')} XP acumulados nesta semana!
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#55e6b5] bg-[#55e6b5]/10 px-2 py-1 rounded border border-[#55e6b5]/20 shrink-0">
                Ranking Semanal
              </span>
            </div>
          )}

          {/* MAIN RANKING TABLE (REAL ACCOUNTS ONLY) */}
          <div className="bg-[#111715] border border-[#27322d] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#27322d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#f1f5f3]">
                  Tabela Oficial do Ranking Semanal
                </h3>
                <p className="text-[11px] text-[#77827c]">
                  Contas reais ativas na rede · Fechamento nos domingos às 18:00 (Brasília)
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#a5b0aa] bg-[#171e1b] px-2.5 py-1 rounded-md border border-[#27322d]">
                {rankingData.length} {rankingData.length === 1 ? 'Aluno Cadastrado' : 'Alunos Reais Cadastrados'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#27322d] bg-[#0e1311] text-[10px] uppercase font-mono font-bold text-[#77827c] tracking-wider">
                    <th className="py-3 px-4 w-16 text-center">Posição</th>
                    <th className="py-3 px-4">Aluno</th>
                    <th className="py-3 px-4">Ano / Turma</th>
                    <th className="py-3 px-4">Cidade / UF</th>
                    <th className="py-3 px-4 text-right">XP Semanal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27322d]/60 text-xs font-sans">
                  {top30RankingList.map((st) => {
                    const rankNum = st.rank || 1;
                    const isTop1 = rankNum === 1;
                    const isTop2 = rankNum === 2;
                    const isTop3 = rankNum === 3;
                    const isMe = st.isCurrentUser || st.email === cleanEmail;

                    return (
                      <tr
                        key={st.id}
                        className={`transition-all duration-150 ${
                          isMe
                            ? 'bg-[#182620] hover:bg-[#1f332b] font-semibold border-l-4 border-l-[#55e6b5]'
                            : isTop1
                            ? 'bg-[#1e1a12]/40 hover:bg-[#252017]'
                            : 'hover:bg-[#171e1b]'
                        }`}
                      >
                        {/* Rank Badge */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center">
                            {isTop1 ? (
                              <div className="w-8 h-8 rounded-full bg-[#332716] border border-[#e4bf74] text-[#e4bf74] font-black text-xs flex items-center justify-center gap-0.5 shadow">
                                <Crown className="w-3.5 h-3.5" />
                                <span>1</span>
                              </div>
                            ) : isTop2 ? (
                              <div className="w-8 h-8 rounded-full bg-[#1d272f] border border-[#c0c0c0] text-[#c0c0c0] font-black text-xs flex items-center justify-center gap-0.5 shadow">
                                <Medal className="w-3.5 h-3.5" />
                                <span>2</span>
                              </div>
                            ) : isTop3 ? (
                              <div className="w-8 h-8 rounded-full bg-[#2d1e17] border border-[#cd7f32] text-[#cd7f32] font-black text-xs flex items-center justify-center gap-0.5 shadow">
                                <Medal className="w-3.5 h-3.5" />
                                <span>3</span>
                              </div>
                            ) : (
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                                isMe ? 'bg-[#55e6b5] text-[#0b0f0e]' : 'bg-[#171e1b] text-[#77827c] border border-[#27322d]'
                              }`}>
                                #{rankNum}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Student Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isMe
                                ? 'bg-[#55e6b5] text-[#0b0f0e]'
                                : isTop1
                                ? 'bg-[#e4bf74] text-[#0b0f0e]'
                                : 'bg-[#232d27] text-[#a5b0aa] border border-[#27322d]'
                            }`}>
                              {st.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={isMe ? 'text-[#55e6b5] font-bold' : 'text-[#f1f5f3]'}>
                                {st.name}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 bg-[#55e6b5]/20 text-[#55e6b5] border border-[#55e6b5]/30 text-[9px] font-extrabold uppercase rounded">
                                  VOCÊ
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Grade / Turma */}
                        <td className="py-3 px-4 text-[#a5b0aa] font-medium">
                          {st.turma}
                        </td>

                        {/* City / UF */}
                        <td className="py-3 px-4 text-[#77827c]">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#77827c]" />
                            <span>{st.cidade}</span>
                          </div>
                        </td>

                        {/* Weekly XP */}
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                            st.totalXp < 0
                              ? 'bg-[#381419] text-[#ff6e78] border border-[#ff6e78]/40 shadow-sm'
                              : isTop1
                              ? 'bg-[#332716] text-[#e4bf74] border border-[#e4bf74]/40'
                              : isMe
                              ? 'bg-[#1b3d30] text-[#55e6b5] border border-[#55e6b5]/40'
                              : 'bg-[#171e1b] text-[#a5b0aa] border border-[#27322d]'
                          }`}>
                            {st.totalXp.toLocaleString('pt-BR')} XP
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* FLOATING / STICKY "GOMINHA" FOR LOGGED-IN STUDENT IF NOT IN TOP 30 */}
          {!isCurrentStudentInTop30 && currentStudentRankItem && (
            <div className={`p-4 bg-gradient-to-r ${currentStudentWeeklyXP < 0 ? 'from-[#251216] via-[#111715] to-[#251216] border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'from-[#182620] via-[#111715] to-[#182620] border-2 border-[#55e6b5] shadow-[0_0_20px_rgba(85,230,181,0.15)]'} rounded-2xl space-y-3`}>
              <div className="flex items-center justify-between border-b border-[#27322d] pb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${currentStudentWeeklyXP < 0 ? 'bg-rose-500' : 'bg-[#55e6b5]'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${currentStudentWeeklyXP < 0 ? 'text-rose-400' : 'text-[#55e6b5]'}`}>
                    {currentStudentWeeklyXP < 0 ? 'Sua Posição Oficial no Ranking (Em Débito)' : 'Sua Posição Oficial no Ranking Semanal'}
                  </span>
                </div>
                <span className="text-xs text-[#a5b0aa] font-mono">
                  Sua Posição: <b className="text-[#f1f5f3] font-extrabold">#{currentStudentRankNumber}º Lugar</b>
                </span>
              </div>

              {/* Exact Gominha Row matching table layout */}
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 ${currentStudentWeeklyXP < 0 ? 'bg-[#251317] border border-rose-500/30' : 'bg-[#17251f] border border-[#55e6b5]/30'} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl ${currentStudentWeeklyXP < 0 ? 'bg-rose-500 text-white' : 'bg-[#55e6b5] text-[#0b0f0e]'} font-black text-xs flex items-center justify-center font-mono shadow`}>
                    #{currentStudentRankNumber}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[#f1f5f3]">
                        {currentStudentRankItem.name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded ${currentStudentWeeklyXP < 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-[#55e6b5]/20 text-[#55e6b5] border border-[#55e6b5]/30'}`}>
                        VOCÊ
                      </span>
                    </div>
                    <div className="text-xs text-[#a5b0aa] flex flex-wrap items-center gap-2 mt-0.5">
                      <span>{currentStudentRankItem.turma}</span>
                      <span>·</span>
                      <span className="text-[#77827c]">{currentStudentRankItem.cidade}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <div className={`text-xs font-mono font-bold ${currentStudentWeeklyXP < 0 ? 'text-rose-400' : 'text-[#55e6b5]'}`}>
                      {currentStudentWeeklyXP.toLocaleString('pt-BR')} XP {currentStudentWeeklyXP < 0 ? '(Negativado)' : ''}
                    </div>
                    <div className="text-[10px] text-[#77827c]">{currentStudentWeeklyXP < 0 ? 'Saldo Devedor' : 'XP Semanal'}</div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-[#77827c] text-center pt-1">
                Suba posições no ranking resolvendo simulados, tirando dúvidas com a Athenas IA e mantendo sua sequência de estudos!
              </div>
            </div>
          )}

        </motion.div>
      )}

      {/* Footer */}
      <footer className="pt-6 text-center text-[10px] text-[#58635d]">
        Métricas, Ranking Semanal e XP calculados com base estrita nos dados reais da rede. WSM Athenas Plataforma Educacional.
      </footer>

    </div>
  );
}
