import React, { useState, useEffect, useMemo } from 'react';
import { CustomDatePicker } from './CustomDatePicker';
import PersonalQuestionBankModal from './PersonalQuestionBankModal';
import { 
  ClipboardList, 
  BarChart3, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw, 
  Clock, 
  Eye, 
  BookOpen, 
  Users,
  Calendar,
  Sparkles,
  FileText,
  Search,
  Check,
  HelpCircle,
  X,
  ArrowRightLeft,
  Edit3,
  ChevronDown,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  ArrowRight,
  Layers,
  FileCheck,
  Bookmark,
  Copy
} from 'lucide-react';
import { supabase } from '../supabase';
import { MockExam, MockExamQuestion, MockSubmission } from '../types';
import { parseExamSettings, serializeExamDescription, MockExamSettings, ExamMode } from '../utils/examSettings';
import { parseExamTargets, matchesStudentTarget, formatTargetDisplayName } from '../utils/targetMatcher';

// Template suggestions to speed up simulator creation (Athenas AI assist mockup)
const templateExams = [
  {
    title: "Simulado de Algoritmos Básicos",
    description: "Conteúdo focado em raciocínio lógico, estruturas condicionais e laços de repetição (for/while).",
    questions: [
      {
        id: 'temp-1',
        type: 'multiple' as const,
        text: "O que representa o operador lógico '&&' em linguagens como JavaScript, Java e C++?",
        options: ["Operação lógica OU (disjunção)", "Operação lógica E (conjunção)", "Operação de negação", "Atribuição de valor nulo"],
        correctOption: 1,
        explanation: "O operador && representa a operação lógica E, onde ambas as condições precisam ser verdadeiras."
      }
    ]
  },
  {
    title: "Simulado de Modelagem de Dados",
    description: "Exercício sobre relacionamentos, Cardinalidade, 1NF, 2NF e 3NF (Formas Normais).",
    questions: [
      {
        id: 'temp-2',
        type: 'multiple' as const,
        text: "Qual das seguintes afirmações melhor define o conceito de uma Chave Estrangeira (Foreign Key)?",
        options: [
          "Um identificador único exclusivo de cada linha que não pode ser duplicado.",
          "Um atributo em uma tabela que estabelece ligação direta com a Chave Primária de outra tabela.",
          "Uma chave de segurança usada para criptografar as faturas bancárias.",
          "Um índice que serve unicamente para acelerar as consultas SELECT no banco."
        ],
        correctOption: 1,
        explanation: "A chave estrangeira aponta para a chave primária de outra tabela, unindo os registros entre elas."
      },
      {
        id: 'temp-3',
        type: 'written' as const,
        text: "Explique sucintamente qual é o principal objetivo da Terceira Forma Normal (3NF) em um Banco de Dados Relacional."
      }
    ]
  }
];

interface TeacherSimuladosProps {
  email: string;
  teacherName: string;
  teacherSubject: string;
  availableClasses: string[];
  onDataChange?: () => void;
}

export default function TeacherSimulados({ 
  email, 
  teacherName, 
  teacherSubject, 
  availableClasses,
  onDataChange
}: TeacherSimuladosProps) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'drafts' | 'create' | 'results'>('list');

  // Online Simulados list
  const [simulados, setSimulados] = useState<MockExam[]>([]);

  // Split simulados into published vs drafts
  const publishedSimulados = useMemo(() => {
    return simulados.filter(sim => {
      const { settings } = parseExamSettings(sim.description || '');
      return !settings.is_draft;
    });
  }, [simulados]);

  const draftSimulados = useMemo(() => {
    return simulados.filter(sim => {
      const { settings } = parseExamSettings(sim.description || '');
      return settings.is_draft === true;
    });
  }, [simulados]);

  // Filter state for bottom drawer in creation wizard
  const [bottomDrawerFilter, setBottomDrawerFilter] = useState<'all' | 'published' | 'drafts'>('all');

  const filteredBottomSimulados = useMemo(() => {
    if (bottomDrawerFilter === 'published') return publishedSimulados;
    if (bottomDrawerFilter === 'drafts') return draftSimulados;
    return simulados;
  }, [bottomDrawerFilter, publishedSimulados, draftSimulados, simulados]);
  const [submissions, setSubmissions] = useState<MockSubmission[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [virtualClasses, setVirtualClasses] = useState<any[]>([]);

  // Filtering states for Results tab
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<MockSubmission | null>(null);
  const [expandedTimelineEmail, setExpandedTimelineEmail] = useState<string | null>(null);
  const [resultsSearchTerm, setResultsSearchTerm] = useState<string>('');
  const [resultsClassFilter, setResultsClassFilter] = useState<string>('');
  const [studentReportSearchTerm, setStudentReportSearchTerm] = useState<string>('');

  // Deduplicated official classes for filters and selectors
  const uniqueOfficialClasses = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    (availableClasses || []).forEach(cls => {
      if (!cls || typeof cls !== 'string') return;
      const trimmed = cls.trim();
      const norm = trimmed.toLowerCase();
      if (trimmed && !seen.has(norm)) {
        seen.add(norm);
        list.push(trimmed);
      }
    });
    return list;
  }, [availableClasses]);

  // Deduplicated virtual classes by name for filters and selectors
  const uniqueVirtualClassesForFilter = useMemo(() => {
    const list: { id: string; name: string; allIds: string[] }[] = [];

    (virtualClasses || []).forEach((vc: any) => {
      if (!vc || !vc.name) return;
      const normName = String(vc.name).trim().toLowerCase();
      if (!normName) return;

      const existing = list.find(item => item.name.trim().toLowerCase() === normName);
      if (existing) {
        if (vc.id && !existing.allIds.includes(vc.id)) {
          existing.allIds.push(vc.id);
        }
      } else {
        list.push({
          id: vc.id || vc.name,
          name: String(vc.name).trim(),
          allIds: vc.id ? [vc.id] : []
        });
      }
    });

    return list;
  }, [virtualClasses]);

  // Auto-initialize selectedClass when availableClasses or virtualClasses are loaded
  useEffect(() => {
    if (!selectedClass) {
      if (availableClasses && availableClasses.length > 0) {
        setSelectedClass(availableClasses[0]);
      } else if (virtualClasses && virtualClasses.length > 0) {
        setSelectedClass(virtualClasses[0].id);
      }
    }
  }, [availableClasses, virtualClasses, selectedClass]);

  // Step-by-Step Wizard form state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Multi-target selection states
  const [selectedTargetClasses, setSelectedTargetClasses] = useState<string[]>(
    availableClasses.length > 0 ? [availableClasses[0]] : []
  );
  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [roomSearchTerm, setRoomSearchTerm] = useState<string>('');
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState<boolean>(false);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState<boolean>(false);
  const [activeQuestionTab, setActiveQuestionTab] = useState<'manual' | 'enem'>('manual');
  const [studentRoomFilter, setStudentRoomFilter] = useState<string>('ALL');

  // Simulado Creator form state
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [simTitle, setSimTitle] = useState('');
  const [simDescription, setSimDescription] = useState('');
  const [simSubject, setSimSubject] = useState(teacherSubject || 'Biologia');
  const [simDuration, setSimDuration] = useState<number | ''>('');
  const [simClass, setSimClass] = useState(availableClasses[0] || '');

  // Keep simSubject updated if teacherSubject prop changes and simSubject was empty/default
  useEffect(() => {
    if (teacherSubject) {
      setSimSubject(teacherSubject);
    }
  }, [teacherSubject]);
  const [simDeadline, setSimDeadline] = useState('');
  const [questions, setQuestions] = useState<MockExamQuestion[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [examMode, setExamMode] = useState<ExamMode>('normal');
  const isControlled = examMode === 'controlled';

  // Auto-sync simClass string from selected target classes & students
  useEffect(() => {
    const combined = [...selectedTargetClasses, ...selectedTargetStudents].filter(Boolean);
    setSimClass(combined.join(', '));
  }, [selectedTargetClasses, selectedTargetStudents]);

  // Student Extra Time state
  const [extraTimeStudent, setExtraTimeStudent] = useState<{ email: string; name: string } | null>(null);
  const [extraMinutesInput, setExtraMinutesInput] = useState<number>(10);
  const [isSavingExtraTime, setIsSavingExtraTime] = useState(false);

  // Question Creator state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qType, setQType] = useState<'multiple' | 'written'>('multiple');
  const [qCorrectionType, setQCorrectionType] = useState<'manual' | 'ai'>('manual');
  const [qExpectedAnswer, setQExpectedAnswer] = useState('');
  const [qText, setQText] = useState('');
  const [qPoints, setQPoints] = useState<number>(1.0);
  const [qImages, setQImages] = useState<string[]>([]);
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState<number>(0);
  const [qExplanation, setQExplanation] = useState('');

  // Personal Question Bank modal state & deduplication
  const [isPersonalBankOpen, setIsPersonalBankOpen] = useState(false);

  const personalQuestions = useMemo(() => {
    const result: MockExamQuestion[] = [];
    const seenTexts = new Set<string>();

    simulados.forEach((sim, simIdx) => {
      let qList: MockExamQuestion[] = [];
      if (Array.isArray(sim.questions)) {
        qList = sim.questions;
      } else if (typeof sim.questions === 'string') {
        try {
          qList = JSON.parse(sim.questions);
        } catch {
          qList = [];
        }
      }

      qList.forEach((q, qIdx) => {
        if (!q || !q.text || !q.text.trim()) return;
        const normText = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!seenTexts.has(normText)) {
          seenTexts.add(normText);
          result.push({
            ...q,
            id: q.id || `pers-${simIdx}-${qIdx}`
          });
        }
      });
    });

    templateExams.forEach((temp, tempIdx) => {
      temp.questions.forEach((q, qIdx) => {
        if (!q || !q.text || !q.text.trim()) return;
        const normText = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!seenTexts.has(normText)) {
          seenTexts.add(normText);
          result.push({
            ...q,
            id: q.id || `temp-${tempIdx}-${qIdx}`
          });
        }
      });
    });

    return result;
  }, [simulados]);

  const handleImportQuestionFromBank = (q: MockExamQuestion) => {
    setQuestions(prev => {
      const norm = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
      const exists = prev.some(item => item.text && item.text.trim().toLowerCase().replace(/\s+/g, ' ') === norm);
      if (exists) return prev;
      return [...prev, { ...q, id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }];
    });
    setSuccessMsg("Questão do seu Banco Pessoal importada com sucesso!");
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleImportMultipleQuestionsFromBank = (importedList: MockExamQuestion[]) => {
    setQuestions(prev => {
      const existingNorms = new Set(prev.map(item => item.text ? item.text.trim().toLowerCase().replace(/\s+/g, ' ') : ''));
      const toAdd = importedList.filter(q => q && q.text && !existingNorms.has(q.text.trim().toLowerCase().replace(/\s+/g, ' ')));
      const mappedToAdd = toAdd.map((q, idx) => ({
        ...q,
        id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      }));
      return [...prev, ...mappedToAdd];
    });
    setSuccessMsg(`${importedList.length} questão(ões) do seu Banco Pessoal importada(s) com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // View mode for ENEM search and student preview
  const [viewMode, setViewMode] = useState<'normal' | 'enem-search' | 'preview-student'>('normal');
  const [activePreviewExam, setActivePreviewExam] = useState<MockExam | null>(null);
  const [selectedEnemQuestions, setSelectedEnemQuestions] = useState<MockExamQuestion[]>([]);

  // ENEM API search states
  const [enemYears, setEnemYears] = useState<number[]>([]);
  const [enemQuestions, setEnemQuestions] = useState<any[]>([]);
  const [loadingEnemYears, setLoadingEnemYears] = useState(false);
  const [loadingEnemQuestions, setLoadingEnemQuestions] = useState(false);

  // Filters
  const [selectedEnemYear, setSelectedEnemYear] = useState<string>(''); // empty means all or top 4
  const [selectedEnemDiscipline, setSelectedEnemDiscipline] = useState<string>('');
  const [enemSearchTerm, setEnemSearchTerm] = useState<string>('');
  const [enemError, setEnemError] = useState<string>('');
  const [enemPageSize, setEnemPageSize] = useState<number>(10);

  // Save form fields to localStorage (only for new draft creations, not when editing existing exams)
  useEffect(() => {
    if (activeSubTab === 'create' && !editingExamId) {
      localStorage.setItem('athenas_sim_title', simTitle);
      localStorage.setItem('athenas_sim_desc', simDescription);
      localStorage.setItem('athenas_sim_duration', String(simDuration));
      localStorage.setItem('athenas_sim_class', simClass);
      localStorage.setItem('athenas_sim_target_classes', JSON.stringify(selectedTargetClasses));
      localStorage.setItem('athenas_sim_target_students', JSON.stringify(selectedTargetStudents));
      localStorage.setItem('athenas_sim_deadline', simDeadline);
      localStorage.setItem('athenas_sim_questions', JSON.stringify(questions));
      localStorage.setItem('athenas_sim_qtext', qText);
      localStorage.setItem('athenas_sim_qexplanation', qExplanation);
      localStorage.setItem('athenas_sim_qoptions', JSON.stringify(qOptions));
      localStorage.setItem('athenas_sim_qcorrectindex', String(qCorrectIndex));
      localStorage.setItem('athenas_sim_qtype', qType);
    }
  }, [simTitle, simDescription, simDuration, simClass, simDeadline, questions, qText, qExplanation, qOptions, qCorrectIndex, qType, activeSubTab, editingExamId]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedTitle = localStorage.getItem('athenas_sim_title');
    if (savedTitle !== null) setSimTitle(savedTitle);
    const savedDesc = localStorage.getItem('athenas_sim_desc');
    if (savedDesc !== null) setSimDescription(savedDesc);
    const savedDur = localStorage.getItem('athenas_sim_duration');
    if (savedDur !== null && savedDur !== '') setSimDuration(Number(savedDur));
    const savedClass = localStorage.getItem('athenas_sim_class');
    if (savedClass !== null) setSimClass(savedClass);
    const savedDeadline = localStorage.getItem('athenas_sim_deadline');
    if (savedDeadline !== null) setSimDeadline(savedDeadline);

    const savedQs = localStorage.getItem('athenas_sim_questions');
    if (savedQs !== null) {
      try {
        setQuestions(JSON.parse(savedQs));
      } catch (e) {}
    }
    const savedQText = localStorage.getItem('athenas_sim_qtext');
    if (savedQText !== null) setQText(savedQText);
    const savedQExplanation = localStorage.getItem('athenas_sim_qexplanation');
    if (savedQExplanation !== null) setQExplanation(savedQExplanation);

    const savedQOptions = localStorage.getItem('athenas_sim_qoptions');
    if (savedQOptions !== null) {
      try {
        setQOptions(JSON.parse(savedQOptions));
      } catch (e) {}
    }
    const savedQCorrect = localStorage.getItem('athenas_sim_qcorrectindex');
    if (savedQCorrect !== null) setQCorrectIndex(Number(savedQCorrect));
    const savedQType = localStorage.getItem('athenas_sim_qtype');
    if (savedQType === 'multiple' || savedQType === 'written') setQType(savedQType);
  }, []);

  // Load ENEM years
  const fetchEnemYears = async () => {
    setLoadingEnemYears(true);
    setEnemError('');
    try {
      const response = await fetch('https://api.enem.dev/v1/exams');
      if (!response.ok) throw new Error('Erro ao carregar anos do ENEM');
      const exams = await response.json();
      const years = exams.map((exam: any) => exam.year).sort((a: number, b: number) => b - a);
      setEnemYears(years);
    } catch (err: any) {
      console.error('Erro ao carregar anos do ENEM:', err);
      setEnemYears([2023, 2022, 2021, 2020, 2019]);
    } finally {
      setLoadingEnemYears(false);
    }
  };

  // Load ENEM questions
  const searchEnemQuestions = async () => {
    setLoadingEnemQuestions(true);
    setEnemError('');
    setEnemPageSize(10); // Reset page size to 10 on new search
    try {
      let yearsToSearch = selectedEnemYear ? [Number(selectedEnemYear)] : (enemYears.length > 0 ? enemYears.slice(0, 4) : [2023, 2022, 2021, 2020]);
      
      const allFetched: any[] = [];
      const limit = 50;

      // Robust normalization helper
      const normalizeStr = (str: any): string => {
        if (str === null || str === undefined) return '';
        return String(str)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove accents
          .trim();
      };

      // Helper to match disciplines robustly
      const isDisciplineMatch = (val: string, target: string): boolean => {
        if (!val || !target) return false;
        const sanitize = (s: string) => s.replace(/[-_ \s]/g, '');
        const sVal = sanitize(val);
        const sTarget = sanitize(target);
        return sVal.includes(sTarget) || sTarget.includes(sVal);
      };

      // Helper to recursively search for keyword in all text properties of a question
      const searchInVal = (val: any, term: string): boolean => {
        if (!val) return false;
        if (typeof val === 'string') {
          return normalizeStr(val).includes(term);
        }
        if (typeof val === 'number') {
          return String(val).includes(term);
        }
        if (Array.isArray(val)) {
          return val.some(item => searchInVal(item, term));
        }
        if (typeof val === 'object') {
          return Object.values(val).some(item => searchInVal(item, term));
        }
        return false;
      };

      await Promise.all(yearsToSearch.map(async (year) => {
        try {
          let offset = 0;
          let hasMore = true;
          let pageCount = 0;
          
          while (hasMore && pageCount < 5) {
            const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${limit}&offset=${offset}`;
            const response = await fetch(url);
            if (!response.ok) break;
            const data = await response.json();
            
            let questionsList: any[] = [];
            if (data) {
              if (Array.isArray(data)) {
                questionsList = data;
              } else if (Array.isArray(data.questions)) {
                questionsList = data.questions;
              } else if (Array.isArray(data.data)) {
                questionsList = data.data;
              } else {
                // Safely search for any array property, excluding image or file lists
                const foundArray = Object.entries(data).find(([key, val]) => Array.isArray(val) && key !== 'files' && key !== 'images' && key !== 'languages');
                if (foundArray) {
                  questionsList = foundArray[1] as any[];
                }
              }
            }

            const filtered = questionsList.map((q: any) => {
              if (!q.year) {
                return { ...q, year: year };
              }
              return q;
            }).filter((q: any) => {
              const qDiscipline = normalizeStr(q.discipline);
              const qSubject = normalizeStr(q.subject);
              const qArea = normalizeStr(q.area);
              const targetDiscipline = normalizeStr(selectedEnemDiscipline);

              const matchDiscipline = !selectedEnemDiscipline || 
                isDisciplineMatch(qDiscipline, targetDiscipline) ||
                isDisciplineMatch(qSubject, targetDiscipline) ||
                isDisciplineMatch(qArea, targetDiscipline);
                
              const matchKeyword = !enemSearchTerm || searchInVal(q, normalizeStr(enemSearchTerm));
              
              return matchDiscipline && matchKeyword;
            });

            allFetched.push(...filtered);
            hasMore = data.metadata?.hasMore || false;
            offset += limit;
            pageCount++;
          }
        } catch (e) {
          console.warn(`Erro ao buscar ano ${year}:`, e);
        }
      }));

      allFetched.sort((a, b) => {
        const yearA = Number(a.year) || 0;
        const yearB = Number(b.year) || 0;
        if (yearB !== yearA) return yearB - yearA;
        
        const indexA = Number(a.index) || 0;
        const indexB = Number(b.index) || 0;
        return indexA - indexB;
      });

      setEnemQuestions(allFetched);
      if (allFetched.length === 0) {
        setEnemError('Nenhuma questão encontrada com estes critérios de busca.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar questões:', err);
      setEnemError('Ocorreu um erro ao carregar as questões do ENEM. Verifique sua conexão e tente novamente.');
    } finally {
      setLoadingEnemQuestions(false);
    }
  };

  const handleToggleSelectEnem = (q: any) => {
    const isSelected = selectedEnemQuestions.some(item => item.id === `enem-${q.year}-${q.index}`);
    if (isSelected) {
      setSelectedEnemQuestions(prev => prev.filter(item => item.id !== `enem-${q.year}-${q.index}`));
    } else {
      const correctOptionIndex = q.alternatives 
        ? q.alternatives.findIndex((alt: any) => alt.isCorrect) 
        : -1;
      const finalCorrectOption = correctOptionIndex !== -1 
        ? correctOptionIndex 
        : ['A', 'B', 'C', 'D', 'E'].indexOf((q.correctAlternative || '').toUpperCase());

      // Extract images safely
      const extractedImages: string[] = [];
      const resolveEnemImageUrl = (url: string) => {
        if (!url) return '';
        url = url.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
        }
        if (url.startsWith('/')) {
          return `https://enem.dev${url}`;
        }
        return `https://enem.dev/${url}`;
      };

      if (Array.isArray(q.files)) {
        q.files.forEach((f: any) => {
          if (typeof f === 'string' && f.trim().length > 0) {
            extractedImages.push(resolveEnemImageUrl(f));
          } else if (f && typeof f === 'object' && f.url) {
            extractedImages.push(resolveEnemImageUrl(f.url));
          } else if (f && typeof f === 'object' && f.path) {
            extractedImages.push(resolveEnemImageUrl(f.path));
          }
        });
      }
      if (typeof q.file === 'string' && q.file.trim().length > 0) {
        extractedImages.push(resolveEnemImageUrl(q.file));
      }
      if (Array.isArray(q.images)) {
        q.images.forEach((img: any) => {
          if (typeof img === 'string') {
            extractedImages.push(resolveEnemImageUrl(img));
          } else if (img && img.url) {
            extractedImages.push(resolveEnemImageUrl(img.url));
          }
        });
      }

      // Check text / context for embedded images (including .jpg, .png, etc.)
      const imageRegex = /(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))/gi;
      const scanTextForImages = (textToScan: string) => {
        if (!textToScan) return;
        const matches = textToScan.match(imageRegex);
        if (matches) {
          matches.forEach(url => {
            const resolved = resolveEnemImageUrl(url);
            if (resolved && !extractedImages.includes(resolved)) {
              extractedImages.push(resolved);
            }
          });
        }
      };

      if (q.context) scanTextForImages(q.context);
      if (q.text) scanTextForImages(q.text);

      // Construct final text and clean up embedded image URLs so they are not rendered twice or as plain text
      let cleanedContext = q.context || '';
      let cleanedText = q.text || '';

      const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)/gi;
      const parenthesizedUrlRegex = /\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)/gi;
      const rawUrlRegex = /https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)/gi;

      cleanedContext = cleanedContext
        .replace(markdownImageRegex, '')
        .replace(parenthesizedUrlRegex, '')
        .replace(rawUrlRegex, '');

      cleanedText = cleanedText
        .replace(markdownImageRegex, '')
        .replace(parenthesizedUrlRegex, '')
        .replace(rawUrlRegex, '');

      const finalQuestionText = [cleanedContext, cleanedText]
        .filter(Boolean)
        .map(t => t.trim())
        .join('\n\n') || `Questão ${q.index} - ENEM ${q.year}`;

      const newQ: MockExamQuestion = {
        id: `enem-${q.year}-${q.index}`,
        type: 'multiple',
        text: finalQuestionText,
        imageUrl: extractedImages[0] || undefined,
        imageUrls: extractedImages.length > 0 ? extractedImages : undefined,
        options: q.alternatives ? q.alternatives.map((alt: any) => alt.text || '') : [],
        correctOption: finalCorrectOption >= 0 ? finalCorrectOption : 0,
        explanation: `Questão do ENEM ${q.year}, caderno oficial.`,
        isEnem: true,
        enemYear: q.year
      };
      setSelectedEnemQuestions(prev => [...prev, newQ]);
    }
  };

  const handleConfirmEnemQuestions = () => {
    setQuestions(prev => {
      const existingIds = new Set(prev.map(item => item.id));
      const filteredNew = selectedEnemQuestions.filter(item => !existingIds.has(item.id));
      return [...prev, ...filteredNew];
    });
    const count = selectedEnemQuestions.length;
    setSelectedEnemQuestions([]);
    setViewMode('normal');
    setSuccessMsg(`Sucesso: ${count} questão(ões) selecionada(s) do ENEM foi(ram) adicionada(s) como cadastrada(s) no simulado!`);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    if (qImages.length + files.length > 4) {
      setErrorMsg("Você pode selecionar no máximo 4 imagens por questão.");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setQImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveUploadedImage = (index: number) => {
    setQImages(prev => prev.filter((_, i) => i !== index));
  };

  // Status indicators
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all Simulados and submissions
  const loadData = async () => {
    try {
      // 1. Fetch exams for teacher's own email OR shared classes
      const { data: dbExams, error: errorExams } = await supabase
        .from('wsm_mock_exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (!errorExams && dbExams) {
        const teacherClassesLower = (availableClasses || []).map(a => a.toLowerCase().trim());
        const emailLower = email.toLowerCase().trim();
        const teacherNameLower = (teacherName || '').toLowerCase().trim();
        const teacherSubjectLower = (teacherSubject || 'biologia').toLowerCase().trim();

        const filteredExams = dbExams.filter((exam: any) => {
          const exTeacherEmail = (exam.teacher_email || '').toLowerCase().trim();
          const exTeacherName = (exam.teacher_name || '').toLowerCase().trim();
          const exSubject = (exam.subject || '').toLowerCase().trim();

          if (
            (exTeacherEmail && exTeacherEmail === emailLower) ||
            (emailLower.endsWith('@wsmathenas.com') && exTeacherEmail === emailLower.replace('@wsmathenas.com', '@atenas.com')) ||
            (emailLower.endsWith('@atenas.com') && exTeacherEmail === emailLower.replace('@atenas.com', '@wsmathenas.com'))
          ) {
            return true;
          }

          if (
            teacherNameLower &&
            exTeacherName &&
            (exTeacherName === teacherNameLower || teacherNameLower.includes(exTeacherName) || exTeacherName.includes(teacherNameLower))
          ) {
            return true;
          }

          if (exam.class_name) {
            const { classes } = parseExamTargets(exam.class_name);
            if (classes.some(c => teacherClassesLower.includes(c.toLowerCase().trim()))) {
              return true;
            }
            const rawClassLower = exam.class_name.toLowerCase();
            if (teacherClassesLower.some(tc => tc && (rawClassLower === tc || rawClassLower.includes(tc)))) {
              return true;
            }
          }

          if (
            teacherSubjectLower &&
            exSubject &&
            exSubject === teacherSubjectLower &&
            (!exTeacherEmail || exTeacherEmail === emailLower)
          ) {
            return true;
          }

          return false;
        }).map((exam: any) => {
          let parsedQuestions: MockExamQuestion[] = [];
          if (Array.isArray(exam.questions)) {
            parsedQuestions = exam.questions;
          } else if (typeof exam.questions === 'string') {
            try {
              parsedQuestions = JSON.parse(exam.questions);
            } catch {
              parsedQuestions = [];
            }
          }
          return {
            ...exam,
            questions: parsedQuestions
          };
        });

        setSimulados(filteredExams);
        if (filteredExams.length > 0 && !selectedExamId) {
          setSelectedExamId(filteredExams[0].id);
        }
      }

      // 2. Fetch submissions
      if (dbExams && dbExams.length > 0) {
        const examIds = dbExams.map(ex => ex.id);
        const { data: dbSubs, error: errorSubs } = await supabase
          .from('wsm_mock_submissions')
          .select('*')
          .in('mock_exam_id', examIds)
          .order('submitted_at', { ascending: false });

        if (!errorSubs && dbSubs) {
          const parsedSubs = dbSubs.map(sub => {
            let tel = sub.telemetry;
            if (typeof tel === 'string') {
              try {
                tel = JSON.parse(tel);
              } catch {
                tel = null;
              }
            }
            let mg = sub.manual_grades;
            if (typeof mg === 'string') {
              try {
                mg = JSON.parse(mg);
              } catch {
                mg = null;
              }
            }
            if ((!mg || (typeof mg === 'object' && Object.keys(mg).length === 0)) && tel && typeof tel === 'object' && tel.manual_grades) {
              mg = tel.manual_grades;
            }
            if (typeof mg === 'string') {
              try {
                mg = JSON.parse(mg);
              } catch {
                mg = {};
              }
            }
            return {
              ...sub,
              telemetry: tel,
              manual_grades: mg || {}
            };
          });
          setSubmissions(parsedSubs);
        }
      }

      // 3. Fetch Student profiles to display class lists
      const { data: dbStuds, error: errorStuds } = await supabase
        .from('wsm_user_profiles')
        .select('id, nome_completo, email, turma, numero_chamada')
        .eq('role', 'student')
        .order('nome_completo', { ascending: true });

      if (!errorStuds && dbStuds) {
        setStudents(dbStuds);
      }

      // 4. Fetch virtual classes
      try {
        const { data: dbVCls } = await supabase
          .from('wsm_virtual_classes')
          .select('*')
          .order('name', { ascending: true });
        if (dbVCls) {
          const teacherClassesLower = (availableClasses || []).map(a => a.toLowerCase());
          const myVClasses = dbVCls.filter((vc: any) =>
            (vc.teacher_email && vc.teacher_email.toLowerCase() === email.toLowerCase()) ||
            teacherClassesLower.includes((vc.name || '').toLowerCase()) ||
            teacherClassesLower.includes((vc.id || '').toLowerCase())
          );
          const seenIds = new Set<string>();
          const dedupedVClasses = myVClasses.filter((vc: any) => {
            const key = vc.id || vc.name;
            if (!key || seenIds.has(key)) return false;
            seenIds.add(key);
            return true;
          });
          setVirtualClasses(dedupedVClasses);
        }
      } catch (vcErr) {
        console.warn("Error loading virtual classes in TeacherSimulados:", vcErr);
      }

      // 5. Fetch system logs for security audits
      try {
        const { data: dbLogs } = await supabase
          .from('wsm_system_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (dbLogs) {
          setSystemLogs(dbLogs);
        }
      } catch (logErr) {
        console.warn("Error loading system logs in TeacherSimulados:", logErr);
      }

      try {
        onDataChange?.();
      } catch (notifErr) {
        // ignore callback error
      }
    } catch (err) {
      console.error("Erro ao carregar dados dos simulados no backend:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [email]);

  useEffect(() => {
    if (viewMode === 'enem-search') {
      fetchEnemYears();
    }
  }, [viewMode]);

  // Apply template
  const handleApplyTemplate = (tempIndex: number) => {
    const temp = templateExams[tempIndex];
    setSimTitle(temp.title);
    setSimDescription(temp.description);
    setQuestions(temp.questions);
    setSuccessMsg(`Modelo "${temp.title}" aplicado! Você pode editar agora.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Start editing existing question
  const handleStartEditQuestion = (q: MockExamQuestion) => {
    setEditingQuestionId(q.id);
    setQType(q.type || 'multiple');
    setQText(q.text || '');
    setQPoints(q.points !== undefined ? q.points : 1.0);
    setQImages(q.imageUrls || (q.imageUrl ? [q.imageUrl] : []));
    setQOptions(q.options && q.options.length > 0 ? [...q.options] : ['', '', '', '']);
    setQCorrectIndex(q.correctOption !== undefined ? q.correctOption : 0);
    setQExplanation(q.explanation || '');
    setQCorrectionType(q.correctionType || 'manual');
    setQExpectedAnswer(q.expectedAnswer || '');
    setErrorMsg('');

    const formEl = document.getElementById('question-creator-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Cancel question editing
  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setQText('');
    setQPoints(1.0);
    setQImages([]);
    setQOptions(['', '', '', '']);
    setQCorrectIndex(0);
    setQExplanation('');
    setQCorrectionType('manual');
    setQExpectedAnswer('');
    setErrorMsg('');
  };

  // Add or update question in temporary list
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!qText.trim()) {
      setErrorMsg("O enunciado da questão é obrigatório.");
      return;
    }

    const targetId = editingQuestionId || ("q-" + Math.random().toString(36).substring(2, 9));

    const newQ: MockExamQuestion = {
      id: targetId,
      type: qType,
      text: qText.trim(),
      points: typeof qPoints === 'number' && qPoints > 0 ? qPoints : 1.0,
      imageUrls: qImages, // Store Base64 images array
      explanation: qExplanation.trim() || undefined
    };

    if (qType === 'multiple') {
      const activeOptions = qOptions.map(o => o.trim()).filter(Boolean);
      if (activeOptions.length < 2) {
        setErrorMsg("Por favor, preencha pelo menos duas alternativas para perguntas de múltipla escolha.");
        return;
      }
      const selectedCorrectText = qOptions[qCorrectIndex] ? qOptions[qCorrectIndex].trim() : '';
      const foundIndex = activeOptions.indexOf(selectedCorrectText);
      if (foundIndex === -1) {
        setErrorMsg("A alternativa marcada como Gabarito Correto não pode estar em branco.");
        return;
      }
      newQ.options = activeOptions;
      newQ.correctOption = foundIndex;
    } else if (qType === 'written') {
      newQ.correctionType = qCorrectionType;
      if (qCorrectionType === 'ai') {
        if (!qExpectedAnswer.trim()) {
          setErrorMsg("Ao selecionar Correção Automática por IA, informe o gabarito/resposta esperada para orientar a IA.");
          return;
        }
        newQ.expectedAnswer = qExpectedAnswer.trim();
      }
    }

    if (editingQuestionId) {
      setQuestions(prev => prev.map(q => q.id === editingQuestionId ? { ...q, ...newQ } : q));
      setSuccessMsg("Questão atualizada com sucesso!");
      setEditingQuestionId(null);
    } else {
      setQuestions(prev => [...prev, newQ]);
      setSuccessMsg("Questão adicionada ao simulado!");
    }

    // Reset question form fields
    setQText('');
    setQPoints(1.0);
    setQImages([]);
    setQOptions(['', '', '', '']);
    setQCorrectIndex(0);
    setQExplanation('');
    setQCorrectionType('manual');
    setQExpectedAnswer('');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // Delete question from temporary list
  const handleRemoveQuestion = (qId: string) => {
    if (editingQuestionId === qId) {
      handleCancelEditQuestion();
    }
    setQuestions(prev => prev.filter(q => q.id !== qId));
  };

  // Update question points in draft list
  const handleUpdateQuestionPoints = (qId: string, pts: number) => {
    const validPts = isNaN(pts) || pts <= 0 ? 1.0 : Math.round(pts * 100) / 100;
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, points: validPts } : q));
  };

  // Reorder question in draft list
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    setQuestions(prev => {
      const list = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      return list;
    });
  };

  // Grade written question manually for student submission
  const handleGradeWrittenQuestion = async (
    qId: string,
    status: 'correct' | 'half' | 'wrong',
    qPts: number,
    commentText?: string
  ) => {
    if (!selectedSubmission || !currentExam) return;

    const basePts = qPts > 0 ? qPts : 1.0;
    let pointsAwarded = 0;
    if (status === 'correct') pointsAwarded = basePts;
    else if (status === 'half') pointsAwarded = basePts / 2;
    else if (status === 'wrong') pointsAwarded = 0;

    let tel = selectedSubmission.telemetry;
    if (typeof tel === 'string') {
      try { tel = JSON.parse(tel); } catch { tel = {}; }
    }
    let mg = selectedSubmission.manual_grades;
    if (typeof mg === 'string') {
      try { mg = JSON.parse(mg); } catch { mg = null; }
    }
    const currentGrades = (mg && typeof mg === 'object' && Object.keys(mg).length > 0)
      ? mg
      : (tel && typeof tel === 'object' && tel.manual_grades ? tel.manual_grades : {});

    const updatedGrades = {
      ...currentGrades,
      [qId]: {
        status,
        pointsAwarded,
        comment: commentText !== undefined ? commentText : (currentGrades[qId]?.comment || ''),
        gradedBy: 'manual' as const
      }
    };

    // Calculate score
    let totalScore = 0;
    let correctCount = 0;

    currentExam.questions.forEach(q => {
      const p = q.points !== undefined && q.points > 0 ? q.points : 1.0;
      const ans = selectedSubmission.answers?.[q.id];

      if (q.type === 'multiple') {
        if (ans !== undefined && Number(ans) === q.correctOption) {
          totalScore += p;
          correctCount += 1;
        }
      } else if (q.type === 'written') {
        const g = updatedGrades[q.id];
        if (g) {
          totalScore += g.pointsAwarded;
          if (g.status === 'correct') correctCount += 1;
          else if (g.status === 'half') correctCount += 0.5;
        }
      }
    });

    totalScore = Math.round(totalScore * 10) / 10;

    const currentTelemetry = tel && typeof tel === 'object' ? tel : {};
    const updatedTelemetry = {
      ...currentTelemetry,
      manual_grades: updatedGrades
    };

    const updatedSub: MockSubmission = {
      ...selectedSubmission,
      telemetry: updatedTelemetry,
      manual_grades: updatedGrades,
      score: totalScore,
      correct_count: Math.round(correctCount * 10) / 10
    };

    setSelectedSubmission(updatedSub);
    setSubmissions(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s));

    try {
      const { error } = await supabase
        .from('wsm_mock_submissions')
        .update({
          telemetry: updatedTelemetry,
          score: totalScore,
          correct_count: Math.round(correctCount * 10) / 10
        })
        .eq('id', selectedSubmission.id);

      if (error) {
        console.error("Erro ao salvar avaliação no banco:", error);
      } else {
        setSuccessMsg(commentText !== undefined ? "Feedback salvo com sucesso!" : "Avaliação da questão salva com sucesso!");
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error("Exceção ao salvar avaliação:", err);
    }
  };

  // Helper to resolve virtual classes identifiers for a specific student
  const getStudentVirtualClassIdentifiers = (studentEmail: string, virtualClassesList: any[]): string[] => {
    if (!studentEmail || !virtualClassesList || virtualClassesList.length === 0) return [];
    const emailLower = studentEmail.toLowerCase().trim();
    const identifiers: string[] = [];

    virtualClassesList.forEach(vc => {
      if (!vc) return;
      let emails: string[] = [];
      if (Array.isArray(vc.student_emails)) {
        emails = vc.student_emails;
      } else if (typeof vc.student_emails === 'string') {
        const raw = vc.student_emails.trim();
        if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) emails = parsed;
          } catch {
            emails = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else {
          emails = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      const hasStudent = emails.some(e => String(e).toLowerCase().trim() === emailLower);
      if (hasStudent) {
        if (vc.id) identifiers.push(String(vc.id));
        if (vc.name) identifiers.push(String(vc.name));
        if (vc.access_code) identifiers.push(String(vc.access_code));
      }
    });

    return identifiers;
  };

  // Helper to retrieve teacher rooms and her students grouped by room
  const getTeacherRooms = () => {
    const roomsMap = new Map<string, {
      id: string;
      name: string;
      type: 'official' | 'virtual';
      studentList: any[];
    }>();

    // 1. Official classes taught by this teacher
    (availableClasses || []).forEach(clsName => {
      if (!clsName) return;
      const matched = (students || []).filter(st => st && (st.turma || '').toLowerCase().trim() === clsName.toLowerCase().trim());
      roomsMap.set(clsName.toLowerCase().trim(), {
        id: clsName,
        name: clsName,
        type: 'official',
        studentList: matched
      });
    });

    // 2. Virtual classes created by this teacher
    (virtualClasses || []).forEach(vc => {
      if (!vc || !vc.name) return;
      let emails: string[] = [];
      if (Array.isArray(vc.student_emails)) {
        emails = vc.student_emails;
      } else if (typeof vc.student_emails === 'string') {
        try {
          emails = JSON.parse(vc.student_emails);
        } catch {
          emails = vc.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      const emailsLower = new Set(emails.map(e => String(e).toLowerCase().trim()));
      const matched = (students || []).filter(st => {
        if (!st || !st.email) return false;
        if (emailsLower.has(st.email.toLowerCase().trim())) return true;
        if (st.turma && st.turma.toLowerCase().trim() === vc.name.toLowerCase().trim()) return true;
        return false;
      });

      const key = (vc.name || '').toLowerCase().trim();
      const existing = roomsMap.get(key);
      if (existing) {
        // Merge student lists without duplicates
        const existingEmails = new Set(existing.studentList.map(s => s.email?.toLowerCase().trim()));
        matched.forEach(st => {
          if (st.email && !existingEmails.has(st.email.toLowerCase().trim())) {
            existing.studentList.push(st);
            existingEmails.add(st.email.toLowerCase().trim());
          }
        });
      } else {
        roomsMap.set(key, {
          id: vc.id || vc.name,
          name: vc.name,
          type: 'virtual',
          studentList: matched
        });
      }
    });

    return Array.from(roomsMap.values());
  };

  const handleToggleTargetClass = (classIdentifier: string) => {
    setSelectedTargetClasses(prev => 
      prev.includes(classIdentifier)
        ? prev.filter(c => c !== classIdentifier)
        : [...prev, classIdentifier]
    );
  };

  const handleToggleTargetStudent = (studentEmail: string) => {
    const emailLower = studentEmail.toLowerCase().trim();
    setSelectedTargetStudents(prev => 
      prev.includes(emailLower)
        ? prev.filter(e => e !== emailLower)
        : [...prev, emailLower]
    );
  };

  const handleSelectAllInRoom = (studentList: any[]) => {
    const emails = studentList.map(s => s.email.toLowerCase().trim());
    setSelectedTargetStudents(prev => Array.from(new Set([...prev, ...emails])));
  };

  const handleDeselectAllInRoom = (studentList: any[]) => {
    const emailsSet = new Set(studentList.map(s => s.email.toLowerCase().trim()));
    setSelectedTargetStudents(prev => prev.filter(e => !emailsSet.has(e)));
  };

  // Save current wizard state as a draft (Simulado Salvo - Não publicado)
  const handleSaveDraft = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    const draftTitle = simTitle.trim() || 'Simulado em Rascunho (Sem Título)';
    const simClassValue = [...selectedTargetClasses, ...selectedTargetStudents].join(', ');

    try {
      const deadlineVal = simDeadline ? new Date(simDeadline).toISOString() : null;

      let existingExtraTime: Record<string, number> = {};
      if (editingExamId) {
        const found = simulados.find(ex => ex.id === editingExamId);
        if (found) {
          const { settings } = parseExamSettings(found.description || '');
          existingExtraTime = settings.student_extra_time || {};
        }
      }

      const settingsPayload: MockExamSettings = {
        mode: examMode,
        duration_minutes: simDuration ? Number(simDuration) : undefined,
        student_extra_time: existingExtraTime,
        is_controlled: examMode === 'controlled',
        is_draft: true
      };

      const serializedDesc = serializeExamDescription(simDescription.trim(), settingsPayload);

      let dbResponse;
      if (editingExamId) {
        dbResponse = await supabase
          .from('wsm_mock_exams')
          .update({
            title: draftTitle,
            description: serializedDesc,
            subject: simSubject || teacherSubject || 'Biologia',
            class_name: simClassValue,
            deadline: deadlineVal,
            questions: questions,
            shuffle_questions: shuffleQuestions,
            shuffle_options: shuffleOptions
          })
          .eq('id', editingExamId);
      } else {
        dbResponse = await supabase
          .from('wsm_mock_exams')
          .insert({
            title: draftTitle,
            description: serializedDesc,
            subject: simSubject || teacherSubject || 'Biologia',
            class_name: simClassValue,
            teacher_email: email.toLowerCase(),
            teacher_name: teacherName,
            deadline: deadlineVal,
            questions: questions,
            shuffle_questions: shuffleQuestions,
            shuffle_options: shuffleOptions
          })
          .select();
      }

      const { data: resData, error } = dbResponse;
      if (error) throw error;

      if (!editingExamId && resData && resData[0]) {
        setEditingExamId(resData[0].id);
      }

      setSuccessMsg('💾 Rascunho do simulado salvo com sucesso! Você pode continuar a preenchê-lo a qualquer momento na aba "Rascunhos Salvos".');
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao salvar rascunho: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Publish simulado to Database
  const handlePublishExam = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    if (!simTitle.trim()) {
      setErrorMsg("O título do simulado é obrigatório.");
      setCurrentStep(1);
      setIsSaving(false);
      return;
    }

    if (selectedTargetClasses.length === 0 && selectedTargetStudents.length === 0) {
      setErrorMsg("Selecione pelo menos uma turma/sala ou um aluno individual no Passo 2.");
      setCurrentStep(2);
      setIsSaving(false);
      return;
    }

    if (questions.length === 0) {
      setErrorMsg("Adicione pelo menos 1 questão no Passo 3 antes de publicar.");
      setCurrentStep(3);
      setIsSaving(false);
      return;
    }

    const simClassValue = [...selectedTargetClasses, ...selectedTargetStudents].join(', ');

    try {
      const deadlineVal = simDeadline ? new Date(simDeadline).toISOString() : null;

      // Check if it was previously a draft before publishing
      const wasDraft = editingExamId ? simulados.some(s => s.id === editingExamId && parseExamSettings(s.description || '').settings.is_draft) : false;

      // Extract existing settings if editing to preserve student_extra_time
      let existingExtraTime: Record<string, number> = {};
      if (editingExamId) {
        const found = simulados.find(ex => ex.id === editingExamId);
        if (found) {
          const { settings } = parseExamSettings(found.description || '');
          existingExtraTime = settings.student_extra_time || {};
        }
      }

      const settingsPayload: MockExamSettings = {
        mode: examMode,
        duration_minutes: simDuration ? Number(simDuration) : undefined,
        student_extra_time: existingExtraTime,
        is_controlled: examMode === 'controlled',
        is_draft: false
      };

      const serializedDesc = serializeExamDescription(simDescription.trim(), settingsPayload);

      let dbResponse;
      
      if (editingExamId) {
        dbResponse = await supabase
          .from('wsm_mock_exams')
          .update({
            title: simTitle.trim(),
            description: serializedDesc,
            subject: simSubject || teacherSubject || 'Biologia',
            class_name: simClassValue,
            deadline: deadlineVal,
            questions: questions,
            shuffle_questions: shuffleQuestions,
            shuffle_options: shuffleOptions
          })
          .eq('id', editingExamId);
      } else {
        dbResponse = await supabase
          .from('wsm_mock_exams')
          .insert({
            title: simTitle.trim(),
            description: serializedDesc,
            subject: simSubject || teacherSubject || 'Biologia',
            class_name: simClassValue,
            teacher_email: email.toLowerCase(),
            teacher_name: teacherName,
            deadline: deadlineVal,
            questions: questions,
            shuffle_questions: shuffleQuestions,
            shuffle_options: shuffleOptions
          });
      }

      const { error } = dbResponse;

      if (error) throw error;

      // Notify targeted students (if brand new OR converting a draft to published)
      if (!editingExamId || wasDraft) {
        try {
          const targetStudents = students.filter(st => {
            if (!st || !st.email) return false;
            const studentVCs = getStudentVirtualClassIdentifiers(st.email, virtualClasses);
            return matchesStudentTarget(
              simClassValue,
              st.email,
              st.turma,
              studentVCs
            );
          });

          if (targetStudents.length > 0) {
            const notificationsBatch = targetStudents.map(student => ({
              user_id: student.id,
              title: `Novo Simulado de ${teacherSubject}`,
              message: `O(A) professor(a) ${teacherName} preparou uma prova online: "${simTitle.trim()}" disponível até ${simDeadline ? new Date(simDeadline).toLocaleString('pt-BR') : 'sem prazo established'}. Acesse em "Simulados" e responda já!`,
              is_read: false
            }));

            await supabase
              .from('wsm_notifications')
              .insert(notificationsBatch);

            // Disparar e-mails de notificação por trás
            fetch('/api/send-notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notifications: notificationsBatch })
            }).catch(err => console.warn('Erro ao disparar e-mails:', err));
          }
        } catch (notifErr) {
          console.warn("Erro ao despachar notificações do simulado:", notifErr);
        }
      }

      setSuccessMsg(editingExamId ? "✅ Simulado atualizado com sucesso!" : "🎉 Simulado virtual criado, publicado e sincronizado com os estudantes com sucesso!");
      
      // Reset simulator forms
      setEditingExamId(null);
      setSimTitle('');
      setSimDescription('');
      setSimDuration('');
      setQuestions([]);
      setSimDeadline('');
      setShuffleQuestions(false);
      setShuffleOptions(false);
      setExamMode('normal');
      setActivePreviewExam(null);
      setSelectedTargetClasses(availableClasses.length > 0 ? [availableClasses[0]] : []);
      setSelectedTargetStudents([]);
      setCurrentStep(1);
      setActiveSubTab('list');
      loadData();
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao salvar no banco: ${err.message || "Tente novamente mais tarde."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartNewSimulado = () => {
    setEditingExamId(null);
    setSimTitle('');
    setSimDescription('');
    setSimSubject(teacherSubject || 'Biologia');
    setSimDuration('');
    setQuestions([]);
    setSimDeadline('');
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setExamMode('normal');
    setSelectedTargetClasses(availableClasses.length > 0 ? [availableClasses[0]] : []);
    setSelectedTargetStudents([]);
    setCurrentStep(1);
    setActiveSubTab('create');
    setErrorMsg('');
    setSuccessMsg('');
    localStorage.removeItem('athenas_sim_title');
    localStorage.removeItem('athenas_sim_desc');
    localStorage.removeItem('athenas_sim_duration');
    localStorage.removeItem('athenas_sim_class');
    localStorage.removeItem('athenas_sim_target_classes');
    localStorage.removeItem('athenas_sim_target_students');
    localStorage.removeItem('athenas_sim_deadline');
    localStorage.removeItem('athenas_sim_questions');
    localStorage.removeItem('athenas_sim_qtext');
    localStorage.removeItem('athenas_sim_qexplanation');
    localStorage.removeItem('athenas_sim_qoptions');
    localStorage.removeItem('athenas_sim_qcorrectindex');
    localStorage.removeItem('athenas_sim_qtype');
  };

  const handleEditSimulado = (sim: MockExam) => {
    setEditingExamId(sim.id || null);
    setSimTitle(sim.title || '');
    setSimSubject(sim.subject || teacherSubject || 'Biologia');
    
    // Parse description and extract duration settings
    const { cleanDescription, settings } = parseExamSettings(sim.description || '');
    setSimDescription(cleanDescription);
    setSimDuration(settings.duration_minutes || '');
    setExamMode(settings.mode || (settings.is_controlled ? 'controlled' : 'normal'));

    const { classes, students: targetStuds } = parseExamTargets(sim.class_name);
    setSelectedTargetClasses(classes);
    setSelectedTargetStudents(targetStuds);

    if (sim.deadline) {
      const d = new Date(sim.deadline);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setSimDeadline(localISOTime);
    } else {
      setSimDeadline('');
    }

    let parsedQuestions: MockExamQuestion[] = [];
    if (Array.isArray(sim.questions)) {
      parsedQuestions = sim.questions;
    } else if (typeof sim.questions === 'string') {
      try {
        parsedQuestions = JSON.parse(sim.questions);
      } catch {
        parsedQuestions = [];
      }
    }

    const clonedQuestions: MockExamQuestion[] = (parsedQuestions || []).map((q, idx) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${idx}`,
      options: q.options ? [...q.options] : undefined,
      imageUrls: q.imageUrls ? [...q.imageUrls] : []
    }));

    setQuestions(clonedQuestions);
    setShuffleQuestions(!!sim.shuffle_questions);
    setShuffleOptions(!!sim.shuffle_options);
    setCurrentStep(1);
    setActiveSubTab('create');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSuccessMsg('Simulado carregado para edição. Navegue pelos passos para alterar as configurações.');
  };

  const handleDuplicateSimulado = (sim: MockExam) => {
    setEditingExamId(null); // Clear editing id so saving/publishing creates a NEW exam!
    setSimTitle(`${sim.title} (Cópia)`);
    setSimSubject(sim.subject || teacherSubject || 'Biologia');
    
    // Parse description and extract duration settings
    const { cleanDescription, settings } = parseExamSettings(sim.description || '');
    setSimDescription(cleanDescription);
    setSimDuration(settings.duration_minutes || '');
    setExamMode(settings.mode || (settings.is_controlled ? 'controlled' : 'normal'));

    const { classes, students: targetStuds } = parseExamTargets(sim.class_name);
    setSelectedTargetClasses(classes);
    setSelectedTargetStudents(targetStuds);

    if (sim.deadline) {
      const d = new Date(sim.deadline);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setSimDeadline(localISOTime);
    } else {
      setSimDeadline('');
    }

    let parsedQuestions: MockExamQuestion[] = [];
    if (Array.isArray(sim.questions)) {
      parsedQuestions = sim.questions;
    } else if (typeof sim.questions === 'string') {
      try {
        parsedQuestions = JSON.parse(sim.questions);
      } catch {
        parsedQuestions = [];
      }
    }

    const clonedQuestions: MockExamQuestion[] = (parsedQuestions || []).map((q, idx) => ({
      ...q,
      id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      options: q.options ? [...q.options] : undefined,
      imageUrls: q.imageUrls ? [...q.imageUrls] : []
    }));

    setQuestions(clonedQuestions);
    setShuffleQuestions(!!sim.shuffle_questions);
    setShuffleOptions(!!sim.shuffle_options);
    setCurrentStep(1);
    setActiveSubTab('create');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSuccessMsg('Simulado duplicado com sucesso! As informações e questões do simulado original foram carregadas. Você pode alterar o que desejar antes de publicar.');
  };

  const handleCancelEdit = () => {
    setEditingExamId(null);
    setSimTitle('');
    setSimDescription('');
    setSimDuration('');
    setQuestions([]);
    setSimDeadline('');
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setExamMode('normal');
    setSelectedTargetClasses(availableClasses.length > 0 ? [availableClasses[0]] : []);
    setSelectedTargetStudents([]);
    setCurrentStep(1);
    setActiveSubTab('list');
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Delete live simulado
  const handleDeleteSimulado = async (id: string) => {
    if (!window.confirm("Atenção: Tem certeza de que quer apagar permanentemente este simulado virtual de sua conta e dos computadores dos alunos?")) return;
    try {
      const { error } = await supabase
        .from('wsm_mock_exams')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccessMsg("Simulado virtual retirado do ar com sucesso!");
      loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const goToNextStep = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      if (!simTitle.trim()) {
        setErrorMsg("Por favor, informe o título do simulado no Passo 1 antes de prosseguir.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedTargetClasses.length === 0 && selectedTargetStudents.length === 0) {
        setErrorMsg("Selecione pelo menos uma turma/sala ou um aluno individual no Passo 2.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (questions.length === 0) {
        setErrorMsg("Adicione pelo menos uma questão ao simulado no Passo 3 antes de prosseguir para a revisão.");
        return;
      }
      setCurrentStep(4);
    }
  };

  const goToPrevStep = () => {
    setErrorMsg('');
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleSaveExtraTime = async () => {
    if (!extraTimeStudent || !selectedExamId) return;
    setIsSavingExtraTime(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const exam = simulados.find(ex => ex.id === selectedExamId);
      if (!exam) throw new Error("Simulado não encontrado.");

      const { cleanDescription, settings } = parseExamSettings(exam.description || '');
      const existingExtraTime = settings.student_extra_time || {};
      
      existingExtraTime[extraTimeStudent.email.toLowerCase()] = extraMinutesInput;

      const updatedSettings = {
        ...settings,
        student_extra_time: existingExtraTime
      };

      const serializedDesc = serializeExamDescription(cleanDescription, updatedSettings);

      const { error: errorExamUpdate } = await supabase
        .from('wsm_mock_exams')
        .update({ description: serializedDesc })
        .eq('id', selectedExamId);

      if (errorExamUpdate) throw errorExamUpdate;

      const submission = submissions.find(sub => sub.mock_exam_id === selectedExamId && sub.student_email.toLowerCase() === extraTimeStudent.email.toLowerCase());
      if (submission) {
        let telemetryObj = submission.telemetry;
        if (typeof telemetryObj === 'string') {
          try {
            telemetryObj = JSON.parse(telemetryObj);
          } catch {
            telemetryObj = null;
          }
        }
        if (!telemetryObj) {
          telemetryObj = {
            totalTimeSeconds: 0,
            questionTimes: {},
            optionChanges: {},
            tabSwitches: 0,
            firstInteractionTime: new Date().toISOString()
          };
        }
        telemetryObj.is_unfinished = true;

        const { error: errorSubUpdate } = await supabase
          .from('wsm_mock_submissions')
          .update({ telemetry: telemetryObj })
          .eq('id', submission.id);

        if (errorSubUpdate) throw errorSubUpdate;
      }

      setSuccessMsg(`Tempo extra de ${extraMinutesInput} minutos concedido para ${extraTimeStudent.name}!`);
      setExtraTimeStudent(null);
      
      // Reload lists via loadData to preserve filtering and sync parent
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao salvar tempo extra: ${err.message || "Tente novamente."}`);
    } finally {
      setIsSavingExtraTime(false);
    }
  };

  // Filter students showing their status for the current selection in "Notas"
  const currentExam = simulados.find(ex => ex.id === selectedExamId);
  const selectedVirtualClass = virtualClasses.find(vc => vc.id === selectedClass || vc.name === selectedClass);
  const classStudents = selectedVirtualClass
    ? students.filter(st => selectedVirtualClass.student_emails && selectedVirtualClass.student_emails.map((e: string) => e.toLowerCase()).includes(st.email.toLowerCase()))
    : students.filter(st => st.turma === selectedClass);

  const previewTitle = activePreviewExam ? activePreviewExam.title : simTitle;
  const previewDescription = activePreviewExam ? activePreviewExam.description : simDescription;
  const previewQuestions = activePreviewExam ? activePreviewExam.questions : questions;
  const previewTeacherName = activePreviewExam ? (activePreviewExam.teacher_name || 'Professor') : teacherName;
  const previewSubject = activePreviewExam ? (activePreviewExam.subject || 'Biologia') : teacherSubject;

  return (
    <div id="teacher-simulados-root" className="space-y-8 animate-fadeIn h-full flex flex-col">
      {viewMode === 'normal' && !selectedSubmission && (
        <>
          {/* Tab Selectors */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-2 flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setActiveSubTab('list');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 rounded-xl cursor-pointer ${
              activeSubTab === 'list'
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Meus Simulados ({publishedSimulados.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('drafts');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 rounded-xl cursor-pointer relative ${
              activeSubTab === 'drafts'
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span>Rascunhos Salvos ({draftSimulados.length})</span>
            {draftSimulados.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => {
              if (activeSubTab !== 'create') {
                handleStartNewSimulado();
              } else {
                setActiveSubTab('create');
              }
            }}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 rounded-xl cursor-pointer ${
              activeSubTab === 'create'
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>{editingExamId ? 'Editar Simulado' : 'Criar Simulado Virtual'}</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('results');
              setErrorMsg('');
              setSuccessMsg('');
              setSelectedExamId('');
            }}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 rounded-xl cursor-pointer ${
              activeSubTab === 'results'
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Resultado de Simulados</span>
          </button>
        </div>

        {activeSubTab !== 'create' && (
          <button
            type="button"
            onClick={handleStartNewSimulado}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Criar Novo Simulado</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-400 animate-slideUp">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-300 animate-slideUp">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'create') {
                  handlePublishExam();
                } else {
                  loadData();
                }
              }}
              disabled={isSaving}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-neutral-400 hover:text-neutral-200 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'list' ? (
        /* MEUS SIMULADOS (PUBLICADOS) */
        <div className="space-y-6 animate-fadeIn">
          {draftSimulados.length > 0 && (
            <div className="p-4 bg-amber-950/20 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slideUp">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-200">
                    Você possui {draftSimulados.length} simulado(s) salvo(s) em rascunho
                  </h4>
                  <p className="text-[11px] text-amber-300/70 mt-0.5">
                    Estes simulados não estão visíveis para os alunos até que você decida publicá-los.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('drafts')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow shrink-0 flex items-center gap-1.5"
              >
                <span>Ver Rascunhos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {publishedSimulados.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 space-y-4">
              <ClipboardList className="w-12 h-12 text-neutral-700 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-neutral-300">Nenhum simulado publicado ainda</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                  Clique no botão abaixo para montar seu primeiro simulado com questões autorais ou do banco oficial do ENEM.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartNewSimulado}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Simulado</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publishedSimulados.map((sim) => {
                const { cleanDescription, settings } = parseExamSettings(sim.description || '');
                const isExamControlled = settings.is_controlled === true;
                const questionsCount = sim.questions?.length || 0;
                const durationText = settings.duration_minutes ? `${settings.duration_minutes} min` : 'Tempo livre';
                const deadlineText = sim.deadline 
                  ? new Date(sim.deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Sem prazo final';

                return (
                  <div 
                    key={sim.id} 
                    className="p-5 bg-neutral-950/80 border border-neutral-900 hover:border-neutral-800 rounded-3xl flex flex-col justify-between space-y-4 transition-all group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg uppercase tracking-wider font-mono">
                          {sim.subject || teacherSubject}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                          isExamControlled 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {isExamControlled ? '🔒 Controlado' : '🟢 Normal'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-emerald-400 transition-colors line-clamp-2">
                          {sim.title}
                        </h4>
                        {cleanDescription && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-1 leading-relaxed">
                            {cleanDescription}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-900/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-450">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{questionsCount} questão(ões)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{durationText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="truncate">Prazo: {deadlineText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Users className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="truncate">Turma: {formatTargetDisplayName(sim.class_name, virtualClasses)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-900 flex items-center justify-between gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePreviewExam(sim);
                          setViewMode('preview-student');
                        }}
                        className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-amber-400 text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        title="Testar Pré-visualização como Aluno"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Testar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExamId(sim.id);
                          setActiveSubTab('results');
                        }}
                        className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-emerald-400 text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        title="Ver Resultados e Notas"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Notas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditSimulado(sim)}
                        className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-emerald-400 text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        title="Editar Simulado"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSimulado(sim)}
                        className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-blue-400 text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        title="Duplicar Simulado"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplicar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSimulado(sim.id)}
                        className="p-1.5 bg-neutral-900 hover:bg-rose-950/40 hover:text-rose-400 text-neutral-500 rounded-xl transition-all cursor-pointer"
                        title="Excluir Simulado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeSubTab === 'drafts' ? (
        /* RASCUNHOS SALVOS (NÃO PUBLICADOS) */
        <div className="space-y-6 animate-fadeIn">
          <div className="p-5 bg-neutral-950/80 border border-neutral-900 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-100 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <span>Simulados Salvos em Rascunho</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Estes simulados não estão visíveis para os alunos. Você pode retomar a edição, adicionar questões e publicar quando desejar.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartNewSimulado}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Rascunho</span>
            </button>
          </div>

          {draftSimulados.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 space-y-4">
              <Bookmark className="w-12 h-12 text-neutral-700 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-neutral-300">Nenhum rascunho salvo no momento</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                  Quando você criar um simulado e quiser pausar para continuar depois, basta clicar em "Salvar Rascunho". Ele aparecerá nesta aba.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartNewSimulado}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Simulado</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {draftSimulados.map((sim) => {
                const { cleanDescription, settings } = parseExamSettings(sim.description || '');
                const isExamControlled = settings.is_controlled === true;
                const questionsCount = sim.questions?.length || 0;
                const durationText = settings.duration_minutes ? `${settings.duration_minutes} min` : 'Tempo livre';
                const deadlineText = sim.deadline 
                  ? new Date(sim.deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Sem prazo definido';

                return (
                  <div 
                    key={sim.id} 
                    className="p-5 bg-neutral-950/80 border border-amber-500/30 hover:border-amber-500/60 rounded-3xl flex flex-col justify-between space-y-4 transition-all group relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold rounded-lg uppercase tracking-wider font-mono flex items-center gap-1">
                          <Bookmark className="w-3 h-3" />
                          RASCUNHO
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                          isExamControlled 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}>
                          {isExamControlled ? '🔒 Controlado' : '🟢 Normal'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-amber-400 transition-colors line-clamp-2">
                          {sim.title || 'Simulado em Rascunho (Sem Título)'}
                        </h4>
                        {cleanDescription && (
                          <p className="text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                            {cleanDescription}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-900/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-450">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{questionsCount} questão(ões)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{durationText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="truncate">Prazo: {deadlineText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Users className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="truncate">Turma: {formatTargetDisplayName(sim.class_name, virtualClasses) || 'Ainda não selecionada'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-900 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          handleEditSimulado(sim);
                          setActiveSubTab('create');
                        }}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow"
                        title="Continuar preenchendo as informações e questões"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Continuar Preenchendo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSimulado(sim)}
                        className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-blue-400 font-semibold text-[11px] rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        title="Duplicar Rascunho"
                      >
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                        <span>Duplicar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSimulado(sim.id)}
                        className="p-2 bg-neutral-900 hover:bg-rose-950/40 hover:text-rose-400 text-neutral-500 rounded-xl transition-all cursor-pointer"
                        title="Excluir Rascunho"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeSubTab === 'create' ? (
        <div className="space-y-6">
          {/* STEP WIZARD HEADER NAV */}
          <div className="p-4 rounded-3xl bg-neutral-950/80 border border-neutral-900 backdrop-blur-md">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Step 1 Pill */}
              <button
                type="button"
                onClick={() => { setErrorMsg(''); setCurrentStep(1); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentStep === 1
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : currentStep > 1
                    ? 'bg-neutral-900/60 border-emerald-500/30 text-neutral-300'
                    : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Passo 1</span>
                  {currentStep > 1 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <FileText className={`w-4 h-4 ${currentStep === 1 ? 'text-emerald-400' : 'text-neutral-600'}`} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-100">1. Informações Básicas</p>
                  <p className="text-[10px] text-neutral-450 truncate">Título, prazo e regras</p>
                </div>
              </button>

              {/* Step 2 Pill */}
              <button
                type="button"
                onClick={() => {
                  if (!simTitle.trim()) { setErrorMsg("Preencha o título no Passo 1 primeiro."); return; }
                  setErrorMsg('');
                  setCurrentStep(2);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentStep === 2
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : currentStep > 2
                    ? 'bg-neutral-900/60 border-emerald-500/30 text-neutral-300'
                    : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Passo 2</span>
                  {currentStep > 2 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Users className={`w-4 h-4 ${currentStep === 2 ? 'text-emerald-400' : 'text-neutral-600'}`} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-100">2. Turmas & Alunos Alvo</p>
                  <p className="text-[10px] text-neutral-450 truncate">
                    {selectedTargetClasses.length} sala(s), {selectedTargetStudents.length} aluno(s)
                  </p>
                </div>
              </button>

              {/* Step 3 Pill */}
              <button
                type="button"
                onClick={() => {
                  if (!simTitle.trim()) { setErrorMsg("Preencha o título no Passo 1 primeiro."); return; }
                  if (selectedTargetClasses.length === 0 && selectedTargetStudents.length === 0) {
                    setErrorMsg("Selecione os alvos no Passo 2 primeiro."); return;
                  }
                  setErrorMsg('');
                  setCurrentStep(3);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentStep === 3
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : currentStep > 3
                    ? 'bg-neutral-900/60 border-emerald-500/30 text-neutral-300'
                    : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Passo 3</span>
                  {questions.length > 0 ? (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">{questions.length} q.</span>
                  ) : (
                    <HelpCircle className={`w-4 h-4 ${currentStep === 3 ? 'text-emerald-400' : 'text-neutral-600'}`} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-100">3. Questões do Simulado</p>
                  <p className="text-[10px] text-neutral-450 truncate">{questions.length} questão(ões) criada(s)</p>
                </div>
              </button>

              {/* Step 4 Pill */}
              <button
                type="button"
                onClick={() => {
                  if (!simTitle.trim()) { setErrorMsg("Preencha o título no Passo 1 primeiro."); return; }
                  if (selectedTargetClasses.length === 0 && selectedTargetStudents.length === 0) {
                    setErrorMsg("Selecione os alvos no Passo 2 primeiro."); return;
                  }
                  if (questions.length === 0) { setErrorMsg("Adicione pelo menos 1 questão no Passo 3 primeiro."); return; }
                  setErrorMsg('');
                  setCurrentStep(4);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentStep === 4
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Passo 4</span>
                  <CheckCircle className={`w-4 h-4 ${currentStep === 4 ? 'text-emerald-400' : 'text-neutral-600'}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-100">4. Revisar & Publicar</p>
                  <p className="text-[10px] text-neutral-450 truncate">Confirmação final</p>
                </div>
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-900/80 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Quer continuar depois? Salve como rascunho sem notificar os alunos.</span>
              </span>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaving ? "Salvando..." : "Salvar Rascunho"}</span>
              </button>
            </div>
          </div>

          {/* STEP 1: DETALHES E REGRAS */}
          {currentStep === 1 && (
            <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div>
                  <h3 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <span>Passo 1: Detalhes Básicos e Regras de Aplicação</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">Preencha as informações do simulado e configure as regras de tempo e segurança.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs rounded-full">Etapa 1 de 4</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">Título do Simulado *</label>
                  <input
                    type="text"
                    placeholder="Ex: Simulado Geral de Modelagem UML e POO"
                    value={simTitle}
                    onChange={(e) => setSimTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all placeholder-neutral-650 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">Matéria / Disciplina</label>
                  <input
                    type="text"
                    value={simSubject}
                    onChange={(e) => setSimSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 font-semibold outline-none focus:border-emerald-500/50"
                    placeholder="Ex: Biologia, Ciências..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">Prazo Limite para Entrega (Data e Hora)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-950/40 border border-neutral-900 p-3.5 rounded-2xl">
                    <div>
                      <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">1. Selecionar Data</span>
                      <CustomDatePicker
                        value={simDeadline ? simDeadline.split('T')[0] : ''}
                        onChange={(newDate) => {
                          const currentTime = simDeadline && simDeadline.includes('T') ? simDeadline.split('T')[1].substring(0, 5) : '23:59';
                          setSimDeadline(newDate ? `${newDate}T${currentTime}` : '');
                        }}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">2. Digitar Horário</span>
                      <input
                        type="time"
                        value={simDeadline && simDeadline.includes('T') ? simDeadline.split('T')[1].substring(0, 5) : '23:59'}
                        onChange={(e) => {
                          const newTime = e.target.value || '23:59';
                          const currentDate = simDeadline ? simDeadline.split('T')[0] : new Date().toISOString().split('T')[0];
                          setSimDeadline(`${currentDate}T${newTime}`);
                        }}
                        className="w-full px-3.5 py-2.5 bg-neutral-955 border border-neutral-850 hover:border-emerald-500/30 focus-within:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">Tempo Limite da Prova (Opcional)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="Sem limite de tempo (ritmo livre e sem contagem regressiva)"
                      value={simDuration}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSimDuration(val === '' ? '' : Math.max(1, parseInt(val, 10)));
                      }}
                      className="w-full pl-4 pr-14 py-3 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all placeholder-neutral-650"
                    />
                    <span className="absolute right-4 top-3.5 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">min</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Conteúdo do Simulado & Instruções de Estudo (IA)</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
                    💡 Alunos poderão estudar este conteúdo com o Tutor IA antes de responder
                  </span>
                </div>
                <textarea
                  placeholder="Escreva aqui os conteúdos e assuntos cobrados no simulado (ex: Leis de Newton, Funções do 2º Grau, Sintaxe em Python). Os alunos verão o botão 'Estudar Conteúdo com IA' para revisar esses temas antes da prova!"
                  rows={3}
                  value={simDescription}
                  onChange={(e) => setSimDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all placeholder-neutral-600 resize-none font-medium leading-relaxed"
                />
              </div>

              {/* Security & Anti-cheat Options */}
              <div className="pt-4 border-t border-neutral-900 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Configurações Anti-cola & Modo de Aplicação</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setExamMode('normal')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      examMode === 'normal'
                        ? 'bg-emerald-500/10 border-emerald-500 text-neutral-200'
                        : 'bg-neutral-950/40 border-neutral-900 hover:border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-bold block ${examMode === 'normal' ? 'text-emerald-400' : 'text-neutral-300'}`}>
                        🟢 Simulado Normal (Ritmo Livre)
                      </span>
                      <span className="text-[11px] leading-relaxed text-neutral-500 mt-1 block">
                        Permite que o aluno responda no seu próprio ritmo, sem bloqueios de tela cheia ou monitoramento.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamMode('controlled')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      examMode === 'controlled'
                        ? 'bg-emerald-500/10 border-emerald-500 text-neutral-200'
                        : 'bg-neutral-950/40 border-neutral-900 hover:border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-bold block ${examMode === 'controlled' ? 'text-emerald-400' : 'text-neutral-300'}`}>
                        🔒 Simulado Controlado (Anticola)
                      </span>
                      <span className="text-[11px] leading-relaxed text-neutral-500 mt-1 block">
                        Tentativa única, obriga modo tela cheia e registra telemetria de trocas de aba durante a prova.
                      </span>
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <label className="flex items-start gap-3 p-3 bg-neutral-950/40 border border-neutral-900 rounded-xl cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-emerald-500 accent-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-300 group-hover:text-emerald-400 transition-colors">Embaralhar Ordem das Questões</span>
                      <span className="text-[10px] text-neutral-500">Cada aluno receberá a lista em uma ordem diferente.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-neutral-950/40 border border-neutral-900 rounded-xl cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-emerald-500 accent-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-300 group-hover:text-emerald-400 transition-colors">Embaralhar Alternativas (A, B, C...)</span>
                      <span className="text-[10px] text-neutral-500">Gera opções misturadas para cada estudante.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fast Templates */}
              <div className="pt-2 border-t border-neutral-900">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-2">⭐ Modelos Rápidos de Exemplo</span>
                <div className="flex flex-wrap gap-2">
                  {templateExams.map((temp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyTemplate(idx)}
                      type="button"
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{temp.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Footer Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-900 gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>Salvar Rascunho</span>
                </button>

                <button
                  type="button"
                  onClick={goToNextStep}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <span>Avançar para Escolha de Alvos (Passo 2)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ESCOLHER TURMAS E ALUNOS ALVO (SELETORES COMPACTOS COM DROPDOWN) */}
          {currentStep === 2 && (
            <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6 animate-fadeIn">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div>
                  <h3 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <span>Passo 2: Selecionar Destinatários (Turmas e/ou Alunos)</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Escolha abaixo as turmas inteiras ou os alunos específicos que receberão este simulado.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs rounded-full">Etapa 2 de 4</span>
              </div>

              {/* SELETOR 1: SALAS / TURMAS INTEIRAS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>1. Turmas e Salas Inteiras Alvo</span>
                  </label>
                  {selectedTargetClasses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTargetClasses([])}
                      className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Limpar salas ({selectedTargetClasses.length})
                    </button>
                  )}
                </div>

                {/* Dropdown Trigger Box */}
                <div className="relative">
                  <div
                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                    className="w-full min-h-[46px] p-2.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {selectedTargetClasses.length > 0 ? (
                        selectedTargetClasses.map((classId) => {
                          const roomObj = getTeacherRooms().find(r => r.id === classId);
                          const nameDisplay = roomObj ? roomObj.name : classId;
                          const studentCount = roomObj ? roomObj.studentList.length : 0;
                          return (
                            <span
                              key={classId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-xs rounded-xl shadow-sm"
                            >
                              <span>{nameDisplay}</span>
                              <span className="text-[10px] text-emerald-400/70 font-mono">({studentCount} al.)</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTargetClass(classId);
                                }}
                                className="hover:text-rose-400 text-emerald-400 cursor-pointer ml-0.5"
                                title="Remover turma"
                              >
                                <X className="w-3.5 h-3.5" />
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-neutral-400 pl-1 font-medium">
                          Clique para buscar e adicionar turmas/salas...
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isRoomDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown Card */}
                  {isRoomDropdownOpen && (
                    <div className="mt-2 p-4 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl space-y-3 z-30 animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Buscar turma ou sala por nome..."
                            value={roomSearchTerm}
                            onChange={(e) => setRoomSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none placeholder-neutral-500"
                          />
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setSelectedTargetClasses(getTeacherRooms().map(r => r.id))}
                            className="text-emerald-400 font-bold hover:underline cursor-pointer"
                          >
                            Marcar Todas
                          </button>
                          <span className="text-neutral-700">•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedTargetClasses([])}
                            className="text-neutral-500 font-semibold hover:text-neutral-300 cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                        {getTeacherRooms()
                          .filter(r => !roomSearchTerm.trim() || r.name.toLowerCase().includes(roomSearchTerm.toLowerCase()))
                          .map((room) => {
                            const isSelected = selectedTargetClasses.includes(room.id);
                            return (
                              <div
                                key={room.id}
                                onClick={() => handleToggleTargetClass(room.id)}
                                className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-200 font-semibold'
                                    : 'bg-neutral-900/40 border-neutral-850 hover:bg-neutral-900 text-neutral-400'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">{room.type === 'official' ? '🏛️' : '💬'}</span>
                                  <span className="text-xs font-semibold text-neutral-200">{room.name}</span>
                                  <span className="text-[10px] text-neutral-500 font-mono">({room.studentList.length} alunos)</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="h-3.5 w-3.5 text-emerald-500 accent-emerald-500 cursor-pointer"
                                />
                              </div>
                            );
                          })}
                      </div>

                      <div className="flex justify-end pt-1 border-t border-neutral-900">
                        <button
                          type="button"
                          onClick={() => setIsRoomDropdownOpen(false)}
                          className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 font-semibold text-xs rounded-xl hover:bg-emerald-500/30 cursor-pointer transition-colors"
                        >
                          Concluído
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SELETOR 2: ALUNOS INDIVIDUAIS ESPECÍFICOS */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>2. Seletor de Alunos Individuais</span>
                  </label>
                  {selectedTargetStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTargetStudents([])}
                      className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Limpar alunos ({selectedTargetStudents.length})
                    </button>
                  )}
                </div>

                {/* Dropdown Trigger Box */}
                <div className="relative">
                  <div
                    onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                    className="w-full min-h-[46px] p-2.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {selectedTargetStudents.length > 0 ? (
                        selectedTargetStudents.map((emailLower) => {
                          const studentObj = students.find(st => st.email.toLowerCase().trim() === emailLower);
                          const nameDisplay = studentObj?.nome_completo || emailLower;
                          const turmaDisplay = studentObj?.turma ? ` (${studentObj.turma})` : '';
                          return (
                            <span
                              key={emailLower}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-xs rounded-xl shadow-sm"
                            >
                              <span className="truncate max-w-[200px]">{nameDisplay}{turmaDisplay}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTargetStudent(emailLower);
                                }}
                                className="hover:text-rose-400 text-emerald-400 cursor-pointer ml-0.5"
                                title="Remover aluno"
                              >
                                <X className="w-3.5 h-3.5" />
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-neutral-400 pl-1 font-medium">
                          Clique para buscar e adicionar aluno...
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isStudentDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown Card */}
                  {isStudentDropdownOpen && (
                    <div className="mt-2 p-4 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl space-y-3 z-30 animate-fadeIn">
                      {(() => {
                        const teacherRooms = getTeacherRooms();
                        const teacherStudentsMap = new Map<string, any>();
                        teacherRooms.forEach(room => {
                          (room.studentList || []).forEach((st: any) => {
                            if (st && st.email) {
                              teacherStudentsMap.set(st.email.toLowerCase().trim(), st);
                            }
                          });
                        });
                        const allTeacherStudents = Array.from(teacherStudentsMap.values());

                        let filteredList = allTeacherStudents;
                        if (studentRoomFilter !== 'ALL') {
                          const targetRoom = teacherRooms.find(r => r.id === studentRoomFilter);
                          filteredList = targetRoom ? targetRoom.studentList : [];
                        }

                        if (studentSearchTerm.trim()) {
                          const term = studentSearchTerm.toLowerCase();
                          filteredList = filteredList.filter(st =>
                            (st.nome_completo && st.nome_completo.toLowerCase().includes(term)) ||
                            (st.email && st.email.toLowerCase().includes(term))
                          );
                        }

                        return (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                                <input
                                  type="text"
                                  placeholder="Clique para buscar e adicionar aluno..."
                                  value={studentSearchTerm}
                                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none placeholder-neutral-500"
                                />
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-neutral-500 font-semibold">Sala:</span>
                                <select
                                  value={studentRoomFilter}
                                  onChange={(e) => setStudentRoomFilter(e.target.value)}
                                  className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 outline-none focus:border-emerald-500/50 cursor-pointer"
                                >
                                  <option value="ALL">Todas as Suas Salas ({allTeacherStudents.length})</option>
                                  {teacherRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.studentList.length})</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Options List */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                                <span>{filteredList.length} aluno(s) encontrado(s):</span>
                                {filteredList.length > 0 && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAllInRoom(filteredList)}
                                      className="text-emerald-400 hover:underline font-bold cursor-pointer"
                                    >
                                      Marcar visíveis
                                    </button>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeselectAllInRoom(filteredList)}
                                      className="text-neutral-500 hover:text-neutral-300 font-semibold cursor-pointer"
                                    >
                                      Desmarcar
                                    </button>
                                  </div>
                                )}
                              </div>

                              {filteredList.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic py-3 text-center">Nenhum aluno encontrado para a busca em suas salas.</p>
                              ) : (
                                <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
                                  {filteredList.map((st) => {
                                    const isSelected = selectedTargetStudents.includes(st.email.toLowerCase().trim());
                                    const displayName = st.nome_completo || st.email;
                                    const roomLabel = st.turma ? ` (${st.turma})` : '';
                                    return (
                                      <div
                                        key={st.id || st.email}
                                        onClick={() => handleToggleTargetStudent(st.email)}
                                        className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'bg-emerald-500/20 text-emerald-200 font-semibold border border-emerald-500/40'
                                            : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 border border-transparent'
                                        }`}
                                      >
                                        <span className="truncate">{displayName}{roomLabel}</span>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {}}
                                          className="h-3.5 w-3.5 text-emerald-500 accent-emerald-500 cursor-pointer ml-2 shrink-0"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}

                      <div className="flex justify-end pt-1 border-t border-neutral-900">
                        <button
                          type="button"
                          onClick={() => setIsStudentDropdownOpen(false)}
                          className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 font-semibold text-xs rounded-xl hover:bg-emerald-500/30 cursor-pointer transition-colors"
                        >
                          Concluído
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step Footer Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-900 gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Detalhes (Passo 1)</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    <span>Salvar Rascunho</span>
                  </button>

                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    <span>Avançar para Adicionar Questões (Passo 3)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CRIAR / BUSCAR QUESTÕES */}
          {currentStep === 3 && (
            <div className="w-full space-y-6 animate-fadeIn">
              <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6">
                
                {/* Header & Total Points Summary */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-400" />
                      <span>Passo 3: Elaboração das Questões</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      Crie questões manuais, defina a pontuação individual de cada uma, importe do ENEM ou escolha do seu <strong className="text-emerald-400">Banco Pessoal</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-right">
                      <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Valor Total da Prova</span>
                      <span className="text-sm font-extrabold font-mono text-emerald-400">
                        {questions.reduce((sum, q) => sum + (q.points !== undefined ? q.points : 1.0), 0).toFixed(1)} Pts
                      </span>
                      <span className="text-[10px] text-neutral-500 block">({questions.length} questões)</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs rounded-full">Etapa 3 de 4</span>
                  </div>
                </div>



                {/* Mode Selector Tabs */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-neutral-950 border border-neutral-900 rounded-2xl w-full">
                  <button
                    type="button"
                    onClick={() => setActiveQuestionTab('manual')}
                    className={`flex-1 min-w-[140px] sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeQuestionTab === 'manual'
                        ? 'bg-emerald-500 text-neutral-950 shadow-md'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar Questão Manualmente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuestionTab('enem');
                      setViewMode('enem-search');
                      setEnemQuestions([]);
                      setEnemError('');
                    }}
                    className={`flex-1 min-w-[140px] sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeQuestionTab === 'enem'
                        ? 'bg-amber-500 text-neutral-950 shadow-md'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buscar no Banco do ENEM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPersonalBankOpen(true)}
                    className="flex-1 min-w-[140px] sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 shadow-md"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Meu Banco Pessoal ({personalQuestions.length})</span>
                  </button>
                </div>

                {/* SECTION 1: CREATED QUESTIONS STREAM (Full Width Cards) */}
                {questions.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                      <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-2 font-mono">
                        <ClipboardList className="w-4 h-4 text-emerald-400" />
                        <span>Questões Já Adicionadas a esta Prova ({questions.length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setQuestions([])}
                        className="text-xs text-rose-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir Todas as Questões</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className={`p-5 rounded-2xl bg-neutral-950 border transition-all space-y-3 relative group shadow-md ${
                            editingQuestionId === q.id
                              ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/5'
                              : 'border-emerald-500/20 hover:border-emerald-500/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs rounded-lg border border-emerald-500/30">
                                Questão {idx + 1}
                              </span>
                              <span className="px-2.5 py-1 bg-neutral-900 text-neutral-300 text-xs font-semibold rounded-lg border border-neutral-800">
                                {q.type === 'multiple' ? 'Múltipla Escolha' : 'Discursiva (Texto)'}
                              </span>
                              {q.isEnem && (
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-lg">
                                  ⚡ ENEM {q.enemYear || ''}
                                </span>
                              )}
                              {editingQuestionId === q.id && (
                                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg animate-pulse font-mono">
                                  ✏️ Em edição no formulário
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Point Value Configurator with +/- 0.25 buttons */}
                              <div className="flex items-center gap-1.5 bg-neutral-900/80 border border-neutral-800 px-3 py-1 rounded-xl">
                                <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider font-mono">Valendo:</span>
                                <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = q.points !== undefined ? q.points : 1.0;
                                      const next = Math.max(0, Math.round((cur - 0.25) * 100) / 100);
                                      handleUpdateQuestionPoints(q.id, next);
                                    }}
                                    className="w-6 h-6 rounded bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-200 font-black text-xs flex items-center justify-center transition-all cursor-pointer select-none"
                                    title="Diminuir 0.25 pt"
                                  >
                                    -
                                  </button>
                                  <span className="w-10 text-center text-emerald-400 font-mono font-extrabold text-xs select-none">
                                    {(() => {
                                      const pts = q.points !== undefined ? q.points : 1.0;
                                      return pts % 1 === 0 ? pts.toString() : pts.toFixed(2);
                                    })()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = q.points !== undefined ? q.points : 1.0;
                                      const next = Math.min(100, Math.round((cur + 0.25) * 100) / 100);
                                      handleUpdateQuestionPoints(q.id, next);
                                    }}
                                    className="w-6 h-6 rounded bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-200 font-black text-xs flex items-center justify-center transition-all cursor-pointer select-none"
                                    title="Aumentar 0.25 pt"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-xs font-bold text-neutral-400">pt(s)</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(q)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                  editingQuestionId === q.id
                                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                                }`}
                                title="Editar enunciado, alternativas, gabarito ou pontuação desta questão"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{editingQuestionId === q.id ? 'Editando' : 'Editar'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(q.id)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg transition-all cursor-pointer"
                                title="Remover questão"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Full Question Text */}
                          <p className="text-xs sm:text-sm font-semibold text-neutral-200 leading-relaxed whitespace-pre-wrap">{q.text}</p>

                          {/* Attached Images */}
                          {q.imageUrls && q.imageUrls.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                              {q.imageUrls.map((img, imgIdx) => (
                                <div key={imgIdx} className="rounded-xl overflow-hidden border border-neutral-850 aspect-video bg-neutral-950">
                                  <img src={img} alt={`Imagem ${imgIdx+1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          ) : q.imageUrl ? (
                            <div className="rounded-xl overflow-hidden border border-neutral-850 max-h-40 w-fit bg-neutral-950 p-1">
                              <img src={q.imageUrl} alt="Imagem da questão" className="max-h-36 object-contain" />
                            </div>
                          ) : null}

                          {/* Options Preview for Multiple Choice */}
                          {q.type === 'multiple' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-2 border-t border-neutral-900">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                    q.correctOption === oIdx
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                                      : 'bg-neutral-900/50 border-neutral-850 text-neutral-400'
                                  }`}
                                >
                                  <span>{String.fromCharCode(65 + oIdx)}) {opt}</span>
                                  {q.correctOption === oIdx && (
                                    <span className="text-[10px] font-mono uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                                      ✓ Correta
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Written Response Area Preview */}
                          {q.type === 'written' && (
                            <div className="space-y-2">
                              <div className="p-3 rounded-xl bg-neutral-900/30 border border-dashed border-neutral-800 text-xs text-neutral-500 font-mono italic">
                                ✍️ Espaço para o estudante redigir a resposta dissertativa em texto livre.
                              </div>
                              {q.correctionType === 'ai' ? (
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-sans space-y-1">
                                  <div className="font-extrabold flex items-center gap-1.5 font-mono">
                                    <span>🤖 Correção Automática por IA Ativada (Athenas AI)</span>
                                  </div>
                                  <p className="text-[11px] text-neutral-300">
                                    <strong className="text-emerald-400 font-mono">Gabarito para IA:</strong> "{q.expectedAnswer}"
                                  </p>
                                </div>
                              ) : (
                                <div className="text-[10px] text-neutral-500 font-mono">
                                  📝 Modo de correção: Manual pela Professora
                                </div>
                              )}
                            </div>
                          )}

                          {q.explanation && (
                            <p className="text-xs text-neutral-450 bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-850 font-sans italic">
                              <strong className="text-emerald-400 not-italic">Gabarito comentado:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 2: CREATE / EDIT QUESTION FORM CARD */}
                {activeQuestionTab === 'manual' ? (
                  <div id="question-creator-form" className={`p-6 rounded-3xl bg-neutral-950 border transition-all space-y-5 shadow-lg relative ${editingQuestionId ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-emerald-500/30'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-900 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-neutral-100 flex items-center gap-2">
                          {editingQuestionId ? (
                            <>
                              <Edit3 className="w-4 h-4 text-amber-400" />
                              <span className="text-amber-300">Editando Questão #{questions.findIndex(q => q.id === editingQuestionId) + 1}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-emerald-400" />
                              <span>Adicionar Nova Questão (#{questions.length + 1})</span>
                            </>
                          )}
                        </h4>
                        {editingQuestionId && (
                          <button
                            type="button"
                            onClick={handleCancelEditQuestion}
                            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer border border-neutral-800"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancelar Edição</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQType('multiple')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            qType === 'multiple'
                              ? 'bg-emerald-500 text-neutral-950 shadow-md'
                              : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Múltipla Escolha
                        </button>
                        <button
                          type="button"
                          onClick={() => setQType('written')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            qType === 'written'
                              ? 'bg-emerald-500 text-neutral-950 shadow-md'
                              : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Discursiva (Texto)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">
                          Enunciado da Pergunta *
                        </label>
                        <textarea
                          placeholder="Digite aqui o texto da questão com clareza..."
                          rows={3}
                          value={qText}
                          onChange={(e) => setQText(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none transition-all placeholder-neutral-600 resize-none"
                        />
                      </div>

                      <div className="space-y-3 bg-neutral-900/50 p-3.5 border border-neutral-850 rounded-2xl">
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">
                            Pontuação da Questão *
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl p-1">
                              <button
                                type="button"
                                onClick={() => setQPoints(prev => Math.max(0, Math.round((prev - 0.25) * 100) / 100))}
                                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-850 active:scale-95 text-neutral-200 font-black text-sm flex items-center justify-center transition-all cursor-pointer select-none"
                                title="Diminuir 0.25 pt"
                              >
                                -
                              </button>
                              <span className="font-mono font-extrabold text-sm text-emerald-400 select-none px-2">
                                {qPoints % 1 === 0 ? qPoints.toString() : qPoints.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQPoints(prev => Math.min(100, Math.round((prev + 0.25) * 100) / 100))}
                                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-850 active:scale-95 text-neutral-200 font-black text-sm flex items-center justify-center transition-all cursor-pointer select-none"
                                title="Aumentar 0.25 pt"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs font-bold text-neutral-400 shrink-0">pt(s)</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 mt-1 block leading-tight">
                            Defina o peso/pontos desta pergunta individualmente.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">
                            Gabarito Comentado (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Justificativa da resposta"
                            value={qExplanation}
                            onChange={(e) => setQExplanation(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none placeholder-neutral-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image Attachments */}
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400">Anexar Imagens (Máx 4)</label>
                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="q-image-upload"
                          className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                          <Plus className="w-4 h-4 text-emerald-400" />
                          <span>Upload de Imagem ({qImages.length}/4)</span>
                        </label>
                        <input
                          type="file"
                          id="q-image-upload"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        {qImages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setQImages([])}
                            className="text-xs text-rose-400 font-semibold cursor-pointer hover:underline"
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      {qImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-2">
                          {qImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-neutral-850 bg-neutral-900 flex items-center justify-center group/preview">
                              <img src={img} alt={`Preview ${idx+1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveUploadedImage(idx)}
                                className="absolute top-1 right-1 bg-black/75 hover:bg-black rounded-full p-1 text-white hover:text-red-400 transition-all opacity-0 group-hover/preview:opacity-100 cursor-pointer"
                                title="Remover imagem"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Options for Multiple Choice or Written Correction Config */}
                    {qType === 'multiple' ? (
                      <div className="space-y-3 p-4 bg-neutral-900/40 border border-neutral-850 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          Alternativas de Resposta (Múltipla Escolha)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {qOptions.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="correct-option-radio"
                                checked={qCorrectIndex === oIdx}
                                onChange={() => setQCorrectIndex(oIdx)}
                                className="text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 w-4 h-4"
                                title="Marcar como alternativa correta"
                              />
                              <input
                                type="text"
                                placeholder={`Alternativa ${String.fromCharCode(65 + oIdx)}`}
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...qOptions];
                                  updated[oIdx] = e.target.value;
                                  setQOptions(updated);
                                }}
                                className="flex-1 px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 placeholder-neutral-600"
                              />
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-neutral-500 block">
                          💡 Marque a opção de rádio da alternativa que deve ser considerada o Gabarito Correto.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 bg-neutral-900/40 border border-neutral-850 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          Método de Correção da Questão Dissertativa
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setQCorrectionType('manual')}
                            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              qCorrectionType === 'manual'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <div className="p-1.5 rounded-lg bg-neutral-900 shrink-0 text-sm">📝</div>
                            <div>
                              <div className="text-xs font-extrabold text-neutral-200">1. Correção Manual</div>
                              <div className="text-[10px] text-neutral-400 font-normal mt-0.5">A professora corrige individualmente a resposta de cada aluno no painel.</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setQCorrectionType('ai')}
                            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              qCorrectionType === 'ai'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 text-sm">🤖</div>
                            <div>
                              <div className="text-xs font-extrabold text-neutral-200 flex items-center gap-1.5">
                                <span>2. Correção Automática por IA</span>
                                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] rounded font-mono">Athenas AI</span>
                              </div>
                              <div className="text-[10px] text-neutral-400 font-normal mt-0.5">A IA analisa a resposta do aluno em segundo plano assim que ele finaliza a prova.</div>
                            </div>
                          </button>
                        </div>

                        {qCorrectionType === 'ai' && (
                          <div className="mt-3 p-3.5 bg-neutral-950 border border-emerald-500/30 rounded-xl space-y-2 animate-fadeIn">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                              🎯 Gabarito / Resposta Esperada para a IA utilizar como base *
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Escreva como seria a resposta correta ou quais tópicos fundamentais o aluno deve abordar para a IA ter base na avaliação..."
                              value={qExpectedAnswer}
                              onChange={(e) => setQExpectedAnswer(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none placeholder-neutral-600 resize-none font-sans"
                            />
                            <span className="text-[10px] text-neutral-400 block leading-tight">
                              💡 A IA comparará este gabarito com a pergunta e a resposta do aluno para atribuir: <strong>Correto (100% dos pontos)</strong>, <strong>Meio Certo (50%)</strong> ou <strong>Errado (0%)</strong>. Você poderá editar a nota da IA se desejar.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className={`w-full py-3.5 active:scale-[0.99] text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                        editingQuestionId
                          ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20'
                      }`}
                    >
                      {editingQuestionId ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Salvar Alterações na Questão #{questions.findIndex(q => q.id === editingQuestionId) + 1} ({qPoints || 1.0} pt)</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Adicionar Questão #{questions.length + 1} ao Simulado ({qPoints || 1.0} pt)</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* ENEM BANCO SEARCH SHORTCUT */
                  <div className="p-6 bg-neutral-950 border border-neutral-900 rounded-2xl space-y-4 text-center">
                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-neutral-200">Banco Oficial do ENEM</h4>
                      <p className="text-xs text-neutral-450 max-w-md mx-auto mt-1">
                        Pesquise por ano, matéria ou palavras-chave para incluir questões reais das provas do ENEM com um único clique!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('enem-search');
                        setEnemQuestions([]);
                        setEnemError('');
                      }}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      <span>Abrir Painel de Busca do ENEM</span>
                    </button>
                  </div>
                )}

                {/* Step Footer Navigation */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-900 gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar para Alvos (Passo 2)</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4 text-amber-400" />
                      <span>Salvar Rascunho</span>
                    </button>

                    <button
                      type="button"
                      onClick={goToNextStep}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      <span>Avançar para Revisar & Publicar (Passo 4)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVISAR E PUBLICAR */}
          {currentStep === 4 && (
            <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div>
                  <h3 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Passo 4: Revisão e Publicação Final</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Confira todos os parâmetros do seu simulado antes de disponibilizá-lo para os alunos.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs rounded-full">Etapa 4 de 4</span>
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-2xl space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block">Simulado</span>
                  <p className="text-sm font-extrabold text-neutral-100">{simTitle}</p>
                  <p className="text-xs text-emerald-400 font-semibold">{teacherSubject}</p>
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-2xl space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block">Público Alvo</span>
                  <p className="text-xs font-bold text-neutral-200">
                    {selectedTargetClasses.length} Sala(s) inteira(s)
                  </p>
                  <p className="text-xs font-bold text-neutral-200">
                    {selectedTargetStudents.length} Aluno(s) individual(ais)
                  </p>
                </div>

                <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-2xl space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block">Regras de Execução</span>
                  <p className="text-xs font-semibold text-neutral-200">
                    Prazo: {simDeadline ? new Date(simDeadline).toLocaleString('pt-BR') : 'Sem prazo'}
                  </p>
                  <p className="text-xs font-semibold text-neutral-200">
                    Duração: {simDuration ? `${simDuration} minutos` : 'Livre'}
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    <span className={`px-2 py-0.5 text-[9px] font-mono rounded ${isControlled ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {isControlled ? '🔒 Controlado (Anticola)' : '🟢 Normal (Livre)'}
                    </span>
                    {shuffleQuestions && <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">🔀 Questões</span>}
                    {shuffleOptions && <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">🔀 Opções</span>}
                  </div>
                </div>
              </div>

              {/* Questions Preview Box */}
              <div className="p-5 bg-neutral-950 border border-neutral-900 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Resumo do Conteúdo ({questions.length} questões)</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePreviewExam(null);
                      setViewMode('preview-student');
                    }}
                    className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Testar Pré-visualização como Aluno</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-2.5 bg-neutral-900/40 border border-neutral-900 rounded-xl text-xs text-neutral-300 flex justify-between items-center">
                      <span className="font-semibold truncate max-w-xl">Q{idx + 1}. {q.text}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">{q.type === 'multiple' ? 'Múltipla Escolha' : 'Discursiva'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Publish Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-900 flex-wrap">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="w-full sm:w-auto px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Questões (Passo 3)</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    <span>Salvar Rascunho</span>
                  </button>

                  {editingExamId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePublishExam}
                    disabled={isSaving || questions.length === 0}
                    className="flex-1 sm:flex-initial px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isSaving ? "Salvando..." : editingExamId ? "Salvar e Publicar Alterações" : "🚀 Confirmar e Publicar Simulado Agora"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CREATED SIMULADOS DRAWER / LIST AT THE BOTTOM */}
          <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-neutral-300">
                    Todos os Simulados e Rascunhos ({simulados.length})
                  </h4>
                  <span className="text-[10px] text-neutral-500 font-mono font-medium">
                    ({publishedSimulados.length} publicado{publishedSimulados.length === 1 ? '' : 's'} • {draftSimulados.length} rascunho{draftSimulados.length === 1 ? '' : 's'})
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 block mt-0.5">
                  💡 Clique no ícone de lápis para carregar qualquer simulado no assistente de criação.
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setBottomDrawerFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    bottomDrawerFilter === 'all'
                      ? 'bg-neutral-800 text-neutral-200 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Todos ({simulados.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomDrawerFilter('published')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    bottomDrawerFilter === 'published'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Publicados ({publishedSimulados.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomDrawerFilter('drafts')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    bottomDrawerFilter === 'drafts'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Rascunhos ({draftSimulados.length})
                </button>
              </div>
            </div>

            {filteredBottomSimulados.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">
                {bottomDrawerFilter === 'published'
                  ? 'Nenhum simulado publicado ainda.'
                  : bottomDrawerFilter === 'drafts'
                  ? 'Nenhum rascunho salvo no momento.'
                  : 'Nenhum simulado cadastrado ainda.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                {filteredBottomSimulados.map((sim) => {
                  const { settings } = parseExamSettings(sim.description || '');
                  const isDraft = settings.is_draft === true;

                  return (
                    <div
                      key={sim.id}
                      className={`p-3.5 rounded-2xl flex justify-between items-center gap-3 transition-all ${
                        isDraft
                          ? 'bg-amber-950/10 border border-amber-500/25 hover:border-amber-500/45'
                          : 'bg-neutral-950 border border-neutral-900 hover:border-neutral-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDraft ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                              📝 Rascunho
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                              🚀 Publicado
                            </span>
                          )}
                          <button
                            onClick={() => handleEditSimulado(sim)}
                            className="text-xs font-bold text-neutral-200 line-clamp-1 hover:text-emerald-400 text-left cursor-pointer transition-colors"
                            title={sim.title}
                          >
                            {sim.title}
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 font-mono truncate mt-1">
                          {formatTargetDisplayName(sim.class_name, virtualClasses)} • {sim.questions?.length || 0} q.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setActivePreviewExam(sim);
                            setViewMode('preview-student');
                          }}
                          className="text-neutral-500 hover:text-amber-400 p-1.5 rounded transition-all cursor-pointer"
                          title="Visualizar como Aluno"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditSimulado(sim)}
                          className="text-neutral-500 hover:text-emerald-400 p-1.5 rounded transition-all cursor-pointer"
                          title="Editar simulado"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateSimulado(sim)}
                          className="text-neutral-500 hover:text-blue-400 p-1.5 rounded transition-all cursor-pointer"
                          title="Duplicar simulado"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSimulado(sim.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1.5 rounded transition-all cursor-pointer"
                          title="Deletar simulado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RESULTS TAB MODE */
        <div className="space-y-6">
          {!selectedExamId ? (
            /* MODE A: CARDS OF EXISTING SIMULADOS */
            <div className="space-y-6 animate-fadeIn">
              {/* Header & Filter Bar */}
              <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      <span>Resultados dos Simulados Existentes</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      Selecione um dos simulados abaixo para visualizar relatórios detalhados, métricas gerais de desempenho e notas individuais da turma.
                    </p>
                  </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-900/60">
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Pesquisar por título ou matéria..."
                      value={resultsSearchTerm}
                      onChange={(e) => setResultsSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none"
                    />
                  </div>

                  <div>
                    <select
                      value={resultsClassFilter}
                      onChange={(e) => setResultsClassFilter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-300 outline-none cursor-pointer"
                    >
                      <option value="">Todas as Turmas / Salas</option>
                      {uniqueOfficialClasses.map(cls => (
                        <option key={`cls-${cls}`} value={cls}>Turma: {cls}</option>
                      ))}
                      {uniqueVirtualClassesForFilter.map(vc => (
                        <option key={`vc-${vc.id}`} value={vc.id}>Sala Virtual: {vc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Simulados Cards Grid */}
              {(() => {
                const filteredSims = simulados.filter(sim => {
                  const matchesSearch = !resultsSearchTerm || 
                    sim.title.toLowerCase().includes(resultsSearchTerm.toLowerCase()) || 
                    (sim.subject && sim.subject.toLowerCase().includes(resultsSearchTerm.toLowerCase()));
                  
                  if (!matchesSearch) return false;
                  if (!resultsClassFilter) return true;

                  const selectedVCItem = uniqueVirtualClassesForFilter.find(
                    vc => vc.id === resultsClassFilter || vc.name.toLowerCase() === resultsClassFilter.toLowerCase()
                  );

                  const targetClassStr = (sim.class_name || '').toLowerCase();
                  const filterStr = resultsClassFilter.toLowerCase();

                  // Direct match with official class or raw filter string
                  if (targetClassStr === filterStr || targetClassStr.includes(filterStr)) {
                    return true;
                  }

                  // Match with deduplicated virtual class item (by name or any associated IDs)
                  if (selectedVCItem) {
                    const vcNameLower = selectedVCItem.name.toLowerCase();
                    if (targetClassStr === vcNameLower || targetClassStr.includes(vcNameLower)) {
                      return true;
                    }
                    if (selectedVCItem.allIds.some(id => id && targetClassStr.includes(id.toLowerCase()))) {
                      return true;
                    }
                  }

                  // Target matcher check as backup for complex comma-separated targets
                  const isTargetMatch = matchesStudentTarget(
                    sim.class_name,
                    '',
                    resultsClassFilter,
                    selectedVCItem ? [selectedVCItem.id, ...selectedVCItem.allIds, selectedVCItem.name] : [resultsClassFilter]
                  );

                  return isTargetMatch;
                });

                if (filteredSims.length === 0) {
                  return (
                    <div className="py-16 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 space-y-3">
                      <BookOpen className="w-10 h-10 text-neutral-700 mx-auto" />
                      <h4 className="text-sm font-bold text-neutral-400">Nenhum simulado encontrado</h4>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        {simulados.length === 0 
                          ? "Você ainda não possui simulados criados. Clique no botão '+ Criar Novo Simulado' para iniciar."
                          : "Tente alterar os termos da busca ou os filtros de turma acima."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSims.map((sim) => {
                      const simSubmissions = submissions.filter(s => s.mock_exam_id === sim.id);
                      const subCount = simSubmissions.length;
                      const scores = simSubmissions.map(s => s.score);
                      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
                      const { settings } = parseExamSettings(sim.description || '');

                      return (
                        <div
                          key={sim.id}
                          className="p-6 bg-neutral-950/60 border border-neutral-900 hover:border-neutral-800 rounded-3xl space-y-4 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-emerald-500/5"
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2 flex-wrap">
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold rounded-lg uppercase">
                                {sim.subject || 'Simulado'}
                              </span>
                              {settings.is_controlled ? (
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Controlado</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-neutral-900 text-neutral-400 border border-neutral-850 text-[10px] font-mono font-bold rounded-lg">
                                  Livre
                                </span>
                              )}
                            </div>

                            <div>
                              <h4 className="text-base font-bold text-neutral-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
                                {sim.title}
                              </h4>
                              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                                Turma/Público: <span className="text-neutral-300 font-medium">{formatTargetDisplayName(sim.class_name, virtualClasses)}</span>
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-neutral-400 border-t border-neutral-900">
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{sim.questions?.length || 0} Questões</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{settings.duration_minutes ? `${settings.duration_minutes} min` : 'Tempo Livre'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-neutral-900/80 space-y-3">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Entregas</span>
                              <span className="text-neutral-200 font-bold flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{subCount} enviada(s)</span>
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Média da Turma</span>
                              <span className={avgScore !== null ? (Number(avgScore) >= 7 ? "text-emerald-400 font-extrabold" : "text-amber-400 font-extrabold") : "text-neutral-600"}>
                                {(() => {
                                  if (avgScore === null) return 'Sem entregas';
                                  const qList = sim.questions ? (typeof sim.questions === 'string' ? JSON.parse(sim.questions) : sim.questions) : [];
                                  const simTotalPts = sim.total_points || (Array.isArray(qList) && qList.length > 0 ? qList.reduce((acc: number, q: any) => acc + (q.points || 1.0), 0) : 10);
                                  return `${avgScore} / ${simTotalPts.toFixed(1)}`;
                                })()}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedExamId(sim.id);
                                if (sim.class_name) {
                                  setSelectedClass(sim.class_name);
                                }
                              }}
                              className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-neutral-950 border border-emerald-500/30 hover:border-emerald-500 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-emerald-500/10"
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Ver Resultados</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* MODE B: DETAILED REPORT FOR A SELECTED SIMULADO */
            (() => {
              const currentExam = simulados.find(ex => ex.id === selectedExamId);
              if (!currentExam) {
                return (
                  <div className="p-8 text-center text-neutral-400">
                    Simulado não encontrado.
                    <button onClick={() => setSelectedExamId('')} className="block mx-auto mt-4 text-xs text-emerald-400 underline">Voltar</button>
                  </div>
                );
              }

              const { cleanDescription, settings: currentSettings } = parseExamSettings(currentExam.description || '');
              
              // Filter target students for this exam
              const targetStudents = students.filter(st => {
                const studentVCs = getStudentVirtualClassIdentifiers(st.email, virtualClasses);
                const isTargeted = matchesStudentTarget(
                  currentExam.class_name,
                  st.email,
                  st.turma || st.cohort || '',
                  studentVCs
                );
                const hasSub = submissions.some(sub => sub.mock_exam_id === currentExam.id && sub.student_email.toLowerCase() === st.email.toLowerCase());
                return isTargeted || hasSub;
              });

              // Submissions for this exam
              const examSubmissions = submissions.filter(s => s.mock_exam_id === currentExam.id);
              const scores = examSubmissions.map(s => s.score);
              const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
              const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
              const minScore = scores.length > 0 ? Math.min(...scores) : 0;

              const currentExamQuestions: any[] = currentExam.questions ? (typeof currentExam.questions === 'string' ? JSON.parse(currentExam.questions) : currentExam.questions) : [];
              const totalExamPoints = currentExam.total_points || (Array.isArray(currentExamQuestions) && currentExamQuestions.length > 0 ? currentExamQuestions.reduce((acc: number, q: any) => acc + (q.points !== undefined && q.points > 0 ? Number(q.points) : 1.0), 0) : 10);
              
              // Average time calculation
              let totalTimeSum = 0;
              let countWithTime = 0;
              examSubmissions.forEach(sub => {
                let tel = sub.telemetry;
                if (typeof tel === 'string') {
                  try { tel = JSON.parse(tel); } catch { tel = null; }
                }
                if (tel && tel.totalTimeSeconds) {
                  totalTimeSum += tel.totalTimeSeconds;
                  countWithTime++;
                }
              });
              const avgTimeSec = countWithTime > 0 ? Math.round(totalTimeSum / countWithTime) : 0;
              const avgTimeText = avgTimeSec > 0 ? `${Math.floor(avgTimeSec / 60)} min ${avgTimeSec % 60} s` : 'N/A';

              const completionRate = targetStudents.length > 0 ? Math.round((examSubmissions.length / targetStudents.length) * 100) : 0;

              return (
                <div className="space-y-6 animate-fadeIn">
                  {/* Top Bar with Return Button and Actions */}
                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-900 flex justify-between items-center flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedExamId('')}
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4 text-emerald-400" />
                      <span>Voltar para Lista de Simulados</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePreviewExam(currentExam);
                          setViewMode('preview-student');
                        }}
                        className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>Testar como Aluno</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditSimulado(currentExam)}
                        className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-4 h-4 text-emerald-400" />
                        <span>Editar Simulado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSimulado(currentExam)}
                        className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        title="Duplicar Simulado"
                      >
                        <Copy className="w-4 h-4 text-blue-400" />
                        <span>Duplicar Simulado</span>
                      </button>
                    </div>
                  </div>

                  {/* CARD 1: INFORMAÇÕES GERAIS DO SIMULADO */}
                  <div className="p-6 bg-neutral-950/70 border border-neutral-900 rounded-3xl space-y-6 backdrop-blur-md">
                    <div className="flex justify-between items-start flex-wrap gap-4 border-b border-neutral-900 pb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold rounded-md uppercase">
                            {currentExam.subject || 'Biologia'}
                          </span>
                          {currentSettings.is_controlled ? (
                            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold rounded-md flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              <span>Modo Anticola Controlado</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-neutral-900 text-neutral-400 border border-neutral-850 text-[10px] font-mono font-bold rounded-md">
                              Modo Livre
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-extrabold text-neutral-100 font-sans tracking-tight">
                          {currentExam.title}
                        </h2>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono font-bold text-neutral-500 block">ID do Simulado</span>
                        <span className="text-xs font-mono font-semibold text-neutral-400">{currentExam.id.slice(0, 12)}...</span>
                      </div>
                    </div>

                    {/* Detalhes Gerais Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-neutral-900/40 border border-neutral-850/80 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">Público Alvo / Turmas</span>
                        <p className="text-xs font-bold text-neutral-200 line-clamp-1">{formatTargetDisplayName(currentExam.class_name, virtualClasses)}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{targetStudents.length} aluno(s) matriculados</p>
                      </div>

                      <div className="p-4 bg-neutral-900/40 border border-neutral-850/80 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">Prazo de Entrega Final</span>
                        <p className="text-xs font-bold text-neutral-200">
                          {currentExam.deadline ? new Date(currentExam.deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem prazo definido'}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Criado em {new Date(currentExam.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>

                      <div className="p-4 bg-neutral-900/40 border border-neutral-850/80 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">Duração da Prova</span>
                        <p className="text-xs font-bold text-neutral-200">
                          {currentSettings.duration_minutes ? `${currentSettings.duration_minutes} minutos` : 'Tempo Livre'}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{currentExam.questions?.length || 0} questões totais</p>
                      </div>

                      <div className="p-4 bg-neutral-900/40 border border-neutral-850/80 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">Configuração de Sorteio</span>
                        <p className="text-xs font-bold text-neutral-200">
                          Questões: {currentSettings.shuffle_questions ? 'Sim' : 'Não'}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Alternativas: {currentSettings.shuffle_options ? 'Sim' : 'Não'}</p>
                      </div>
                    </div>

                    {/* Descrição / Orientações */}
                    {cleanDescription && (
                      <div className="p-4 bg-neutral-900/30 border border-neutral-850/60 rounded-2xl">
                        <span className="text-[10px] uppercase font-mono font-bold text-neutral-500 tracking-wider block mb-1">Instruções / Orientações do Professor:</span>
                        <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">{cleanDescription}</p>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: INDICADORES E MÉTRICAS DE DESEMPENHO GERAL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-neutral-950/70 border border-neutral-900 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Envios & Entregas</span>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-mono font-extrabold text-neutral-100">
                        {examSubmissions.length} <span className="text-xs font-normal text-neutral-500">/ {targetStudents.length}</span>
                      </p>
                      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(100, completionRate)}%` }} />
                      </div>
                      <p className="text-[10px] text-neutral-450">{completionRate}% de taxa de entrega da turma</p>
                    </div>

                    <div className="p-5 bg-neutral-950/70 border border-neutral-900 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Média Geral da Turma</span>
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-mono font-extrabold text-emerald-400">
                        {avgScore.toFixed(1)} <span className="text-xs font-normal text-neutral-500">/ {totalExamPoints.toFixed(1)} ({Math.round((avgScore / (totalExamPoints || 1)) * 100)}%)</span>
                      </p>
                      <p className="text-[10px] text-neutral-450">
                        {examSubmissions.length > 0 ? (avgScore >= (totalExamPoints * 0.7) ? 'Excelente desempenho médio' : 'Abaixo da meta recomendada') : 'Aguardando primeiros envios'}
                      </p>
                    </div>

                    <div className="p-5 bg-neutral-950/70 border border-neutral-900 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Maior vs Menor Nota</span>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-xl font-mono font-extrabold text-neutral-100">
                        <span className="text-emerald-400">{maxScore.toFixed(1)}</span> <span className="text-neutral-600">|</span> <span className="text-rose-400">{minScore.toFixed(1)}</span> <span className="text-xs font-normal text-neutral-500">/ {totalExamPoints.toFixed(1)}</span>
                      </p>
                      <p className="text-[10px] text-neutral-450">Amplitude total de rendimento</p>
                    </div>

                    <div className="p-5 bg-neutral-950/70 border border-neutral-900 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Tempo Médio de Prova</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-xl font-mono font-extrabold text-neutral-200">
                        {avgTimeText}
                      </p>
                      <p className="text-[10px] text-neutral-450">Duração média de resolução</p>
                    </div>
                  </div>

                  {/* CARD 3: PAINEL DE MONITORAMENTO DE SEGURANÇA */}
                  <div className="p-6 bg-red-950/10 border border-red-500/20 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-4 border-b border-neutral-900 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                          <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 font-sans">
                            <span>Painel de Segurança: Monitor Anticola</span>
                          </h4>
                        </div>
                        <p className="text-neutral-450 text-[11px] mt-0.5">
                          Monitoramento de saídas de tela cheia ou abas adicionais durante a execução da prova.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-extrabold font-mono">
                          {(() => {
                            const count = examSubmissions.filter(s => {
                              let tel = s.telemetry;
                              if (typeof tel === 'string') {
                                try { tel = JSON.parse(tel); } catch { tel = null; }
                              }
                              return tel && ((tel.tabSwitches || 0) >= 1 || tel.violation === true || tel.violation_submitted === true);
                            }).length;
                            return `${count} ALUNO(S) COM SAÍDA DE TELA`;
                          })()}
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const suspiciousSubs = examSubmissions.filter(s => {
                        let tel = s.telemetry;
                        if (typeof tel === 'string') {
                          try { tel = JSON.parse(tel); } catch { tel = null; }
                        }
                        return tel && ((tel.tabSwitches || 0) >= 1 || tel.violation === true || tel.violation_submitted === true);
                      });

                      if (suspiciousSubs.length === 0) {
                        return (
                          <div className="py-4 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-mono font-bold">
                              Segurança Preservada ✅
                            </span>
                            <p className="text-[11px] text-neutral-400 font-medium">
                              Nenhum aluno deste simulado apresentou saídas de tela ou comportamentos suspeitos registrados.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {suspiciousSubs.map(sub => {
                            let tel = sub.telemetry;
                            if (typeof tel === 'string') {
                              try { tel = JSON.parse(tel); } catch { tel = null; }
                            }
                            const tabSwitches = tel?.tabSwitches || 0;
                            const isExpanded = expandedTimelineEmail === sub.student_email;

                            return (
                              <div 
                                key={`susp-${sub.id}`} 
                                className="p-4 bg-neutral-950/60 border border-neutral-900 rounded-2xl space-y-3 transition-all"
                              >
                                <div className="flex justify-between items-start flex-wrap gap-2">
                                  <div>
                                    <h5 className="text-xs font-bold text-neutral-250 flex items-center gap-2">
                                      <span>{sub.student_name}</span>
                                      <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold rounded">
                                        {tabSwitches} Saída(s) de Tela
                                      </span>
                                      {(tel?.violation === true || tel?.violation_submitted === true) && (
                                        <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded animate-pulse">
                                          ENCERRADA POR VIOLAÇÃO
                                        </span>
                                      )}
                                    </h5>
                                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{sub.student_email} • Turma: {sub.student_class}</p>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-550 block">Nota</span>
                                      <span className="text-xs font-mono font-bold text-neutral-200">{sub.score.toFixed(1)} / {totalExamPoints.toFixed(1)}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedTimelineEmail(isExpanded ? null : sub.student_email)}
                                      className="px-3 py-1.5 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <span>{isExpanded ? "Ocultar" : "Ver Timeline"}</span>
                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-neutral-900 pt-4 mt-2 space-y-4">
                                    <h6 className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-500">Timeline de Eventos do Aluno</h6>
                                    {(() => {
                                      const timeline = systemLogs
                                        .filter(log => {
                                          const isSameEmail = log.user_email?.toLowerCase() === sub.student_email.toLowerCase();
                                          const logExamId = log.metadata?.examId || log.metadata?.exam_id;
                                          return isSameEmail && logExamId === selectedExamId;
                                        })
                                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                                      if (timeline.length === 0) {
                                        return <p className="text-[11px] text-neutral-500 italic">Nenhum evento registrado no log.</p>;
                                      }

                                      return (
                                        <div className="relative pl-5 border-l border-neutral-900 space-y-4 pb-2">
                                          {timeline.map((log) => {
                                            const isStart = log.action?.includes('START') || log.action?.includes('RESUME');
                                            const isViolation = log.action?.includes('VIOLATION_FULLSCREEN');
                                            const isBan = log.action?.includes('VIOLATION_AUTO_SUBMIT');
                                            const isSubmit = log.action?.includes('SUBMIT_SIMULADO') || log.action?.includes('TIMEOUT') || log.action?.includes('ABANDON');
                                            
                                            let dotColor = "bg-neutral-700 border-neutral-800";
                                            if (isStart) dotColor = "bg-emerald-500 border-emerald-400";
                                            else if (isViolation) dotColor = "bg-amber-500 border-amber-400";
                                            else if (isBan) dotColor = "bg-red-500 border-red-400";
                                            else if (isSubmit) dotColor = "bg-blue-500 border-blue-400";

                                            const logTime = new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                                            return (
                                              <div key={log.id} className="relative group">
                                                <div className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border ${dotColor} z-10`} />
                                                <div className="space-y-0.5 text-left">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-mono text-neutral-500 font-bold">{logTime}</span>
                                                    <span className="px-1.5 py-0.2 bg-neutral-900 text-neutral-400 border border-neutral-850 rounded text-[9px] font-mono font-bold uppercase">
                                                      {log.action}
                                                    </span>
                                                  </div>
                                                  <p className="text-[11px] text-neutral-350 leading-relaxed max-w-2xl">{log.details}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* CARD 4: TABELA COMPLETA DE ALUNOS E RENDIMENTOS */}
                  <div className="p-6 bg-neutral-950/70 border border-neutral-900 rounded-3xl space-y-4 backdrop-blur-md">
                    <div className="flex justify-between items-center flex-wrap gap-4 border-b border-neutral-900 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                          <Users className="w-5 h-5 text-emerald-400" />
                          <span>Desempenho dos Alunos do Simulado</span>
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Listagem completa dos alunos atribuídos a esta prova, notas obtidas e ações de tempo extra.
                        </p>
                      </div>

                      <div className="relative min-w-[240px]">
                        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por nome ou e-mail..."
                          value={studentReportSearchTerm}
                          onChange={(e) => setStudentReportSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/30">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-450 text-[10px] uppercase tracking-wider font-mono">
                            <th className="px-5 py-3">Chamada</th>
                            <th className="px-5 py-3">Nome Completo do Aluno</th>
                            <th className="px-5 py-3">Email / Turma</th>
                            <th className="px-5 py-3">Status da Entrega</th>
                            <th className="px-5 py-3 text-right">Acertos / Nota</th>
                            <th className="px-5 py-3 text-center">Tempo Gasto</th>
                            <th className="px-5 py-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900 text-neutral-350">
                          {(() => {
                            const filteredTargetStudents = targetStudents.filter(st => {
                              if (!studentReportSearchTerm) return true;
                              const term = studentReportSearchTerm.toLowerCase();
                              return st.nome_completo.toLowerCase().includes(term) || st.email.toLowerCase().includes(term);
                            });

                            if (filteredTargetStudents.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={7} className="px-5 py-8 text-center text-neutral-550">
                                    Nenhum aluno encontrado para este simulado.
                                  </td>
                                </tr>
                              );
                            }

                            return filteredTargetStudents.map((stud, idx) => {
                              const submission = examSubmissions.find(sub => sub.student_email.toLowerCase() === stud.email.toLowerCase());

                              let studentTimeText = "-";
                              if (submission) {
                                let tel = submission.telemetry;
                                if (typeof tel === 'string') {
                                  try { tel = JSON.parse(tel); } catch { tel = null; }
                                }
                                if (tel && tel.totalTimeSeconds) {
                                  const m = Math.floor(tel.totalTimeSeconds / 60);
                                  const s = tel.totalTimeSeconds % 60;
                                  studentTimeText = `${m}m ${s}s`;
                                }
                              }

                              return (
                                <tr key={stud.id || idx} className="hover:bg-neutral-900/20 transition-all">
                                  <td className="px-5 py-4 font-mono font-bold text-neutral-500">#{(stud.numero_chamada !== undefined && stud.numero_chamada !== null) ? stud.numero_chamada : idx + 1}</td>
                                  <td className="px-5 py-4 font-semibold text-neutral-200">
                                    <div className="flex items-center gap-2">
                                      <span>{stud.nome_completo}</span>
                                      {(() => {
                                        const { settings } = parseExamSettings(currentExam?.description || '');
                                        const extraMin = settings.student_extra_time?.[stud.email.toLowerCase()] || 0;
                                        if (extraMin > 0) {
                                          return (
                                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold rounded-full flex items-center gap-1" title="Tempo extra concedido">
                                              <Clock className="w-2.5 h-2.5" />
                                              <span>+{extraMin} min</span>
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 text-neutral-500 font-mono text-[11px]">{stud.email}</td>
                                  <td className="px-5 py-4">
                                    {submission ? (() => {
                                      let hasPendingWritten = false;
                                      const writtenQs = currentExam?.questions?.filter(q => q.type === 'written') || [];
                                      if (writtenQs.length > 0) {
                                        let tel = submission.telemetry;
                                        if (typeof tel === 'string') {
                                          try { tel = JSON.parse(tel); } catch { tel = null; }
                                        }
                                        let mg = submission.manual_grades;
                                        if (typeof mg === 'string') {
                                          try { mg = JSON.parse(mg); } catch { mg = null; }
                                        }
                                        if ((!mg || Object.keys(mg).length === 0) && tel && typeof tel === 'object' && tel.manual_grades) {
                                          mg = tel.manual_grades;
                                        }
                                        if (!mg) mg = {};
                                        hasPendingWritten = writtenQs.some(q => !mg[q.id]);
                                      }

                                      if (hasPendingWritten) {
                                        return (
                                          <div className="flex flex-col gap-1">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center gap-1 w-fit">
                                              <span>⏳</span>
                                              <span>Aguardando Correção</span>
                                            </span>
                                            <span className="text-[9px] text-neutral-500 font-mono">
                                              Entregue às {new Date(submission.submitted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-550/10">
                                          Entregue ✅ ({new Date(submission.submitted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                                        </span>
                                      );
                                    })() : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-neutral-500 border border-neutral-850">
                                        Não Iniciado ⏳
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-5 py-4 text-right font-mono font-semibold">
                                    {submission ? (() => {
                                      let hasPendingWritten = false;
                                      const writtenQs = currentExam?.questions?.filter(q => q.type === 'written') || [];
                                      if (writtenQs.length > 0) {
                                        let tel = submission.telemetry;
                                        if (typeof tel === 'string') {
                                          try { tel = JSON.parse(tel); } catch { tel = null; }
                                        }
                                        let mg = submission.manual_grades;
                                        if (typeof mg === 'string') {
                                          try { mg = JSON.parse(mg); } catch { mg = null; }
                                        }
                                        if ((!mg || Object.keys(mg).length === 0) && tel && typeof tel === 'object' && tel.manual_grades) {
                                          mg = tel.manual_grades;
                                        }
                                        if (!mg) mg = {};
                                        hasPendingWritten = writtenQs.some(q => !mg[q.id]);
                                      }

                                      if (hasPendingWritten) {
                                        const pureWritten = (currentExam?.questions?.filter(q => q.type === 'multiple').length || 0) === 0;
                                        return (
                                          <div className="text-xs">
                                            <span className="text-amber-400 font-bold">
                                              {pureWritten ? '—' : `${submission.score.toFixed(1)}*`}
                                            </span>
                                            <span className="text-neutral-500 font-normal"> / {totalExamPoints.toFixed(1)}</span>
                                            <p className="text-[10px] text-amber-400 font-semibold font-sans">
                                              {pureWritten ? '⏳ Discursiva pendente' : '*Nota parcial'}
                                            </p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="text-xs">
                                          <span className={submission.score >= 7 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                            {submission.score.toFixed(1)}
                                          </span>
                                          <span className="text-neutral-500 font-normal"> / {totalExamPoints.toFixed(1)} ({Math.round((submission.score / (totalExamPoints || 1)) * 100)}%)</span>
                                          <p className="text-[10px] text-neutral-550 font-normal">({submission.correct_count} de {submission.total_questions} acertos)</p>
                                        </div>
                                      );
                                    })() : (
                                      <span className="text-neutral-600">-</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-4 text-center font-mono text-[11px] text-neutral-400">
                                    {studentTimeText}
                                  </td>
                                  <td className="px-5 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {submission && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSubmission(submission)}
                                          className="px-3 py-1.5 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-lg text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>Visualizar Prova</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const { settings } = parseExamSettings(currentExam?.description || '');
                                          const existingExtra = settings.student_extra_time?.[stud.email.toLowerCase()] || 10;
                                          setExtraMinutesInput(existingExtra);
                                          setExtraTimeStudent({ email: stud.email, name: stud.nome_completo });
                                        }}
                                        className="px-3 py-1.5 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 hover:border-amber-500/35 text-neutral-300 rounded-lg text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Tempo Extra</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
        </>
      )}

      {/* ENEM Search Mode */}
      {viewMode === 'enem-search' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header */}
          <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <h2 className="text-lg font-extrabold text-neutral-100 font-sans tracking-tight">Busca de Questões do ENEM</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Busque no banco oficial do ENEM para adicionar questões direto no seu simulado.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewMode('normal');
                  setSelectedEnemQuestions([]);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEnemQuestions}
                disabled={selectedEnemQuestions.length === 0}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>Concluir Seleção ({selectedEnemQuestions.length})</span>
              </button>
            </div>
          </div>

          {/* Filters card */}
          <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-4">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-455 text-neutral-300 flex items-center gap-1">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Filtros de Pesquisa</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Year Selector */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1">Ano do Exame</label>
                <select
                  value={selectedEnemYear}
                  onChange={(e) => setSelectedEnemYear(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-300 outline-none"
                >
                  <option value="">Buscar todos os anos (Top 4)</option>
                  {enemYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              {/* Discipline Selector */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1">Disciplina / Área</label>
                <select
                  value={selectedEnemDiscipline}
                  onChange={(e) => setSelectedEnemDiscipline(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-300 outline-none"
                >
                  <option value="">Todas as disciplinas</option>
                  <option value="matematica">Matemática</option>
                  <option value="linguagens">Linguagens e Códigos</option>
                  <option value="ciencias-natureza">Ciências da Natureza</option>
                  <option value="ciencias-humanas">Ciências Humanas</option>
                </select>
              </div>

              {/* Keyword Search */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1">Palavra-chave no enunciado</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: mecânica, matrizes..."
                    value={enemSearchTerm}
                    onChange={(e) => setEnemSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-300 outline-none placeholder-neutral-700"
                  />
                  <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-neutral-600" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={searchEnemQuestions}
                disabled={loadingEnemQuestions}
                className="px-6 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                {loadingEnemQuestions ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                    <span>Buscando Questões do ENEM...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Realizar Busca no ENEM</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error alerts */}
          {enemError && (
            <div className="p-4 bg-rose-950/20 border border-rose-500/25 rounded-2xl text-xs text-rose-400 flex items-center gap-2 animate-slideUp">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{enemError}</span>
            </div>
          )}

          {/* Results Area */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
                Questões Disponíveis ({enemQuestions.length})
              </span>
              {selectedEnemQuestions.length > 0 && (
                <span className="text-xs text-amber-400 font-extrabold animate-pulse">
                  🌟 {selectedEnemQuestions.length} questão(ões) selecionada(s)
                </span>
              )}
            </div>

            {loadingEnemQuestions ? (
              <div className="py-24 text-center border border-neutral-900 rounded-3xl bg-neutral-950/20 space-y-3">
                <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-neutral-400 font-bold">Consultando API oficial enem.dev...</p>
                <p className="text-[10px] text-neutral-600">Isso pode levar alguns segundos dependendo dos filtros aplicados.</p>
              </div>
            ) : enemQuestions.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10 space-y-2">
                <HelpCircle className="w-12 h-12 text-neutral-750 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-400 font-sans">Nenhum resultado exibido</h4>
                <p className="text-xs text-neutral-500 px-8 max-w-md mx-auto leading-relaxed">Clique no botão "Realizar Busca no ENEM" acima para listar as perguntas ou altere seus termos de filtragem.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {enemQuestions.slice(0, enemPageSize).map((q, qIdx) => {
                    const qId = `enem-${q.year}-${q.index}`;
                    const isSelected = selectedEnemQuestions.some(item => item.id === qId);

                    // Extract and resolve all images safely
                    const localImages: string[] = [];
                    const resolveUrl = (url: string) => {
                      if (!url) return '';
                      url = url.trim();
                      if (url.startsWith('http://') || url.startsWith('https://')) {
                        return url;
                      }
                      if (url.startsWith('/')) {
                        return `https://enem.dev${url}`;
                      }
                      return `https://enem.dev/${url}`;
                    };

                    if (Array.isArray(q.files)) {
                      q.files.forEach((f: any) => {
                        if (typeof f === 'string' && f.trim().length > 0) {
                          localImages.push(resolveUrl(f));
                        } else if (f && typeof f === 'object' && f.url) {
                          localImages.push(resolveUrl(f.url));
                        } else if (f && typeof f === 'object' && f.path) {
                          localImages.push(resolveUrl(f.path));
                        }
                      });
                    }
                    if (typeof q.file === 'string' && q.file.trim().length > 0) {
                      localImages.push(resolveUrl(q.file));
                    }
                    if (Array.isArray(q.images)) {
                      q.images.forEach((img: any) => {
                        if (typeof img === 'string') {
                          localImages.push(resolveUrl(img));
                        } else if (img && img.url) {
                          localImages.push(resolveUrl(img.url));
                        }
                      });
                    }

                    // Scan text and context for embedded image URLs
                    const imageRegex = /(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))/gi;
                    const scanTextForImages = (textToScan: string) => {
                      if (!textToScan) return;
                      const matches = textToScan.match(imageRegex);
                      if (matches) {
                        matches.forEach(url => {
                          const resolved = resolveUrl(url);
                          if (resolved && !localImages.includes(resolved)) {
                            localImages.push(resolved);
                          }
                        });
                      }
                    };

                    if (q.context) scanTextForImages(q.context);
                    if (q.text) scanTextForImages(q.text);

                    // Clean text and context of raw image URLs (and their containing parentheses)
                    let cleanedContext = q.context || '';
                    let cleanedText = q.text || '';

                    const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)/gi;
                    const parenthesizedUrlRegex = /\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)/gi;
                    const rawUrlRegex = /https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)/gi;

                    cleanedContext = cleanedContext
                      .replace(markdownImageRegex, '')
                      .replace(parenthesizedUrlRegex, '')
                      .replace(rawUrlRegex, '');

                    cleanedText = cleanedText
                      .replace(markdownImageRegex, '')
                      .replace(parenthesizedUrlRegex, '')
                      .replace(rawUrlRegex, '');

                    const finalQuestionText = [cleanedContext, cleanedText]
                      .filter(Boolean)
                      .map(t => t.trim())
                      .join('\n\n') || `Questão ${q.index} - ENEM ${q.year}`;

                    return (
                      <div
                        key={`${qId}-${qIdx}`}
                        onClick={() => handleToggleSelectEnem(q)}
                        className={`p-6 rounded-3xl border transition-all cursor-pointer text-left space-y-4 relative ${
                          isSelected
                            ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                            : 'bg-neutral-950/60 border-neutral-900 hover:border-neutral-800'
                        }`}
                      >
                        {/* Badge / Year */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-black text-[10px] rounded-lg">
                              ENEM {q.year}
                            </span>
                            <span className="px-2.5 py-0.5 bg-neutral-900 text-neutral-450 border border-neutral-850 font-mono font-bold text-[10px] rounded-lg uppercase">
                              {q.discipline || 'Geral'}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-neutral-600">
                              Questão nº {q.index}
                            </span>
                          </div>

                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-amber-400 border-amber-500 text-neutral-950' 
                              : 'border-neutral-800 bg-neutral-900'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Content */}
                        <p className="text-xs md:text-sm font-semibold text-neutral-250 leading-relaxed max-w-full whitespace-pre-wrap font-sans">
                          {finalQuestionText}
                        </p>

                        {/* Images extraction & rendering */}
                        {localImages.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-3 max-w-lg">
                            {localImages.map((imgUrl, imgIdx) => (
                              <div 
                                key={imgIdx} 
                                className="rounded-xl overflow-hidden border border-neutral-900 bg-neutral-950 flex items-center justify-center p-1 max-h-48 cursor-zoom-in group relative"
                                onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: imgUrl }))}
                                title="Clique para ampliar"
                              >
                                <img src={imgUrl} alt="Imagem da questão do ENEM" className="max-h-44 object-contain rounded group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">🔍</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Options */}
                        {q.alternatives && q.alternatives.length > 0 && (
                          <div className="space-y-2 mt-4 pl-2 border-l border-neutral-900">
                            {q.alternatives.map((alt: any, aIdx: number) => {
                              const isCorrect = alt.isCorrect || alt.letter === q.correctAlternative;
                              return (
                                <div
                                  key={alt.letter || aIdx}
                                  className={`p-3 rounded-xl text-xs flex justify-between items-center gap-4 border ${
                                    isCorrect 
                                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300 font-medium' 
                                      : 'bg-neutral-950/30 border-neutral-900/60 text-neutral-450'
                                  }`}
                                >
                                  <span>{alt.letter || String.fromCharCode(65 + aIdx)}) {alt.text}</span>
                                  {isCorrect && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                                      Gabarito
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination load more button */}
                {enemPageSize < enemQuestions.length && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={() => setEnemPageSize(prev => prev + 10)}
                      className="px-6 py-3 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Mostrar mais 10 questões</span>
                      <span className="text-[10px] text-neutral-500 font-mono">({enemPageSize} de {enemQuestions.length} carregadas)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Preview Mode */}
      {viewMode === 'preview-student' && (() => {
        const previewExam = activePreviewExam || {
          title: simTitle,
          instructions: simDescription,
          description: simDescription,
          questions: questions,
          teacher_name: teacherName,
          subject: teacherSubject
        };

        const displayTitle = previewExam.title || simTitle || "Simulado sem título";
        const displayInstructions = previewExam.instructions || previewExam.description || simDescription || "Nenhuma instrução cadastrada.";
        const displayTeacher = previewExam.teacher_name || teacherName || "Professora";
        const displaySubject = previewExam.subject || teacherSubject || "Biologia";

        const displayQuestions: MockExamQuestion[] = (() => {
          if (!previewExam.questions) return [];
          if (typeof previewExam.questions === 'string') {
            try {
              return JSON.parse(previewExam.questions);
            } catch {
              return [];
            }
          }
          return Array.isArray(previewExam.questions) ? previewExam.questions : [];
        })();

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="p-6 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-extrabold text-neutral-100 font-sans tracking-tight">Pré-visualização do Aluno</h2>
                </div>
                <p className="text-xs text-neutral-500 mt-1">Este é o painel interativo exatamente como os estudantes enxergarão o simulado.</p>
              </div>
              
              <button
                type="button"
                onClick={() => setViewMode('normal')}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Editor</span>
              </button>
            </div>

            {/* Exam Details preview */}
            <div className="p-8 rounded-3xl bg-neutral-950/50 border border-neutral-900 backdrop-blur-md space-y-4">
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold font-mono text-[9px] rounded uppercase tracking-widest">
                Modo de Simulação Ativo 👁️
              </span>
              <h1 className="text-xl md:text-2xl font-black text-neutral-100 tracking-tight">{displayTitle}</h1>
              <p className="text-xs text-neutral-450 leading-relaxed max-w-2xl whitespace-pre-wrap font-sans">
                {displayInstructions}
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2 border-t border-neutral-900 text-xs text-neutral-500 font-mono">
                <div>Professor: <span className="text-neutral-300 font-bold">{displayTeacher}</span></div>
                <div>Matéria: <span className="text-neutral-300 font-bold">{displaySubject}</span></div>
                <div>Questões: <span className="text-neutral-300 font-bold">{displayQuestions.length}</span></div>
              </div>
            </div>

            {/* Questions display exactly like StudentSimulados */}
            <div className="space-y-6 pt-2">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 border-b border-neutral-900 pb-2">
                Questões do Simulado
              </h3>
              {displayQuestions.length === 0 ? (
                <div className="p-8 rounded-3xl bg-neutral-950/60 border border-neutral-900 text-center text-xs text-neutral-500 italic">
                  Nenhuma questão cadastrada para este simulado.
                </div>
              ) : (
                displayQuestions.map((q: any, idx: number) => {
                  const optionsList: string[] = q.options || q.alternatives || [];
                  const correctOpt = q.correctOption !== undefined ? q.correctOption : q.correct_option;
                  const qType = q.type === 'written' || q.type === 'essay' || q.type === 'discursiva' ? 'written' : 'multiple';
                  const qImgUrl = q.imageUrl || q.image_url;
                  const qImgUrls = q.imageUrls || q.image_urls;

                  return (
                    <div key={q.id || idx} className="p-8 rounded-3xl bg-neutral-950/60 border border-neutral-900 backdrop-blur-md space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 bg-neutral-900 text-neutral-450 border border-neutral-850 font-bold font-mono text-[10px] rounded">
                          PERGUNTA {idx + 1} • {qType === 'multiple' ? 'MÚLTIPLA ESCOLHA' : 'DISCURSIVA (ESCREVER)'}
                        </span>
                        {q.isEnem && (
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-extrabold font-mono text-[10px] rounded flex items-center gap-1 animate-pulse">
                            ⚡ ENEM {q.enemYear || ""}
                          </span>
                        )}
                        <span className="px-2.5 py-1 bg-neutral-900 text-emerald-400 border border-neutral-850 font-bold font-mono text-[10px] rounded ml-auto">
                          {q.points !== undefined && q.points > 0 ? q.points : 1.0} pt(s)
                        </span>
                      </div>

                      <p className="text-sm md:text-base font-semibold text-neutral-250 leading-relaxed max-w-full whitespace-pre-wrap font-sans">
                        {q.text}
                      </p>

                      {qImgUrls && qImgUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-lg mx-auto">
                          {qImgUrls.map((img: string, imgIdx: number) => (
                            <div 
                              key={imgIdx} 
                              className="rounded-xl overflow-hidden border border-neutral-900 aspect-video bg-neutral-950 flex items-center justify-center cursor-zoom-in group relative"
                              onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: img }))}
                              title="Clique para ampliar"
                            >
                              <img src={img} alt={`Imagem ${imgIdx+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">🔍</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : qImgUrl ? (
                        <div 
                          className="rounded-2xl border border-neutral-900 overflow-hidden bg-neutral-950 p-2 max-h-72 w-fit mx-auto cursor-zoom-in group relative"
                          onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: qImgUrl }))}
                          title="Clique para ampliar"
                        >
                          <img src={qImgUrl} alt="Ilustração da pergunta" className="max-h-64 object-contain group-hover:scale-[1.02] transition-transform duration-300" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                            <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Ampliar 🔍</span>
                          </div>
                        </div>
                      ) : null}

                      {/* Options list */}
                      {qType === 'multiple' && optionsList.length > 0 && (
                        <div className="space-y-3">
                          {optionsList.map((option: string, choiceIdx: number) => {
                            const isCorrect = correctOpt === choiceIdx;
                            return (
                              <div
                                key={choiceIdx}
                                className={`w-full p-4 border rounded-2xl text-left text-xs font-semibold flex items-center justify-between gap-4 transition-all ${
                                  isCorrect
                                    ? 'bg-emerald-500/5 text-emerald-300 border-emerald-500/40'
                                    : 'bg-neutral-950 border-neutral-900 text-neutral-450'
                                }`}
                              >
                                <span className="flex-1 leading-normal font-sans whitespace-pre-wrap">{String.fromCharCode(65 + choiceIdx)}) {option}</span>
                                {isCorrect && (
                                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                                    RESPOSTA CORRETA GABARITADA
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {qType === 'written' && (
                        <div className="space-y-3">
                          <textarea
                            placeholder="Espaço para resposta livre do aluno..."
                            rows={3}
                            disabled
                            className="w-full px-4 py-2.5 bg-neutral-950/40 border border-neutral-900 rounded-xl text-xs text-neutral-500 cursor-not-allowed placeholder-neutral-700 resize-none font-sans"
                          />
                          {q.expectedAnswer && (
                            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                              <strong className="block text-[11px] uppercase font-mono tracking-wider font-extrabold text-emerald-400 mb-1">Gabarito / Resposta Esperada (Professora):</strong>
                              <p className="whitespace-pre-wrap">{q.expectedAnswer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="p-4 bg-neutral-900/30 border border-neutral-850 rounded-2xl text-[11px] text-neutral-450 leading-relaxed flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="font-sans">
                            <span className="font-bold text-neutral-300 block mb-0.5">Comentário/Resolução do Professor:</span>
                            {q.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* Review Modal ("Print" / Detailed Review of submitted Mock Exam) */}
      {selectedSubmission && currentExam && (
        <div className="bg-neutral-950 border border-neutral-900 rounded-3xl w-full flex flex-col h-[calc(100vh-8rem)] shadow-2xl relative animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-900 p-6 shrink-0">
            <div>
              <span className="text-[9px] font-mono tracking-wider uppercase font-bold text-emerald-400">Revisão Detalhada pelo Docente</span>
              <h4 className="text-base font-bold text-neutral-200 mt-1">Simulado Realizado: {currentExam.title}</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Estudante: <strong className="text-neutral-250 truncate">{selectedSubmission.student_name}</strong> ({selectedSubmission.student_email}) • Turma: {selectedSubmission.student_class}
              </p>
            </div>
            <button
              onClick={() => setSelectedSubmission(null)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold rounded-xl border border-neutral-850 transition-all cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>

          {successMsg && (
            <div className="mx-6 mt-4 p-3.5 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-2.5 text-xs text-emerald-300 font-bold animate-slideUp shadow-lg shadow-emerald-950/40 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-normal">Salvo no sistema ✔️</span>
            </div>
          )}

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
            {/* Left Column: Exam Review */}
            <div className="lg:col-span-2 overflow-y-auto p-6 space-y-6 border-r border-neutral-900 custom-scrollbar">
              {/* Score Summary Banner */}
                {(() => {
                  const totalExamPoints = currentExam.questions?.reduce((sum, q) => sum + (q.points !== undefined && q.points > 0 ? q.points : 1.0), 0) || 10;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-850 justify-between items-center text-center">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Nota Alcançada</span>
                        <p className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                          {selectedSubmission.score.toFixed(1)} / {totalExamPoints.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Rendimento</span>
                        <p className="text-lg font-bold text-neutral-200 mt-1">{selectedSubmission.correct_count} de {selectedSubmission.total_questions} corretas</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Horário do Envio</span>
                        <p className="text-xs text-neutral-300 font-mono mt-2">{new Date(selectedSubmission.submitted_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Rendering questions one by one with answers */}
                <div className="space-y-6 pt-2">
                  <h5 className="text-xs font-mono uppercase tracking-wider text-neutral-450 border-b border-neutral-900 pb-2">Folha de Respostas Completa ("Gabarito")</h5>
                  {currentExam.questions?.map((q, idx) => {
                    const studentResponse = selectedSubmission.answers?.[q.id];
                    const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;
                    const hasResponse = studentResponse !== undefined && studentResponse !== null && studentResponse !== '' && studentResponse !== 'undefined';
                    const isCorrect = q.type === 'multiple' && hasResponse && Number(studentResponse) === q.correctOption;
                    let subTel = selectedSubmission.telemetry;
                    if (typeof subTel === 'string') {
                      try { subTel = JSON.parse(subTel); } catch { subTel = null; }
                    }
                    let subMg = selectedSubmission.manual_grades;
                    if (typeof subMg === 'string') {
                      try { subMg = JSON.parse(subMg); } catch { subMg = null; }
                    }
                    if ((!subMg || Object.keys(subMg).length === 0) && subTel && typeof subTel === 'object' && subTel.manual_grades) {
                      subMg = subTel.manual_grades;
                    }
                    const manualGrade = subMg?.[q.id] || (subTel && typeof subTel === 'object' ? subTel.manual_grades?.[q.id] : undefined);

                    return (
                      <div key={q.id} className="p-5 bg-neutral-900/20 border border-neutral-900 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-bold font-mono text-neutral-500">
                            QUESTÃO {idx + 1} ({q.type === 'multiple' ? 'Múltipla Escolha' : 'Discursiva'}) • Valendo {qPts} pt(s)
                          </span>
                          {q.type === 'multiple' ? (
                            !hasResponse ? (
                              <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 border border-neutral-700 font-bold text-[10px] rounded-md">
                                Não Respondida (0.0 pt)
                              </span>
                            ) : isCorrect ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-550/15 font-bold text-[10px] rounded-md">
                                Acertou ✔️ (+{qPts.toFixed(1)} pt)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-550/15 font-bold text-[10px] rounded-md">
                                Errou ❌ (+0.0)
                              </span>
                            )
                          ) : (
                            manualGrade ? (
                              <span className={`px-2 py-0.5 font-bold text-[10px] rounded-md border ${
                                manualGrade.status === 'correct'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : manualGrade.status === 'half'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}>
                                Avaliado: +{manualGrade.pointsAwarded.toFixed(1)} pt(s)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-md animate-pulse">
                                ⏳ Correção Pendente
                              </span>
                            )
                          )}
                        </div>

                        <p className="text-xs font-semibold text-neutral-250 leading-relaxed whitespace-pre-wrap font-sans">{q.text}</p>
                        {q.imageUrls && q.imageUrls.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-lg">
                            {q.imageUrls.map((img, imgIdx) => (
                              <div 
                                key={imgIdx} 
                                className="rounded-xl overflow-hidden border border-neutral-905 aspect-video bg-neutral-950 flex items-center justify-center cursor-zoom-in group relative"
                                onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: img }))}
                                title="Clique para ampliar"
                              >
                                <img src={img} alt={`Imagem ${imgIdx+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">🔍</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : q.imageUrl ? (
                          <div 
                            className="mt-2 rounded-xl overflow-hidden border border-neutral-900 max-h-48 w-fit bg-neutral-950 cursor-zoom-in group relative"
                            onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: q.imageUrl }))}
                            title="Clique para ampliar"
                          >
                            <img src={q.imageUrl} alt="Imagem da questão" className="max-h-48 w-auto object-contain group-hover:scale-[1.02] transition-transform duration-300" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Ampliar 🔍</span>
                            </div>
                          </div>
                        ) : null}

                        {/* Multiple choice responses color coded */}
                        {q.type === 'multiple' && q.options && (
                          <div className="mt-3 space-y-2">
                            {q.options.map((optionText, oIdx) => {
                              const isStudentChoice = hasResponse && Number(studentResponse) === oIdx;
                              const isCorrectChoice = q.correctOption === oIdx;

                              let choiceStyle = "bg-neutral-950/20 border-neutral-900 text-neutral-450";
                              if (isStudentChoice && isCorrectChoice) {
                                choiceStyle = "bg-emerald-500/5 border-emerald-500/35 text-emerald-300 font-semibold";
                              } else if (isStudentChoice && !isCorrectChoice) {
                                choiceStyle = "bg-red-500/5 border-red-500/35 text-red-350 font-semibold";
                              } else if (isCorrectChoice) {
                                choiceStyle = "bg-emerald-500/5 border-emerald-500/10 text-emerald-450";
                              }

                              return (
                                <div key={oIdx} className={`px-3 py-2 border rounded-xl text-xs flex items-center justify-between gap-3 ${choiceStyle}`}>
                                  <span className="whitespace-pre-wrap">{String.fromCharCode(65 + oIdx)}) {optionText}</span>
                                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase">
                                    {isStudentChoice && <span className="font-bold">Resposta do Aluno</span>}
                                    {isCorrectChoice && <span className="text-emerald-400 font-extrabold">[Correta]</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Written text response & manual grading panel */}
                        {q.type === 'written' && (
                          <div className="mt-3 space-y-3">
                            <div className="p-3 bg-neutral-950 border border-neutral-870/80 rounded-xl space-y-1">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 font-mono block">
                                Resposta por extenso escrita pelo aluno:
                              </span>
                              <p className="text-neutral-200 text-xs italic whitespace-pre-wrap">
                                {studentResponse ? String(studentResponse) : "Sem resposta escrita"}
                              </p>
                            </div>

                            {/* Manual correction buttons */}
                            <div className="p-3.5 bg-neutral-950 border border-emerald-500/20 rounded-xl space-y-2">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-wider block">
                                  📝 Avaliar Resposta Dissertativa (Valendo {qPts} pt{qPts !== 1 ? 's' : ''}):
                                </span>
                                {manualGrade?.gradedBy === 'ai' ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-mono font-bold">
                                    🤖 Corrigido pela IA (Você pode editar abaixo)
                                  </span>
                                ) : q.correctionType === 'ai' ? (
                                  <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded text-[9px] font-mono">
                                    🤖 Configurado para IA
                                  </span>
                                ) : null}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleGradeWrittenQuestion(q.id, 'correct', qPts)}
                                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    manualGrade?.status === 'correct'
                                      ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                                      : 'bg-neutral-900 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  <span>Correto ✔️</span>
                                  <span className="text-[10px] font-mono opacity-80">(+{qPts} pt)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleGradeWrittenQuestion(q.id, 'half', qPts)}
                                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    manualGrade?.status === 'half'
                                      ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                                      : 'bg-neutral-900 hover:bg-amber-950/40 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  <span>Meio Certo 🌓</span>
                                  <span className="text-[10px] font-mono opacity-80">(+{(qPts / 2).toFixed(1)} pt)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleGradeWrittenQuestion(q.id, 'wrong', qPts)}
                                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    manualGrade?.status === 'wrong'
                                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                                      : 'bg-neutral-900 hover:bg-rose-950/40 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  <span>Errado ❌</span>
                                  <span className="text-[10px] font-mono opacity-80">(+0 pt)</span>
                                </button>
                              </div>

                              {/* Feedback gravado e enviado ao aluno */}
                              {manualGrade?.comment && manualGrade.comment.trim() ? (
                                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono flex items-center gap-1.5">
                                      <span>💬 Feedback enviado ao aluno:</span>
                                    </span>
                                    <span className="text-[9px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                      Salvo no sistema ✔️
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-100 font-sans italic whitespace-pre-wrap leading-relaxed bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-850">
                                    "{manualGrade.comment}"
                                  </p>
                                </div>
                              ) : null}

                              {/* Campo para digitar ou editar feedback */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold text-neutral-400 font-mono uppercase">
                                    {manualGrade?.comment ? "Editar feedback enviado:" : "Feedback ou observação do professor:"}
                                  </label>
                                  <span className="text-[10px] text-neutral-500 font-mono">Pressione Enter ou clique em Salvar</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    key={`${selectedSubmission.id}-${q.id}-${manualGrade?.comment || ''}`}
                                    type="text"
                                    placeholder="Digite a observação/feedback e pressione Enter para salvar..."
                                    defaultValue={manualGrade?.comment || ''}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleGradeWrittenQuestion(q.id, manualGrade?.status || 'correct', qPts, (e.target as HTMLInputElement).value);
                                      }
                                    }}
                                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-100 outline-none placeholder-neutral-600 transition-colors"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                      if (input) {
                                        handleGradeWrittenQuestion(q.id, manualGrade?.status || 'correct', qPts, input.value);
                                      }
                                    }}
                                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-500/20"
                                    title="Salvar feedback"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Salvar</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {q.explanation && (
                          <p className="text-[11px] text-neutral-450 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 mt-2 font-sans italic">
                            <strong className="text-emerald-400 not-italic">Gabarito comentado:</strong> {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            {/* Right Column: Telemetry Dashboard */}
            <div className="lg:col-span-1 overflow-y-auto p-6 bg-neutral-950/30 custom-scrollbar">
              <h5 className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Telemetria da Prova
              </h5>
              
              {(() => {
                let tel = selectedSubmission.telemetry;
                if (!tel) return null;
                if (typeof tel === 'string') {
                  try {
                    tel = JSON.parse(tel);
                  } catch (e) {
                    tel = null;
                  }
                }
                
                // If it is parsed successfully and is not empty
                if (tel && typeof tel === 'object' && Object.keys(tel).length > 0) {
                  return (
                    <div className="space-y-6">
                      <div className="bg-neutral-900/50 border border-neutral-850 p-4 rounded-2xl">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block mb-1">Tempo Total Gasto</span>
                        <p className="text-2xl font-mono text-neutral-200">
                          {Math.floor((tel.totalTimeSeconds || 0) / 60)}m {((tel.totalTimeSeconds || 0) % 60)}s
                        </p>
                      </div>

                      <div className="bg-neutral-900/50 border border-neutral-850 p-4 rounded-2xl">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block mb-1">Trocas de Aba / Janela</span>
                        <p className="text-xl font-mono text-neutral-200 flex items-center gap-2">
                          {tel.tabSwitches || 0}
                          {(tel.tabSwitches || 0) > 2 && (
                            <span title="Alerta: Várias trocas de aba detectadas">
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            </span>
                          )}
                        </p>
                        <p className="text-[9px] text-neutral-500 mt-1">Indica se o aluno saiu da tela da prova.</p>
                      </div>

                      <div className="bg-neutral-900/50 border border-neutral-850 p-4 rounded-2xl">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block mb-3">Detalhes por Questão</span>
                        <div className="space-y-3">
                          {currentExam.questions?.map((q, idx) => {
                            const timeSec = tel?.questionTimes?.[q.id] || 0;
                            const changes = tel?.optionChanges?.[q.id] || 0;
                            return (
                              <div key={`tel-${q.id}`} className="bg-neutral-950 border border-neutral-900 p-3 rounded-xl flex items-center justify-between">
                                <span className="text-[10px] font-bold font-mono text-neutral-400">Q{idx + 1}</span>
                                <div className="text-right">
                                  <div className="text-[11px] font-mono text-neutral-300">
                                    {Math.floor(timeSec / 60)}m {timeSec % 60}s
                                  </div>
                                  <div className="text-[9px] text-neutral-500 mt-0.5">
                                    {changes} alteraç{changes === 1 ? 'ão' : 'ões'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-neutral-900/50 border border-neutral-850 rounded-2xl p-4">
                    <AlertCircle className="w-8 h-8 text-neutral-600" />
                    <p className="text-xs text-neutral-500">Dados de telemetria não disponíveis para este envio antigo.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Conceder Tempo Extra */}
      {extraTimeStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setExtraTimeStudent(null)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-350 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-200">Definir Tempo Extra de Simulado</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Você pode conceder minutos adicionais para o aluno <span className="text-neutral-200 font-semibold">{extraTimeStudent.name}</span> fazer o simulado.
                Se ele já tiver finalizado ou estourado o tempo, conceder tempo extra irá <span className="text-amber-400 font-medium">reabrir a prova</span> para que ele possa retomar e finalizar.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-2">
                  Minutos Adicionais (Tempo de tolerância a mais do que o oficial)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={extraMinutesInput}
                    onChange={(e) => setExtraMinutesInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full pl-4 pr-12 py-3 bg-neutral-900 border border-neutral-800 focus:border-amber-500/50 rounded-2xl text-sm text-neutral-200 outline-none transition-all font-mono font-bold"
                  />
                  <span className="absolute right-4 top-3.5 text-xs text-neutral-500 font-bold uppercase tracking-wider">min</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExtraTimeStudent(null)}
                  className="flex-1 py-3 px-4 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 font-semibold rounded-2xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingExtraTime}
                  onClick={handleSaveExtraTime}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-neutral-950 font-bold rounded-2xl text-xs transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                >
                  {isSavingExtraTime ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Tempo Extra</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personal Question Bank Fullscreen Modal */}
      <PersonalQuestionBankModal
        isOpen={isPersonalBankOpen}
        onClose={() => setIsPersonalBankOpen(false)}
        personalQuestions={personalQuestions}
        currentExamQuestions={questions}
        onImportQuestion={handleImportQuestionFromBank}
        onImportMultipleQuestions={handleImportMultipleQuestionsFromBank}
        teacherName={teacherName}
      />
    </div>
  );
}
